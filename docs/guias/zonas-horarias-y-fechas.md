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
El detalle de la expresión regular y de `Intl` está en
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
       aHoraLocal + ZONA_HORARIA  inicio > new Date()           res.json
       → domingo 11:00            superposición, duración       → "2026-11-08T14:00:00.000Z"
       ¿entra en el horario?      ¿todavía no empezó?           (el frontend lo muestra
                                                                 en la zona del usuario)
```

| Paso | ¿Importa la zona? | Dónde |
|---|---|---|
| ① Texto → `Date` | **Sí**: hay que saber de qué zona es la hora | `utils/fechas.ts:37` (`parsearInstante`), lo llama `dtos/clase.dto.ts:56` |
| ② Guardar | No | MongoDB guarda el número de milisegundos (UTC) |
| ③ `Date` → día y hora de reloj | **Sí**: se usa la zona **de la escuela** | `utils/fechas.ts:89` (`aHoraLocal`), lo usa `services/clase.service.ts:109` |
| ④ Comparar y medir | No | `clase.service.ts:67`, `:77`, `:156`, `:323` y la consulta de superposición |
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

Eso hace `aHoraLocal` (`src/utils/fechas.ts:89`), con
`Intl.DateTimeFormat` y `timeZone: ZONA_HORARIA` (`:77`). `ZONA_HORARIA` sale
de `src/config/env.ts:77`: vale `America/Argentina/Buenos_Aires` si el `.env`
no dice otra cosa.

| Instante | `aHoraLocal` con la zona por defecto | Con `ZONA_HORARIA=Asia/Tokyo` |
|---|---|---|
| `2026-11-08T14:00:00Z` | domingo 11:00 | domingo 23:00 |
| `2026-11-10T01:00:00Z` | **lunes 22:00** | **martes 10:00** |

`validarHorarioClase` (`src/services/clase.service.ts:104`) llama a
`aHoraLocal` para el inicio y para el fin (`:109-110`). Primero comprueba que
caigan el mismo día (`:111`, "La clase no puede cruzar el cambio de día"), y
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
fin.getTime() - inicio.getTime() === DURACION_CLASE_MS   // clase.service.ts:67   dura 1 hora
inicio > new Date()                                      // clase.service.ts:77   es a futuro
clase.inicio <= new Date()                               // clase.service.ts:156  ya comenzó
const todaviaNoEmpezo = clase.inicio > new Date();       // clase.service.ts:323  ¿se devuelve el crédito?
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
(`clase.service.ts:134`): `{ inicio: { $lt: fin }, fin: { $gt: inicio } }`
compara instantes, ahora dentro de MongoDB.

De lo único que dependen estas comparaciones es de que **el reloj del
servidor esté en hora** (sincronizado por NTP). Eso no tiene nada que ver con
la zona.

El chequeo de "precisión de minutos" (`clase.service.ts:71-74`) usa
`getUTCSeconds()` y `getUTCMilliseconds()`, que no dependen del proceso. Y
usar UTC no cambia el resultado: todos los husos horarios corren la hora en
minutos enteros, nunca en segundos.

### 6. Salida: ISO en UTC

`res.json` usa `JSON.stringify`, que escribe cada `Date` con `toISOString()`:
siempre en UTC y con `Z`, en cualquier zona del proceso.

```json
{ "inicio": "2026-11-08T14:00:00.000Z" }
```

El frontend lo convierte a la zona del usuario para mostrarlo. Un alumno que
viaja a otro país ve la clase en su hora local, y el instante sigue siendo el
mismo.

### 7. Por qué un nombre de zona y no un offset fijo

`ZONA_HORARIA` es un **nombre** IANA (`America/Argentina/Buenos_Aires`), no un
offset como `-03:00`. El nombre incluye las reglas de horario de verano de esa
zona, así que si un país lo vuelve a usar, `Intl` lo aplica solo. Un ejemplo
real con una zona que hoy sí lo usa:

| Zona | 15 de enero de 2026 | 15 de julio de 2026 |
|---|---|---|
| `America/Santiago` | GMT-03:00 | GMT-04:00 ← cambia en el año |
| `America/Argentina/Buenos_Aires` | GMT-03:00 | GMT-03:00 |

Con un `-03:00` fijo, una escuela en Santiago tendría la mitad del año todas
las clases corridas una hora.

### 8. Por qué los tests corren en UTC

`vitest.config.ts:11` fija `env: { TZ: 'UTC' }`. Si alguien usara
`getHours()` en lugar de `aHoraLocal`, en una máquina en Argentina los tests
podrían pasar **de casualidad**, porque las dos zonas coinciden. En UTC fallan
siempre, y el error aparece antes de llegar al deploy.

### 9. Lo que todavía no existe: de la hora de reloj al instante

El proyecto sabe ir de **instante → hora de la escuela** (`aHoraLocal`), pero
no al revés: "el 8/11/2026 a las 08:00 **en la escuela**" → `Date`. Hoy no
hace falta, porque el cliente siempre manda el instante con su zona.

Lo va a necesitar el endpoint planeado de **turnos libres** (I-20), que
recibe un día y un rango de horas de reloj. Es la conversión más delicada: el
offset depende de la fecha (por el horario de verano), así que tiene que
calcularse con `Intl` y `ZONA_HORARIA`, igual que `aHoraLocal`, y nunca
restando un `-3` fijo.

---

## Qué puede salir mal

| Síntoma | Causa |
|---|---|
| Las clases quedan corridas 3 horas | Se aceptó una fecha **sin zona**, o se usó `getHours()` en lugar de `aHoraLocal`. |
| Una clase del lunes a la noche figura como martes | Se usó `getDay()`: en un servidor en UTC ya es el día siguiente. |
| Todo anda en tu máquina y falla en el deploy | Algún cálculo depende de la zona del proceso. En tu máquina coincide con la de la escuela; en el servidor (UTC), no. |
| Medio año las clases están corridas una hora | Se usó un offset fijo (`-03:00`) en lugar de un nombre IANA, en una zona con horario de verano. |
| "La clase debe reservarse para una fecha futura" con una fecha que sí es futura | El reloj del servidor está mal, no la zona: `new Date()` es la hora del sistema. |
| La API devuelve `14:00` y el usuario esperaba `11:00` | No es un error: la salida es UTC. El frontend tiene que convertirla a la zona del usuario. |

---

## Resumen

- Un `Date` es **un número** (milisegundos desde 1970 en UTC): un instante,
  **sin** zona.
- La zona importa solo en dos lugares:
  - **al entrar**: el texto tiene que traer `Z` o `±HH:MM` (`parsearInstante`,
    en el DTO);
  - **al calcular día y hora de reloj**: siempre con `ZONA_HORARIA`
    (`aHoraLocal`), nunca con `getDay()`/`getHours()`.
- **Guardar, comparar y medir duraciones no necesitan la zona**. Por eso
  `clase.inicio > new Date()` es correcto en cualquier servidor.
- La salida es ISO en UTC; el frontend la muestra en la zona del usuario.
- `ZONA_HORARIA` es un nombre IANA para que el horario de verano funcione solo,
  y los tests corren en UTC para que un error de zona no pase de casualidad.

---

## Siguiente lectura

- [`../capas/10-utils-y-fechas.md`](../capas/10-utils-y-fechas.md#5-fechasts-el-instante-y-la-hora-de-la-escuela):
  la expresión regular de `parsearInstante` y cada opción de `Intl` en
  `aHoraLocal`.
- [`../temas/horarios-y-agendamiento.md`](../temas/horarios-y-agendamiento.md):
  qué es un tramo, los dos calendarios y las comprobaciones de una reserva.
- [`../flujos/agendar-una-clase.md`](../flujos/agendar-una-clase.md): una
  reserva de punta a punta, con las respuestas reales de la API.
