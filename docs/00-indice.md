# Guías de DriveAndLearn backend

## Qué es esto, en una frase

Estas guías explican **cómo funciona este backend por dentro**: qué hace cada
capa, cada middleware y cada pieza de apoyo, y cómo se resuelve paso a paso
cada acción (registrarse, reservar una clase, cargar un horario...). No son
documentación formal de la API: son **material de estudio**, escrito sobre el
código real del proyecto.

---

## El mapa

```
docs/
├── 00-indice.md                 ← estás acá
│
├── capas/                       CÓMO ESTÁ HECHO: una guía por capa o tema transversal
│   ├── 01 … 02                  fundamentos: stack, TypeScript
│   ├── 03 … 09                  la cadena del pedido: arquitectura → routes → … → errores
│   ├── 10                       utilidades y fechas
│   └── 11 … 12                  tests: Vitest y Postman
│
├── flujos/                      CÓMO SE HACE X: un caso de uso de punta a punta,
│                                con las respuestas reales de la API
│
├── temas/                       UN TEMA EN PROFUNDIDAD, que cruza varias capas
│
├── guias/                       UN CONCEPTO EXPLICADO DESDE CERO (zonas horarias, índices)
│
└── inconsistencias.md           registro de bugs, desajustes y decisiones a revisar
```

Las guías de **capas** explican cada pieza por separado. Las de **flujos**
siguen un pedido real a través de todas las piezas, y para profundizar
enlazan a las de capas.

---

## Por dónde empezar

### Si querés entender el proyecto desde cero

```
01 Stack ─► 02 TypeScript ─► 03 Arquitectura ─► flujos/registro-y-login
                                                        │
      ┌─────────────────────────────────────────────────┘
      ▼
04 Routes ─► 05 Middlewares ─► 06 Controllers ─► 06b DTOs ─► 07 Services ─► 08 Models ─► 09 Errores
                                                                                              │
      ┌───────────────────────────────────────────────────────────────────────────────────────┘
      ▼
temas/horarios-y-agendamiento ─► flujos/agendar-una-clase ─► el resto de los flujos
```

Leer un flujo después de la guía de arquitectura ayuda a ver la cadena
completa funcionando antes de entrar al detalle de cada capa.

### Si vas a tocar algo concreto

| Vas a… | Leé primero |
|---|---|
| Agregar un endpoint | [04 Routes](capas/04-routes.md) → [06 Controllers](capas/06-controllers.md) → [06b DTOs](capas/06b-dtos.md) (receta al final) → [07 Services](capas/07-services.md) |
| Cambiar qué campos acepta un endpoint | [06b DTOs](capas/06b-dtos.md) → [12 Postman](capas/12-tests-postman.md) (carpeta `09`) |
| Agregar una regla de negocio | [07 Services](capas/07-services.md) → [09 Errores](capas/09-errores.md) |
| Agregar o cambiar un campo de la base | [08 Models](capas/08-models.md) → [06b DTOs](capas/06b-dtos.md) (si el cliente lo puede mandar) → [02 TypeScript](capas/02-typescript-en-el-proyecto.md) (tipos escritos a mano) |
| Cambiar permisos | [05 Middlewares](capas/05-middlewares.md) → [04 Routes](capas/04-routes.md) (tabla de endpoints) |
| Tocar algo de horarios o reservas | [temas/horarios-y-agendamiento](temas/horarios-y-agendamiento.md) → [guias/zonas-horarias-y-fechas](guias/zonas-horarias-y-fechas.md) → [10 Fechas](capas/10-utils-y-fechas.md) → [flujos/consultar-turnos-libres](flujos/consultar-turnos-libres.md) (la consulta usa las mismas reglas que la reserva) |
| Una búsqueda se vuelve lenta | [guias/indices-de-mongoose](guias/indices-de-mongoose.md) → [08 Models](capas/08-models.md) (sección 3b) |
| Escribir tests | [11 Vitest](capas/11-tests-vitest.md) → [12 Postman](capas/12-tests-postman.md) |
| Instalar o deployar | [01 Stack](capas/01-stack-y-dependencias.md) → [flujos/primer-administrador](flujos/primer-administrador.md) |
| Corregir un bug conocido | [inconsistencias.md](inconsistencias.md) |

### Si estás aprendiendo TypeScript

