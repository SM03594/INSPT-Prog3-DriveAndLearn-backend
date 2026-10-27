# 🚗 Sistema de Gestión de Escuela de Manejo

## Grupo
**ZEBOP!**

---

## 📋 Descripción del Proyecto

Desarrollo de un software de gestión integral para una escuela de manejo. La plataforma permitirá a alumnos agendar clases y a administradores gestionar recursos y horarios de manera eficiente.

---

## 👥 Tipos de Usuarios

### 🎓 Alumnos

Los alumnos podrán:

1. Crearse una cuenta
2. Iniciar sesión y agendar clases en horarios disponibles
3. Elegir un auto manual o automático y un profesor
4. Consultar, modificar o cancelar sus clases

### 🔧 Administradores

Los administradores podrán:

1. Agregar y quitar profesores
2. Agregar y quitar autos
3. Definir los horarios de disponibilidad de los profesores
4. Poner y sacar a los autos de servicio
5. Definir los días y horarios de clase de la escuela

---

## 🧰 Stack tecnológico

- **Backend:** Node.js, TypeScript y Express.
- **Base de datos:** MongoDB con Mongoose.
- **Autenticación:** JWT; las contraseñas se almacenan con bcrypt.
- **Frontend:** HTML, CSS y TypeScript.

## 🗃️ Colecciones

- `usuarios`: alumnos y administradores, diferenciados por rol.
- `profesores`: profesores y su disponibilidad semanal.
- `autos`: vehículos y su estado de servicio.
- `clases`: reservas con alumno, profesor, auto, inicio y fin.
- `horario_escuela`: horarios de atención de la escuela.
- `tokens_revocados`: tokens JWT cerrados antes de su vencimiento.

La disponibilidad semanal está dentro del documento de cada profesor; `horario_escuela` contiene un único documento.

## 🔐 Autenticación y autorización

El inicio de sesión devuelve un JWT que se envía para acceder a las rutas protegidas. Los permisos distinguen alumnos y administradores: cada alumno gestiona sus propias clases y los administradores gestionan profesores, autos y horarios.

## 📚 CRUD del parcial

El CRUD completo se implementará sobre **clases**: crear, listar y consultar una clase, modificarla y eliminarla.

## 🕒 Asignación de clases

Una clase se registra únicamente si el horario está dentro del horario de la escuela y de la disponibilidad del profesor, y el auto está activo. Además, no puede superponerse con otra clase del mismo alumno, profesor o auto. Para detectar cruces se comparan los intervalos de inicio y fin; no se requiere un calendario avanzado.

---

## 🔗 Repositorios

| Componente | Link |
|-----------|------|
| **Backend** | [INSPT-Prog3-DriveAndLearn-backend](https://github.com/SM03594/INSPT-Prog3-DriveAndLearn-backend) |
| **Frontend** | [INSPT-Prog3-DriveAndLearn-frontend](https://github.com/fabriziomanzopeluso/INSPT-Prog3-DriveAndLearn-frontend) |

---
