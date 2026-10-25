# Inconsistencias encontradas

Registro de inconsistencias, problemas y puntos a revisar que aparecieron al
escribir las guías de `docs/`. **No** es una lista de tareas obligatorias:
algunas entradas son decisiones de diseño que vale la pena discutir.

**Cómo agregar una entrada:** usá el siguiente número libre (`I-NN`), indicá
la fecha, dónde está, qué pasa, cómo se comprobó y una propuesta. Cuando se
resuelva, cambiá el estado a ✅ y anotá cómo se resolvió, sin borrar la
entrada.

**Estados:** 🔴 puede causar errores o comportamientos inesperados ·
🟡 mantenimiento o claridad del código · 🔵 comentario o documentación
desactualizada · 💭 decisión de diseño para discutir · ✅ resuelta

---

## Resumen

| ID | Estado | Tema | Dónde |
|---|---|---|---|
| I-01 | ✅ | Alias `/api/calendario-semanal` duplicaba `/api/horario` | routes, controllers |
| I-02 | ✅ | 27 tests fallaban en `alumnos.http` y `administradores.http` (los archivos se eliminaron) | `tests/` |
| I-03 | ✅ | El email no validaba el formato | `models/Usuario.ts` |
| I-04 | ✅ | `auto` y `administrador` descartan campos desconocidos sin avisar | services |
| I-05 | 🟡 | Uso de la opción deprecada `new: true` de Mongoose | 4 services |
| I-06 | 🟡 | La interfaz `Auto` no coincide con su esquema | `models/Auto.ts` |
| I-07 | 🟡 | Uniones `'alumno' \| 'administrador'` repetidas en lugar de `Rol` | `types/express.d.ts`, `clase.service.ts` |
| I-08 | ✅ | Helpers `exigir` y `rechazarCampos` duplicados | `profesor.service.ts`, `clase.service.ts` |
| I-09 | ✅ | Tres formas distintas de pasar el body en los controllers | controllers |
| I-10 | 🟡 | `role` en inglés y `rol` en español para lo mismo | `req.auth`, models, services |
| I-11 | 🟡 | `reglasEscuela.service.test.ts` testea un service con otro nombre | `tests/services/` |
| I-12 | 🟡 | Mensaje engañoso con una hora de fin negativa | `models/CalendarioSemanal.ts` |
| I-13 | 🟡 | `ErrorDeNegocio(…, 403)` hace lo mismo que `ErrorAutorizacion` | `clase.service.ts` |
| I-14 | 🔵 | Comentarios que apuntan a guías borradas | `errorHandler.middleware.ts` |
| I-15 | 🔵 | Enlace a `docs/plan-tests-postman.md`, que no existe | `postman/` |
| I-16 | 🔵 | `tsconfig.build.json` menciona `dist/index.js` | `tsconfig.build.json:7` |
| I-17 | 🔵 | La cobertura excluye `src/index.ts`, que no existe | `vitest.config.ts` |
| I-18 | ✅ | La cabecera de `validacionTipos.ts` decía `tipos.ts` | `utils/validacionTipos.ts:2` |
| I-19 | 💭 | El estado `'confirmada'` nunca se asigna | `models/Clase.ts` |
| I-20 | 💭 | No hay forma de consultar turnos libres | API |
| I-21 | 💭 | La disponibilidad del profesor no se valida contra el horario de la escuela | `profesor.service.ts` |
| I-22 | 💭 | Cambiar el horario o sacar un auto de servicio no revisa las clases ya reservadas | `horarioEscuela.service.ts`, `auto.service.ts` |
| I-23 | 💭 | Dos tramos contiguos no aceptan una clase que cruza el borde | `clase.service.ts` |
| I-24 | 💭 | `DELETE` con body en la disponibilidad del profesor | `profesor.routes.ts` |
| I-25 | 🟡 | `globals: true` en Vitest, pero todos los tests importan `describe`/`it` | `vitest.config.ts` |
| I-26 | 🔵 | El README de Postman dice que el Setup crea 4 alumnos (crea 3) | `postman/README.md:48` |
| I-27 | 🔵 | El comentario de `utils` muestra una llamada incorrecta | colección Postman, pre-request |
| I-28 | 🔴 | El tiempo del login revela si un email está registrado | `auth.service.ts:37` |
| I-29 | ✅ | El login sin email o password responde 401 en lugar de 400 | `auth.service.ts:26-33` |
| I-30 | 🟡 | Mensajes de error sin tildes ("direccion", "esta") | `Usuario.ts:33`, services |
| I-31 | 🟡 | "No tenés clases disponibles" también se le dice a un admin | `clase.service.ts:246` |
| I-32 | ✅ | `agregar` sin tramo guarda `null` y rompe las reservas de ese día (500) | `horarioEscuela.service.ts:53` |
| I-33 | 🟡 | Quitar un tramo inexistente responde "Profesor no encontrado" | `profesor.service.ts:83`, controller |
| I-34 | ✅ | `PATCH nom-ape` no valida: acepta números y un body sin `nomApe` | `profesor.service.ts:111` |
| I-35 | ✅ | Foto de perfil: base64 sin validar, se borra si falta, límite real de ~75 KB (se eliminó la foto) | `profesor.service.ts`, `Profesor.ts` |
| I-36 | ✅ | Un tramo que no es objeto devuelve un mensaje interno de Mongoose | `horarioEscuela.service.ts:53` |
| I-37 | 💭 | Se aceptan tramos superpuestos y días extra (estos se descartan) | `calendarioSemanal.service.ts`, `horarioEscuela.service.ts` |
| I-38 | 💭 | No hay forma de dar de baja un profesor | `profesor.routes.ts` |
| I-39 | 🟡 | La patente no tiene formato: `"AB 123 CD"` y `"AB123CD"` son autos distintos | `models/Auto.ts` |
| I-40 | ✅ | `PUT /api/autos/:id` con `_id` en el body responde 500 | `auto.service.ts:45` |
| I-41 | 🟡 | `admin:bootstrap` sin terminal termina con código 0 sin crear nada | `scripts/bootstrapAdmin.ts` |
| I-42 | 🔵 | Un comentario de `bootstrapAdminDesdeEnv.ts` dice que `create()` fallaría "con un error crudo" | `scripts/bootstrapAdminDesdeEnv.ts:31` |
| I-43 | 💭 | Los scripts de admin dependen de `tsx` (devDependency) y no hay un script para `dist/` | `package.json` |
| I-44 | 💭 | Nada impide borrar al último administrador | `administrador.service.ts`, `administrador.routes.ts` |
| I-45 | ✅ | El `PUT` de autos y admins acepta operadores de MongoDB: `$set` guardaba la contraseña de un admin en texto plano (admins: resuelto con el DTO) | `auto.service.ts`, `administrador.service.ts` |
| I-46 | ✅ | El `POST` de autos acepta `_id` y `createdAt` elegidos por el cliente | `auto.service.ts` |
| I-47 | 🟡 | Los errores de conversión de Mongoose llegan al cliente con detalles internos | `errorHandler.middleware.ts` |
| I-48 | 🟡 | El chequeo "¿es un objeto JSON?" está repetido en 7 lugares, con 3 clases de error | middlewares, utils, services |
| I-49 | ✅ | Los endpoints que leen campos sueltos ignoran en silencio los campos de más | controllers de alumno, auto y profesor |
| I-50 | ✅ | `POST /horario-escuela/quitar` no valida el tipo de `tramoId` (404 en lugar de 400) | `horarioEscuela.service.ts` |
| I-51 | 🟡 | Los mensajes de las reglas no siguen el formato de los DTO | `profesor.service.ts`, `clase.service.ts` |

