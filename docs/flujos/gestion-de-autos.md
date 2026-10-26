# Flujo: gestionar los autos de la escuela

## Qué es esto, en una frase

Un administrador **da de alta** los autos (`POST /api/autos`), los
**modifica** (`PUT`) y los **saca o vuelve a poner en servicio**
(`PATCH .../activo`). Los autos no se borran: un auto fuera de servicio sigue
existiendo, pero no se puede reservar. Esta guía sigue esos pedidos a través
de las capas, con las respuestas reales de la API.

> Las respuestas son **reales**: se obtuvieron ejecutando el flujo contra la
> API con una base en memoria.

`auto` es el recurso más simple del proyecto, y por eso es el que se usa como
ejemplo en [`../capas/03-arquitectura.md`](../capas/03-arquitectura.md). Esta
guía completa los casos que allí no se ven.

---

## El mapa

`src/routes/auto.routes.ts:17-23`. Todo pide token; lo marcado con 🛡️ además
pide admin:

| Pedido | Quién | Service (`auto.service.ts`) | Respuesta |
|---|---|---|---|
| `GET /api/autos` | 🔑 | `listar` | 200: todos, activos e inactivos |
| `GET /api/autos/:id` | 🔑 | `obtenerPorId` | 200, o 404 |
| `POST /api/autos` | 🛡️ | `crear` | 201 |
| `PUT /api/autos/:id` | 🛡️ | `actualizar` | 200 |
| `PATCH /api/autos/:id/activo` `{ activo }` | 🛡️ | `cambiarEstado` | 200 |
| `DELETE /api/autos/:id` | — | *(no existe)* | 404 "Ruta no encontrada" |

El ciclo de vida de un auto:

```
POST /api/autos                     PATCH .../activo { "activo": false }
──────────────► activo: true ◄───────────────────────────────► activo: false
                (se puede reservar)   PATCH .../activo { "activo": true }   (409 al reservar)
```

---

## El recorrido

### Paso 1. Crear: el DTO filtra, el modelo normaliza y valida

El controller convierte el body en un `CrearAutoDto` (`auto.controller.ts:37`):

```ts
const datosAuto: CrearAutoDto = aCrearAutoDto(req.body);
const auto: AutoDoc = await autoService.crear(datosAuto);
```

`aCrearAutoDto` (`src/dtos/auto.dto.ts:81`) define el **contrato** del alta:

| Campo | En el DTO |
|---|---|
| `patente` | Obligatoria, texto |
| `cambios` | Obligatorio, texto, y se **convierte**: `parsearCambios` lo pasa a mayúsculas y exige `MANUAL` o `AUTOMATICO` |
| `marca`, `modelo` | Opcionales, texto |
| `activo` | Opcional, booleano: un auto puede **nacer** fuera de servicio |
| Cualquier otro (`color`, `_id`, `createdAt`...) | 400 "No se pueden enviar estos campos: …" |

El service primero se fija si otro auto ya tiene esa patente
(`verificarPatenteLibre`, `auto.service.ts:34`), y después guarda el DTO dentro
de un `try/catch` (`auto.service.ts:78`):

```ts
export async function crear(datos: CrearAutoDto): Promise<AutoDoc> {
  await verificarPatenteLibre(datos.patente);   // 409 si ya está en uso

  try {
    return await AutoModel.create(datos);
  } catch (err) {
    throw verSiErrorClaveDuplicada(err, MENSAJE_PATENTE_DUPLICADA);
  }
}
```

¿Por qué buscar el duplicado si el esquema ya tiene `unique`? Porque el índice
`unique` puede **faltar**: si no se pudo crear (por ejemplo, porque la
colección ya tenía patentes repetidas), Mongoose no avisa y los duplicados
entran igual. La consulta no depende del índice. Y el `try/catch` sigue
haciendo falta para el caso contrario: si llegan **dos altas a la vez** con la
misma patente, las dos pasan la consulta y es el índice el que frena a la
segunda.

La consulta no pasa la patente a mayúsculas a mano: Mongoose aplica el
`uppercase` y el `trim` del esquema también al **filtro**, así que buscar
`"  ab123cd "` encuentra `"AB123CD"`.

Las reglas sobre los **valores** están en el **esquema** (`src/models/Auto.ts`):

| Campo | Reglas |
|---|---|
| `patente` | Obligatoria, `trim`, `uppercase`, **única** |
| `cambios` | Obligatorio, `uppercase`, solo `'AUTOMATICO'` o `'MANUAL'` (segunda barrera: el DTO ya lo convirtió) |
| `marca`, `modelo` | Opcionales, `trim` |
| `activo` | `default: true` |

Un pedido con mayúsculas y espacios mezclados:

```http
POST /api/autos
{ "marca": " Fiat ", "modelo": "Cronos", "patente": " ab 123 cd ", "cambios": "manual" }
```
```
201 { "marca": "Fiat", "modelo": "Cronos", "patente": "AB 123 CD", "cambios": "MANUAL",
      "activo": true, "_id": "6ada6a9a...", "createdAt": "...", "updatedAt": "..." }
```

