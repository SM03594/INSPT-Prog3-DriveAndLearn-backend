# Stack tecnológico y dependencias

## Qué es esto, en una frase

El backend de DriveAndLearn es una **API REST escrita en TypeScript**, que corre
sobre **Node.js**, atiende pedidos HTTP con **Express** y guarda los datos en
**MongoDB** a través de **Mongoose**. Esta guía recorre cada pieza del stack,
muestra dónde aparece en el código y explica por qué está ahí.

---

## El mapa

Cada tecnología tiene un lugar concreto en el camino que hace un pedido:

```
  Cliente (frontend, Postman, supertest)
     │  HTTP + JSON
     ▼
┌──────────────────────────────────────────────────────────────┐
│ Node.js  (ejecuta todo; ESM nativo)                          │
│                                                              │
│   dotenv ──► lee .env y lo vuelca en process.env             │
│                                                              │
│   Express 5 ─┬─ cors()          permite pedidos de otro origen│
│              ├─ express.json()  convierte el body en objeto  │
│              ├─ routers / middlewares / controllers          │
│              │      │                                        │
│              │      ├─ jsonwebtoken  firma y verifica tokens │
│              │      └─ bcrypt        hashea y compara claves │
│              │                                               │
│              └─ services ──► Mongoose ──► MongoDB            │
└──────────────────────────────────────────────────────────────┘

  En desarrollo, alrededor de todo esto:
    TypeScript (tipos) · tsx (ejecuta .ts) · Vitest + supertest +
    mongodb-memory-server (tests) · Postman (tests de punta a punta)
```

Las dependencias se dividen en dos grupos dentro de `package.json`:

| Grupo | Para qué | Ejemplos |
|---|---|---|
| `dependencies` | Las necesita la app **en producción**, cuando corre. | express, mongoose, bcrypt |
| `devDependencies` | Solo hacen falta **para desarrollar**: compilar, testear, tipar. | typescript, vitest, tsx, `@types/*` |

Al hacer `npm install --omit=dev` (por ejemplo en un servidor) solo se instalan
las del primer grupo.

---

## El recorrido

### 1. Node.js y ESM

Node.js es el programa que ejecuta JavaScript fuera del navegador. Este
proyecto usa **módulos ECMAScript (ESM)**, el sistema de `import`/`export`
estándar, en lugar del viejo `require()` de CommonJS. Eso se activa con una
línea de `package.json`:

```json
"type": "module",
```

La consecuencia más visible está en los imports relativos: **llevan extensión
`.js`, aunque el archivo fuente sea `.ts`** (`src/app.ts:11`):

```ts
import authRoutes from './routes/auth.routes.js';
```

Parece un error, pero no lo es. Node, en modo ESM, exige la extensión
exacta del archivo que va a cargar, y lo que carga en producción es el `.js`
compilado de `dist/`. TypeScript entiende esa convención y, al chequear tipos,
busca el `.ts` correspondiente. Lo vas a ver en detalle en
[`02-typescript-en-el-proyecto.md`](02-typescript-en-el-proyecto.md).

> Express 5 requiere Node 18 o superior. El proyecto no fija una versión con
> el campo `engines`, pero cualquier Node LTS actual sirve.

### 2. TypeScript y sus dos `tsconfig`

TypeScript agrega tipos a JavaScript. Los tipos se revisan **antes** de
ejecutar y después desaparecen: lo que corre siempre es JavaScript. El
proyecto tiene dos archivos de configuración con trabajos distintos:

```
tsconfig.json  ───────────  chequea tipos de src/ + tests/
   │                        "noEmit": true  → no genera archivos
   │                        lo usan el editor y `npm run typecheck`
   │ extends
   ▼
tsconfig.build.json  ─────  compila solo src/ → dist/
                            "noEmit": false, rootDir ./src, outDir ./dist
                            lo usa `npm run build`
```

¿Por qué separarlos? Los tests tienen que estar tipados (por eso
`tsconfig.json` incluye `tests/`), pero no deben terminar dentro de `dist/`,
que es lo que se despliega. `tsconfig.build.json` hereda todo con `extends` y
reemplaza `include` para quedarse solo con `src/`.

La opción más importante de `tsconfig.json` es `"strict": true`: activa todos
los chequeos estrictos, por ejemplo obliga a contemplar que un valor pueda ser
`undefined`.

### 3. Los scripts de `package.json`

Son atajos que se corren con `npm run <nombre>`:

