# Guía de Servicios (DriveAndLearn Backend)

Esta guía documenta la capa **Service** dentro de la arquitectura de **DriveAndLearn**, sus principios de diseño, el tratamiento de la lógica de negocio y el detalle técnico de cada servicio implementado.

---

## 1. Principios de Diseño de la Capa Service

1. **Núcleo de Negocio:** La capa de servicios contiene toda la lógica de dominio de la aplicación: validación de contraseñas, cálculos de saldos de clases, generación y revocación de tokens JWT, algoritmos de disponibilidad y persistencia mediante modelos de Mongoose.
2. **Aislamiento HTTP Absoluto:** Un servicio **nunca** conoce los objetos `req` ni `res` de Express, ni maneja cabeceras o códigos de respuesta HTTP. Su entrada son argumentos primitivos u objetos planos de JavaScript, y su salida son resultados o promesas resueltas.
3. **Manejo Semántico de Excepciones:** Cuando una regla de negocio se viola o un dato no cumple con las restricciones de dominio, el servicio interrumpe el flujo arrojando instancias específicas de `src/errors/` (`ErrorDeNegocio`, `ErrorAutenticacion`, `ErrorPeticionInvalida`).
4. **Idempotencia:** Las operaciones de alteración de estado (como el cierre de sesión) deben diseñarse para ser seguras ante peticiones repetidas o reintentos del cliente.
5. **Subcarpeta de Helpers Exclusivos (`src/services/helpers/`):** Aloja utilidades internas de dominio que no deben mezclarse con otras capas (ej. `manejoDePassword.js`, `validarMongooseObjId.js`).

---

## 2. Servicios Implementados

### 2.1. `authService.js`

Servicio responsable de la autenticación de usuarios, emisión de credenciales JWT y revocación de sesiones.

- **Archivo:** `src/services/authService.js`

#### Funciones:

### `logout(token)`

- **Propósito:** Revocar activamente un token JWT antes de que termine su período natural de vigencia, registrándolo en la colección `tokens_revocados` para que el middleware de autenticación lo rechace en peticiones posteriores.
- **Parámetros:**
  - `token` (`string`): La cadena del token JWT a invalidar.
- **Flujo de Ejecución:**
  1. **Validación de Parámetro:** Comprueba que `token` sea una cadena de texto no vacía. Si no lo es, arroja `ErrorAutenticacion('Token no provisto')`.
  2. **Verificación de Firma y Expiración:** Invoca `jwt.verify(tokenLimpio, obtenerJwtSecret())`:
     - Si el token es legítimo, obtiene el `payload` decodificado con su claim `exp` (timestamp de expiración en segundos).
     - Si el token ya expiró naturalmente (`error.name === 'TokenExpiredError'`), la sesión ya es inválida por definición de tiempo; la función retorna `{ mensaje: 'Sesión cerrada exitosamente' }` sin necesidad de persistir.
     - Si el token fue adulterado o la firma no coincide, arroja `ErrorAutenticacion('Token inválido')`.
  3. **Cálculo de Expiración:** Convierte el claim `exp` en un objeto `Date` de JavaScript (`new Date(payload.exp * 1000)`).
  4. **Persistencia en la Lista Negra:** Registra un nuevo documento en MongoDB usando `TokenRevocado.create({ token: tokenLimpio, expiraEn })`.
  5. **Garantía de Idempotencia:** Si el token ya había sido revocado en una petición anterior, MongoDB arroja un error de clave duplicada (código `11000` por el índice único en `token`). El servicio captura este código específico y lo ignora de forma segura, evitando responder con error ante clics dobles o reintentos de red.
  6. **Retorno:** Devuelve el objeto descriptivo `{ mensaje: 'Sesión cerrada exitosamente' }`.
- **Manejo de Errores:**
  - Arroja `ErrorAutenticacion` (mapeado a **`401 Unauthorized`**) si no se provee el token o si este posee firma inválida.

---

### `login({ email, password })`

- **Propósito:** Autenticar las credenciales de un usuario y generar un token JWT de acceso válido por 24 horas.
- **Flujo de Ejecución:**
  1. Normaliza el `email` a minúsculas y sin espacios.
  2. Busca el usuario en MongoDB mediante `Usuario.findOne({ email: emailNormalizado })`. Si no existe, arroja `ErrorAutenticacion('Credenciales inválidas')`.
  3. Compara la contraseña en texto plano recibida con el hash almacenado mediante `bcrypt.compare`. Si no coincide, arroja `ErrorAutenticacion('Credenciales inválidas')`.
  4. Genera el JWT firmado con `JWT_SECRET` conteniendo `{ id, email, rol, NomApe }` y vigencia de 24 horas.
  5. Retorna `{ token, usuario: { id, NomApe, email, rol } }`.

---

### `esTokenRevocado(token)`

- **Propósito:** Comprobar rápidamente si una cadena de token JWT se encuentra registrada en la colección `tokens_revocados`.
- **Retorno:** `true` si el token fue revocado previamente; `false` en caso contrario.

---

### 2.2. Resumen de Otros Servicios del Sistema

| Servicio | Archivo | Responsabilidad Principal |
| :--- | :--- | :--- |
| **`administradorService`** | `src/services/administradorService.js` | Alta con hasheo de contraseña, listado de administradores, búsqueda por ID y actualización. *(Restringe explícitamente la eliminación).* |
| **`alumnoService`** | `src/services/alumnoService.js` | Alta de alumnos, listado, búsqueda por ID, actualización y gestión especializada de saldo de clases (`sumarSaldoClases`, `restarSaldoClases`). *(Restringe explícitamente la eliminación).* |
| **`usuarioService`** | `src/services/usuarioService.js` | Búsquedas transversales de usuarios por ID (`obtenerPorId`) o por correo electrónico (`obtenerPorEmail`). |

