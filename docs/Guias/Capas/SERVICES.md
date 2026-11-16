# Guía de Servicios (DriveAndLearn Backend)

Esta guía documenta la capa **Service** dentro de la arquitectura de **DriveAndLearn**, sus principios de diseño, el desacoplamiento horizontal entre dominios, el motor de calendarización con Luxon, el detalle técnico de cada servicio y las funciones auxiliares de `src/services/helpers/`.

---

## 1. Principios de Diseño de la Capa Service

1. **Núcleo de las Reglas de Negocio:** La capa de servicios concentra el 100% de la lógica de dominio: validación y hasheo de contraseñas, cálculo y salvaguarda de créditos de clases, algoritmos de disponibilidad y turnos libres con Luxon, control de solapamientos y orquestación de la persistencia.
2. **Aislamiento HTTP Absoluto:** Un servicio **nunca** interactúa con los objetos `req` ni `res` de Express, ni conoce códigos o cabeceras HTTP. Recibe tipos primitivos u objetos planos de JavaScript, y devuelve datos o promesas resueltas.
3. **Manejo Semántico de Excepciones:** Para interrumpir el flujo ante violaciones de negocio o datos inexistentes, arroja instancias tipadas de `src/errors/` (`ErrorDeNegocio`, `ErrorSaldoClasesInsuficiente`, `ErrorRegistroInexistente`, `ErrorAutenticacion`, `ErrorAutorizacion`, `ErrorFormatoDeFecha`).
4. **Desacoplamiento Horizontal Estricto:** Cada servicio es dueño exclusivo de su propio modelo de Mongoose. Si un servicio necesita validar o modificar otra entidad, **invoca al servicio correspondiente, nunca importa un modelo ajeno**:
   - `claseService` consume `alumnoService`, `profesorService` y `autoService`.
   - `autoService` y `profesorService` consumen `claseService` para conocer los turnos ocupados.
5. **Convención `null` vs `ErrorRegistroInexistente` (`404`):**
   - En operaciones CRUD directas (`obtenerPorId`, `actualizar`, `sumarSaldoClases`, `restarSaldoClases`), el servicio retorna `null` si no encuentra el recurso para que el controlador emita `404 Not Found`.
   - En operaciones compuestas de dominio (`agendar`, `eliminar`, o la gestión de disponibilidad docente), el servicio lanza directamente `ErrorRegistroInexistente` (`404`).
6. **Subcarpeta de Helpers Exclusivos (`src/services/helpers/`):** Aloja utilidades puras de dominio (`turnosYFechasHelper.js`, `disponibilidadHelper.js`, `manejoDePassword.js`, `validarMongooseObjId.js`).

---

## 2. Servicios Implementados

### 2.1. `authService.js`

- **Archivo:** `src/services/authService.js`
- **Modelo propio:** `Usuario`, `TokenRevocado`

Gestiona la autenticación, emisión de tokens JWT (24h) y cierre de sesión seguro mediante lista negra.

#### Funciones:

- **`login({ email, password })`**:
  1. Normaliza el correo electrónico (minúsculas y sin espacios laterales).
  2. Busca el usuario en MongoDB mediante `Usuario.findOne({ email })`. Si no existe, lanza `ErrorAutenticacion('Credenciales inválidas')`.
  3. Compara la contraseña en texto plano contra el hash almacenado con `bcrypt.compare`. Si no coincide, lanza `ErrorAutenticacion('Credenciales inválidas')`.
  4. Genera el JWT con vigencia de 24 horas (`expiresIn: '24h'`) firmado con `JWT_SECRET`, conteniendo en su payload `{ id, email, rol, NomApe }`.
  5. Retorna `{ token, usuario: { id, NomApe, email, rol } }`.

