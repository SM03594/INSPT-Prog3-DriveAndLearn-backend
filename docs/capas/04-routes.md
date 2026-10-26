# Routes: el mapa de la API

## Qué es esto, en una frase

Un archivo de `src/routes/` es un **mapa**: dice "para este verbo HTTP y esta
URL, pasá el pedido por estos middlewares y después por esta función del
controller". No contiene lógica: solo conecta piezas. Esta guía explica cómo se
arma ese mapa y lista todos los endpoints del proyecto.

---

## El mapa

Las rutas se arman en **dos niveles**:

```
app.ts                                    routes/auto.routes.ts
──────                                    ─────────────────────
app.use('/api/autos', autosRoutes) ──────► router.get('/',            ...)
         └─ prefijo ─┘                     router.get('/:id',         ...)
                                           router.post('/',           ...)
                                           router.put('/:id',         ...)
                                           router.patch('/:id/activo',...)
                                                    └─ resto de la URL ─┘

URL completa = prefijo (app.ts) + ruta (router)
PATCH /api/autos/665f.../activo  =  '/api/autos' + '/:id/activo'
```

Cada recurso (autos, alumnos, clases, …) tiene su propio archivo de rutas, y
`app.ts` monta cada uno bajo un prefijo. Así, ningún router necesita saber que
vive bajo `/api/...`.

---

## El recorrido

### 1. Crear el router y exportarlo

Todos los archivos tienen la misma forma (`src/routes/auto.routes.ts`):

```ts
import { Router } from 'express';
import * as autoController from '../controllers/auto.controller.js';
import { requireAuthentication, requireAdministrator } from '../middlewares/auth.middleware.js';
import { validacionDeCuerpo } from '../middlewares/validacionDeCuerpo.middleware.js';

const router = Router();
// ... rutas ...
export default router;
```

`Router()` crea una **mini‑aplicación**: tiene sus propios `get`, `post`,
`use`, etc., pero no escucha ningún puerto. Se exporta como `default` y
`app.ts` la monta con `app.use(prefijo, router)`.

`import * as autoController` junta todas las funciones exportadas del
controller en un objeto. Por eso después se escribe `autoController.crear`.

### 2. Anatomía de una línea de ruta

```ts
router.patch('/:id/activo', requireAdministrator, validacionDeCuerpo, autoController.cambiarActivo);
//     │       │            └──────────── cadena de funciones, en orden ────────────────┘
//     │       └─ path (relativo al prefijo)
//     └─ verbo HTTP
```

Después del path podés pasar **cuantas funciones quieras**. Express las ejecuta
en orden de izquierda a derecha, y cada una decide si sigue (`next()`), si
responde, o si lanza un error. La última es siempre el handler del controller,
que es el que responde.

### 3. Parámetros de ruta: `:id`

Un segmento que empieza con `:` es un **parámetro**: coincide con cualquier
valor y lo guarda en `req.params`.

```
ruta:  /:id/activo
URL:   /665f1c2a9b1e4a0012345678/activo
         └──────── req.params.id ──┘
```

El controller lo lee así: `req.params.id`. Algunos ejemplos del proyecto:
`/:id`, `/:id/activo`, `/:id/disponibilidad`, `/validar/:dia`.

Los segmentos sin `:` (`activo`, `validar`, `sumar-clases`) son **literales**:
tienen que coincidir exactamente.

### 4. `router.use(...)`: un middleware para todo lo que sigue

```ts
router.use(requireAuthentication);   // auto.routes.ts:17
```

`router.use` ejecuta el middleware para **todos** los pedidos que llegan al
router, pero solo para las rutas declaradas **después** de él. Ese detalle se
aprovecha en `src/routes/alumno.routes.ts`:

```ts
router.post('/', validacionDeCuerpo, alumnoController.crear);   // :18  ← público

router.use(requireAuthentication);                               // :20

router.get('/', requireAdministrator, alumnoController.listar);  // :22  ← con token
// ...
```

```
POST /api/alumnos   ──► coincide en :18 ──► se registra sin token
GET  /api/alumnos   ──► :18 no coincide (es POST) ──► :20 pide token ──► :22
```

El registro de un alumno nuevo **tiene** que ser público, porque todavía no
tiene cuenta para hacer login. Por eso está declarado antes del `router.use`.