[02 TypeScript en el proyecto](capas/02-typescript-en-el-proyecto.md) cubre
todo lo que usa el proyecto. Después, [10 Utils](capas/10-utils-y-fechas.md)
(`validacionTipos`) y [08 Models](capas/08-models.md) (tipos de Mongoose)
tienen ejemplos más avanzados.

---

## Todas las guías

### `capas/`: cómo está hecho

| # | Guía | De qué trata |
|---|---|---|
| 01 | [Stack tecnológico y dependencias](capas/01-stack-y-dependencias.md) | Node/ESM, TypeScript, Express 5, MongoDB/Mongoose, bcrypt, JWT, dotenv, cors; los scripts de `package.json` y las dependencias de desarrollo. |
| 02 | [TypeScript en el proyecto](capas/02-typescript-en-el-proyecto.md) | Las diferencias con JavaScript, con ejemplos del código: uniones, `as const`, tipos utilitarios, genéricos y *mapped types*, `unknown` y type guards, `satisfies`. |
| 03 | [Arquitectura](capas/03-arquitectura.md) | Cómo se encadenan las capas, la regla de dependencias, cómo arranca el servidor y el camino de un pedido y de un error. |
| 04 | [Routes](capas/04-routes.md) | Routers, prefijos, `:id`, `router.use`, el orden de la cadena. **Tabla de todos los endpoints con sus permisos.** |
| 05 | [Middlewares](capas/05-middlewares.md) | `requireAuthentication`, `requireAdministrator`, `requireSelfOrAdministrator()`, `validacionDeCuerpo`, el 404 y el `errorHandler`. |
| 06 | [Controllers](capas/06-controllers.md) | De `req` a DTO y de resultados a status: 200, 201, 204 y 404. Una constante con nombre y tipo por dato, y `extraerActor`. |
| 06b | [DTOs](capas/06b-dtos.md) | El contrato de cada operación: `validarCampos`, `exigido`, crear vs. actualizar, el DTO según el rol, los `parsear…` que además convierten, forma vs. reglas. Receta para agregar uno. |
| 07 | [Services](capas/07-services.md) | Reglas de negocio sobre un DTO ya validado, el `Actor`, un service que solo usa services (`turno.service`), claves duplicadas, operaciones atómicas y compensación. |
| 08 | [Models](capas/08-models.md) | Esquemas, validadores, `unique` e índices propios, `pre('validate')`, `toJSON`, sub-esquemas, discriminators y la interfaz que tiene que coincidir con el esquema. |
| 09 | [Errores](capas/09-errores.md) | La jerarquía de errores, los traductores, y cómo un `throw` termina siendo `{ mensaje }`. |
| 10 | [Utils y fechas](capas/10-utils-y-fechas.md) | `cuerpoComoObjeto`, `esDelTipo`, `validarCampos`, `conPasswordHasheada`, `extraerActor`, y fechas sin errores de zona horaria (instantes, días del calendario y horas de reloj). |
| 11 | [Tests con Vitest](capas/11-tests-vitest.md) | Los 4 tipos de test (los DTO son funciones puras), MongoDB en memoria, supertest, `vi.fn()`, `vi.stubEnv` para el `.env`, `explain` para los índices, y fechas en los tests. |
| 12 | [Tests con Postman](capas/12-tests-postman.md) | La colección de punta a punta: carpetas (incluida `07b Turnos libres`), variables, helpers, tests globales y Teardown. |

### `flujos/`: cómo se hace

| Guía | Endpoints principales | Quién |
|---|---|---|
| [Registrarse, iniciar sesión y usar el token](flujos/registro-y-login.md) | `POST /api/alumnos`, `POST /api/auth/login` | Cualquiera |
| [Consultar los turnos libres de un profesor](flujos/consultar-turnos-libres.md) | `POST /api/profesores/:id/turnos-libres` | Alumno o admin |
| [Agendar una clase](flujos/agendar-una-clase.md) | `POST /api/clases`, `GET /api/clases` | Alumno o admin |
| [Modificar y eliminar una clase](flujos/modificar-y-eliminar-una-clase.md) | `PUT /api/clases/:id`, `DELETE /api/clases/:id` | Alumno (las suyas) o admin |
| [Dar de alta un profesor y su disponibilidad](flujos/alta-de-profesor-y-disponibilidad.md) | `/api/profesores`, `.../disponibilidad` | Admin |
| [Configurar el horario de la escuela](flujos/configurar-horarios-de-la-escuela.md) | `/api/horario-escuela` | Admin |
| [Gestionar los autos](flujos/gestion-de-autos.md) | `/api/autos`, `.../activo` | Admin |
| [Crear el primer administrador](flujos/primer-administrador.md) | `npm run admin:bootstrap`, `npm run admin:desde-env` | Por consola |

