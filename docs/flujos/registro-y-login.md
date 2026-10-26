# Flujo: registrarse, iniciar sesión y usar el token

## Qué es esto, en una frase

Un alumno nuevo **se registra** (`POST /api/alumnos`), **inicia sesión**
(`POST /api/auth/login`) y recibe un **token**, que después manda en cada
pedido para demostrar quién es. Esta guía sigue esos tres momentos a través de
todas las capas, con las respuestas reales de la API.

> Todas las respuestas de esta guía son **reales**: se obtuvieron corriendo el
> flujo contra la API con una base en memoria.

---

## El mapa

```
Cliente                                   API                                        MongoDB
───────                                   ───                                        ───────
① REGISTRO
POST /api/alumnos ───────────────► routes ─ validacionDeCuerpo ─ controller ─ service ──► usuarios
{ email, password, nomApe }        (pública: sin token)       │ DTO:      │ saldo = 0     (password
                                                              │ campos    │ hash           hasheada)
◄──────────────────────────────── 201 { _id, email, nomApe, rol, clasesPorReservar: 0 }  (sin password)

② LOGIN
POST /api/auth/login ────────────► routes ─ validacionDeCuerpo ─ controller ─ auth.service
{ email, password }                                           │ DTO        │ busca por email ◄─ usuarios
                                                                     │ bcrypt.compare
                                                                     │ jwt.sign
◄──────────────────────────────── 200 { token, usuario: { id, email, nomApe, role } }

③ USAR EL TOKEN
GET /api/alumnos/:id ────────────► requireAuthentication ─ requireSelfOrAdministrator ─ controller ...
Authorization: Bearer <token>        │ jwt.verify → req.auth = { id, role }
◄──────────────────────────────── 200 { ...datos del alumno }
```

---

## El recorrido

### Parte 1: el registro

#### Paso 1. La ruta pública

`src/routes/alumno.routes.ts:18`:

```ts
router.post('/', validacionDeCuerpo, alumnoController.crear);

router.use(requireAuthentication);          // :20 → todo lo de abajo pide token
```

