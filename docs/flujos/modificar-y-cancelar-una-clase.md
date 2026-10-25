# Flujo: modificar y cancelar una clase

## Qué es esto, en una frase

Una clase reservada se puede **reprogramar** (`PUT /api/clases/:id`:
cambiar la hora, el profesor o el auto) o **cancelar**
(`PATCH /api/clases/:id/cancelar`). Al reprogramar se vuelven a hacer todas
las comprobaciones de la reserva. Al cancelar, el alumno recupera su crédito y
el horario queda libre para otro.

> Las respuestas son **reales**, con el mismo escenario que
> [`agendar-una-clase.md`](agendar-una-clase.md): un lunes con la escuela
> abierta de 08 a 20, el profesor Juan de 09 a 17, Ana con clases de 10–11 y
> 11–12, y Beto de 14 a 15.

---

## El mapa

```
                    PUT /api/clases/:id                     PATCH /api/clases/:id/cancelar
                    { inicio?, fin?, profesor?, auto? }     (sin body)
                            │                                       │
                            ▼                                       ▼
              ┌──── clase.service.actualizar ────┐     ┌──── clase.service.cancelar ────┐
              │ (DTO: campos permitidos)         │     │ cuenta activa                  │
              │ cuenta activa                    │     │ ¿es suya? (si no → 404)        │
              │ ¿es suya? (si no → 404)          │     │ ¿ya cancelada? → la devuelve   │
              │ ¿cancelada o ya empezó? → 409    │     │ ¿ya empezó? → 409              │
              │ calcular inicio/fin              │     │ estado = 'cancelada' (atómico) │
              │ validarDisponibilidad (sin ella) │     │ saldo + 1                      │
              │ save()                           │     └────────────────────────────────┘
              └──────────────────────────────────┘
                     el saldo NO cambia                      el saldo SUBE 1
```

El ciclo de vida de una clase:

```
             POST /api/clases                PATCH .../cancelar
 (no existe) ────────────────► pendiente ───────────────────────► cancelada
                                  │  ▲                                (final: no se modifica más)
                                  └──┘
                          PUT /api/clases/:id
                          (sigue pendiente)

  'confirmada' existe en el modelo, pero ningún endpoint la asigna (ver I-19)
```

---

## Parte 1: modificar (`PUT /api/clases/:id`)

### Paso 1. Ruta y controller

`src/routes/clase.routes.ts:19` → `src/controllers/clase.controller.ts:46`:

```ts
router.put('/:id', validacionDeCuerpo, claseController.actualizar);

const clase = await claseService.actualizar(req.params.id, aActualizarClaseDto(req.body), actorDe(req));
if (clase === null) {
  res.status(404).json({ mensaje: 'Clase no encontrada' });
} else {
  res.json(clase);
}
```

### Paso 2. Qué se puede cambiar

`aActualizarClaseDto` (`src/dtos/clase.dto.ts:79`) acepta **solo**
`profesor`, `auto`, `inicio` y `fin`, como texto, y al menos uno de ellos:

| Body | Respuesta |
|---|---|
| `{}` | 400 "Debe indicarse al menos un campo para actualizar" |
| `{ "alumno": "..." }` | 400 "No se pueden modificar estos campos: alumno" |
| `{ "estado": "confirmada" }` | 400 "No se pueden modificar estos campos: estado" |
| `{ "inicio": 123 }` | 400 "El inicio debe ser un texto" |

El alumno de una clase no se puede cambiar, y el estado tampoco se cambia por
`PUT`: para cancelar está el endpoint propio.

### Paso 3. ¿Es una clase suya?

`claseAccesible` (`:62`) busca la clase. Si quien pide es un **alumno** y la
clase es de **otro**, devuelve `null`, igual que si no existiera:

```
Ana: PUT /api/clases/<clase de Beto>  → 404 "Clase no encontrada"
```

¿Por qué 404 y no 403? Con un 403, Ana confirmaría que **existe** una clase
con ese id. Con un 404 no se revela nada. Un **admin** puede modificar
cualquier clase.

Si la clase es accesible, `actualizar` (`:294`) se la pasa a `reprogramar`
(`:268`), que hace los pasos 4 a 7.

### Paso 4. ¿Todavía se puede modificar?

`validarClaseModificable` (`:167`):

| Estado de la clase | Respuesta |
|---|---|
| Cancelada | 409 "No se puede modificar una clase cancelada" |
| Ya empezó (`inicio <= ahora`) | 409 "No se puede modificar una clase que ya comenzó" |

### Paso 5. Calcular el nuevo horario

`obtenerInstantesActualizados` (`:176`) completa lo que no vino, manteniendo
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
{ "inicio": "2026-10-26T15:00:00-03:00" }
```
```
200 { ..., "inicio": "2026-10-26T18:00:00.000Z", "fin": "2026-10-26T19:00:00.000Z", "estado": "pendiente" }
                     └── 15:00 local ──┘                  └── 16:00 local, calculado ──┘
