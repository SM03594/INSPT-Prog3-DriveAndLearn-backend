# Contexto del Proyecto: Drive and Learn 🚗📚

Este documento contiene el contexto integral, principios de diseño, stack tecnológico, reglas de negocio y convenciones de desarrollo del proyecto **Drive and Learn**. Sirve como guía de referencia estricta para el desarrollo asistido por **Gemini** y el equipo de desarrollo.

---

## 1. Visión General del Proyecto

- **Proyecto:** Drive and Learn (Sistema de Gestión para Escuela de Manejo).
- **Ámbito:** UTN INSPT — Programación III (Segundo Parcial).
- **Propósito:** Plataforma integral para la administración de una autoescuela. Permite a los alumnos gestionar su saldo y agendar clases prácticas según la disponibilidad de profesores y vehículos, y a los administradores gestionar la flota de autos, el plantel docente, sus horarios de disponibilidad y los usuarios del sistema.

---

## 2. Stack Tecnológico

El proyecto está construido íntegramente en el backend con **JavaScript Moderno**:

- **Lenguaje:** **JavaScript (Node.js)** utilizando **ECMAScript Modules (ESM)** nativos (`"type": "module"` en `package.json`, con `import` y `export`). *Nota:* No se utiliza TypeScript en el backend; se prioriza código JS limpio, modular y fuertemente validado.
- **Framework Web:** **Express 5.x** (aprovecha la resolución y captura nativa de errores en funciones controladoras asíncronas sin necesidad de envolver todo en `try/catch`).
- **Base de Datos y ODM:** **MongoDB** con **Mongoose 9.x** (esquemas estrictos, validaciones declarativas, referencias cruzadas por `ObjectId` y herencia con *discriminators* para usuarios).
- **Manejo de Fechas y Disponibilidad:** **Luxon** (`DateTime`, `Interval`) para validación de horarios en punto, cálculos de duraciones de clases (bloques de 1 hora), cruces de intervalos (`overlaps`) y verificación de disponibilidad semanal (`engulfs`).
- **Autenticación y Seguridad:** **JWT (`jsonwebtoken`)** para autenticación *stateless* basada en tokens, y **bcrypt** para el almacenamiento y validación de contraseñas con salting.
- **Testing:** **Vitest**, `mongodb-memory-server` (para bases de datos en memoria aisladas en pruebas) y `supertest` para pruebas de integración sobre los endpoints HTTP.
- **Herramientas de Entorno:** **dotenv** para variables de entorno (`.env`), con centralización en `src/config/env.js`.

---

## 3. Estilo de Programación y Buenas Prácticas

### 3.1. Nombres Descriptivos y Expresivos (Clean Code)
- **Claridad sobre brevedad:** Usar nombres autoexplicativos que comuniquen con precisión el propósito de cada variable, constante o función.
  - ✅ Bien: `passwordHasheada`, `datosActualizados`, `saldoResultante`, `validarYCalcularSaldo`, `CAMPOS_PERMITIDOS_CREAR`.
  - ❌ Mal: `p`, `data`, `res1`, `aux`, `val`, `temp`.
- **Idioma del dominio:** Se utiliza **español** para las entidades de negocio, atributos de modelos, mensajes de validación y nombres de métodos/funciones de dominio (`Alumno`, `sumarSaldoClases`, `obtenerPorId`, `disponibilidadSemanal`).
- **Constantes inmutables:** Las listas de campos permitidos, enums y roles se declaran con `UPPER_SNAKE_CASE` y se congelan con `Object.freeze()`.

### 3.2. Manejo de Errores Limpio y Centralizado
- **Jerarquía Semántica de Errores (`src/errors/`):**
  - `ErrorPeticionInvalida` (`400`): Error base para datos de entrada incorrectos (`ErrorCampoInvalido`, `ErrorDeTipo`, `ErrorMongooseObjIdInvalido`, `ErrorLecturaCuerpo`).
  - `ErrorDeNegocio` (`400`): Error base para reglas de dominio violadas (`ErrorPasswordInvalida`, `ErrorSaldoClasesInsuficiente`, etc.).
  - `ErrorAutenticacion` (`401`): Credenciales inválidas o ausencia de token.
  - `ErrorAutorizacion` (`403`): Acceso denegado por rol no autorizado.
- **Sin `try/catch` innecesarios:** Los controladores delegan la captura de excepciones asíncronas a Express 5, el cual las deriva automáticamente al middleware central `errorHandler.js`.
- **Formato unificado de respuesta de error:** Todo error devuelto por la API tiene la estructura JSON `{ "mensaje": "..." }`.

