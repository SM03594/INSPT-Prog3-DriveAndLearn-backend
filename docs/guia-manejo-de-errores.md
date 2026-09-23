# Guía: cómo se manejan los errores en este proyecto

Esta guía explica **de punta a punta** qué pasa cuando algo sale mal en un
request: quién detecta el error, quién lo atrapa y cómo se decide qué status
HTTP y qué mensaje recibe el cliente. Está pensada para alguien que está
aprendiendo **Express** y **TypeScript** al mismo tiempo.

**Todos los ejemplos de acá son código real** de `src/middlewares/`,
`src/errors/` y `src/services/`.

Compañeras de esta guía:
[guia-capa-service.md](guia-capa-service.md) §9 explica cómo un service
decide fallar; [guia-middleware-handlers-y-routers.md](guia-middleware-handlers-y-routers.md)
§3 explica qué es un middleware de errores en general. Esta guía es la que
junta las dos puntas con el código que realmente quedó escrito.

---

## 1. La idea central: cada capa traduce lo que le toca

En este proyecto, **ningún controller tiene `try/catch`**. Cuando algo falla
—un campo obligatorio que falta, un id mal formado, una regla de negocio
rota, un bug— el error termina, siempre, en un único middleware que decide
el status HTTP:

```
 CLIENTE
   │  POST /api/autos   { sin patente }
   ▼
┌────────┐   ┌────────────────────┐   ┌────────────────────┐
│ routes │──▶│ auto.controller.ts │──▶│  auto.service.ts    │
│        │   │  sin try/catch     │   │  AutoModel.create() │
└────────┘   └────────────────────┘   └──────────┬──────────┘
                                                   │ throw ValidationError
                                                   ▼
                                    src/middlewares/errorHandler.middleware.ts
                                    (único lugar que decide el status HTTP)
                                                   │
                                                   ▼
                                     400 { "mensaje": "La patente
                                           es obligatoria" }
```

Por qué esto funciona sin que cada handler tenga su propio `try/catch`: en
**Express 5**, si un handler `async` lanza una excepción o su promesa
rechaza, Express hace el equivalente a `next(err)` **automáticamente** — no
hace falta capturarlo a mano. El error salta directo al middleware de 4
parámetros. Es la mejora principal de Express 5 sobre la 4 (ver
[guia-middleware-handlers-y-routers.md](guia-middleware-handlers-y-routers.md) §3).

Real, [`auto.controller.ts`](../src/controllers/auto.controller.ts):

```ts
export async function crear(req: Request, res: Response) {
  const auto = await autoService.crear(req.body);
  res.status(201).json(auto);
}
```

Si `autoService.crear(...)` lanza (por ejemplo porque falta la `patente`),
esta función **no atrapa nada**: el `await` rechaza, la función `async`
rechaza, y Express lo reenvía. `crear` solo describe el camino feliz.

**Pero "un solo lugar decide el status" no es lo mismo que "un solo lugar
sabe todo".** El middleware es el único que arma la respuesta HTTP, pero no
es el único que **traduce**. Hay un caso —la clave duplicada de MongoDB—
donde esa traducción conviene hacerla **antes**, en el service: se explica
en el §4.

---

## 2. Las cuatro formas de "salió mal" que ve el middleware

Desde el punto de vista de `errorHandler.middleware.ts`, solo existen
estos cuatro casos:

| Quién lo genera | Cuándo | Status | Mensaje al cliente |
|---|---|---|---|
| Mongoose — `ValidationError` | falta un campo `required`, o un valor no pasa el validador del esquema (`enum`, `min`...) | 400 | se arma juntando el `.message` de cada campo que falló (`err.errors`), no el mensaje compuesto de Mongoose |
| Mongoose — `CastError` | el id no tiene forma de `ObjectId` (ej. `"abc"`) | 400 | `'Id inválido'` |
| `ErrorDeNegocio` (nuestra, y sus subclases) | una regla de negocio que el service chequeó/tradujo a mano | `err.status` (lo elige quien la lanzó) | el mensaje que le pasó el service |
| cualquier otro `Error` | un **bug real**, no previsto por el proyecto | 500 | mensaje genérico, sin detalles |

