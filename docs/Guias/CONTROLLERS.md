# Guía de Controladores (DriveAndLearn Backend)

Esta guía documenta el rol de la capa **Controller** dentro de la arquitectura de **DriveAndLearn**, sus principios de diseño y el detalle técnico de cada función implementada en los controladores del sistema.

---

## 1. Principios de Diseño de la Capa Controller

Los controladores son la **capa delgada de comunicación HTTP**. Sus reglas esenciales son:

1. **Responsabilidad Única (SRP):** Su única función es recibir los datos de la petición HTTP (`req.params`, `req.body`, `req.query`), delegar la validación sintáctica a los DTOs, delegar la lógica de negocio a los Services y emitir la respuesta HTTP (`res.status().json()`).
2. **Sin contacto con la base de datos:** Un controlador **nunca** importa ni interactúa directamente con modelos de Mongoose (`Administrador`, `Usuario`, `Clase`, etc.).
3. **Sin bloques `try/catch` manuales:** Al utilizar **Express 5**, las funciones asíncronas (`async`) propagan automáticamente cualquier excepción o rechazo de promesa hacia el middleware central `errorHandler.js`.
4. **Nombres descriptivos y expresivos:** Las variables y constantes internas describen con claridad qué dato contienen en español (ej. `listaAdministradores`).

---

## 2. Controladores Implementados

### 2.1. `administrador.controller.js`

Controlador encargado de responder a las solicitudes sobre el recurso de administradores (`/api/administradores`).

#### Funciones:

### `listar(_req, res)`

- **Propósito:** Recuperar y devolver la lista de todos los administradores registrados en la plataforma.
- **Parámetros:**
  - `_req`: Objeto de petición HTTP de Express. Se prefija con guion bajo (`_`) como convención indicando que no se utilizan parámetros de ruta, cuerpo ni query strings para este listado.
  - `res`: Objeto de respuesta HTTP de Express empleado para enviar el status y el cuerpo JSON al cliente.
- **Flujo de Ejecución:**
  1. Invoca `await administradorService.listar()`, el cual consulta a la colección correspondiente a través de Mongoose.
  2. Guarda el resultado en la variable descriptiva `listaAdministradores`.
  3. Devuelve una respuesta HTTP con código **`200 OK`** conteniendo el array de administradores serializado en JSON (con las propiedades sensibles como `password` y `__v` excluidas según la configuración del modelo).
- **Manejo de Errores:**
  - Si la conexión a la base de datos falla o se produce un error inesperado, la promesa se rechaza y Express 5 deriva la excepción automáticamente al middleware `errorHandler.js`, respondiendo un status `500` con `{ "mensaje": "Error interno del servidor" }`.

---

### `obtener(req, res)` *(alias: `obtenerPorId`)*

- **Propósito:** Recuperar y devolver un único administrador identificado por su identificador único de MongoDB (`id` provisto en los parámetros de ruta).
- **Parámetros:**
  - `req`: Objeto de petición HTTP de Express. Se extrae el parámetro de ruta `id` desde `req.params`.
  - `res`: Objeto de respuesta HTTP de Express empleado para enviar el status y el cuerpo JSON al cliente.
- **Flujo de Ejecución:**
  1. Extrae `const { id } = req.params;`.
  2. Invoca `await administradorService.obtenerPorId(id);`.
     - Dentro del servicio, se ejecuta la validación sintáctica del identificador mediante `validarMongooseObjId(id)`. Si el ID no cumple con el formato ObjectId de 24 caracteres hexadecimales de MongoDB, el servicio lanza un `ErrorMongooseObjIdInvalido` que el middleware central `errorHandler.js` traduce a código **`400 Bad Request`**.
  3. Si la búsqueda en la base de datos devuelve `null` (el ID tiene formato válido pero no existe ningún administrador registrado con ese identificador), el controlador corta el flujo respondiendo inmediatamente con código **`404 Not Found`** y el cuerpo `{ "mensaje": "Administrador no encontrado" }`.
  4. Si se encuentra el documento, guarda el resultado en la variable descriptiva `administradorEncontrado` y responde con código **`200 OK`** adjuntando el documento JSON correspondiente (con la contraseña omitida).