### 5. El orden de la cadena importa

En todas las rutas con body, el orden es siempre el mismo:

```
autenticación ──► autorización ──► validacionDeCuerpo ──► controller
  (¿quién sos?)    (¿podés?)        (¿mandaste algo?)
     401              403                 400
```

Si `validacionDeCuerpo` fuera primero, un pedido **sin token y sin body**
respondería 400 en lugar de 401, y se le estaría dando información a alguien
que ni siquiera se identificó. Primero hay que saber quién es; recién después
importa qué mandó.

### 6. Middlewares que se llaman con `()`

Compará estas dos líneas:

```ts
router.get('/', requireAdministrator, ...);                                     // sin ()
router.put('/:id', requireSelfOrAdministrator(['email', 'password', 'nomApe']), ...); // con ()
```

`requireAdministrator` **es** un middleware. `requireSelfOrAdministrator` es
una **fábrica**: una función que, al llamarla, **devuelve** un middleware
configurado con los campos que el usuario puede editar sobre sí mismo. Por eso
lleva `()`, aunque no le pases nada (`requireSelfOrAdministrator()`). Cómo
funciona se explica en [`05-middlewares.md`](05-middlewares.md).

### 7. Convenciones de verbos

| Verbo | Uso en el proyecto | Ejemplo |
|---|---|---|
| `GET` | Leer (una lista o un elemento) | `GET /api/autos`, `GET /api/autos/:id` |
| `POST` | Crear | `POST /api/profesores` |
| `PUT` | Actualizar un recurso con los campos enviados | `PUT /api/alumnos/:id` |
| `PATCH` | Una **acción** puntual sobre un recurso | `PATCH /api/autos/:id/activo` |
| `DELETE` | Borrar | `DELETE /api/alumnos/:id`, `DELETE /api/clases/:id` |

Fijate en `PATCH /api/autos/:id/activo`: sacar un auto de servicio **no lo
borra**, sino que le cambia el campo `activo`. Por eso es una acción con
nombre propio y no un `DELETE`. Lo mismo pasa con `/sumar-clases` y
`/restar-clases`. Cancelar una clase, en cambio, **sí** la borra: por eso es
`DELETE /api/clases/:id`.

---

## Todos los endpoints

**Quién puede usarlos:** 🌐 cualquiera · 🔑 cualquier usuario con token ·
👤 el propio usuario o un admin · 🛡️ solo admin. **Body** indica que la ruta
pasa por `validacionDeCuerpo`.

| Método | Ruta | Quién | Body |
|---|---|---|---|
| **auth** | | | |
| POST | `/api/auth/login` | 🌐 | ✓ |
| **alumnos** | | | |
| POST | `/api/alumnos` | 🌐 | ✓ |
| GET | `/api/alumnos` | 🛡️ | |
| GET | `/api/alumnos/:id` | 👤 | |
| PUT | `/api/alumnos/:id` | 👤 (solo `email`, `password`, `nomApe`) | ✓ |
| DELETE | `/api/alumnos/:id` | 👤 | |
| PATCH | `/api/alumnos/:id/sumar-clases` | 🛡️ | ✓ |
| PATCH | `/api/alumnos/:id/restar-clases` | 🛡️ | ✓ |
| **administradores** | | | |
| GET | `/api/administradores` | 🛡️ | |
| GET | `/api/administradores/:id` | 👤 | |
| POST | `/api/administradores` | 🛡️ | ✓ |
| PUT | `/api/administradores/:id` | 👤 (solo `email`, `password`, `nomApe`) | ✓ |
| DELETE | `/api/administradores/:id` | 👤 | |
| **autos** | | | |
| GET | `/api/autos`, `/api/autos/:id` | 🔑 | |
| POST | `/api/autos` | 🛡️ | ✓ |
| PUT | `/api/autos/:id` | 🛡️ | ✓ |
| PATCH | `/api/autos/:id/activo` | 🛡️ | ✓ |
| **profesores** | | | |
| GET | `/api/profesores`, `/api/profesores/:id` | 🔑 | |
| POST | `/api/profesores` | 🛡️ | ✓ |
| PATCH | `/api/profesores/:id/nom-ape` | 🛡️ | ✓ |
| POST | `/api/profesores/:id/disponibilidad` | 🛡️ | ✓ |
| DELETE | `/api/profesores/:id/disponibilidad` | 🛡️ | ✓ |
| **clases** | | | |
| GET | `/api/clases` | 🔑 \* | |
| GET | `/api/clases/:id` | 👤 † | |
| POST | `/api/clases` | 🔑 \* | ✓ |
| PUT | `/api/clases/:id` | 👤 † | ✓ |
| DELETE | `/api/clases/:id` | 👤 † | |
| **horario-escuela** | | | |
| GET | `/api/horario-escuela` | 🔑 | |
| PUT | `/api/horario-escuela` | 🛡️ | ✓ |
| GET | `/api/horario-escuela/validar/:dia` | 🔑 | |
| POST | `/api/horario-escuela/agregar`, `/api/horario-escuela/quitar` | 🛡️ | ✓ |

