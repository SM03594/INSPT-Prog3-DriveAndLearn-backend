# Flujo: agendar una clase

## Qué es esto, en una frase

Un alumno con saldo elige profesor, auto, día y hora, y manda
`POST /api/clases`. La API comprueba **todo** lo que podría impedir esa clase
(datos, horario de la escuela, disponibilidad del profesor, superposiciones y
saldo), descuenta un crédito y la guarda. Esta guía sigue ese pedido a través
de las capas, con las respuestas reales de la API.

> Las respuestas son **reales**: se obtuvieron ejecutando el flujo contra la
> API con una base en memoria. El escenario es un lunes 26/10/2026, con la
> escuela abierta de 08 a 20, el profesor Juan disponible de 09 a 17, y la
> alumna Ana con 2 clases de saldo.

Cómo se representan los horarios, y por qué una clase tiene que "caber en un
tramo", se explica en detalle en
[`../temas/horarios-y-agendamiento.md`](../temas/horarios-y-agendamiento.md).
Esta guía se concentra en el **recorrido** del pedido.

---

## Antes de reservar: lo que tiene que existir

Una reserva depende de datos que carga un **administrador**. Si falta alguno,
la API lo dice:

| Requisito | Cómo lo carga el admin | Si falta |
|---|---|---|
| Horario de la escuela | `POST /api/horario-escuela/agregar` o `PUT /api/horario-escuela` | 409 "Todavía no se configuró el horario de la escuela" |
| Profesor con disponibilidad | `POST /api/profesores` + `POST /api/profesores/:id/disponibilidad` | 409 "El profesor no está disponible en ese horario" |
| Auto **activo** | `POST /api/autos` (nace activo) | 409 "El auto no está disponible para reservas" |
| Saldo del alumno | `PATCH /api/alumnos/:id/sumar-clases` `{ "cantidad": 2 }` | 409 "No tenés clases disponibles para reservar" |

Un alumno recién registrado tiene saldo **0**: no puede reservar hasta que un
admin le cargue clases.

---

## El mapa

```
POST /api/clases   Authorization: Bearer <token de Ana>
{ "profesor": "...", "auto": "...", "inicio": "2026-10-26T10:00:00-03:00", "fin": "2026-10-26T11:00:00-03:00" }
 │
 ▼ clase.routes        requireAuthentication → validacionDeCuerpo
 ▼ clase.controller    actorDe(req) → { id: Ana, rol: 'alumno' }
 │   ① aCrearClaseDto           ¿campos de su rol? ¿texto? ¿todos? ¿fechas con zona?  400
 ▼ clase.service.crear
 │   ② validarActor             ¿la cuenta del token sigue existiendo?               403
 │   ③ obtenerInstantes         1 h exacta · sin segundos · futura                    400
 │   ④ objectId                 ¿los ids tienen formato válido?                       400
 │   ⑤ validarDisponibilidad    profesor/auto existen · auto activo · horario escuela
 │                              · cabe en escuela y profesor · sin superposición     404/409
 │   ⑥ descontar 1 crédito      operación atómica: solo si clasesPorReservar ≥ 1      409
 │   ⑦ ClaseModel.create        si falla, se devuelve el crédito
 ▼
201 { alumno, profesor, auto, inicio, fin, _id, ... }
```

El orden importa: el saldo se descuenta **al final**, cuando ya se sabe que la
clase es posible. Así nunca se descuenta un crédito por una reserva que
después se rechaza.

---

## El recorrido

### Paso 1. La ruta: solo pide token

`src/routes/clase.routes.ts:17-23`:

```ts
router.use(requireAuthentication);
router.post('/', validacionDeCuerpo, claseController.crear);
```

A diferencia de autos o profesores, **no** hay `requireAdministrator`:
pueden reservar tanto los alumnos como los admins. Qué puede mandar cada uno lo
decide el **DTO** según el rol, y qué puede hacer, el **service**.

### Paso 2. El controller: quién reserva

`src/controllers/clase.controller.ts:38`:

```ts
export async function crear(req: Request, res: Response) {
  const actor = actorDe(req);
  const clase = await claseService.crear(aCrearClaseDto(req.body, actor.rol), actor);
  res.status(201).json(clase);
}
```

