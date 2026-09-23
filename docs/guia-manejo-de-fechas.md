# Guía: cómo se manejan las fechas y la zona horaria

Esta guía explica cómo el proyecto guarda, valida y compara fechas —hoy,
el `inicio` y el `fin` de una `Clase`— y por qué la **zona horaria** obliga
a seguir unas pocas reglas fijas. Está pensada para alguien que está
aprendiendo **TypeScript** y **Mongoose** al mismo tiempo.

**Todos los ejemplos de acá son código real** de `src/models/Clase.ts`,
`src/utils/fechas.ts`, `src/services/clase.service.ts` y
`src/config/env.ts`.

Compañeras de esta guía:
[guia-manejo-de-errores.md](guia-manejo-de-errores.md) explica qué pasa con
el `ErrorDeNegocio` que lanza `parsearInstante`;
[guia-models-mongoose.md](guia-models-mongoose.md) explica los schemas en
general.

---

## 1. La idea central: un `Date` es un instante, no una hora de reloj

"Las 09:00 en Buenos Aires" y "las 12:00 en UTC" son **el mismo instante**:
el mismo momento en el tiempo, visto desde dos relojes distintos. Un `Date`
de JavaScript (y un `Date` de MongoDB) guarda eso, el instante, como
milisegundos desde el 1/1/1970 UTC. **No guarda zona horaria.**

La zona horaria solo aparece en los **bordes**: cuando un texto se
convierte en `Date` (entrada), y cuando un `Date` se convierte en algo que
un humano lee —"lunes a las 9"— (cálculos locales y salida). Todos los
problemas de fechas del proyecto viven en esos bordes, y cada uno tiene su
regla:

```
 FRONTEND                         BACKEND                          MONGODB
┌─────────┐  (1) ENTRADA    ┌──────────────────────┐ (2) GUARDADO ┌───────┐
│ "…T09:00│ ──────────────▶ │ parsearInstante()    │ ───────────▶ │ Date  │
│  -03:00"│  solo ISO con   │  string → Date       │  UTC, sin    │ (UTC) │
│         │  zona           │                      │  tocar nada  │       │
│         │                 │ (3) CÁLCULOS LOCALES │              │       │
│         │                 │ aHoraLocal()         │              │       │
│         │  (4) SALIDA     │  Date → lunes 09:00  │              │       │
│ muestra │ ◀────────────── │ res.json → ISO UTC   │ ◀─────────── │       │
└─────────┘  "…T12:00Z"     └──────────────────────┘              └───────┘
```

| # | Borde | Regla | Dónde |
|---|---|---|---|
| 1 | Entrada | Solo ISO 8601 **con** zona (`Z` o `-03:00`); lo demás → 400 | `parsearInstante` en `src/utils/fechas.ts` |
| 2 | Guardado | `Date` en UTC; no se configura nada | `Clase.ts` (`type: Date`) |
| 3 | Cálculos locales | Siempre `Intl` con `ZONA_HORARIA`; **nunca** `getDay()`/`getHours()` | `aHoraLocal` en `src/utils/fechas.ts` |
| 4 | Salida | ISO en UTC tal cual; el frontend decide cómo mostrarlo | `res.json` (automático) |

---

## 2. El modelo: `inicio` y `fin` como `Date`

```ts
// src/models/Clase.ts
inicio: {
  type: Date,
  required: [true, 'El inicio de la clase es obligatorio'],
},

fin: {
  type: Date,
  required: [true, 'El fin de la clase es obligatorio'],
},
```

Cada campo es un **instante completo** (fecha + hora). No hay campos
`fecha`/`horaInicio`/`horaFin` separados.

### Por qué `Date` y no strings

Se evaluaron dos caminos: guardar la fecha como string `"AAAA-MM-DD"` y las
horas como `{ hora, minuto }` (sin zona horaria, como `Profesor.disponibilidad`),
o guardar dos `Date`. Se eligió `Date` porque:

- **Buscar superposiciones es una sola consulta a Mongo** (ver §6), en vez
  de traer las clases del día y comparar en JS.
- Ordenar, filtrar por rango ("clases de esta semana") e indexar funcionan
  de forma nativa.
- Mongoose ya rechaza solo lo que no se puede convertir a fecha.

El costo es justamente la zona horaria, que es lo que resuelve el resto de
esta guía.

