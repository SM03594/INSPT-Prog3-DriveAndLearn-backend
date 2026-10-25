# Errores: cómo un `throw` se convierte en una respuesta HTTP

## Qué es esto, en una frase

En este proyecto, ninguna capa responde los errores por su cuenta: **los
lanza**. Cada error es una **clase propia** que ya sabe qué status HTTP le
corresponde, y un único lugar, el `errorHandler`, los convierte en la
respuesta `{ mensaje }`. Esta guía recorre esas clases, los "traductores" que
convierten errores de librerías en errores del proyecto, y el camino completo
de un error.

---

## El mapa

```
Error  (clase nativa de JavaScript)
 │
 ├── ErrorPeticionInvalida ......... 400 por defecto   "el pedido está mal armado"
 │     ├── ErrorJsonInvalido ....... 400               body que no es un objeto JSON
 │     ├── ErrorPeticionSinCuerpo .. 400               falta el body
 │     └── ErrorLecturaCuerpo ...... 400 / 413 / 415   body ilegible (muy grande, charset...)
 │
 ├── ErrorAutenticacion ............ 401               "no sé quién sos"
 ├── ErrorAutorizacion ............. 403               "sé quién sos, pero no podés"
 │
 └── ErrorDeNegocio ................ 400 por defecto   "se rompió una regla del negocio"
       └── ErrorClaveDuplicada ..... 409               email o patente repetidos
```

Todas viven en `src/errors/`, una por archivo. Además, el `errorHandler`
reconoce dos errores **de Mongoose** que no son del proyecto:

| Error externo | Cuándo aparece | Status |
|---|---|---|
| `mongoose.Error.ValidationError` | Un campo no cumple el esquema (`required`, `min`, `enum`...). | 400 |
| `CastError` | Un id que no tiene forma de ObjectId (`/api/autos/abc`). | 400 "Id inválido" |

Cualquier otro error se considera un **bug**: responde **500** y se registra
en la consola.

---

## El recorrido

### 1. Cómo es una clase de error

`src/errors/errorAutorizacion.ts`:

```ts
export class ErrorAutorizacion extends Error {
  readonly status = 403;

  constructor(message: string) {
    super(message);                   // Error guarda el mensaje en .message
    this.name = 'ErrorAutorizacion';  // aparece en los logs y en el stack trace
  }
}
```

- `extends Error` hace que se comporte como cualquier error de JS: se puede
  lanzar con `throw`, tiene `.message` y `.stack`, y se puede comprobar con
  `instanceof`.
- `status` es lo que agrega el proyecto: **cada error sabe su código HTTP**.
- `this.name` reemplaza el genérico `"Error"`, y así en la consola se ve
  `ErrorAutorizacion: Se requieren permisos de administrador`.

Hay dos formas de definir el `status`:

| Forma | Ejemplo | Cuándo conviene |
|---|---|---|
| Fijo, como campo de la clase | `readonly status = 401;` (`ErrorAutenticacion`, `ErrorAutorizacion`) | El status es **siempre** el mismo. |
| Parámetro con valor por defecto | `constructor(message, readonly status = 400)` (`ErrorDeNegocio`, `ErrorPeticionInvalida`) | Quien lanza el error puede elegir otro status. |

### 2. Las cuatro familias

**`ErrorPeticionInvalida`: el pedido está mal armado.** No se rompió ninguna
regla del negocio: el cliente mandó algo con un **formato** que no corresponde.
Las subclases solo fijan el mensaje y el nombre:

```ts
export class ErrorPeticionSinCuerpo extends ErrorPeticionInvalida {
  constructor(message = 'La petición debe incluir un cuerpo JSON') { super(message); ... }
}
```