**El código `11000` de MongoDB (índice `unique` violado, ej. patente
repetida) no está en esta tabla a propósito**: el middleware nunca lo ve
directamente. Cada service lo atrapa donde ocurre y lo relanza como
**`ErrorClaveDuplicada`** — que es una subclase de `ErrorDeNegocio`, así que
cae sola en la tercera fila. El middleware no sabe (ni necesita saber) nada
de MongoDB. El porqué de esta decisión está en el §4.

Fijate además que **el `id inexistente` tampoco está en esta tabla**: ese
caso **no lanza**. El service devuelve `null` y es el **controller**, no el
middleware, el que lo traduce a 404 con un `if`:

```ts
// auto.controller.ts
export async function obtener(req: Request<{ id: string }>, res: Response) {
  const auto = await autoService.obtenerPorId(req.params.id);
  if (auto === null) {
    return res.status(404).json({ mensaje: 'Auto no encontrado' });
  }
  res.json(auto);
}
```

Es la única traducción de errores que **no** pasa por el middleware — porque
no es un error, es un resultado válido (`null`) que el controller interpreta.

---

## 3. `ErrorDeNegocio`: la clase base

### El problema que resuelve

Un service, para una regla que no puede expresar en el `Schema` de Mongoose
(porque depende de los *argumentos* de la función, no de la forma del
documento), corta con un `throw`:

```ts
// alumno.service.ts
if (cantidad < 0) {
  throw new ErrorDeNegocio('La cantidad a sumar no puede ser negativa');
}
```

Si en vez de `ErrorDeNegocio` lanzara un `Error` común, el middleware
**no podría distinguirlo** de un bug real (`undefined.algo`, la base caída):
los dos son `instanceof Error` por igual. Y esa distinción importa: una regla
de negocio rota es un error esperado (el cliente mandó algo inválido); un
bug es un 500 que además querés loguear para arreglarlo.

### La clase

Completo, [`src/errors/errorDeNegocio.ts`](../src/errors/errorDeNegocio.ts):

```ts
export class ErrorDeNegocio extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = 'ErrorDeNegocio';
  }
}
```

- **`extends Error`** — sigue siendo un `Error` de JavaScript: tiene
  `.message`, `.stack`, funciona con `throw`/`try/catch`/`instanceof Error`.
  Lo que agrega es **ser una clase distinta**, para poder filtrarla con
  `instanceof ErrorDeNegocio`.
- **`public status = 400`** — azúcar de TypeScript: declarar un parámetro del
  constructor como `public` lo convierte automáticamente en una propiedad de
  la instancia (`this.status = status`). El valor por defecto es `400`, pero
  quien la lanza puede pasar otro.
- **`super(message)`** — le pasa el mensaje a `Error`, así `err.message`
  funciona como en cualquier error de JS.
- **`this.name = 'ErrorDeNegocio'`** — por convención, cada subclase de
  `Error` pisa `name` con su propio nombre (así se ve en un stack trace o en
  un `console.error`, en vez de decir siempre `"Error"`).

Al ser una clase normal de TypeScript, **se puede extender**. La sección
siguiente muestra la primera (y por ahora única) subclase del proyecto.

### Dónde se usa hoy

| Archivo | Función | Regla |
|---|---|---|
| [`alumno.service.ts`](../src/services/alumno.service.ts) | `sumarClasesPorReservar` | `cantidad < 0` — la lanza directo |
| [`alumno.service.ts`](../src/services/alumno.service.ts) | `restarClasesPorReservar` | `cantidad < 0` — la lanza directo |
| [`calendarioSemanal.service.ts`](../src/services/calendarioSemanal.service.ts) | `validarDia` | el día no está en `DIAS` — la lanza directo |
| [`auto.service.ts`](../src/services/auto.service.ts) | `crear`, `actualizar` | patente repetida — la lanza **indirecto**, vía `ErrorClaveDuplicada` (§4) |

### Cómo se lanza directo (patrón a copiar)

```ts
if (/* condición inválida */) {
  throw new ErrorDeNegocio('Mensaje que va a leer el cliente');
}
```