| Script | Comando real | Cuándo usarlo |
|---|---|---|
| `dev` | `tsx watch src/server.ts` | Desarrollo diario. Ejecuta el `.ts` directo y reinicia al guardar. |
| `typecheck` | `tsc -p tsconfig.json` | Para ver todos los errores de tipos del proyecto, tests incluidos. |
| `build` | `tsc -p tsconfig.build.json` | Genera `dist/` con el JavaScript final. |
| `start` | `node dist/server.js` | Producción: corre lo que generó `build`. |
| `test` | `vitest` | Corre los tests en modo *watch* (se repiten al guardar). |
| `test:run` | `vitest --run` | Corre los tests una sola vez (útil en CI). |
| `admin:bootstrap` | `tsx src/scripts/bootstrapAdmin.ts` | Crea el primer administrador. |
| `admin:desde-env` | `tsx src/scripts/bootstrapAdminDesdeEnv.ts` | Igual que el anterior, pero toma los datos de `ADMIN_*` del `.env`. |

Fijate la diferencia entre `dev` y `start`. En desarrollo, **tsx** ejecuta
TypeScript al vuelo **sin chequear tipos**, para ser rápido. Por eso conviene
correr `typecheck` de vez en cuando: `dev` puede funcionar aunque haya errores
de tipos.

### 4. dotenv: la configuración sale del `.env`

Datos como la URI de la base o el secreto de los tokens no se escriben en el
código: viven en un archivo `.env` que **no se sube al repositorio** (está en
`.gitignore`). El repo trae `.env.example` como plantilla.

`dotenv` lee ese archivo y carga cada `CLAVE=valor` en `process.env`. Se
invoca una sola vez, al principio de `src/config/env.ts:15`:

```ts
import 'dotenv/config';
```

Después, `env.ts` expone las variables ya tipadas y con sus valores por
defecto, para que el resto del código nunca lea `process.env` directamente:

```ts
export const PORT: number = Number(process.env.PORT) || 3000;
export const MONGODB_URI: string = process.env.MONGODB_URI ?? '';
```

Las variables obligatorias se validan al arrancar. Por ejemplo,
`obtenerJwtSecret()` (`src/config/env.ts:38`) lanza un error si `JWT_SECRET`
tiene menos de 32 caracteres, y `server.ts:11` la llama antes de hacer
cualquier otra cosa. Es preferible que la app no arranque a que falle más
tarde, en el primer login.

### 5. Express 5: el servidor HTTP

Express recibe los pedidos HTTP y los hace pasar por una cadena de funciones
(middlewares y handlers). Todo se arma en `src/app.ts:20-38`:

```ts
const app = express();

app.use(cors());              // 1. cabeceras CORS
app.use(express.json());      // 2. body JSON → req.body

app.use('/api/auth', authRoutes);   // 3. routers por recurso
// ...
app.use((_req, res) => { ... 404 ... });  // 4. nada coincidió
app.use(errorHandler);                    // 5. manejo central de errores
```

El orden importa: Express prueba cada `app.use` de arriba hacia abajo. Cómo
funcionan los routers y los middlewares lo explican las guías
[`04-routes.md`](04-routes.md) y [`05-middlewares.md`](05-middlewares.md).

**Por qué importa que sea la versión 5.** En Express 4, si un handler `async`
lanzaba un error, había que atraparlo con `try/catch` y pasarlo a mano con
`next(error)`. Si no se hacía, la petición quedaba colgada. En Express 5 esto
es automático: el error llega solo al `errorHandler`. Por eso los controllers
del proyecto son tan cortos (`src/controllers/auto.controller.ts:25`):

```ts
export async function crear(req: Request, res: Response) {
  const auto = await autoService.crear(req.body);   // si lanza → errorHandler
  res.status(201).json(auto);
}
```

### 6. cors: permitir que el frontend llame a la API

Por seguridad, el navegador bloquea las peticiones desde una página web a un
servidor de **otro origen** (otro dominio o puerto), salvo que ese servidor lo
autorice explícitamente. El frontend de DriveAndLearn corre en otro origen, así
que la API necesita responder con las cabeceras CORS que lo autorizan.
`app.use(cors())` (`src/app.ts:22`) las agrega a todas las respuestas.

Sin opciones, `cors()` acepta **cualquier** origen. Es cómodo mientras se
desarrolla. En producción se le puede pasar `{ origin: 'https://...' }` para
aceptar solo el frontend propio.

