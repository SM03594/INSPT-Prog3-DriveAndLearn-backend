# Guía: middlewares, handlers y routers en Express

Esta guía explica **tres piezas de Express** que se cruzan todo el tiempo cuando
armás una API y que es fácil confundir entre sí: **handlers**, **middlewares** y
**routers**. Está pensada para alguien que está aprendiendo **Express** y **APIs
REST** al mismo tiempo, así que arranca desde lo más básico.

Los ejemplos salen de tres lugares:

- **código real del proyecto** — sobre todo [`src/app.ts`](../src/app.ts);
- **la plantilla `recetorium`** que está en
  [`contexto-claude/recetorium-backend-kilo/`](../contexto-claude/recetorium-backend-kilo/)
  (es JavaScript, pero la estructura es la misma que vamos a usar);
- algún fragmento **genérico** cuando hace falta inventar un caso.

Compañera de esta guía: [guia-capa-service.md](guia-capa-service.md) explica la
capa que los handlers van a llamar. Cuando existan `src/controllers/` y
`src/routes/` va a haber una guía específica de esas dos capas; esta es la base
conceptual que va **antes**.

---

## 1. El panorama: Express es una cinta transportadora

Cuando un cliente (el navegador, el frontend, Postman) le hace un pedido a la API,
Express **no** ejecuta "una función y listo". Arma una **fila de funciones** y
hace pasar el pedido por ellas, **una tras otra, en orden**. Cada función de esa
fila recibe siempre los mismos dos objetos:

| Objeto | Qué es | Ejemplos de uso |
|---|---|---|
| **`req`** (request) | Todo lo que **mandó el cliente**. Es de solo lectura para vos. | `req.params.id`, `req.query.activo`, `req.body`, `req.headers.authorization` |
| **`res`** (response) | La **respuesta que estás construyendo**. Vos la vas llenando. | `res.status(201)`, `res.json({...})`, `res.send()` |

```
        req                                                         res
  cliente ──▶  [ función 1 ]──▶[ función 2 ]──▶[ función 3 ]──▶  cliente
                  cors()        express.json()   tu handler
              (middleware)      (middleware)     (cierra la respuesta)
```

La pregunta clave para entender las tres piezas es siempre:
**¿esta función CIERRA la respuesta, o solo la prepara y pasa la posta?**

- La que **cierra** (llama a `res.json()`, `res.send()`, etc.) es el **handler**.
- La que **prepara y pasa la posta** (llama a `next()`) es un **middleware**.
- El **router** no es una función de la fila: es una forma de **agrupar** un
  pedazo de esa fila por recurso.

---

## 2. El handler: la función que responde

Un **handler** (a veces "controlador de ruta" o, en nuestra arquitectura,
**controller**) es la función que Express ejecuta cuando una URL + un verbo HTTP
matchean, y **cuya responsabilidad es terminar la respuesta**.

Firma: `(req, res) => { ... }`

Ejemplo real, la ruta raíz de [`src/app.ts`](../src/app.ts):

```ts
app.get('/', (_req, res) => {
  res.json({ mensaje: 'API DriveAndLearn' });
});
```

- `app.get('/', handler)` se lee: *"cuando llegue un `GET` a la URL `/`, ejecutá
  este handler"*.
- El handler no devuelve nada con `return`. **La forma de "devolver" en Express es
  llamar a un método de `res`.** Acá `res.json(obj)` serializa `obj` a JSON, pone
  el header `Content-Type: application/json` y **cierra** la respuesta.
- `_req` con guion bajo es la convención del proyecto para "este parámetro existe
  pero no lo uso".

