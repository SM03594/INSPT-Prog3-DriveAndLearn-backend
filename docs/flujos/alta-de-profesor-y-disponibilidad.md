# Flujo: dar de alta un profesor y cargar su disponibilidad

## Qué es esto, en una frase

Un administrador **crea un profesor** (`POST /api/profesores`), le puede
cambiar el nombre o la foto, y le **carga la disponibilidad**: los tramos de
cada día en los que puede dar clases. Sin disponibilidad, a ese profesor no se
le puede reservar nada. Esta guía sigue esos pedidos a través de las capas,
con las respuestas reales de la API.

> Las respuestas son **reales**: se obtuvieron ejecutando el flujo contra la
> API con una base en memoria.

Qué es un `CalendarioSemanal` y cómo se usa la disponibilidad al reservar se
explica en [`../temas/horarios-y-agendamiento.md`](../temas/horarios-y-agendamiento.md).

---

## El mapa

`src/routes/profesor.routes.ts:17-25`. Todo pide token; lo marcado con 🛡️
además pide admin:

| Pedido | Quién | Service | Qué hace |
|---|---|---|---|
| `POST /api/profesores` `{ nomApe }` | 🛡️ | `crear` | Alta con la disponibilidad vacía |
| `GET /api/profesores`, `GET /api/profesores/:id` | 🔑 cualquiera | `listar`, `obtenerPorId` | Incluye la disponibilidad y la foto |
| `PATCH /api/profesores/:id/nom-ape` `{ nomApe }` | 🛡️ | `cambiarNomApe` | Cambia el nombre |
| `PATCH /api/profesores/:id/foto-perfil` `{ foto }` | 🛡️ | `cambiarFotoPerfil` | Reemplaza la foto |
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

const profesor = await profesorService.crear(cuerpoComoObjeto(req.body));             // controller :18
res.status(201).json(profesor);
```

`src/services/profesor.service.ts:93`:

```ts
export async function crear(datosEntrada: unknown): Promise<ProfesorDoc> {
  const datos = validarObjeto(datosEntrada, 'El cuerpo de la petición');
  rechazarCamposNoPermitidos(datos, CAMPOS_CREACION);          // solo ['nomApe']
  return ProfesorModel.create({ nomApe: nombreObligatorio(datos.nomApe) });
}
```

El service acepta **solo** `nomApe`, y arma el objeto a guardar él mismo. La
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
| `{ "nomApe": "X", "disponibilidad": {} }` | 400 "Campos no permitidos: disponibilidad" |
| `{}` o `{ "nomApe": "  " }` | 400 "El nombre y apellido del profesor es obligatorio" |
| Con el token de un alumno | 403 "Se requieren permisos de administrador" |

### Paso 2. Consultar

`GET /api/profesores` y `GET /api/profesores/:id` los puede usar **cualquier
usuario con token**, también los alumnos: necesitan ver qué profesores hay y
cuándo están disponibles para elegir al reservar. La respuesta incluye la
`disponibilidad` completa y, si tiene, la `fotoPerfil` (ver el paso 4).

### Paso 3. Cambiar el nombre

`src/services/profesor.service.ts:111`:

```ts
return ProfesorModel.findByIdAndUpdate(id, { nomApe }, { new: true, runValidators: true });
```

El service valida el valor con la misma regla de `crear` antes de llamar a
Mongoose. Los valores ausentes, no textuales o vacíos se rechazan con 400:

| Body | Respuesta |
|---|---|
| `{ "nomApe": "Juan A. Gómez" }` | 200, nombre cambiado |
| `{ "nomApe": "" }` | 400 "El nombre y apellido del profesor es obligatorio" |
| `{ "nomApe": 123 }` | 400 "El nombre y apellido del profesor es obligatorio" |
| `{ "otro": "x" }` (sin `nomApe`) | 400 "El nombre y apellido del profesor es obligatorio" |
| Profesor inexistente | 404 "Profesor no encontrado" |

La validación pertenece al service; el controller solo extrae `nomApe`, delega
la operación y traduce el resultado a una respuesta HTTP (I-34).

### Paso 4. La foto de perfil

`fotoComoBuffer` (`profesor.service.ts:70`) convierte lo que llegue en bytes
(`Buffer`):

| `foto` recibida | Se guarda |
|---|---|
| Un texto | Se interpreta como **base64** |
| Un array de números entre 0 y 255 | Esos bytes |
| `{ "type": "Buffer", "data": [...] }` | Esos bytes (el formato en que la API devuelve un `Buffer`) |
| `undefined` o `null` | Un buffer **vacío**, o sea que borra la foto |
| Otra cosa (un número, por ejemplo) | 400 "La foto debe enviarse en base64 o como bytes" |

En la respuesta, la foto viene como un **array de números**:

```json
"fotoPerfil": { "type": "Buffer", "data": [80, 78, 71, 68, 65, 84, 65] }
```

Hay varios detalles a tener en cuenta, todos comprobados (I-35):

- **Cualquier texto se acepta como base64.** `"esto no es base64 !!!"` se
  guarda como 10 bytes sin sentido. No se comprueba que sea una imagen.
- **Mandar el body sin `foto` borra la foto actual.**
- **El límite real es ~75 KB, no 2 MiB.** El modelo permite hasta 2 MiB
  (`Profesor.ts:12`), pero `express.json()` corta cualquier body de más de
  100 KB **antes** de llegar al service: una foto de 3 MB responde 413 "El
  cuerpo de la petición es demasiado grande". Y en base64 los datos ocupan un
  33 % más.
- Como array de números, cada byte ocupa hasta 4 caracteres en el JSON. La
  foto viaja en **todas** las respuestas del profesor, también en
  `GET /api/profesores` (la lista completa).

### Paso 5. Agregar disponibilidad

```ts
router.post('/:id/disponibilidad', requireAdministrator, validacionDeCuerpo,
            profesorController.agregarDisponibilidad);                        // routes :24

