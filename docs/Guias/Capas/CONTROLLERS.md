# Guía de Controladores (DriveAndLearn Backend)

Esta guía documenta el rol de la capa **Controller** dentro de la arquitectura de **DriveAndLearn**, sus principios de diseño, la interacción con la capa de DTOs y Servicios, y el detalle técnico de cada función implementada en los controladores del sistema.

---

## 1. Principios de Diseño de la Capa Controller

Los controladores constituyen la **capa delgada de comunicación HTTP**. Sus reglas esenciales son:

1. **Responsabilidad Única (SRP):** Su única función es recibir los datos de la petición HTTP (`req.params`, `req.body`, `req.query`, `req.usuario`, `req.token`), delegar la validación sintáctica a los DTOs, invocar al Service correspondiente y emitir la respuesta HTTP (`res.status().json()`).
2. **Sin contacto con la base de datos:** Un controlador **nunca** importa ni interactúa directamente con modelos de Mongoose (`Administrador`, `Usuario`, `Clase`, `Auto`, `Profesor`, etc.).
3. **Sin bloques `try/catch` manuales:** Al utilizar **Express 5**, las funciones asíncronas (`async`) propagan automáticamente cualquier excepción o rechazo de promesa hacia el middleware central `errorHandler.js`.
4. **Nombres descriptivos y expresivos:** Variables y constantes internas describen con claridad qué dato contienen en español (ej. `listaAdministradores`, `autoEncontrado`, `alumnoActualizado`).
5. **Convención de Respuestas `404 Not Found` vs `ErrorRegistroInexistente`:**
   - En operaciones CRUD directas por ID (`obtener`, `actualizar`, `sumarSaldoClases`, `restarSaldoClases`), el servicio retorna `null` si no encuentra el documento, y el controlador responde `res.status(404).json({ mensaje: '<Entidad> no encontrado/a' })`.
   - En operaciones compuestas de dominio (`agendar`, `eliminar`, o la gestión de disponibilidad docente), el servicio arroja directamente `ErrorRegistroInexistente` (`404`), el cual es canalizado a través de `errorHandler.js`.

---

## 2. Controladores Implementados

### 2.1. `administradorController.js`

- **Archivo:** `src/controllers/administradorController.js`
- **Recurso:** `/api/administradores`

#### Funciones:

### `listar(_req, res)`
- **Propósito:** Recuperar y devolver la lista de todos los administradores registrados en la plataforma.
- **Flujo:** Invoca `await administradorService.listar()`, almacena el resultado en `listaAdministradores` y responde con código **`200 OK`**.

### `obtener(req, res)`
- **Propósito:** Recuperar y devolver un único administrador por su `id` de MongoDB (`req.params.id`).
- **Flujo:** Invoca `await administradorService.obtenerPorId(id)`. Si devuelve `null`, responde **`404 Not Found`** con `{ "mensaje": "Administrador no encontrado" }`. Si existe, responde **`200 OK`** con el documento.

### `crear(req, res)`
- **Propósito:** Registrar un nuevo administrador en el sistema.
- **Flujo:**
  1. Invoca `validarCrearAdministradorDTO(req.body)` para comprobar campos requeridos (`NomApe`, `email`, `password`) y tipos primitivos.
  2. Invoca `await administradorService.crear(req.body)` (el servicio valida $\ge 8$ caracteres en password, la hashea y persiste).
  3. Responde con status **`201 Created`** con el administrador creado (sin password ni `__v`).

### `actualizar(req, res)`
- **Propósito:** Modificar de forma parcial o total los datos de un administrador (`req.params.id`).
- **Flujo:**
  1. Invoca `validarActualizarAdministradorDTO(req.body)` para validar que haya al menos un campo permitido (`NomApe`, `email`, `password`) y tipos string.
  2. Invoca `await administradorService.actualizar(id, req.body)`.
  3. Si retorna `null`, responde **`404 Not Found`** (`{ "mensaje": "Administrador no encontrado" }`).
  4. Si se actualiza exitosamente, responde **`200 OK`**.

---