### Regla entre campos: `fin > inicio`

```ts
// src/models/Clase.ts
claseSchema.pre('validate', async function () {
  const inicio = this.get('inicio') as Date | undefined;
  const fin = this.get('fin') as Date | undefined;

  if (inicio && fin && inicio >= fin) {
    this.invalidate('fin', 'El fin de la clase debe ser posterior al inicio');
  }
});
```

Mismo patrón que `tramoSchema` en `CalendarioSemanal.ts`. Los `Date` se
pueden comparar con `<`, `>=`, etc. directamente (JS los convierte a
milisegundos).

> ⚠️ **Limitación conocida**: `pre('validate')` es middleware de
> *documento*: corre en `create`/`save`, **no** en `findByIdAndUpdate`
> (`runValidators` solo corre los validadores de cada campo). Hoy, un
> `actualizar` que mande solo un `fin` anterior al `inicio` guardado **no**
> se rechaza. Para cubrirlo hay que chequearlo a mano en
> `clase.service.actualizar`.

---

## 3. La zona horaria de la escuela: `ZONA_HORARIA`

```ts
// src/config/env.ts
export const ZONA_HORARIA: string =
  process.env.ZONA_HORARIA ?? 'America/Argentina/Buenos_Aires';
```

Es la **única** fuente de verdad sobre "en qué zona está la escuela". Se
puede cambiar desde `.env` (ver `.env.example`), pero el default ya es el
correcto.

### Por qué una constante y no la variable `TZ` del proceso

Node permite lanzar el server con `TZ=America/Argentina/Buenos_Aires`, y
entonces `getDay()`/`getHours()` responden en hora argentina. El problema es
que el resultado depende de **cómo se lanzó el proceso**: en tu PC anda, en
un deploy (que casi siempre corre en UTC) o en la PC de un compañero da
otro número, sin ningún error. Con una constante explícita, el mismo código
da lo mismo en cualquier máquina.

### Por qué un nombre IANA y no `"-03:00"`

`America/Argentina/Buenos_Aires` es un nombre de la base de datos de zonas
horarias IANA, que conoce toda la historia de cada zona. Argentina hoy no
tiene horario de verano, pero lo tuvo; si vuelve, el nombre lo contempla
solo. Un `-03:00` escrito a mano no.

---

## 4. Entrada: `parsearInstante`

### El problema

JSON no tiene tipo fecha: `inicio` llega en el body como **string**, y
`new Date(texto)` —que es lo que hace Mongoose por dentro— interpreta cada
formato distinto:

| el cliente manda | `new Date()` lo interpreta como |
|---|---|
| `"2026-09-20T09:00:00-03:00"` | 09:00 en Argentina ✅ |
| `"2026-09-20T12:00:00Z"` | 12:00 UTC (= 09:00 AR) ✅ |
| `"2026-09-20T09:00:00"` | 09:00 **en la zona del server** ⚠️ |
| `"2026-09-20"` | medianoche **UTC** ⚠️ |
| `"September 20, 2026"` | lo acepta igual ⚠️ |

Las filas ⚠️ se guardarían **sin error**, con un instante que depende de
dónde corra el server. `parsearInstante` corta eso en la entrada.

### La función

```ts
// src/utils/fechas.ts
export function parsearInstante(
  valor: unknown,
  campo: string,
): Date | undefined {
  if (valor === undefined) return undefined;

  let instante: Date | null = null;
  if (valor instanceof Date) {
    instante = valor;
  } else if (typeof valor === 'string') {
    const m = ISO_CON_ZONA.exec(valor);
    if (m && esDiaDeCalendario(Number(m[1]), Number(m[2]), Number(m[3]))) {
      instante = new Date(valor);
    }
  }

  if (instante === null || isNaN(instante.getTime())) {
    throw new ErrorDeNegocio(
      `${campo} debe ser una fecha ISO 8601 con zona horaria (ej. 2026-09-20T09:00:00-03:00)`,
    );
  }
  return instante;
}
```

Qué acepta y qué hace con cada cosa:

- **`undefined`** → lo devuelve tal cual. En `crear`, así el `required` del
  schema es quien reporta que falta (con su mensaje de siempre, vía
  `ValidationError`). En `actualizar`, significa "este campo no viene".
- **Un `Date`** → ya es un instante sin ambigüedad; se devuelve tal cual.
  Sirve cuando el service se llama desde código (ej. los tests).