---

## 🔴 Pueden causar errores

### I-28 · El tiempo del login revela si un email está registrado
- **Detectada:** 2026-10-22, flujo `registro-y-login`.
- **Dónde:** `src/services/auth.service.ts:37`: `if (usuario === null || !(await bcrypt.compare(...)))`.
- **Qué pasa:** el mensaje es el mismo para un email inexistente y para una contraseña errónea, a propósito, para no revelar qué emails tienen cuenta. Pero si el usuario no existe, se saltea `bcrypt.compare`, que es la parte lenta. Medido con 5 intentos de cada uno: **~5 ms** con un email inexistente y **~68 ms** con una contraseña errónea. Midiendo el tiempo se puede averiguar qué emails están registrados (*user enumeration* por tiempo).
- **Propuesta:** cuando el usuario no existe, comparar igual contra un hash fijo de relleno, por ejemplo `await bcrypt.compare(password, HASH_DE_RELLENO)`, para que los dos caminos tarden lo mismo. Complementar con un límite de intentos por IP.

---

## 🟡 Mantenimiento y claridad

### I-05 · Uso de la opción deprecada `new: true` de Mongoose
- **Detectada:** 2026-10-22, por los warnings al correr los tests: *"the `new` option for `findOneAndUpdate()` … is deprecated. Use `returnDocument: 'after'`"*.
- **Dónde:** `alumno.service.ts:66`, `administrador.service.ts:87`, `auto.service.ts:52` y `:73`, `profesor.service.ts:56` (líneas actualizadas el 2026-10-24, después de los DTO; la de `profesor.service` se actualizó el 2026-10-25). En cambio, `clase.service.ts` ya usa `returnDocument: 'after'`.
- **Propuesta:** reemplazar `new: true` por `returnDocument: 'after'` en todos.

### I-06 · La interfaz `Auto` no coincide con su esquema
- **Detectada:** 2026-10-22, guía 08.
- **Dónde:** `src/models/Auto.ts:65-71`.
- **Qué pasa:** `marca` y `modelo` son opcionales en el esquema, pero la interfaz los declara `string` obligatorios. `cambios` acepta solo `'AUTOMATICO'` o `'MANUAL'`, pero está tipado como cualquier `string`.
- **Propuesta:** `marca?: string; modelo?: string; cambios: (typeof CAMBIOS)[number];`

### I-07 · Uniones de roles repetidas en lugar de `Rol`
- **Detectada:** 2026-10-22, guía 02.
- **Dónde:** `src/types/express.d.ts:6` y `src/services/clase.service.ts:23`.
- **Qué pasa:** repiten `'alumno' | 'administrador'` en lugar de usar `Rol` de `src/types/roles.ts`. Si se agrega un rol, hay que acordarse de cambiarlo en tres lugares.
- **Propuesta:** importar y usar `Rol`.

### I-10 · `role` en inglés y `rol` en español
- **Detectada:** 2026-10-22, guía 06.
- **Qué pasa:** el JWT y `req.auth` usan `role`, mientras que `Usuario.rol`, `ActorClase.rol` y el `discriminatorKey` usan `rol`. `clase.controller.actorDe` tiene que convertir uno en el otro.
- **Propuesta:** unificar en `rol`. Ojo: si se cambia el campo dentro del JWT, los tokens ya emitidos dejan de ser válidos (duran 1 hora).

### I-11 · `reglasEscuela.service.test.ts` testea un service con otro nombre
- **Detectada:** 2026-10-22.
- **Qué pasa:** `src/services/reglasEscuela.service.ts` fue borrado, pero el test sigue existiendo con ese nombre. En realidad importa `calendarioSemanal.service`, así que **pasa**, pero el nombre confunde y probablemente se superpone con `calendarioSemanal.service.test.ts`.
- **Propuesta:** fusionarlo con `calendarioSemanal.service.test.ts` o renombrarlo.

### I-12 · Mensaje engañoso con una hora de fin negativa
- **Detectada:** 2026-10-22, al probar valores negativos.
- **Qué pasa:** un tramo con `horaFin.hora: -3` se rechaza (400), pero el mensaje es *"La hora de fin debe ser posterior a la de inicio"* en lugar de *"La hora debe estar entre 0 y 23"*.
- **Propuesta:** en el `pre('validate')` de `tramoSchema`, comparar solo si las dos horas están en rango, para que se vea el error de rango.

