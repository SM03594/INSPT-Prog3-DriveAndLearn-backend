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
| `GET /api/horario-escuela` | 🔑 | `obtener` (`:20`) | Devuelve el calendario |
| `GET /api/horario-escuela/validar/:dia` | 🔑 | `validarDia` | ¿Es un nombre de día válido? |
| `PUT /api/horario-escuela` | 🛡️ | `reemplazar` (`:33`) | Reemplaza **toda** la semana |
| `POST /api/horario-escuela/agregar` `{ dia, tramo }` | 🛡️ | `agregarTramo` (`:53`) | Agrega un tramo |
| `POST /api/horario-escuela/quitar` `{ dia, tramoId }` | 🛡️ | `quitarTramo` (`:65`) | Quita un tramo |

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

`obtener()` (`horarioEscuela.service.ts:20`):

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

### Paso 2. Validar un día

```
GET /api/horario-escuela/validar/lunes    → 200 { "valido": true, "dia": "lunes" }
GET /api/horario-escuela/validar/feriado  → 400 'Día inválido: "feriado". Debe ser uno de: lunes, martes, miercoles, jueves, viernes, sabado, domingo.'
```

Solo comprueba el nombre: no mira si ese día la escuela abre.

### Paso 3. Agregar un tramo

Controller (`horarioEscuela.controller.ts:24`) → service (`:53`):

```ts
const { dia, tramo } = req.body;                       // controller
res.json(await horarioService.agregarTramo(dia, tramo));

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

| Body | Respuesta |
|---|---|
| `dia: "feriado"` | 400 'Día inválido: "feriado". …' |
| `hora: 24` | 400 "La hora debe estar entre 0 y 23" |
| `tramo: "mañana"` (un texto) | 400 'Cast to ObjectId failed for value "mañana" (type string) at path "_id". La hora de fin es obligatoria. …' (un mensaje interno de Mongoose: I-36) |
| Tramo superpuesto (10–16 sobre 08–12 y 14–20) | **200**: se acepta (I-37) |
| **Sin `tramo`** (`{ "dia": "martes" }`) | **200, y guarda `null`** (ver abajo) |

#### ⚠️ El bug del tramo vacío (I-32)

A diferencia de `profesor.service`, este service **no comprueba** que `tramo`
sea un objeto. Con `{ "dia": "martes" }` se hace `calendario.martes.push(undefined)`,
y Mongoose lo guarda como `null`:

```
POST /api/horario-escuela/agregar { "dia": "martes" }   → 200 { ..., "martes": [ null ], ... }
```

Desde ese momento, **toda reserva para un martes** falla:

```
POST /api/clases { ...martes 10–11... }
→ 500 "Error interno del servidor"
   (en la consola: TypeError: Cannot read properties of null (reading 'horaInicio'))
```

`validarHorarioClase` recorre los tramos y lee `tramo.horaInicio` del `null`.
`quitar` en ese día **también** falla con un 500 (comprobado: `TypeError:
Cannot read properties of null (reading '_id')`), porque `quitarTramo` lee
`t._id` de cada tramo. La única forma de arreglarlo es un `PUT` con la semana
completa. La solución es validar `tramo` en el service, como hace
`profesor.service` con `tramoComoDatos`.

### Paso 4. Quitar un tramo

Controller (`:29`) → service (`:65`):

```http
POST /api/horario-escuela/quitar
{ "dia": "lunes", "tramoId": "6ada695c...2a0" }
```

Se usa `POST` con el verbo en la URL (`/quitar`), no `DELETE`.

| Caso | Respuesta |
|---|---|
| Tramo encontrado | 200 con el calendario sin ese tramo |
| `tramoId` inexistente, o en otro día | 404 "No se encontró el tramo solicitado en ese día" |
| El documento todavía no existe | 404, el mismo mensaje |

### Paso 5. Reemplazar la semana completa

`reemplazar` (`:33`) exige un objeto con una **lista para cada uno de los 7
días** y lo guarda como el nuevo calendario. Es la forma más cómoda de cargar
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
| Sin `domingo` (o con algún día faltante) | 400 "El calendario debe incluir una lista para cada día" |
| Un tramo con el fin antes del inicio | 400 "La hora de fin debe ser posterior a la de inicio" |
| Un día extra (`"feriado": [...]`) | 200: se **descarta en silencio**, y el calendario queda con los 7 días |
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

### Paso 6. Qué efecto tiene en las reservas

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
| `agregar` sin `tramo` | **200, guarda `null` y rompe las reservas de ese día con un 500** (I-32) |
| `agregar` con un tramo que no es un objeto | 400 con un mensaje interno de Mongoose (I-36) |
| `quitar` un tramo que no existe | 404 "No se encontró el tramo solicitado en ese día" |
| `PUT` sin los 7 días | 400 "El calendario debe incluir una lista para cada día" |
| Reservar sin ningún horario cargado | 409 "Todavía no se configuró el horario de la escuela" |

---

## Resumen

- El horario de la escuela es **un único documento** (`_id: 'escuela'`). El
  `GET` devuelve la semana vacía si todavía no existe, y el primer `agregar`
  o `PUT` lo crea.
- `PUT` reemplaza los 7 días (y regenera todos los `_id`). `agregar` y
  `quitar` cambian de a un tramo, y para quitar se usa el `_id` del tramo.
- Los números de cada tramo los valida Mongoose al hacer `.save()`. El service
  solo valida el día (y hoy no valida que el tramo exista: I-32).
- Cada reserva lo consulta en el momento, pero las clases ya reservadas no se
  revisan cuando cambia.

**Siguiente lectura:** [`gestion-de-autos.md`](gestion-de-autos.md).