```

Después pasa por las mismas reglas de fecha que la reserva (futura, sin
segundos, 1 hora).

### Paso 6. Volver a comprobar la disponibilidad, sin chocar consigo misma

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

Gracias a eso, mandar la misma hora que ya tenía (o cambiar solo el auto)
responde 200.

| Cambio de Ana | Respuesta |
|---|---|
| Mismo horario (15–16) | 200 |
| A las 14 (Juan ya está con Beto) | 409 "El alumno, profesor o auto ya tiene una clase en ese horario" |
| A otro profesor, sin disponibilidad cargada | 409 "El profesor no está disponible en ese horario" |

### Paso 7. Guardar

```ts
clase.profesor = profesor; clase.auto = auto;
clase.inicio = instantes.inicio; clase.fin = instantes.fin;
const claseReprogramada = await clase.save();
```

Usa `.save()` para que corra también el `pre('validate')` del modelo (fin
posterior al inicio). **El saldo no cambia**: la clase sigue siendo una sola.

---

## Parte 2: cancelar (`PATCH /api/clases/:id/cancelar`)

### Paso 8. Ruta sin body

`clase.routes.ts:20`:

```ts
router.patch('/:id/cancelar', claseController.cancelar);
```

No hay `validacionDeCuerpo`: cancelar no necesita datos, la URL dice todo.

### Paso 9. El service

`cancelar` (`clase.service.ts:348`). Si la clase todavía no estaba cancelada,
la cancela `cancelarYReintegrarCredito` (`:313`):

```
validarActor ─► claseAccesible (de otro → 404)
   │
   ├─ ¿ya está cancelada? ─────────────► la devuelve tal cual (200), SIN devolver crédito
   ├─ ¿ya empezó? ─────────────────────► 409 "Solo se pueden cancelar clases futuras"
   │
   ├─ findOneAndUpdate(                  ← condicional y atómico
   │     { _id, estado ≠ 'cancelada', inicio > ahora },
   │     { $set: { estado: 'cancelada' } })
   │     null → 409 "La clase cambió mientras se intentaba cancelar"
   │
   ├─ AlumnoModel.updateOne({ $inc: { clasesPorReservar: +1 } })      ← devuelve el crédito
   │     si falla → restaura el estado anterior de la clase (compensación)
   ▼
200 { ..., "estado": "cancelada" }
```

**Cancelar dos veces no devuelve dos créditos.** Es una operación
*idempotente*: repetirla no tiene efecto extra.

```
saldo de Ana: 0
PATCH .../cancelar   → 200 estado "cancelada" → saldo 1
PATCH .../cancelar   → 200 estado "cancelada" → saldo 1   (no sube de nuevo)
```

La condición `estado ≠ 'cancelada'` **dentro** del `findOneAndUpdate` cubre
el caso de dos cancelaciones simultáneas: solo una de las dos encuentra la
clase sin cancelar, y por lo tanto solo una devuelve el crédito.

### Paso 10. El horario queda libre

La búsqueda de superposiciones ignora las clases canceladas
(`estado: { $ne: 'cancelada' }`). Cuando Ana cancela su clase de 15–16, Beto
puede reservar ese mismo horario con el mismo profesor y el mismo auto:

```
Beto: POST /api/clases { 15:00–16:00 con Juan y el mismo auto } → 201
```

La clase cancelada **no se borra**: queda en la base como historial, y Ana la
sigue viendo en `GET /api/clases` con `estado: "cancelada"`.

---

## Qué puede hacer cada rol

| Acción | Alumno | Admin |
|---|---|---|
| Modificar | Solo sus clases (las de otros → 404) | Cualquiera |
| Cancelar | Solo sus clases (las de otros → 404) | Cualquiera (el crédito vuelve al alumno de la clase) |
| Cambiar el alumno o el estado por `PUT` | No | No |

---

## Qué puede salir mal

| Pedido | Respuesta real |
|---|---|
| `PUT` con `{}` | 400 "Debe indicarse al menos un campo para actualizar" |
| `PUT` con `alumno` o `estado` | 400 "No se pueden modificar estos campos: alumno" / "…: estado" |
| `PUT /api/clases/abc` | 400 "Id inválido" |
| `PUT` o `PATCH` sobre una clase de otro alumno | 404 "Clase no encontrada" |
| `PUT` sobre una clase cancelada | 409 "No se puede modificar una clase cancelada" |
| `PUT` sobre una clase pasada | 409 "No se puede modificar una clase que ya comenzó" |
| `PUT` a un horario ocupado | 409 "El alumno, profesor o auto ya tiene una clase en ese horario" |
| `PUT` a otro profesor sin disponibilidad | 409 "El profesor no está disponible en ese horario" |
| Cancelar una clase pasada | 409 "Solo se pueden cancelar clases futuras" |
| Cancelar una clase ya cancelada | **200**, sin devolver crédito otra vez |

---

## Resumen

- **Modificar:** solo `profesor`, `auto`, `inicio` y `fin` → la clase tiene
  que ser propia (o el pedido de un admin), no estar cancelada y no haber
  empezado → si se manda una sola punta, la otra se calcula (+/− 1 h) →
  vuelve a pasar **todas** las validaciones de la reserva, excluyéndose a sí
  misma → `.save()`. El saldo no cambia.
- **Cancelar:** sin body → solo clases futuras → cambio de estado atómico y
  condicional → devuelve 1 crédito. Es idempotente, y el horario queda libre.
- Las clases de otros alumnos responden **404**, para no revelar que existen.
- Las clases canceladas no se borran ni se pueden reactivar.

**Siguiente lectura:** [`alta-de-profesor-y-disponibilidad.md`](alta-de-profesor-y-disponibilidad.md).