El registro está declarado **antes** de `router.use(requireAuthentication)`.
Es una de las dos rutas públicas de la API (la otra es el login): alguien que
todavía no tiene cuenta no puede tener token. Ver
[`../capas/04-routes.md`](../capas/04-routes.md#4-routeruse-un-middleware-para-todo-lo-que-sigue).

`validacionDeCuerpo` solo comprueba que haya un objeto JSON. Qué campos trae
lo decide el DTO, en el paso 2.

#### Paso 2. El controller arma el DTO

`src/controllers/alumno.controller.ts:37`:

```ts
export async function crear(req: Request, res: Response) {
  // El DTO valida la forma del body; el service fija el saldo inicial,
  // que no controla el cliente.
  const datosAlumno: CrearAlumnoDto = aCrearAlumnoDto(req.body);
  const alumno: AlumnoDoc = await alumnoService.crear(datosAlumno);

  res.status(201).json(alumno);
}
```

`aCrearAlumnoDto` (`src/dtos/alumno.dto.ts:50`) comprueba la **forma** del
body antes de que llegue al service:

```
body recibido
  │
  ├─ ¿es un objeto?                                  no → 400 "El cuerpo de la petición debe ser un objeto JSON"
  ├─ ¿trae SOLO email, password, nomApe?             no → 400 "No se pueden enviar estos campos: ..."
  ├─ ¿cada uno es texto?                             no → 400 "El email debe ser un texto"
  ├─ ¿están los tres?                                no → 400 "El nombre y apellido es obligatorio"
  ▼
CrearAlumnoDto { email, password, nomApe }
```

Si el body trae un campo de más, el registro **se rechaza** y no se ignora en
silencio. Así se ve un intento de cargarse clases gratis:

```http
POST /api/alumnos
{ "email": "b@x.com", "password": "claveSegura123", "nomApe": "B", "clasesPorReservar": 100 }
```
```
400 { "mensaje": "No se pueden enviar estos campos: clasesPorReservar (el saldo de clases se cambia con sumar-clases / restar-clases)" }
```

La parte entre paréntesis es la `ayudaPorCampo` del DTO: una pista para el
cliente sobre dónde se hace lo que intentó. Ver
[`../capas/06b-dtos.md`](../capas/06b-dtos.md).

#### Paso 3. El service fija lo que no decide el cliente

`src/services/alumno.service.ts:41`:

```ts
export async function crear(datos: CrearAlumnoDto): Promise<AlumnoDoc> {
  const datosAGuardar = await conPasswordHasheada({ ...datos, clasesPorReservar: 0 });
  ...
}
```

El service recibe un `CrearAlumnoDto` ya validado y aplica la **regla**: el
saldo inicial es 0, siempre. El DTO impide que el cliente lo mande, y el
service lo fija él mismo.

#### Paso 4. Hashear la contraseña

En la misma línea del paso 3, `conPasswordHasheada` (`src/utils/password.ts:27`) exige **al menos 8
caracteres** y reemplaza el texto por su hash bcrypt. Ver
[`../capas/10-utils-y-fechas.md`](../capas/10-utils-y-fechas.md#4-passwordts-hashear-antes-de-guardar).

#### Paso 5. Guardar: el model limpia y valida

```ts
return await AlumnoModel.create(datosAGuardar);   // dentro de un try/catch
```

`AlumnoModel` es un *discriminator* de `Usuario`, así que se guarda en la
colección `usuarios` con `rol: 'alumno'`. Antes de guardar, el esquema de
`Usuario` aplica `trim` y `lowercase` al email y **después** comprueba su
formato con un `match` (`algo@algo.algo`, sin espacios), y aplica `trim` al
nombre. Si el
email ya existe (en **cualquier** rol), MongoDB lo rechaza por el índice único
y el service lo traduce a un 409. Ver
[`../capas/08-models.md`](../capas/08-models.md#7-discriminators-alumnos-y-administradores-en-la-misma-colección).

#### Paso 6. La respuesta no incluye la contraseña

Se envió `"  Ana@Example.com "` y `"  Ana Pérez "`. Esto es lo que quedó en la
base:

```json
{ "_id": "6ada67d6...", "rol": "alumno", "email": "ana@example.com",
  "password": "$2b$10$vNP/u4wW6NGG...", "nomApe": "Ana Pérez",
  "clasesPorReservar": 0, "createdAt": "...", "updatedAt": "...", "__v": 0 }
```

Y esto es lo que recibió el cliente:

```
201 { "rol": "alumno", "email": "ana@example.com", "nomApe": "Ana Pérez",
      "_id": "6ada67d6...", "clasesPorReservar": 0, "createdAt": "...", "updatedAt": "..." }
```

El `toJSON.transform` del modelo `Usuario` quitó `password` y `__v`.

---

### Parte 2: el login

#### Paso 7. Ruta y controller

`src/routes/auth.routes.ts:7` → `src/controllers/auth.controller.ts:7`:

```ts
router.post('/login', validacionDeCuerpo, authController.login);

export async function login(req: Request, res: Response) {
  const credenciales: LoginDto = aLoginDto(req.body);
  const resultado: ResultadoAutenticacion = await authService.autenticar(credenciales);

  res.status(200).json(resultado);
}
```

`aLoginDto` (`src/dtos/auth.dto.ts:21`) exige `email` y `password`, los dos
como texto, y ningún otro campo. Si falta alguno o tiene otro tipo, responde
**400**: es un pedido mal armado, no un intento de entrar con credenciales
equivocadas.

#### Paso 8. `auth.service.autenticar`: comprobar las credenciales

`src/services/auth.service.ts:27`:

```
LoginDto { email, password }   (los dos ya son texto)
  │
  ├─ ¿alguno está vacío?                              sí → 400 "Email y contraseña son obligatorios"
  │
  ├─ usuarioService.obtenerPorEmail(email)            (usuario.service.ts:34)
  │     normaliza: trim + toLowerCase → "ANA@example.com" encuentra a "ana@example.com"
  │     busca en UsuarioModel → encuentra alumnos Y administradores
  │
  ├─ ¿no existe, o bcrypt.compare(password, hash) da false?
  │                                                   sí → 401 "Email o contraseña incorrectos"
  ▼
jwt.sign(...)
```

**Un solo mensaje para "no existe" y "contraseña incorrecta".** Si la API
dijera "ese email no está registrado", cualquiera podría averiguar qué emails
tienen cuenta. Por eso los dos casos responden **igual**:

```
email inexistente    → 401 { "mensaje": "Email o contraseña incorrectos" }
contraseña errónea   → 401 { "mensaje": "Email o contraseña incorrectos" }
```

Pero hay un detalle: cuando el email no existe, el service **no ejecuta**
`bcrypt.compare`, que es la parte lenta. Medido sobre 5 intentos de cada uno:
**~5 ms** con un email inexistente y **~68 ms** con una contraseña errónea.
Midiendo el tiempo de respuesta, igual se puede averiguar qué emails existen.
Está registrado como I-28 en [`../inconsistencias.md`](../inconsistencias.md).

`usuario.service` busca en el modelo **base** `UsuarioModel`, y por eso el
mismo login sirve para alumnos y para administradores. El rol se lee del
documento encontrado.

#### Paso 9. Firmar el token

`auth.service.ts:43`:

```ts
const token = jwt.sign({ role }, obtenerJwtSecret(), {
  algorithm: 'HS256',
  audience: 'driveandlearn-api',
  expiresIn: '1h',
  issuer: 'driveandlearn',
  subject: id,
});
```

Respuesta real:

```
200 {
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYWx1bW5vIiwi...0tvp6l_1JTSM6Mrh7E0mgEi5WFC8QDUFg-XQIsu6alg",
  "usuario": { "id": "6ada67d6...", "email": "ana@example.com", "nomApe": "Ana Pérez", "role": "alumno" }
}
```

#### Paso 10. Qué hay adentro del token

Un JWT son **tres partes** en base64url, separadas por puntos:

```
eyJhbGciOi...  .  eyJyb2xlIjoi...  .  0tvp6l_1JTSM...
   header             payload            firma
```

Decodificando las dos primeras partes de ese token:

```
header:  { "alg": "HS256", "typ": "JWT" }
payload: { "role": "alumno",
           "sub":  "6ada67d6a1255f5aab347d4b",     ← subject: el id del usuario
           "iat":  1792698326,                     ← emitido en (segundos desde 1970)
           "exp":  1792701926,                     ← vence en: iat + 3600 (1 hora)
           "aud":  "driveandlearn-api",            ← para quién es
           "iss":  "driveandlearn" }               ← quién lo emitió
```

La **firma** se calcula con el header, el payload y `JWT_SECRET`. Cualquiera
puede **leer** el payload (no está cifrado), pero nadie puede **modificarlo**
sin conocer el secreto: si cambia una letra, la firma deja de coincidir. Por
eso el token lleva solo el id y el rol, nunca datos sensibles.

---

### Parte 3: usar el token

#### Paso 11. Mandarlo en cada pedido

```http
GET /api/alumnos/6ada67d6a1255f5aab347d4b
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

`requireAuthentication` (`src/middlewares/auth.middleware.ts:116`) verifica
el token **con las mismas opciones con que se firmó** (algoritmo, audiencia,
emisor) y carga `req.auth = { id: payload.sub, role: payload.role }`. A partir
de ahí, los siguientes middlewares y el controller saben quién es. Se explica
paso a paso en
[`../capas/05-middlewares.md`](../capas/05-middlewares.md#3-requireauthentication-quién-sos).

| Pedido de Ana (alumna) | Respuesta |
|---|---|
| `GET /api/alumnos/<su id>` con token | **200** con sus datos |
| `GET /api/alumnos` (el listado) con token | **403** "Se requieren permisos de administrador" |
| `GET /api/alumnos/<su id>` **sin** token | **401** "Se requiere autenticación válida" |
| Token sin el prefijo `Bearer ` | **401** "Se requiere autenticación válida" |

#### Paso 12. ¿Y el logout?

**No hay endpoint de logout.** La API no guarda sesiones: todo lo que necesita
saber está dentro del token. "Cerrar sesión" consiste en que el **cliente**
borre el token. Pero un token copiado sigue siendo válido hasta que vence, en
1 hora como máximo.

Hay un caso que sí se controla: si se **borra** al usuario, su token deja de
servir para las rutas que comprueban que la cuenta siga existiendo
(`requireAdministrator`, y `validarActor` en las clases). El Teardown de
Postman lo comprueba: "El token del alumno borrado ya no sirve para ver
clases" → 403.

---

## Qué puede salir mal

| Pedido | Respuesta real |
|---|---|
| Registro con `clasesPorReservar` | 400 "No se pueden enviar estos campos: clasesPorReservar (el saldo de clases se cambia con sumar-clases / restar-clases)" |
| Registro con un email ya usado (por un alumno **o** un admin) | 409 "La direccion de email ya esta en uso." |
| Registro con una contraseña de menos de 8 caracteres | 400 "La contraseña debe tener al menos 8 caracteres" |
| Registro sin `nomApe` | 400 "El nombre y apellido es obligatorio" |
| Registro con `nomApe: 123` | 400 "El nombre y apellido debe ser un texto" |
| Registro con `nomApe: "   "` | 400 "El nombre y apellido es obligatorio" (el `trim` lo deja vacío y falla `required`) |
| Registro con un email sin formato (`"hola"`) | 400 "El email no tiene un formato válido" |
| Login con una contraseña errónea, o un email inexistente | 401 "Email o contraseña incorrectos" |
| Login sin `password` | 400 "La contraseña es obligatoria" |
| Login con `email: ""` | 400 "Email y contraseña son obligatorios" |
| Usar un token de hace más de 1 hora | 401 "Se requiere autenticación válida" |
| Usar un token firmado con otro `JWT_SECRET` (por ejemplo, de otro entorno) | 401 |

---

## Resumen

- **Registro:** ruta pública → el DTO acepta **solo** `email`, `password` y
  `nomApe` → el service fija el saldo en 0 → hashea la contraseña → el model normaliza
  y guarda en `usuarios` → la respuesta sale **sin** `password`.
- **Login:** el DTO exige email y contraseña (400 si faltan) → busca por email (en todos los roles) → `bcrypt.compare` → firma
  un JWT de 1 hora con `sub` = id y `role`. El error es el mismo para un email
  inexistente y para una contraseña errónea.
- **Token:** `Authorization: Bearer <token>`. `requireAuthentication` lo
  verifica y carga `req.auth`. Se puede leer, pero no modificar.
- No hay logout del lado del servidor: el token vale hasta que vence.

**Siguiente lectura:** [`agendar-una-clase.md`](agendar-una-clase.md).
