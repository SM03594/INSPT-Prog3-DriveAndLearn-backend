# Guía de Middlewares (DriveAndLearn Backend)

Esta guía documenta la capa **Middlewares** dentro de la arquitectura de **DriveAndLearn**, sus principios de diseño, el flujo de intercepción de peticiones HTTP y el detalle técnico de cada middleware implementado.

---

## 1. Principios de Diseño de la Capa Middleware

1. **Responsabilidad Única (SRP):** Cada middleware atiende un único aspecto transversal del ciclo de vida de la petición: verificación de identidad (autenticación), control de permisos (autorización), saneamiento sintáctico (`validarObjetoJson`) o traducción uniforme de excepciones (`errorHandler`).
2. **Propagación Asíncrona en Express 5:** Los middlewares definidos como `async` propagan automáticamente cualquier excepción o promesa rechazada hacia el manejador central de errores sin necesidad de capturarlas manualmente ni llamar a `next(error)`.
3. **Inyección Limpia en `req`:** La información contextual validada se adosa de forma explícita al objeto `req` (`req.usuario`, `req.token`) para que las capas posteriores (controladores) puedan consumirla de inmediato.
4. **Subcarpeta de Helpers Exclusivos (`src/middlewares/helpers/`):** Toda función auxiliar que sirva a un middleware se ubica dentro de su propia subcarpeta para no contaminar el resto de la aplicación.

---

## 2. Middlewares Implementados

### 2.1. `authMiddleware.js`

Módulo central para la seguridad y control de acceso a las rutas protegidas de la API.

#### Funciones:

### `autenticar(req, _res, next)`

- **Propósito:** Validar la presencia, autenticidad y vigencia del token JWT enviado por el cliente, asegurando además que no haya sido revocado previamente mediante el logout.
- **Parámetros:**
  - `req`: Objeto de petición HTTP de Express. Lee la cabecera `req.headers.authorization`.
  - `_res`: No se utiliza (se prefija con `_`).
  - `next`: Función para delegar el control al siguiente eslabón de la cadena.
- **Flujo de Ejecución:**
  1. **Lectura del Header:** Extrae `Authorization`. Comprueba que exista y comience con el esquema `Bearer `. Si falta o tiene formato erróneo, arroja `ErrorAutenticacion('Token no provisto o formato inválido')` (**`401 Unauthorized`**).
  2. **Extracción del Token:** Obtiene la cadena JWT pura con `cabeceraAutorizacion.slice(7).trim()`.
  3. **Verificación de Revocación (Lista Negra):** Consulta en MongoDB si el token figura en la colección `tokens_revocados` mediante `TokenRevocado.exists({ token })`. Si fue revocado (sesión cerrada por el usuario), arroja `ErrorAutenticacion('Token inválido o sesión cerrada')` (**`401 Unauthorized`**).
  4. **Verificación Criptográfica y Expiración:** Invoca `jwt.verify(token, obtenerJwtSecret())`:
     - Si la firma no coincide: arroja `ErrorAutenticacion('Token inválido')` (**`401`**).
     - Si el token venció: captura `TokenExpiredError` y arroja `ErrorAutenticacion('Token expirado')` (**`401`**).
  5. **Inyección en la Petición:**
     - `req.usuario`: Payload decodificado del usuario (`id`, `email`, `rol`, `NomApe`).
     - `req.user`: Alias de compatibilidad con librerías estándar.
     - `req.token`: La cadena del token original, indispensable para operaciones como el cierre de sesión (`logout`).
  6. **Continuación:** Invoca `next()`.
- **Manejo de Errores:** Todos los rechazos se derivan como `ErrorAutenticacion` respondiendo código **`401 Unauthorized`**.

---

### `autorizarRol(...rolesPermitidos)`

- **Propósito:** Middleware de orden superior (fábrica) que restringe el acceso a un endpoint según el rol asignado al usuario en el sistema (*Role-Based Access Control* - RBAC).
- **Parámetros:**
  - `...rolesPermitidos`: Lista de cadenas de texto con los roles autorizados para la ruta (ej. `ROLES.ADMINISTRADOR`, `ROLES.ALUMNO`).
- **Flujo de Ejecución:**
  1. Comprueba que la petición haya pasado previamente por `autenticar` (`req.usuario` debe estar definido). Si no, arroja `ErrorAutenticacion('No autenticado')` (**`401`**).
  2. Compara `req.usuario.rol` con la lista de `rolesPermitidos`.
  3. Si el rol del usuario no está incluido en la lista, arroja `ErrorAutorizacion('No tiene permisos para acceder a este recurso')` (**`403 Forbidden`**).
  4. Si cuenta con los permisos necesarios, invoca `next()`.
- **Ejemplo de Uso en Rutas:**
  ```javascript
  // Solo administradores pueden gestionar autos
  router.post('/', autenticar, autorizarRol(ROLES.ADMINISTRADOR), autosController.crear);
  ```

---

### 2.2. `validarObjetoJson.js`

- **Propósito:** Garantizar que el cuerpo de la solicitud (`req.body`) sea un objeto JSON plano antes de que el flujo avance hacia los DTOs y controladores.
- **Validación:**
  ```javascript
  const esObjetoPlano = typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body);
  ```
- **Manejo de Errores:** Si el cliente envía arreglos directos, valores primitivos o `null`, arroja `ErrorPeticionInvalida` respondiendo **`400 Bad Request`**.

---

### 2.3. `errorHandler.js`

- **Propósito:** Middleware global para el tratamiento centralizado de todas las excepciones del backend.
- **Funcionamiento:**
  - Captura y traduce errores de validación de Mongoose (`ValidationError`), conversiones fallidas (`CastError`) y duplicados de clave única (código `11000`).
  - Traduce instancias de la jerarquía de errores de la aplicación (`ErrorPeticionInvalida` $\rightarrow$ `400`, `ErrorDeNegocio` $\rightarrow$ `400`, `ErrorAutenticacion` $\rightarrow$ `401`, `ErrorAutorizacion` $\rightarrow$ `403`).
  - Ante cualquier error imprevisto (bug o caída de infraestructura), registra el error por consola y responde genéricamente **`500 Internal Server Error`** sin filtrar detalles sensibles al cliente.
  - Estructura unificada de salida:
    ```json
    { "mensaje": "Descripción del error" }
    ```

