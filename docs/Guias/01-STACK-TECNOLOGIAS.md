# 01 — Stack de Tecnologías (DriveAndLearn Backend)

Esta guía describe las tecnologías, librerías y herramientas utilizadas en el backend de **DriveAndLearn**, junto con el propósito que cumple cada una dentro de la arquitectura del proyecto.

---

## 1. Entorno de Ejecución y Lenguaje

- **Node.js + JavaScript Moderno (ES Modules):**
  - El proyecto utiliza módulos nativos de ECMAScript (`"type": "module"` en `package.json`), empleando `import` y `export` estándar en lugar de CommonJS (`require`).
  - Modo de desarrollo con recarga automática nativa mediante `node --watch src/server.js`.

---

## 2. Dependencias de Producción (`dependencies`)

| Paquete | Versión | Rol en el Proyecto |
| :--- | :--- | :--- |
| **`express`** | `^5.2.1` | Framework HTTP para construir la API REST (enrutamiento, middlewares y manejo nativo de promesas rechazadas en controladores `async` sin necesidad de `try/catch`). |
| **`mongoose`** | `^9.9.4` | ODM (*Object Document Mapper*) para **MongoDB**. Permite definir esquemas, validaciones a nivel de modelo, relaciones (`ObjectId` + `ref`) y herencia mediante *discriminators* (`Usuario` → `Alumno` y `Administrador`). |
| **`luxon`** | `^3.5.0` | Librería para el manejo de fechas, horas e intervalos (`DateTime`, `Interval`). Se utiliza en la capa de servicios para validar horarios en punto, calcular duraciones exactas de 1 hora, fusionar bloques continuos en medianoche (`Interval.merge`) y verificar disponibilidad semanal (`engulfs` / `overlaps`). |
| **`bcrypt`** | `^6.0.0` | Librería para el hasheo seguro de contraseñas con *salt* antes de almacenarlas en la base de datos y su posterior comparación durante el inicio de sesión. |
| **`jsonwebtoken`** | `^9.0.3` | Generación y verificación de tokens **JWT** para la autenticación *stateless* y control de acceso por roles (`alumno` y `administrador`). |
| **`cors`** | `^2.8.6` | Middleware de Express para habilitar *Cross-Origin Resource Sharing* y permitir que el frontend consuma la API. |
| **`dotenv`** | `^17.4.2` | Carga de variables de entorno desde el archivo `.env` (`PORT`, `MONGODB_URI`, `JWT_SECRET`, credenciales de bootstrap, etc.) hacia `src/config/env.js`. |

---

## 3. Dependencias de Desarrollo y Testing (`devDependencies`)

| Paquete | Versión | Rol en el Proyecto |
| :--- | :--- | :--- |
| **`vitest`** | `^4.1.11` | Framework de testing rápido compatible con ES Modules para ejecutar las pruebas unitarias y de integración (`npm test` / `npm run test:run`). |
| **`@vitest/ui`** | `^4.1.11` | Interfaz visual en navegador para inspeccionar y depurar la ejecución de los tests de Vitest. |
| **`@vitest/coverage-v8`** | `^4.1.11` | Proveedor de cobertura de código basado en V8 para medir qué porcentaje del proyecto está cubierto por tests. |
| **`mongodb-memory-server`** | `^11.2.0` | Levanta una instancia real de MongoDB en memoria durante la ejecución de los tests (`setupTestDB`), permitiendo probar servicios y modelos de forma rápida, aislada y sin tocar una base de datos externa. |
| **`supertest`** | `^7.2.2` | Cliente HTTP de pruebas para testear los endpoints de la aplicación Express (`src/app.js`) de punta a punta sin necesidad de escuchar en un puerto de red real. |

---

## 4. Resumen de Scripts Disponibles (`package.json`)

- **`npm run dev`**: Inicia el servidor en modo desarrollo con `--watch`.
- **`npm start`**: Inicia el servidor en modo producción (`node src/server.js`).
- **`npm test`**: Ejecuta Vitest en modo interactivo (*watch*).
- **`npm run test:run`**: Ejecuta toda la suite de tests una sola vez.
- **`npm run admin:bootstrap`** / **`npm run admin:desde-env`**: Scripts para la creación del usuario administrador inicial.
