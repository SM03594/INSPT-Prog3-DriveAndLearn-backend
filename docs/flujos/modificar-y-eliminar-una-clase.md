# Flujo: modificar y eliminar una clase

## Qué es esto, en una frase

Una clase reservada se puede **reprogramar** (`PUT /api/clases/:id`:
cambiar la hora, el profesor o el auto) o **eliminar**
(`DELETE /api/clases/:id`). Al reprogramar se vuelven a hacer todas las
comprobaciones de la reserva. Al eliminar, la clase se borra de la base y, si
todavía no empezó, el alumno recupera su crédito. En los dos casos, la ruta
primero comprueba que la clase sea del alumno que pide, o que pida un admin.

> Las respuestas son **reales**, con el mismo escenario que
> [`agendar-una-clase.md`](agendar-una-clase.md): el lunes 09/11/2026, con la escuela
> abierta de 08 a 20, el profesor Juan de 09 a 17, Ana con clases de 10–11 y
> 11–12, y Beto de 14 a 15.

---

## El mapa

```
              PUT /api/clases/:id                         DELETE /api/clases/:id
              { inicio?, fin?, profesor?, auto? }         (sin body)
                         │                                         │
                         ▼                                         ▼
     requireAlumnoDeLaClaseOAdministrador  ── ¿la clase es de otro alumno? → 403 ──
                         │                                         │
                         ▼                                         │
               validacionDeCuerpo (400)                            │
                         │                                         │
                         ▼                                         ▼
       ┌──── clase.service.actualizar ────┐      ┌──── clase.service.eliminar ─────┐
       │ (DTO: campos y fechas)           │      │ cuenta activa                   │
       │ cuenta activa                    │      │ ¿existe? (si no → 404)          │
       │ ¿existe? (si no → 404)           │      │ ¿todavía no empezó?             │
       │ ¿ya empezó? → 409                │      │ deleteOne()                     │
       │ calcular inicio/fin              │      │ si no empezó: saldo + 1         │
       │ validarDisponibilidad (sin ella) │      │   (alumno.service)              │
       │ save()                           │      └─────────────────────────────────┘
       └──────────────────────────────────┘
              el saldo NO cambia                  el saldo SUBE 1 (solo si no empezó)
```

Una clase no tiene estados: si existe, está reservada.

```
              POST /api/clases                       DELETE /api/clases/:id
 (no existe) ─────────────────► reservada ──────────────────────────────► (no existe)
                                  │  ▲
                                  └──┘
                           PUT /api/clases/:id
```

---

## Parte 1: quién puede tocar una clase

### Paso 1. El middleware de la ruta

`src/routes/clase.routes.ts:20-23`:

```ts
router.get('/:id', requireAlumnoDeLaClaseOAdministrador, claseController.obtener);
router.put('/:id', requireAlumnoDeLaClaseOAdministrador, validacionDeCuerpo, claseController.actualizar);
router.delete('/:id', requireAlumnoDeLaClaseOAdministrador, claseController.eliminar);
```

`requireAlumnoDeLaClaseOAdministrador` (`src/middlewares/auth.middleware.ts:200`)
deja pasar a un **admin activo** y al **alumno de la clase**. Para saber de
quién es, le pide al service solo ese dato (`claseService.obtenerPorIdAlumno`,
`src/services/clase.service.ts:240`):

```ts
const idAlumnoDeLaClase = await claseService.obtenerPorIdAlumno(req.params.id);   // :218
const esDeOtroAlumno = idAlumnoDeLaClase !== null && idAlumnoDeLaClase !== auth.id;
```

| Ana pide… | Respuesta |
|---|---|
| `GET`, `PUT` o `DELETE` sobre la clase de Beto | 403 "Solo podés acceder a tus propias clases" |
| `PUT` sobre la clase de Beto **sin body** | 403: el permiso se revisa **antes** que el body |
| `PUT` sobre una clase que no existe | 404 "Clase no encontrada": no hay dueño que comparar, así que pasa y responde el controller |
| `DELETE /api/clases/abc` | 400 "Id inválido" (Mongoose no puede buscar ese id) |

¿Por qué no se usa `requireSelfOrAdministrator`? Ese middleware compara el
usuario del token con el `:id` de la URL, y acá el `:id` es el de una **clase**:
nunca coincidirían. Hace falta buscar la clase para conocer a su alumno.

---

## Parte 2: modificar (`PUT /api/clases/:id`)

### Paso 2. Controller y DTO

`src/controllers/clase.controller.ts:51`:

```ts
const idClase: string = req.params.id;
const cambios: ActualizarClaseDto = aActualizarClaseDto(req.body);
const actor: Actor = extraerActor(req);
const clase: ClaseDoc | null = await claseService.actualizar(idClase, cambios, actor);

if (clase === null) {
  res.status(404).json({ mensaje: 'Clase no encontrada' });
} else {
  res.json(clase);
}
```