> CORS es una regla **del navegador**. Postman, supertest o `curl` no la
> aplican, así que un error de CORS solo vas a verlo desde el frontend.

### 7. MongoDB + Mongoose: los datos

**MongoDB** es una base de datos de **documentos**: guarda objetos parecidos a
JSON dentro de *colecciones*, sin tablas fijas. **Mongoose** es un *ODM*
(Object Document Mapper): le agrega a MongoDB lo que no trae de fábrica, es
decir esquemas, validaciones, valores por defecto y tipos para TypeScript.

La conexión se abre una sola vez (`src/config/db.ts:36-41`):

```ts
mongoose.set('strictQuery', true);
await mongoose.connect(MONGODB_URI);
```

`server.ts` espera a que esa promesa termine **antes** de llamar a
`app.listen()`: no tiene sentido aceptar pedidos si la base no responde.

Cada colección se describe con un `Schema`. Por ejemplo, en
`src/models/Auto.ts`:

```ts
patente: {
  type: String,
  required: [true, 'La patente es obligatoria'],
  trim: true,
  uppercase: true,
  unique: [true, 'La patente ingresada ya está en uso'],
},
```

Con eso, Mongoose limpia los espacios, pasa la patente a mayúsculas y rechaza
el documento si falta, sin que el service tenga que hacerlo a mano. Los modelos
se explican en [`08-models.md`](08-models.md).

### 8. bcrypt: contraseñas que no se pueden leer

Las contraseñas **nunca** se guardan tal como las escribe el usuario. `bcrypt`
calcula un *hash*: un valor del que no se puede recuperar la contraseña
original. Además, cada hash lleva una *sal* aleatoria, así que dos usuarios con
la misma clave tienen hashes distintos.

Se usa en dos momentos:

```
 alta / cambio de clave                     login
 ──────────────────────                     ─────
 "claveSegura123"                           "claveSegura123"  +  hash guardado
        │ bcrypt.hash(clave, 10)                    │ bcrypt.compare(...)
        ▼                                           ▼
 "$2b$10$Xk...e9" → se guarda en Mongo          true / false
 src/utils/password.ts:42                   src/services/auth.service.ts:37
```

El `10` son las *rondas de costo*: cuanto más alto, más lento es calcular el
hash. Eso no se nota en un login, pero hace muy caro probar millones de
contraseñas por fuerza bruta.

`bcrypt` es un **módulo nativo** (tiene código en C++). Si alguna vez `npm
install` falla al instalarlo, casi siempre es un problema de compilación del
sistema y no del proyecto.

### 9. jsonwebtoken: quién sos en cada pedido

La API no guarda sesiones. Cuando alguien hace login, recibe un **JWT** (JSON
Web Token): un texto firmado con `JWT_SECRET` que dice quién es el usuario y
qué rol tiene. En cada pedido siguiente, el cliente lo envía en la cabecera
`Authorization: Bearer <token>`.

```
 login OK ──► jwt.sign({ role }, secreto, { subject: id, expiresIn: '1h', ... })
              src/services/auth.service.ts:43
                     │
                     ▼  el cliente guarda el token
 pedido   ──► Authorization: Bearer eyJhbGciOi...
                     │
                     ▼
              jwt.verify(token, secreto, { algorithms: ['HS256'], ... })
              src/middlewares/auth.middleware.ts:48
                     │
          firma válida y no vencido? ── no ──► 401
                     │ sí
                     ▼
              req.auth = { id, role } → sigue al controller
```

La firma garantiza que nadie modificó el token, pero **el contenido no está
cifrado**: cualquiera puede leerlo. Por eso solo lleva el id y el rol, nunca
datos sensibles. El flujo completo está en
[`../flujos/registro-y-login.md`](../flujos/registro-y-login.md).

### 10. Las dependencias de desarrollo

| Paquete | Qué hace en este proyecto |
|---|---|
| `typescript` | Aporta el compilador `tsc` (scripts `build` y `typecheck`). |
| `tsx` | Ejecuta archivos `.ts` sin compilarlos antes (scripts `dev` y `admin:*`). |
| `@types/express`, `@types/node`, ... | Tipos de librerías escritas en JS. No contienen código que se ejecute: solo le dicen a TypeScript qué forma tiene cada función. |
| `vitest` | Framework de tests: `describe`, `it`, `expect`. Se configura en `vitest.config.ts`. |
| `@vitest/coverage-v8` | Mide qué líneas del código ejecutaron los tests (`npx vitest --coverage`). |
| `@vitest/ui` | Interfaz web para ver y relanzar tests (`npx vitest --ui`). |
| `supertest` | Hace pedidos HTTP a `app` **sin levantar un puerto real**. Por eso `app.ts` está separado de `server.ts`. |
| `mongodb-memory-server` | Levanta un MongoDB temporal en memoria para cada archivo de test, así los tests no tocan la base real. |

