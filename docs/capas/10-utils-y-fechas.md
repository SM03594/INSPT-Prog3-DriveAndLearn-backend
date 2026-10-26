# Utils y fechas: las funciones de apoyo

## Qué es esto, en una frase

`src/utils/` reúne funciones chicas que **no pertenecen a ninguna capa** en
particular y que otras capas reutilizan: comprobar el body, comprobar tipos,
hashear contraseñas y, la más delicada, **interpretar fechas y horas sin
equivocarse de zona horaria**.

---

## El mapa

| Archivo | Exporta | Lo usan |
|---|---|---|
| `cuerpoPeticion.ts` | `cuerpoComoObjeto`, `esObjetoJson` | `validacionCampos`, `calendarioSemanal.dto` |
| `validacionTipos.ts` | `esDelTipo`, `DESCRIPCION_TIPO`, `NombreTipo`, `TipoSegunNombre` | `validacionCampos` |
| `validacionCampos.ts` | `validarCampos`, `exigido` y sus tipos | todos los DTO (`src/dtos/`) |
| `password.ts` | `conPasswordHasheada` | `alumno.service`, `administrador.service` |
| `fechas.ts` | `parsearInstante`, `aHoraLocal`, `HoraLocal` | `clase.dto` (`parsearInstante`), `clase.service` (`aHoraLocal`) |

Cada uno tiene su test en `tests/utils/`. Como son funciones puras (o casi),
son lo más fácil de testear del proyecto.

---

## El recorrido

### 1. `cuerpoPeticion.ts`: ¿el body es un objeto?

`src/utils/cuerpoPeticion.ts:24`:

```ts
export function esObjetoJson(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

export function cuerpoComoObjeto(body: unknown): Record<string, unknown> {
  if (!esObjetoJson(body)) {
    throw new ErrorPeticionInvalida('El cuerpo de la petición debe ser un objeto JSON');
  }
  return body;
}
```

`esObjetoJson` es un **type guard**: responde `true` o `false` y, si es `true`,
TypeScript trata el valor como un objeto. Descarta `null` (porque
`typeof null` también es `'object'`) y los arrays. Lo usan también el DTO del
calendario, para comprobar que cada tramo de la lista sea un objeto, y el
middleware `validacionDeCuerpo`.

