# Guía de Middlewares (DriveAndLearn Backend)

Esta guía documenta la capa **Middlewares** dentro de la arquitectura de **DriveAndLearn**, sus principios de diseño, el flujo de intercepción de peticiones HTTP, el detalle técnico de cada middleware implementado y sus funciones auxiliares en `src/middlewares/helpers/`.

---

## 1. Principios de Diseño de la Capa Middleware

1. **Responsabilidad Única (SRP):** Cada middleware atiende un único aspecto transversal del ciclo de vida de la petición: verificación de identidad (autenticación), control de permisos (autorización), saneamiento sintáctico (`validarObjetoJson`) o traducción uniforme de excepciones (`errorHandler`).
2. **Propagación Asíncrona en Express 5:** Los middlewares definidos como `async` propagan automáticamente cualquier excepción o promesa rechazada hacia el manejador central de errores sin necesidad de capturarlas manualmente con bloques `try/catch` ni llamar a `next(error)`.
3. **Inyección Limpia en `req`:** La información contextual validada se adosa de forma explícita al objeto `req` (`req.usuario`, `req.user`, `req.token`) para que las capas posteriores (controladores y servicios) puedan consumirla de inmediato.
4. **Subcarpeta de Helpers Exclusivos (`src/middlewares/helpers/`):** Toda función auxiliar que asista a los middlewares reside en su propia subcarpeta (`verSiErrorLecturaCuerpo.js`, `formatearErrorClaveDuplicada.js`) evitando contaminar otras capas de la aplicación.

---

## 2. Middlewares Implementados

### 2.1. `authMiddleware.js`

Módulo central para la seguridad, autenticación y autorización en los endpoints protegidos de la API (`src/middlewares/authMiddleware.js`).

#### Funciones Exportadas:

### `autenticar(req, _res, next)`

- **Propósito:** Validar la presencia, autenticidad y vigencia del token JWT enviado por el cliente, comprobando además que no haya sido revocado previamente mediante el cierre de sesión (`logout`).
- **Parámetros:**
  - `req`: Objeto de petición HTTP de Express. Lee la cabecera `req.headers.authorization`.
  - `_res`: No se utiliza (se prefija con `_` según la convención del proyecto).
  - `next`: Función para continuar la cadena de ejecución.
- **Flujo de Ejecución:**
  1. **Lectura del Header:** Extrae la cabecera `Authorization`. Verifica que exista y comience con el prefijo `Bearer `. Si falta o no cumple el esquema, arroja `ErrorAutenticacion('Token no provisto o formato inválido')` (**`401 Unauthorized`**).
  2. **Extracción del Token:** Obtiene la cadena pura del JWT mediante `cabeceraAutorizacion.slice(7).trim()`. Si resulta una cadena vacía, arroja `ErrorAutenticacion('Token no provisto')` (**`401`**).
  3. **Verificación en Lista Negra:** Consulta en MongoDB si el token figura en la colección `tokens_revocados` mediante `TokenRevocado.exists({ token })`. Si el token ya fue revocado, arroja `ErrorAutenticacion('Token inválido o sesión cerrada')` (**`401`**).
  4. **Verificación Criptográfica y Expiración:** Invoca a la función auxiliar `validarJWT(token)`:
     - Ejecuta `jwt.verify(token, obtenerJwtSecret())`.
     - Si la firma no coincide o es inválida, arroja `ErrorAutenticacion('Token inválido')` (**`401`**).
     - Si el token expiró, captura `TokenExpiredError` y arroja `ErrorAutenticacion('Token expirado')` (**`401`**).
  5. **Inyección en la Petición:**
     - `req.usuario`: Payload decodificado del JWT (`id`, `email`, `rol`, `NomApe`).
     - `req.user`: Alias de conveniencia con librerías estándar.
     - `req.token`: Cadena del token original en texto plano (necesaria para `POST /api/auth/logout`).
  6. **Continuación:** Invoca `next()`.

---

### `verificarSiAdmin(req, res, next)`