Así se combinan los tres paquetes de testing en un test HTTP
(`tests/alumnos.http.test.ts` y `tests/setupTestDB.ts`):

```ts
setupTestDB();   // beforeAll: MongoMemoryServer.create() + mongoose.connect()

const login = await request(app)              // supertest
  .post('/api/auth/login')
  .send({ email: 'admin@example.com', password: 'claveAdmin123' });
```

En `package.json` vas a ver además este bloque:

```json
"allowScripts": { "mongodb-memory-server@11.2.0": true }
```

Autoriza a `mongodb-memory-server` a ejecutar su script de instalación, que es
el que descarga el binario de MongoDB que usan los tests.

**Postman** no es una dependencia de npm, sino una aplicación aparte. La
colección `postman/` prueba la API levantada de verdad, como lo haría el
frontend. Se explica en [`12-tests-postman.md`](12-tests-postman.md), y Vitest
en [`11-tests-vitest.md`](11-tests-vitest.md).

### 11. Las versiones: `^` y `package-lock.json`

En `package.json` las versiones aparecen como `"express": "^5.2.1"`. El `^`
significa "cualquier 5.x.x igual o mayor a 5.2.1, pero no la 6". Así se
aceptan arreglos y mejoras compatibles, pero no cambios que rompan.

`package-lock.json` registra la versión **exacta** que se instaló de cada
paquete, incluidas las dependencias de las dependencias. Se sube al
repositorio para que todo el equipo instale exactamente lo mismo. Usá
`npm ci` cuando quieras instalar respetando el lock al pie de la letra.

---

## Qué puede salir mal

| Síntoma | Causa probable |
|---|---|
| `JWT_SECRET debe estar configurado con al menos 32 caracteres` al arrancar | Falta `JWT_SECRET` en `.env` o es muy corto. `.env.example` explica cómo generarlo. |
| `No se pudo conectar a MongoDB` | `MONGODB_URI` está mal o el servidor de Mongo no está corriendo. |
| `ERR_MODULE_NOT_FOUND` al importar un archivo propio | Al import relativo le falta la extensión `.js`. |
| `npm run dev` funciona pero `npm run build` falla | tsx no chequea tipos y `tsc` sí. Corré `npm run typecheck`. |
| El primer `npm test` tarda mucho | `mongodb-memory-server` está descargando el binario de Mongo. Solo pasa la primera vez (por eso hay un timeout de 60 s en `setupTestDB.ts`). |
| Desde el frontend: *blocked by CORS policy* | El pedido no está pasando por `cors()`, o se configuró un `origin` que no coincide con el del frontend. |

---

## Resumen

| Pieza | Rol en una línea | Dónde mirar |
|---|---|---|
| Node.js (ESM) | Ejecuta todo; imports con `.js` | `package.json` → `"type"` |
| TypeScript | Tipos que se chequean antes de ejecutar | `tsconfig.json`, `tsconfig.build.json` |
| tsx | Corre `.ts` directo en desarrollo | scripts `dev`, `admin:*` |
| dotenv | `.env` → `process.env` | `src/config/env.ts` |
| Express 5 | Recibe pedidos HTTP y arma la cadena de middlewares; reenvía solo los errores async | `src/app.ts` |
| cors | Habilita pedidos del frontend | `src/app.ts:22` |
| Mongoose / MongoDB | Esquemas, validación y persistencia | `src/config/db.ts`, `src/models/` |
| bcrypt | Hash y comparación de contraseñas | `src/utils/password.ts`, `auth.service.ts` |
| jsonwebtoken | Firma y verifica el token de sesión | `auth.service.ts`, `auth.middleware.ts` |
| Vitest + supertest + mongodb-memory-server | Tests automáticos con base temporal | `tests/`, `vitest.config.ts` |
| Postman | Tests de punta a punta contra la API levantada | `postman/` |

**Siguiente lectura:** [`02-typescript-en-el-proyecto.md`](02-typescript-en-el-proyecto.md).