- **Manejo de Errores:**
  - **`400 Bad Request`**: Si el formato de `id` no es un ObjectId válido de Mongoose (arrojado por el servicio y capturado por Express 5).
  - **`404 Not Found`**: Si no existe ningún administrador con ese `id` (controlado directamente por la respuesta del controlador).
  - **`500 Internal Server Error`**: Ante caídas de red o fallos inesperados de la base de datos.

---

### `crear(req, res)`

- **Propósito:** Registrar un nuevo administrador en el sistema luego de validar la integridad y tipos de los datos de entrada.
- **Parámetros:**
  - `req`: Objeto de petición HTTP de Express. Contiene el cuerpo en formato JSON (`req.body`) con los datos a registrar (`NomApe`, `email`, `password`).
  - `res`: Objeto de respuesta HTTP de Express empleado para enviar el status y el cuerpo JSON al cliente.
- **Flujo de Ejecución:**
  1. Invoca `validarCrearAdministradorDTO(req.body);` para verificar la estructura sintáctica:
     - Comprueba que el cuerpo no esté vacío.
     - Comprueba que todos los campos requeridos (`NomApe`, `email`, `password`) estén presentes.
     - Verifica que no se envíen campos no reconocidos (evitando inyecciones de campos arbitrarios).
     - Valida que todos los campos sean del tipo primitivo esperado (`string`).
     - Si alguna validación falla, el DTO arroja `ErrorCampoInvalido` o `ErrorDeTipo`, que `errorHandler.js` responde con código **`400 Bad Request`**.
  2. Invoca `await administradorService.crear(req.body);`:
     - El servicio valida que la contraseña posea al menos 8 caracteres (arrojando `ErrorPasswordInvalida` si no cumple).
     - Hashea la contraseña con `bcrypt` (10 rondas de salt).
     - Persiste el documento en MongoDB usando el modelo `Administrador`.
     - Si el email ya está en uso, Mongoose/MongoDB arroja el error de duplicado (código 11000), traducido a **`400 Bad Request`**.
  3. Al crearse exitosamente, el resultado se asigna a la variable descriptiva `administradorCreado`.
  4. Responde con código de estado HTTP **`201 Created`** adjuntando el documento del nuevo administrador (sin exponer el hash de la contraseña ni `__v`).
- **Manejo de Errores:**
  - **`400 Bad Request`**: Por campos faltantes, campos no permitidos, tipos erróneos, contraseña menor a 8 caracteres o email ya registrado.
  - **`500 Internal Server Error`**: Ante fallos imprevistos del servidor o desconexión de la base de datos.

---

### `actualizar(req, res)`

- **Propósito:** Actualizar de forma parcial o total los datos de un administrador existente identificado por su `id`.
- **Parámetros:**
  - `req`: Objeto de petición HTTP de Express.
    - `req.params.id`: Identificador único de MongoDB del administrador a modificar.
    - `req.body`: Cuerpo en formato JSON con los campos que se desean actualizar (`NomApe`, `email` y/o `password`).
  - `res`: Objeto de respuesta HTTP de Express empleado para enviar el status y el cuerpo JSON al cliente.
- **Flujo de Ejecución:**
  1. Extrae `const { id } = req.params;`.
  2. Invoca `validarActualizarAdministradorDTO(req.body);`:
     - Verifica que el cuerpo no esté vacío (debe enviarse al menos un campo a modificar).
     - Comprueba que únicamente se envíen campos permitidos (`NomApe`, `email`, `password`), rechazando propiedades no reconocidas.
     - Valida los tipos primitivos (`string`) de los campos proporcionados.
     - Si la validación sintáctica falla, arroja `ErrorCampoInvalido` o `ErrorDeTipo` (`400 Bad Request`).
  3. Invoca `await administradorService.actualizar(id, req.body);`:
     - El servicio valida el formato de `id` con `validarMongooseObjId(id)`. Si es inválido, arroja `ErrorMongooseObjIdInvalido` (`400 Bad Request`).
     - Si el cuerpo incluye una nueva `password`, valida que tenga mínimo 8 caracteres y la hashea con `bcrypt`.
     - Ejecuta la actualización en MongoDB con `findByIdAndUpdate(id, datos, { new: true, runValidators: true })`.
     - Si se envía un `email` que ya pertenece a otro usuario, la restricción `unique` de MongoDB dispara el error 11000 (`400 Bad Request`).
  4. Si el administrador no existe en la base de datos (`null`), el controlador responde con código **`404 Not Found`** y `{ "mensaje": "Administrador no encontrado" }`.
  5. Si la actualización es exitosa, guarda el documento resultante en `administradorActualizado` y responde con código **`200 OK`** adjuntando los datos actualizados (sin contraseña ni `__v`).