- **Propósito:** Restringir el acceso exclusivamente a usuarios autenticados con rol de administrador (`ROLES.ADMINISTRADOR`).
- **Implementación:**
  ```javascript
  export function verificarSiAdmin(req, res, next) {
    return autorizarRol(ROLES.ADMINISTRADOR)(req, res, next);
  }
  ```
- **Flujo de Ejecución:**
  1. Delega en la fábrica interna `autorizarRol(ROLES.ADMINISTRADOR)`.
  2. Verifica que `req.usuario` esté presente (la ruta debió encadenar antes `autenticar`). Si falta, arroja `ErrorAutenticacion('No autenticado')` (**`401`**).
  3. Comprueba que `req.usuario.rol === ROLES.ADMINISTRADOR`. Si no coincide, arroja `ErrorAutorizacion('No tiene permisos para acceder a este recurso')` (**`403 Forbidden`**).
  4. Si cumple la condición, invoca `next()`.

---

### `verificarSiAdminOPropioUsuario(req, _res, next)`

- **Propósito:** Proteger endpoints de acceso individual (ej. `GET /api/alumnos/:id` y `PUT /api/alumnos/:id`), permitiendo la operación si el usuario es administrador **o** si es el propio alumno titular del recurso.
- **Implementación:**
  ```javascript
  export function verificarSiAdminOPropioUsuario(req, _res, next) {
    if (!req.usuario) {
      throw new ErrorAutenticacion('No autenticado');
    }

    const esAdmin = req.usuario.rol === ROLES.ADMINISTRADOR;
    const esPropioUsuario =
      req.params.id !== undefined &&
      req.usuario.id?.toString() === req.params.id.toString();

    if (!esAdmin && !esPropioUsuario) {
      throw new ErrorAutorizacion('No tiene permisos para acceder a este recurso');
    }

    next();
  }
  ```
- **Flujo de Ejecución:**
  1. Verifica que la solicitud esté autenticada (`req.usuario`). Si no, arroja `ErrorAutenticacion('No autenticado')` (**`401`**).
  2. Evalúa si `req.usuario.rol === ROLES.ADMINISTRADOR`.
  3. Evalúa si el parámetro de ruta `req.params.id` coincide con el identificador del usuario autenticado (`req.usuario.id.toString()`).
  4. Si ambas condiciones son falsas, corta el acceso arrojando `ErrorAutorizacion('No tiene permisos para acceder a este recurso')` (**`403 Forbidden`**).
  5. Si alguna condición es verdadera, invoca `next()`.

---

#### Funciones Auxiliares Privadas de `authMiddleware.js`:

- **`validarJWT(token)`**: Envuelve `jwt.verify` capturando `TokenExpiredError` para arrojar `ErrorAutenticacion('Token expirado')` y cualquier otro fallo criptográfico como `ErrorAutenticacion('Token inválido')`.
- **`autorizarRol(...rolesPermitidos)`**: Fábrica de orden superior que comprueba que `req.usuario` exista y que `rolesPermitidos.includes(req.usuario.rol)`. Si no cumple, lanza `ErrorAutorizacion` (**`403`**).

---

### 2.2. `validarObjetoJson.js`

- **Archivo:** `src/middlewares/validarObjetoJson.js`
- **Propósito:** Garantizar que el cuerpo de la solicitud (`req.body`) sea un objeto JSON plano antes de transferir el control hacia los DTOs y controladores.
- **Implementación:**
  ```javascript
  export function validarObjetoJson(req, _res, next) {
    const esObjetoPlano =
      typeof req.body === 'object' &&
      req.body !== null &&
      !Array.isArray(req.body);

    if (!esObjetoPlano) {
      throw new ErrorPeticionInvalida(
        'El cuerpo de la solicitud debe ser un objeto JSON plano'
      );
    }

    next();
  }
  ```
- **Manejo de Errores:** Rechaza arreglos literales `[...]`, primitivos (`string`, `number`, `boolean`) y `null`, respondiendo inmediatamente **`400 Bad Request`**.