**`ErrorAutenticacion` (401) y `ErrorAutorizacion` (403): identidad y
permisos.** Los lanza `auth.middleware`, y también `auth.service` cuando el
login falla. La diferencia se explica en
[`05-middlewares.md`](05-middlewares.md#4-requireadministrator-podés).

**`ErrorDeNegocio`: una regla del dominio.** Lo lanzan los services, y también
los DTO cuando el body no cumple el contrato ("La marca debe ser un texto"). Por
defecto es 400, pero quien lo lanza puede elegir otro status:

```ts
throw new ErrorDeNegocio('La cantidad a sumar debe ser mayor que 0');   // 400
throw new ErrorDeNegocio('El auto no está disponible para reservas', 409);
throw new ErrorDeNegocio('Profesor no encontrado', 404);
```

**`ErrorClaveDuplicada` (409)** es un `ErrorDeNegocio` especial: no lo lanza
el service "a mano", sino que se construye a partir del error crudo de MongoDB
(sección 3).

### 3. Los traductores: de error ajeno a error propio

Las librerías lanzan sus propios errores, que no tienen `status` ni mensajes
en castellano. El proyecto tiene tres funciones que los **traducen**, todas
con el mismo patrón: *si reconozco el error, devuelvo uno propio; si no, lo
devuelvo sin cambios.*

| Traductor | Archivo | Error de entrada | Error de salida | Lo usa |
|---|---|---|---|---|
| `verSiErrorClaveDuplicada` | `errorClaveDuplicada.ts` | MongoDB `code: 11000` | `ErrorClaveDuplicada` (409) | services (`try/catch` en `create`/`update`) |
| `verSiErrorAutenticacion` | `errorAutenticacion.ts` | `jwt.JsonWebTokenError` (firma inválida, vencido...) | `ErrorAutenticacion` (401) | `auth.middleware` |
| `verSiErrorLecturaCuerpo` | `errorLecturaCuerpo.ts` | Error de `express.json()` | `ErrorJsonInvalido` o `ErrorLecturaCuerpo` | `errorHandler` |

Así se usa uno (`src/services/auto.service.ts:32`):

```ts
try {
  return await AutoModel.create(datos);
} catch (err) {
  throw verSiErrorClaveDuplicada(err, MENSAJE_PATENTE_DUPLICADA);
}
```

Fijate que **siempre** se hace `throw` del resultado. Si el error era de clave
duplicada, sale un `ErrorClaveDuplicada`. Si era otra cosa (la base caída, por
ejemplo), sale el error original, y termina en un 500.

`verSiErrorClaveDuplicada` tiene un detalle más. Si el esquema define
`unique: [true, 'mensaje']`, Mongoose **envuelve** el error crudo y lo guarda
en `err.cause`, y entonces se usa el mensaje del esquema. Si el esquema solo
dice `unique: true`, el error llega crudo y se usa el mensaje de respaldo que
le pasa el service.

### 4. El camino completo de un error

Un admin intenta crear un auto con una patente que ya existe:

```
POST /api/autos { "patente": "AB123CD", "cambios": "MANUAL" }
 │
 ▼ auto.controller.crear → autoService.crear(aCrearAutoDto(req.body))
 │    (el DTO deja pasar el body: los campos y los tipos están bien)
 │
 ▼ AutoModel.create(...)
 │    MongoDB rechaza: índice único violado
 │    Mongoose lanza MongooseError("La patente ingresada ya está en uso")
 │                   con .cause = { code: 11000, ... }
 ▼ catch → verSiErrorClaveDuplicada(err, ...)
 │    err.cause.code === 11000  → new ErrorClaveDuplicada(err.message)   (status 409)
 │    throw
 ▼ el controller no lo atrapa → la promesa del handler se rechaza
 ▼ Express 5 se lo pasa al errorHandler
 │
 ▼ errorHandler
 │    ¿ValidationError? no · ¿CastError? no · ¿error HTTP? no
 │    ¿instanceof ErrorDeNegocio? SÍ (ErrorClaveDuplicada extiende de él)
 ▼
409 { "mensaje": "La patente ingresada ya está en uso" }
```

### 5. El `errorHandler`: un solo lugar decide

`src/middlewares/errorHandler.middleware.ts:32` revisa el error **en este
orden**:

```ts
const err = verSiErrorLecturaCuerpo(errOriginal);          // ① traducir errores de express.json()
let status: number;
let mensaje: string;

if (err instanceof mongoose.Error.ValidationError)      → 400, junta los mensajes de todos los campos
else if (err instanceof Error && err.name === 'CastError') → 400 'Id inválido'
else if (err instanceof ErrorPeticionInvalida || ErrorAutenticacion ||
         ErrorAutorizacion || ErrorDeNegocio)           → err.status, err.message
else                                                    → console.error(err); 500 'Error interno del servidor'

res.status(status).json({ mensaje });                     // ② se responde una sola vez
```

Cuatro claves para entenderlo:

- **Cada rama solo decide `status` y `mensaje`.** La respuesta se envía una
  sola vez, en la última línea, así que no hace falta cortar la función con
  un `return` en cada caso.

- **`instanceof` reconoce las subclases.** `ErrorClaveDuplicada instanceof
  ErrorDeNegocio` es `true`, por eso no hace falta un `if` para cada subclase.
  Lo mismo pasa con `ErrorJsonInvalido`, `ErrorPeticionSinCuerpo` y
  `ErrorLecturaCuerpo` respecto de `ErrorPeticionInvalida`. Y como las cuatro
  clases de la tercera rama traen su `status`, comparten un solo `else if`.
- **Todas las respuestas tienen la misma forma:** `{ "mensaje": "..." }`. El
  frontend siempre sabe dónde buscar el texto del error.
- **El 500 no muestra el mensaje real.** Un bug puede tener detalles internos
  (rutas de archivos, nombres de colecciones). Se registra en la consola del
  servidor y el cliente solo recibe "Error interno del servidor".

### 6. ¿Qué error lanzo?

| Situación | Clase | Status |
|---|---|---|
| El body falta, no es un objeto o no se puede leer | `ErrorPeticionInvalida` o una subclase | 400 / 413 / 415 |
| No hay token, o es inválido o está vencido | `ErrorAutenticacion` | 401 |
| El usuario no tiene permiso | `ErrorAutorizacion` | 403 |
| El body no cumple el contrato (un campo de más, otro tipo, falta un obligatorio) | `ErrorDeNegocio`, lanzado por el **DTO** | 400 |
| Un dato no cumple una regla ("cantidad > 0") | `ErrorDeNegocio` | 400 |
| El estado actual no permite la operación (sin saldo, horario ocupado) | `ErrorDeNegocio(msg, 409)` | 409 |
| Un recurso relacionado no existe ("Profesor no encontrado" al reservar) | `ErrorDeNegocio(msg, 404)` | 404 |
| El recurso **principal** no existe (`GET /api/autos/:id`) | Ninguna: el service devuelve `null` y el controller responde 404. | 404 |
| Email o patente repetidos | Lo construye `verSiErrorClaveDuplicada` | 409 |

`clase.service` también usa `ErrorDeNegocio(msg, 403)` para "La cuenta
autenticada ya no está activa". Funciona igual que un `ErrorAutorizacion`,
porque los dos llevan `status = 403`, pero es una regla que vive en el service
y no en un middleware.

### 7. Los errores que **no** pasan por el `errorHandler`

`src/config/env.ts` y `src/config/db.ts` lanzan un `Error` común:

```ts
throw new Error('JWT_SECRET debe estar configurado con al menos 32 caracteres');
```

Esos errores ocurren **al arrancar**, en `server.ts`, antes de que exista
cualquier pedido. Por eso no tiene sentido darles un status: el proceso se
detiene con el mensaje en la consola. La excepción es si `JWT_SECRET`
desapareciera mientras la app corre. En ese caso, `obtenerJwtSecret()`
lanzaría el error durante un login y el cliente recibiría un 500.

---

## Qué puede salir mal

| Síntoma | Causa |
|---|---|
| Una regla de negocio responde 500 | Se lanzó un `new Error(...)` común en lugar de `ErrorDeNegocio`. |
| Un email repetido responde 500 | Falta el `try/catch` con `verSiErrorClaveDuplicada`. |
| Un error "se pierde": el service lo atrapa y sigue | Un `catch` que no hace `throw`. Los traductores **devuelven** el error: hay que lanzarlo con `throw verSiErrorClaveDuplicada(...)`. |
| El cliente recibe un mensaje en inglés | Un error de una librería llegó sin traducir y no es uno de los casos que reconoce el `errorHandler`. |
| `instanceof` da `false` con un error propio | Se lanzó un objeto o un string (`throw 'error'`) en lugar de una instancia de la clase. |

---

## Resumen

- Cada clase de error **sabe su status**. Ninguna capa responde errores: los
  **lanza**.
- Las cuatro familias son: petición inválida (400), autenticación (401),
  autorización (403) y negocio (400 por defecto, o el status que se elija).
- Los **traductores** convierten errores de MongoDB, jsonwebtoken y
  express.json() en errores propios, y si no reconocen el error lo devuelven
  sin cambios.
- El `errorHandler` decide la respuesta según la clase, usando `instanceof`
  (que también reconoce las subclases). Siempre responde `{ mensaje }`, y en
  un 500 nunca muestra los detalles.

**Siguiente lectura:** [`10-utils-y-fechas.md`](10-utils-y-fechas.md).