### 2.2. `alumnoController.js`

- **Archivo:** `src/controllers/alumnoController.js`
- **Recurso:** `/api/alumnos`

#### Funciones:

### `listar(_req, res)`
- **Propósito:** Recuperar y devolver la lista de todos los alumnos registrados junto con su saldo de clases prácticas.
- **Flujo:** Invoca `await alumnoService.listar()`, guarda en `listaAlumnos` y responde **`200 OK`**.

### `obtener(req, res)`
- **Propósito:** Recuperar un alumno por su ID de MongoDB (`req.params.id`).
- **Flujo:** Invoca `await alumnoService.obtenerPorId(id)`. Si retorna `null`, responde **`404 Not Found`** (`{ "mensaje": "Alumno no encontrado" }`). Si existe, responde **`200 OK`**.

### `crear(req, res)`
- **Propósito:** Registrar un nuevo alumno en la plataforma (registro público).
- **Flujo:**
  1. Valida la estructura mediante `validarCrearAlumnoDTO(req.body)` (`NomApe`, `email`, `password` obligatorios; `saldoClases` opcional; tipos válidos).
  2. Invoca `await alumnoService.crear(req.body)` (hashea password y persiste con `saldoClases: 0` por defecto).
  3. Responde **`201 Created`** con el alumno creado.

### `actualizar(req, res)`
- **Propósito:** Modificar datos personales del alumno (`NomApe`, `email` y/o `password`).
- **Flujo:**
  1. Valida con `validarActualizarAlumnoDTO(req.body)` (rechaza `saldoClases` para proteger el crédito).
  2. Invoca `await alumnoService.actualizar(id, req.body)`. Si retorna `null`, responde **`404 Not Found`** (`{ "mensaje": "Alumno no encontrado" }`). Si existe, responde **`200 OK`**.

### `sumarSaldoClases(req, res)`
- **Propósito:** Acreditar clases prácticas prepagas al saldo del alumno (`req.params.id`).
- **Flujo:**
  1. Valida con `validarSumarSaldoClasesDTO(req.body)` exigiendo `{ "cantidad": number }`.
  2. Invoca `await alumnoService.sumarSaldoClases(id, req.body)` (el servicio comprueba que sea entero $> 0$ y suma el crédito).
  3. Si retorna `null`, responde **`404 Not Found`** (`{ "mensaje": "Alumno no encontrado" }`). Si existe, responde **`200 OK`** con el documento actualizado.

### `restarSaldoClases(req, res)`
- **Propósito:** Debitar clases del saldo del alumno (`req.params.id`).
- **Flujo:**
  1. Valida con `validarRestarSaldoClasesDTO(req.body)` exigiendo `{ "cantidad": number }`.
  2. Invoca `await alumnoService.restarSaldoClases(id, req.body)` (el servicio comprueba que sea entero $> 0$ y que el saldo resultante no sea $< 0$).
  3. Si retorna `null`, responde **`404 Not Found`** (`{ "mensaje": "Alumno no encontrado" }`). Si existe, responde **`200 OK`** con el documento actualizado.

---

### 2.3. `authController.js`

- **Archivo:** `src/controllers/authController.js`
- **Recurso:** `/api/auth`

#### Funciones:

### `login(req, res)`
- **Propósito:** Autenticar las credenciales del usuario y emitir su token JWT junto con su perfil público.
- **Flujo:**
  1. Valida con `validarLoginDTO(req.body)` comprobando la presencia exclusiva de `email` y `password` (`string`).
  2. Invoca `await authService.login(req.body)`.
  3. Responde **`200 OK`** con el objeto `{ token, usuario: { id, NomApe, email, rol } }`.

### `logout(req, res)`
- **Propósito:** Cerrar la sesión activa del usuario agregando su token a la lista negra (`tokens_revocados`).
- **Flujo:**
  1. Toma `req.token` inyectado previamente por el middleware `autenticar`.
  2. Invoca `await authService.logout(req.token)`.
  3. Responde **`200 OK`** con `{ "mensaje": "Sesión cerrada exitosamente" }`.