- **Un string ISO con zona que representa un día real** → `new Date(valor)`.
- **Cualquier otra cosa** (string sin zona, texto libre, un número...) →
  `ErrorDeNegocio` → el middleware de errores responde **400** con ese
  mensaje.

### `ISO_CON_ZONA`: la regex

```ts
const ISO_CON_ZONA =
  /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
```

```
^                         empieza acá (nada antes)
(\d{4})                   año: 4 dígitos                        → 2026
-(\d{2})                  mes: 2 dígitos                        → 09
-(\d{2})                  día: 2 dígitos                        → 20
T                         separa fecha y hora
([01]\d|2[0-3])           hora: 00–19 o 20–23                   → 09
:[0-5]\d                  minutos: 00–59                        → :00
(:[0-5]\d(\.\d+)?)?       opcional: segundos 00–59,             → :00
                            y adentro, opcional: milisegundos   → .000
(Z|[+-]\d{2}:\d{2})       zona OBLIGATORIA: "Z" (UTC)           → Z
                            o un offset +HH:MM / -HH:MM         → -03:00
$                         termina acá (nada después)
```

La parte que le da el nombre es la última: `(Z|[+-]\d{2}:\d{2})` **no**
tiene `?`, así que un string sin zona no coincide.

Los paréntesis de año, mes y día son **grupos de captura**: además de
verificar, guardan lo que coincidió en `m[1]`, `m[2]`, `m[3]`, que se usan
en el paso siguiente.

### `esDiaDeCalendario`: la regex revisa la forma, no el calendario

```ts
function esDiaDeCalendario(anio: number, mes: number, dia: number): boolean {
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  return d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}
```

`"2026-02-31T09:00:00Z"` tiene forma perfecta, y **JavaScript no lo
rechaza**: no da `Invalid Date`, lo "corre" en silencio al 3 de marzo. Esta
función arma la fecha con los números capturados y verifica que JS no la
haya corrido: si pedimos el 31 de febrero y sale marzo, el día no existe.
(Se usan `Date.UTC`/`getUTC*` a propósito: acá solo importa el calendario,
y así la zona del proceso no interviene.)

### Cómo lo usa el service

```ts
// src/services/clase.service.ts
export type DatosClase = Omit<Clase, 'inicio' | 'fin'> & {
  inicio: Date | string;
  fin: Date | string;
};

export async function crear(datos: DatosClase): Promise<ClaseDoc> {
  return ClaseModel.create({
    ...datos,
    inicio: parsearInstante(datos.inicio, 'inicio'),
    fin: parsearInstante(datos.fin, 'fin'),
  });
}
```

`DatosClase` describe lo que **llega del body**: igual que `Clase`, pero con
`inicio`/`fin` como `Date | string` (el `&` es un tipo intersección: junta
las propiedades de ambos lados). `Clase` sigue describiendo lo que **está
guardado**: siempre `Date`.

En `actualizar`, `inicio`/`fin` solo se parsean **si vinieron** en los
cambios, para no pisar con `undefined` lo que ya está guardado:

```ts
const { inicio, fin, ...resto } = cambios;
const update: Partial<Clase> = { ...resto };
if (inicio !== undefined) update.inicio = parsearInstante(inicio, 'inicio');
if (fin !== undefined) update.fin = parsearInstante(fin, 'fin');
```

### Qué tiene que hacer el frontend

Mandar siempre el resultado de `toISOString()`, que ya viene en UTC con `Z`:

```ts
const inicio = new Date(2026, 8, 20, 9, 0); // 20/09/2026 09:00, hora del navegador
fetch('/api/clases', {
  method: 'POST',
  body: JSON.stringify({ ...resto, inicio: inicio.toISOString() }),
  // → "2026-09-20T12:00:00.000Z" si el navegador está en Argentina
});
```

---

## 5. Guardado: no se toca

MongoDB **siempre** guarda un `Date` en UTC. No hay nada que configurar, y
no conviene intentarlo. Por ejemplo, `"2026-09-20T09:00:00-03:00"` queda
guardado como `2026-09-20T12:00:00.000Z` —el test "guarda el instante en
UTC respetando el offset enviado" de `clase.service.test.ts` verifica
exactamente eso.

---

## 6. Cálculos locales: `aHoraLocal`

### El problema

