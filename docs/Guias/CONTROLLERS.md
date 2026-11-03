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





