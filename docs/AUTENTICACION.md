# Autenticación en DriveAndLearn

Esta guía explica cómo configurar, ejecutar y estudiar el login del backend.
La autenticación confirma quién es el usuario; el token resultante permite
identificarlo en las rutas protegidas.

## 1. Preparar el proyecto

Desde la carpeta `INSPT-Prog3-DriveAndLearn-backend`:

1. Instalar dependencias con `npm install`.
2. Copiar `.env.example` como `.env`.
3. Configurar `MONGODB_URI` con la conexión a MongoDB.
4. Generar y pegar un secreto para `JWT_SECRET`:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
   ```

   La aplicación exige al menos 32 caracteres. No subir `.env` ni compartir el
   secreto: quien lo conozca podría firmar tokens válidos.

5. Iniciar el backend con `npm run dev`.

La configuración de entorno se centraliza en `src/config/env.ts`; al arrancar,
`src/server.ts` comprueba el secreto antes de aceptar pedidos. El ejemplo de
MongoDB usa una base local; para un servidor remoto se debe sustituir por su URI
real.

## 2. Crear una cuenta

El login no crea usuarios. El endpoint público de registro de alumnos es:

```http
POST /api/alumnos
Content-Type: application/json
```

```json
{
  "email": "ana@example.com",
  "password": "claveSegura123",
  "nomApe": "Ana Pérez"
}
```

Las contraseñas nuevas deben tener al menos 8 caracteres. El backend las guarda
con bcrypt, no en texto plano. La ruta de administración está protegida, por lo
que el alta inicial nunca se expone como registro público. Para crear el primer
administrador en una base vacía, ejecutá desde la raíz del backend:

```sh
npm run admin:bootstrap
```

El comando solicita email, nombre y contraseña (oculta mientras se escribe),
usa el servicio habitual para hashearla y crea la cuenta en la base configurada
en `.env`. Si ya existe un administrador, se detiene; las cuentas adicionales
se crean autenticándose y usando `POST /api/administradores`.

## 3. Iniciar sesión

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "email": "ANA@example.com",
  "password": "claveSegura123"
}
```

El email se recorta y se normaliza a minúsculas. Tanto alumnos como
administradores pueden autenticarse en el mismo endpoint. En caso de éxito la
respuesta es `200 OK`:

```json
{
  "token": "<JWT>",
  "usuario": {
    "id": "<id>",
    "email": "ana@example.com",
    "nomApe": "Ana Pérez",
    "role": "alumno"
  }
}
```

El objeto de respuesta no contiene la contraseña ni su hash. Las credenciales
incorrectas responden `401 Unauthorized` con un mensaje genérico, para no
indicar si el email existe. Si faltan email o contraseña, también se responde
401 con un mensaje que señala los campos requeridos.

Ejemplo con `curl`:

```sh
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"ana@example.com\",\"password\":\"claveSegura123\"}"
```

## 4. Usar el token

El servicio de autenticación firma un JWT con el algoritmo HS256. Incluye el ID
del usuario en `sub` y el rol (`alumno` o `administrador`); también establece
emisor, audiencia y vencimiento de una hora.

Para invocar una ruta protegida, enviar el token en el encabezado `Authorization`:

```http
GET /api/autos
Authorization: Bearer <JWT>
```

Ejemplo:

```sh
curl http://localhost:3000/api/autos \
  -H "Authorization: Bearer <JWT>"
```

`src/middlewares/auth.middleware.ts` comprueba la firma, el algoritmo, el
emisor, la audiencia y que el token no haya vencido. Si es válido, agrega el ID
y el rol a `req.auth`; si falta o no es válido, responde `401`. Las rutas
protegidas aplican este middleware antes de sus controladores.

El rol viaja dentro del token, pero autenticación y autorización son controles
distintos. Las rutas de gestión de usuarios combinan el middleware de
autenticación con reglas de administrador o de acceso al propio perfil. Para
ver esas reglas, los endpoints y ejemplos de uso, consultá
[gestión de usuarios](./gestion-usuarios.md).

## 5. Cerrar sesión y vencimiento

Los JWT de este proyecto son stateless: no se guarda una sesión en el servidor.
El token vence al cabo de una hora. No hay endpoint de logout ni refresh token;
para cerrar sesión, el cliente debe descartar el token. Un token ya emitido
seguirá siendo válido hasta su vencimiento, salvo que se agregue un mecanismo de
revocación.

En una aplicación web, evitar guardar tokens en lugares accesibles a
JavaScript si existe riesgo de XSS. Una alternativa habitual es una cookie
`HttpOnly`, `Secure` y con política `SameSite` adecuada, pero requiere adaptar
el flujo del backend y la estrategia de protección CSRF.

## 6. Recorrido del código

| Archivo | Responsabilidad |
| --- | --- |
| `src/routes/auth.routes.ts` | Expone `POST /login` bajo `/api/auth`. |
| `src/controllers/auth.controller.ts` | Toma email y contraseña de la petición y llama al servicio. |
| `src/services/auth.service.ts` | Valida los datos, busca las cuentas, compara bcrypt y firma el JWT. |
| `src/utils/password.ts` | Valida y hashea las contraseñas al crear o actualizar cuentas. |
| `src/config/env.ts` | Lee la configuración y valida `JWT_SECRET`. |
| `src/middlewares/auth.middleware.ts` | Verifica el Bearer token y establece `req.auth`. |
| `src/errors/errorAutenticacion.ts` | Representa rechazos de autenticación y traduce errores de JWT. |
| `src/middlewares/errorHandler.middleware.ts` | Convierte errores conocidos en respuestas HTTP. |
| `src/models/Alumno.ts` y `src/models/Administrador.ts` | Definen las cuentas y excluyen `password` de la serialización JSON. |

Express 5 reenvía automáticamente al middleware central los errores de
controladores asíncronos, por eso el controlador no necesita envolver la llamada
en un `try/catch`.

## 7. Probar el flujo

Ejecutar las pruebas de integración de autenticación:

```sh
npm run test:run -- tests/auth.http.test.ts
```

Estas pruebas verifican login de alumno y administrador, uso de un token en una
ruta protegida, rechazo de credenciales incorrectas, rechazo de tokens
inválidos y campos obligatorios.

Para compilar el backend:

```sh
npm run build
```
