# 🚗 Sistema de Gestión de Escuela de Manejo — DriveAndLearn

## Grupo
**ZEBOP!**

---

## 📋 Descripción del Proyecto

Desarrollo de un software de gestión integral para una escuela de manejo. La plataforma permitirá a los alumnos reservar clases de manejo y a los administradores gestionar los recursos de la escuela (profesores, autos y horarios).

El sistema se compone de una **API REST** (backend) y una aplicación web (frontend) que la consume. Esta propuesta describe el backend.

---

## 👥 Tipos de Usuarios

### 🎓 Alumnos

Los alumnos podrán:

1. Crearse una cuenta (registro público, sin token).
2. Iniciar sesión y obtener un token JWT.
3. Ver y editar su propio perfil (email, contraseña, nombre y apellido) y dar de baja su cuenta.
4. Reservar clases en los días y horarios en que la escuela esté abierta y el profesor esté disponible.
5. Elegir el profesor de cada clase.
6. Elegir si quieren usar un auto con cambios **manuales** o **automáticos**.
7. Ver, reprogramar y eliminar (cancelar) sus propias clases.

### 🔧 Administradores

Los administradores podrán:

1. Gestionar alumnos: listarlos, editarlos, darlos de baja y cargarles o descontarles clases disponibles.
2. Dar de alta profesores y editar su nombre.
3. Definir los horarios de disponibilidad de cada profesor.
4. Agregar autos y editar sus datos.
5. Poner y sacar a los autos de servicio.
6. Definir los días y horarios de clase de la escuela.
7. Ver, crear, reprogramar y eliminar las clases de cualquier alumno.
8. Gestionar otros administradores.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Lenguaje | **TypeScript** sobre **Node.js** (módulos ES) |
| Framework HTTP | **Express 5** |
| Base de datos | **MongoDB** |
| ODM | **Mongoose 9** (esquemas, validaciones y *discriminators*) |
| Autenticación | **JSON Web Tokens** con `jsonwebtoken` |
| Hash de contraseñas | **bcrypt** |
| Configuración | **dotenv** (variables en `.env`) |
| CORS | `cors` |
| Tests automáticos | **Vitest** + **Supertest** + **mongodb-memory-server** (Mongo en memoria) |

### Arquitectura en capas

```
Request → routes → middlewares (auth, validación) → controllers → DTOs → services → models (Mongoose) → MongoDB
                                                                                  ↓
                                                     errorHandler ← errores tipados (400 / 401 / 403 / 404 / 409)
```

- **routes:** mapean verbo + ruta a un controller y encadenan los middlewares.
- **middlewares:** autenticación JWT, autorización por rol y validación del cuerpo de la petición.
- **controllers:** traducen HTTP ↔ servicio y arman la respuesta.
- **DTOs:** validan qué campos y de qué tipo envía el cliente.
- **services:** contienen las reglas de negocio.
- **models:** esquemas de Mongoose de cada colección.

---

## 🗄️ Colecciones de MongoDB

El modelo se organiza en **usuarios (alumnos y administradores), profesores, autos y clases (reservas)**, más un documento con el horario de la escuela.

### `usuarios`

Guarda alumnos y administradores en una misma colección. Mongoose los distingue con un *discriminator* en el campo `rol`.

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | ObjectId | |
| `rol` | String | `"alumno"` o `"administrador"` |
| `email` | String | Obligatorio, único, en minúsculas, con formato válido |
| `password` | String | Hash de bcrypt. Nunca se devuelve en las respuestas |
| `nomApe` | String | Nombre y apellido, obligatorio |
| `clasesPorReservar` | Number | **Solo alumnos.** Saldo de clases disponibles (≥ 0) |
| `createdAt` / `updatedAt` | Date | Automáticos |

### `profesores`

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | ObjectId | |
| `nomApe` | String | Obligatorio |
| `disponibilidad` | Objeto | Calendario semanal: por cada día (`lunes` … `domingo`), una lista de tramos `{ horaInicio, horaFin }` |
| `createdAt` / `updatedAt` | Date | Automáticos |

