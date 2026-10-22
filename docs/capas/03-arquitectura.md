# Arquitectura: cómo se encadenan las capas

## Qué es esto, en una frase

El backend está dividido en **capas**, y cada una tiene un solo trabajo. Un
pedido HTTP las atraviesa en orden: **routes → middlewares → controller →
service → model → MongoDB**. La respuesta vuelve por el mismo camino, y si algo
falla, el error salta directo al `errorHandler`. Esta guía muestra ese
recorrido completo con un pedido real y explica cómo arranca el programa.

---

## El mapa

```
src/
├── server.ts        punto de entrada: conecta la base y abre el puerto
├── app.ts           arma la app Express: middlewares globales + routers
│
├── routes/          URL + verbo  →  qué middlewares y qué controller
├── middlewares/     filtros que corren antes del controller (auth, body)
│                    y el manejador central de errores
├── controllers/     traducen HTTP ↔ service (req → argumentos, resultado → res)
├── services/        reglas de negocio: qué se puede hacer y qué no
├── models/          esquemas de Mongoose: forma y validación de los datos
│
├── errors/          clases de error propias (cada una sabe su status HTTP)
├── utils/           funciones de apoyo (fechas, contraseñas, tipos)
├── config/          variables de entorno y conexión a MongoDB
├── types/           tipos compartidos (roles, ampliación de Request)
└── scripts/         tareas sueltas por consola (crear el primer admin)
```

Las seis primeras forman la **cadena del pedido**. Las demás son **de apoyo**:
cualquier capa las puede usar.

---

## La regla de dependencias

Cada capa importa solo a la que tiene **debajo**, nunca a la de arriba:

```
 routes ──────► middlewares ──► services (solo auth: ¿el admin existe?)
   │
   ▼
 controllers
   │
   ▼
 services ────► errors · utils · config · types
   │
   ▼
 models ──────► types
```

Algunas consecuencias que podés verificar en el código:

- Ningún service toca `req` ni `res`: no sabe que existe HTTP.
- Ningún controller importa un `Model`: siempre pasa por un service.
- `models/` no importa services ni controllers.

Esto permite testear un service con un objeto común (sin simular un pedido
HTTP) y cambiar una ruta sin tocar la lógica de negocio.

---

## El recorrido

### 0. El arranque: `npm run dev`

```
tsx src/server.ts
   │
   ├─ import app from './app.js'     ① se arma la app (todavía no escucha)
   │     └─ import env.js            dotenv carga el .env
   │
   ├─ obtenerJwtSecret()             ② sin JWT_SECRET válido → se corta acá
   │
   ├─ connectDB()                    ③ mongoose.connect(MONGODB_URI)
   │     ├─ falla → console.error + process.exit(1)
   │     └─ ok ▼
   │
   └─ app.listen(PORT)               ④ recién ahora acepta pedidos
```

(`src/server.ts:7-22`)

**¿Por qué `app.ts` y `server.ts` están separados?** `app.ts` arma la
aplicación pero **no abre ningún puerto**. Así los tests pueden importar `app`
y mandarle pedidos con supertest, usando su propia base en memoria, sin
levantar un servidor real ni conectarse a la base de verdad.

### 1. `app.ts`: la cadena global

Todo pedido pasa por estos `app.use`, **en este orden** (`src/app.ts:20-38`):

```
pedido
  │
  ├─ cors()                 agrega cabeceras CORS
  ├─ express.json()         body JSON → req.body
  ├─ /api/auth      → authRoutes
  ├─ /api/autos     → autosRoutes        ◄── nuestro ejemplo entra acá
  ├─ /api/alumnos   → alumnosRoutes
  ├─ ... (7 routers en total)
  ├─ 404 "Ruta no encontrada"            si ningún router respondió
  └─ errorHandler                        si alguien lanzó un error
```

Vamos a seguir este pedido de un administrador, que saca un auto de servicio:

```http
PATCH /api/autos/665f1c2a9b1e4a0012345678/activo
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{ "activo": false }
```

### 2. El router: ¿qué ruta es?

