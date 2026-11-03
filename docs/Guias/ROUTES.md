# Guía de Rutas (DriveAndLearn Backend)

Esta guía documenta la capa **Routes** dentro de la arquitectura de **DriveAndLearn**, sus principios de diseño y el detalle técnico de cada grupo de rutas implementado.

---

## 1. Principios de Diseño de la Capa Routes

1. **Responsabilidad Única (SRP):** Su única responsabilidad es asociar los endpoints HTTP (`GET`, `POST`, `PUT`, `DELETE`) con sus correspondientes funciones del controlador, aplicando los middlewares necesarios de validación de estructura (`validarObjetoJson`) o de seguridad (`autenticar`, `autorizarRol`).
2. **Sin lógica de negocio ni manipulación de datos:** Las rutas nunca deben procesar datos, acceder a la base de datos ni generar respuestas HTTP directas (excepto la delegación a middlewares y controladores).
3. **Prefijos centralizados en `app.js`:** Las rutas se definen de forma relativa a su recurso en cada archivo `.routes.js` y se montan bajo el prefijo correspondiente (ej. `/api/administradores`) en `app.js`.

---

## 2. Rutas Implementadas

### 2.1. `administrador.routes.js`

Gestiona los endpoints para el recurso de administradores bajo el prefijo base `/api/administradores`.

| Método | Ruta | Middlewares Previos | Controlador Asociado | Descripción | Status Exitoso |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | — | `administradorController.listar` | Obtiene el listado completo de administradores registrados. | `200 OK` |
| `GET` | `/:id` | — | `administradorController.obtener` | Obtiene los detalles de un administrador específico por su ID. | `200 OK` |
| `POST` | `/` | `validarObjetoJson` | `administradorController.crear` | Da de alta un nuevo administrador validando su cuerpo JSON. | `201 Created` |
| `PUT` | `/:id` | `validarObjetoJson` | `administradorController.actualizar` | Modifica los datos de un administrador existente por su ID. | `200 OK` |

> [!NOTE]
> **Sin endpoint `DELETE`:** Siguiendo las reglas de integridad histórica del sistema, los administradores no cuentan con endpoint de borrado (`DELETE /api/administradores/:id`). Si se invoca, el servidor responderá automáticamente `404 Ruta no encontrada` al no estar definida.

---

### 2.2. `alumno.routes.js`

Gestiona los endpoints para el recurso de alumnos bajo el prefijo base `/api/alumnos`.

| Método | Ruta | Middlewares Previos | Controlador Asociado | Descripción | Status Exitoso |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | — | `alumnoController.listar` | Obtiene el listado de todos los alumnos registrados junto con su saldo de clases. | `200 OK` |
| `GET` | `/:id` | — | `alumnoController.obtener` | Obtiene el detalle y saldo de un alumno específico mediante su ID de MongoDB. | `200 OK` |
| `POST` | `/` | `validarObjetoJson` | `alumnoController.crear` | Registra un nuevo alumno validando cuerpo JSON, campos obligatorios y formato. | `201 Created` |
| `PUT` | `/:id` | `validarObjetoJson` | `alumnoController.actualizar` | Modifica los datos personales (`NomApe`, `email`, `password`) de un alumno. | `200 OK` |

> [!NOTE]
> **Sin endpoint `DELETE`:** Al igual que en administradores, los alumnos no poseen ruta de eliminación (`DELETE /api/alumnos/:id`) para garantizar la trazabilidad académica e histórica de las clases en las que participan.