### I-13 · `ErrorDeNegocio(…, 403)` hace lo mismo que `ErrorAutorizacion`
- **Detectada:** 2026-10-22, guía 09.
- **Dónde:** `clase.service.ts:164`: *"La cuenta autenticada ya no está activa"*.
- **Qué pasa:** funciona, pero es un error de permisos con la clase de error de negocio.
- **Propuesta:** usar `ErrorAutorizacion`.

### I-30 · Mensajes de error sin tildes
- **Detectada:** 2026-10-22, flujo `registro-y-login`.
- **Dónde:** `src/models/Usuario.ts:33` y la constante `MENSAJE_EMAIL_DUPLICADO` de `alumno.service.ts` y `administrador.service.ts`: *"La direccion de email ya esta en uso."*
- **Qué pasa:** el resto de los mensajes usan tildes ("contraseña", "inválido", "petición"). Este llega tal cual al cliente.
- **Propuesta:** "La dirección de email ya está en uso". Hay que actualizar también los tests y las requests de Postman que comparan ese texto.

### I-31 · "No tenés clases disponibles" también se le dice a un admin
- **Detectada:** 2026-10-22, flujo `agendar-una-clase`.
- **Dónde:** `src/services/clase.service.ts:246`.
- **Qué pasa:** cuando un admin reserva para un alumno sin saldo, la respuesta es 409 *"No tenés clases disponibles para reservar"*, como si el admin fuera el alumno.
- **Propuesta:** usar un mensaje neutro ("El alumno no tiene clases disponibles para reservar") o elegirlo según `actor.rol`.

### I-33 · Quitar un tramo inexistente responde "Profesor no encontrado"
- **Detectada:** 2026-10-22, flujo `alta-de-profesor-y-disponibilidad`.
- **Dónde:** `profesor.service.quitarDisponibilidad` (`:83`) devuelve `null` tanto si el profesor no existe como si no encontró el tramo, y `profesor.controller.quitarDisponibilidad` responde siempre 404 "Profesor no encontrado".
- **Qué pasa (comprobado):** con un `tramoId` inexistente, o con el día equivocado, la respuesta dice que el profesor no existe, cuando sí existe. El horario de la escuela, en el mismo caso, responde "No se encontró el tramo solicitado en ese día".
- **Propuesta:** que el service lance `ErrorDeNegocio('No se encontró el tramo solicitado en ese día', 404)` cuando falta el tramo, y que reserve `null` para el profesor inexistente.

### I-39 · La patente no tiene formato
- **Detectada:** 2026-10-22, flujo `gestion-de-autos`.
- **Qué pasa (comprobado):** `trim` solo quita los espacios de los extremos. `" ab 123 cd "` se guarda como `"AB 123 CD"`, y se puede crear otro auto con `"AB123CD"`: el índice único los considera distintos. Tampoco se comprueba que tenga forma de patente argentina (`AB123CD` o `ABC123`).
- **Propuesta:** normalizar quitando todos los espacios y guiones (un `set` en el esquema) y validar con `match` el formato.

### I-41 · `admin:bootstrap` sin terminal termina con código 0 sin crear nada
- **Detectada:** 2026-10-22, flujo `primer-administrador`.
- **Qué pasa (comprobado):** `printf 'email\nnombre\n' | npm run admin:bootstrap` muestra las dos preguntas y termina con **código 0**, sin pedir la contraseña, sin crear el admin y sin mostrar un error. El chequeo `if (!stdin.isTTY)` de `preguntarPasswordOculta` no llega a ejecutarse. Un pipeline lo tomaría como éxito.
- **Propuesta:** comprobar `stdin.isTTY` al **principio** de `main()`, antes de hacer cualquier pregunta, y fallar con código 1 y un mensaje que sugiera `admin:desde-env`.

### I-47 · Los errores de conversión de Mongoose llegan con detalles internos
- **Detectada:** 2026-10-24, al planificar I-04.
- **Qué pasa (comprobado):** cuando un valor no se puede convertir al tipo del esquema, el mensaje llega tal cual: `POST /api/autos { "activo": "si" }` → 400 *'Cast to Boolean failed for value "si" (type string) at path "activo"…'*. I-36 es otro caso de lo mismo (un tramo enviado como texto).
- **Propuesta:** validar los tipos antes de llegar a Mongoose (con DTOs). Además, que el `errorHandler` reemplace esos mensajes por uno genérico como "El campo X tiene un valor inválido".

- **Avance (2026-10-24):** los DTO validan los tipos antes de llegar a Mongoose, así que en los endpoints con body ya no aparecen los mensajes "Cast to X failed" por el tipo de un campo. Pueden aparecer todavía dentro de un tramo (por ejemplo `"hora": "x"`), porque las horas las valida el esquema. Falta el mensaje genérico en el `errorHandler`.

### I-48 · El chequeo "¿es un objeto JSON?" está repetido
- **Detectada:** 2026-10-24.
- **Dónde:** la condición `typeof x === 'object' && x !== null && !Array.isArray(x)` aparece en `validacionDeCuerpo.middleware.ts` (lanza `ErrorJsonInvalido`), `utils/cuerpoPeticion.ts` (`ErrorPeticionInvalida`), y en `alumno.service`, `clase.service`, `profesor.service` y `horarioEscuela.service` (`ErrorDeNegocio`). `utils/validacionCampos.ts` ya usa `cuerpoComoObjeto`.
- **Qué pasa:** el cliente no lo nota (todas responden 400), pero es la misma regla escrita varias veces, con tres clases de error distintas para el mismo problema.
- **Propuesta:** un solo type guard en `utils/` que reutilicen todos.

- **Avance (2026-10-24):** los services ya no repiten el chequeo: lo hacen los DTO, con `cuerpoComoObjeto` y el type guard `esObjetoJson` (`src/utils/cuerpoPeticion.ts`). Queda una copia en `validacionDeCuerpo.middleware.ts`, que tiene su propio `esObjetoJson`.

