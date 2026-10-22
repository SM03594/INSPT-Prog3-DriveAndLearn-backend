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
| I-08 | 🟡 | Helpers `exigir` y `rechazarCampos` duplicados | `profesor.service.ts`, `clase.service.ts` |
| I-09 | 🟡 | Tres formas distintas de pasar el body en los controllers | controllers |
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
| I-28 | ✅ | El tiempo del login revela si un email está registrado | `auth.service.ts` |
| I-29 | 💭 | El login sin email o password responde 401 en lugar de 400 | `auth.service.ts:26-33` |
| I-30 | 🟡 | Mensajes de error sin tildes ("direccion", "esta") | `Usuario.ts:33`, services |
| I-31 | 🟡 | "No tenés clases disponibles" también se le dice a un admin | `clase.service.ts:345` |
| I-32 | ✅ | `agregar` sin tramo guarda `null` y rompe las reservas de ese día (500) | `horarioEscuela.service.ts` |
| I-33 | 🟡 | Quitar un tramo inexistente responde "Profesor no encontrado" | `profesor.service.ts:156`, controller |
| I-34 | 🔴 | `PATCH nom-ape` no valida: acepta números y un body sin `nomApe` | `profesor.service.ts:111` |
| I-35 | 🟡 | Foto de perfil: base64 sin validar, se borra si falta, límite real de ~75 KB | `profesor.service.ts:70`, `Profesor.ts:12` |
| I-36 | ✅ | Un tramo que no es objeto devuelve un mensaje interno de Mongoose | `horarioEscuela.service.ts` |
| I-37 | 💭 | Se aceptan tramos superpuestos y días extra (estos se descartan) | `calendarioSemanal.service.ts`, `horarioEscuela.service.ts` |
| I-38 | 💭 | No hay forma de dar de baja un profesor | `profesor.routes.ts` |
| I-39 | 🟡 | La patente no tiene formato: `"AB 123 CD"` y `"AB123CD"` son autos distintos | `models/Auto.ts` |
| I-40 | ✅ | `PUT /api/autos/:id` con `_id` en el body respondía 500 | `auto.service.ts` |
| I-41 | 🟡 | `admin:bootstrap` sin terminal termina con código 0 sin crear nada | `scripts/bootstrapAdmin.ts` |
| I-42 | 🔵 | Un comentario de `bootstrapAdminDesdeEnv.ts` dice que `create()` fallaría "con un error crudo" | `scripts/bootstrapAdminDesdeEnv.ts:31` |
| I-43 | 💭 | Los scripts de admin dependen de `tsx` (devDependency) y no hay un script para `dist/` | `package.json` |
| I-44 | 💭 | Nada impide borrar al último administrador | `administrador.service.ts`, `administrador.routes.ts` |

---

## 🔴 Pueden causar errores

### I-04 · `auto` y `administrador` descartan campos desconocidos sin avisar
- **Detectada:** 2026-10-22, al escribir la guía 07.
- **Dónde:** `auto.service.ts` y `administrador.service.ts`, en `crear` y `actualizar`.
- **Qué pasaba:** recibían `req.body` sin validar. Mongoose descartaba en silencio los campos que no están en el esquema (modo `strict`).
- **Resolución:** ambos services reciben `unknown`, exigen un objeto, rechazan campos no permitidos con `ErrorDeNegocio` y validan los tipos de los campos admitidos. `rol` no se acepta para administradores; el rol lo asigna el discriminator. Se agregaron pruebas de creación y actualización para campos desconocidos.

### I-28 · El tiempo del login revela si un email está registrado
- **Detectada:** 2026-10-22, flujo `registro-y-login`.
- **Dónde:** `src/services/auth.service.ts`, en `autenticar`.
- **Qué pasaba:** cuando el usuario no existía, se omitía `bcrypt.compare`, a diferencia del caso de contraseña incorrecta; eso hacía mucho más rápida esa respuesta.
- **Resolución:** el service compara siempre la contraseña: contra el hash del usuario encontrado o, si no existe, contra un hash fijo de relleno con el mismo costo bcrypt. Luego lanza el mismo `ErrorAutenticacion` para ambos casos. Se agregaron pruebas de servicio para verificar ambas rutas. Esto reduce la diferencia temporal asociada a bcrypt, pero no garantiza tiempo constante de toda la petición, ya que la consulta a la base y otras operaciones pueden variar.

