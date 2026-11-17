# Guía de Rutas (DriveAndLearn Backend)

Esta guía documenta la capa **Routes** dentro de la arquitectura de **DriveAndLearn**, sus principios de diseño, el montaje en `src/app.js` y el detalle técnico de cada grupo de rutas implementado en la aplicación.

---

## 1. Principios de Diseño de la Capa Routes

1. **Responsabilidad Única (SRP):** Su única responsabilidad es asociar los endpoints HTTP (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) con sus correspondientes funciones del controlador, aplicando los middlewares necesarios de saneamiento sintáctico (`validarObjetoJson`) y de seguridad (`autenticar`, `verificarSiAdmin`, `verificarSiAdminOPropioUsuario`).
2. **Aislamiento Estricto:** Las rutas nunca procesan parámetros, no validan datos, no acceden a la base de datos ni generan respuestas HTTP directas (únicamente declaran el encadenamiento de middlewares y controladores).
3. **Montaje Centralizado en `src/app.js`:** Cada archivo de rutas se ubica en `src/routes/` con la convención `<recurso>Routes.js` y se acopla a Express bajo su prefijo canónico `/api/...`:
   - `/api/auth` $\rightarrow$ `authRoutes.js`
   - `/api/administradores` $\rightarrow$ `administradorRoutes.js`
   - `/api/alumnos` $\rightarrow$ `alumnoRoutes.js`
   - `/api/autos` $\rightarrow$ `autoRoutes.js`
   - `/api/profesores` $\rightarrow$ `profesorRoutes.js`
   - `/api/clases` $\rightarrow$ `claseRoutes.js`
4. **Preservación Histórica:** Las entidades maestras (`Administrador`, `Alumno`, `Auto`, `Profesor`) **no exponen rutas `DELETE`**. Si un cliente invoca `DELETE` sobre ellas, `src/app.js` responderá `404 Not Found` (`{ "mensaje": "Ruta no encontrada" }`). La cancelación con eliminación física está reservada exclusivamente para `Clase`.

---

## 2. Grupos de Rutas Implementados

### 2.1. `administradorRoutes.js`

- **Prefijo base:** `/api/administradores`
- **Archivo:** `src/routes/administradorRoutes.js`
- **Seguridad:** Todas las operaciones requieren autenticación y rol de administrador.

| Método | Ruta | Middlewares Previos | Controlador Asociado | Descripción | Status Exitoso |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | `autenticar`, `verificarSiAdmin` | `administradorController.listar` | Obtiene el listado completo de administradores registrados. | `200 OK` |
| `GET` | `/:id` | `autenticar`, `verificarSiAdmin` | `administradorController.obtener` | Obtiene los datos de un administrador específico por su ID. | `200 OK` |
| `POST` | `/` | `autenticar`, `verificarSiAdmin`, `validarObjetoJson` | `administradorController.crear` | Da de alta un nuevo administrador validando su cuerpo JSON. | `201 Created` |
| `PUT` | `/:id` | `autenticar`, `verificarSiAdmin`, `validarObjetoJson` | `administradorController.actualizar` | Modifica los datos de un administrador existente por su ID. | `200 OK` |

> [!NOTE]
> **Sin endpoint `DELETE`:** Siguiendo las reglas de preservación e integridad del sistema, los administradores no cuentan con endpoint de borrado (`DELETE /api/administradores/:id`).

---

### 2.2. `alumnoRoutes.js`

- **Prefijo base:** `/api/alumnos`
- **Archivo:** `src/routes/alumnoRoutes.js`
- **Seguridad:** Alta pública para registro; operaciones individuales protegidas con `verificarSiAdminOPropioUsuario`; gestión de saldo y listado general restringidos a administradores.

| Método | Ruta | Middlewares Previos | Controlador Asociado | Descripción | Status Exitoso |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | `autenticar`, `verificarSiAdmin` | `alumnoController.listar` | Obtiene el listado de todos los alumnos registrados con su saldo de clases. | `200 OK` |
| `GET` | `/:id` | `autenticar`, `verificarSiAdminOPropioUsuario` | `alumnoController.obtener` | Obtiene el detalle y saldo de un alumno (admin o propio alumno). | `200 OK` |
| `POST` | `/` | `validarObjetoJson` | `alumnoController.crear` | Registro público de un nuevo alumno en la plataforma. | `201 Created` |
| `PUT` | `/:id` | `autenticar`, `verificarSiAdminOPropioUsuario`, `validarObjetoJson` | `alumnoController.actualizar` | Modifica datos personales (`NomApe`, `email`, `password`) de un alumno. | `200 OK` |
| `PATCH` | `/:id/saldo/sumar` | `autenticar`, `verificarSiAdmin`, `validarObjetoJson` | `alumnoController.sumarSaldoClases` | Incrementa el saldo de clases prácticas del alumno en `{ "cantidad": N }`. | `200 OK` |
| `PATCH` | `/:id/saldo/restar` | `autenticar`, `verificarSiAdmin`, `validarObjetoJson` | `alumnoController.restarSaldoClases` | Decrementa el saldo de clases prácticas del alumno en `{ "cantidad": N }`. | `200 OK` |

> [!IMPORTANT]
> **Protección de Saldo:** El campo `saldoClases` no puede modificarse mediante `PUT /api/alumnos/:id`. Únicamente se altera mediante los endpoints dedicados `PATCH .../saldo/sumar` y `/restar` (restringidos a administradores) o durante el agendamiento y cancelación de clases.

---

### 2.3. `authRoutes.js`

- **Prefijo base:** `/api/auth`
- **Archivo:** `src/routes/authRoutes.js`
- **Seguridad:** Gestión de credenciales y revocación de sesiones.