### I-25 · `globals: true` en Vitest, pero todos los tests importan `describe`/`it`
- **Detectada:** 2026-10-22, guía 11.
- **Dónde:** `vitest.config.ts:14`, con el comentario "Hace disponibles describe, it, expect, etc. sin importarlos". Sin embargo, todos los archivos de `tests/` hacen `import { describe, it, expect } from 'vitest'`.
- **Qué pasa:** no rompe nada, pero la opción no se usa y el comentario sugiere un estilo que el proyecto no sigue.
- **Propuesta:** quitar `globals: true`, porque los imports explícitos son más claros y no necesitan tipos globales. La otra opción es dejarla y aclarar en el comentario que es opcional.

---

### I-51 · Los mensajes de las reglas no siguen el formato de los DTO
- **Detectada:** 2026-10-24, al actualizar las guías de flujos después de los DTO.
- **Dónde:** `profesor.service.ts` (`nombreObligatorio`) y `clase.service.ts` (ids y fechas).
- **Qué pasa (comprobado):** los DTO usan un formato único ("El profesor debe ser un texto", "El nombre y apellido es obligatorio"), pero algunas reglas de los services tienen otro:
  - Un profesor **sin** `nomApe` responde "El nombre y apellido es obligatorio" (DTO), y uno con `nomApe: "  "` responde "El nombre y apellido **del profesor** es obligatorio" (service). Es el mismo problema con dos mensajes. En alumnos, el `"  "` lo frena el esquema con "El nombre y apellido es obligatorio".
  - En las clases, `profesor: 123` responde "El profesor debe ser un texto" (DTO), pero `profesor: "abc"` responde "profesor debe ser un identificador válido" (service), en minúscula y sin artículo. Lo mismo con "inicio debe ser una fecha ISO 8601 con zona horaria (…)".
- **Propuesta:** pasar los mensajes de esas reglas al formato de los DTO ("El nombre y apellido es obligatorio", "El profesor debe ser un identificador válido", "El inicio debe ser una fecha ISO 8601…"). Cambia el texto que reciben los clientes: hay que actualizar los tests, Postman y las guías.

## 🔵 Comentarios y documentación desactualizados

### I-14 · Comentarios que apuntan a guías borradas
- **Dónde:** `src/middlewares/errorHandler.middleware.ts:7` (`guia-middleware-handlers-y-routers.md`) y `:13` (`guia-capa-service.md`).
- **Propuesta:** apuntar a `docs/capas/05-middlewares.md` y `docs/capas/09-errores.md`.

### I-15 · Enlace a un documento que no existe
- **Dónde:** `postman/README.md:5` y la descripción de la colección (`info.description`) mencionan `docs/plan-tests-postman.md`. La sección 3 del README también remite a "§7 del plan" para anotar hallazgos.
- **Propuesta:** quitar el enlace o reemplazarlo por `docs/capas/12-tests-postman.md`, y anotar los hallazgos en `docs/inconsistencias.md`.

### I-16 · `tsconfig.build.json` menciona `dist/index.js`
- **Dónde:** `tsconfig.build.json:7`. El archivo real es `dist/server.js` (`package.json` → `start`).

### I-17 · La cobertura excluye un archivo que no existe
- **Dónde:** `vitest.config.ts:33` excluye `src/index.ts`. El punto de entrada es `src/server.ts`.

### I-26 · El README de Postman dice que el Setup crea 4 alumnos
- **Detectada:** 2026-10-22, guía 12.
- **Dónde:** `postman/README.md:48`, en la tabla de carpetas: "`00 Setup` | … 4 alumnos …".
- **Qué pasa:** `00 Setup` registra los alumnos 1, 2 y 3. El alumno 4 se crea en `02 Alumnos` ("[201] Registro sin token: clasesPorReservar arranca en 0").
- **Propuesta:** corregir el texto a "3 alumnos".

### I-27 · El comentario de `utils` muestra una llamada incorrecta
- **Detectada:** 2026-10-22, guía 12.
- **Dónde:** el script *Pre-request* de la colección. El comentario dice `utils.esperarStatus(pm, pm, 200);`.
- **Qué pasa:** la firma real es `esperarStatus(pm, codigo)`, y todos los requests la llaman como `utils.esperarStatus(pm, 200)`, tal como dice el README. El `pm` repetido del comentario es un error de tipeo.
- **Propuesta:** corregir el comentario a `utils.esperarStatus(pm, 200);`.

### I-42 · Comentario inexacto en `bootstrapAdminDesdeEnv.ts`
- **Dónde:** `src/scripts/bootstrapAdminDesdeEnv.ts:31-32`: *"si ya lo usa un alumno, create() fallaría con un error crudo de MongoDB"*.
- **Qué pasa:** `administrador.service.crear` ya traduce el error con `verSiErrorClaveDuplicada`, y daría "La direccion de email ya esta en uso.". El chequeo previo no está de más (el mensaje es más claro e incluye el email), pero el motivo que da el comentario no es correcto.

---

## 💭 Decisiones de diseño para discutir

### I-19 · El estado `'confirmada'` nunca se asigna
`Clase.estado` acepta `'pendiente' | 'confirmada' | 'cancelada'`, pero ningún
endpoint pasa una clase a `'confirmada'`. Habría que definir si falta el
endpoint (por ejemplo, que confirme el profesor o un admin) o si sobra el
estado.

### I-20 · No hay forma de consultar turnos libres
El backend **valida** el horario que propone el cliente, pero no **ofrece**
horarios. Además, un alumno solo ve sus propias clases, así que no puede saber
qué horarios del profesor ya ocupan otros alumnos. Sin un endpoint como
`GET /api/profesores/:id/turnos-libres?desde=…&hasta=…`, el frontend no puede
mostrar una agenda real.

### I-21 · La disponibilidad del profesor no se valida contra el horario de la escuela
Se le puede cargar disponibilidad a un profesor en un horario en que la
escuela está cerrada. No da ningún error: simplemente nunca se va a poder
reservar en ese horario.