`actorDe` (`:15`) convierte `req.auth` en un `ActorClase { id, rol }`, que es
lo que entiende el service. Ver
[`../capas/06-controllers.md`](../capas/06-controllers.md#2-leer-la-entrada).

### Paso 3. ① Campos según el rol: el DTO

`aCrearClaseDto` (`src/dtos/clase.dto.ts:64`) recibe el rol, porque el
**contrato** de la reserva depende de quién reserva:

| Quién reserva | Campos permitidos | De quién es la clase |
|---|---|---|
| Alumno | `profesor`, `auto`, `inicio`, `fin` | De él mismo (`actor.id`) |
| Admin | Los mismos, **más** `alumno` (obligatorio) | Del alumno que indique |

Un alumno **no puede** reservar a nombre de otro:

```
Ana manda { ..., "alumno": "<id de Beto>" }  → 400 "No se pueden enviar estos campos: alumno"
Admin sin "alumno"                           → 400 "El alumno es obligatorio"
Admin con "alumno": "<id de Beto>"           → 201 (la clase es de Beto y se descuenta del saldo de Beto)
```
El DTO revisa la **forma**: qué campos, y que cada uno sea un texto. Además
convierte `inicio` y `fin` a `Date` con `parsearInstante`: si no son una fecha
ISO 8601 **con zona** (o el día no existe), responde 400. Que los ids sean
válidos lo revisa el service, en el paso 6.


### Paso 4. ② La cuenta sigue activa

`validarActor` (`:43`) busca al alumno o al admin del token. Si lo borraron
mientras el token seguía vigente, responde 403 "La cuenta autenticada ya no
está activa".

### Paso 5. ③ Las fechas

Las fechas ya llegan como `Date`: el formato lo validó el DTO en el paso 3.
`obtenerInstantes` (`:62`) comprueba las reglas:

| Regla | Pedido que la rompe | Respuesta |
|---|---|---|
| ISO 8601 **con zona** (en el DTO) | `"2026-10-26T12:00:00"` | 400 "El inicio debe ser una fecha ISO 8601 con zona horaria (ej. 2026-09-20T09:00:00-03:00)" |
| Exactamente 1 hora | De 12:00 a 14:00 | 400 "La duración de la clase debe ser exactamente una hora" |
| Sin segundos | `10:00:30` | 400 "El inicio y el fin deben tener precisión de minutos" |
| En el futuro | `2025-01-06T12:00:00-03:00` | 400 "La clase debe reservarse para una fecha futura" |

Por qué se exige la zona se explica en
[`../guias/zonas-horarias-y-fechas.md`](../guias/zonas-horarias-y-fechas.md#2-entrada-la-zona-es-obligatoria).

### Paso 6. ④ Formato de los ids

`objectId` (`:38`): `"profesor": "abc"` → 400 "profesor debe ser un
identificador válido". Un id con formato válido que no existe pasa este paso
y lo frena el siguiente.

### Paso 7. ⑤ ¿Es posible esta clase?

`validarDisponibilidad` (`:81`) carga en paralelo el profesor, el auto y el
horario de la escuela, y comprueba:

```
profesor existe ............................. 404 "Profesor no encontrado"
auto existe ................................. 404 "Auto no encontrado"
auto activo ................................. 409 "El auto no está disponible para reservas"
horario de la escuela configurado ........... 409 "Todavía no se configuró el horario de la escuela"
cabe en un tramo de la ESCUELA ese día ...... 409 "La clase queda fuera del horario de la escuela"
cabe en un tramo del PROFESOR ese día ....... 409 "El profesor no está disponible en ese horario"
nadie (alumno, profesor, auto) ocupado ...... 409 "El alumno, profesor o auto ya tiene una clase en ese horario"
```

El lunes del ejemplo, con las reservas que se fueron haciendo:

```
              07   08   09   10   11   12   13   14   15   16   17   18   19   20
Escuela          ├──────────────────────────────────────────────────────────────┤
Juan (prof.)          ├───────────────────────────────────────────┤
Ana                        [====][====]                                  ← 10–11 y 11–12: 201
Beto (por admin)                                 [====]                  ← 14–15: 201

Intentos rechazados:
07–08 ........ 409 fuera del horario de la escuela
18–19 ........ 409 el profesor no está disponible
16:30–17:30 .. 409 el profesor no está disponible (se pasa de las 17)
Beto 10:30–11:30 con Juan ... 409 superposición (Juan ya está con Ana)
Domingo 10–11 ............... 409 fuera del horario de la escuela (ese día no abre)
```

Las clases **consecutivas** sí se aceptan (Ana: 10–11 y 11–12). La
superposición se calcula con `inicio < otro.fin && fin > otro.inicio`, y
`11 < 11` es falso.

### Paso 8. ⑥ Descontar el crédito

`clase.service.ts:275`:

```ts
const alumno = await AlumnoModel.findOneAndUpdate(
  { _id: alumnoId, clasesPorReservar: { $gte: 1 } },   // solo si tiene saldo
  { $inc: { clasesPorReservar: -1 } },
  { returnDocument: 'after', runValidators: true },
);
if (alumno === null) { /* 404 si no existe; si existe, 409 sin saldo */ }
```

La condición y la resta se hacen en **una sola operación**: dos reservas
simultáneas no pueden gastar el mismo crédito. Ver
[`../capas/07-services.md`](../capas/07-services.md#7-operaciones-atómicas-y-compensación-reservar-una-clase).

Ana, después de dos reservas:

```
saldo 2 → reserva 10–11 → saldo 1 → reserva 11–12 → saldo 0
tercera reserva → 409 "No tenés clases disponibles para reservar"
```

### Paso 9. ⑦ Guardar, y compensar si falla

```ts
try {
  return await ClaseModel.create(datosClase);
} catch (error) {
  await AlumnoModel.updateOne({ _id: alumnoId }, { $inc: { clasesPorReservar: 1 } });  // devolver
  throw error;
}
```

Si el `create` falla, se **devuelve** el crédito y se relanza el error. Si
incluso la devolución fallara, se lanza un `AggregateError` con los dos
problemas, que termina en un 500.

### Paso 10. La respuesta

```
201 {
  "alumno": "6ada687f...ef7", "profesor": "6ada687f...ef2", "auto": "6ada687f...ef5",
  "inicio": "2026-10-26T13:00:00.000Z",
  "fin":    "2026-10-26T14:00:00.000Z",
  "_id": "6ada687f...eff", "createdAt": "...", "updatedAt": "..."
}
```

- Se pidió `10:00-03:00` y la respuesta dice `13:00Z`: es **el mismo
  instante**, expresado en UTC. El frontend lo muestra en la hora local.
- `alumno`, `profesor` y `auto` vienen como **ids**, sin `populate`. Para
  mostrar el nombre del profesor, el cliente tiene que pedirlo aparte
  (`GET /api/profesores/:id`).
- No hay campo de estado: si la clase existe, está reservada. Para cancelarla
  se elimina (`DELETE /api/clases/:id`).

### Paso 11. Consultar las reservas

`GET /api/clases` (`clase.service.ts:222`):

- Un **alumno** recibe solo **sus** clases, ordenadas por `inicio`. Ana ve 2.
- Un **admin** recibe **todas**: en el ejemplo, 3.

`GET /api/clases/:id` pasa antes por `requireAlumnoDeLaClaseOAdministrador`:
si Ana pide la clase de Beto, responde 403 "Solo podés acceder a tus propias
clases" (ver [`modificar-y-eliminar-una-clase.md`](modificar-y-eliminar-una-clase.md)).

---

## Qué puede salir mal

Ordenado según el paso que lo detecta:

| Pedido | Respuesta real |
|---|---|
| Sin token | 401 "Se requiere autenticación válida" |
| Alumno manda `alumno` | 400 "No se pueden enviar estos campos: alumno" |
| Manda `estado` | 400 "No se pueden enviar estos campos: estado" |
| Falta `auto` | 400 "El auto es obligatorio" |
| `profesor: 123` | 400 "El profesor debe ser un texto" |
| Fecha sin zona | 400 "El inicio debe ser una fecha ISO 8601 con zona horaria (…)" |
| 2 horas | 400 "La duración de la clase debe ser exactamente una hora" |
| Fecha pasada | 400 "La clase debe reservarse para una fecha futura" |
| `profesor: "abc"` | 400 "profesor debe ser un identificador válido" (el formato del mensaje está en I-51) |
| Profesor inexistente | 404 "Profesor no encontrado" |
| Auto fuera de servicio | 409 "El auto no está disponible para reservas" |
| Horario de la escuela sin cargar | 409 "Todavía no se configuró el horario de la escuela" |
| Fuera del horario de la escuela | 409 "La clase queda fuera del horario de la escuela" |
| Fuera de la disponibilidad del profesor | 409 "El profesor no está disponible en ese horario" |
| Profesor, auto o alumno ya ocupados | 409 "El alumno, profesor o auto ya tiene una clase en ese horario" |
| Saldo 0 | 409 "No tenés clases disponibles para reservar" (ver I-31: también se lo dice así a un admin) |

---

## Resumen

- Antes de reservar, un admin tiene que cargar el horario de la escuela, el
  profesor con su disponibilidad, un auto activo y el saldo del alumno.
- La ruta solo pide token. El **service** decide según el rol: un alumno
  reserva para sí mismo, y un admin para el alumno que indique.
- 7 comprobaciones en orden: campos y formato de las fechas (DTO) → cuenta →
  reglas de las fechas → ids → disponibilidad → saldo → guardar. El crédito se descuenta **al final**, de forma atómica, y
  se devuelve si falla el guardado.
- La clase se guarda en UTC y los ids sin `populate`.

**Siguiente lectura:** [`modificar-y-eliminar-una-clase.md`](modificar-y-eliminar-una-clase.md).