La disponibilidad del profesor está en **hora de reloj argentina** y por
**día de la semana**: "lunes de 9:00 a 12:00" (`Record<Dia, Tramo[]>`, ver
`CalendarioSemanal.ts`). Para saber si una clase entra ahí, hay que
traducir su `inicio` (un instante) a "qué día y qué hora es **en la
escuela**".

Los métodos de `Date` que parecen hacer eso —`getDay()`, `getHours()`,
`getMinutes()`— responden en la zona **del proceso**, no en la de la
escuela. Con el server en UTC:

```ts
const inicio = new Date('2026-09-21T01:30:00Z'); // domingo 20, 22:30 en Argentina

inicio.getDay();   // 1 → "lunes"   ❌ (en UTC ya es lunes)
inicio.getHours(); // 1             ❌
```

### La función

```ts
// src/utils/fechas.ts
const formatoLocal = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA_HORARIA,
  weekday: 'long',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export type HoraLocal = { dia: Dia } & HoraDelDia;

export function aHoraLocal(instante: Date): HoraLocal {
  const partes = Object.fromEntries(
    formatoLocal.formatToParts(instante).map((p) => [p.type, p.value]),
  );
  return {
    dia: DIA_POR_NOMBRE_EN[partes.weekday],
    hora: Number(partes.hour),
    minuto: Number(partes.minute),
  };
}
```

Paso a paso:

- **`Intl.DateTimeFormat`** es la API estándar de JS (viene con Node, no hay
  que instalar nada) para formatear fechas **en la zona que uno le pida**
  con `timeZone`, sin importar la del proceso.
- **`formatToParts`** devuelve el resultado en pedazos en vez de un solo
  string, ej. `[{ type: 'weekday', value: 'Sunday' }, { type: 'hour',
  value: '22' }, ...]`.
- **`Object.fromEntries(... .map(p => [p.type, p.value]))`** convierte esa
  lista en un objeto `{ weekday: 'Sunday', hour: '22', minute: '30', ... }`
  para leerlo por nombre.
- **Locale `'en-US'`**: los nombres en inglés son estables y sin tildes, así
  el mapeo `DIA_POR_NOMBRE_EN` (`Sunday → 'domingo'`, etc.) es seguro.
- **`hourCycle: 'h23'`**: medianoche sale como `00`, no como `24`.
- El formateador se crea **una vez**, fuera de la función: crearlo es
  relativamente caro y la configuración nunca cambia.

`HoraLocal` es `{ dia: Dia } & HoraDelDia`, o sea
`{ dia: Dia; hora: number; minuto: number }`. Como incluye `HoraDelDia`, el
resultado se puede pasar directo a `aMinutos()`.

### Cómo se va a usar (pendiente en `clase.service.ts`)

Chequear que la clase entre en la disponibilidad del profesor:

```ts
const ini = aHoraLocal(clase.inicio); // { dia: 'lunes', hora: 9, minuto: 0 }
const fin = aHoraLocal(clase.fin);

const entra =
  ini.dia === fin.dia && // la clase no cruza la medianoche
  profesor.disponibilidad[ini.dia].some(
    (t) =>
      aMinutos(t.horaInicio) <= aMinutos(ini) &&
      aMinutos(fin) <= aMinutos(t.horaFin),
  );
```

---

## 7. Comparaciones que NO necesitan zona horaria

Todo lo que compara **instantes con instantes** funciona directo, sin
`aHoraLocal`:

**Superposición con otra clase** (profesor o auto ocupado) — una sola
consulta:

```ts
const ocupado = await ClaseModel.exists({
  profesor,                        // o { auto }
  estado: { $ne: 'cancelada' },
  inicio: { $lt: finNueva },       // la otra empieza antes de que termine la nueva
  fin: { $gt: inicioNueva },       // y termina después de que empiece la nueva
});
```

Es la condición estándar de superposición de intervalos: *A empieza antes
de que termine B, y B empieza antes de que termine A*. Con `<`/`>` estrictos,
una clase de 9 a 10 y otra de 10 a 11 **no** chocan. En `actualizar` hay
que excluir la clase misma con `_id: { $ne: id }`.

**"¿Ya pasó?"**:

```ts
clase.inicio < new Date()
```

**Rango de fechas y orden**:

```ts
ClaseModel.find({ inicio: { $gte: desde, $lt: hasta } }).sort({ inicio: 1 });
```