### I-22 · Cambiar el horario o sacar un auto de servicio no revisa las clases ya reservadas
Si se quita un tramo del horario de la escuela o de la disponibilidad de un
profesor, las clases ya reservadas en esa franja siguen vigentes. Lo mismo
pasa con un auto: `auto.service.cambiarEstado` solo cambia `activo`, y las
clases futuras con ese auto quedan reservadas con un auto fuera de servicio.
Puede ser lo que se busca, pero conviene que sea una decisión explícita (por
ejemplo, avisar o listar las clases afectadas).

### I-23 · Dos tramos contiguos no aceptan una clase que cruza el borde
Con los tramos 08–10 y 10–12, una clase de 09:30 a 10:30 se rechaza, porque
tiene que caber entera en **un** tramo. Opciones: unir los tramos contiguos al
guardarlos, o validar contra la unión de los tramos.

### I-24 · `DELETE` con body
`DELETE /api/profesores/:id/disponibilidad` necesita `{ dia, tramoId }` en el
body. Algunos clientes y proxies no envían body en un `DELETE`. Una
alternativa es `DELETE /api/profesores/:id/disponibilidad/:dia/:tramoId`.

### I-37 · Tramos superpuestos y días extra
- **Detectada:** 2026-10-22.
- **Qué pasa (comprobado):** tanto en el horario de la escuela como en la disponibilidad, se acepta agregar un tramo de 10 a 16 aunque ya existan 08–12 y 14–20, y la lista queda con tramos que se pisan. No rompe las reservas (alcanza con que la clase quepa en **uno**), pero ensucia los datos y complica mostrarlos. Además, `PUT /api/horario-escuela` con un día extra (`"feriado": [...]`) responde 200 y descarta ese día en silencio.
- **Propuesta:** rechazar los tramos superpuestos, o unirlos al guardar (eso también resolvería I-23). Rechazar las claves desconocidas en el `PUT`.

- **Avance (2026-10-24):** con `aReemplazarCalendarioDto`, un día que no existe (`"feriado"`) responde 400 y ya no se descarta en silencio. Los tramos superpuestos se siguen aceptando.

### I-38 · No hay forma de dar de baja un profesor
- **Qué pasa:** no existe `DELETE /api/profesores/:id`, ni un campo `activo` como el de los autos. Un profesor que deja la escuela sigue apareciendo en los listados. La única forma de que no le reserven clases es quitarle toda la disponibilidad.
- **Propuesta:** agregar `activo` (como en `Auto`) y comprobarlo en `validarDisponibilidad`. Así no se pierde el historial de clases, que se perdería con un borrado.
- **Nota (2026-10-25):** la `propuesta.md` original prometía "Agregar y quitar profesores" y "Agregar y quitar autos". Al ampliarla según la corrección del profesor, se ajustó a lo implementado: los autos se sacan de servicio (`activo`) y para los profesores solo figuran alta y edición. Si se resuelve esta entrada, sumar la baja de profesores a la propuesta.

### I-43 · Los scripts de admin dependen de `tsx`
- **Qué pasa:** `admin:bootstrap` y `admin:desde-env` corren con `tsx`, que está en `devDependencies`. En un servidor instalado con `npm install --omit=dev` no funcionan. Los scripts compilados (`dist/scripts/*.js`) sí funcionan: `node dist/scripts/bootstrapAdminDesdeEnv.js` (comprobado), pero no hay un script de npm que los use.
- **Propuesta:** agregar, por ejemplo, `"admin:desde-env:prod": "node dist/scripts/bootstrapAdminDesdeEnv.js"`, o documentar el comando en el README.

### I-44 · Nada impide borrar al último administrador
- **Qué pasa (comprobado):** con un único admin, `DELETE /api/administradores/<su propio id>` → **204**, y quedan 0 administradores. Nadie puede crear profesores, autos ni horarios hasta que se corra de nuevo un script por consola.
- **Propuesta:** en `administrador.service.eliminar`, rechazar con 409 si es el último administrador.

---

## ✅ Resueltas

### I-04 · `auto` y `administrador` descartan campos desconocidos sin avisar
- **Detectada:** 2026-10-22, al escribir la guía 07.
- **Dónde:** `auto.service.ts` (`crear(datos: Auto)`, `actualizar`) y `administrador.service.ts` (`crear(datos: Administrador)`, `actualizar`).
- **Qué pasa:** reciben `req.body` sin validar, pero el parámetro está tipado como si ya fuera válido. Mongoose descarta en silencio los campos que no están en el esquema (modo `strict`). Comprobado: un auto con `color` y `precio` se guarda sin error y sin esos campos. Los otros services (`alumno`, `profesor`, `clase`) rechazan los campos desconocidos con un 400.
- **Propuesta:** que esos dos services reciban `unknown` y validen igual que `alumno.service` (lista de campos permitidos y `esDelTipo`).
- **Además (comprobado el 2026-10-24):** Mongoose **convierte** los tipos en lugar de rechazarlos: `marca: 123` se guarda como `"123"`, y el `nomApe: 123` de un admin, como `"123"`. Ver también I-45, I-46 e I-47, que tienen la misma causa.
- **Avance (2026-10-24):** resuelto **para administradores** con un DTO escrito a mano (`src/dtos/administrador.dto.ts`), como prueba piloto. El controller arma el DTO con `aCrearAdministradorDto`/`aActualizarAdministradorDto`, que rechazan los campos de más y los tipos incorrectos (con el helper `utils/validacionCampos.ts`), y el service recibe el DTO ya tipado. Falta `auto.service`. La carpeta `09 Validación de campos y tipos` de Postman lo prueba: los 7 casos de admin pasan, y los 4 de autos están marcados como hallazgo.
- **Resuelta:** 2026-10-24, con DTOs escritos a mano para todas las entidades (`src/dtos/`). Cada controller arma el DTO del body con `validarCampos` (`src/utils/validacionCampos.ts`), que rechaza los campos que no son del contrato y los tipos incorrectos en lugar de dejar que Mongoose los convierta. `auto.service` y `administrador.service` reciben el DTO ya tipado.

