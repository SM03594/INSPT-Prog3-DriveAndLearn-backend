# Flujo: dar de alta un profesor y cargar su disponibilidad

## Qué es esto, en una frase

Un administrador **crea un profesor** (`POST /api/profesores`), le puede
cambiar el nombre, y le **carga la disponibilidad**: los tramos de
cada día en los que puede dar clases. Sin disponibilidad, a ese profesor no se
le puede reservar nada. Esta guía sigue esos pedidos a través de las capas,
con las respuestas reales de la API.

> Las respuestas son **reales**: se obtuvieron ejecutando el flujo contra la
> API con una base en memoria.

Qué es un `CalendarioSemanal` y cómo se usa la disponibilidad al reservar se
explica en [`../temas/horarios-y-agendamiento.md`](../temas/horarios-y-agendamiento.md).

---

## El mapa

`src/routes/profesor.routes.ts:17-24`. Todo pide token; lo marcado con 🛡️
además pide admin:

| Pedido | Quién | Service | Qué hace |
|---|---|---|---|
| `POST /api/profesores` `{ nomApe }` | 🛡️ | `crear` | Alta con la disponibilidad vacía |
| `GET /api/profesores`, `GET /api/profesores/:id` | 🔑 cualquiera | `listar`, `obtenerPorId` | Incluye la disponibilidad |
| `PATCH /api/profesores/:id/nom-ape` `{ nomApe }` | 🛡️ | `cambiarNomApe` | Cambia el nombre |
| `POST /api/profesores/:id/disponibilidad` `{ dia, tramo }` | 🛡️ | `agregarDisponibilidad` | Agrega un tramo |
| `DELETE /api/profesores/:id/disponibilidad` `{ dia, tramoId }` | 🛡️ | `quitarDisponibilidad` | Quita un tramo |

**No existe** `DELETE /api/profesores/:id`: un profesor no se puede dar de
baja (responde 404 "Ruta no encontrada"). Ver I-38.

```
POST /profesores ──► profesor { nomApe, disponibilidad: { lunes: [], ..., domingo: [] } }
                                   │
POST .../disponibilidad { dia: 'lunes', tramo: 09–13 }
                                   ▼
                     disponibilidad.lunes = [ { _id: T1, 09:00–13:00 } ]
                                   │
DELETE .../disponibilidad { dia: 'lunes', tramoId: T1 }
                                   ▼
                     disponibilidad.lunes = [ ]
```

---

## El recorrido

### Paso 1. Crear el profesor

Ruta → controller → service:

```ts
router.post('/', requireAdministrator, validacionDeCuerpo, profesorController.crear);   // routes :19

const datosProfesor: CrearProfesorDto = aCrearProfesorDto(req.body);                  // controller :35
const profesor: ProfesorDoc = await profesorService.crear(datosProfesor);
res.status(201).json(profesor);
```

`aCrearProfesorDto` (`src/dtos/profesor.dto.ts:26`) acepta **solo** `nomApe`,
como texto y obligatorio. El service (`src/services/profesor.service.ts:36`)
aplica la regla que falta: que el nombre no quede vacío.

```ts
export async function crear(datos: CrearProfesorDto): Promise<ProfesorDoc> {
  return ProfesorModel.create({ nomApe: nombreObligatorio(datos.nomApe) });
}
```

`nombreObligatorio` (`:19`) rechaza un nombre que solo tiene espacios. La
disponibilidad no se puede mandar al crear: arranca vacía por el `default`
del modelo (`crearCalendarioSemanal`, una función, para que cada profesor
tenga su propio calendario).

```http
POST /api/profesores
{ "nomApe": "  Juan Gómez " }
```
```
201 { "nomApe": "Juan Gómez", "_id": "6ada695b...",
      "disponibilidad": { "lunes": [], "martes": [], "miercoles": [], "jueves": [],
                          "viernes": [], "sabado": [], "domingo": [] },
      "createdAt": "...", "updatedAt": "..." }
```

| Body | Respuesta |
|---|---|
| `{ "nomApe": "X", "disponibilidad": {} }` | 400 "No se pueden enviar estos campos: disponibilidad" (DTO) |
| `{}` | 400 "El nombre y apellido es obligatorio" (DTO) |
| `{ "nomApe": 123 }` | 400 "El nombre y apellido debe ser un texto" (DTO) |
| `{ "nomApe": "  " }` | 400 "El nombre y apellido del profesor es obligatorio" (service) |