- **`logout(token)`**:
  1. Valida que `token` sea una cadena no vacía (`ErrorAutenticacion('Token no provisto')`).
  2. Verifica firma y expiración con `jwt.verify(token, secret)`. Si ya expiró naturalmente, retorna `{ mensaje: 'Sesión cerrada exitosamente' }` sin necesidad de persistir. Si fue adulterado, lanza `ErrorAutenticacion('Token inválido')`.
  3. Convierte el timestamp `exp` a objeto `Date` (`new Date(payload.exp * 1000)`).
  4. Persiste en `tokens_revocados` con `TokenRevocado.create({ token, expiraEn })`.
  5. **Idempotencia:** Si ocurre un error de clave duplicada (`err.code === 11000`), lo captura e ignora de forma segura.
  6. Retorna `{ mensaje: 'Sesión cerrada exitosamente' }`.

- **`esTokenRevocado(token)`**:
  - Consulta con `TokenRevocado.exists({ token })` y retorna un booleano indicando si el token está en lista negra.

---

### 2.2. `administradorService.js`

- **Archivo:** `src/services/administradorService.js`
- **Modelo propio:** `Administrador`

Administra el ciclo de vida de los administradores.

#### Funciones:

- **`crear(datos)`**: Valida que la contraseña tenga al menos 8 caracteres y la hashea (`validarYHashearPassword`), persistiendo el nuevo administrador con `Administrador.create`.
- **`listar()`**: Retorna la colección completa de administradores mediante `Administrador.find({})`.
- **`obtenerPorId(id)`**: Valida el formato con `validarMongooseObjId(id)` y busca con `Administrador.findById(id)`.
- **`actualizar(id, datos)`**: Valida `id`. Si incluye nueva `password`, la valida y hashea. Actualiza en MongoDB con `{ new: true, runValidators: true }`. *(No admite eliminación).*

---

### 2.3. `alumnoService.js`

- **Archivo:** `src/services/alumnoService.js`
- **Modelo propio:** `Alumno`

Gestiona el perfil de los alumnos y el balance de clases prácticas prepagas.

#### Funciones:

- **`crear(datos)`**: Valida y hashea la contraseña (`validarYHashearPassword`), creando el registro con `saldoClases: 0` si no fue provisto.
- **`listar()`**: Retorna todos los alumnos con `Alumno.find({})`.
- **`obtenerPorId(id)`**: Valida `id` con `validarMongooseObjId(id)` y busca con `Alumno.findById(id)`.
- **`actualizar(id, datos)`**: Valida `id`, hashea contraseña si viene en los datos y actualiza con `{ new: true, runValidators: true }`.
- **`sumarSaldoClases(id, { cantidad })`**:
  1. Valida `id`.
  2. Busca el alumno (`findById`). Si no existe, retorna `null`.
  3. Valida que `cantidad` sea un número entero mayor a 0 (`validarYCalcularSaldo`).
  4. Suma `cantidad` a `alumno.saldoClases` y persiste con `alumno.save()`.
- **`restarSaldoClases(id, { cantidad })`**:
  1. Valida `id`.
  2. Busca el alumno (`findById`). Si no existe, retorna `null`.
  3. Valida que `cantidad` sea entero mayor a 0.
  4. Comprueba que el saldo resultante no sea negativo. Si `saldoResultante < 0`, arroja `ErrorSaldoClasesInsuficiente`.
  5. Resta `cantidad` a `alumno.saldoClases` y persiste con `alumno.save()`.

---

### 2.4. `usuarioService.js`

- **Archivo:** `src/services/usuarioService.js`
- **Modelo propio:** `Usuario`

Consultas transversales de cuentas de usuario independientes del rol discriminado.

#### Funciones:

- **`obtenerPorId(id)`**: Valida `id` con `validarMongooseObjId(id)` y busca con `Usuario.findById(id)`.
- **`obtenerPorEmail(email)`**: Normaliza a minúsculas y busca con `Usuario.findOne({ email: emailNormalizado })`.

---

### 2.5. `autoService.js`

- **Archivo:** `src/services/autoService.js`
- **Modelo propio:** `Auto`
- **Servicios externos consultados:** `claseService`

Administra la flota vehicular y calcula la disponibilidad de autos por turnos horarios.