### `autos`

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | ObjectId | |
| `marca` | String | |
| `modelo` | String | |
| `patente` | String | Obligatoria, única, en mayúsculas |
| `cambios` | String | `"MANUAL"` o `"AUTOMATICO"` |
| `activo` | Boolean | `true` si el auto está en servicio (por defecto `true`) |
| `createdAt` / `updatedAt` | Date | Automáticos |

### `clases` (reservas)

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | ObjectId | |
| `alumno` | ObjectId | Referencia a `usuarios` (alumno) |
| `profesor` | ObjectId | Referencia a `profesores` |
| `auto` | ObjectId | Referencia a `autos` |
| `inicio` | Date | Fecha y hora de inicio |
| `fin` | Date | Fecha y hora de fin (exactamente 1 hora después del inicio) |
| `createdAt` / `updatedAt` | Date | Automáticos |

### `horario_escuela`

Un único documento (`_id: "escuela"`) con el calendario semanal en que la escuela dicta clases. Tiene la misma estructura que la disponibilidad de los profesores.

---

## 🔐 Autenticación con JWT

1. **Registro:** el alumno se registra con `POST /api/alumnos` (sin token). La contraseña debe tener al menos 8 caracteres y se guarda hasheada con **bcrypt** (10 rondas).
2. **Login:** `POST /api/auth/login` con `{ email, password }`. Si las credenciales son correctas, la API devuelve:
   ```json
   {
     "token": "<jwt>",
     "usuario": { "id": "...", "email": "...", "nomApe": "...", "role": "alumno" }
   }
   ```
   Si no coinciden, responde **401** "Email o contraseña incorrectos".
3. **Token:** se firma con el algoritmo **HS256** y una clave secreta (`JWT_SECRET`, de al menos 32 caracteres, definida en `.env`). Contiene:
   - `sub`: el id del usuario.
   - `role`: `"alumno"` o `"administrador"`.
   - `iss` (`driveandlearn`) y `aud` (`driveandlearn-api`).
   - `exp`: vence a **1 hora** de emitido.
4. **Uso:** las rutas protegidas exigen el encabezado:
   ```
   Authorization: Bearer <token>
   ```
5. **Middlewares:**
   - `requireAuthentication`: verifica firma, algoritmo, emisor, audiencia y vencimiento. Si el token falta o no es válido, responde **401**.
   - `requireAdministrator`: exige rol administrador **y** que la cuenta siga existiendo en la base (un token de un administrador borrado deja de servir). Si no, responde **403**.
   - `requireSelfOrAdministrator`: permite el acceso a un administrador o al propio usuario sobre su `:id`. Un alumno que edita su perfil solo puede cambiar `email`, `password` y `nomApe`. Si no, responde **403**.


El primer administrador se crea con un script (`npm run admin:bootstrap`), ya que no hay registro público de administradores.

---

## 🛡️ Autorización por rol

| Recurso | Público | Alumno | Administrador |
|---|---|---|---|
| `POST /api/auth/login` | ✅ | ✅ | ✅ |
| `POST /api/alumnos` (registro) | ✅ | ✅ | ✅ |
| Alumnos: ver, editar, borrar | — | Solo su propia cuenta | Todos |
| Alumnos: listar, sumar/restar clases | — | — | ✅ |
| Profesores: listar y ver | — | ✅ | ✅ |
| Profesores: alta, edición y disponibilidad | — | — | ✅ |
| Autos: listar y ver | — | ✅ | ✅ |
| Autos: alta, edición, activar/desactivar | — | — | ✅ |
| Horario de la escuela: ver | — | ✅ | ✅ |
| Horario de la escuela: modificar | — | — | ✅ |
| Clases: listar, ver, crear, reprogramar, eliminar | — | Solo las propias | Todas |
| Administradores | — | — | ✅ |

---

## ✏️ Entidad con CRUD completo: **Alumnos**

La entidad sobre la que se implementa el **CRUD completo** es **Alumno** (colección `usuarios`, rol `alumno`). Las cuatro operaciones están protegidas con JWT según el rol:

| Operación | Método y ruta | Quién | Descripción |
|---|---|---|---|
| **Create** | `POST /api/alumnos` | Público | Registro de un alumno. El saldo de clases arranca en 0 |
| **Read** (todos) | `GET /api/alumnos` | Administrador | Lista todos los alumnos |
| **Read** (uno) | `GET /api/alumnos/:id` | Administrador o el propio alumno | Detalle de un alumno |
| **Update** | `PUT /api/alumnos/:id` | Administrador o el propio alumno | El alumno solo puede cambiar `email`, `password` y `nomApe` |
| **Delete** | `DELETE /api/alumnos/:id` | Administrador o el propio alumno | Baja de la cuenta |

Además, el administrador puede ajustar el saldo de clases con `PATCH /api/alumnos/:id/sumar-clases` y `PATCH /api/alumnos/:id/restar-clases`.

### Otros endpoints

- **Clases (reservas):** `GET /api/clases`, `GET /api/clases/:id`, `POST /api/clases`, `PUT /api/clases/:id` (reprogramar) y `DELETE /api/clases/:id` (eliminar: la clase se borra de la base). Ver, reprogramar y eliminar una clase exige ser el alumno de la clase o un administrador (403 si no).
- **Autos:** `GET /api/autos`, `GET /api/autos/:id`, `POST /api/autos`, `PUT /api/autos/:id` y `PATCH /api/autos/:id/activo` (poner o sacar de servicio).
- **Profesores:** `GET /api/profesores`, `GET /api/profesores/:id`, `POST /api/profesores`, `PATCH /api/profesores/:id/nom-ape`, `POST` y `DELETE /api/profesores/:id/disponibilidad`.
- **Horario de la escuela:** `GET /api/horario-escuela`, `PUT /api/horario-escuela`, `POST /api/horario-escuela/agregar`, `POST /api/horario-escuela/quitar` y `GET /api/horario-escuela/validar/:dia`.
- **Administradores:** CRUD en `/api/administradores`.

---

## 📐 Reglas de Negocio

Al **reservar una clase**:

1. La clase dura **exactamente una hora** y debe ser en una fecha **futura**.
2. Debe quedar dentro del **horario de la escuela** de ese día y no puede pasar de un día al siguiente.
3. Debe quedar dentro de la **disponibilidad del profesor** elegido.
4. El **auto** debe estar **activo** (en servicio).
5. No puede haber **superposición**: ni el alumno, ni el profesor, ni el auto pueden tener otra clase en ese horario.
6. El alumno debe tener **clases disponibles** (`clasesPorReservar ≥ 1`). Al reservar se le descuenta una.
7. Un alumno solo puede reservar para sí mismo. El administrador indica para qué alumno reserva.

Al **reprogramar o eliminar**:

8. Solo se pueden modificar clases que **todavía no comenzaron**. Al reprogramar se vuelven a validar las reglas 1 a 5.
9. Se puede **eliminar** cualquier clase, también una que ya ocurrió. Si todavía no había empezado, se le **devuelve** la clase al saldo del alumno; si ya empezó, se considera usada y no se devuelve.

Otras reglas:

10. El email de cada usuario y la patente de cada auto son **únicos**.
11. En los horarios, la hora de fin de cada tramo debe ser posterior a la de inicio.
12. Los horarios se interpretan en la zona horaria de la escuela (`America/Argentina/Buenos_Aires` por defecto).

### Manejo de errores

Todas las respuestas de error tienen el formato `{ "mensaje": "..." }` con el código HTTP correspondiente: **400** (datos inválidos), **401** (sin autenticación), **403** (sin permisos), **404** (no encontrado) y **409** (conflicto con una regla de negocio, por ejemplo un horario ocupado).

---

## 🔗 Repositorios

| Componente | Link |
|-----------|------|
| **Backend** | [INSPT-Prog3-DriveAndLearn-backend](https://github.com/SM03594/INSPT-Prog3-DriveAndLearn-backend) |
| **Frontend** | [INSPT-Prog3-DriveAndLearn-frontend](https://github.com/fabriziomanzopeluso/INSPT-Prog3-DriveAndLearn-frontend) |

---