### I-32 · `agregar` sin tramo guarda `null` y rompe las reservas de ese día
- **Detectada:** 2026-10-22, flujo `configurar-horarios-de-la-escuela`.
- **Dónde:** `src/services/horarioEscuela.service.ts`, al agregar un tramo al calendario escolar.
- **Qué pasaba:** el service no comprobaba que `tramo` existiera y Mongoose persistía el valor faltante como `null`, lo cual podía romper reservas y operaciones de quitar tramos.
- **Resolución:** la validación de `unknown` quedó centralizada en `calendarioSemanal.service.validarTramo` y se ejecuta antes de mutar o persistir el calendario. Los cuerpos inválidos producen `ErrorDeNegocio` (400); se agregaron pruebas de servicio y HTTP que verifican que la entrada no se persiste.

### I-34 · `PATCH /profesores/:id/nom-ape` no valida
- **Detectada:** 2026-10-22, flujo `alta-de-profesor-y-disponibilidad`.
- **Dónde:** `src/services/profesor.service.ts:111`. Pasa `nomApe` (de tipo `unknown`) directo a `findByIdAndUpdate`.
- **Qué pasa (comprobado):** `{ "nomApe": 123 }` → 200, y el nombre pasa a ser `"123"`. `{ "otro": "x" }` → 200 sin ningún cambio y sin avisar. `crear` sí valida, con `nombreObligatorio`.
- **Propuesta:** usar `nombreObligatorio(nomApe)` también en `cambiarNomApe`.

### I-40 · `PUT /api/autos/:id` con `_id` en el body responde 500
- **Detectada:** 2026-10-22, flujo `gestion-de-autos`.
- **Dónde:** `src/services/auto.service.ts`, en `actualizar`.
- **Qué pasaba:** el body se pasaba sin filtrar a `findByIdAndUpdate`; MongoDB rechazaba `_id` con `ImmutableField` y el middleware respondía 500.
- **Resolución:** la validación de I-04 rechaza `_id` como campo no permitido antes de consultar MongoDB y responde 400. `activo` sigue admitido en la actualización para preservar el comportamiento previo; también puede cambiarse con `PATCH`.

---

## 🟡 Mantenimiento y claridad

### I-05 · Uso de la opción deprecada `new: true` de Mongoose
- **Detectada:** 2026-10-22, por los warnings al correr los tests: *"the `new` option for `findOneAndUpdate()` … is deprecated. Use `returnDocument: 'after'`"*.
- **Dónde:** `alumno.service.ts:172`, `administrador.service.ts:82`, `auto.service.ts:51` y `:75`, `profesor.service.ts:118`. En cambio, `clase.service.ts` ya usa `returnDocument: 'after'`.
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

### I-08 · Helpers duplicados entre services
- **Detectada:** 2026-10-22, guía 07.
- **Dónde:** `exigir` y `rechazarCampos`/`rechazarCamposNoPermitidos`, en `profesor.service.ts:15-35` y `clase.service.ts:43-68`. Son casi iguales: la versión de `clase` acepta un status.
- **Propuesta:** moverlos a un archivo de `src/utils/`, por ejemplo `validacion.ts`.

### I-09 · Tres formas de pasar el body en los controllers
- **Detectada:** 2026-10-22, guía 06.
- **Qué pasa:**
  - `auto`, `administrador`, `clase` y `horarioEscuela` pasan `req.body` tal cual.
  - `alumno` y `profesor` lo pasan por `cuerpoComoObjeto`.
  - Algunas funciones extraen solo un campo (`req.body.activo`, `req.body?.email`).