> Ojo con los límites de un rango "por día": "las clases del 20/09" en la
> escuela son de `2026-09-20T00:00:00-03:00` a `2026-09-21T00:00:00-03:00`,
> **no** de `...T00:00Z` a `...T00:00Z` (eso sería de 21:00 del 19 a 21:00
> del 20, hora argentina). Armen esos límites con el offset explícito.

---

## 8. Salida: ISO UTC, y el frontend lo muestra

`res.json(clase)` serializa cada `Date` con `toISOString()`:

```json
{ "inicio": "2026-09-20T12:00:00.000Z", "fin": "2026-09-20T13:00:00.000Z" }
```

Se deja así: es estándar y no tiene ambigüedad. El frontend lo convierte
para mostrarlo:

```ts
new Date(clase.inicio).toLocaleString('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires',
});
// "20/9/2026, 09:00:00"
```

No agreguen al backend campos ya formateados tipo `inicioLocal: "09:00"`:
mezclan presentación con datos y se terminan desincronizando.

---

## 9. Tests: el proceso corre en UTC

```ts
// vitest.config.ts
env: { TZ: 'UTC' },
```

Fuerza la zona del proceso de tests a UTC, como un deploy típico. Así, si
alguien usa `getDay()`/`getHours()` en vez de `aHoraLocal`, el test falla
**en todas las máquinas** —no solo en producción, ni pasa "de casualidad"
en una PC configurada en Argentina.

Qué cubre cada archivo:

- **`tests/utils/fechas.test.ts`** (sin base de datos):
  - `parsearInstante`: acepta ISO con offset, ISO con `Z`, un `Date`, y
    `undefined`; rechaza string sin zona, solo fecha, texto libre, fecha
    imposible (`2026-02-31`), hora imposible (`25:00`) y un número.
  - `aHoraLocal`: 12:00 UTC → domingo 09:00; **01:30 UTC del lunes →
    domingo 22:30** (el caso que `getDay()` haría mal); 03:00 UTC → lunes
    00:00 (no 24:00).
- **`tests/services/clase.service.test.ts`** (con Mongo en memoria):
  guardado en UTC respetando el offset, `Date` como entrada, `inicio`/`fin`
  obligatorios, rechazo de strings sin zona o que no son fecha (en `crear`
  y en `actualizar`), y `fin` posterior a `inicio`.

---

## 10. Resumen: qué usar en cada caso

| Necesito... | Usar | No usar |
|---|---|---|
| convertir lo que llega del body a `Date` | `parsearInstante(valor, 'campo')` | `new Date(valor)` directo |
| saber qué día / qué hora es en la escuela | `aHoraLocal(instante)` | `getDay()`, `getHours()`, `getMinutes()` |
| comparar dos instantes (antes/después, superposición, "ya pasó") | `<`, `>`, `$lt`, `$gt` directo | `aHoraLocal` (no hace falta) |
| saber en qué zona está la escuela | `ZONA_HORARIA` (`src/config/env.ts`) | `'-03:00'` escrito a mano, `TZ` del proceso |
| devolver una fecha al cliente | `res.json` tal cual (ISO UTC) | campos preformateados |

---

## 11. Glosario rápido

| Término | Qué es |
|---|---|
| **Instante** | Un momento único en el tiempo, independiente de cualquier reloj. Es lo que guarda un `Date`. |
| **Hora de reloj / hora local** | Cómo se ve un instante en una zona: "lunes 09:00" en Argentina. |
| **UTC** | Tiempo Universal Coordinado: la referencia "cero" de las zonas horarias. Mongo guarda en UTC. |
| **Offset** | Diferencia de una zona con UTC en un momento dado, ej. `-03:00`. |
| **Zona IANA** | Nombre estándar de una zona con toda su historia (`America/Argentina/Buenos_Aires`). Preferible a un offset fijo. |
| **ISO 8601** | Formato estándar de fecha/hora: `2026-09-20T09:00:00-03:00`. La `T` separa fecha y hora; al final va `Z` (UTC) o el offset. |
| **`Intl.DateTimeFormat`** | API estándar de JS para formatear fechas en la zona y el idioma que uno elija. |
| **`TZ`** | Variable de entorno que fija la zona del *proceso* de Node. Solo se usa en tests (`UTC`), nunca como regla de negocio. |