---

## 4. Arquitectura en Capas y Responsabilidad Única (SRP)

El sistema sigue un **flujo estrictamente unidireccional** donde cada componente cumple una única función bien delimitada:

```
Petición HTTP → [Routes] → [Middlewares] → [Controller & DTO] → [Service] → [Model] → MongoDB
```

### 4.1. Responsabilidades por Capa

| Capa | Directorio | Responsabilidad Única | Qué **NO** debe hacer |
| :--- | :--- | :--- | :--- |
| **Routes** | `src/routes/` | Declarar los endpoints HTTP (`GET`, `POST`, `PUT`, `DELETE`) y encadenar middlewares de autenticación/rol antes del controlador. | **No** debe contener lógica de negocio, validaciones ni consultas a la BD. |
| **DTOs** | `src/dtos/` | Validar la **estructura sintáctica y tipos** del `body` JSON recibido: qué campos son obligatorios, cuáles opcionales, cuáles desconocidos (no permitidos) y sus tipos primitivos (`string`, `number`, `boolean`). | **No** debe consultar la base de datos ni verificar reglas de negocio (ej. no valida si un saldo es suficiente ni hashea claves). |
| **Controllers** | `src/controllers/` | **Capa delgada HTTP:** Extrae datos de la petición (`req.params`, `req.body`, `req.user`), invoca la validación del DTO, delega la operación al Service y envía la respuesta HTTP (`res.status(200|201|204).json(...)`). | **No** debe interactuar con los Modelos de Mongoose, no debe usar `try/catch` manuales y no debe ejecutar lógica de negocio. |
| **Services** | `src/services/` | **Núcleo de Negocio:** Contiene toda la lógica de dominio, cálculos, validaciones complejas (fechas con Luxon, saldo suficiente, hashes con bcrypt, consistencia) e interacción con los Modelos de Mongoose. | **No** debe conocer los objetos de Express (`req`, `res`), no maneja códigos de estado HTTP ni cabeceras. Si ocurre un problema, lanza una instancia de `src/errors/`. |
| **Models** | `src/models/` | Definir los esquemas (`Schema`) de Mongoose, tipos de datos en base, restricciones a nivel de base de datos (`required`, `unique`, `match`, `min`), índices, transformaciones (`toJSON`) y discriminadores. | **No** debe contener casos de uso complejos de la aplicación ni coordinar otros modelos. |

### 4.2. Principio de Aislamiento de Helpers por Capa
Para evitar carpetas genéricas desordenadas, **cada capa posee su propia subcarpeta `helpers/`** para sus utilidades internas:
- `src/dtos/helpers/`: ej. `validarEstructuraYTipos.js` (escaneo de claves y tipos permitidos/requeridos).
- `src/services/helpers/`: ej. `manejoDePassword.js`, `validarMongooseObjId.js`, utilidades de calendario y cruces de turnos.
- `src/middlewares/helpers/`: ej. `verSiErrorLecturaCuerpo.js`.

---

## 5. Modelo de Dominio y Reglas del Negocio

### 5.1. Usuarios y Roles (`Usuario`, `Alumno`, `Administrador`)
- Se implementa herencia mediante discriminadores de Mongoose (`discriminatorKey: 'rol'`).
- **`Usuario` (Base):** `NomApe`, `email` (único, validado con regex), `password` (hasheada con bcrypt), `rol` (`'alumno'` o `'administrador'`). El método `toJSON` elimina automáticamente `password` y `__v`.
- **`Alumno` (Discriminador de Usuario):**
  - Atributo adicional: `saldoClases` (número entero `>= 0`, default `0`).
  - Capacidad: Comprar/recargar clases, consultar su saldo, listar sus clases agendadas y solicitar nuevas clases.
- **`Administrador` (Discriminador de Usuario):**
  - Capacidad: Crear/gestionar profesores, definir disponibilidad horaria, dar de alta/baja autos, modificar el saldo de los alumnos y supervisar todas las clases.

### 5.2. Flota de Vehículos (`Auto`)
- **Atributos:** `marca`, `modelo`, `patente` (única, formato argentino: tradicional `ABC123` o Mercosur `AB123CD`), `cambios` (`'MANUAL'` o `'AUTOMATICO'`), `activo` (`boolean`, default `true`).
- Un auto fuera de servicio (`activo: false`) no puede ser asignado a nuevas clases.

