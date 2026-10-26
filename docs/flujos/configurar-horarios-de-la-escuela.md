# Flujo: configurar el horario de la escuela

## Qué es esto, en una frase

El horario de la escuela dice **qué días y en qué franjas está abierta**, y es
la primera condición de cualquier reserva. Un administrador lo arma con
`/api/horario-escuela`, ya sea reemplazándolo entero (`PUT`) o agregando y
quitando tramos de a uno. Esta guía sigue esos pedidos, con las respuestas
reales de la API.

> Las respuestas son **reales**: se obtuvieron ejecutando el flujo contra la
> API con una base en memoria.

El modelo `HorarioEscuela` (un único documento con `_id: 'escuela'`) y el
`CalendarioSemanal` se explican en
[`../temas/horarios-y-agendamiento.md`](../temas/horarios-y-agendamiento.md#parte-2-los-dos-calendarios-guardados).

---

## El mapa

`src/routes/horarioEscuela.routes.ts`. Todo pide token; lo marcado con 🛡️
además pide admin:

| Pedido | Quién | Service (`horarioEscuela.service.ts`) | Qué hace |
|---|---|---|---|
| `GET /api/horario-escuela` | 🔑 | `obtener` (`:19`) | Devuelve el calendario |
| `PUT /api/horario-escuela` | 🛡️ | `reemplazar` (`:36`) | Reemplaza **toda** la semana |
| `POST /api/horario-escuela/agregar` `{ dia, tramo }` | 🛡️ | `agregarTramo` (`:48`) | Agrega un tramo |
| `POST /api/horario-escuela/quitar` `{ dia, tramoId }` | 🛡️ | `quitarTramo` (`:60`) | Quita un tramo |

El documento pasa por tres estados:

```
(no existe en la base)
   │  GET → 200 con la semana vacía (pero NO lo crea)
   │  reservar → 409 "Todavía no se configuró el horario de la escuela"
   │
   │  primer agregar o PUT → lo crea con _id 'escuela'
   ▼
{ _id: 'escuela', calendario: { lunes: [...], ..., domingo: [...] } }
   │  agregar / quitar → modifican un día
   │  PUT              → reemplaza los 7 días
   ▼
(existe, pero puede tener días vacíos)
   reservar en un día vacío → 409 "La clase queda fuera del horario de la escuela"
```

La diferencia entre "no existe" y "existe pero vacío" se ve en el **mensaje**
de error al reservar, pero no en el `GET`, que en los dos casos devuelve la
semana vacía.

---

## El recorrido

### Paso 1. Consultar

`obtener()` (`horarioEscuela.service.ts:19`):

```ts
const horario = await HorarioEscuelaModel.findById('escuela');
return horario?.calendario ?? { lunes: [], martes: [], /* ... */ domingo: [] };
```

Si el documento no existe, devuelve una semana vacía **sin crearlo**:

```
GET /api/horario-escuela   (recién instalado)
200 { "lunes": [], "martes": [], "miercoles": [], "jueves": [], "viernes": [], "sabado": [], "domingo": [] }
```

Lo pueden consultar también los alumnos: el frontend lo necesita para mostrar
cuándo abre la escuela.

### Paso 2. Agregar un tramo

Controller (`horarioEscuela.controller.ts:31`) → service (`horarioEscuela.service.ts:48`):

```ts
const { dia, tramo }: AgregarTramoDto = aAgregarTramoDto(req.body);                // controller
const calendario: CalendarioSemanal = await horarioService.agregarTramo(dia, tramo);
res.json(calendario);

const horario =                                        // service
  (await HorarioEscuelaModel.findById('escuela')) ??
  new HorarioEscuelaModel({ _id: 'escuela' });          // ← si no existe, lo crea
agregarTramoCalendario(horario.calendario, diaValido(dia), tramo);
await horario.save();                                   // ← acá valida el esquema del tramo
return horario.calendario;
```

```http
POST /api/horario-escuela/agregar
{ "dia": "lunes", "tramo": { "horaInicio": { "hora": 8, "minuto": 0 }, "horaFin": { "hora": 12, "minuto": 0 } } }
```
```
200 { "lunes": [ { "horaInicio": { "hora": 8, "minuto": 0 }, "horaFin": { "hora": 12, "minuto": 0 },
                   "_id": "6ada695c...2a0" } ],
      "martes": [], ... }
```

La respuesta es el **calendario completo**, no el documento. El `_id` de cada
tramo es lo que se usa para quitarlo.

`aAgregarTramoDto` (`src/dtos/calendarioSemanal.dto.ts:63`) es el **mismo
DTO** que usa la disponibilidad de un profesor: exige `dia` (texto) y `tramo`
(objeto), y ningún otro campo. Que el día exista lo revisa el service
(`diaValido`), y las horas, el esquema al hacer `.save()`.

| Body | Respuesta |
|---|---|
| `dia: "feriado"` | 400 'Día inválido: "feriado". …' |
| `hora: 24` | 400 "La hora debe estar entre 0 y 23" |
| `dia: 1` | 400 "El día debe ser un texto" (DTO) |
| `tramo: "mañana"` (un texto) | 400 "El tramo debe ser un objeto" (DTO) |
| **Sin `tramo`** (`{ "dia": "martes" }`) | 400 "El tramo es obligatorio" (DTO) |
| Un campo de más (`"otro": 1`) | 400 "No se pueden enviar estos campos: otro" (DTO) |
| `hora: "x"` dentro del tramo | 400 'Cast to Number failed for value "x" (type string) at path "hora"' (un mensaje interno de Mongoose: I-47) |
| Tramo superpuesto (10–16 sobre 08–12 y 14–20) | **200**: se acepta (I-37) |

#### Por qué importa exigir el tramo (I-32, resuelta)

Antes de los DTO, `{ "dia": "martes" }` respondía **200** y hacía
`calendario.martes.push(undefined)`, que Mongoose guardaba como `null`. Desde
ese momento, **toda reserva para un martes** fallaba con un 500
(`TypeError: Cannot read properties of null (reading 'horaInicio')`), porque
`validarHorarioClase` recorre los tramos y lee `tramo.horaInicio` del `null`.
`quitar` en ese día también daba 500.

Es un buen ejemplo de por qué la forma se valida **antes** de guardar: un
dato mal armado no rompió el pedido que lo mandó, sino **otros** pedidos,
después. Si en una base quedó un `null` guardado de antes, la forma de
limpiarlo es un `PUT` con la semana completa.

### Paso 3. Quitar un tramo

Controller (`horarioEscuela.controller.ts:38`) → service (`:60`). El controller usa `aQuitarTramoDto`:
`dia` y `tramoId`, los dos como texto.

```http
POST /api/horario-escuela/quitar
{ "dia": "lunes", "tramoId": "6ada695c...2a0" }
```

Se usa `POST` con el verbo en la URL (`/quitar`), no `DELETE`.

| Caso | Respuesta |
|---|---|
| Tramo encontrado | 200 con el calendario sin ese tramo |
| `tramoId` inexistente, o en otro día | 404 "No se encontró el tramo solicitado en ese día" |
| `tramoId: 123` | 400 "El identificador del tramo debe ser un texto" (DTO) |
| El documento todavía no existe | 404, el mismo mensaje |

### Paso 4. Reemplazar la semana completa

`aReemplazarCalendarioDto` (`src/dtos/calendarioSemanal.dto.ts:93`) exige un
objeto con una **lista para cada uno de los 7 días**, en la que cada elemento
sea un objeto. `reemplazar` (`horarioEscuela.service.ts:36`) lo guarda como el
nuevo calendario. Es la forma más cómoda de cargar
una semana típica:

```http
PUT /api/horario-escuela
{
  "lunes":     [ { "horaInicio": { "hora": 8, "minuto": 0 }, "horaFin": { "hora": 20, "minuto": 0 } } ],
  "martes":    [ { "horaInicio": { "hora": 8, "minuto": 0 }, "horaFin": { "hora": 20, "minuto": 0 } } ],
  "miercoles": [ { "horaInicio": { "hora": 8, "minuto": 0 }, "horaFin": { "hora": 20, "minuto": 0 } } ],
  "jueves":    [ { "horaInicio": { "hora": 8, "minuto": 0 }, "horaFin": { "hora": 20, "minuto": 0 } } ],
  "viernes":   [ { "horaInicio": { "hora": 8, "minuto": 0 }, "horaFin": { "hora": 20, "minuto": 0 } } ],
  "sabado":    [ { "horaInicio": { "hora": 9, "minuto": 0 }, "horaFin": { "hora": 13, "minuto": 0 } } ],
  "domingo":   []
}
```
```
200 { "lunes": [ { "horaInicio": {...}, "horaFin": {...}, "_id": "..." } ], ... }
```

| Body | Respuesta |
|---|---|
| Sin `domingo` (o con algún día faltante) | 400 "El domingo es obligatorio" |
| `"lunes": "x"` | 400 "El lunes debe ser una lista" |
| `"lunes": [null]` | 400 "Cada tramo del lunes debe ser un objeto" (antes se guardaba el `null`, como en I-32) |
| Un tramo con el fin antes del inicio | 400 "La hora de fin debe ser posterior a la de inicio" |
| Un tramo que no es en punto (09:00–12:30), en cualquier día | 400 "Los tramos deben empezar y terminar en una hora en punto" y no se guarda **nada** de la semana |
| Un día extra (`"feriado": [...]`) | 400 "No se pueden enviar estos campos: feriado" |
| `[]` (un array) | 400 "El cuerpo de la petición debe ser un objeto JSON" |

**Cuidado: `PUT` borra todo lo que había**, incluidos los `_id` de los tramos
anteriores: si no se mandan, se generan nuevos. Por eso la colección de Postman guarda el
horario antes de un `PUT`, lo restaura enseguida, y en el servidor desplegado
saltea esos requests (`modoSeguro`).

### `agregar`/`quitar` o `PUT`: cuál usar

| Situación | Usar |
|---|---|
| Configurar la escuela por primera vez | `PUT` con la semana completa |
| Abrir un sábado a la tarde | `agregar` |
| Cerrar una franja | `quitar` (hay que conocer el `_id` del tramo: `GET` primero) |
| Cambiar todo el esquema de horarios | `PUT` |

### Paso 5. Qué efecto tiene en las reservas

- Cada reserva, y cada modificación de una clase, consulta el horario
  **en ese momento**. Un tramo agregado habilita reservas de inmediato, y uno
  quitado las rechaza de inmediato (409 "La clase queda fuera del horario de
  la escuela").
- Las clases **ya reservadas** no se revisan: si se cierra una franja, siguen
  vigentes (I-22).
- La clase tiene que caber **entera** en un tramo. Dos tramos contiguos
  (08–10 y 10–12) no aceptan una clase de 09:30 a 10:30 (I-23). Conviene
  cargar un solo tramo de 08 a 12.

---

## Qué puede salir mal

| Pedido | Respuesta real |
|---|---|
| Un alumno modifica el horario | 403 "Se requieren permisos de administrador" |
| Día con mayúscula o inexistente | 400 'Día inválido: …' |
| Hora 24 o minuto 60 | 400 "La hora debe estar entre 0 y 23" / "Los minutos deben estar entre 0 y 59" |
| Tramo que no es en punto (08:30–12:00) | 400 "Los tramos deben empezar y terminar en una hora en punto" |
| `agregar` sin `tramo` | 400 "El tramo es obligatorio" |
| `agregar` con un tramo que no es un objeto | 400 "El tramo debe ser un objeto" |
| Una hora que no es un número (`"x"`) | 400 con un mensaje interno de Mongoose (I-47) |
| `quitar` un tramo que no existe | 404 "No se encontró el tramo solicitado en ese día" |
| `PUT` sin los 7 días | 400 "El domingo es obligatorio" (el primer día que falte) |
| `PUT` con un día que no existe | 400 "No se pueden enviar estos campos: feriado" |
| Reservar sin ningún horario cargado | 409 "Todavía no se configuró el horario de la escuela" |

---

## Resumen

- El horario de la escuela es **un único documento** (`_id: 'escuela'`). El
  `GET` devuelve la semana vacía si todavía no existe, y el primer `agregar`
  o `PUT` lo crea.
- `PUT` reemplaza los 7 días (y regenera todos los `_id`). `agregar` y
  `quitar` cambian de a un tramo, y para quitar se usa el `_id` del tramo.
- La forma (`dia` texto, `tramo` objeto, los 7 días como listas) la validan
  los DTO de `calendarioSemanal.dto.ts`, compartidos con la disponibilidad de
  los profesores. El service valida que el día exista, y Mongoose valida los
  números de cada tramo al hacer `.save()`.
- Cada reserva lo consulta en el momento, pero las clases ya reservadas no se
  revisan cuando cambia.

**Siguiente lectura:** [`gestion-de-autos.md`](gestion-de-autos.md).