#### Funciones:

- **`crear(datos)`**: Persiste un nuevo auto con `Auto.create(datos)`.
- **`listar(cambios)`**: Si se especifica `cambios`, normaliza y valida contra `CAMBIOS_ENUM` (`MANUAL` o `AUTOMATICO`), filtrando con `Auto.find(filtro)`.
- **`obtenerPorId(id)`**: Valida `id` y busca con `Auto.findById(id)`.
- **`actualizar(id, datos)`**: Valida `id` y actualiza con `Auto.findByIdAndUpdate(..., { new: true, runValidators: true })`.
- **`obtenerAutosLibresEnTurno(inicio, fin, cambios)`**:
  1. Ejecuta en paralelo con `Promise.all`:
     - Consulta de la flota: `listar(cambios)`.
     - Clases dictadas en el intervalo: `claseService.listarEnIntervalo(inicio, fin)`.
  2. Extrae los IDs de autos ocupados en un `Set` para búsquedas en tiempo constante $O(1)$.
  3. Filtra y devuelve únicamente los vehículos no presentes en el `Set`.
- **`adjuntarAutosATurnos(turnos = [], cambios)`**:
  - Itera sobre un listado de turnos libres `{ inicio, fin }` e incrusta el array de `autos` disponibles calculados para cada uno.

---

### 2.6. `profesorService.js`

- **Archivo:** `src/services/profesorService.js`
- **Modelo propio:** `Profesor`
- **Servicios externos consultados:** `autoService`, `claseService`

Gestiona profesores, su agenda semanal cíclica y la búsqueda de turnos libres de 1 hora.

#### Funciones:

- **`crear(datos)`**: Valida que no incluya el campo `disponibilidad` (`verificarQueNoIncluyaDisponibilidad`) y persiste con `Profesor.create`.
- **`listar()`**: Retorna todos los profesores con `Profesor.find({})`.
- **`obtenerPorId(id)`**: Valida `id` y busca con `Profesor.findById(id)`.
- **`actualizar(id, datos)`**: Valida que no incluya `disponibilidad` y actualiza con `runValidators: true`.
- **`verDisponibilidad(id)`**: Busca el profesor (lanza `ErrorRegistroInexistente` si no existe) y retorna su subdocumento `disponibilidad`.
- **`agregarDisponibilidad(id, listaTramos)`**:
  1. Valida sintaxis y horas en punto de `listaTramos` (`validarEntradaTramosDisponibilidad`).
  2. Obtiene el profesor.
  3. Agrupa los tramos por día (`agruparTramosPorDia`).
  4. Para cada día, invoca `agregarTramosADia(tramosActuales, nuevosTramos)` (proyecta sobre `DIA_BASE_REFERENCIA` y fusiona solapamientos y contigüidades con `Interval.merge`).
  5. Guarda con `profesor.save()` y retorna el documento.
- **`quitarDisponibilidad(id, listaTramos)`**:
  1. Valida `listaTramos`.
  2. Agrupa los tramos por día.
  3. Para cada día, invoca `quitarTramosDeDia(tramosActuales, tramosAQuitar)` (recorta o divide tramos existentes con `interval.difference`).
  4. Guarda con `profesor.save()` y retorna el documento.
- **`obtenerTurnosLibres({ profesorId, fecha, cambios })`**:
  1. Valida `profesorId` y parsea `fecha` con `parsearFechaConsulta` (comprueba formato `YYYY-MM-DD` y que no sea fecha pasada).
  2. Obtiene el profesor.
  3. Obtiene los bloques de 1 hora configurados para ese día de la semana con `generarTurnosDeFecha` (descarta horas ya transcurridas si la fecha es hoy).
  4. Consulta las clases dictadas ese día mediante `claseService.listarPorFecha(fecha)`.
  5. Filtra los turnos ocupados del profesor con `filtrarTurnosOcupadosDelProfesor` evaluando solapamiento de intervalos (`seSuperponenIntervalos`).
  6. Para cada turno libre resultante, adjunta la lista de autos libres invocando `autoService.adjuntarAutosATurnos(turnosLibres, cambios)`.
  7. Retorna `{ turnos_libres: [...] }`.