### 5.3. Plantel de Profesores (`Profesor`)
- **Atributos:** `NomApe`, `disponibilidad` (subdocumento con disponibilidad semanal de Lunes a Domingo, compuesto por tramos horarios con formato `HH:mm`).

### 5.4. Gestión de Clases (`Clase` — Entidad Principal del Parcial)
- **Atributos:** `alumno` (ObjectId `ref: Alumno`), `profesor` (ObjectId `ref: Profesor`), `auto` (ObjectId `ref: Auto`), `inicio` y `fin` (Strings con formato `YYYY-MM-DDTHH:MM`).
- **Reglas Críticas para Agendar una Clase:**
  1. **Saldo:** El alumno debe contar con `saldoClases >= 1`. Al agendar exitosamente, se resta 1 unidad; al cancelar, se reintegra.
  2. **Vehículo Activo:** El auto seleccionado debe estar activo (`activo === true`).
  3. **Disponibilidad Docente:** El tramo solicitado debe estar completamente contenido (`engulfs`) dentro de la disponibilidad horaria configurada para el profesor en ese día de la semana.
  4. **Sin Solapamientos:** La clase (duración estándar de 1 hora) no debe superponerse con ninguna otra clase existente para:
     - El mismo **alumno**.
     - El mismo **profesor**.
     - El mismo **auto**.

---

## 6. Estructura de Directorios

```text
INSPT-Prog3-DriveAndLearn-backend/
├── docs/                      # Guías y documentación detallada de stack y arquitectura
│   └── Guias/
│       ├── 01-STACK-TECNOLOGIAS.md
│       └── 02-ARQUITECTURA-CAPAS.md
├── src/
│   ├── config/                # db.js (Mongoose) y env.js (dotenv)
│   ├── constants/             # Enums: roles.js, cambios.js, etc.
│   ├── controllers/           # Controladores HTTP delgados (req/res)
│   ├── dtos/                  # Validadores de estructura y tipos
│   │   └── helpers/           # Helper validarEstructuraYTipos.js
│   ├── errors/                # Jerarquía de clases de error personalizadas
│   ├── middlewares/           # errorHandler.js, validarObjetoJson.js, authMiddleware.js
│   │   └── helpers/           # Helpers exclusivos de middlewares
│   ├── models/                # Schemas de Mongoose (Usuario, Alumno, Auto, Profesor, Clase)
│   ├── routes/                # Definición de rutas Express (/api/*)
│   ├── services/              # Casos de uso y lógica de negocio
│   │   └── helpers/           # Helpers de negocio (manejoDePassword, validarMongooseObjId)
│   ├── app.js                 # Ensamblado de Express, middlewares y rutas
│   └── server.js              # Inicialización de DB y escucha del puerto HTTP
├── tests/                     # Tests unitarios y de integración con Vitest
│   ├── helpers/               # setupTestDB.js con mongodb-memory-server
│   └── services/              # Tests de cada servicio
├── .env.example               # Plantilla de variables de entorno requeridas
├── package.json               # Configuración del proyecto y scripts
├── propuesta.md               # Propuesta y alcance del segundo parcial
└── vitest.config.js           # Configuración de Vitest
```

---

## 7. Instrucciones para Asistencia de Gemini

Cuando generes o refactorices código en este proyecto:
1. **JavaScript Nativo (ES Modules):** Usa siempre extensiones completas en las importaciones relativas (ej. `import Alumno from '../models/Alumno.js';`).
2. **Nombres Descriptivos:** Nunca uses variables de una letra o nombres crípticos. Nombra claramente en español coherente con el modelo (`alumnoEncontrado`, `claseSolicitada`, `horarioValido`).
3. **Respetar la Capa:**
   - Si creas un Controller, debe limitarse a validar con el DTO correspondiente, llamar al Service y responder HTTP.
   - Si creas un Service, nunca utilices `req` o `res`; lanza errores semánticos (`ErrorDeNegocio`, `ErrorPeticionInvalida`).
   - Si agregas una función auxiliar, colócala en el directorio `helpers/` de la capa correspondiente.
4. **Persistencia y Modelos:** Usa las validaciones declarativas de Mongoose y los discriminadores existentes.
5. **No inventar librerías externas:** Trabaja con las dependencias ya acordadas (`express`, `mongoose`, `luxon`, `bcrypt`, `jsonwebtoken`, `vitest`).