Nada más. No hace falta `try/catch` alrededor: el service la lanza y sigue
de largo (o directamente termina ahí, si el `throw` corta la función). Esto
alcanza siempre que la condición la evalúe el **propio service** (`cantidad
< 0`, un día que no existe...). El §4 muestra el otro caso: cuando el error
lo tira **Mongo/Mongoose**, y hay que traducirlo.

---

## 4. `ErrorClaveDuplicada`: cuando el error lo tira MongoDB, no el service

### Por qué es un caso distinto

`ErrorDeNegocio` sirve cuando el **service** evalúa una condición
(`cantidad < 0`) y decide cortar. Pero un índice `unique` violado (patente
repetida) no lo detecta el service: lo detecta **MongoDB**, al intentar
guardar. El error que llega no es prolijo — es un objeto con forma rara,
pensado para el driver, no para mostrárselo a un cliente HTTP:

```
MongoServerError: E11000 duplicate key error collection: test.autos
index: patente_1 dup key: { patente: "AB123CD" }
```

Y esa forma **varía según cómo esté definido el campo en el `Schema`**:

- **`unique: true`** a secas → MongoDB tira el error **crudo**: el propio
  `err` tiene `.code === 11000` y `.keyValue` (ej.
  `{ email: 'ana@mail.com' }`).
- **`unique: [true, 'mensaje']`** (así está `patente` en
  [`Auto.ts`](../src/models/Auto.ts)) → Mongoose lo **envuelve** en un
  `MongooseError` propio: `err.message` pasa a ser *ese* mensaje (el que
  escribió el `Schema`), y el error crudo —con `.code` y `.keyValue`— queda
  guardado en **`err.cause`** (la propiedad estándar de JS, desde
  `Error.cause`, para "encadenar" un error dentro de otro).

Ninguna de las dos formas es algo que el middleware central debería tener
que entender — MongoDB es un detalle del **service**, no de HTTP. Por eso la
traducción se hace ahí: el service atrapa el error crudo (sea cual sea su
forma) y lo relanza como un error de negocio prolijo.

### La clase

Completo, [`src/errors/errorClaveDuplicada.ts`](../src/errors/errorClaveDuplicada.ts):

```ts
import { ErrorDeNegocio } from './errorDeNegocio.js';

export class ErrorClaveDuplicada extends ErrorDeNegocio {
  constructor(message: string) {
    super(message, 409);
    this.name = 'ErrorClaveDuplicada';
  }
}

type ErrorMongoDuplicado = { code: 11000 };

function esErrorMongoDuplicado(x: unknown): x is ErrorMongoDuplicado {
  return typeof x === 'object' && x !== null && (x as { code?: unknown }).code === 11000;
}

export function comoErrorClaveDuplicada(err: unknown, mensajePorDefecto: string): unknown {
  if (err instanceof Error && esErrorMongoDuplicado(err.cause)) {
    return new ErrorClaveDuplicada(err.message);
  }

  if (esErrorMongoDuplicado(err)) {
    return new ErrorClaveDuplicada(mensajePorDefecto);
  }

  return err;
}
```

- **`extends ErrorDeNegocio`** — no una clase nueva desde cero: `status`
  queda **fijo en `409`** (`super(message, 409)`), porque el significado de
  "clave duplicada" nunca cambia. Y —esto es lo importante— como
  `ErrorClaveDuplicada` **es-un** `ErrorDeNegocio`, el chequeo
  `err instanceof ErrorDeNegocio` que el middleware ya tenía la reconoce
  **sin que el middleware sepa que esta clase existe**. No hay que agregar
  ningún chequeo nuevo en `errorHandler.middleware.ts`.
- **`esErrorMongoDuplicado`** — un `type guard`: ¿esta cosa (`unknown`)
  tiene `.code === 11000`? Es el único lugar que sabe leer esa propiedad.
- **`comoErrorClaveDuplicada(err, mensajePorDefecto)`** — la función que
  usa cada service. Devuelve:
  - un `ErrorClaveDuplicada` con el mensaje del `Schema`, si `err.cause`
    tiene forma de duplicado (caso envuelto);
  - un `ErrorClaveDuplicada` con `mensajePorDefecto`, si `err` mismo tiene
    forma de duplicado (caso crudo, `unique: true` a secas);
  - **`err` sin tocar**, si no es ninguno de los dos casos — para que el
    service lo relance tal cual (puede ser un bug real, y ahí no hay que
    interferir).

