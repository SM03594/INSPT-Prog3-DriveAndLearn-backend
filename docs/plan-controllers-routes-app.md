# Plan: controller + routes + app.ts para Auto (piloto de arquitectura)

> Este documento es el plan acordado para construir la primera capa HTTP
> (`controllers`/`routes`/`app.ts`) sobre los `models`/`services` ya
> existentes. A diferencia de las demás guías de `docs/`, que explican código
> **ya escrito**, este documento describe un plan **todavía no ejecutado** —
> sirve de referencia para esta etapa y de punto de partida para replicar el
> mismo patrón en Alumno, Profesor y Administrador.

## Contexto

`src/models/` y `src/services/` ya están completos para los 4 recursos, pero
todavía no existen `src/controllers/`, `src/routes/` ni `src/app.ts` — las
guías de `docs/` ya describen ese patrón como referencia, pero nunca se
escribió código real sobre él. El objetivo de esta etapa es construir el
recorrido HTTP completo (`routes → controller → service → model`) **solo para
Auto** (el recurso más simple: sin password, sin subdocumentos) para validar
que el patrón elegido funciona bien end-to-end antes de replicarlo en Alumno,
Profesor y Administrador.

Decisiones acordadas para esta etapa:

- **Orden**: vertical, un recurso completo (Auto) de punta a punta.
- **Errores**: middleware de errores centralizado (4 parámetros), aprovechando
  que Express 5 reenvía solo las excepciones de handlers `async` a
  `next(err)`. Los controllers no llevan `try/catch`.
- **Validación de body**: ninguna capa extra; se confía en los validadores del
  `Schema` de Mongoose (igual que documentan las guías).
- **Auth**: no se implementa todavía (etapa posterior).
- **Entry point**: separar `app.ts` (arma la app Express, no escucha) de
  `server.ts` (conecta la base y hace `listen`), y borrar `src/index.ts`
  (boilerplate viejo, no usado).
- **Testing**: manual por ahora (curl / cliente REST), sin `supertest`
  todavía — se agregará cuando se repita el patrón en más recursos.
- **MongoDB de desarrollo**: `mongod` local real (systemd, `127.0.0.1:27017`,
  sin auth) — la decisión sobre Docker/Atlas queda para cuando se defina el
  despliegue en el VPS.

## Archivos a crear

### 1. `.env` (raíz, ya está en `.gitignore` — no se commitea)

```
MONGODB_URI=mongodb://127.0.0.1:27017/driveandlearn
PORT=3000
```

### 2. `src/middlewares/manejarErrores.middleware.ts`

Middleware de errores (`ErrorRequestHandler`, 4 parámetros), tipado con
`import type { ErrorRequestHandler } from 'express'`, siguiendo el esqueleto
que ya deja `guia-middleware-handlers-y-routers.md` §3. Traduce según la tabla
de `guia-capa-service.md` §9:

- `err.name === 'ValidationError'` → 400, body `{ mensaje: err.message }`
- `err.name === 'CastError'` → 400, `{ mensaje: 'Id inválido' }`
- `(err as { code?: number }).code === 11000` → 409, `{ mensaje: 'Ya existe un registro con ese valor único (patente duplicada)' }`
- cualquier otro caso → `console.error(err)` + 500, `{ mensaje: 'Error interno del servidor' }`

Nota (no se resuelve ahora): `auto.service.ts` no hace ningún
`throw new Error(...)` de regla de negocio, así que este middleware no
necesita distinguir "error de negocio" de "bug real" todavía. Esa distinción
va a hacer falta cuando se arme el controller de Alumno
(`sumarClasesPorReservar`/`restarClasesPorReservar` lanzan `Error` a mano) —
queda anotado como pendiente para esa etapa, no se sobre-diseña acá.

### 3. `src/controllers/auto.controller.ts`

`import type { Request, Response } from 'express'` +
`import * as autoService from '../services/auto.service.js'`. Sin
`try/catch` (Express 5 reenvía las excepciones async al middleware de
errores). Funciones:

