# 01 — Stack de Tecnologías (DriveAndLearn Backend)

Esta guía describe las tecnologías, librerías y herramientas utilizadas en el backend de **DriveAndLearn**, junto con el propósito que cumple cada una dentro de la arquitectura del proyecto.

---

## 1. Entorno de Ejecución y Lenguaje

- **Node.js (v20+) + JavaScript Moderno (ES Modules):**
  - El proyecto utiliza módulos nativos de ECMAScript (`"type": "module"` en [package.json](file:///home/wolf753/Proyectos/sandbox-docker/agy-env/INSPT-Prog3-DriveAndLearn-backend/package.json)), empleando `import` y `export` estándar en lugar de CommonJS (`require`).
  - Modo de desarrollo con recarga automática nativa mediante `node --watch src/server.js`.
  - Todas las importaciones relativas internas incluyen obligatoriamente la extensión `.js`.

---

## 2. Dependencias de Producción (`dependencies`)

| Paquete | Versión | Rol en el Proyecto |
| :--- | :--- | :--- |
| **`express`** | `^5.2.1` | Framework HTTP para construir la API REST (enrutamiento, middlewares y captura nativa de promesas rechazadas en controladores y middlewares `async` sin requerir bloques `try/catch` redundantes). |
| **`mongoose`** | `^9.9.4` | ODM (*Object Document Mapper*) para **MongoDB**. Permite definir esquemas declarativos (`strictQuery: true`), validaciones a nivel de modelo, subdocumentos sin `_id`, relaciones (`ObjectId` + `ref`), índice TTL y herencia mediante discriminadores (`Usuario` $\rightarrow$ `Alumno` y `Administrador`). Compatible con instancias locales de MongoDB y clústeres en la nube (**MongoDB Atlas** vía `mongodb+srv://...`). |
| **`luxon`** | `^3.5.0` | Librería para el manejo de fechas, horas e intervalos (`DateTime`, `Interval`) en hora local (`America/Argentina/Buenos_Aires`) sin desplazamiento a UTC. Se utiliza para validar horas en punto, duraciones de 1 hora, fechas futuras (`verificarFechaFutura`), fusión de tramos continuos a través de medianoche (`Interval.merge`), recorte de franjas (`interval.difference`) y cobertura semanal (`engulfs`). |
| **`bcrypt`** | `^6.0.0` | Librería para el hasheo seguro de contraseñas con *salt* (`SALT_ROUNDS = 10`) antes de persistirlas en la base de datos y su posterior verificación durante el inicio de sesión. |
| **`jsonwebtoken`** | `^9.0.3` | Generación y verificación de tokens **JWT** para autenticación *stateless* y control de acceso basado en roles (`ROLES.ADMINISTRADOR` y `ROLES.ALUMNO`) con vigencia de 24 horas. |
| **`cors`** | `^2.8.6` | Middleware de Express para habilitar *Cross-Origin Resource Sharing* y permitir la comunicación segura con clientes web o móviles. |
| **`dotenv`** | `^17.4.2` | Carga de variables de entorno desde el archivo `.env` (`PORT`, `MONGODB_URI`, `JWT_SECRET`, `ZONA_HORARIA`, credenciales de bootstrap) hacia [env.js](file:///home/wolf753/Proyectos/sandbox-docker/agy-env/INSPT-Prog3-DriveAndLearn-backend/src/config/env.js). |

---

## 3. Dependencias de Desarrollo y Testing (`devDependencies`)

| Paquete | Versión | Rol en el Proyecto |
| :--- | :--- | :--- |
| **`vitest`** | `^4.1.11` | Framework de testing unitario y de integración ultrarrápido con soporte nativo para ES Modules (`npm test` / `npm run test:run`). |
| **`@vitest/ui`** | `^4.1.11` | Interfaz visual en navegador para inspeccionar, filtrar y depurar la ejecución de los tests de Vitest. |
| **`@vitest/coverage-v8`** | `^4.1.11` | Proveedor de métricas de cobertura de código basado en el motor V8. |
| **`mongodb-memory-server`** | `^11.2.0` | Levanta un servidor real de MongoDB en memoria durante las pruebas automatizadas ([setupTestDB.js](file:///home/wolf753/Proyectos/sandbox-docker/agy-env/INSPT-Prog3-DriveAndLearn-backend/tests/helpers/setupTestDB.js)), posibilitando tests rápidos, aislados y sin requerir una base de datos externa. |
| **`supertest`** | `^7.2.2` | Cliente HTTP para evaluar los endpoints de la aplicación Express ([app.js](file:///home/wolf753/Proyectos/sandbox-docker/agy-env/INSPT-Prog3-DriveAndLearn-backend/src/app.js)) de extremo a extremo sin necesidad de levantar un socket de red real. |

---

## 4. Herramientas de Integración y Pruebas Externas

El proyecto incluye en `docs/tests-postman/` una suite de pruebas para clientes HTTP y pipelines de CI/CD:

- **Colección de Postman:** `DriveAndLearn.postman_collection.json` (cubre flujos de autenticación, gestión de flota, disponibilidad docente, consulta de turnos libres y reserva/cancelación de clases).
- **Entorno Local:** `DriveAndLearn-Local.postman_environment.json` (`baseUrl: http://localhost:3000`).
- **Entorno Remoto:** `DriveAndLearn-Remoto.postman_environment.json` (para pruebas sobre servidores desplegados en la nube).

---

## 5. Resumen de Scripts Disponibles (`package.json`)

- **`npm run dev`**: Inicia el servidor en modo desarrollo con recarga en caliente ante cambios de código (`node --watch src/server.js`).
- **`npm start`**: Inicia el servidor en modo producción (`node src/server.js`).
- **`npm test`**: Ejecuta la suite de Vitest en modo interactivo (*watch*).
- **`npm run test:run`**: Ejecuta todas las pruebas unitarias y de integración de Vitest una única vez.
- **`npm run admin:desde-env`**: Script de inicialización que registra en MongoDB al usuario administrador inicial a partir de las credenciales configuradas en `.env` ([bootstrapAdminDesdeEnv.js](file:///home/wolf753/Proyectos/sandbox-docker/agy-env/INSPT-Prog3-DriveAndLearn-backend/src/scripts/bootstrapAdminDesdeEnv.js)).