### Cómo se usa (patrón a copiar)

Real, [`auto.service.ts`](../src/services/auto.service.ts):

```ts
const MENSAJE_PATENTE_DUPLICADA = 'La patente ya está en uso';

export async function crear(datos: Auto): Promise<AutoDoc> {
  try {
    return await AutoModel.create(datos);
  } catch (err) {
    throw comoErrorClaveDuplicada(err, MENSAJE_PATENTE_DUPLICADA);
  }
}
```

- **Acá sí hay `try/catch` en un service** — es la excepción a "los services
  casi nunca tienen `try/catch`" de
  [guia-capa-service.md §9](guia-capa-service.md#9-reglas-de-negocio-throw-new-errordenegocio).
  No contradice la regla: esa regla habla de *lanzar* errores de negocio
  propios (no hace falta atrapar nada para eso). Acá el motivo es otro —
  **traducir** un error ajeno (el de Mongo) a uno propio. Es el patrón
  estándar "atrapar en el borde, traducir, relanzar".
- El `catch` **no analiza** el error: le pasa la decisión entera a
  `comoErrorClaveDuplicada`, y relanza lo que sea que devuelva
  (`ErrorClaveDuplicada`, o el `err` original si no era un duplicado).
- `MENSAJE_PATENTE_DUPLICADA` es el mensaje de **respaldo**: solo se usa si
  el `Schema` no definió el suyo. Como `Auto.ts` sí lo define
  (`unique: [true, '...']`), en la práctica hoy se usa siempre el del
  `Schema` — pero el respaldo deja el service listo para el día que ese
  campo pase a `unique: true` a secas, o para copiar el patrón en un
  service cuyo `Schema` no tenga mensaje propio (ej. `Alumno.email`).
- `actualizar` (que usa `findByIdAndUpdate`) sigue el mismo patrón: también
  puede chocar contra el índice si `cambios.patente` coincide con la de
  otro auto.

---

## 5. El middleware: mucho más chico gracias a lo anterior

Completo, [`src/middlewares/errorHandler.middleware.ts`](../src/middlewares/errorHandler.middleware.ts):

```ts
import type { ErrorRequestHandler } from 'express';
import mongoose from 'mongoose';
import { ErrorDeNegocio } from '../errors/errorDeNegocio.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof mongoose.Error.ValidationError) {
    const mensaje = Object.values(err.errors)
      .map((e) => e.message)
      .join('. ');
    return res.status(400).json({ mensaje });
  }

  if (err instanceof Error && err.name === 'CastError') {
    return res.status(400).json({ mensaje: 'Id inválido' });
  }

  if (err instanceof ErrorDeNegocio) {
    return res.status(err.status).json({ mensaje: err.message });
  }

  console.error(err);
  res.status(500).json({ mensaje: 'Error interno del servidor' });
};
```

Cuatro chequeos, todos con la misma forma (`if (...) return
res.status(...).json(...)`), y un 500 de respaldo al final. **Nada acá sabe
qué es un índice `unique` ni qué es MongoDB** — esa responsabilidad se
resolvió antes de llegar, en el service (§4). Es el mismo principio que
separa `routes`/`controllers`/`services`: cada capa traduce lo que
**a ella** le corresponde entender.

Punto por punto:

- **`ErrorRequestHandler`** (de `@types/express`) es el tipo de un middleware
  de errores. Obliga a la firma de **4 parámetros** `(err, req, res, next)`
  — la que hace que Express lo reconozca como manejador de errores en vez de
  middleware normal (ver [guia-middleware-handlers-y-routers.md §7](guia-middleware-handlers-y-routers.md#7-cómo-distingue-express-qué-es-cada-cosa-por-la-cantidad-de-parámetros)).
  `_req` y `_next` llevan guion bajo porque no se usan, pero **tienen que
  estar** igual.
- **Los `if` se prueban en orden y cada uno corta con `return`.** El primero
  que matchea responde y termina ahí. Por eso el orden no es casualidad:
  primero los errores *conocidos* de Mongoose (por `.name`), después
  cualquier error *nuestro* (`ErrorDeNegocio` y sus subclases, por
  `instanceof`), y lo que sobrevive a los tres es, por descarte, un bug.
- **`err instanceof mongoose.Error.ValidationError`** — a diferencia de la
  clave duplicada (§4), acá Mongoose sí exporta una clase concreta para
  `instanceof`, así que no hace falta chequear por nombre ni escribir un
  `type guard` a mano: TypeScript ya sabe, dentro del `if`, que `err.errors`
  existe. `err.errors` es un objeto con **una entrada por cada campo que
  falló** (`ValidatorError` para `required`/`enum`/`min`/`max`, `CastError`
  si el valor ni siquiera se pudo convertir al tipo del campo — ej. un
  `hora` no numérico), y cada una ya trae el mensaje que redactó el
  `Schema` en su propio `.message`. `Object.values(err.errors).map(e =>
  e.message).join('. ')` junta los mensajes de **todos** los campos que
  fallaron (no solo el primero) en un solo string — a diferencia de
  `err.message`, que es el resumen compuesto que arma Mongoose
  (`"Auto validation failed: cambios: ..."`), pensado para logs, no para
  mostrárselo a un cliente HTTP.
- **`err instanceof Error && err.name === 'CastError'`** — este sí se
  chequea por **nombre**, porque acá alcanza con un mensaje fijo
  (`'Id inválido'`); no hace falta leer nada del error en sí, así que no
  vale la pena importar `mongoose.Error.CastError` solo para el
  `instanceof`. `instanceof Error` primero es una guarda de tipos: sin
  ella, TypeScript no te deja leer `.name` sobre un `err` de tipo
  `any`/`unknown` con seguridad.
- **`err instanceof ErrorDeNegocio`** — un solo chequeo cubre `ErrorDeNegocio`
  **y todas sus subclases** (hoy, `ErrorClaveDuplicada`), porque `instanceof`
  en JS/TS reconoce toda la cadena de herencia. `err.status` ya viene
  tipado como `number` porque TypeScript conoce la clase.
- **El `console.error(err)` final** es a propósito: para los casos de arriba
  *no* se loguea (son errores esperados, forman parte del funcionamiento
  normal de la API). Para el resto —bugs— sí, porque es la única pista que
  vas a tener para diagnosticarlo.

---

## 6. Cómo llega el error hasta acá: el montaje en `app.ts`

Real, [`src/app.ts`](../src/app.ts):

```ts
import express from 'express';
import cors from 'cors';
import autosRoutes from './routes/auto.routes.js';
import { errorHandler } from './middlewares/errorHandler.middleware.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/autos', autosRoutes);

app.use((_req, res) => {
  res.status(404).json({ mensaje: 'Ruta no encontrada' });
});

app.use(errorHandler);

export default app;
```

El **orden** es la parte que hay que respetar (ver
[guia-middleware-handlers-y-routers.md §6](guia-middleware-handlers-y-routers.md#6-el-orden-importa-la-cinta-es-de-arriba-hacia-abajo)):

1. Middlewares globales (`cors`, `express.json`) — preparan **todos** los
   requests, tienen que ir primero.
2. Los routers de cada recurso.
3. El catch-all de 404 — si ningún router matcheó la URL.
4. **`errorHandler`, al final de todo.**

### Por qué el `errorHandler` tiene que ir último

Cada `app.use(...)` no "registra un evento": **agrega una capa a una lista
ordenada**. Un request no dispara la lista entera — la recorre **en orden,
de arriba hacia abajo**, y se detiene apenas alguna capa responde. Cuando
una capa **lanza** un error (`throw`, o en Express 5 una promesa
rechazada), Express no vuelve para atrás a buscar quién lo atrapa: sigue
recorriendo la lista **hacia adelante desde ahí**, pero saltándose todas
las capas normales (2 o 3 parámetros) hasta encontrar la primera de **4
parámetros** — el `errorHandler`.

De esa mecánica salen dos consecuencias concretas:

- **Si `errorHandler` se registrara *antes* que `autosRoutes`**, un error
  lanzado adentro de un controller de `autosRoutes` nunca lo encontraría:
  Express solo busca **hacia adelante** desde donde ocurrió el error, y
  `errorHandler` ya habría quedado **atrás**. El error terminaría en el
  manejador de errores *por defecto* de Express (una respuesta genérica,
  sin el `{ "mensaje": "..." }` prolijo que arma este proyecto) — o, en
  desarrollo, tirando el stack trace crudo al cliente.
- **Por eso también va después del catch-all de 404**: no porque el 404
  vaya a lanzar un error (no lanza — responde `res.status(404)...`
  directo), sino porque el orden `routers → 404 → errorHandler` refleja
  literalmente el orden en que un request los recorre: primero se intenta
  matchear una ruta real, si ninguna matcheó se avisa "no encontrado", y
  **cualquier error que haya ocurrido en el camino** —en los routers, o
  incluso en el propio catch-all si algún día hiciera algo más elaborado—
  cae en la red de seguridad final.

En síntesis: **el `errorHandler` solo puede atrapar errores de las capas
que están *antes* que él en la lista.** Por eso la regla no es "puede ir en
cualquier lado mientras exista", sino específicamente **al final de todo**.

---

## 7. Ejemplo completo: seguir un `POST` con patente duplicada

1. Cliente manda `POST /api/autos` con una `patente` que ya existe.
2. `autosRoutes` matchea `POST /` y llama a `autoController.crear`.
3. `crear` llama a `await autoService.crear(req.body)`.
4. `auto.service.ts` → `crear` llama a `AutoModel.create(datos)` **dentro de
   un `try`**. MongoDB rechaza por el índice `unique` de `patente`; como el
   `Schema` define `unique: [true, 'La patente ingresada ya está en uso']`,
   Mongoose envuelve el error crudo en un `MongooseError` con ese mensaje
   (el original —con `{ code: 11000, keyValue: { patente: 'AB123CD' } }`—
   queda en `err.cause`).
5. El `catch` de `crear` recibe ese error y hace
   `throw comoErrorClaveDuplicada(err, MENSAJE_PATENTE_DUPLICADA)`.
   `comoErrorClaveDuplicada` encuentra el 11000 en `err.cause`, así que
   devuelve `new ErrorClaveDuplicada('La patente ingresada ya está en uso')`
   — el mensaje del `Schema`, no el de respaldo.
6. Esa `ErrorClaveDuplicada` es lo que efectivamente sale de `crear` (la
   función `async` rechaza con ella). El controller no la atrapa.
7. Express 5 detecta el rechazo y llama a `errorHandler(err, req, res, next)`.
8. El middleware prueba los `if` en orden: no es `ValidationError`, no es
   `CastError`, **sí** es `instanceof ErrorDeNegocio` (porque
   `ErrorClaveDuplicada` lo extiende) → responde
   `409 { "mensaje": "La patente ingresada ya está en uso" }` usando
   `err.status` (409) y `err.message`, y corta ahí.
9. El cliente recibe el 409. El middleware nunca tuvo que saber qué es un
   índice `unique`.

---

## 8. Qué hacer al agregar un controller nuevo (Alumno, Profesor, Administrador)

Buenas noticias: **no hay que tocar el middleware para los casos ya
cubiertos.** Si el controller nuevo sigue el mismo patrón que
`auto.controller.ts` (sin `try/catch`, llama a un service, chequea `null`
para 404), todo lo que el service lance cae solo:

- `crear`/`actualizar` de Alumno lanzan `ValidationError` (falta `email`,
  etc.) → ya está cubierto.
- `sumarClasesPorReservar`/`restarClasesPorReservar` lanzan `ErrorDeNegocio`
  → ya está cubierto.
- Si `crear`/`actualizar` de Alumno pueden chocar contra el índice `unique`
  de `email` (seguro que sí), copiá el patrón del §4: `try/catch` +
  `comoErrorClaveDuplicada(err, 'El email ya está en uso')` — **sin tocar
  el middleware**.

Solo hace falta **agregar un chequeo nuevo al middleware** si:

- Se necesita un status que no venga ya envuelto en algún `ErrorDeNegocio`
  (ej. `401` para "no autenticado", cuando se sume `auth` — ahí sí, o se
  lanza `new ErrorDeNegocio('...', 401)` desde donde corresponda, o se
  agrega un chequeo propio si el error no lo genera el proyecto).
- Aparece un tipo de error de una librería nueva que no sea Mongoose/MongoDB
  y que no se pueda traducir en el service que lo genera.

Si una regla de negocio nueva necesita un status distinto de `400`, tampoco
hace falta tocar el middleware: se lo indica en el segundo argumento del
constructor —

```ts
throw new ErrorDeNegocio('Ese profesor ya tiene una clase en ese horario', 409);
```

(Y si esa regla en particular se repite mucho, es candidata a su propia
subclase, como `ErrorClaveDuplicada`.)

---

## 9. Glosario rápido

| Término | En una frase |
|---|---|
| **Middleware de errores central** | El único archivo (`errorHandler.middleware.ts`) que decide el status HTTP de un error. Se reconoce por sus 4 parámetros. |
| **`ErrorRequestHandler`** | Tipo de `@types/express` para un middleware de errores; obliga a la firma de 4 parámetros. |
| **Reenvío automático de Express 5** | Si un handler `async` lanza o su promesa rechaza, Express llama solo al middleware de errores (sin `next(err)` manual). Por eso no hay `try/catch` en los controllers. |
| **`ErrorDeNegocio`** | Clase propia (`src/errors/errorDeNegocio.ts`) que extiende `Error`, con un `status` (400 por defecto). La lanzan los services para una regla de negocio esperada, para distinguirla de un bug real. |
| **`ErrorClaveDuplicada`** | Subclase de `ErrorDeNegocio` (`src/errors/errorClaveDuplicada.ts`), `status` fijo en 409. La arma `comoErrorClaveDuplicada()` a partir del error crudo de MongoDB (código 11000); el service la lanza desde un `try/catch` alrededor de la operación que puede chocar contra un índice `unique`. |
| **`instanceof`** | Operador de JS/TS que chequea de qué clase es una instancia — reconoce también las subclases. Es cómo el middleware reconoce `ErrorDeNegocio` (y `ErrorClaveDuplicada`) entre todos los errores posibles. |
| **`ValidationError`** | Error de Mongoose por no cumplir el esquema (`required`, `enum`, `min`...). → 400, con los mensajes de `err.errors` (uno por campo) unidos, no el resumen compuesto de Mongoose. |
| **`CastError`** | Error de Mongoose al no poder convertir un valor (id mal formado). → 400 |
| **`11000`** | Código de error de MongoDB por violar un índice `unique`. Cada service lo traduce a `ErrorClaveDuplicada` antes de que llegue al middleware. → 409 |
| **`Error.cause`** | Propiedad estándar de JS para "encadenar" un error dentro de otro. Mongoose la usa cuando `unique: [true, 'mensaje']` envuelve el error crudo de MongoDB. |
| **Bug real** | Cualquier error que no sea ninguno de los anteriores. No se previó a propósito → 500 + `console.error`. |
| **`id` inexistente** | El único caso de "salió mal" que **no** pasa por el middleware: el service devuelve `null` y el controller responde 404 con un `if`. |
| **Atrapar en el borde, traducir, relanzar** | El patrón de `crear`/`actualizar` en `auto.service.ts`: `try/catch` alrededor de la llamada a Mongoose, no para manejar el error ahí, sino para convertirlo a un tipo propio antes de dejarlo seguir. |

---

## 10. Para seguir leyendo

- Express — Manejo de errores: <https://expressjs.com/en/guide/error-handling.html>
- Express 5 — Guía de migración (errores en handlers `async`): <https://expressjs.com/en/guide/migrating-5.html>
- Mongoose — Validación: <https://mongoosejs.com/docs/validation.html>
- MDN — `Error`, `class`, `extends`, `instanceof`: <https://developer.mozilla.org/es/docs/Web/JavaScript/Reference/Global_Objects/Error>
- MDN — `Error.cause`: <https://developer.mozilla.org/es/docs/Web/JavaScript/Reference/Global_Objects/Error/cause>
- MDN — Códigos de estado HTTP: <https://developer.mozilla.org/es/docs/Web/HTTP/Status>
- TypeScript Handbook — Parameter Properties (`public` en el constructor): <https://www.typescriptlang.org/docs/handbook/2/classes.html#parameter-properties>
