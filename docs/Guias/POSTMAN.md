# Guía de Postman y Batería de Tests (DriveAndLearn Backend)

Esta guía explica cómo importar, configurar y ejecutar la colección de Postman con la **batería de pruebas automatizadas** creada para la API de **DriveAndLearn**.

---

## 1. Archivos Disponibles

Los archivos se encuentran en la raíz del proyecto y dentro de la carpeta `postman/`:
- **Colección:** [`DriveAndLearn.postman_collection.json`](file:///c:/Users/Fabrizio/Documents/Fabri/Educación/UTN%20INSPT/2026/PROGRAMACION%20III/segundo_parcial_driveandlearn/DriveAndLearn.postman_collection.json)
- **Variables de Entorno (Opcional):** [`DriveAndLearn.postman_environment.json`](file:///c:/Users/Fabrizio/Documents/Fabri/Educación/UTN%20INSPT/2026/PROGRAMACION%20III/segundo_parcial_driveandlearn/DriveAndLearn.postman_environment.json)

---

## 2. Métodos de Importación en Postman

Si experimentas problemas al importar arrastrando el archivo:

### Método A: Importar mediante Selección de Archivo (Recomendado)
1. Abre Postman y presiona el botón **Import** (arriba a la izquierda).
2. Haz clic en **files** y selecciona el archivo `DriveAndLearn.postman_collection.json`.
3. Haz clic en **Import**.

### Método B: Pegar Texto Plano (*Raw Text*)
Si Postman arroja error al leer el archivo en disco:
1. Abre el archivo `DriveAndLearn.postman_collection.json` en tu editor de código y copia todo su contenido (`Ctrl + A`, `Ctrl + C`).
2. En Postman, presiona el botón **Import**.
3. En el cuadro de texto o pestaña **Paste cURL, Raw text or URL**, pega el contenido (`Ctrl + V`).
4. Postman reconocerá automáticamente el formato `Collection v2.1` y habilitará el botón de importar.

---

## 3. Variables de la Colección

La colección cuenta con 4 variables configuradas a nivel de colección para facilitar la ejecución automática:

| Variable | Valor por Defecto | Propósito |
| :--- | :--- | :--- |
| **`baseUrl`** | `http://localhost:3000` | URL base del servidor Express. |
| **`token`** | *(dinámico)* | Almacena el token JWT emitido al hacer login exitoso. Se usa en `Authorization: Bearer {{token}}`. |
| **`adminId`** | *(dinámico)* | Almacena el `_id` de MongoDB del administrador creado durante las pruebas. |
| **`alumnoId`** | *(dinámico)* | Almacena el `_id` de MongoDB del alumno creado durante las pruebas. |

---

## 4. Estructura de la Batería de Pruebas

La colección está organizada en 4 carpetas con aserciones automatizadas (`pm.test`):

```text
Drive and Learn - API Test Suite/
├── 1. Administradores/
│   ├── 1.1 Crear Administrador Exitoso (201 - Captura adminId)
│   ├── 1.2 Crear Administrador - Error: Password < 8 Caracteres (400)
│   ├── 1.3 Crear Administrador - Error: Email Duplicado (400)
│   ├── 1.4 Crear Administrador - Error: Campos No Permitidos (400)
│   ├── 1.5 Listar Administradores (200 - Array)
│   ├── 1.6 Obtener Administrador por ID (200 - Compara con adminId)
│   ├── 1.7 Obtener Administrador - ID Inexistente (404)
│   ├── 1.8 Obtener Administrador - ID Inválido (400)
│   ├── 1.9 Actualizar Administrador Exitoso (200)
│   └── 1.10 Intentar Eliminar Administrador (404 - DELETE no expuesto)
├── 2. Alumnos/
│   ├── 2.1 Crear Alumno Exitoso con saldo (201 - Captura alumnoId)
│   ├── 2.2 Crear Alumno Exitoso con saldo default 0 (201)
│   ├── 2.3 Crear Alumno - Error: Password < 8 Caracteres (400)
│   ├── 2.4 Listar Alumnos (200 - Array)
│   ├── 2.5 Obtener Alumno por ID (200 - Compara con alumnoId)
│   ├── 2.6 Obtener Alumno - ID Inexistente (404)
│   ├── 2.7 Actualizar Alumno Exitoso (200)
│   ├── 2.8 Actualizar Alumno - Error: Modificar saldo vía PUT estándar (400)
│   └── 2.9 Intentar Eliminar Alumno (404 - DELETE no expuesto)
├── 3. Autenticación y Cierre de Sesión/
│   ├── 3.1 Login Exitoso (200 - Captura token JWT)
│   ├── 3.2 Login Fallido - Contraseña Incorrecta (401)
│   ├── 3.3 Login Fallido - Email Inexistente (401)
│   ├── 3.4 Login Fallido - Faltan Campos Obligatorios (400)
│   ├── 3.5 Logout Exitoso (200 - Registra en tokens_revocados)
│   ├── 3.6 Logout Fallido - Sin Cabecera Authorization (401)
│   └── 3.7 Reusar Token Revocado (401 - Bloqueo por lista negra)
└── 4. Control de Rutas Inexistentes/
    └── 4.1 Ruta Inexistente (404 - Mensaje "Ruta no encontrada")
```

---

## 5. Instrucciones de Uso en Postman

1. **Importar la Colección:**
   - Abre Postman.
   - Haz clic en el botón **Import** (esquina superior izquierda).
   - Arrastra el archivo [`DriveAndLearn.postman_collection.json`](file:///c:/Users/Fabrizio/Documents/Fabri/Educación/UTN%20INSPT/2026/PROGRAMACION%20III/segundo_parcial_driveandlearn/INSPT-Prog3-DriveAndLearn-backend/postman/DriveAndLearn.postman_collection.json).
2. **Iniciar el Servidor:**
   - Asegúrate de tener MongoDB levantado.
   - Inicia el backend con:
     ```bash
     npm run dev
     ```
3. **Ejecutar Toda la Batería (*Runner*):**
   - Haz clic derecho sobre la colección **Drive and Learn - API Test Suite** en Postman.
   - Selecciona **Run collection**.
   - Haz clic en **Run Drive and Learn...** para ejecutar todos los tests en secuencia.
   - Verás todas las pruebas pasando en verde (`PASS`).

---

## 6. Guía Rápida para Peticiones Manuales

Si prefieres realizar peticiones una por una manualmente desde pestañas nuevas en Postman (sin usar el *Runner* automático), a continuación dispones de la referencia rápida con las dos modalidades:
1. **Versión con Variables:** Utiliza las variables `{{baseUrl}}`, `{{token}}`, `{{adminId}}` y `{{alumnoId}}` definidas en la colección o en tu entorno de Postman.
2. **Versión sin Variables (Directa):** Utiliza URLs absolutas (`http://localhost:3000`), identificadores de prueba de MongoDB (`ObjectId`) y valores explícitos listos para copiar y pegar.

> [!NOTE]
> Para todas las peticiones con método `POST` o `PUT` que envíen datos, debes configurar en la pestaña **Headers** la cabecera `Content-Type: application/json` y seleccionar en la pestaña **Body** la opción **raw** con formato **JSON**.

---

### 6.1. Autenticación (`/api/auth`)

#### 1. Iniciar Sesión (Login)
Permite autenticarse en el sistema y obtener el token JWT necesario para rutas protegidas.

- **Método:** `POST`
- **Cabeceras:** `Content-Type: application/json`
- **Cuerpo (JSON):**
  ```json
  {
    "email": "admin@escuela.com",
    "password": "Password123"
  }
  ```

| Modalidad | URL | Cabecera Authorization |
| :--- | :--- | :--- |
| **Con Variables** | `{{baseUrl}}/api/auth/login` | *(Ninguna)* |
| **Sin Variables** | `http://localhost:3000/api/auth/login` | *(Ninguna)* |

- **Respuesta esperada (200 OK):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
- **Tip para Postman:** Copia el valor de la clave `token` devuelta para usarlo en la siguiente petición de Logout.

---

#### 2. Cerrar Sesión (Logout)
Invalida el token JWT agregándolo a la lista negra en base de datos (`tokens_revocados`).

- **Método:** `POST`
- **Cuerpo:** Vacío (ninguno)

| Modalidad | URL | Cabecera Authorization |
| :--- | :--- | :--- |
| **Con Variables** | `{{baseUrl}}/api/auth/logout` | `Bearer {{token}}` |
| **Sin Variables** | `http://localhost:3000/api/auth/logout` | `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` *(pegar token real)* |

- **Respuesta esperada (200 OK):**
  ```json
  {
    "mensaje": "Sesión cerrada correctamente"
  }
  ```
- **Comprobación:** Si vuelves a enviar la misma petición con ese mismo token revocado, el servidor responderá `401 Unauthorized` con el mensaje `"Token inválido o revocado"`.

---

### 6.2. Administradores (`/api/administradores`)

#### 3. Listar Administradores
Obtiene todos los administradores registrados en el sistema.

- **Método:** `GET`

| Modalidad | URL |
| :--- | :--- |
| **Con Variables** | `{{baseUrl}}/api/administradores` |
| **Sin Variables** | `http://localhost:3000/api/administradores` |

- **Respuesta esperada (200 OK):**
  ```json
  [
    {
      "_id": "6727dbf8c123456789abcdef",
      "NomApe": "Carlos Administrador",
      "email": "carlos.admin@escuela.com",
      "rol": "admin"
    }
  ]
  ```

---

#### 4. Crear Administrador
Da de alta un nuevo administrador. La contraseña debe tener al menos 8 caracteres.

- **Método:** `POST`
- **Cabeceras:** `Content-Type: application/json`
- **Cuerpo (JSON):**
  ```json
  {
    "NomApe": "Mariana López",
    "email": "mariana.lopez@escuela.com",
    "password": "PasswordSeguro123"
  }
  ```

| Modalidad | URL |
| :--- | :--- |
| **Con Variables** | `{{baseUrl}}/api/administradores` |
| **Sin Variables** | `http://localhost:3000/api/administradores` |

- **Respuesta esperada (201 Created):**
  ```json
  {
    "_id": "6727dbf8c123456789abcdef",
    "NomApe": "Mariana López",
    "email": "mariana.lopez@escuela.com",
    "rol": "admin"
  }
  ```

---

#### 5. Obtener Administrador por ID
Consulta el detalle de un administrador a partir de su `_id` de MongoDB (24 caracteres hexadecimales).

- **Método:** `GET`

| Modalidad | URL |
| :--- | :--- |
| **Con Variables** | `{{baseUrl}}/api/administradores/{{adminId}}` |
| **Sin Variables** | `http://localhost:3000/api/administradores/6727dbf8c123456789abcdef` |

- **Respuesta esperada (200 OK):**
  ```json
  {
    "_id": "6727dbf8c123456789abcdef",
    "NomApe": "Mariana López",
    "email": "mariana.lopez@escuela.com",
    "rol": "admin"
  }
  ```

---

#### 6. Actualizar Administrador
Modifica los datos permitidos (`NomApe`, `email`, `password`) de un administrador existente.

- **Método:** `PUT`
- **Cabeceras:** `Content-Type: application/json`
- **Cuerpo (JSON):**
  ```json
  {
    "NomApe": "Mariana López Modificada"
  }
  ```

| Modalidad | URL |
| :--- | :--- |
| **Con Variables** | `{{baseUrl}}/api/administradores/{{adminId}}` |
| **Sin Variables** | `http://localhost:3000/api/administradores/6727dbf8c123456789abcdef` |

- **Respuesta esperada (200 OK):**
  ```json
  {
    "_id": "6727dbf8c123456789abcdef",
    "NomApe": "Mariana López Modificada",
    "email": "mariana.lopez@escuela.com",
    "rol": "admin"
  }
  ```

> [!NOTE]
> **Eliminación no permitida:** Por regla de negocio, los administradores no se pueden borrar (`DELETE /api/administradores/:id` responderá `404 Ruta no encontrada`).

---

### 6.3. Alumnos (`/api/alumnos`)

#### 7. Listar Alumnos
Obtiene la lista completa de alumnos registrados.

- **Método:** `GET`

| Modalidad | URL |
| :--- | :--- |
| **Con Variables** | `{{baseUrl}}/api/alumnos` |
| **Sin Variables** | `http://localhost:3000/api/alumnos` |

- **Respuesta esperada (200 OK):**
  ```json
  [
    {
      "_id": "6727dc01c123456789abcdef",
      "NomApe": "Lucas Gómez",
      "email": "lucas.gomez@escuela.com",
      "rol": "alumno",
      "saldoClases": 5
    }
  ]
  ```

---

#### 8. Crear Alumno
Crea una nueva cuenta de alumno. El campo `saldoClases` es opcional (por defecto es `0`).

- **Método:** `POST`
- **Cabeceras:** `Content-Type: application/json`

**Opción A: Con saldo inicial de clases**
```json
{
  "NomApe": "Lucas Gómez",
  "email": "lucas.gomez@escuela.com",
  "password": "Password123",
  "saldoClases": 5
}
```

**Opción B: Sin saldo inicial (toma valor 0 por defecto)**
```json
{
  "NomApe": "Sofía Rossi",
  "email": "sofia.rossi@escuela.com",
  "password": "Password123"
}
```

| Modalidad | URL |
| :--- | :--- |
| **Con Variables** | `{{baseUrl}}/api/alumnos` |
| **Sin Variables** | `http://localhost:3000/api/alumnos` |

- **Respuesta esperada (201 Created):**
  ```json
  {
    "_id": "6727dc01c123456789abcdef",
    "NomApe": "Lucas Gómez",
    "email": "lucas.gomez@escuela.com",
    "rol": "alumno",
    "saldoClases": 5
  }
  ```

---

#### 9. Obtener Alumno por ID
Recupera los datos de un alumno a través de su identificador único `_id`.

- **Método:** `GET`

| Modalidad | URL |
| :--- | :--- |
| **Con Variables** | `{{baseUrl}}/api/alumnos/{{alumnoId}}` |
| **Sin Variables** | `http://localhost:3000/api/alumnos/6727dc01c123456789abcdef` |

- **Respuesta esperada (200 OK):**
  ```json
  {
    "_id": "6727dc01c123456789abcdef",
    "NomApe": "Lucas Gómez",
    "email": "lucas.gomez@escuela.com",
    "rol": "alumno",
    "saldoClases": 5
  }
  ```

---

#### 10. Actualizar Alumno
Permite modificar datos del perfil del alumno (`NomApe`, `email`, `password`).

- **Método:** `PUT`
- **Cabeceras:** `Content-Type: application/json`
- **Cuerpo (JSON):**
  ```json
  {
    "NomApe": "Lucas Gómez Actualizado"
  }
  ```

| Modalidad | URL |
| :--- | :--- |
| **Con Variables** | `{{baseUrl}}/api/alumnos/{{alumnoId}}` |
| **Sin Variables** | `http://localhost:3000/api/alumnos/6727dc01c123456789abcdef` |

- **Respuesta esperada (200 OK):**
  ```json
  {
    "_id": "6727dc01c123456789abcdef",
    "NomApe": "Lucas Gómez Actualizado",
    "email": "lucas.gomez@escuela.com",
    "rol": "alumno",
    "saldoClases": 5
  }
  ```

> [!WARNING]
> **Protección del saldo:** No intentes actualizar `saldoClases` a través de este endpoint general `PUT /api/alumnos/:id`. El DTO lo rechazará con código `400 Bad Request` indicando que el saldo solo puede alterarse mediante endpoints transaccionales específicos.
> Además, los alumnos no se pueden eliminar mediante `DELETE` (responderá `404 Ruta no encontrada`).

---

### 6.4. Tabla Resumen de Endpoints Disponibles

| Método | Endpoint | Cabecera Auth Requerida | Body Requerido | Códigos Posibles |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | No | Sí (`email`, `password`) | `200`, `400`, `401` |
| `POST` | `/api/auth/logout` | **Sí (`Bearer <token>`)** | No | `200`, `401` |
| `GET` | `/api/administradores` | No | No | `200` |
| `POST` | `/api/administradores` | No | Sí (`NomApe`, `email`, `password`) | `201`, `400` |
| `GET` | `/api/administradores/:id` | No | No | `200`, `400`, `404` |
| `PUT` | `/api/administradores/:id` | No | Sí (campos a actualizar) | `200`, `400`, `404` |
| `GET` | `/api/alumnos` | No | No | `200` |
| `POST` | `/api/alumnos` | No | Sí (`NomApe`, `email`, `password`, `[saldoClases]`) | `201`, `400` |
| `GET` | `/api/alumnos/:id` | No | No | `200`, `400`, `404` |
| `PUT` | `/api/alumnos/:id` | No | Sí (campos a actualizar) | `200`, `400`, `404` |