### I-08 · Helpers duplicados entre services
- **Detectada:** 2026-10-22, guía 07.
- **Dónde:** `exigir` y `rechazarCampos`/`rechazarCamposNoPermitidos`, en `profesor.service.ts:15-35` y `clase.service.ts:43-68`. Son casi iguales: la versión de `clase` acepta un status.
- **Propuesta:** moverlos a un archivo de `src/utils/`, por ejemplo `validacion.ts`.
- **Resuelta:** 2026-10-24, al pasar la validación de forma a los DTO desaparecieron `rechazarCampos`/`rechazarCamposNoPermitidos`, y el `exigir` de `profesor.service`. El único `exigir` que queda es el de `clase.service`, y lo usan las reglas de la reserva.

### I-09 · Tres formas de pasar el body en los controllers
- **Detectada:** 2026-10-22, guía 06.
- **Qué pasa:**
  - `auto`, `administrador`, `clase` y `horarioEscuela` pasan `req.body` tal cual.
  - `alumno` y `profesor` lo pasan por `cuerpoComoObjeto`.
  - Algunas funciones extraen solo un campo (`req.body.activo`, `req.body?.email`).
- `cuerpoComoObjeto` repite el chequeo que ya hace `validacionDeCuerpo` en la ruta.
- **Propuesta:** elegir una convención. Por ejemplo, pasar siempre `req.body` como `unknown` y dejar que el service valide.
- **Resuelta:** 2026-10-24, todos los controllers pasan el body por su DTO (`aCrearXDto(req.body)`, `aActualizarXDto(req.body)`…), y el service recibe el resultado tipado.

### I-29 · El login sin email o password responde 401 en lugar de 400
- **Detectada:** 2026-10-22, flujo `registro-y-login`.
- **Qué pasa:** `POST /api/auth/login` con `{ "email": "..." }` (sin `password`) responde **401** "Email y contraseña son obligatorios". Que falte un campo es un pedido mal armado, que en el resto de la API responde **400**. El 401 corresponde a "credenciales incorrectas".
- **Propuesta:** lanzar `ErrorDeNegocio` (400) cuando faltan campos, y reservar `ErrorAutenticacion` (401) para credenciales que no coinciden. Hay que actualizar los tests y las requests de Postman que esperan el 401.
- **Resuelta:** 2026-10-24, con `LoginDto` (`src/dtos/auth.dto.ts`). Sin email o sin contraseña, o con un tipo incorrecto, responde **400** ("La contraseña es obligatoria", "El email debe ser un texto"). El 401 queda solo para credenciales que no coinciden. La request de Postman pasó a ser `[400] Falta la contraseña`.

### I-32 · `agregar` sin tramo guarda `null` y rompe las reservas de ese día
- **Detectada:** 2026-10-22, flujo `configurar-horarios-de-la-escuela`.
- **Dónde:** `src/services/horarioEscuela.service.ts:53`. El controller hace `const { dia, tramo } = req.body`, y el service no comprueba que `tramo` sea un objeto (`profesor.service` sí lo hace, con `tramoComoDatos`).
- **Qué pasa (comprobado):** `POST /api/horario-escuela/agregar { "dia": "martes" }` responde **200** y guarda `martes: [null]`. Desde ese momento:
  - toda reserva o modificación para un martes responde **500** (`TypeError: Cannot read properties of null (reading 'horaInicio')`, en `clase.service.validarHorarioClase`);
  - `POST /quitar` en ese día también responde 500 (`reading '_id'`, en `calendarioSemanal.service.quitarTramo`).
  Solo se arregla con un `PUT` de la semana completa.
- **Propuesta:** validar `tramo` en `horarioEscuela.service.agregarTramo`, igual que en `profesor.service`. Mejor aún, mover la validación a `calendarioSemanal.service.agregarTramo`, para que la tengan los dos.
- **Resuelta:** 2026-10-24, con `aAgregarTramoDto` (`src/dtos/calendarioSemanal.dto.ts`): un body sin `tramo` responde 400 "El tramo es obligatorio". Al revisarlo apareció el mismo problema por otro camino: `PUT /api/horario-escuela` con `"lunes": [null]` también guardaba el `null` (comprobado). `aReemplazarCalendarioDto` ahora exige que cada tramo de la lista sea un objeto. **Ojo:** si en la base real ya quedó un `null` guardado de antes, hay que limpiarlo con un `PUT` de la semana completa.

### I-34 · `PATCH /profesores/:id/nom-ape` no valida
- **Detectada:** 2026-10-22, flujo `alta-de-profesor-y-disponibilidad`.
- **Dónde:** `src/services/profesor.service.ts:111`. Pasa `nomApe` (de tipo `unknown`) directo a `findByIdAndUpdate`.
- **Qué pasa (comprobado):** `{ "nomApe": 123 }` → 200, y el nombre pasa a ser `"123"`. `{ "otro": "x" }` → 200 sin ningún cambio y sin avisar. `crear` sí valida, con `nombreObligatorio`.
- **Propuesta:** usar `nombreObligatorio(nomApe)` también en `cambiarNomApe`.
- **Resuelta:** 2026-10-24, con `aCambiarNomApeDto`: `nomApe` tiene que ser texto y estar presente. Además, `cambiarNomApe` aplica la misma regla que `crear`: el nombre no puede quedar vacío.

### I-36 · Un tramo que no es objeto devuelve un mensaje interno de Mongoose
- **Detectada:** 2026-10-22, flujo `configurar-horarios-de-la-escuela`.
- **Qué pasa (comprobado):** `POST /api/horario-escuela/agregar { "dia": "martes", "tramo": "mañana" }` → 400 *'Cast to ObjectId failed for value "mañana" (type string) at path "_id". La hora de fin es obligatoria. La hora de inicio es obligatoria'*. El cliente recibe detalles internos (`ObjectId`, `_id`) que no tienen sentido para él.
- **Propuesta:** se resuelve junto con I-32, validando que `tramo` sea un objeto antes de agregarlo.
- **Resuelta:** 2026-10-24, con `aAgregarTramoDto`: un tramo que no es objeto responde 400 "El tramo debe ser un objeto", antes de llegar a Mongoose.