---

### 2.4. `autoController.js`

- **Archivo:** `src/controllers/autoController.js`
- **Recurso:** `/api/autos`

#### Funciones:

### `listar(req, res)`
- **Propósito:** Obtener la flota de autos, permitiendo filtrar opcionalmente por tipo de cambios (`?cambios=MANUAL` o `AUTOMATICO`).
- **Flujo:**
  1. Extrae `const { cambios } = req.query;`.
  2. Invoca `await autoService.listar(cambios)` (el servicio normaliza y valida contra `CAMBIOS_ENUM`).
  3. Responde **`200 OK`** con el array de vehículos.

### `obtener(req, res)`
- **Propósito:** Obtener la ficha técnica de un auto por su ID (`req.params.id`).
- **Flujo:** Invoca `await autoService.obtenerPorId(id)`. Si retorna `null`, responde **`404 Not Found`** (`{ "mensaje": "Auto no encontrado" }`). Si existe, responde **`200 OK`**.

### `crear(req, res)`
- **Propósito:** Dar de alta un vehículo en la flota vehicular de la escuela.
- **Flujo:**
  1. Valida sintácticamente con `validarCrearAutoDTO(req.body)` (`marca`, `modelo`, `patente`, `cambios` obligatorios y de tipo `string`).
  2. Invoca `await autoService.crear(req.body)` (Mongoose valida regex de patente argentina y enum de cambios).
  3. Responde **`201 Created`** con el auto creado.

### `actualizar(req, res)`
- **Propósito:** Modificar datos de un vehículo existente (`req.params.id`).
- **Flujo:**
  1. Valida con `validarActualizarAutoDTO(req.body)` exigiendo al menos un campo permitido (`marca`, `modelo`, `patente`, `cambios`).
  2. Invoca `await autoService.actualizar(id, req.body)`.
  3. Si retorna `null`, responde **`404 Not Found`** (`{ "mensaje": "Auto no encontrado" }`). Si existe, responde **`200 OK`**.

---

### 2.5. `profesorController.js`

- **Archivo:** `src/controllers/profesorController.js`
- **Recurso:** `/api/profesores`

#### Funciones:

### `listar(_req, res)`
- **Propósito:** Obtener el listado completo de profesores registrados.
- **Flujo:** Invoca `await profesorService.listar()` y responde **`200 OK`**.

### `obtener(req, res)`
- **Propósito:** Obtener los datos de un profesor por su ID (`req.params.id`).
- **Flujo:** Invoca `await profesorService.obtenerPorId(id)`. Si retorna `null`, responde **`404 Not Found`** (`{ "mensaje": "Profesor no encontrado" }`). Si existe, responde **`200 OK`**.

### `crear(req, res)`
- **Propósito:** Dar de alta un nuevo docente en el sistema.
- **Flujo:**
  1. Valida con `validarCrearProfesorDTO(req.body)` (`NomApe` obligatorio, rechaza campo `disponibilidad`).
  2. Invoca `await profesorService.crear(req.body)`.
  3. Responde **`201 Created`** con el profesor creado (con `disponibilidad` inicializada vacía).

### `actualizar(req, res)`
- **Propósito:** Modificar datos personales de un profesor (`req.params.id`).
- **Flujo:**
  1. Valida con `validarActualizarProfesorDTO(req.body)` (`NomApe` obligatorio, rechaza campo `disponibilidad`).
  2. Invoca `await profesorService.actualizar(id, req.body)`.
  3. Si retorna `null`, responde **`404 Not Found`** (`{ "mensaje": "Profesor no encontrado" }`). Si existe, responde **`200 OK`**.

### `verDisponibilidad(req, res)`
- **Propósito:** Consultar la grilla de disponibilidad semanal (`lunes` a `domingo`) de un profesor.
- **Flujo:** Invoca `await profesorService.verDisponibilidad(id)`. Si el profesor no existe, el servicio lanza `ErrorRegistroInexistente` (**`404`**). Responde **`200 OK`** con el objeto de disponibilidad.