- **Manejo de Errores:**
  - **`400 Bad Request`**: Si el `id` no tiene formato ObjectId válido, si el cuerpo está vacío, si se envían campos no permitidos, tipos incorrectos, contraseña con menos de 8 caracteres o email duplicado.
  - **`404 Not Found`**: Si el `id` es formalmente válido pero no corresponde a ningún administrador registrado.
  - **`500 Internal Server Error`**: Ante errores de infraestructura o conexión con la base de datos.

> [!NOTE]
> **Restricción de Eliminación:** Por regla del dominio del negocio y requerimientos del proyecto, los administradores no poseen función de eliminación (`eliminar`). Esto preserva la trazabilidad y la integridad histórica de auditoría de la escuela de manejo. La eliminación física solo está permitida para el recurso `Clase`.

---

### 2.2. `alumno.controller.js`

Controlador encargado de responder a las solicitudes sobre el recurso de alumnos (`/api/alumnos`).

#### Funciones:

### `listar(_req, res)`

- **Propósito:** Recuperar y devolver la lista de todos los alumnos registrados en el sistema, incluyendo sus atributos base de usuario (`NomApe`, `email`) y su saldo disponible de clases prácticas (`saldoClases`).
- **Parámetros:**
  - `_req`: Objeto de petición HTTP de Express. Se prefija con guion bajo (`_`) dado que esta operación de lectura general no consume parámetros de ruta, cuerpo ni query strings.
  - `res`: Objeto de respuesta HTTP de Express empleado para enviar el código de estado y la lista en formato JSON al cliente.
- **Flujo de Ejecución:**
  1. Invoca `await alumnoService.listar()`, el cual consulta a la colección de usuarios filtrando por el discriminador correspondiente (`rol: 'alumno'`) a través de Mongoose.
  2. Almacena la colección resultante en la variable descriptiva `listaAlumnos`.
  3. Devuelve una respuesta HTTP con código **`200 OK`** conteniendo el array de alumnos en formato JSON (excluyendo automáticamente la contraseña hasheada y `__v` gracias a la transformación `toJSON` del esquema de usuario).
- **Manejo de Errores:**
  - Si la base de datos se encuentra inaccesible o surge un error imprevisto, la promesa rechazada es interceptada nativamente por Express 5 y transferida a `errorHandler.js`, respondiendo un status **`500 Internal Server Error`** con `{ "mensaje": "Error interno del servidor" }`.

---

### `crear(req, res)`

- **Propósito:** Dar de alta un nuevo alumno en la plataforma luego de comprobar la integridad y tipos de los datos de entrada recibidos en el cuerpo.
- **Parámetros:**
  - `req`: Objeto de petición HTTP de Express. Contiene en `req.body` los datos obligatorios (`NomApe`, `email`, `password`) y el dato opcional de saldo inicial (`saldoClases`).
  - `res`: Objeto de respuesta HTTP de Express empleado para enviar el status y el cuerpo JSON al cliente.