### I-40 · `PUT /api/autos/:id` con `_id` en el body responde 500
- **Detectada:** 2026-10-22, flujo `gestion-de-autos`.
- **Dónde:** `src/services/auto.service.ts:45`. Pasa el body sin filtrar a `findByIdAndUpdate`.
- **Qué pasa (comprobado):** `PUT /api/autos/<id> { "_id": "<otro id>" }` → MongoDB lanza `ImmutableField` (código 66), que el `errorHandler` no reconoce → **500** "Error interno del servidor", y el stack completo en la consola.
- **Propuesta:** se resuelve con I-04: aceptar solo `marca`, `modelo`, `patente` y `cambios` en el `PUT`, y que `activo` se cambie únicamente por `PATCH`. Hoy el `PUT` también lo cambia.
- **Resuelta:** 2026-10-24, con `aActualizarAutoDto`: `_id` no está en el contrato y responde 400 "No se pueden modificar estos campos: _id".

### I-45 · El `PUT` de autos y admins acepta operadores de MongoDB
- **Detectada:** 2026-10-24, al planificar I-04.
- **Qué pasa (comprobado):** los services le pasaban el body entero a `findByIdAndUpdate`, y Mongoose interpreta las claves que empiezan con `$` como **operadores de update**:
  - `PUT /api/administradores/:id { "$set": { "password": "corta" } }` respondía **200** y guardaba `"corta"` **en texto plano**, porque `conPasswordHasheada` solo mira `datos.password`. La cuenta quedaba **bloqueada**: no entraba ni con `"corta"` ni con la clave original.
  - `PUT /api/autos/:id { "$set": { "activo": false } }` → 200: saca el auto de servicio sin pasar por `PATCH .../activo`.
- **Avance (2026-10-24):** resuelto para **administradores** con el DTO (ver I-04). Hay un test de regresión en `tests/middlewares/auth.http.test.ts` y la request de Postman `[400] DTO: editar admin con un operador ($set)`. Para **autos** sigue abierto: request `[400] hallazgo (I-45)` en Postman.
- **Resuelta:** 2026-10-24, con los DTO de administrador y de auto: los operadores (`$set`, etc.) no son campos del contrato y responden 400. En autos, además, `activo` ya no se puede cambiar por `PUT`: la respuesta indica que se cambia con `PATCH /autos/:id/activo`.

### I-46 · El `POST` de autos acepta `_id` y `createdAt` del cliente
- **Detectada:** 2026-10-24, al planificar I-04.
- **Qué pasa (comprobado):** `POST /api/autos { "_id": "64b7f0f0f0f0f0f0f0f0f0f0", ... }` crea el auto con ese id, y `{ "createdAt": "2000-01-01" }` lo crea con fecha de alta en el año 2000.
- **Propuesta:** se resuelve con I-04 (solo los campos permitidos). No tiene request en Postman, porque mientras siga abierto crearía autos que el Teardown no limpia.
- **Resuelta:** 2026-10-24, con `aCrearAutoDto`: `_id`, `createdAt` y cualquier otro campo fuera del contrato responden 400.

### I-49 · Los endpoints que leen campos sueltos ignoran los campos de más
- **Detectada:** 2026-10-24, al armar la carpeta `09` de Postman.
- **Dónde:** los controllers que le pasan al service solo uno o dos campos del body: `sumar-clases`/`restar-clases` (`cantidad`), `PATCH /autos/:id/activo` (`activo`), `PATCH /profesores/:id/nom-ape` (`nomApe`), `PATCH .../foto-perfil` (`foto`) y `POST .../disponibilidad` (`dia`, `tramo`).
- **Qué pasa (comprobado):** `{ "cantidad": 1, "motivo": "regalo" }` responde **200**: suma la clase y `motivo` se descarta sin avisar. Lo mismo pasa en los otros cuatro. El resto de la API rechaza los campos de más con 400.
- **Propuesta:** un DTO por operación, como el de administrador, que rechace los campos que no están en el contrato. Hay 5 requests `[400] hallazgo (I-49)` en Postman.
- **Resuelta:** 2026-10-24, cada uno de esos endpoints tiene su DTO (`aCantidadClasesDto`, `aCambiarActivoDto`, `aCambiarNomApeDto`, `aCambiarFotoDto`, `aAgregarTramoDto`), que rechaza los campos de más.

### I-50 · `quitar` del horario no valida el tipo de `tramoId`
- **Detectada:** 2026-10-24, al armar la carpeta `09` de Postman.
- **Qué pasa (comprobado):** `POST /api/horario-escuela/quitar { "dia": "lunes", "tramoId": 123 }` → **404** "No se encontró el tramo solicitado en ese día". El caso equivalente de la disponibilidad de un profesor responde 400 "El identificador del tramo debe ser un texto".
- **Propuesta:** validar que `tramoId` sea un texto, como hace `profesor.service.quitarDisponibilidad`. Request `[400] hallazgo (I-50)` en Postman.
- **Resuelta:** 2026-10-24, con `aQuitarTramoDto`, compartido con la disponibilidad de los profesores: un `tramoId` que no es texto responde 400 "El identificador del tramo debe ser un texto".

### I-02 · 27 tests fallaban en `alumnos.http` y `administradores.http`
- **Detectada:** 2026-10-22, corriendo `npx vitest --run`.
- **Dónde:** `tests/alumnos.http.test.ts` (22) y `tests/administradores.http.test.ts` (5). Los dos archivos no estaban commiteados.
- **Qué pasa:** el `beforeEach` crea alumnos llamando a `alumno.service.crear({ ..., clasesPorReservar: 3 })`. Pero el service ahora rechaza ese campo al registrarse: *"No se pueden enviar estos campos al registrarse: clasesPorReservar"*.
- **Propuesta:** crear el alumno sin `clasesPorReservar` y después cargar el saldo con `sumarClasesPorReservar`, o crearlo directamente con `AlumnoModel.create`.
- **Estado al 2026-10-22:** los dos archivos ya no existen en el working tree (no estaban commiteados y se eliminaron). La suite completa pasa: 283/283. Si se recuperan, hay que aplicar la propuesta anterior.