- `cuerpoComoObjeto` repite el chequeo que ya hace `validacionDeCuerpo` en la ruta.
- **Propuesta:** elegir una convención. Por ejemplo, pasar siempre `req.body` como `unknown` y dejar que el service valide.

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
- **Dónde:** `src/services/clase.service.ts:345`.
- **Qué pasa:** cuando un admin reserva para un alumno sin saldo, la respuesta es 409 *"No tenés clases disponibles para reservar"*, como si el admin fuera el alumno.
- **Propuesta:** usar un mensaje neutro ("El alumno no tiene clases disponibles para reservar") o elegirlo según `actor.rol`.

### I-33 · Quitar un tramo inexistente responde "Profesor no encontrado"
- **Detectada:** 2026-10-22, flujo `alta-de-profesor-y-disponibilidad`.
- **Dónde:** `profesor.service.quitarDisponibilidad` (`:156`) devuelve `null` tanto si el profesor no existe como si no encontró el tramo, y `profesor.controller.quitarDisponibilidad` responde siempre 404 "Profesor no encontrado".
- **Qué pasa (comprobado):** con un `tramoId` inexistente, o con el día equivocado, la respuesta dice que el profesor no existe, cuando sí existe. El horario de la escuela, en el mismo caso, responde "No se encontró el tramo solicitado en ese día".
- **Propuesta:** que el service lance `ErrorDeNegocio('No se encontró el tramo solicitado en ese día', 404)` cuando falta el tramo, y que reserve `null` para el profesor inexistente.

### I-35 · Foto de perfil: validaciones y límites
- **Detectada:** 2026-10-22, flujo `alta-de-profesor-y-disponibilidad`.
- **Dónde:** `profesor.service.fotoComoBuffer` (`:70`) y `models/Profesor.ts:12`.
- **Qué pasa (comprobado):**
  - Cualquier texto se acepta como base64: `"esto no es base64 !!!"` se guarda como 10 bytes sin sentido. No se comprueba que sea una imagen.
  - Un body sin `foto` **borra** la foto actual (la reemplaza por un buffer vacío).
  - El modelo permite hasta 2 MiB, pero `express.json()` corta cualquier body de más de 100 KB (413). El límite real es de unos 75 KB de imagen.
  - La foto se devuelve como `{ "type": "Buffer", "data": [números] }` en **todas** las respuestas del profesor, incluida la lista completa.
- **Propuesta:** exigir el campo `foto`, validar el base64 y el tipo de imagen, y elegir **un** límite: o se sube el límite de `express.json` para esa ruta, o se baja `MAX_FOTO_BYTES`. Además, excluir `fotoPerfil` de los listados (con `select`) o servirla en un endpoint aparte.

### I-36 · Un tramo que no es objeto devuelve un mensaje interno de Mongoose
- **Detectada:** 2026-10-22, flujo `configurar-horarios-de-la-escuela`.
- **Qué pasaba:** un `tramo` de tipo incorrecto llegaba a Mongoose y exponía un mensaje de casteo interno al cliente.
- **Resolución:** la misma validación centralizada de I-32 exige un objeto con horas válidas y responde con un error de negocio claro, antes de guardar.

### I-39 · La patente no tiene formato
- **Detectada:** 2026-10-22, flujo `gestion-de-autos`.
- **Qué pasa (comprobado):** `trim` solo quita los espacios de los extremos. `" ab 123 cd "` se guarda como `"AB 123 CD"`, y se puede crear otro auto con `"AB123CD"`: el índice único los considera distintos. Tampoco se comprueba que tenga forma de patente argentina (`AB123CD` o `ABC123`).
- **Propuesta:** normalizar quitando todos los espacios y guiones (un `set` en el esquema) y validar con `match` el formato.