Los dos mensajes de "obligatorio" no coinciden porque vienen de capas
distintas: el DTO dice que **falta** el campo, y el service, que llegó
**vacío**. Está registrado como I-51.
| Con el token de un alumno | 403 "Se requieren permisos de administrador" |

### Paso 2. Consultar

`GET /api/profesores` y `GET /api/profesores/:id` los puede usar **cualquier
usuario con token**, también los alumnos: necesitan ver qué profesores hay y
cuándo están disponibles para elegir al reservar. La respuesta incluye la
`disponibilidad` completa.

### Paso 3. Cambiar el nombre

Controller (`profesor.controller.ts:53`) → service (`profesor.service.ts:52`):

```ts
const idProfesor: string = req.params.id;                             // controller
const { nomApe }: CambiarNomApeDto = aCambiarNomApeDto(req.body);
const profesor: ProfesorDoc | null = await profesorService.cambiarNomApe(idProfesor, nomApe);

return ProfesorModel.findByIdAndUpdate(                                // service
  id, { nomApe: nombreObligatorio(nomApe) }, { new: true, runValidators: true },
);
```

Tiene las mismas validaciones que el alta: el DTO exige `nomApe` como texto, y
el service, que no quede vacío. Comportamiento real:

| Body | Respuesta |
|---|---|
| `{ "nomApe": "Juan A. Gómez" }` | 200, nombre cambiado |
| `{ "nomApe": "" }` o `"  "` | 400 "El nombre y apellido del profesor es obligatorio" |
| `{ "nomApe": 123 }` | 400 "El nombre y apellido debe ser un texto" |
| `{}` | 400 "El nombre y apellido es obligatorio" |
| `{ "otro": "x" }` | 400 "No se pueden enviar estos campos: otro" |
| Profesor inexistente | 404 "Profesor no encontrado" |

Antes de los DTO, `123` se guardaba como `"123"` y un body sin `nomApe`
respondía 200 sin cambiar nada (I-34, ya resuelta).

### Paso 4. Agregar disponibilidad

```ts
router.post('/:id/disponibilidad', requireAdministrator, validacionDeCuerpo,
            profesorController.agregarDisponibilidad);                        // routes :23

const idProfesor: string = req.params.id;                                      // controller :68
const { dia, tramo }: AgregarTramoDto = aAgregarTramoDto(req.body);
const profesor: ProfesorDoc | null =
  await profesorService.agregarDisponibilidad(idProfesor, dia, tramo);
```

`aAgregarTramoDto` es el **mismo DTO** que usa el horario de la escuela
(`src/dtos/calendarioSemanal.dto.ts:63`). Después, el service
(`src/services/profesor.service.ts:66`):

```
aAgregarTramoDto ─────── (en el controller)
                         falta dia o tramo → 400 "El día es obligatorio" / "El tramo es obligatorio"
                         dia no es texto → 400 "El día debe ser un texto"
                         tramo no es objeto → 400 "El tramo debe ser un objeto"
findById(id) ─────────── null → controller responde 404 "Profesor no encontrado"
validarDia(dia) ──────── no es un día válido → 400 'Día inválido: "Lunes". Debe ser uno de: lunes, ...'
agregarTramo(profesor.disponibilidad, dia, tramo)   ← calendarioSemanal.service: solo hace push
profesor.save() ──────── acá valida el ESQUEMA del tramo:
                           hora 0–23, minuto 0–59, enteros, horaInicio y horaFin obligatorias
                           pre('validate'): fin posterior al inicio
```