### I-03 · El email no validaba el formato
- **Detectada:** 2026-10-22, al escribir la guía 08.
- **Dónde:** `src/models/Usuario.ts:28-34`. En los services, `alumno.service` solo comprueba que sea texto.
- **Qué pasa:** se acepta cualquier texto. Comprobado con una base en memoria: `"  NoEsUnEmail "` se guarda como `"noesunemail"`.
- **Propuesta:** agregar `match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'El email no tiene un formato válido']` al esquema.
- **Resuelta:** 2026-10-22. Se agregó `match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'El email no tiene un formato válido']` al esquema de `Usuario`, y con eso se cubren el registro, el alta de admins, los scripts del primer admin y los `PUT` (que usan `runValidators`). `trim` y `lowercase` corren antes del `match`, así que `" Ana@X.com "` sigue siendo válido. Se agregaron tests en `alumno.service`, `administrador.service` y `auth.http`, y la request `[400] Registro con email sin formato válido` en Postman.
- **Efecto secundario a tener en cuenta:** `.save()` revalida el email aunque no cambie. Un usuario guardado **antes** del cambio con un email inválido no puede recibir `sumar-clases` ni `restar-clases` (que usan `.save()`) hasta que se le corrija el email con un `PUT`. Hay un test que documenta ese caso. Antes de deployar, buscar esos usuarios en la base:
  ```js
  db.usuarios.find({ email: { $not: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ } }, { email: 1, rol: 1, nomApe: 1 })
  ```

### I-18 · La cabecera de `validacionTipos.ts` decía `tipos.ts`
- **Dónde:** `src/utils/validacionTipos.ts:2`. Es un resto de un nombre anterior del archivo.
- **Resuelta:** 2026-10-22, la cabecera ahora dice `validacionTipos.ts` (cambio sin commitear al momento de registrarlo).

### I-01 · Alias `/api/calendario-semanal` duplicaba `/api/horario`
- **Detectada:** 2026-10-22, guía 04.
- **Qué pasaba:** `calendarioSemanal.controller.ts` era una copia de
  `horario.controller.ts`. Su nombre era genérico, pero modificaba el horario
  de toda la escuela, y su contrato había cambiado sin cambiar la URL.
- **Resuelta:** 2026-10-22. Se eliminó el alias y se renombró la cadena
  completa a `horarioEscuela.*`, con la URL `/api/horario-escuela`. Los
  detalles están en
  [`temas/horarios-y-agendamiento.md`](temas/horarios-y-agendamiento.md#parte-5-el-alias-apicalendario-semanal-y-cómo-se-resolvió).
- **Pendiente relacionado:** confirmar que el frontend no use `/api/horario`
  ni `/api/calendario-semanal`. No se pudo revisar porque el acceso a GitHub
  estaba bloqueado.

### I-35 · Foto de perfil: validaciones y límites
- **Detectada:** 2026-10-22, flujo `alta-de-profesor-y-disponibilidad`.
- **Dónde:** `profesor.service.fotoComoBuffer` (`:70`) y `models/Profesor.ts:12`.
- **Qué pasa (comprobado):**
  - Cualquier texto se acepta como base64: `"esto no es base64 !!!"` se guarda como 10 bytes sin sentido. No se comprueba que sea una imagen.
  - Un body sin `foto` **borra** la foto actual (la reemplaza por un buffer vacío).
  - El modelo permite hasta 2 MiB, pero `express.json()` corta cualquier body de más de 100 KB (413). El límite real es de unos 75 KB de imagen.
  - La foto se devuelve como `{ "type": "Buffer", "data": [números] }` en **todas** las respuestas del profesor, incluida la lista completa.
- **Propuesta:** exigir el campo `foto`, validar el base64 y el tipo de imagen, y elegir **un** límite: o se sube el límite de `express.json` para esa ruta, o se baja `MAX_FOTO_BYTES`. Además, excluir `fotoPerfil` de los listados (con `select`) o servirla en un endpoint aparte.

- **Avance (2026-10-24):** con `aCambiarFotoDto`, un body sin `foto` responde 400 "La foto es obligatoria" y ya no borra la foto. Siguen abiertos: el base64 sin validar, el límite real de ~75 KB y la foto en los listados. Además, `{ "foto": null }` **todavía borra** la foto (200, `fotoPerfil` con `data: []`; comprobado): `exigido` solo rechaza `undefined`. Hay que decidir si esa es la forma de borrar una foto (y documentarla) o si se rechaza.
- **Resuelta:** 2026-10-25, **se eliminó la foto de perfil** en lugar de corregirla. Se quitaron el campo `fotoPerfil` y `MAX_FOTO_BYTES` del modelo, la ruta `PATCH /api/profesores/:id/foto-perfil`, `cambiarFotoPerfil` del controller y del service, `fotoComoBuffer` y sus helpers, `aCambiarFotoDto`, y el tipo `'cualquiera'` de `validacionCampos` (solo lo usaba la foto). También se quitaron sus tests, las 4 requests de Postman y la foto de las guías y de `propuesta.md`. La ruta vieja ahora responde 404 "Ruta no encontrada".
- **Pendiente al deployar:** Mongoose **no** borra de la base un campo que sale del esquema, y lo sigue devolviendo en el JSON (comprobado con una base en memoria: un profesor con `fotoPerfil` guardado lo sigue mostrando, aun después de un `save()`). En cada base con datos hay que correr una vez:
  ```js
  db.profesores.updateMany({ fotoPerfil: { $exists: true } }, { $unset: { fotoPerfil: "" } })
  ```
  Además, confirmar que el frontend no use `fotoPerfil` ni `PATCH …/foto-perfil`.
