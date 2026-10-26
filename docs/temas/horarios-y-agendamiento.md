# Horarios, horario de la escuela y agendamiento de clases

## Qué es esto, en una frase

Para que un alumno pueda reservar una clase, tienen que cumplirse **tres
condiciones a la vez**: la escuela tiene que estar abierta, el profesor tiene
que estar disponible y nadie (ni el alumno, ni el profesor, ni el auto) puede
tener otra clase en ese momento. Esta guía explica cómo se representan los
horarios, dónde se guardan y cómo los usa la reserva. Al final, con todo eso
claro, cuenta el problema que causaba el alias `/api/calendario-semanal` y cómo se resolvió.

---

## El mapa

Los horarios se construyen con **piezas que encajan unas dentro de otras**.
Las mismas piezas sirven para dos cosas distintas:

```
models/Horario.ts            HoraDelDia      { hora: 9, minuto: 30 }
        │
        ▼
models/Tramo.ts              Tramo           { _id, horaInicio: HoraDelDia, horaFin: HoraDelDia }
        │
        ▼
models/CalendarioSemanal.ts  CalendarioSemanal { lunes: Tramo[], martes: Tramo[], ..., domingo: Tramo[] }
        │
        ├──────────────────────────────┬──────────────────────────────────────┐
        ▼                              ▼                                      │
models/HorarioEscuela.ts       models/Profesor.ts                             │
  colección horario_escuela      colección profesores                         │
  UN solo documento:             UN calendario POR profesor:                  │
  { _id: 'escuela',              { nomApe, disponibilidad:                    │
    calendario: CalendarioSemanal }        CalendarioSemanal }                │
        │                              │                                      │
        └────────────┬─────────────────┘                                      │
                     ▼                                                        │
models/Clase.ts   una clase concreta: { alumno, profesor, auto,               │
                  inicio: Date, fin: Date }  ◄────────── se valida contra ────┘
                                                         los dos calendarios
```

La diferencia más importante es **qué representa cada cosa**:

| | Qué representa | Ejemplo |
|---|---|---|
| `CalendarioSemanal` | Un **patrón semanal** que se repite, sin fechas | "los lunes de 08:00 a 20:00" |
| `Clase` | Un **momento concreto** en el calendario real | "el lunes 2 de noviembre de 2026, de 10:00 a 11:00" |

Para validar una reserva hay que traducir el momento concreto al patrón:
**¿qué día de la semana y qué hora es, en la escuela?**

---

## Parte 1: las piezas

### 1.1 `HoraDelDia` y `aMinutos`

`src/models/Horario.ts` define una hora de reloj sin fecha: `{ hora, minuto }`,
con validaciones (`hora` entre 0 y 23, `minuto` entre 0 y 59, ambos enteros).

Para comparar dos horas, primero se las pasa a "minutos desde medianoche"
(`Horario.ts:40`):

```ts
export const aMinutos = (h) => h.hora * 60 + h.minuto;
// { hora: 9, minuto: 30 } → 570
```

Así "¿las 9:30 son antes que las 13:00?" se convierte en `570 < 780`.

### 1.2 `Tramo`

Un tramo es un intervalo dentro de un día: `{ horaInicio, horaFin }`. El
esquema tiene una regla que relaciona los dos campos: el fin tiene que ser
**posterior** al inicio (`src/models/Tramo.ts:35`). Como es un
subdocumento dentro de un array, Mongoose le asigna un **`_id` propio** a cada
tramo. Ese `_id` es el que después se usa para quitarlo.

`Tramo.ts` no es una colección: es un sub-esquema que se guarda dentro de los
calendarios. La regla de negocio del tramo, que empiece y termine en una hora
en punto (08:00–12:00 sí; 09:00–12:30, no), no está en el esquema sino en
`src/services/tramo.service.ts` (`validarTramoEnPunto`). Así solo se revisan
los tramos que se cargan: un tramo guardado antes de la regla no bloquea los
cambios posteriores en su calendario, como pasaría si la validara el esquema
en cada `.save()`.

### 1.3 `CalendarioSemanal`

Un objeto con **una lista de tramos por día** (`CalendarioSemanal.ts:37-54`):