`cuerpoComoObjeto` usa ese guard para **lanzar** un error 400 si el body no es
un objeto. Es el primer paso de `validarCampos` (sección 3). Por qué existe si
`validacionDeCuerpo` ya hace ese chequeo en la ruta se explica en
[`06-controllers.md`](06-controllers.md#2-leer-la-entrada).

### 2. `validacionTipos.ts`: comprobar tipos usando un texto

**El problema.** Un service quiere tener una tabla de campos que diga "el
email tiene que ser un texto", y comprobarlo en un bucle. Pero los tipos de
TypeScript **no existen al ejecutar**: no se puede guardar `string` en una
variable. Lo que sí existe es el **texto** que devuelve `typeof`: `'string'`,
`'number'`, `'boolean'`.

**La solución** es un mapa que une cada texto con su tipo
(`src/utils/validacionTipos.ts:18`):

```ts
type TipoSegunNombre = {
  string: string;
  number: number;
  boolean: boolean;
};
export type NombreTipo = keyof TipoSegunNombre;   // 'string' | 'number' | 'boolean'

export function esDelTipo<T extends NombreTipo>(
  valor: unknown,
  tipo: T,
): valor is TipoSegunNombre[T] {
  return typeof valor === tipo;        // ← la comprobación real, con el texto
}
```

`esDelTipo(valor, 'string')` comprueba al ejecutar que `typeof valor ===
'string'`, y le avisa a TypeScript que, si devolvió `true`, `valor` es un
`string`. El tipo `TipoSegunNombre[T]` es "buscar en el mapa el tipo que
corresponde a ese texto".

Lo usa `validarCampos` (sección 3) para recorrer la tabla de campos de un DTO:

```ts
const CAMPOS_ALUMNO = {                                   // src/dtos/alumno.dto.ts:30
  email:  { tipo: 'string', nombre: 'El email' },
  nomApe: { tipo: 'string', nombre: 'El nombre y apellido' },
  // ...
} as const;

// dentro de validarCampos, por cada campo que llegó:
if (!cumpleTipo(valor, tipo)) {                            // → esDelTipo(valor, 'string')
  throw new ErrorDeNegocio(`${nombre} debe ser ${DESCRIPCION_CAMPO[tipo]}`);
  //                          "El email debe ser un texto"
}
```

`DESCRIPCION_TIPO` traduce `'string'` a "un texto" para el mensaje de error.
Está declarado con `satisfies Record<NombreTipo, string>`: si algún día se
agrega un tipo al mapa y no se agrega su descripción, no compila. Los
conceptos de TypeScript que aparecen acá se explican en
[`02-typescript-en-el-proyecto.md`](02-typescript-en-el-proyecto.md).

### 3. `validacionCampos.ts`: el helper de los DTO

`validarCampos(body, tabla, opciones)` (`src/utils/validacionCampos.ts:89`)
junta las dos piezas anteriores y agrega lo que hace falta para validar un
body completo:

```
body
 ├─ cuerpoComoObjeto ............................ 400 si no es un objeto
 ├─ ¿cada clave está en la tabla? (Object.hasOwn) 400 "No se pueden enviar estos campos: color"
 ├─ ¿alMenosUno y vino vacío? ................... 400 "Debe indicarse al menos un campo para actualizar"
 ├─ ¿cada valor cumple su tipo? (cumpleTipo) .... 400 "La marca debe ser un texto"
 ▼
un objeto NUEVO, solo con los campos de la tabla
```

A los tres tipos de `typeof` les suma dos que aparecen en un JSON
(`validacionCampos.ts:27`):

```ts
type TipoSegunCampo = TipoSegunNombre & {
  objeto: object;          // un {...}: un tramo          → esObjetoJson
  lista: unknown[];        // un [...]: los tramos de un día → Array.isArray
};
```

Dos detalles de la implementación que vale la pena mirar:

- **`Object.hasOwn(campos, campo)` y no `campo in campos`.** `in` también
  encuentra las propiedades **heredadas** de todos los objetos, así que un
  body `{ "toString": 1 }` pasaría el filtro.
- **Devuelve un objeto nuevo**, armado campo por campo. Por eso un `_id`, un
  `createdAt` o un `$set` nunca llegan al service.

`exigido(valor, mensaje)` (`:132`) completa el helper: los DTO lo usan para los
campos obligatorios. Cómo se usan los dos dentro de un DTO se explica en
[`06b-dtos.md`](06b-dtos.md), y cómo funcionan sus tipos genéricos, en
[`02-typescript-en-el-proyecto.md`](02-typescript-en-el-proyecto.md#6-genéricos-tipos-con-parámetro).

### 4. `password.ts`: hashear antes de guardar

```
datos { email, password: "claveSegura123", nomApe }
   │ conPasswordHasheada(datos)
   ├─ ¿no trae password? ............ devuelve los datos sin tocarlos
   ├─ ¿password no es un texto? ..... ErrorDeNegocio 400 "La contraseña debe ser un texto"
   ├─ ¿menos de 8 caracteres? ....... ErrorDeNegocio 400
   ├─ bcrypt.hash(password, 10)
   ▼
{ ...datos, password: "$2b$10$..." }     ← un objeto NUEVO, no modifica el original
```

`src/utils/password.ts:27`:

```ts
export async function conPasswordHasheada<Datos extends DatosConPasswordOpcional>(
  datos: Datos,
): Promise<Datos> {
```

Es **genérica** (`<Datos>`): recibe datos de alumno y devuelve datos de
alumno, o recibe un `Partial<Administrador>` y devuelve lo mismo. Por eso
sirve tanto para **crear** (el password viene siempre) como para **editar**
(el password puede no venir). Si no viene, la función no hace nada.

Devuelve un objeto **nuevo** (`{ ...datos, password }`) en lugar de modificar
el que recibió. Así quien la llama nunca se encuentra con su objeto
modificado.

Para el login no se usa esta función: `auth.service` compara con
`bcrypt.compare(password, usuario.password)`. Cómo funciona bcrypt se explica
en [`01-stack-y-dependencias.md`](01-stack-y-dependencias.md#8-bcrypt-contraseñas-que-no-se-pueden-leer).

### 5. `fechas.ts`: el instante y la hora de la escuela

#### 5.1 El problema: `Date` es un instante, no una hora de reloj

Un `Date` de JavaScript representa **un instante absoluto**, el mismo en todo
el mundo. "Las 9 de la mañana" depende de **dónde** estás. Hay dos trampas
clásicas, y las probé con el mismo código en dos zonas horarias:

| Código | Servidor en `UTC` | Servidor en `Buenos_Aires` |
|---|---|---|
| `new Date('2026-09-20T09:00:00')` (sin zona) | `09:00Z` | `12:00Z` ← **otro instante** |
| `new Date('2026-09-20T12:00:00Z').getHours()` | `12` | `9` |
| `new Date('2026-09-21T01:30:00Z').getDay()` | `1` (lunes) | `0` (domingo) |

El mismo código da resultados distintos según **la máquina donde corre**. Un
servidor desplegado suele estar en UTC, y la escuela está en Argentina. Por
eso `fechas.ts` sigue cuatro reglas (están en su cabecera):

```
1. ENTRADA   solo se acepta ISO 8601 CON zona ("...Z" o "...-03:00")   → parsearInstante
2. GUARDADO  Date tal cual (MongoDB lo guarda en UTC)
3. CÁLCULOS  día y hora "locales" siempre con la zona de la escuela    → aHoraLocal
             nunca con getDay() / getHours()
4. SALIDA    res.json lo serializa en ISO UTC; el frontend lo muestra en su zona
```

#### 5.2 `parsearInstante`: aceptar solo fechas sin ambigüedad

`src/utils/fechas.ts:37` recibe lo que mandó el cliente (`unknown`) y devuelve
un `Date`, o lanza un error 400. Usa una regex
(`fechas.ts:21`):

```
^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$
 └ año ┘ └mes┘ └día ┘ T └ hora 00–23 ┘:└min┘ └ segundos opcionales ┘ └ zona OBLIGATORIA ┘
```

Pero la regex no alcanza. `2026-02-31` cumple el formato y JavaScript **no
lo rechaza**: lo "corre" al mes siguiente.

```js
new Date('2026-02-31T09:00Z').toISOString()   // → "2026-03-03T09:00:00.000Z"  😬
```

Por eso, además, `esDiaDeCalendario` (`fechas.ts:25`) comprueba que el día
exista de verdad: arma la fecha y verifica que el mes y el día no hayan
cambiado.

| Entrada | Resultado |
|---|---|
| `"2026-09-20T09:00:00-03:00"` | ✓ |
| `"2026-09-20T12:00:00Z"` | ✓ (es el mismo instante que el anterior) |
| un objeto `Date` | ✓ se devuelve tal cual |
| `undefined` | Se devuelve `undefined`, para que decida quien llama |
| `"2026-09-20T09:00:00"` (sin zona) | ✗ 400 |
| `"2026-09-20"` (solo fecha) | ✗ 400 |
| `"2026-02-31T09:00:00Z"` | ✗ 400 (ese día no existe) |
| `"2026-09-20T25:00:00Z"` | ✗ 400 |
| `1758369600000` (un número) | ✗ 400 |

Todos estos casos están en `tests/utils/fechas.test.ts`.

#### 5.3 `aHoraLocal`: ¿qué día y qué hora es en la escuela?

`fechas.ts:89` convierte un instante en `{ dia, hora, minuto }` **tal como lo
vería un reloj en la escuela**, sin depender de la zona del servidor. Usa
`Intl.DateTimeFormat`, que viene incluido en JavaScript:

```ts
const formatoLocal = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA_HORARIA,      // 'America/Argentina/Buenos_Aires' por defecto
  weekday: 'long',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
```

`formatToParts` devuelve las partes por separado. Para `2026-11-02T13:00:00Z`:

```
weekday="Monday"  literal=" "  hour="10"  literal=":"  minute="00"
      │                              │                       │
      ▼ DIA_POR_NOMBRE_EN            ▼ Number()              ▼ Number()
{ dia: 'lunes',                  hora: 10,               minuto: 0 }
```

Cada opción tiene su motivo:

- **`'en-US'` y no `'es-AR'`**: en español, los días llevan tildes
  ("miércoles", "sábado") y su forma exacta depende de la implementación. En
  inglés son estables y sin tildes, y un mapa fijo los traduce a los valores
  del tipo `Dia` (`'miercoles'`, `'sabado'`).
- **`hourCycle: 'h23'`**: garantiza que medianoche sea `00` y no `24`, porque
  algunas implementaciones devuelven `24` con otras opciones. Hay un test para
  eso: "medianoche local es hora 0, no 24".
- **`timeZone: ZONA_HORARIA`**: es un **nombre** IANA y no un offset fijo como
  `-03:00`. Si Argentina vuelve a usar horario de verano, el nombre ya lo
  contempla.
- El formateador se crea **una sola vez**, cuando se carga el módulo, y no en
  cada llamada, porque crearlo es relativamente caro.

#### 5.4 Cómo se combinan en una reserva

```
body.inicio "2026-11-02T10:00:00-03:00"
   │ parsearInstante                          ← en el DTO (clase.dto.ts)
   ▼
Date 2026-11-02T13:00:00Z  ──────────────► se guarda en Clase.inicio (UTC)
   │ aHoraLocal                               ← en el service (validarHorarioClase)
   ▼
{ dia: 'lunes', hora: 10, minuto: 0 } ───► se compara con los tramos del horario
                                           (aMinutos → 600)
```

El recorrido completo está en
[`../temas/horarios-y-agendamiento.md`](../temas/horarios-y-agendamiento.md#parte-3-del-instante-a-la-hora-local).

#### 5.5 Por qué los tests corren en UTC

`vitest.config.ts` fija `env: { TZ: 'UTC' }`. Si alguien usara `getHours()`
en lugar de `aHoraLocal`, en una máquina en Argentina el test podría **pasar
por casualidad**, porque la zona coincide. En UTC falla en **todas** las
máquinas. Así se simula el servidor real y el error no llega a producción.

---

## Qué puede salir mal

| Síntoma | Causa |
|---|---|
| Las clases quedan 3 horas corridas | Se aceptó una fecha **sin zona**, o se usó `getHours()` en lugar de `aHoraLocal`. |
| Una clase del domingo a la noche figura como lunes | Se usó `getDay()`: en UTC ya es el día siguiente. |
| Se acepta una fecha como "31 de febrero" | Se usó `new Date(texto)` sin `parsearInstante`. |
| `dia` es `undefined` | Se cambió el locale de `formatoLocal` y los nombres ya no coinciden con `DIA_POR_NOMBRE_EN`. |
| La contraseña se guarda en texto plano | El service no pasó los datos por `conPasswordHasheada`. |
| Un mensaje de error dice "debe ser undefined" | Se usó un `tipo` que no está en `DESCRIPCION_TIPO`. `satisfies` lo impide al compilar, siempre que no se use un `as` para saltearlo. |

---

## Resumen

- `esObjetoJson` y `cuerpoComoObjeto` comprueban que el body sea un objeto y
  le dan un tipo seguro.
- `validarCampos` + `exigido` son la base de todos los DTO: rechazan campos de
  más, tipos incorrectos y faltantes, y devuelven un objeto nuevo.
- `esDelTipo` + `DESCRIPCION_TIPO` validan tipos a partir del **texto** de
  `typeof`, porque los tipos de TypeScript no existen al ejecutar.
- `conPasswordHasheada` valida y hashea el password solo si viene, y devuelve
  un objeto nuevo.
- Fechas: **entrada con zona** (`parsearInstante`) → **guardado en UTC** →
  **cálculos en la zona de la escuela** (`aHoraLocal`, nunca
  `getDay`/`getHours`) → **salida en ISO UTC**.

**Siguiente lectura:** [`11-tests-vitest.md`](11-tests-vitest.md).