const body = cuerpoComoObjeto(req.body);                                      // controller :63
const profesor = await profesorService.agregarDisponibilidad(req.params.id, body.dia, body.tramo);
```

`src/services/profesor.service.ts:139`:

```
findById(id) ─────────── null → controller responde 404 "Profesor no encontrado"
diaObligatorio(dia) ──── no es texto → 400 "El día debe ser un texto"
                         no es un día válido → 400 'Día inválido: "Lunes". Debe ser uno de: lunes, ...'
tramoComoDatos(tramo) ── no es un objeto → 400 "El tramo debe ser un objeto"
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
| Sin `tramo` | 400 "El tramo debe ser un objeto" |
| Fin antes que el inicio (13 → 9) | 400 "La hora de fin debe ser posterior a la de inicio" |
| `minuto: 60` | 400 "Los minutos deben estar entre 0 y 59" |
| Sin `horaFin` | 400 "La hora de fin es obligatoria" |
| 10–12 cuando ya hay uno de 09–13 | **200**: se aceptan tramos superpuestos (I-37) |

### Paso 6. Quitar disponibilidad

```http
DELETE /api/profesores/6ada695b.../disponibilidad
{ "dia": "lunes", "tramoId": "6ada695c...285" }
```

Es un `DELETE` **con body** (ver I-24). El service (`:156`) busca el tramo por
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

### Paso 7. Cómo se usa al reservar

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
| Crear con campos extra | 400 "Campos no permitidos: …" |
| Crear sin nombre | 400 "El nombre y apellido del profesor es obligatorio" |
| Un alumno crea o modifica | 403 "Se requieren permisos de administrador" |
| Cambiar el nombre a un número o enviarlo vacío | 400 "El nombre y apellido del profesor es obligatorio" (I-34) |
| Foto de más de ~75 KB | 413 "El cuerpo de la petición es demasiado grande" |
| Foto como número | 400 "La foto debe enviarse en base64 o como bytes" |
| Día `"Lunes"` (mayúscula) | 400 'Día inválido: "Lunes". Debe ser uno de: …' |
| Tramo con el fin antes del inicio | 400 "La hora de fin debe ser posterior a la de inicio" |
| Quitar un tramo que no existe | 404 "Profesor no encontrado" (I-33) |
| `DELETE /api/profesores/:id` | 404 "Ruta no encontrada" (no hay baja de profesores) |

---

## Resumen

- **Alta:** solo `nomApe`. La disponibilidad arranca vacía.
- **Consulta:** abierta a cualquier usuario con token. Trae la disponibilidad
  y la foto.
- **Nombre y foto:** cambian por `PATCH`. El service valida el nombre; la foto
  tiene las limitaciones documentadas en I-35.
- **Disponibilidad:** se agrega de a un tramo por día. El service valida el
  día y que el tramo sea un objeto, y Mongoose valida los números al hacer
  `.save()`. Cada tramo tiene un `_id`, que es lo que se usa para quitarlo.
- La disponibilidad solo se cruza con el horario de la escuela **al
  reservar**.

**Siguiente lectura:** [`configurar-horarios-de-la-escuela.md`](configurar-horarios-de-la-escuela.md).