`aActualizarClaseDto` (`src/dtos/clase.dto.ts:84`) acepta **solo** `profesor`,
`auto`, `inicio` y `fin`, como texto, y al menos uno. Las fechas las convierte
a `Date` con `parsearInstante`; la que no se manda queda `undefined`:

| Body | Respuesta |
|---|---|
| `{}` | 400 "Debe indicarse al menos un campo para actualizar" |
| `{ "alumno": "..." }` | 400 "No se pueden modificar estos campos: alumno" |
| `{ "estado": "confirmada" }` | 400 "No se pueden modificar estos campos: estado" |
| `{ "inicio": 123 }` | 400 "El inicio debe ser un texto" |
| `{ "inicio": "2026-11-09T15:00:00" }` (sin zona) | 400 "El inicio debe ser una fecha ISO 8601 con zona horaria (…)" |

El alumno de una clase no se puede cambiar. Por qué la zona es obligatoria se
explica en [`../guias/zonas-horarias-y-fechas.md`](../guias/zonas-horarias-y-fechas.md).

### Paso 3. ¿Todavía se puede modificar?

`actualizar` (`clase.service.ts:331`) busca la clase con `claseAccesible`
(`:51`) y se la pasa a `reprogramar` (`:305`). Lo primero que hace es
`validarClaseModificable` (`:192`):

| Clase | Respuesta |
|---|---|
| Ya empezó (`inicio <= ahora`) | 409 "No se puede modificar una clase que ya comenzó" |

### Paso 4. Calcular el nuevo horario

`obtenerInstantesActualizados` (`:200`) completa lo que no vino, manteniendo
siempre la duración de **1 hora**:

| Se manda | `inicio` resultante | `fin` resultante |
|---|---|---|
| Solo `inicio` | El nuevo | **nuevo inicio + 1 h** |
| Solo `fin` | **nuevo fin − 1 h** | El nuevo |
| Los dos | El nuevo | El nuevo (tiene que dar 1 h exacta) |
| Ninguno (solo profesor o auto) | El actual | El actual |

Ana mueve su clase de 10–11 mandando solo el inicio:

```http
PUT /api/clases/<clase de Ana>
{ "inicio": "2026-11-09T15:00:00-03:00" }
```
```
200 { ..., "inicio": "2026-11-09T18:00:00.000Z", "fin": "2026-11-09T19:00:00.000Z", ... }
                     └── 15:00 local ──┘             └── 16:00 local, calculado ──┘
```

Después pasa por las mismas reglas de fecha que la reserva (futura, en una
hora en punto, 1 hora). Mover la clase a las 10:30 responde 400 *"La clase
debe empezar en una hora en punto (por ejemplo, 08:00)"*.

### Paso 5. Volver a comprobar la disponibilidad, sin chocar consigo misma

```ts
await validarDisponibilidad(
  { alumno: clase.alumno, profesor, auto, ...instantes },
  clase._id.toString(),               // ← excluirId
);
```

Es **la misma** función que usa la reserva (auto activo, horario de la escuela,
disponibilidad del profesor, superposiciones), con una diferencia: `excluirId`.

```
Sin excluirId:   la clase de Ana 15–16 ──"¿hay otra clase de Ana a las 15–16?"──► ¡sí, ella misma! → 409
Con excluirId:   la consulta agrega { _id: { $ne: <esta clase> } } → solo mira las OTRAS clases
```

| Cambio de Ana | Respuesta |
|---|---|
| Mismo horario (15–16) | 200 |
| A las 14 (Juan ya está con Beto) | 409 "El alumno, profesor o auto ya tiene una clase en ese horario" |
| A otro profesor, sin disponibilidad cargada | 409 "El profesor no está disponible en ese horario" |

### Paso 6. Guardar

```ts
clase.profesor = profesor; clase.auto = auto;
clase.inicio = instantes.inicio; clase.fin = instantes.fin;
const claseReprogramada = await clase.save();      // :326
```

Usa `.save()` para que corra también el `pre('validate')` del modelo (fin
posterior al inicio). **El saldo no cambia**: la clase sigue siendo una sola.

---

## Parte 3: eliminar (`DELETE /api/clases/:id`)

### Paso 7. Ruta y controller

`clase.routes.ts:23` → `clase.controller.ts:66`. No lleva
`validacionDeCuerpo`: eliminar no necesita datos, la URL dice todo.

```ts
const idClase: string = req.params.id;
const actor: Actor = extraerActor(req);
const clase: ClaseDoc | null = await claseService.eliminar(idClase, actor);

if (clase === null) {
  res.status(404).json({ mensaje: 'Clase no encontrada' });
} else {
  res.status(204).end();
}
```

### Paso 8. El service

`eliminar` (`clase.service.ts:356`):