`app.use('/api/autos', autosRoutes)` **le quita** el prefijo `/api/autos` a la
URL y le pasa el resto al router: `/665f.../activo`. En
`src/routes/auto.routes.ts`:

```ts
router.use(requireAuthentication);                       // :17 → todas las rutas
// ...
router.patch('/:id/activo', requireAdministrator,        // :23
             validacionDeCuerpo, autoController.cambiarActivo);
```

`/:id/activo` coincide, y Express guarda `req.params.id = '665f...'`.

### 3. Los middlewares: los filtros

Antes de llegar al controller, el pedido pasa tres filtros. Si cualquiera de
ellos **lanza** un error, la cadena se corta y Express salta al `errorHandler`:

| # | Middleware | Qué comprueba | Si falla |
|---|---|---|---|
| 1 | `requireAuthentication` | El token es válido → carga `req.auth = { id, role }` | 401 |
| 2 | `requireAdministrator` | `role === 'administrador'` **y** que siga existiendo en la base | 403 |
| 3 | `validacionDeCuerpo` | Hay body y es un objeto JSON | 400 |

Cada middleware termina con `next()`, que significa "seguí con la próxima
función". Los middlewares se explican en detalle en
[`05-middlewares.md`](05-middlewares.md).

### 4. El controller: de HTTP a función

`src/controllers/auto.controller.ts:38`:

```ts
export async function cambiarActivo(req: Request<{ id: string }>, res: Response) {
  const auto = await autoService.cambiarEstado(req.params.id, req.body.activo);
  if (auto === null) {
    return res.status(404).json({ mensaje: 'Auto no encontrado' });
  }
  res.json(auto);
}
```

El controller **no decide nada del negocio**. Saca los datos de `req`, llama
al service con argumentos comunes (`string`, `unknown`) y convierte el
resultado en una respuesta HTTP. `null` se traduce en 404, y un auto en 200.

### 5. El service: las reglas

`src/services/auto.service.ts:64`:

```ts
export async function cambiarEstado(id: string, estadoNuevo: unknown): Promise<AutoDoc | null> {
  if (typeof estadoNuevo !== 'boolean') {
    throw new ErrorDeNegocio('activo debe ser un valor booleano');
  }
  return AutoModel.findByIdAndUpdate(id, { activo: estadoNuevo },
                                     { new: true, runValidators: true });
}
```

Acá se decide **qué es válido**. Si la regla no se cumple, el service lanza un
error **del dominio** (`ErrorDeNegocio`), no una respuesta HTTP: cómo se
convierte en 400 lo decide otra capa.

### 6. El model: la base

`AutoModel` (`src/models/Auto.ts:84`) envía el update a MongoDB.
`new: true` hace que devuelva el documento **ya actualizado**, y
`runValidators` corre las validaciones del esquema también en el update.
Cuando el controller hace `res.json(auto)`, el `toJSON` del esquema le saca
`__v` a la respuesta.

### 7. La vuelta

```
MongoDB ─► AutoDoc ─► service ─► controller ─► res.json(auto) ─► 200
                                                 { _id, patente, activo: false, ... }
```

---

## El camino del error

Así se comporta el mismo endpoint con distintos pedidos:

```
                                      quién lo detecta          respuesta
sin header Authorization ───────────► requireAuthentication ──► 401
token de alumno ─────────────────────► requireAdministrator ───► 403
sin body ────────────────────────────► validacionDeCuerpo ─────► 400
{ "activo": "si" } ──────────────────► service (ErrorDeNegocio) ► 400
id "abc" ────────────────────────────► Mongoose (CastError) ────► 400 "Id inválido"
id válido pero inexistente ──────────► controller (null) ───────► 404
PATCH /api/autoss/... ───────────────► ningún router ───────────► 404 "Ruta no encontrada"
```

Salvo los dos 404, que se responden directamente, **todos** los errores se
lanzan con `throw` y terminan en el mismo lugar:

```
cualquier capa ── throw ──► (Express 5 lo reenvía solo) ──► errorHandler
                                                             │
                     ¿qué clase de error es? ◄───────────────┘
                     ValidationError / CastError ........ 400
                     ErrorPeticionInvalida y subclases .. su status (400, 413...)
                     ErrorAutenticacion ................. 401
                     ErrorAutorizacion .................. 403
                     ErrorDeNegocio ..................... su status (400, 409...)
                     cualquier otro (un bug) ............ 500 + console.error
```

(`src/middlewares/errorHandler.middleware.ts:32-72`)

Gracias a esto, ninguna capa necesita saber **cómo** se responde un error:
solo lo lanza. Las clases de error se explican en [`09-errores.md`](09-errores.md).

---

## Qué sabe cada capa

| Capa | ¿Conoce `req`/`res`? | ¿Tiene reglas de negocio? | ¿Habla con MongoDB? |
|---|---|---|---|
| routes | Solo como "cadena de funciones" | No | No |
| middlewares | Sí | Solo permisos y forma del body | Solo `requireAdministrator`, a través de un service |
| controllers | **Sí** | No | No |
| services | No | **Sí** | Sí, a través de los models |
| models | No | Solo las validaciones del esquema | **Sí** |

Si te preguntás dónde va algo nuevo, esta tabla te lo responde:

- "Un alumno no puede reservar con menos de 24 h" es una regla → **service**.
- "Responder 201 al crear" es HTTP → **controller**.
- "La patente es obligatoria y única" es la forma del dato → **model**.
- "Esta ruta solo la usan administradores" es permiso → **routes + middleware**.

---

## Las carpetas de apoyo

| Carpeta | Contenido | La usan |
|---|---|---|
| `config/` | `env.ts` (variables de entorno) y `db.ts` (conexión) | server, services, middlewares, scripts |
| `errors/` | Clases como `ErrorDeNegocio` y `ErrorAutenticacion` | services, middlewares, errorHandler |
| `utils/` | `fechas`, `password`, `validacionTipos`, `cuerpoPeticion` | services, algunos controllers |
| `types/` | `Rol` y la ampliación `req.auth` | todas |
| `scripts/` | `bootstrapAdmin*.ts`: se ejecutan aparte con `npm run admin:*` | — (no forman parte del servidor) |

---

## Qué puede salir mal

| Síntoma | Causa |
|---|---|
| `req.body` es `undefined` en todos los pedidos | `express.json()` se montó **después** de los routers. |
| Los errores responden HTML en lugar de JSON | `errorHandler` no está al final o no tiene los **4** parámetros `(err, req, res, next)`. |
| Una ruta nueva responde sin pedir token | Se declaró **antes** de `router.use(requireAuthentication)`, o en `auth.routes.ts`, que no lo usa. Hay solo dos rutas públicas a propósito: `POST /api/auth/login` y `POST /api/alumnos` (el registro), que en `alumno.routes.ts:18` está antes del `router.use`. |
| Un controller se llena de `if` | Se metió lógica de negocio en el controller: pasala al service. |
| Un service importa `Request` de Express | Se está mezclando HTTP con negocio: el controller tiene que extraer los datos y pasarlos como argumentos. |

---

## Resumen

```
server.ts ─ connectDB ─ listen
   │
app.ts ─ cors ─ json ─ routers ─ 404 ─ errorHandler
                          │                ▲
                       routes              │ throw (desde cualquier capa)
                          │                │
                     middlewares ──────────┤
                          │                │
                     controller ───────────┤   req/res ↔ argumentos/resultado
                          │                │
                       service ────────────┤   reglas de negocio
                          │                │
                        model ─────────────┘   esquema + MongoDB
```

- Cada capa tiene **un** trabajo y solo importa a las de abajo.
- Los errores se **lanzan**, no se responden: el `errorHandler` los traduce
  a HTTP en un solo lugar.
- `app.ts` arma la aplicación y `server.ts` la pone a funcionar. Separarlos
  permite testear sin abrir un puerto.

**Siguiente lectura:** [`04-routes.md`](04-routes.md).