### `agregarDisponibilidad(req, res)`
- **Propósito:** Agregar nuevos tramos horarios a la disponibilidad semanal del profesor, fusionando automáticamente tramos superpuestos o contiguos.
- **Flujo:**
  1. Valida con `validarAgregarDisponibilidadDTO(req.body)` (estructura de array `tramos` con `dia` y `tramoHorario: { horaInicio, horaFin }`).
  2. Invoca `await profesorService.agregarDisponibilidad(id, req.body.tramos)`.
  3. Responde **`200 OK`** con el documento actualizado del profesor.

### `quitarDisponibilidad(req, res)`
- **Propósito:** Recortar o dividir tramos horarios existentes de la disponibilidad semanal del profesor.
- **Flujo:**
  1. Valida con `validarQuitarDisponibilidadDTO(req.body)`.
  2. Invoca `await profesorService.quitarDisponibilidad(id, req.body.tramos)`.
  3. Responde **`200 OK`** con el documento actualizado del profesor.

### `verTurnosLibres(req, res)`
- **Propósito:** Consultar los turnos de 1 hora disponibles de un profesor para una fecha específica con sus autos disponibles.
- **Flujo:**
  1. Valida los query parameters con `validarTurnosLibresQueryDTO(req.query)` (exige `fecha="YYYY-MM-DD"`, `cambios` opcional).
  2. Invoca `await profesorService.obtenerTurnosLibres({ profesorId: id, fecha, cambios })`.
  3. Responde **`200 OK`** con `{ "turnos_libres": [...] }`.

---

### 2.6. `claseController.js`

- **Archivo:** `src/controllers/claseController.js`
- **Recurso:** `/api/clases`

#### Funciones:

### `listar(req, res)`
- **Propósito:** Listar clases agendadas. Admite filtros opcionales por query parameters (`profesor`, `auto`, `alumno`, `fecha`). Si el usuario autenticado tiene rol `alumno`, solo puede visualizar sus propias clases (rechaza intentos de consultar a otros alumnos con `403`); si es `administrador`, visualiza todas o filtra por los parámetros provistos.
- **Flujo:**
  1. Valida la consulta con `const queryValidada = validarListarClasesQueryDTO(req.query)`.
  2. Invoca `await claseService.listar(queryValidada, req.usuario)`.
  3. Responde **`200 OK`** con el listado de clases.

### `obtener(req, res)`
- **Propósito:** Obtener el detalle de una clase específica por su ID (`req.params.id`).
- **Flujo:**
  1. Invoca `await claseService.obtenerPorId(id, req.usuario)`.
  2. Si retorna `null`, responde **`404 Not Found`** (`{ "mensaje": "Clase no encontrada" }`).
  3. Si el alumno intenta acceder a una clase ajena, el servicio arroja `ErrorAutorizacion` (**`403`**).
  4. Responde **`200 OK`** con la clase encontrada.

### `agendar(req, res)`
- **Propósito:** Reservar una nueva clase práctica en el sistema.
- **Flujo:**
  1. Valida sintácticamente con `validarAgendarClaseDTO(req.body)` (`profesor`, `auto`, `inicio`, `fin` obligatorios; prohíbe el campo `alumno` en el body).
  2. Inyecta el ID del alumno autenticado desde `req.usuario.id`:
     ```javascript
     const datosClase = { ...req.body, alumno: req.usuario?.id };
     ```
  3. Invoca `await claseService.agendar(datosClase, req.usuario)`.
  4. Responde **`201 Created`** con la clase registrada.

### `eliminar(req, res)`
- **Propósito:** Cancelar una clase agendada, reintegrando automáticamente 1 crédito de saldo al alumno titular.
- **Flujo:**
  1. Invoca `await claseService.eliminar(id, req.usuario)`.
  2. El servicio verifica la existencia de la clase (arroja `ErrorRegistroInexistente` si no existe), comprueba que el alumno sea titular de la misma (o administrador), acredita 1 clase al saldo del alumno y elimina físicamente el registro.
  3. Responde **`200 OK`** con el objeto de la clase eliminada.