`"manual"` se acepta y se guarda como `"MANUAL"`: lo convierte el DTO
(`parsearCambios`, `src/dtos/auto.dto.ts:62`). El DTO tiene que hacerlo porque
el service le pasa los datos a `AutoModel.create()`, y Mongoose 9 tipa
`create()` con la interfaz `Auto`, donde `cambios` es `'AUTOMATICO' |
'MANUAL'`. Un `string` cualquiera no compilaría (ver
[`../capas/08-models.md`](../capas/08-models.md#8-los-tipos-escritos-a-mano-y-sus-desajustes)).

| Body | Respuesta |
|---|---|
| `cambios: "secuencial"` | 400 "El tipo de cambios debe ser MANUAL o AUTOMATICO" (el DTO) |
| Solo `{ "marca": "Ford" }` | 400 "La patente es obligatoria" (lo frena el DTO, con el primer faltante) |
| `{ ..., "marca": 123 }` | 400 "La marca debe ser un texto" (antes se guardaba `"123"`) |
| Patente repetida, aunque cambien mayúsculas o espacios de los extremos | 409 "La patente ya está en uso" (`verificarPatenteLibre`) |
| Con `"color": "rojo"` | 400 "No se pueden enviar estos campos: color" |
| Con `"_id"` y `"createdAt"` elegidos por el cliente | 400 "No se pueden enviar estos campos: _id, createdAt" |
| Con `"activo": false` | 201: el auto **nace** fuera de servicio |
| Con el token de un alumno | 403 "Se requieren permisos de administrador" |

**La patente no tiene un formato definido** (I-39). `trim` solo quita los
espacios de los extremos: `"AB 123 CD"` y `"AB123CD"` se guardan como patentes
**distintas**, así que el mismo auto se puede cargar dos veces. Tampoco se
comprueba que tenga forma de patente.

### Paso 2. Consultar

Cualquier usuario con token puede listar los autos: el alumno necesita
elegirlos al reservar (por ejemplo, para elegir entre manual y automático).
La lista incluye **también los inactivos**:

```
GET /api/autos  (como alumna)
200 [ "AB 123 CD MANUAL activo=true", "AE456FG AUTOMATICO activo=true", "ZZ999ZZ MANUAL activo=false" ]
```

No hay un filtro del estilo `?activo=true`, así que el frontend tiene que
filtrar los inactivos para no ofrecerlos. La consulta de turnos libres, en
cambio, ofrece solo los autos activos (`auto.service.listarActivos`, ver
[`consultar-turnos-libres.md`](consultar-turnos-libres.md)).

| Pedido | Respuesta |
|---|---|
| `GET /api/autos/abc` | 400 "Id inválido" (CastError) |
| `GET /api/autos/<id inexistente>` | 404 "Auto no encontrado" |

### Paso 3. Modificar con `PUT`

El controller usa otro DTO, `aActualizarAutoDto` (`src/dtos/auto.dto.ts:101`):
los mismos datos del auto, todos opcionales, pero **al menos uno**, y **sin**
`activo`. El service (`auto.service.ts:94`) los guarda. Si viene una
`patente`, antes comprueba que no la tenga **otro** auto (la del mismo auto no
cuenta, así que mandar la patente que ya tenía no es un error):

```ts
if (cambios.patente !== undefined) {
  await verificarPatenteLibre(cambios.patente, id);
}

return await AutoModel.findByIdAndUpdate(id, cambios, {
  new: true,           // devolver el documento ya modificado (deprecado: I-05)
  runValidators: true, // aplicar las reglas del esquema también acá
});
```

Aunque es un `PUT`, funciona como un **cambio parcial**: solo se modifican los
campos enviados. Si no viene `cambios`, el DTO no agrega esa clave, así que el
update no la toca. Gracias a `runValidators`, el `required` y el `enum` del
esquema se aplican igual que al crear:

| Body | Respuesta |
|---|---|
| `{ "modelo": "Cronos Drive" }` | 200, solo cambia el modelo |
| `{ "cambios": "x" }` | 400 "El tipo de cambios debe ser MANUAL o AUTOMATICO" |
| `{ "cambios": "automatico" }` | 200, guardado como `"AUTOMATICO"` |
| `{ "patente": "ae456fg" }` (la de otro auto) | 409 "La patente ya está en uso" |
| `{ "patente": "" }` | 400 "La patente es obligatoria" (el `required` del esquema) |
| `{ "activo": false }` | 400 "No se pueden modificar estos campos: activo (el estado se cambia con PATCH /autos/:id/activo)" |
| `{}` | 400 "Debe indicarse al menos un campo para actualizar" |
| `{ "_id": "<otro id>" }` | 400 "No se pueden modificar estos campos: _id" |
| `{ "$set": { "activo": false } }` | 400 "No se pueden modificar estos campos: $set" |

Los tres últimos casos, antes de los DTO, llegaban a MongoDB tal cual: un
`_id` terminaba en un **500** (I-40), y un `$set` sacaba el auto de servicio
saltándose el `PATCH` (I-45). Ahora el service solo recibe los campos del
contrato. Por qué `activo` tiene su propia ruta se ve en el paso 4.

### Paso 4. Sacar de servicio y volver a ponerlo

`auto.controller.ts:56` → `auto.service.ts:118`:

```ts
// controller: el DTO garantiza que "activo" es un booleano de verdad
const idAuto: string = req.params.id;
const { activo }: CambiarActivoDto = aCambiarActivoDto(req.body);
const auto: AutoDoc | null = await autoService.cambiarEstado(idAuto, activo);

// service
export async function cambiarEstado(id: string, estadoNuevo: boolean) {
  return AutoModel.findByIdAndUpdate(id, { activo: estadoNuevo }, { new: true, runValidators: true });
}
```

`aCambiarActivoDto` (`src/dtos/auto.dto.ts:116`) exige `activo` como booleano:
no acepta `"false"` como texto (que Mongoose convertiría a `false`). El
service recibe un `boolean` y solo lo guarda.

¿Por qué una ruta aparte, si el `PUT` podría cambiar `activo`? Porque sacar un
auto de servicio es una **acción** con consecuencias (deja de poder
reservarse), no un dato más del auto. Con una ruta propia, el frontend y los
permisos la pueden tratar por separado, y el `PUT` no la dispara sin querer.

| Body | Respuesta |
|---|---|
| `{ "activo": false }` / `{ "activo": true }` | 200 con el auto actualizado |
| `{ "activo": "false" }` | 400 "El campo activo debe ser verdadero o falso" |
| `{}` | 400 "El campo activo es obligatorio" |
| `{ "otro": 1 }` | 400 "No se pueden enviar estos campos: otro" |
| Auto inexistente | 404 "Auto no encontrado" |

### Paso 5. Qué efecto tiene en las reservas

`clase.service.validarDisponibilidad` comprueba el auto en **cada** reserva y
en cada modificación de clase:

```
auto inexistente ......... 404 "Auto no encontrado"
auto con activo = false .. 409 "El auto no está disponible para reservas"
auto con otra clase ...... 409 "El alumno, profesor o auto ya tiene una clase en ese horario"
```

Las clases que **ya** estaban reservadas con un auto que después se saca de
servicio **siguen vigentes** (I-22). Para reasignarlas, hay que modificarlas
una por una con `PUT /api/clases/:id { "auto": "<otro>" }`.

### ¿Por qué no hay `DELETE`?

Cada `Clase` guarda el id de su auto (`ref: 'Auto'`). Si se borrara el auto,
las clases (también las pasadas) quedarían apuntando a un id que ya no existe,
y se perdería el historial de qué auto se usó. Con `activo: false`, el auto
deja de ofrecerse pero el historial queda completo. La colección de Postman
sigue la misma idea: su Teardown **saca de servicio** los autos de prueba en
lugar de borrarlos.

---

## Qué puede salir mal

| Pedido | Respuesta real |
|---|---|
| Un alumno crea o modifica | 403 "Se requieren permisos de administrador" |
| `cambios` con otro valor | 400 "El tipo de cambios debe ser MANUAL o AUTOMATICO" |
| Sin `patente` ni `cambios` | 400 "La patente es obligatoria" (el DTO frena con el primer faltante) |
| Patente repetida | 409 "La patente ya está en uso" |
| La misma patente con otros espacios internos | **201**: se crea un duplicado (I-39) |
| Campos desconocidos | 400 "No se pueden enviar estos campos: …" / "No se pueden modificar estos campos: …" |
| `marca` o `modelo` que no son texto | 400 "La marca debe ser un texto" |
| `PUT` con `activo` | 400, con la pista de usar `PATCH /autos/:id/activo` |
| `PUT` con `{}` | 400 "Debe indicarse al menos un campo para actualizar" |
| `PATCH activo` con `"false"` como texto | 400 "El campo activo debe ser verdadero o falso" |
| Reservar con un auto inactivo | 409 "El auto no está disponible para reservas" |
| `DELETE /api/autos/:id` | 404 "Ruta no encontrada" |

---

## Resumen

- **Crear:** el DTO acepta solo los campos del auto, con su tipo. Mongoose
  normaliza (`trim`, `uppercase`) y valida los valores (`required`, `enum`).
  La patente repetida se traduce a 409.
- **Consultar:** abierto a cualquier usuario con token, e incluye los autos
  inactivos.
- **Modificar:** `findByIdAndUpdate` con `runValidators`. Es un cambio
  parcial: el DTO exige al menos un campo y no deja pasar `activo`, `_id` ni
  operadores como `$set`.
- **Fuera de servicio:** `PATCH .../activo` con un booleano estricto. No hay
  borrado, para conservar el historial de clases.
- Cada reserva comprueba que el auto exista y esté activo. Las clases ya
  reservadas no se revisan.

**Siguiente lectura:** [`primer-administrador.md`](primer-administrador.md).