---

### 2.3. `errorHandler.js`

- **Archivo:** `src/middlewares/errorHandler.js`
- **Propósito:** Middleware central de captura y formateo uniforme de excepciones para toda la aplicación Express.
- **Formato Canónico de Salida:**
  ```json
  { "mensaje": "Descripción legible del error" }
  ```
- **Flujo de Intercepción y Traducción:**
  1. **Detección de Error de Parseo de Body:** Pasa el error por `verSiErrorLecturaCuerpo(errOriginal)`. Si `express.json()` falló al decodificar un JSON malformado, lo traduce a `ErrorLecturaCuerpo` (`400 Bad Request`).
  2. **Errores de Validación de Mongoose (`mongoose.Error.ValidationError`):** Responde código **`400 Bad Request`** con los mensajes de cada campo concatenados con `". "`.
  3. **Conversión Inválida de Mongoose (`CastError`):** Responde código **`400 Bad Request`** con `{ "mensaje": "Id inválido" }`.
  4. **Violación de Índice Único de MongoDB (código `11000`):** Responde código **`400 Bad Request`** formateando el mensaje con `formatearMensajeClaveDuplicada(err)` (ej. `"email ya se encuentra registrado"` o `"patente ya se encuentra registrado"`).
  5. **Errores de Dominio y Jerarquía de la Aplicación:**
     - Si es instancia de `ErrorPeticionInvalida` (o sus subclases `ErrorCampoInvalido`, `ErrorDeTipo`, `ErrorMongooseObjIdInvalido`, `ErrorFormatoDeFecha`, `ErrorLecturaCuerpo`): responde con su `err.statusCode` (**`400`**) y su mensaje.
     - Si es instancia de `ErrorAutenticacion`: responde status **`401`** y su mensaje.
     - Si es instancia de `ErrorAutorizacion`: responde status **`403`** y su mensaje.
     - Si es instancia de `ErrorDeNegocio`: responde con su `err.statusCode`. Esto incluye violaciones de negocio generales (**`400`** como `ErrorPasswordInvalida`, `ErrorSaldoClasesInsuficiente`) y recursos no encontrados (**`404`** como `ErrorRegistroInexistente`).
  6. **Errores Imprevistos (Bug o Caída):** Registra el error por consola (`console.error(err)`) y responde genéricamente **`500 Internal Server Error`** con `{ "mensaje": "Error interno del servidor" }` sin filtrar trazas ni datos sensibles.

---

## 3. Helpers Exclusivos de Middlewares (`src/middlewares/helpers/`)

### 3.1. `verSiErrorLecturaCuerpo.js`

- **Propósito:** Interceptar errores técnicos lanzados por el middleware nativo `express.json()` cuando la carga útil recibida no cumple con la sintaxis JSON válida.
- **Implementación:**
  ```javascript
  export function verSiErrorLecturaCuerpo(err) {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return new ErrorLecturaCuerpo();
    }
    return err;
  }
  ```
- **Resultado:** Convierte la sintaxis inválida en una instancia controlada de `ErrorLecturaCuerpo` (subclase de `ErrorPeticionInvalida`, status `400`).

---

### 3.2. `formatearErrorClaveDuplicada.js`

- **Propósito:** Analizar el objeto de error con código `11000` emitido por el motor de MongoDB ante conflictos de unicidad y generar un mensaje legible para el cliente en español.
- **Implementación:**
  ```javascript
  export function formatearMensajeClaveDuplicada(err) {
    const campoDuplicado = err?.keyValue
      ? Object.keys(err.keyValue)[0]
      : err?.keyPattern
      ? Object.keys(err.keyPattern)[0]
      : 'El registro';

    return `${campoDuplicado} ya se encuentra registrado`;
  }
  ```
- **Ejemplos de Respuesta:**
  - `{ "mensaje": "email ya se encuentra registrado" }`
  - `{ "mensaje": "patente ya se encuentra registrado" }`
  - `{ "mensaje": "token ya se encuentra registrado" }`