```
validarActor ─► claseAccesible (no existe → null → 404)
   │
   ├─ todaviaNoEmpezo = clase.inicio > new Date()          ← :364, se calcula ANTES de borrar
   ├─ clase.deleteOne()                                    ← :366
   ├─ si todaviaNoEmpezo:
   │     alumnoService.sumarClasesPorReservar(alumno, 1)   ← :370, devuelve el crédito
   ▼
204 (sin cuerpo)
```

| Clase | ¿Se borra? | ¿Vuelve el crédito? |
|---|---|---|
| Todavía no empezó | Sí | **Sí** |
| En curso o ya ocurrió | Sí | No: una clase que ya empezó se considera usada |

Comparar `clase.inicio > new Date()` no necesita saber la zona horaria: se
comparan dos instantes (ver
[`../guias/zonas-horarias-y-fechas.md`](../guias/zonas-horarias-y-fechas.md#5-comparar-no-necesita-la-zona)).

El crédito se devuelve **a través de `alumno.service`**: `clase.service` no
modifica el saldo directamente. El service **no revisa** si el borrado o la
suma funcionaron: hace las dos acciones en orden. Si la suma fallara, la clase
quedaría borrada sin reintegro y el pedido respondería 500.

Lo que pasó con Ana:

```
saldo de Ana: 0
DELETE /api/clases/<15–16>   → 204            → saldo 1
DELETE /api/clases/<15–16>   → 404 "Clase no encontrada"  → saldo 1   (no sube de nuevo)
PUT    /api/clases/<15–16>   → 404 "Clase no encontrada"
DELETE /api/clases/<clase pasada de Ana>  → 204  → saldo 1   (no se devuelve)
```

### Paso 9. El horario queda libre

La clase ya no existe, así que la búsqueda de superposiciones
(`validarAusenciaDeConflictos`, `:137`) no la encuentra. Beto puede reservar
ese mismo horario con el mismo profesor y el mismo auto:

```
Beto: POST /api/clases { 15:00–16:00 con Juan y el mismo auto } → 201
```

No queda historial: la clase desaparece también de `GET /api/clases`.

---

## Qué puede hacer cada rol

| Acción | Alumno | Admin |
|---|---|---|
| Ver una clase | Solo las suyas (las de otros → 403) | Cualquiera |
| Modificar | Solo las suyas (las de otros → 403) | Cualquiera |
| Eliminar | Solo las suyas (las de otros → 403) | Cualquiera (el crédito vuelve al alumno de la clase) |
| Cambiar el alumno por `PUT` | No | No |

---

## Qué puede salir mal

| Pedido | Respuesta real |
|---|---|
| `GET`, `PUT` o `DELETE` sobre la clase de otro alumno | 403 "Solo podés acceder a tus propias clases" |
| `PUT` con `{}` | 400 "Debe indicarse al menos un campo para actualizar" |
| `PUT` con `alumno` o `estado` | 400 "No se pueden modificar estos campos: alumno" / "…: estado" |
| `PUT` con una fecha sin zona | 400 "El inicio debe ser una fecha ISO 8601 con zona horaria (…)" |
| `PUT` a una hora que no es en punto (10:30) | 400 "La clase debe empezar en una hora en punto (por ejemplo, 08:00)" |
| `PUT` o `DELETE` sobre `/api/clases/abc` | 400 "Id inválido" |
| `PUT` o `DELETE` sobre una clase que no existe (o ya eliminada) | 404 "Clase no encontrada" |
| `PUT` sobre una clase pasada | 409 "No se puede modificar una clase que ya comenzó" |
| `PUT` a un horario ocupado | 409 "El alumno, profesor o auto ya tiene una clase en ese horario" |
| `PUT` a otro profesor sin disponibilidad | 409 "El profesor no está disponible en ese horario" |
| `DELETE` sin token | 401 "Se requiere autenticación válida" |
| `PATCH /api/clases/:id/cancelar` (la ruta vieja) | 404 "Ruta no encontrada" |

---

## Resumen

- **Permisos:** las tres rutas con `:id` pasan por
  `requireAlumnoDeLaClaseOAdministrador`: la clase de otro alumno responde
  **403**, antes de mirar el body.
- **Modificar:** solo `profesor`, `auto`, `inicio` y `fin` (el DTO convierte
  las fechas) → la clase no puede haber empezado → si se manda una sola punta,
  la otra se calcula (+/− 1 h) → vuelve a pasar **todas** las validaciones de
  la reserva, excluyéndose a sí misma → `.save()`. El saldo no cambia.
- **Eliminar:** sin body → se borra la clase, también si ya ocurrió → si
  todavía no había empezado, `alumno.service` devuelve 1 crédito → 204. El
  horario queda libre y no queda historial.

**Siguiente lectura:** [`alta-de-profesor-y-disponibilidad.md`](alta-de-profesor-y-disponibilidad.md).