```json
{
  "lunes":   [ { "_id": "t1", "horaInicio": { "hora": 8, "minuto": 0 }, "horaFin": { "hora": 12, "minuto": 0 } },
               { "_id": "t2", "horaInicio": { "hora": 14, "minuto": 0 }, "horaFin": { "hora": 20, "minuto": 0 } } ],
  "martes":  [ ... ],
  "domingo": []
}
```

Un día puede tener varios tramos (por ejemplo, mañana y tarde) o ninguno
(cerrado / no disponible). `crearCalendarioSemanal()` devuelve uno vacío, con
los siete días en `[]`.

### 1.4 Las operaciones genéricas: `calendarioSemanal.service.ts`

Este service es distinto de los demás: **no habla con la base**. Recibe un
calendario en memoria y lo modifica:

| Función | Qué hace |
|---|---|
| `validarDia(dia)` | Lanza un error 400 si `dia` no es uno de los siete días válidos. |
| `agregarTramo(calendario, dia, tramo)` | Hace `calendario[dia].push(tramo)`. |
| `quitarTramo(calendario, dia, tramoId)` | Busca el tramo por `_id` y lo saca. Devuelve `true` o `false`. |

Como no sabe **de quién** es el calendario, lo reutilizan dos services que sí
saben dónde guardarlo:

```
              calendarioSemanal.service   (operaciones puras, sin base)
                   ▲                ▲
                   │                │
   horarioEscuela.service      profesor.service
   carga HorarioEscuela         carga Profesor
   'escuela', modifica           :id, modifica su
   .calendario, save()           .disponibilidad, save()
```

---

## Parte 2: los dos calendarios guardados

### 2.1 El horario de la escuela

`src/models/HorarioEscuela.ts` tiene algo poco habitual: la colección
`horario_escuela` guarda **un único documento**, cuyo `_id` es siempre el texto
`'escuela'`:

```ts
_id: { type: String, default: 'escuela' },
calendario: { type: calendarioSemanalSchema, default: crearCalendarioSemanal },
```

Es lo que se conoce como un *singleton*: la escuela tiene un solo horario.
`src/services/horarioEscuela.service.ts` lo busca siempre con
`findById('escuela')`:

| Endpoint (solo `PUT`, `agregar` y `quitar` son de admin) | Función del service | Qué hace |
|---|---|---|
| `GET /api/horario-escuela` | `obtener()` | Devuelve el calendario, o uno vacío si todavía no existe. |
| `PUT /api/horario-escuela` | `reemplazar(valor)` | Reemplaza **todo** el calendario. Exige los 7 días. |
| `POST /api/horario-escuela/agregar` `{ dia, tramo }` | `agregarTramo(dia, tramo)` | Agrega un tramo y guarda. Si el documento no existe, lo crea. |
| `POST /api/horario-escuela/quitar` `{ dia, tramoId }` | `quitarTramo(dia, tramoId)` | Quita un tramo y guarda. Si no lo encuentra, responde 404. |
| `GET /api/horario-escuela/validar/:dia` | `validarDia` | Solo responde si el nombre del día es válido. |

### 2.2 La disponibilidad de cada profesor

Cada profesor tiene su propio `CalendarioSemanal` en el campo `disponibilidad`
(`src/models/Profesor.ts`). El `default` es una **función**
(`crearCalendarioSemanal`) y no un objeto: así cada profesor recibe un
calendario nuevo y no comparten todos el mismo objeto.

| Endpoint (solo admin) | Función de `profesor.service` |
|---|---|
| `POST /api/profesores/:id/disponibilidad` `{ dia, tramo }` | `agregarDisponibilidad` |
| `DELETE /api/profesores/:id/disponibilidad` `{ dia, tramoId }` | `quitarDisponibilidad` |

### 2.3 Cómo se relacionan

La disponibilidad del profesor **no tiene que estar contenida** en el horario
de la escuela al cargarla: no se valida en ese momento. La relación entre los
dos se comprueba **recién al reservar**, cuando la clase tiene que caber en
**ambos**:

```
             08:00                12:00      14:00                     20:00
Escuela  L:    ├────────────────────┤          ├─────────────────────────┤
Profesor L:         ├─────────────────────────────────┤
                  09:00                              16:00

Se puede reservar si cabe en los dos:  09–12  y  14–16
```