---

### 2.7. `claseService.js`

- **Archivo:** `src/services/claseService.js`
- **Modelo propio:** `Clase`
- **Servicios externos consultados:** `alumnoService`, `profesorService`, `autoService`

Coordina el agendamiento y cancelación de clases prácticas de manejo con verificación integral de integridad.

#### Funciones:

- **`agendar(datosClase, usuarioActual)`**:
  1. **Validación de Identificadores:** Ejecuta `validarMongooseObjId` para `alumno`, `profesor` y `auto`.
  2. **Permisos de Agendamiento:** Comprueba mediante `verificarPermisoAgendamiento` que el usuario sea de rol `alumno` y agende para sí mismo.
  3. **Reglas de Horario:**
     - `verificarFechaFutura(inicio)`: El inicio debe ser estrictamente posterior al instante actual.
     - `validarIntervaloDeClase(inicio, fin)`: Ambos deben ser horas en punto (`:00`) y distar exactamente 1 hora (`DURACION_CLASE_HORAS = 1`).
  4. **Existencia de Entidades:** Comprueba en sus servicios respectivos (`alumnoService`, `profesorService`, `autoService`) que los 3 documentos existan en MongoDB (`ErrorRegistroInexistente` si alguno falta).
  5. **Verificación de Saldo:** Verifica que `alumno.saldoClases >= 1` (`verificarSaldoSuficiente`).
  6. **Cobertura Docente:** Comprueba mediante `estaDentroDeDisponibilidad` que el intervalo de la clase esté completamente cubierto (`engulfs`) por la disponibilidad del profesor proyectada en una ventana de 3 días (`proyectarDisponibilidadEnVentana`).
  7. **Ausencia de Superposiciones:** Ejecuta en paralelo con `Promise.all` tres consultas `Clase.exists` con `crearFiltroSuperposicion`:
     - Alumno no debe tener otra clase en ese intervalo.
     - Profesor no debe tener otra clase en ese intervalo.
     - Auto no debe tener otra clase en ese intervalo.
  8. **Débito de Saldo:** Descuenta 1 crédito mediante `alumnoService.restarSaldoClases(alumnoId, { cantidad: 1 })`.
  9. **Persistencia:** Crea la clase con `Clase.create(...)` y la retorna.

- **`eliminar(idClase, usuarioActual)`**:
  1. Valida `idClase` con `validarMongooseObjId(idClase)`.
  2. Busca la clase en MongoDB. Si no existe, lanza `ErrorRegistroInexistente('La clase solicitada no existe')`.
  3. Verifica con `verificarActorValido` que un alumno solo pueda cancelar sus propias clases (los administradores pueden cancelar cualquier clase).
  4. Reintegra 1 crédito de saldo al alumno mediante `alumnoService.sumarSaldoClases(clase.alumno.toString(), { cantidad: 1 })`.
  5. Elimina la clase físicamente con `Clase.findByIdAndDelete(idClase)`.
  6. Retorna el documento de la clase eliminada.

- **`obtenerPorId(idClase, usuarioActual)`**:
  - Valida `idClase`, busca con `findById` (retorna `null` si no existe) y aplica `verificarActorValido` para impedir accesos cruzados entre alumnos.

- **`listar(filtros, usuarioActual)`**:
  - Si `usuarioActual.rol === 'alumno'`, restringe forzosamente `filtroFinal.alumno = usuarioActual.id`. Si es administrador, aplica los filtros provistos sobre `Clase.find(filtroFinal)`.

- **`listarPorFecha(fecha)`**:
  - Retorna todas las clases de un día calendario usando búsqueda regex de prefijo: `{ inicio: { $regex: '^YYYY-MM-DDT' } }`.