\* En `GET /api/clases` y `POST /api/clases`, el router solo exige el token.
Lo demás lo decide el **service**, que recibe quién hace el pedido:
`clase.service.ts:181` (`listar`) filtra con `{ alumno: actor.id }` si el
usuario no es admin, y al reservar, un alumno solo puede hacerlo para sí
mismo. Se explica en [`../flujos/agendar-una-clase.md`](../flujos/agendar-una-clase.md).

† Las rutas con el `:id` de una clase pasan por
`requireAlumnoDeLaClaseOAdministrador`: el **alumno de la clase** o un admin.
La clase de otro alumno responde 403. Es el 👤 de los usuarios, pero
comparando contra el dueño de la clase y no contra el `:id`. Se explica en
[`../flujos/modificar-y-eliminar-una-clase.md`](../flujos/modificar-y-eliminar-una-clase.md).

Hasta octubre de 2026 existía también `/api/calendario-semanal`, un alias que
duplicaba `agregar`, `quitar` y `validar` del horario de la escuela. Se eliminó
junto con el renombre de `/api/horario` a `/api/horario-escuela`. La historia
completa está en
[`../temas/horarios-y-agendamiento.md`](../temas/horarios-y-agendamiento.md#parte-5-el-alias-apicalendario-semanal-y-cómo-se-resolvió).

`DELETE /api/profesores/:id/disponibilidad` es una de las pocas rutas `DELETE`
que **llevan body**: hay que indicar qué tramo de disponibilidad se quita.
Algunos clientes HTTP no envían body en un `DELETE` por defecto, así que
conviene tenerlo en cuenta al probarla.

---

## Qué puede salir mal

| Síntoma | Causa |
|---|---|
| Un router nuevo responde siempre 404 "Ruta no encontrada" | Falta montarlo en `app.ts` con `app.use('/api/...', router)`. |
| Una ruta queda pública sin querer | Se declaró **antes** de `router.use(requireAuthentication)`. |
| El pedido queda colgado, sin respuesta | Se escribió `requireSelfOrAdministrator` **sin** `()`: Express ejecuta la fábrica como si fuera el middleware, la fábrica devuelve una función y nunca llama a `next()`. `npm run typecheck` lo marca como error de tipos, pero `npm run dev` no. |
| Un pedido sin token responde 400 en lugar de 401 | `validacionDeCuerpo` está antes que los middlewares de auth. |
| `req.params.id` es `undefined` | El path no tiene `:id`, o el nombre del parámetro en el path no es el mismo que se lee en el controller. |
| Una ruta literal nunca se ejecuta | Hay otra ruta con parámetro declarada antes que la captura. Por ejemplo, si `GET /:id` se declarara antes que un `GET /activos`, la URL `/activos` coincidiría con `/:id` (`id = 'activos'`). Declará las rutas literales primero. |

---

## Resumen

- `app.ts` define el **prefijo**, y el router define el **resto** de la URL.
- Cada ruta es `verbo + path + cadena de funciones`, y el controller va al
  final de la cadena.
- `:algo` en el path es un parámetro y se lee con `req.params.algo`.
- `router.use(mw)` aplica el middleware a todas las rutas declaradas
  **después** de él.
- El orden de la cadena es: autenticación → autorización → body → controller.
- Los routers no tienen lógica: si te dan ganas de escribir un `if` en un
  archivo de rutas, ese código va en un middleware o en un service.

**Siguiente lectura:** [`05-middlewares.md`](05-middlewares.md).