---

## Parte 3: del instante a la hora local

Una clase se reserva con instantes ISO 8601 **con zona horaria**:

```json
{ "inicio": "2026-11-02T10:00:00-03:00", "fin": "2026-11-02T11:00:00-03:00" }
```

`src/utils/fechas.ts` trabaja en dos pasos. El primero lo hace el DTO de la
clase (`clase.dto.ts`) y el segundo, el service:

```
"2026-11-02T10:00:00-03:00"
     │ parsearInstante()      exige una zona (Z o ±HH:MM) y un día que exista en el calendario
     ▼
Date (instante absoluto)       en MongoDB se guarda como 2026-11-02T13:00:00.000Z  (UTC)
     │ aHoraLocal()           Intl.DateTimeFormat con ZONA_HORARIA (por defecto Buenos Aires)
     ▼
{ dia: 'lunes', hora: 10, minuto: 0 }   ← esto se compara contra los CalendarioSemanal
```

¿Por qué no usar `getDay()` / `getHours()`? Porque esas funciones usan la zona
horaria **del servidor**, y un servidor desplegado suele estar en UTC. Ahí
13:00Z da las 13 en lugar de las 10, y en clases nocturnas hasta puede dar
**otro día**. `aHoraLocal` siempre calcula con la zona de la escuela. Por eso
los tests corren con `TZ: 'UTC'` (`vitest.config.ts`): si alguien usara
`getHours()`, el test fallaría en cualquier máquina. La explicación completa
de las zonas horarias está en
[`../guias/zonas-horarias-y-fechas.md`](../guias/zonas-horarias-y-fechas.md).

---

## Parte 4: reservar una clase (`POST /api/clases`)

La ruta solo exige el token (`clase.routes.ts:21`). El controller arma el DTO
de la reserva, y todo lo demás lo decide `crear()` en
`src/services/clase.service.ts:253`, en este orden:

```
POST /api/clases  { profesor, auto, inicio, fin }       (+ alumno, si reserva un admin)
 │
 ├─ 1. aCrearClaseDto (en el controller: src/dtos/clase.dto.ts:64)
 │     ¿solo campos permitidos? un alumno NO puede mandar "alumno" ............ 400
 │     inicio y fin: ISO 8601 con zona → Date (parsearInstante) ............... 400
 │     el alumno es: actor.id (si es alumno) o datos.alumno (si es admin)
 ├─ 2. validarActor (:43)    ¿la cuenta del token sigue existiendo? ............. 403
 ├─ 3. obtenerInstantes (:62)
 │     dura EXACTAMENTE 1 h · sin segundos · en el futuro ....................... 400
 ├─ 4. objectId()   ¿los ids tienen formato válido? ............................. 400
 ├─ 5. validarDisponibilidad (:81)
 │     profesor existe 404 · auto existe 404 · auto activo 409
 │     horario de la escuela configurado ........................................ 409
 │     validarHorarioClase (:104)
 │        no cruza la medianoche local ........................................... 400
 │        cabe en un tramo de la ESCUELA ese día ................................. 409
 │        cabe en un tramo del PROFESOR ese día .................................. 409
 │     validarAusenciaDeConflictos (:134)
 │        ni alumno, ni profesor, ni auto tienen otra clase superpuesta ........... 409
 ├─ 6. descontar 1 crédito del alumno (atómico) (:233)
 │     alumno inexistente 404 · sin clasesPorReservar ........................... 409
 └─ 7. ClaseModel.create()  → 201 { alumno, profesor, auto, inicio, fin, ... }
       si falla, devuelve el crédito descontado (:247)
```

### 4.1 "Cabe en un tramo"

`validarHorarioClase` (`clase.service.ts:118`) comprueba que exista **un**
tramo que contenga a la clase completa:

```ts
tramos.some((tramo) =>
  aMinutos(tramo.horaInicio) <= inicioMinutos && finMinutos <= aMinutos(tramo.horaFin));
```

```
tramo        ├───────────────┤          08:00–12:00
clase 10–11       ├────┤          ✓ cabe
clase 11:30–12:30          ├────┤ ✗ se sale del tramo
```