- **Flujo de Ejecución:**
  1. Invoca `validarCrearAlumnoDTO(req.body);`:
     - Verifica que el cuerpo no esté vacío.
     - Valida la presencia ineludible de los campos obligatorios: `NomApe`, `email` y `password`.
     - Permite opcionalmente el campo `saldoClases`.
     - Rechaza cualquier campo adicional no permitido para evitar inyecciones indebidas.
     - Verifica que los tipos sean correctos (`string` para `NomApe`, `email`, `password` y `number` para `saldoClases`).
     - Ante discrepancias, arroja `ErrorCampoInvalido` o `ErrorDeTipo` (`400 Bad Request`).
  2. Invoca `await alumnoService.crear(req.body);`:
     - El servicio valida que la contraseña tenga como mínimo 8 caracteres (arrojando `ErrorPasswordInvalida` si es menor).
     - Hashea la contraseña con `bcrypt`.
     - Persiste el nuevo registro usando el modelo `Alumno` (el cual asigna automáticamente `rol: 'alumno'` y `saldoClases: 0` si no fue provisto).
     - Si el email ya está registrado o no cumple con el formato regex, Mongoose o MongoDB disparan el error correspondiente (`400 Bad Request`).
  3. Guarda el resultado en `alumnoCreado`.
  4. Responde con código HTTP **`201 Created`** adjuntando el documento del nuevo alumno (sin exponer el hash de la contraseña ni `__v`).
- **Manejo de Errores:**
  - **`400 Bad Request`**: Por campos faltantes, campos no permitidos, tipos inválidos, contraseña corta (< 8 caracteres), formato de email incorrecto o email ya existente.
  - **`500 Internal Server Error`**: Si ocurre un fallo crítico de infraestructura o conexión con la base de datos.

---

### `obtener(req, res)` *(alias: `obtenerPorId`)*

- **Propósito:** Recuperar y devolver un único alumno identificado por su `id` de MongoDB, informando su saldo de clases y datos personales.
- **Parámetros:**
  - `req`: Objeto de petición HTTP de Express. Se extrae `req.params.id`.
  - `res`: Objeto de respuesta HTTP de Express empleado para enviar el status y el cuerpo JSON al cliente.
- **Flujo de Ejecución:**
  1. Extrae `const { id } = req.params;`.
  2. Invoca `await alumnoService.obtenerPorId(id);`:
     - El servicio valida el formato con `validarMongooseObjId(id)`. Si no es un ObjectId válido de MongoDB, arroja `ErrorMongooseObjIdInvalido` (`400 Bad Request`).
     - Realiza la búsqueda en MongoDB por ID.
  3. Si la búsqueda arroja `null` (el alumno no existe o el ID pertenece a otro rol como administrador), el controlador corta el flujo respondiendo inmediatamente código **`404 Not Found`** con `{ "mensaje": "Alumno no encontrado" }`.
  4. Si existe, asigna el resultado a la variable descriptiva `alumnoEncontrado` y responde con código **`200 OK`** junto con el documento JSON (sin contraseña ni `__v`).
- **Manejo de Errores:**
  - **`400 Bad Request`**: Si el parámetro `id` no tiene formato válido de ObjectId de MongoDB.
  - **`404 Not Found`**: Si el ID es válido pero no existe ningún alumno registrado con ese identificador.
  - **`500 Internal Server Error`**: Ante fallos imprevistos de conexión con la base de datos.

---

### `actualizar(req, res)`

- **Propósito:** Modificar de forma parcial o total la información de un alumno existente (`NomApe`, `email` y/o `password`).
- **Parámetros:**
  - `req`: Objeto de petición HTTP de Express.
    - `req.params.id`: Identificador único de MongoDB del alumno a editar.
    - `req.body`: Objeto JSON con los atributos a actualizar.
  - `res`: Objeto de respuesta HTTP de Express empleado para enviar el status y el cuerpo JSON al cliente.
- **Flujo de Ejecución:**
  1. Extrae `const { id } = req.params;`.
  2. Invoca `validarActualizarAlumnoDTO(req.body);`:
     - Verifica que el cuerpo no esté vacío.
     - Comprueba que solo contenga campos permitidos para la edición estándar (`NomApe`, `email`, `password`). El saldo de clases no se modifica por esta vía genérica para preservar la integridad financiera (cuenta con operaciones específicas de saldo).
     - Valida los tipos de datos primitivos (`string`).
     - Arroja `ErrorCampoInvalido` o `ErrorDeTipo` (`400 Bad Request`) si hay irregularidades.
  3. Invoca `await alumnoService.actualizar(id, req.body);`:
     - Valida el formato de `id` con `validarMongooseObjId(id)`. Si es inválido, arroja `ErrorMongooseObjIdInvalido` (`400 Bad Request`).
     - Si se envía una nueva `password`, valida longitud mínima de 8 caracteres y la hashea con `bcrypt`.
     - Actualiza el documento en MongoDB activando validadores de esquema (`runValidators: true`).
     - Si el email modificado colisiona con otro usuario registrado, MongoDB dispara el error 11000 (`400 Bad Request`).
  4. Si no se encuentra ningún alumno con ese `id` (`null`), el controlador responde status **`404 Not Found`** con `{ "mensaje": "Alumno no encontrado" }`.
  5. Si la actualización concluye con éxito, guarda el resultado en `alumnoActualizado` y responde con status **`200 OK`** junto con el documento modificado (sin contraseña ni `__v`).