Para que una reserva funcione, el orden natural es:
**primer administrador → horario de la escuela → profesor y disponibilidad →
autos → registro del alumno (y que el admin le cargue saldo) → agendar.**

### `temas/`: en profundidad

| Guía | De qué trata |
|---|---|
| [Horarios, horario de la escuela y agendamiento](temas/horarios-y-agendamiento.md) | `HoraDelDia` → `Tramo` → `CalendarioSemanal`; los dos calendarios (escuela y profesor); del instante a la hora local; las 7 comprobaciones de una reserva; la historia del alias `/api/calendario-semanal` y cómo se resolvió. |

### `guias/`: un concepto desde cero

| Guía | De qué trata |
|---|---|
| [Zonas horarias y fechas](guias/zonas-horarias-y-fechas.md) | Qué guarda un `Date` (un instante, sin zona); en qué dos momentos importa la zona (la entrada y la hora de reloj de la escuela); por qué comparar fechas no la necesita; salida en UTC, el offset fijo (`OFFSET_HORA_UTC`) y el horario de verano, tests en UTC. |
| [Índices de MongoDB (y cómo los declara Mongoose)](guias/indices-de-mongoose.md) | Qué es un índice y qué es un COLLSCAN; índices compuestos (igualdad primero, rango después); por qué los de `Clase` terminan en `fin`; un índice por rama de un `$or`; cómo los crea Mongoose; `unique` no es una validación; medido con `explain`. |

### Registro de inconsistencias

[`inconsistencias.md`](inconsistencias.md) junta todo lo que se fue
encontrando al escribir estas guías: bugs, comentarios desactualizados,
validaciones que faltan y decisiones de diseño para discutir. Cada entrada
tiene un ID (`I-NN`), dónde está, cómo se comprobó y una propuesta. Las guías
lo citan así: "ver I-32".

---

## Cómo están escritas

Todas las guías siguen la misma estructura, para que sepas dónde buscar:

| Sección | Qué tiene |
|---|---|
| **Qué es esto, en una frase** | El tema resumido. Si solo leés esto, ya tenés la idea. |
| **El mapa** | Un diagrama o una tabla con las piezas que intervienen. |
| **El recorrido** | Paso a paso, con fragmentos del código real y referencias `archivo:línea`. |
| **Qué puede salir mal** | Una tabla de síntomas y causas (en los flujos, con las respuestas reales de la API). |
| **Resumen** | Lo esencial, en pocas líneas. |
| **Siguiente lectura** | Por dónde seguir. |

Algunas convenciones:

- **Las referencias `archivo:línea`** apuntan al código en el momento en que
  se escribió la guía (octubre de 2026). Si el código cambia, pueden correrse
  algunas líneas: buscá el nombre de la función.
- **Las respuestas de los flujos son reales**: se obtuvieron ejecutando cada
  pedido contra la API con una MongoDB en memoria, no se escribieron a mano.
- **Permisos en las tablas:** 🌐 público · 🔑 cualquier usuario con token ·
  👤 el propio usuario o un admin · 🛡️ solo admin.
- **Los diagramas** son ASCII, para que se lean bien en el editor, en GitHub y
  en la terminal.

---

## Mantener las guías

- **Si cambiás el código que una guía cita**, actualizá la guía en el mismo
  commit. Un `grep` del nombre del archivo en `docs/` te dice qué guías lo
  mencionan.
- **Si encontrás un bug o un desajuste**, agregalo a
  [`inconsistencias.md`](inconsistencias.md) con el siguiente número libre.
  Cuando se corrija, marcalo como ✅: no lo borres.
- **Si corregís una inconsistencia que una guía describe** (por ejemplo, I-32
  en la guía del horario), actualizá también ese texto y la tabla de "Qué
  puede salir mal".