Algo para tener en cuenta: con dos tramos **contiguos**, 08–10 y 10–12, una
clase de 09:30 a 10:30 **no** se acepta, porque no cabe entera en ninguno de
los dos. Es preferible cargar un solo tramo de 08 a 12.

### 4.2 "No se superpone"

`validarAusenciaDeConflictos` le pregunta a MongoDB si existe alguna clase
que se superponga y que comparta alumno, profesor **o** auto:

```ts
inicio: { $lt: datos.fin },     // la otra empieza antes de que esta termine
fin:    { $gt: datos.inicio },  // y termina después de que esta empieza
$or: [{ alumno }, { profesor }, { auto }],
```

```
existente     ├──────┤                 10–11
nueva 10:30–11:30  ├──────┤            ✗ se superponen
nueva 11–12           ├──────┤         ✓ consecutivas: 11 < 11 es falso
```

### 4.3 El crédito del alumno

Cada alumno tiene `clasesPorReservar`, un saldo que carga un admin con
`PATCH /api/alumnos/:id/sumar-clases`. Reservar descuenta uno. El descuento
usa una sola operación **condicional** (`:275`):

```ts
AlumnoModel.findOneAndUpdate(
  { _id: alumnoId, clasesPorReservar: { $gte: 1 } },   // solo si tiene saldo
  { $inc: { clasesPorReservar: -1 } },
);
```

Si se hiciera en dos pasos (primero leer el saldo, después restar), dos
reservas simultáneas podrían leer las dos "saldo 1" y dejarlo en −1. Con la
condición dentro de la misma operación, MongoDB lo hace de forma atómica.

### 4.4 Modificar y eliminar

- **`PUT /api/clases/:id`** solo acepta `profesor`, `auto`, `inicio` y `fin`.
  Si mandás solo `inicio`, el `fin` se calcula como inicio + 1 h, y al revés.
  Vuelve a pasar **todo** el paso 5, excluyéndose a sí misma de los conflictos
  (`excluirId`) para no chocar consigo misma. No se puede modificar una clase
  que ya empezó.
- **`DELETE /api/clases/:id`** borra la clase. Si todavía no empezó, le
  devuelve el crédito al alumno (a través de `alumno.service`); una clase que
  ya empezó u ocurrió se borra sin reintegro. Al no existir más, deja libre
  su horario.
- Para ver, modificar o eliminar una clase, la ruta exige que sea **del
  alumno** que pide, o que pida un admin (`requireAlumnoDeLaClaseOAdministrador`).
  La clase de otro alumno responde 403. El service además filtra por alumno
  (`claseAccesible`, `clase.service.ts:55`).
- Una clase no tiene estado: si existe, está reservada.

El recorrido completo, con las respuestas reales, está en
[`../flujos/modificar-y-eliminar-una-clase.md`](../flujos/modificar-y-eliminar-una-clase.md).

### 4.5 Lo que **no** se revalida

El horario de la escuela y la disponibilidad del profesor se consultan **solo
al reservar o modificar**. Si un admin quita un tramo después, las clases ya
reservadas en ese horario **siguen existiendo**. El cambio solo afecta a las
reservas futuras.

---

## Parte 5: el alias `/api/calendario-semanal` y cómo se resolvió

Hasta octubre de 2026, el horario de la escuela se podía modificar por **dos
URLs**. Con lo visto en las partes anteriores, se entiende por qué eso era un
problema.

### Cómo era

```
CalendarioSemanal (la forma: un patrón semanal genérico)
     │
     ├── HorarioEscuela.calendario ◄── /api/horario/agregar|quitar
     │                             ◄── /api/calendario-semanal/agregar|quitar   ← el alias
     │
     └── Profesor.disponibilidad   ◄── /api/profesores/:id/disponibilidad
```

`/api/calendario-semanal` llevaba el nombre de la **forma** genérica, pero
operaba sobre **una instancia concreta**: el horario de la escuela. Sus
funciones `validar`, `agregar` y `quitar` estaban en
`calendarioSemanal.controller.ts` y eran copias exactas de las de
`horario.controller.ts`: las dos llamaban a `horarioEscuela.service`.