- **Manejo de Errores:**
  - **`400 Bad Request`**: Si el `id` no tiene formato ObjectId válido, el cuerpo está vacío, contiene campos no permitidos, tipos incorrectos, contraseña < 8 caracteres o email duplicado.
  - **`404 Not Found`**: Si el `id` tiene formato válido pero no existe ningún alumno con dicho identificador.
  - **`500 Internal Server Error`**: Ante fallas imprevistas de infraestructura o conexión con la base de datos.

> [!NOTE]
> **Restricción de Eliminación:** Al igual que en los administradores, los alumnos no poseen función de eliminación física (`eliminar`), garantizando la preservación histórica de sus clases registradas y trazabilidad académica.

---

### 2.3. `auth.controller.js`

Controlador responsable del proceso de autenticación de usuarios y emisión de credenciales de acceso JWT (`/api/auth`).

#### Funciones:

### `login(req, res)`

- **Propósito:** Iniciar sesión en el sistema comprobando las credenciales provistas (`email` y `password`), emitiendo un token JWT firmado junto con el perfil público del usuario (`id`, `NomApe`, `email`, `rol`).
- **Parámetros:**
  - `req`: Objeto de petición HTTP de Express. Contiene en `req.body` las credenciales del usuario: `email` y `password`.
  - `res`: Objeto de respuesta HTTP de Express empleado para enviar el status y el cuerpo JSON al cliente.
- **Flujo de Ejecución:**
  1. Invoca `validarLoginDTO(req.body);`:
     - Verifica que el cuerpo no esté vacío.
     - Exige la presencia obligatoria y exclusiva de `email` y `password`.
     - Rechaza cualquier campo extraño no permitido.
     - Comprueba que ambos sean cadenas de texto (`string`).
     - Si la validación falla, arroja `ErrorCampoInvalido` o `ErrorDeTipo` (`400 Bad Request`).
  2. Invoca `await authService.login(req.body);`:
     - El servicio normaliza el email (en minúsculas y sin espacios laterales).
     - Busca el usuario en la base de datos mediante el modelo `Usuario`. Si no existe, arroja `ErrorAutenticacion('Credenciales inválidas')`.
     - Compara la contraseña en texto plano recibida con el hash almacenado en MongoDB utilizando `bcrypt.compare`. Si no coincide, arroja `ErrorAutenticacion('Credenciales inválidas')`.
     - Genera un token JWT con vigencia de 24 horas (`expiresIn: '24h'`) firmado con el secreto `JWT_SECRET` (obtenido mediante `obtenerJwtSecret()`), conteniendo en su payload `id`, `email`, `rol` y `NomApe`.
  3. Almacena el resultado en la variable descriptiva `respuestaLogin` (objeto `{ token, usuario }`).
  4. Responde al cliente con código HTTP **`200 OK`** y el payload JSON resultante.
- **Manejo de Errores:**
  - **`400 Bad Request`**: Si el cuerpo viene vacío, faltan campos requeridos (`email` o `password`), se envían propiedades no permitidas o los tipos no son cadenas.
  - **`401 Unauthorized`**: Si el email no se encuentra registrado o la contraseña no coincide con el hash (arrojado como `ErrorAutenticacion` y traducido automáticamente a status 401 por el middleware `errorHandler.js`).
  - **`500 Internal Server Error`**: Si ocurre un error inesperado al firmar el token JWT o ante fallas en la base de datos.