Las reglas de los **números** no están en el service: las aplica Mongoose al
guardar, y por eso hace falta `.save()` y no un `findByIdAndUpdate`. Ver
[`../capas/08-models.md`](../capas/08-models.md#4-reglas-entre-campos-prevalidate).

```http
POST /api/profesores/6ada695b.../disponibilidad
{ "dia": "lunes", "tramo": { "horaInicio": { "hora": 9, "minuto": 0 },
                             "horaFin":    { "hora": 13, "minuto": 0 } } }
```
```
200 { "_id": "6ada695b...", "nomApe": "Juan Gómez",
      "disponibilidad": { "lunes": [ { "horaInicio": { "hora": 9, "minuto": 0 },
                                       "horaFin":    { "hora": 13, "minuto": 0 },
                                       "_id": "6ada695c...285" } ],
                          "martes": [], ... } }
```

**Guardá el `_id` del tramo**: es lo que se necesita para quitarlo.

| Tramo enviado | Respuesta |
|---|---|
| Sin `tramo` | 400 "El tramo es obligatorio" |
| `tramo: "mañana"` | 400 "El tramo debe ser un objeto" |
| `hora: "x"` | 400 'Cast to Number failed for value "x" (type string) at path "hora"' (un mensaje interno de Mongoose: I-47) |
| Fin antes que el inicio (13 → 9) | 400 "La hora de fin debe ser posterior a la de inicio" |
| 09:00–12:30 (o 08:30–12:00) | 400 "Los tramos deben empezar y terminar en una hora en punto" (`tramo.service.ts`) |
| `minuto: 60` | 400 "Los minutos deben estar entre 0 y 59" (el esquema: `tramo.service` solo mira minutos de 1 a 59) |
| Sin `horaFin` | 400 "La hora de fin es obligatoria" |
| 10–12 cuando ya hay uno de 09–13 | **200**: se aceptan tramos superpuestos (I-37) |

### Paso 5. Quitar disponibilidad

```http
DELETE /api/profesores/6ada695b.../disponibilidad
{ "dia": "lunes", "tramoId": "6ada695c...285" }
```

Es un `DELETE` **con body** (ver I-24). El controller usa `aQuitarTramoDto`,
compartido con el horario: `tramoId` tiene que ser un texto (`123` responde
400 "El identificador del tramo debe ser un texto"). El service (`:86`) busca el tramo por
`_id` **en ese día** y lo saca con `quitarTramo`, que devuelve `true` o
`false`.

| Caso | Respuesta |
|---|---|
| Tramo encontrado | 200 con el profesor actualizado |
| `tramoId` que no existe | **404 "Profesor no encontrado"** |
| `tramoId` correcto pero `dia` equivocado | **404 "Profesor no encontrado"** |

El mensaje es **engañoso**: el profesor sí existe, lo que no se encontró es el
tramo. Pasa porque el service devuelve `null` en los dos casos, y el
controller no los distingue (I-33). En el horario de la escuela, el mismo caso
responde "No se encontró el tramo solicitado en ese día".

### Paso 6. Cómo se usa al reservar

Al reservar, la clase tiene que caber **entera** en un tramo del profesor
**y** en uno de la escuela ese día. Ver
[`agendar-una-clase.md`](agendar-una-clase.md), paso 7.
Hay tres cosas que **no** se controlan al cargar la disponibilidad:

- Que esté dentro del horario de la escuela (I-21): se puede cargar un domingo
  aunque la escuela cierre, y simplemente nunca se va a poder reservar.
- Que los tramos no se superpongan (I-37).
- Que quitar un tramo afecte a las clases ya reservadas (I-22): siguen
  vigentes.

---

## Qué puede salir mal

| Pedido | Respuesta real |
|---|---|
| Crear con campos extra | 400 "No se pueden enviar estos campos: …" |
| Crear sin nombre | 400 "El nombre y apellido es obligatorio" |
| Crear con el nombre vacío (`"  "`) | 400 "El nombre y apellido del profesor es obligatorio" (I-51) |
| Un alumno crea o modifica | 403 "Se requieren permisos de administrador" |
| Cambiar el nombre a un número | 400 "El nombre y apellido debe ser un texto" |
| Día `"Lunes"` (mayúscula) | 400 'Día inválido: "Lunes". Debe ser uno de: …' |
| Tramo con el fin antes del inicio | 400 "La hora de fin debe ser posterior a la de inicio" |
| Quitar un tramo que no existe | 404 "Profesor no encontrado" (I-33) |
| `DELETE /api/profesores/:id` | 404 "Ruta no encontrada" (no hay baja de profesores) |

---

## Resumen

- **Alta:** solo `nomApe`. La disponibilidad arranca vacía.
- **Consulta:** abierta a cualquier usuario con token. Trae la disponibilidad.
- **Nombre:** cambia por `PATCH`, con las mismas validaciones que el alta.
- **Disponibilidad:** se agrega de a un tramo por día. El DTO, compartido con
  el horario de la escuela, valida la forma; el service, que el día exista; y
  Mongoose valida los números al hacer `.save()`. Cada tramo tiene un `_id`, que es lo que se usa para quitarlo.
- La disponibilidad solo se cruza con el horario de la escuela **al
  reservar**.

**Siguiente lectura:** [`configurar-horarios-de-la-escuela.md`](configurar-horarios-de-la-escuela.md).