| Función | Llama a | Éxito | `null` del service |
|---|---|---|---|
| `listar` | `autoService.listar()` | `200` + array | (nunca) |
| `obtener` | `autoService.obtenerPorId(req.params.id)` | `200` + auto | `404` |
| `crear` | `autoService.crear(req.body)` | `201` + auto creado | (nunca; o lanza) |
| `actualizar` | `autoService.actualizar(req.params.id, req.body)` | `200` + auto actualizado | `404` |
| `cambiarActivo` | `autoService.cambiarEstado(req.params.id, req.body.activo)` | `200` + auto actualizado | `404` |

Cada función hace exactamente lo que describe `guia-middleware-handlers-y-routers.md`
§2: leer `req`, llamar **un** service, armar la respuesta (`return res.status(404).json(...)`
cuando el service devuelve `null`, para cortar ahí).

### 4. `src/routes/auto.routes.ts`

`Router()` de Express, mapeo idéntico a la tabla ya documentada en
`guia-middleware-handlers-y-routers.md` §4:

```
GET    /            -> auto.controller.listar
GET    /:id         -> auto.controller.obtener
POST   /            -> auto.controller.crear
PUT    /:id         -> auto.controller.actualizar
PATCH  /:id/activo  -> auto.controller.cambiarActivo
```

`export default router`.

### 5. `src/app.ts`

Arma la app Express (sin `listen`):

- `app.use(cors())`
- `app.use(express.json())`
- `app.use('/api/autos', autosRoutes)`
- catch-all 404 (`app.use((_req, res) => res.status(404).json({ mensaje: 'Ruta no encontrada' })))`) — **después** del router, **antes** del middleware de errores (orden que ya explica `guia-middleware-handlers-y-routers.md` §6)
- `app.use(manejarErrores)` al final
- `export default app`

### 6. `src/server.ts` (hoy vacío)

```ts
import app from './app.js';
import { connectDB } from './config/db.js';
import { PORT } from './config/env.js';

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor escuchando en el puerto ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('No se pudo conectar a MongoDB:', err);
    process.exit(1);
  });
```

(Reusa `connectDB`/`PORT` ya existentes en `src/config/db.ts` y
`src/config/env.ts`, sin tocarlos.)

## Archivos a borrar

- `src/index.ts` — boilerplate viejo ("Hello, TypeScript with Express!"), no
  se usa desde ningún script una vez que `server.ts` queda como entry point.

## Archivos a modificar

- `package.json`: `"main"` → `"dist/server.js"`, `"start"` → `"node dist/server.js"`.
  (`"dev"` ya apunta a `src/server.ts`, no cambia.)

## Verificación

1. `npm run typecheck` — debe pasar sin errores.
2. `npm run dev` — debe loguear `✅ Conectado a MongoDB` y
   `Servidor escuchando en el puerto 3000`.
3. Smoke test manual con `curl` contra `http://localhost:3000/api/autos`:
   - `POST` con body válido (`marca`, `modelo`, `patente`, `cambios`) → `201` + `_id`
   - `GET /api/autos` → `200` + array con el auto creado
   - `GET /api/autos/:id` (el id recién creado) → `200`
   - `GET /api/autos/000000000000000000000000` (bien formado, inexistente) → `404`
   - `GET /api/autos/abc` (id mal formado) → `400` (CastError)
   - `POST` sin `patente` → `400` (ValidationError)
   - `POST` repitiendo la misma `patente` → `409` (código 11000)
   - `PUT /api/autos/:id` cambiando `modelo` → `200` con el campo actualizado
   - `PATCH /api/autos/:id/activo` con `{ "activo": false }` → `200` con `activo: false`
4. Confirmar que `.env` no aparece en `git status` (ya cubierto por
   `.gitignore`, se verifica igual).

## Después de este piloto

Si Auto funciona bien end-to-end con este patrón, el mismo esquema
(`controller` sin `try/catch` + `routes` + middleware de errores compartido)
se replica para Profesor y Administrador sin cambios de diseño. Alumno es el
único que va a requerir revisar la nota de la sección 2 (distinguir errores de
regla de negocio de bugs reales en el middleware de errores), porque
`alumno.service.ts` sí lanza `Error` a mano en `sumarClasesPorReservar` /
`restarClasesPorReservar`.
