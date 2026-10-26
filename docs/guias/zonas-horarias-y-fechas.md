# Zonas horarias y fechas: cómo maneja el tiempo este backend

## Qué es esto, en una frase

Un `Date` es **un instante** de la línea del tiempo, igual en todo el planeta,
y no tiene zona horaria. La zona solo aparece en dos momentos: al **leer** una
fecha escrita como texto y al calcular **qué día y qué hora marca el reloj de
la escuela**. Todo lo demás (guardar, comparar, medir duraciones) funciona sin
saber en qué zona está nadie.

> Todos los valores de esta guía se obtuvieron **ejecutando el código real**,
> con el proceso de Node en tres zonas distintas (`UTC`, `Buenos_Aires` y
> `Tokio`).

Las piezas del calendario (tramos, horario de la escuela, disponibilidad del
profesor) se explican en
[`../temas/horarios-y-agendamiento.md`](../temas/horarios-y-agendamiento.md).
El detalle de la expresión regular y de `aHoraLocal` está en
[`../capas/10-utils-y-fechas.md`](../capas/10-utils-y-fechas.md#5-fechasts-el-instante-y-la-hora-de-la-escuela).

---

## El mapa

El viaje de una clase reservada para el **domingo 8/11/2026 a las 11:00 de
Argentina**:

```
 cliente                         backend                                   MongoDB
 ───────                         ───────                                   ───────
 "2026-11-08T11:00:00-03:00"
        │
        ▼  ① ENTRADA (¿la zona importa? SÍ)
   clase.dto ─ parsearInstante ─► Date 1794146400000 ms ───② GUARDADO (NO)──► 2026-11-08T14:00:00.000Z
                                        │
                     ┌──────────────────┼───────────────────────────┐
                     ▼                  ▼                           ▼
       ③ CÁLCULOS LOCALES (SÍ)   ④ COMPARAR (NO)               ⑤ SALIDA (NO)
       aHoraLocal + offset        inicio > new Date()           res.json
       → domingo 11:00            superposición, duración       → "2026-11-08T14:00:00.000Z"
       ¿entra en el horario?      ¿todavía no empezó?           (el frontend lo muestra
                                                                 en la zona del usuario)
```

| Paso | ¿Importa la zona? | Dónde |
|---|---|---|
| ① Texto → `Date` | **Sí**: hay que saber de qué zona es la hora | `utils/fechas.ts:37` (`parsearInstante`), lo llama `dtos/clase.dto.ts:56` |
| ② Guardar | No | MongoDB guarda el número de milisegundos (UTC) |
| ③ `Date` → día y hora de reloj | **Sí**: se usa la zona **de la escuela** | `utils/fechas.ts:92` (`aHoraLocal`), lo usa `services/clase.service.ts:123` |
| ③ al revés: hora de reloj → `Date` | **Sí**: el mismo offset de la escuela | `utils/fechas.ts:159` (`instanteLocal`), lo usa la consulta de turnos libres |
| ④ Comparar y medir | No | `clase.service.ts:84`, `:91`, `:197`, `:368` y la consulta de superposición |
| ⑤ `Date` → JSON | No | `res.json` siempre escribe ISO en UTC |

---

## El recorrido

### 1. Qué guarda un `Date`

Un `Date` guarda **un solo número**: los milisegundos que pasaron desde el
1/1/1970 a las 00:00 UTC. Estos tres textos son el mismo instante escrito en
tres zonas, y dan **el mismo número**:

```
"2026-11-08T11:00:00-03:00"   (Buenos Aires) ─┐
"2026-11-08T14:00:00Z"        (UTC)          ─┼─►  1794146400000
"2026-11-08T23:00:00+09:00"   (Tokio)        ─┘
```

La zona vive en el **texto**, no en el valor. Lo que sí cambia según la zona
del proceso es cómo se **muestra** el `Date` con `toString()`:

| Proceso en… | `toString()` del mismo `Date` |
|---|---|
| `UTC` | `Sun Nov 08 2026 14:00:00 GMT+0000` |
| `Buenos_Aires` | `Sun Nov 08 2026 11:00:00 GMT-0300` |
| `Tokio` | `Sun Nov 08 2026 23:00:00 GMT+0900` |

Por eso el proyecto **nunca** usa `toString()`, `getHours()` ni `getDay()`
para tomar decisiones: los tres dependen de la zona del proceso.

### 2. Entrada: la zona es obligatoria

El problema que se evita: un texto **sin zona** JavaScript lo interpreta en la
zona del proceso, así que la misma reserva se guardaría en instantes
distintos según dónde corra el servidor.

| `new Date('2026-11-08T11:00:00')` en un proceso en… | Instante guardado |
|---|---|
| `UTC` | `2026-11-08T11:00:00.000Z` |
| `Buenos_Aires` | `2026-11-08T14:00:00.000Z` |
| `Tokio` | `2026-11-08T02:00:00.000Z` ← 12 horas de diferencia con Buenos Aires |

Por eso `parsearInstante` (`src/utils/fechas.ts:37`) solo acepta ISO 8601
**con** zona (`Z` o `±HH:MM`), y además comprueba que el día exista
(`esDiaDeCalendario`, `:25`). Lo llama el DTO de las clases
(`src/dtos/clase.dto.ts:56-57` al crear, `:89-90` al modificar), que entrega
`inicio` y `fin` ya convertidos a `Date`:

| `inicio` recibido | Resultado |
|---|---|
| `"2026-11-08T11:00:00-03:00"` | `Date` `2026-11-08T14:00:00.000Z` |
| `"2026-11-08T11:00:00"` (sin zona) | 400 "El inicio debe ser una fecha ISO 8601 con zona horaria (ej. 2026-09-20T09:00:00-03:00)" |
| `"2026-02-31T09:00:00-03:00"` (no existe) | 400, el mismo mensaje |

### 3. Guardado: no se toca nada

Mongoose guarda el `Date` tal cual, y MongoDB lo almacena como ese número de
milisegundos. Al leer la clase, `clase.inicio` vuelve a ser **exactamente el
mismo instante**. En ningún momento se "convierte a UTC": ya era un instante.

### 4. Cálculos locales: siempre con la zona de la escuela

Hay preguntas que **sí** dependen de la zona: "¿qué día de la semana es?" y
"¿qué hora marca el reloj?". El horario de la escuela y la disponibilidad del
profesor están escritos en hora de reloj (`{ hora: 9, minuto: 0 }` el lunes),
así que para saber si una clase entra hay que traducir el instante a la hora
**de la escuela**.

Eso hace `aHoraLocal` (`src/utils/fechas.ts:92`). La hora de la escuela se
define con **un solo dato**, `OFFSET_HORA_UTC`: las horas de diferencia con
UTC (`-3` en Argentina). Sale del `.env` y la lee `src/config/env.ts:83`; si
no está o está sin valor, vale `-3`. Es la **única** fuente de la hora de la escuela en
toda la app.

La cuenta es sumarle el offset al instante y leer el resultado "como si fuera
UTC" (`relojDeLaEscuela`, `:80`):

```
2026-11-10T01:00:00Z  +  (-03:00)  =  2026-11-09T22:00 "en UTC"
                                         └─ getUTCDay() = 1 (lunes), getUTCHours() = 22
```

El `Date` corrido no es un instante real: solo sirve para leerle el día y la
hora con los métodos `getUTC*`, que no dependen de la zona del proceso.

| Instante | `aHoraLocal` con el offset por defecto (`-3`) | Con `OFFSET_HORA_UTC=9` |
|---|---|---|
| `2026-11-08T14:00:00Z` | domingo 11:00 | domingo 23:00 |
| `2026-11-10T01:00:00Z` | **lunes 22:00** | **martes 10:00** |

(Los dos resultados son los mismos con el proceso de Node en Tokio: la zona del
proceso no interviene.)

`validarHorarioClase` (`src/services/clase.service.ts:118`) llama a
`aHoraLocal` para el inicio y para el fin (`:123-124`). Primero comprueba que
caigan el mismo día (`:125`, "La clase no puede cruzar el cambio de día"), y
después que la franja entre en un tramo de la escuela y en uno del profesor.

Lo que pasaría con `getDay()` y `getHours()`, que usan la zona del proceso,
con la clase del **lunes a las 22:00 de Argentina**:

| Proceso en… | `getDay()` | `getHours()` | Lo que creería el backend |
|---|---|---|---|
| `Buenos_Aires` | 1 | 22 | lunes 22:00 ✔ (de casualidad) |
| `UTC` (un deploy típico) | 2 | 1 | **martes 01:00** ✘ |
| `Tokio` | 2 | 10 | **martes 10:00** ✘ |

### 5. Comparar no necesita la zona

Cuando se comparan dos `Date`, JavaScript compara **los dos números**. Por eso
estas líneas son correctas en cualquier servidor, sin mirar la zona:

```ts
fin.getTime() - inicio.getTime() === DURACION_CLASE_MS   // clase.service.ts:84   dura 1 hora
inicio > new Date()                                      // clase.service.ts:91   es a futuro
clase.inicio <= new Date()                               // clase.service.ts:197  ya comenzó
const todaviaNoEmpezo = clase.inicio > new Date();       // clase.service.ts:368  ¿se devuelve el crédito?
```

`new Date()` es el instante actual del reloj del servidor. La misma
comparación, hecha a las 10:30 de Argentina, con una clase que empieza a las
11:00:

| Proceso en… | `new Date()` se muestra como | Número interno | `inicio > new Date()` |
|---|---|---|---|
| `Buenos_Aires` | 10:30 | 1794144600000 | `true` |
| `UTC` | 13:30 | 1794144600000 | `true` |
| `Tokio` | 22:30 | 1794144600000 | `true` |

Lo mismo pasa con la consulta de superposición de `validarAusenciaDeConflictos`
(`clase.service.ts:141`): `{ inicio: { $lt: fin }, fin: { $gt: inicio } }`
compara instantes, ahora dentro de MongoDB.

De lo único que dependen estas comparaciones es de que **el reloj del
servidor esté en hora** (sincronizado por NTP). Eso no tiene nada que ver con
la zona.

La regla de "la clase empieza en una hora en punto" (`empiezaEnPunto`,
`clase.service.ts:68`) es la excepción de esta sección: mira el **minuto de
la escuela** (`aHoraLocal(inicio).minuto === 0`), no el de UTC. Con `-03:00`
da lo mismo, pero con un offset como `+05:30`, las 09:00 en la escuela son
las 03:30 en UTC. Los segundos y milisegundos sí se miran en UTC
(`getUTCSeconds()`): ningún offset corre la hora en segundos.

### 6. Salida: ISO en UTC

`res.json` usa `JSON.stringify`, que escribe cada `Date` con `toISOString()`:
siempre en UTC y con `Z`, en cualquier zona del proceso.

```json
{ "inicio": "2026-11-08T14:00:00.000Z" }
```

El frontend lo convierte a la zona del usuario para mostrarlo. Un alumno que
viaja a otro país ve la clase en su hora local, y el instante sigue siendo el
mismo.

### 7. Por qué un offset fijo, y qué se pierde

Antes, la escuela se configuraba con un **nombre** de zona IANA
(`ZONA_HORARIA=America/Argentina/Buenos_Aires`) y `aHoraLocal` usaba `Intl`.
Se cambió a un **offset fijo** (`OFFSET_HORA_UTC`) porque la consulta de turnos
libres también necesita el camino inverso (de hora de reloj a instante), y
con un offset las dos direcciones son una suma y una resta del **mismo
número**: no se pueden contradecir. Con dos configuraciones (un nombre para
un lado y un offset para el otro) habría que mantenerlas iguales a mano.

Lo que se pierde es el **horario de verano automático**. Un nombre IANA
incluye esas reglas; un offset, no. Un ejemplo real con una zona que hoy sí
lo usa:

| Zona | 15 de enero de 2026 | 15 de julio de 2026 |
|---|---|---|
| `America/Santiago` | GMT-03:00 | GMT-04:00 ← cambia en el año |
| `America/Argentina/Buenos_Aires` | GMT-03:00 | GMT-03:00 |

Argentina hoy no lo usa, así que `-03:00` es correcto todo el año. Si lo
volviera a usar, habría que cambiar `OFFSET_HORA_UTC` y reiniciar el servidor en
cada cambio de hora. Ojo: las clases se guardan como instantes, así que al
cambiar el offset las clases futuras **ya reservadas** se ven corridas una
hora en el reloj de la escuela.

El valor es un número de horas: `-3`, `0` (UTC) o `5.5` para `+05:30`. Si no
es un número (`UTC`, `America/…`, `-03:00`), el servidor no arranca: `env.ts`
lanza *"OFFSET_HORA_UTC debe ser un número de horas (por ejemplo, -3)"*. Es
mejor que un `NaN`, que dejaría todas las fechas inválidas.

### 8. Por qué los tests corren en UTC

`vitest.config.ts:11` fija `env: { TZ: 'UTC' }`. Si alguien usara
`getHours()` en lugar de `aHoraLocal`, en una máquina en Argentina los tests
podrían pasar **de casualidad**, porque las dos zonas coinciden. En UTC fallan
siempre, y el error aparece antes de llegar al deploy.

### 9. Al revés: de la hora de reloj al instante

La consulta de **turnos libres** recibe un día y horas de reloj ("el 9/11/2026
desde las 08:00 **en la escuela**"), así que necesita el camino inverso de
`aHoraLocal`. Lo hacen tres funciones de `src/utils/fechas.ts`, todas con
`OFFSET_HORA_UTC`:

| Función | Qué hace | Ejemplo con `-03:00` |
|---|---|---|
| `instanteLocal(fecha, hora)` (`:159`) | fecha + hora de la escuela → `Date` | 8/11/2026 08:00 → `2026-11-08T11:00:00.000Z` |
| `hoyEnLaEscuela(ahora)` (`:135`) | qué día es hoy en la escuela | a las `2026-11-10T01:00Z` todavía es el **9/11** |
| `diaDeLaSemana(fecha)` (`:125`) | qué día de la semana es una fecha | 9/11/2026 → lunes |

`instanteLocal` le **resta** el offset a la fecha y hora escritas como si
fueran UTC, justo lo contrario de `aHoraLocal`. Por eso
`aHoraLocal(instanteLocal(fecha, hora))` devuelve siempre la misma hora (hay
un test con `-03:00` y otro con `+05:30`). `diaDeLaSemana` ni siquiera
necesita el offset: un día del calendario es el mismo día de la semana en todo
el mundo.

Las fechas de calendario se representan con `FechaCalendario`
(`{ anio, mes, diaDelMes }`, el mes de 1 a 12), no con un `Date`: un día no es
un instante.

---

## Qué puede salir mal

| Síntoma | Causa |
|---|---|
| Las clases quedan corridas 3 horas | Se aceptó una fecha **sin zona**, o se usó `getHours()` en lugar de `aHoraLocal`. |
| Una clase del lunes a la noche figura como martes | Se usó `getDay()`: en un servidor en UTC ya es el día siguiente. |
| Todo anda en tu máquina y falla en el deploy | Algún cálculo depende de la zona del proceso. En tu máquina coincide con la de la escuela; en el servidor (UTC), no. |
| Medio año las clases están corridas una hora | El país usa horario de verano y `OFFSET_HORA_UTC` no se cambió (el offset es fijo). |
| El servidor no arranca: "OFFSET_HORA_UTC debe ser un número de horas" | `OFFSET_HORA_UTC` está mal escrito en el `.env` (por ejemplo `-03:00` o un nombre de zona). |
| Postman reserva a las 10:00 y la API dice "fuera del horario" | `offsetZona` del environment de Postman no coincide con el `OFFSET_HORA_UTC` del servidor (`-03:00` en Postman es `-3` en el `.env`). |
| "La clase debe reservarse para una fecha futura" con una fecha que sí es futura | El reloj del servidor está mal, no la zona: `new Date()` es la hora del sistema. |
| La API devuelve `14:00` y el usuario esperaba `11:00` | No es un error: la salida es UTC. El frontend tiene que convertirla a la zona del usuario. |

---

## Resumen

- Un `Date` es **un número** (milisegundos desde 1970 en UTC): un instante,
  **sin** zona.
- La zona importa solo en dos lugares:
  - **al entrar**: el texto tiene que traer `Z` o `±HH:MM` (`parsearInstante`,
    en el DTO);
  - **al calcular día y hora de reloj** (y al revés): siempre con
    `OFFSET_HORA_UTC` (`aHoraLocal`, `instanteLocal`), nunca con
    `getDay()`/`getHours()`.
- **Guardar, comparar y medir duraciones no necesitan la zona**. Por eso
  `clase.inicio > new Date()` es correcto en cualquier servidor.
- La salida es ISO en UTC; el frontend la muestra en la zona del usuario.
- `OFFSET_HORA_UTC` (del `.env`, `-3` por defecto) es la única fuente de la
  hora de la escuela: simple y sin contradicciones, a cambio de no contemplar
  el horario de verano. Los tests corren en UTC para que un error de zona no
  pase de casualidad.

---

## Siguiente lectura

- [`../capas/10-utils-y-fechas.md`](../capas/10-utils-y-fechas.md#5-fechasts-el-instante-y-la-hora-de-la-escuela):
  la expresión regular de `parsearInstante` y cómo `aHoraLocal` usa el
  offset.
- [`../temas/horarios-y-agendamiento.md`](../temas/horarios-y-agendamiento.md):
  qué es un tramo, los dos calendarios y las comprobaciones de una reserva.
- [`../flujos/agendar-una-clase.md`](../flujos/agendar-una-clase.md): una
  reserva de punta a punta, con las respuestas reales de la API.