Un handler un poco más completo (así van a quedar los nuestros, ver
[guia-capa-service.md](guia-capa-service.md#L562) §13):

```ts
// src/controllers/auto.controller.ts  (todavía no existe; así se va a ver)
import type { Request, Response } from 'express';
import * as autoService from '../services/auto.service.js';

export async function obtener(req: Request, res: Response) {
  const auto = await autoService.obtenerPorId(req.params.id); // 1. leer el pedido
  if (auto === null) {                                        // 2. decidir
    return res.status(404).json({ mensaje: 'Auto no encontrado' });
  }
  res.json(auto);                                             // 3. responder
}
```

Un handler hace **exactamente tres cosas**:

1. **Lee** lo que vino en `req` (`params`, `query`, `body`).
2. **Llama a un service** (la capa que tiene la lógica y habla con la base).
3. **Arma la respuesta**: elige el status (`200`, `201`, `404`, ...) y el body.

Lo que un handler **no** hace: no consulta MongoDB directamente, no tiene reglas
de negocio. Eso vive en el service.

### `res` se usa una sola vez

Cada request tiene **una** respuesta. Si llamás dos veces a un método que cierra
(`res.json()` y después otro `res.json()`), Express tira el error
`Cannot set headers after they are sent`. Por eso el patrón
`return res.status(404).json(...)`: el `return` **corta** el handler ahí para que
no siga y mande una segunda respuesta.

### Métodos de `res` que vas a usar

| Método | Qué hace |
|---|---|
| `res.json(obj)` | Manda `obj` como JSON. Es lo más común en una API. |
| `res.status(code)` | Fija el código de estado. Devuelve `res`, así que se encadena: `res.status(201).json(...)`. |
| `res.send()` | Manda una respuesta sin body (o con texto). Se usa con `res.status(204).send()` para un "OK, sin contenido". |

---

## 3. El middleware: la función que prepara y pasa la posta

Un **middleware** es una función que se ejecuta **antes** de que el pedido llegue
al handler, hace algo con `req` / `res`, y después **cede el turno** a la
siguiente función de la fila llamando a **`next()`**.

Firma: `(req, res, next) => { ... }` — el **tercer parámetro `next`** es lo que lo
distingue de un handler.

Idea central: **un middleware es un handler que, en vez de cerrar la respuesta,
llama a `next()` para que siga la cinta.**

### Los dos middlewares que el proyecto ya usa

En [`src/app.ts`](../src/app.ts#L27) están estos dos, registrados con `app.use()`:

```ts
app.use(cors());
app.use(express.json());
```

| Middleware | Qué hace con cada request antes de que llegue a tu handler |
|---|---|
| **`cors()`** | Agrega headers `Access-Control-Allow-*` a `res` para que el navegador **deje** al frontend (que corre en otro origen) hablar con la API. Después llama a `next()`. |
| **`express.json()`** | Mira si el body vino como JSON; si sí, lo parsea y lo deja en **`req.body`**. Sin este middleware, `req.body` es `undefined`. Después llama a `next()`. |

Fijate el efecto de la fila: cuando tu handler de `POST /api/autos` corre y hace
`req.body.patente`, ese `req.body` **existe porque `express.json()` ya pasó antes**
por la cinta y lo llenó.

### Cómo se ve un middleware por dentro

Uno genérico que loguea cada pedido (los tipos `Request`, `Response`,
`NextFunction` los provee `@types/express`, ya instalado):

```ts
import type { Request, Response, NextFunction } from 'express';

function logger(req: Request, _res: Response, next: NextFunction) {
  console.log(`${req.method} ${req.url}`);
  next(); // ← sin esto, el request queda COLGADO para siempre
}

app.use(logger); // se ejecuta para TODAS las rutas
```

- Hace su trabajo (un `console.log`).
- **No toca `res`** para cerrar nada.
- Llama a `next()`. Si te olvidás de `next()` (y tampoco respondés), el cliente
  se queda esperando hasta que se corta por timeout. Es el bug más común con
  middlewares.

Un middleware **sí puede** cortar la cinta si decide que el pedido no debe seguir.
Un ejemplo típico (todavía no lo tenemos, va a venir con el login):

```ts
function requiereAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ mensaje: 'Falta el token' }); // corta acá
  }
  // ... validar el token, guardar el usuario en req ...
  next(); // el token es válido: que siga
}
```

O sea: un middleware **o** llama a `next()` **o** responde y corta. Nunca las dos,
nunca ninguna.

### Las tres formas de registrar un middleware

| Forma | Alcance | Ejemplo |
|---|---|---|
| `app.use(fn)` | **Global**: cada request de toda la API. | `app.use(cors())` |
| `app.use('/api/autos', fn)` o `router.use(fn)` | **De un prefijo / un router**: solo los requests de ese recurso. | `router.use(requiereAuth)` en el router de autos |
| Como argumento de una ruta puntual | **De esa sola ruta**. | `router.post('/', requiereAuth, validarBody, crear)` |

En la última forma, una ruta es en realidad **una lista de funciones**: se
ejecutan en orden y cada una llama a `next()` hasta llegar a la última, que es la
que cierra (el handler).

```
router.post('/',  requiereAuth,  validarBody,  crear)
                   └─ middleware  └─ middleware └─ handler (cierra)
                      next()         next()        res.json()
```

### El middleware de errores: la firma de 4 parámetros

Hay un tipo especial de middleware que Express reconoce **solo porque tiene
exactamente 4 parámetros**: `(err, req, res, next)`. Es donde caen los errores.

```ts
import type { ErrorRequestHandler } from 'express';

// va SIEMPRE al final de app.ts, después de montar todos los routers.
// El tipo ErrorRequestHandler obliga a los 4 parámetros: si escribís 3,
// TS no se queja pero Express deja de tratarla como middleware de errores.
const manejarErrores: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ mensaje: 'Error interno del servidor' });
};

app.use(manejarErrores);
```

Cómo llega un error hasta acá:

- Si un middleware o handler llama a **`next(err)`** (con un argumento), Express
  **se saltea** todas las funciones normales que siguen y va directo al middleware
  de errores.
- En **Express 5** (que es el que usa este proyecto), si un handler `async` lanza
  una excepción o rechaza su promesa, Express la **atrapa automáticamente** y hace
  ese `next(err)` por vos. En Express 4 había que hacerlo a mano. Es la mejora más
  importante de la versión 5.

Este proyecto todavía **no decidió** si va a centralizar acá la traducción de los
errores de Mongoose (`ValidationError` → 400, clave duplicada → 409, etc.) o si
cada handler los va a manejar con su propio `try/catch`. Lo importante para esta
guía es el concepto: **un middleware de 4 parámetros es el "catch" global de la
aplicación.**

---

## 4. El router: agrupar las rutas de un recurso

Un **router** es un **mini-Express** que junta todas las rutas de **un recurso**
(autos, alumnos, profesores...) en su propio archivo, y después se **enchufa** en
la app principal con un prefijo.

Sin routers, `app.ts` tendría *todas* las rutas de *todos* los recursos mezcladas.
Con routers, `app.ts` solo dice "esto se maneja allá":

```ts
// src/app.ts  (así está hoy)
import autosRoutes from './routes/autos.routes.js';

app.use('/api/autos', autosRoutes);
```

`app.use('/api/autos', autosRoutes)` se lee: *"todo lo que empiece con
`/api/autos` mandáselo a este router"*.

### Cómo se ve un router por dentro

La plantilla [`recetorium .../usuarios.routes.js`](../contexto-claude/recetorium-backend-kilo/src/routes/usuarios.routes.js)
tiene un router así (está en JavaScript; el nuestro es TypeScript, pero la
estructura es idéntica). Así se va a ver `src/routes/autos.routes.ts`:

```ts
import { Router } from 'express';
import * as autoController from '../controllers/auto.controller.js'; // ← .js aunque el archivo sea .ts (regla de ESM)

const router = Router();                          // 1. crear el mini-router

router.get('/', autoController.listar);           // 2. declarar rutas RELATIVAS al prefijo
router.get('/:id', autoController.obtener);
router.post('/', autoController.crear);
router.put('/:id', autoController.actualizar);
router.patch('/:id/activo', autoController.cambiarActivo);

export default router;                            // 3. exportarlo para montarlo en app.ts
```

- El router es **puro mapa**: verbo + path → qué handler. No hay `(req, res)` acá:
  cada handler ya está tipado en su archivo de `src/controllers/`.
- Las rutas se declaran **relativas al prefijo**. En el router,
  `router.get('/:id', ...)` combinado con `app.use('/api/autos', router)` en la
  app da la URL final **`/api/autos/:id`**.
- `import type` no hace falta acá porque `autoController` trae **valores** (las
  funciones), no tipos. La ruta del import **sí** lleva `.js` (regla de ESM del
  proyecto, ver [guia-models-mongoose.md](guia-models-mongoose.md)).
- `:id` es un **parámetro de ruta**: lo que el cliente escriba ahí llega en
  **`req.params.id`** como string.
- Un router puede tener sus **propios middlewares** (`router.use(...)`) que aplican
  solo a las rutas de ese recurso.

### El mapa de rutas REST de un recurso

Un router de recurso típico declara estas rutas (las de autos, de la
[propuesta.md](../propuesta.md) y el [CLAUDE.md](../CLAUDE.md)):

| Verbo + path (en el router) | URL final | Handler | Para qué |
|---|---|---|---|
| `GET /` | `/api/autos` | `listar` | todos los autos |
| `GET /:id` | `/api/autos/:id` | `obtener` | un auto por id |
| `POST /` | `/api/autos` | `crear` | alta (datos en `req.body`) |
| `PUT /:id` | `/api/autos/:id` | `actualizar` | modificar |
| `PATCH /:id/activo` | `/api/autos/:id/activo` | `cambiarActivo` | poner/sacar de servicio |

(No hay `DELETE`: los autos se desactivan, no se borran.)

---

## 5. Cómo encajan los tres en este proyecto

```
                          src/app.ts
                             │
   ┌─────────────────────────┼──────────────────────────────┐
   │  MIDDLEWARES GLOBALES    │       ROUTERS montados        │
   │  app.use(cors())         │  app.use('/api/autos', ...)   │
   │  app.use(express.json()) │  app.use('/api/alumnos', ...) │
   └─────────────────────────┴──────────────────────────────┘

 GET /api/autos/64b7...
   │
   ▼
 cors()  ─▶  express.json()  ─▶  router de autos  ─▶  [mw de ruta]  ─▶  auto.controller.obtener
 (mw global)  (mw global)        elige la ruta       (auth, etc.)       (HANDLER: lee req,
                                 por verbo+path       si hay             llama al service,
                                                                        arma la response)
                                                                              │
                                                                              ▼
                                                                     auto.service.obtenerPorId
                                                                        (lógica + Mongoose)
```

| Capa | Archivo | Su única responsabilidad |
|---|---|---|
| **Middlewares globales** | `src/app.ts` | Preparar **cada** request (CORS, parsear JSON). |
| **Router** | `src/routes/autos.routes.ts` | Mapear **verbo + URL → qué handler**. Nada de lógica. |
| **Middlewares de ruta** | (varios) | Chequeos previos a un recurso o ruta (auth, validación de body). |
| **Handler / controller** | `src/controllers/auto.controller.ts` | Traducir HTTP ↔ service: leer `req`, llamar **un** service, armar `res`. |
| **Service** | `src/services/auto.service.ts` | Lógica de negocio + todo el acceso a MongoDB. No conoce `req`/`res`. |

---

## 6. El orden importa: la cinta es de arriba hacia abajo

Express ejecuta middlewares y rutas **en el orden en que los registrás** en el
código. Consecuencias prácticas:

- `app.use(express.json())` tiene que estar **antes** de los routers, si no los
  handlers reciben `req.body` vacío.
- El middleware de errores (4 parámetros) va **al final de todo**, después de los
  routers: es lo último de la cinta.
- Un middleware "catch-all" de 404 (`app.use((req, res) => res.status(404)...)`)
  va **después** de los routers pero **antes** del de errores: si ningún router
  matcheó, cae ahí.

```ts
// esqueleto de app.ts con todo en orden
import express, { type Request, type Response, type ErrorRequestHandler } from 'express';

const app = express();

app.use(cors());               // 1. middlewares globales
app.use(express.json());

app.use('/api/autos', autosRoutes);       // 2. routers
app.use('/api/alumnos', alumnosRoutes);

app.use((_req: Request, res: Response) =>  // 3. no matcheó ningún router
  res.status(404).json({ mensaje: 'Ruta no encontrada' }));

const manejarErrores: ErrorRequestHandler = (err, _req, res, _next) => { /* ... */ }; // 4. errores (4 params)
app.use(manejarErrores);

export default app;
```

---

## 7. Cómo distingue Express qué es cada cosa: por la cantidad de parámetros

Express mira **cuántos parámetros** tiene la función que le pasás:

| Parámetros | Express la trata como | Ejemplo |
|---|---|---|
| `(req, res)` | **handler** normal | `(req, res) => res.json(...)` |
| `(req, res, next)` | **middleware** normal | `(req, res, next) => { ...; next(); }` |
| `(err, req, res, next)` — **4** | **middleware de errores** | `(err, req, res, next) => res.status(500)...` |

Por eso en un middleware de errores tenés que escribir los 4 parámetros **aunque
no uses `next`** (por eso la convención `_next`): si ponés 3, Express cree que es
un middleware normal y nunca le manda los errores.

En TypeScript, los tipos de `@types/express` ayudan a no equivocarse:
`RequestHandler` para handlers y middlewares normales, `ErrorRequestHandler` para
los de errores.

---

## 8. Errores frecuentes al empezar

| Síntoma | Causa típica |
|---|---|
| El request "se cuelga", el cliente espera para siempre | Un middleware que no llama a `next()` **ni** responde. |
| `Cannot set headers after they are sent` | Se llamó dos veces a algo que cierra `res` (faltó un `return` antes de un `res.json`). |
| `req.body` es `undefined` | Falta `app.use(express.json())`, o está registrado **después** del router. |
| El middleware de errores nunca corre | Se declaró con 3 parámetros en vez de 4, o se registró **antes** de los routers. |
| Una ruta responde 404 aunque exista | El router se montó con el prefijo equivocado, o la ruta se declaró después de un catch-all. |
| El frontend recibe "CORS error" | Falta `app.use(cors())` o está después de los routers. |

---

## 9. Glosario rápido

| Término | En una frase |
|---|---|
| **`req`** | Objeto con todo lo que mandó el cliente: `params`, `query`, `body`, `headers`. Solo lectura. |
| **`res`** | Objeto con el que construís y mandás la respuesta: `res.status()`, `res.json()`, `res.send()`. Se usa una sola vez por request. |
| **`next`** | Función que un middleware llama para **ceder el turno** a la siguiente función de la cinta. `next(err)` salta al middleware de errores. |
| **Handler** | Función `(req, res)` que **cierra** la respuesta. En nuestra arquitectura vive en `src/controllers/` y se llama *controller*. |
| **Middleware** | Función `(req, res, next)` que se ejecuta **antes** del handler, prepara `req`/`res` y llama a `next()`. Un handler que pasa la posta en vez de responder. |
| **Middleware global** | Registrado con `app.use(fn)`: corre para **cada** request. Ej.: `cors()`, `express.json()`. |
| **Middleware de errores** | Middleware con **4 parámetros** `(err, req, res, next)`. Es el "catch" global de la app; va al final de `app.ts`. |
| **Router** | Mini-Express que agrupa las rutas de **un recurso** en un archivo (`src/routes/xxx.routes.ts`) y se monta con `app.use('/api/xxx', router)`. |
| **Prefijo / montaje** | El path con el que se engancha un router: `app.use('/api/autos', router)`. Las rutas del router son relativas a él. |
| **Parámetro de ruta** | El `:id` en `/api/autos/:id`. Llega en `req.params.id` como string. |
| **`req.query`** | Lo que viene después del `?` en la URL: `/api/autos?activo=true` → `req.query.activo === 'true'`. |
| **Verbo HTTP** | `GET` (leer), `POST` (crear), `PUT`/`PATCH` (modificar), `DELETE` (borrar). |
| **`RequestHandler` / `ErrorRequestHandler`** | Tipos de `@types/express` para tipar handlers/middlewares normales y de errores. |

---

## 10. Para seguir leyendo

- Express — Routing: <https://expressjs.com/en/guide/routing.html>
- Express — Usar middleware: <https://expressjs.com/en/guide/using-middleware.html>
- Express — Escribir middleware: <https://expressjs.com/en/guide/writing-middleware.html>
- Express — Manejo de errores: <https://expressjs.com/en/guide/error-handling.html>
- Express 5 — Guía de migración (errores en handlers `async`): <https://expressjs.com/en/guide/migrating-5.html>
- MDN — Métodos de petición HTTP: <https://developer.mozilla.org/es/docs/Web/HTTP/Methods>
- MDN — Introducción a Express/Node: <https://developer.mozilla.org/es/docs/Learn/Server-side/Express_Nodejs/Introduction>