- **`listarEnIntervalo(inicio, fin, filtroAdicional)`**:
  - Retorna todas las clases que se solapen con `[inicio, fin)` aplicando `crearFiltroSuperposicion`.

---

## 3. Helpers Exclusivos de Servicios (`src/services/helpers/`)

### 3.1. `validarMongooseObjId.js`
- **`validarMongooseObjId(id)`**: Comprueba que el parámetro cumpla con `mongoose.Types.ObjectId.isValid(id)`. Si es inválido o no es una cadena de 24 caracteres hexadecimales, lanza `ErrorMongooseObjIdInvalido` (**`400 Bad Request`**).

### 3.2. `manejoDePassword.js`
- **`validarPassword(password)`**: Verifica que sea un string con al menos 8 caracteres (`MIN_LONGITUD_PASSWORD = 8`). Lanza `ErrorPasswordInvalida` si no cumple.
- **`hashearPassword(password)`**: Hashea la contraseña con `bcrypt.hash(password, SALT_ROUNDS)` (10 rondas de salt).
- **`validarYHashearPassword(password)`**: Orquesta la validación y el hasheo en un solo paso.

### 3.3. `turnosYFechasHelper.js`
- **`parsearFechaHoraClase(fechaHoraStr)`**: Valida formato `"YYYY-MM-DDTHH:00"` con regex y parsea con Luxon `DateTime.fromISO` en hora local.
- **`validarIntervaloDeClase(inicioStr, finStr)`**: Verifica que las horas sean en punto y que `Interval.length('hours') === 1`.
- **`verificarFechaFutura(fechaHoraStr)`**: Lanza `ErrorDeNegocio` si la fecha de inicio es anterior o igual a `DateTime.now()`.
- **`parsearFechaConsulta(fechaStr)`**: Valida formato `"YYYY-MM-DD"`, verifica que exista en el calendario y que sea hoy o una fecha futura.
- **`generarTurnosDeFecha(fechaDateTime, tramosDelDia)`**: Genera intervalos continuos de 1 hora dividiendo cada tramo (`splitBy({ hours: 1 })`), descartando horas pasadas si la consulta es para el día en curso.
- **`seSuperponenIntervalos(inicioA, finA, inicioB, finB)`**: Determina si dos rangos se intersecan utilizando `Interval.overlaps`.
- **`crearFiltroSuperposicion(inicio, fin, filtroBase)`**: Construye la consulta de MongoDB `{ inicio: { $lt: fin }, fin: { $gt: inicio } }` para identificar clases solapadas en tiempo de base de datos.

### 3.4. `disponibilidadHelper.js`
- **`esHoraEnPuntoValida(horaStr)`**: Valida formato `"HH:00"` entre `"00:00"` y `"24:00"`.
- **`crearIntervaloDeTramo(diaBaseDateTime, tramo)`**: Proyecta un tramo horario `{ horaInicio, horaFin }` sobre una fecha de referencia (`DIA_BASE_REFERENCIA`). Si `horaFin` es `"24:00"`, Luxon lo proyecta naturalmente al inicio del día siguiente (`+ 24 hours`).
- **`convertirIntervaloATramo(diaBaseDateTime, intervalo)`**: Convierte un `Interval` nuevamente a `{ horaInicio, horaFin }`, restituyendo `"24:00"` si coincide con la medianoche del día siguiente.
- **`agregarTramosADia(tramosExistentes, nuevosTramos)`**: Convierte todos los tramos a intervalos de Luxon y ejecuta `Interval.merge()`, unificando tramos superpuestos o contiguos en bloques consolidados.
- **`quitarTramosDeDia(tramosExistentes, tramosAQuitar)`**: Aplica `interval.difference()` para recortar o partir en dos cualquier tramo afectado por el rango a remover.
- **`proyectarDisponibilidadEnVentana(disponibilidad, fechaCentralDateTime)`**: Proyecta la disponibilidad en una ventana de 3 días (`ayer`, `hoy`, `mañana`) para evaluar continuidad a medianoche sin cortes artificiales.
