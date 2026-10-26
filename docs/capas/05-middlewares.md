# Middlewares: los filtros del pedido

## Qué es esto, en una frase

Un **middleware** es una función que Express ejecuta **entre** que llega el
pedido y que responde el controller. Puede dejarlo pasar, cortarlo con un
error o agregarle información (por ejemplo, quién es el usuario). Esta guía
recorre todos los middlewares del proyecto: los globales de `app.ts` y los de
`src/middlewares/`.

---

## El mapa

```
pedido
  │
  │  ── globales (app.ts) ──────────────────────────────────────────
  ├─► cors()                       cabeceras CORS
  ├─► express.json()               body JSON → req.body
  │
  │  ── por ruta (routes/*.ts) ────────────────────────────────────
  ├─► requireAuthentication        ¿token válido?         → 401
  ├─► requireAdministrator         ¿es admin activo?      → 403
  │   requireSelfOrAdministrator() ¿admin o él mismo?     → 403
  │   requireAlumnoDeLaClaseOAdministrador
  │                                ¿admin o el alumno de la clase? → 403
  ├─► validacionDeCuerpo           ¿hay un objeto JSON?   → 400
  │
  ├─► controller                   responde
  │
  │  ── al final (app.ts) ─────────────────────────────────────────
  ├─► 404 "Ruta no encontrada"     si nadie respondió
  └─► errorHandler                 si alguien lanzó un error
```

| Archivo | Exporta |
|---|---|
| `src/middlewares/auth.middleware.ts` | `requireAuthentication`, `requireAdministrator`, `requireSelfOrAdministrator`, `requireAlumnoDeLaClaseOAdministrador` |
| `src/middlewares/validacionDeCuerpo.middleware.ts` | `validacionDeCuerpo`, y `verificarCuerpo` (el chequeo, para reutilizarlo) |
| `src/middlewares/errorHandler.middleware.ts` | `errorHandler` |

---

## El recorrido

### 1. La forma de un middleware

```ts
const miMiddleware: RequestHandler = (req, res, next) => { ... };
```

Recibe el pedido (`req`), la respuesta (`res`) y `next`, la función que le
pasa el turno al siguiente de la cadena. Cada middleware tiene **tres salidas
posibles**:

```
                 ┌──► next()            → sigue el siguiente de la cadena
middleware ──────┼──► res.json(...)     → responde y la cadena termina
                 └──► throw new Error   → salta directo al errorHandler
```

Los middlewares de este proyecto **nunca responden directamente**: si algo
está mal, **lanzan** un error, y si todo está bien, llaman a `next()`. Así
cada uno queda como una lista de chequeos, y todas las respuestas de error
salen de un solo lugar, el `errorHandler`. Esto funciona porque Express 5
atrapa el `throw`, también dentro de funciones `async`.

`RequestHandler` es el tipo que Express da a esa función. Con él, TypeScript
ya sabe qué son `req`, `res` y `next` sin que tengas que anotarlos.

### 2. Los globales: `cors()` y `express.json()`

Están en `src/app.ts:22-23` y se ejecutan en **todos** los pedidos:

- **`cors()`** agrega las cabeceras que permiten que el frontend, que corre en
  otro origen, use la API. Se explica en
  [`01-stack-y-dependencias.md`](01-stack-y-dependencias.md#6-cors-permitir-que-el-frontend-llame-a-la-api).
- **`express.json()`** lee el body cuando el pedido trae
  `Content-Type: application/json` y deja el resultado en `req.body`. Si el
  JSON está mal escrito (por ejemplo, `{ "activo": fal }`), **lanza un error
  antes de llegar a cualquier router**. Ese error termina en el `errorHandler`
  (ver la sección 6).

### 3. `requireAuthentication`: ¿quién sos?

`src/middlewares/auth.middleware.ts:117`:

```ts
export const requireAuthentication: RequestHandler = (req, _res, next) => {
  const payload = verificarToken(req.header('authorization'));
  if (!esPayloadAutenticado(payload)) {
    throw new ErrorAutenticacion(MENSAJE_NO_AUTORIZADO);
  }
  req.auth = { id: payload.sub, role: payload.role };
  next();
};
```

Paso a paso:

```
Authorization: Bearer eyJhbGciOi...
       │
       ├─ ¿tiene la forma "Bearer <token>"?            (regex, :38)    no → 401
       ├─ jwt.verify(token, secreto, {                  (:48)
       │     algorithms: ['HS256'],                     ← no acepta otro algoritmo
       │     audience: 'driveandlearn-api',             ← emitido para esta API
       │     issuer:   'driveandlearn' })               ← emitido por nosotros
       │     firma mala / vencido → JsonWebTokenError → ErrorAutenticacion → 401
       ├─ ¿el payload trae sub (string) y un role válido? (:69)       no → 401
       ▼
req.auth = { id, role }  ──►  next()
```

El paso más importante es el último: **`req.auth` queda disponible para todo
lo que sigue en la cadena**. Los otros middlewares y los controllers lo leen
para saber quién hace el pedido. Que TypeScript acepte `req.auth` se explica
en [`02-typescript-en-el-proyecto.md`](02-typescript-en-el-proyecto.md#10-ampliar-los-tipos-de-una-librería-reqauth).

`_res` lleva guion bajo porque no se usa: es la convención para indicar "este
parámetro existe, pero no lo necesito".

### 4. `requireAdministrator`: ¿podés?

`src/middlewares/auth.middleware.ts:134`:

```ts
export const requireAdministrator: RequestHandler = async (req, _res, next) => {
  const auth = req.auth;
  if (
    auth?.role !== 'administrador' ||
    !(await administradorService.existe(auth.id))
  ) {
    throw new ErrorAutorizacion('Se requieren permisos de administrador');
  }
  next();
};
```

**401 vs 403.** `ErrorAutenticacion` (401) significa "no sé quién sos".
`ErrorAutorizacion` (403) significa "sé quién sos, pero no tenés permiso".

**¿Por qué consulta la base si el token ya dice `role: 'administrador'`?**
Porque el token dura una hora. Si en ese tiempo se borra a ese administrador,
su token **sigue siendo válido**: la firma es correcta y no venció. Por eso,
además del token, se comprueba que el administrador siga existiendo. Es el
único middleware que habla con la base, siempre a través de un service.

### 5. `requireSelfOrAdministrator()`: admin, o él mismo

Lo usan las rutas `/:id` de alumnos y administradores. Es una **fábrica**: una
función que recibe una configuración y **devuelve** el middleware
(`src/middlewares/auth.middleware.ts:160`):

```ts
export function requireSelfOrAdministrator(
  camposEditablesPropios?: readonly string[],
): RequestHandler {
  return async (req, _res, next) => {     // ← este es el middleware real
    // ... usa camposEditablesPropios ...
  };
}
```

La función interna **recuerda** el valor de `camposEditablesPropios` aunque se
ejecute mucho después, en cada pedido. Eso es una *closure*. Gracias a eso, la
misma lógica sirve configurada de distintas formas:

```ts
requireSelfOrAdministrator()                                // GET / DELETE: no mira el body
requireSelfOrAdministrator(['email', 'password', 'nomApe']) // PUT: limita los campos
```

**El recorrido completo.** Un alumno con id `A1` manda
`PUT /api/alumnos/:id` (ruta en `alumno.routes.ts:24`):

```
                         ┌─ role === 'administrador'?
req.auth = {A1, alumno} ─┤    sí → ¿sigue existiendo? → next()  (sin límite de campos)
                         │    no ▼
                         ├─ ¿req.params.id === 'A1'?
                         │    no → 403 "Solo podés acceder o modificar tu propio usuario"
                         │    sí ▼
                         ├─ ¿se configuraron camposEditablesPropios?
                         │    no → next()
                         │    sí ▼
                         └─ verificarCuerpo(req)               ← sin body → 400
                            verificarCamposPropios(body, [...])
                               ¿trae un campo fuera de la lista? → 403
                               ▼
                            next()
```

| Pedido del alumno A1 | Resultado |
|---|---|
| `PUT /api/alumnos/A1` con `{ "nomApe": "Ana" }` | Pasa |
| `PUT /api/alumnos/B2` con `{ "nomApe": "Ana" }` | 403: no es su usuario |
| `PUT /api/alumnos/A1` con `{ "clasesPorReservar": 99 }` | 403 "No podés modificar estos campos: clasesPorReservar" |
| `PUT /api/alumnos/A1` sin body | 400 |

¿Por qué rechazar todo el pedido en lugar de ignorar el campo prohibido? Si se
ignorara en silencio, el alumno creería que se cambió algo que no se cambió.
Así el error es explícito.

¿Por qué llama a `verificarCuerpo` si después viene `validacionDeCuerpo`?
Porque este middleware corre **antes** y necesita leer el body. Usar la misma
función garantiza que un pedido sin body reciba el mismo 400, sea de un alumno
o de un admin.

### 5b. `requireAlumnoDeLaClaseOAdministrador`: admin, o el alumno de la clase

Lo usan las rutas con el `:id` de una **clase**: `GET`, `PUT` y `DELETE`
`/api/clases/:id` (`clase.routes.ts:20-23`). Hace el mismo trabajo que el
anterior, pero el dueño no es el `:id`: hay que **buscar la clase** para saber
de qué alumno es (`src/middlewares/auth.middleware.ts:201`):

```ts
const idAlumnoDeLaClase = await claseService.obtenerPorIdAlumno(req.params.id);
const esDeOtroAlumno = idAlumnoDeLaClase !== null && idAlumnoDeLaClase !== auth.id;

if (esDeOtroAlumno) {
  throw new ErrorAutorizacion('Solo podés acceder a tus propias clases');
}
```

| Pedido de la alumna Ana | Resultado |
|---|---|
| `DELETE /api/clases/<su clase>` | Pasa |
| `GET`, `PUT` o `DELETE` sobre la clase de Beto | 403 "Solo podés acceder a tus propias clases" |
| `PUT` sobre la clase de Beto, sin body | 403: corre **antes** que `validacionDeCuerpo` |
| `DELETE` de una clase que no existe | Pasa, y el controller responde 404 |
| `DELETE /api/clases/abc` | 400 "Id inválido" (Mongoose no puede buscar ese id) |

Un admin pasa siempre que su cuenta siga existiendo, igual que en el
anterior.

¿Por qué no se reutiliza `requireSelfOrAdministrator`? Porque compara
`auth.id` con `req.params.id`, y en estas rutas el `:id` es el de una clase:
nunca coincidirían, y todos los alumnos recibirían 403. ¿Por qué deja pasar
una clase que no existe? Porque no hay dueño con quien comparar: que no existe
lo responde el controller, con el mismo 404 de siempre.

### 6. `validacionDeCuerpo`: ¿mandaste un objeto?

`src/middlewares/validacionDeCuerpo.middleware.ts`:

```ts
export function verificarCuerpo(req: Pick<Request, 'body' | 'headers'>): Record<string, unknown> {
  const body: unknown = req.body;
  if (body === undefined || req.headers['content-length'] === '0') {
    throw new ErrorPeticionSinCuerpo();                                  // 400
  }
  if (!esObjetoJson(body)) {
    throw new ErrorJsonInvalido('El cuerpo de la petición debe ser un objeto JSON'); // 400
  }
  return body;
}

export const validacionDeCuerpo: RequestHandler = (req, _res, next) => {
  verificarCuerpo(req);
  next();
};
```

El chequeo está separado del middleware para poder **reutilizarlo** (lo usa
también `requireSelfOrAdministrator`). `esObjetoJson` se importa de
`src/utils/cuerpoPeticion.ts`, el mismo type guard que usan los DTO.

| Body recibido | Quién lo frena | Status |
|---|---|---|
| Ninguno | `verificarCuerpo` (`req.body` es `undefined`) | 400 |
| Body vacío con `Content-Type: application/json` | `verificarCuerpo` (`content-length: 0`) | 400 |
| `[1, 2]` o `"hola"` | `verificarCuerpo` (no es un objeto) | 400 |
| `{ "activo": fal` (JSON mal escrito) | `express.json()`, antes de llegar acá | 400 |
| `{ "activo": "si" }` | **Pasa**: qué campos trae y de qué tipo son lo valida el **DTO**, en el controller | — |

Este middleware **solo** comprueba que haya un objeto. No sabe qué campos
necesita cada recurso: eso es responsabilidad del DTO de cada operación (ver
[`06b-dtos.md`](06b-dtos.md)).

### 7. El 404 y el `errorHandler`: el final de la cadena

Al final de `src/app.ts:34-38`:

```ts
app.use((_req, res) => {
  res.status(404).json({ mensaje: 'Ruta no encontrada' });
});

app.use(errorHandler);
```

El primero no tiene path: atrapa **cualquier** pedido que haya llegado hasta
acá, o sea, uno que ningún router respondió.

El `errorHandler` es especial: tiene **cuatro** parámetros, y en eso se basa
Express para reconocerlo como **manejador de errores**
(`src/middlewares/errorHandler.middleware.ts:32`):

```ts
export const errorHandler: ErrorRequestHandler = (errOriginal, _req, res, _next) => { ... };
```

Express lo saltea mientras no haya errores, y salta directo a él cuando alguien
lanza uno. Primero traduce los errores crudos de `express.json()`
(`verSiErrorLecturaCuerpo`) y después decide el status según la clase del
error:

```
¿mongoose ValidationError? ............................ 400 (junta los mensajes de cada campo)
¿CastError? (id que no es un ObjectId) ................ 400 "Id inválido"
¿ErrorPeticionInvalida (o una subclase) /
 ErrorAutenticacion / ErrorAutorizacion /
 ErrorDeNegocio (o una subclase)? ..................... err.status
otro (un bug) ......................................... console.error + 500 "Error interno del servidor"
```

Cada caso solo elige el `status` y el `mensaje`, y la respuesta se envía una
vez, al final: `res.status(status).json({ mensaje })`.

En el último caso **no** se envía el mensaje real al cliente: podría revelar
detalles internos. Queda registrado en la consola del servidor. Las clases de
error se explican en [`09-errores.md`](09-errores.md).

---

## Qué puede salir mal

| Síntoma | Causa |
|---|---|
| La respuesta de error es HTML en lugar de `{ mensaje }` | El `errorHandler` no tiene los **4** parámetros (aunque `_next` no se use, tiene que estar), o no está al final de `app.ts`. |
| El pedido queda colgado | Un middleware no llama a `next()`, no responde y no lanza. |
| `req.auth` es `undefined` en un controller | La ruta no pasa por `requireAuthentication`. |
| Un admin recién borrado sigue pudiendo crear autos | Una ruta de admin usa solo `requireAuthentication` y le falta `requireAdministrator`. |
| Un alumno recibe 403 con su **propia** clase | La ruta usa `requireSelfOrAdministrator`, que compara contra el `:id` (la clase). En las rutas de clases va `requireAlumnoDeLaClaseOAdministrador`. |
| *"Cannot set headers after they are sent"* | Un middleware respondió **y** después llamó a `next()`. En este proyecto se evita porque los middlewares lanzan en lugar de responder. |

---

## Resumen

| Middleware | Pregunta | Si falla | Deja en `req` |
|---|---|---|---|
| `cors()` | — | — | — |
| `express.json()` | ¿el JSON está bien escrito? | 400 / 413 / 415 | `req.body` |
| `requireAuthentication` | ¿quién sos? | 401 | `req.auth` |
| `requireAdministrator` | ¿sos un admin activo? | 403 | — |
| `requireSelfOrAdministrator(campos?)` | ¿sos admin, o sos vos y mandás solo campos permitidos? | 403 / 400 | — |
| `requireAlumnoDeLaClaseOAdministrador` | ¿sos admin, o la clase es tuya? | 403 | — |
| `validacionDeCuerpo` | ¿mandaste un objeto JSON? | 400 | — |
| 404 | ¿nadie respondió? | 404 | — |
| `errorHandler` | ¿qué error fue? | el status de cada error | — |

- Los middlewares **lanzan** errores y nunca responden: todas las respuestas
  de error salen del `errorHandler`.
- Para ver cada caso probado, mirá `tests/middlewares/`: `auth.http.test.ts`,
  `validacionDeCuerpo.http.test.ts` y `errorHandler.http.test.ts`.

**Siguiente lectura:** [`06-controllers.md`](06-controllers.md).