### I-41 · `admin:bootstrap` sin terminal termina con código 0 sin crear nada
- **Detectada:** 2026-10-22, flujo `primer-administrador`.
- **Qué pasa (comprobado):** `printf 'email\nnombre\n' | npm run admin:bootstrap` muestra las dos preguntas y termina con **código 0**, sin pedir la contraseña, sin crear el admin y sin mostrar un error. El chequeo `if (!stdin.isTTY)` de `preguntarPasswordOculta` no llega a ejecutarse. Un pipeline lo tomaría como éxito.
- **Propuesta:** comprobar `stdin.isTTY` al **principio** de `main()`, antes de hacer cualquier pregunta, y fallar con código 1 y un mensaje que sugiera `admin:desde-env`.

### I-25 · `globals: true` en Vitest, pero todos los tests importan `describe`/`it`
- **Detectada:** 2026-10-22, guía 11.
- **Dónde:** `vitest.config.ts:14`, con el comentario "Hace disponibles describe, it, expect, etc. sin importarlos". Sin embargo, todos los archivos de `tests/` hacen `import { describe, it, expect } from 'vitest'`.
- **Qué pasa:** no rompe nada, pero la opción no se usa y el comentario sugiere un estilo que el proyecto no sigue.
- **Propuesta:** quitar `globals: true`, porque los imports explícitos son más claros y no necesitan tipos globales. La otra opción es dejarla y aclarar en el comentario que es opcional.

---

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

### I-29 · El login sin email o password responde 401 en lugar de 400
- **Detectada:** 2026-10-22, flujo `registro-y-login`.
- **Qué pasa:** `POST /api/auth/login` con `{ "email": "..." }` (sin `password`) responde **401** "Email y contraseña son obligatorios". Que falte un campo es un pedido mal armado, que en el resto de la API responde **400**. El 401 corresponde a "credenciales incorrectas".
- **Propuesta:** lanzar `ErrorDeNegocio` (400) cuando faltan campos, y reservar `ErrorAutenticacion` (401) para credenciales que no coinciden. Hay que actualizar los tests y las requests de Postman que esperan el 401.

### I-37 · Tramos superpuestos y días extra
- **Detectada:** 2026-10-22.
- **Qué pasa (comprobado):** tanto en el horario de la escuela como en la disponibilidad, se acepta agregar un tramo de 10 a 16 aunque ya existan 08–12 y 14–20, y la lista queda con tramos que se pisan. No rompe las reservas (alcanza con que la clase quepa en **uno**), pero ensucia los datos y complica mostrarlos. Además, `PUT /api/horario-escuela` con un día extra (`"feriado": [...]`) responde 200 y descarta ese día en silencio.
- **Propuesta:** rechazar los tramos superpuestos, o unirlos al guardar (eso también resolvería I-23). Rechazar las claves desconocidas en el `PUT`.

### I-38 · No hay forma de dar de baja un profesor
- **Qué pasa:** no existe `DELETE /api/profesores/:id`, ni un campo `activo` como el de los autos. Un profesor que deja la escuela sigue apareciendo en los listados. La única forma de que no le reserven clases es quitarle toda la disponibilidad.
- **Propuesta:** agregar `activo` (como en `Auto`) y comprobarlo en `validarDisponibilidad`. Así no se pierde el historial de clases, que se perdería con un borrado.

### I-43 · Los scripts de admin dependen de `tsx`
- **Qué pasa:** `admin:bootstrap` y `admin:desde-env` corren con `tsx`, que está en `devDependencies`. En un servidor instalado con `npm install --omit=dev` no funcionan. Los scripts compilados (`dist/scripts/*.js`) sí funcionan: `node dist/scripts/bootstrapAdminDesdeEnv.js` (comprobado), pero no hay un script de npm que los use.
- **Propuesta:** agregar, por ejemplo, `"admin:desde-env:prod": "node dist/scripts/bootstrapAdminDesdeEnv.js"`, o documentar el comando en el README.

### I-44 · Nada impide borrar al último administrador
- **Qué pasa (comprobado):** con un único admin, `DELETE /api/administradores/<su propio id>` → **204**, y quedan 0 administradores. Nadie puede crear profesores, autos ni horarios hasta que se corra de nuevo un script por consola.
- **Propuesta:** en `administrador.service.eliminar`, rechazar con 409 si es el último administrador.

---

## ✅ Resueltas

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