| Fecha | Commit | `/api/calendario-semanal/agregar` |
|---|---|---|
| 2026-09-22 | `ba30110` | Una **calculadora**: recibía `{ calendario, dia, tramo }`, devolvía el calendario con el tramo agregado y **no guardaba nada**. |
| 2026-10-13 | `240dd69` | Pasa a llamar a `horarioEscuela.service`: **guarda** en el horario de la escuela. En el mismo commit se crea `/api/horario`. |

### Por qué era un problema

1. **El nombre engañaba.** Por la Parte 1, sabemos que `CalendarioSemanal` es
   la forma que comparten la escuela y los profesores. Al leer
   `POST /api/calendario-semanal/agregar`, nada indicaba **cuál** calendario se
   modificaba.
2. **El impacto era grande.** Por la Parte 4, sabemos que el horario de la
   escuela es la primera condición de **toda** reserva. Quitar un tramo por el
   alias hacía que todas las reservas en esa franja respondieran 409, para
   todos los alumnos y todos los profesores.
3. **El contrato cambió sin cambiar la URL.** Un cliente que siguiera mandando
   el formato de septiembre esperaba una respuesta calculada, sin efectos. En
   cambio, el campo `calendario` se ignoraba en silencio y el tramo se agregaba
   **al horario real**.
4. **El código estaba duplicado.** Había dos controllers idénticos que mantener
   sincronizados a mano.
5. **El alias estaba incompleto.** Tenía `agregar`, `quitar` y `validar`, pero
   no `GET /` ni `PUT /`.

### Qué opciones había

| Opción | Efecto |
|---|---|
| **A. Quitar el alias** | Resuelve los cinco puntos. |
| **B. Montar el mismo router dos veces** | Resuelve los puntos 4 y 5. El nombre sigue engañando. |
| **C. Dejarlo como está** | No resuelve ninguno. |

### Qué se hizo

Se eligió la **opción A**, y además se renombró todo lo relacionado con el
horario para que el nombre diga de **qué** horario se trata:

| Antes | Después |
|---|---|
| `/api/horario/...` | `/api/horario-escuela/...` |
| `/api/calendario-semanal/...` | *(eliminado: responde 404)* |
| `routes/horario.routes.ts` | `routes/horarioEscuela.routes.ts` |
| `controllers/horario.controller.ts` | `controllers/horarioEscuela.controller.ts` |
| `routes/calendarioSemanal.routes.ts`, `controllers/calendarioSemanal.controller.ts` | *(eliminados)* |

Ahora toda la cadena tiene el mismo nombre:

```
/api/horario-escuela ─► horarioEscuela.routes ─► horarioEscuela.controller
                     ─► horarioEscuela.service ─► HorarioEscuela (model)
```

`calendarioSemanal.service.ts` **se mantuvo**: tiene las operaciones genéricas
(`validarDia`, `agregarTramo`, `quitarTramo`) que reutilizan
`horarioEscuela.service` y `profesor.service`. Un nombre genérico es correcto
ahí, porque esas funciones sí sirven para cualquier calendario.

**Lección:** el nombre de una URL es un contrato con los clientes. Tiene que
decir **sobre qué** actúa, no **qué forma** tienen los datos. Y cuando el
comportamiento de una URL cambia por completo (de calcular a guardar), es
mejor crear una URL nueva que reutilizar la vieja.

---

## Resumen

- `HoraDelDia` → `Tramo` → `CalendarioSemanal` son **formas** reutilizables.
  `calendarioSemanal.service` las manipula sin tocar la base.
- Hay **dos** calendarios guardados: el **único** de la escuela
  (`_id: 'escuela'`) y **uno por profesor** (`disponibilidad`).
- Una clase es un **instante concreto**. Para validarla, se convierte a
  día y hora **de la escuela** con `aHoraLocal`, nunca con `getHours()`.
- Reservar exige: datos válidos → 1 hora exacta en el futuro → profesor y auto
  activos → cabe en un tramo de la escuela **y** en uno del profesor → sin
  superposición → descuento atómico de un crédito.
- El horario de la escuela se maneja **solo** por `/api/horario-escuela`. El
  alias genérico `/api/calendario-semanal` se eliminó.