| Método | Ruta | Middlewares Previos | Controlador Asociado | Descripción | Status Exitoso |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/login` | `validarObjetoJson` | `authController.login` | Autentica con `email` y `password`, emitiendo token JWT (24h) y perfil. | `200 OK` |
| `POST` | `/logout` | `autenticar` | `authController.logout` | Revoca el token JWT actual incorporándolo a `tokens_revocados`. | `200 OK` |

---

### 2.4. `autoRoutes.js`

- **Prefijo base:** `/api/autos`
- **Archivo:** `src/routes/autoRoutes.js`
- **Seguridad:** Endpoints de consulta abiertos para permitir a los alumnos visualizar la flota; endpoints de creación y edición reservados a administradores.

| Método | Ruta | Middlewares Previos | Controlador Asociado | Descripción | Status Exitoso |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | — | `autoController.listar` | Lista todos los autos de la flota. Admite filtro opcional `?cambios=MANUAL` o `AUTOMATICO`. | `200 OK` |
| `GET` | `/:id` | — | `autoController.obtener` | Obtiene la ficha de un auto por su ID (`marca`, `modelo`, `patente`, `cambios`). | `200 OK` |
| `POST` | `/` | `autenticar`, `verificarSiAdmin`, `validarObjetoJson` | `autoController.crear` | Da de alta un nuevo vehículo en la flota. Valida patente argentina. | `201 Created` |
| `PUT` | `/:id` | `autenticar`, `verificarSiAdmin`, `validarObjetoJson` | `autoController.actualizar` | Modifica los datos de un vehículo existente. | `200 OK` |

---

### 2.5. `profesorRoutes.js`

- **Prefijo base:** `/api/profesores`
- **Archivo:** `src/routes/profesorRoutes.js`
- **Seguridad:** Lectura general, disponibilidad y turnos libres públicos; alta, edición básica y modificación de tramos horarios reservados a administradores.

| Método | Ruta | Middlewares Previos | Controlador Asociado | Descripción | Status Exitoso |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | — | `profesorController.listar` | Lista todos los profesores registrados. | `200 OK` |
| `GET` | `/:id` | — | `profesorController.obtener` | Obtiene los datos de un profesor por su ID. | `200 OK` |
| `GET` | `/:id/disponibilidad` | — | `profesorController.verDisponibilidad` | Consulta la grilla semanal de disponibilidad (`lunes` a `domingo`). | `200 OK` |
| `GET` | `/:id/turnos-libres` | — | `profesorController.verTurnosLibres` | Consulta turnos disponibles de 1h con autos libres (`?fecha=YYYY-MM-DD&cambios=...`). | `200 OK` |
| `POST` | `/` | `autenticar`, `verificarSiAdmin`, `validarObjetoJson` | `profesorController.crear` | Da de alta un profesor (no admite campo `disponibilidad`). | `201 Created` |
| `PUT` | `/:id` | `autenticar`, `verificarSiAdmin`, `validarObjetoJson` | `profesorController.actualizar` | Modifica `NomApe` del profesor (no admite campo `disponibilidad`). | `200 OK` |
| `PATCH` | `/:id/disponibilidad/agregar` | `autenticar`, `verificarSiAdmin`, `validarObjetoJson` | `profesorController.agregarDisponibilidad` | Agrega tramos y fusiona solapamientos (`Interval.merge`). | `200 OK` |
| `PATCH` | `/:id/disponibilidad/quitar` | `autenticar`, `verificarSiAdmin`, `validarObjetoJson` | `profesorController.quitarDisponibilidad` | Recorta o divide tramos horarios (`interval.difference`). | `200 OK` |

> [!IMPORTANT]
> **Aislamiento de la Disponibilidad:** Ni `POST /api/profesores` ni `PUT /api/profesores/:id` aceptan el campo `disponibilidad`. La agenda solo se gestiona mediante los endpoints dedicados `PATCH .../agregar` y `PATCH .../quitar`.

---

### 2.6. `claseRoutes.js`

- **Prefijo base:** `/api/clases`
- **Archivo:** `src/routes/claseRoutes.js`
- **Seguridad:** Todas las operaciones requieren cabecera `Authorization: Bearer <token>`.

| Método | Ruta | Middlewares Previos | Controlador Asociado | Descripción | Status Exitoso |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | `autenticar` | `claseController.listar` | Lista clases con filtros opcionales (`?profesor=`, `?auto=`, `?alumno=`, `?fecha=`). Si es alumno solo puede ver las suyas (`403` si consulta a otro); si es admin, lista todas o filtra. | `200 OK` |
| `GET` | `/:id` | `autenticar` | `claseController.obtener` | Obtiene el detalle de una clase (el alumno solo puede ver las suyas). | `200 OK` |
| `POST` | `/` | `autenticar`, `validarObjetoJson` | `claseController.agendar` | Agenda una clase inyectando el ID del alumno desde el token. Descuenta 1 crédito. | `201 Created` |
| `DELETE` | `/:id` | `autenticar` | `claseController.eliminar` | Cancela la clase, reintegra 1 crédito al alumno y elimina el registro de la BD. | `200 OK` |

> [!NOTE]
> **Único Recurso con Eliminación Física:** `Clase` es la única entidad que implementa `DELETE`, representando el caso de uso de cancelación de turnos con reintegro automático de crédito de saldo.

---

## 3. Manejo de Rutas Inexistentes (Catch-All)

En `src/app.js`, al final de todos los enrutadores montados bajo `/api`, se define un middleware catch-all:

```javascript
app.use((_req, res) => {
  res.status(404).json({ mensaje: 'Ruta no encontrada' });
});
```

Cualquier método HTTP o ruta que no coincida exactamente con las declaradas responderá un status **`404 Not Found`** uniforme.
