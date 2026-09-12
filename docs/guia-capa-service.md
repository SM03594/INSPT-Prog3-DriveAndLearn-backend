# Guía: cómo funcionan los archivos de `src/services/`

Esta guía explica **qué hace la capa service de este proyecto**, pieza por pieza.
Está pensada para alguien que está aprendiendo **TypeScript** y **desarrollo de
APIs REST** al mismo tiempo.

Es la compañera de [guia-models-mongoose.md](guia-models-mongoose.md): esa explica
la capa de modelos (`src/models/`), esta explica la que la usa.

**Todos los ejemplos de acá son código real de `src/services/`**, no inventado.

---

## 1. Qué es la capa service en este proyecto

La capa service son los archivos de **`src/services/`**. Su trabajo es:

- **la lógica de negocio** (las reglas: "no se pueden restar clases negativas",
  "el día tiene que ser uno de la semana", "la contraseña se guarda hasheada"...),
- **y TODO el acceso a MongoDB.** Es la **única** capa que importa y usa un modelo
  de Mongoose (`AutoModel`, `AlumnoModel`, ...).

Lo que **no** hace: no conoce HTTP. Nunca toca `req` ni `res`, nunca elige un
código de estado (200, 404, ...). De eso se encarga el **controller**, que lee el
request y arma la response llamando al service.

```
request  ─▶  src/routes/  ─▶  src/controllers/  ─▶  src/services/  ─▶  src/models/  ─▶  MongoDB
                              (lee req, arma       (lógica +          (Mongoose)
                               la response)         consultas)
```

> El comentario que encabeza `administrador.service.ts` lo resume:
> *"acá vive la lógica de negocio y TODO el acceso a datos. No sabe nada de
> req/res/HTTP. Devuelve null cuando algo 'no se encontró'."*

### Los 5 archivos

| Archivo | Recurso | Funciones que exporta |
|---|---|---|
| `auto.service.ts` | Autos | `listar`, `obtenerPorId`, `crear`, `actualizar`, `cambiarEstado` |
| `alumno.service.ts` | Alumnos | `listar`, `obtenerPorId`, `crear`, `actualizar`, `sumarClasesPorReservar`, `restarClasesPorReservar` |
| `administrador.service.ts` | Administradores | `listar`, `obtenerPorId`, `crear`, `actualizar` |
| `profesor.service.ts` | Profesores | `listar`, `obtenerPorId`, `cambiarNomApe`, `cambiarFotoPerfil`, `agregarDisponibilidad`, `quitarDisponibilidad` |
| `calendarioSemanal.service.ts` | *(auxiliar, sin colección propia)* | `validarDia`, `agregarTramo`, `quitarTramo` |

Los cuatro primeros son "un service por recurso", con el mismo esqueleto. El
quinto es distinto (§10).

---

## 2. La forma de un archivo service: funciones exportadas, no una clase

`auto.service.ts` entero (sin los cuerpos) muestra el patrón:

```ts
import { AutoModel, type AutoDoc, type Auto } from '../models/Auto.js';

export async function listar(): Promise<AutoDoc[]> { /* ... */ }
export async function obtenerPorId(id: string): Promise<AutoDoc | null> { /* ... */ }
export async function crear(datos: Auto): Promise<AutoDoc> { /* ... */ }
export async function actualizar(id: string, cambios: Partial<Auto>): Promise<AutoDoc | null> { /* ... */ }
export async function cambiarEstado(id: string, estadoNuevo: boolean): Promise<AutoDoc | null> { /* ... */ }
```

- **Funciones sueltas con `export`**, no una clase ni `export default`. No hay
  estado que guardar entre llamadas, así que una clase solo agregaría ceremonia.
- El **import** trae:
  - `AutoModel` → **valor**: el modelo de Mongoose con el que se consulta.
  - `type AutoDoc`, `type Auto` → **tipos** que definió el modelo (ver la otra
    guía). `Auto` es la forma de los datos; `AutoDoc` es el documento "vivo".
  - La ruta lleva `.js` aunque el archivo sea `.ts` (regla de ESM, explicada en la
    guía de modelos).

El controller lo usa así:

```ts
// ── código del CONTROLLER (va acá para ver cómo se consume el service) ──
import * as autoService from '../services/auto.service.js';

const autos = await autoService.listar();
```

---

## 3. `async` / `await` / `Promise` — por qué todo es asíncrono

`AutoModel.find()`, `.findById()`, `.create()` hablan con MongoDB (el dato viaja
por la red). Esas operaciones no devuelven el resultado al toque: devuelven una
**`Promise`** ("te prometo un valor más adelante"). Por eso:

- **toda función del service es `async`**, y
- su tipo de retorno es **`Promise<algo>`**.

`listar`, real:

```ts
export async function listar(): Promise<AutoDoc[]> {
  return AutoModel.find();
}
```

- `AutoModel.find()` ya devuelve algo "esperable". Al hacerle `return` dentro de
  una función `async`, la promesa se **encadena**: quien llame hace su propio
  `await listar()`. No hace falta `return await` (es redundante).
- `Promise<AutoDoc[]>` se lee: *"cuando esta promesa se resuelva, entrega un array
  de `AutoDoc`"*.

`crear` de `alumno.service.ts` tiene un `await` **adentro**, porque hashear con
bcrypt también es asíncrono (§7):

```ts
export async function crear(datos: Alumno): Promise<AlumnoDoc> {
  const datosAGuardar =
    typeof datos.password === 'string'
      ? { ...datos, password: await bcrypt.hash(datos.password, BCRYPT_ROUNDS) }
      : datos;

  return AlumnoModel.create(datosAGuardar);
}
```

---

## 4. El contrato de retorno: `XxxDoc` y `XxxDoc | null`

Todas las funciones del proyecto siguen la misma forma. Tomando `auto.service.ts`:

| Firma | Devuelve | Cuándo `null` |
|---|---|---|
| `listar(): Promise<AutoDoc[]>` | un array (vacío si no hay nada) | nunca |
| `obtenerPorId(id): Promise<AutoDoc \| null>` | el auto | id válido pero inexistente |
| `crear(datos): Promise<AutoDoc>` | el auto recién creado (con `_id`) | nunca (o **lanza** un error) |
| `actualizar(id, cambios): Promise<AutoDoc \| null>` | el auto ya actualizado | id inexistente |
| `cambiarEstado(id, estado): Promise<AutoDoc \| null>` | el auto con el estado nuevo | id inexistente |

**`AutoDoc`** es un documento **hidratado** de Mongoose: tiene `_id`, `.save()`, y
cuando el controller hace `res.json(auto)` dispara el `toJSON` del modelo que
limpia `__v` (y `password` en los que la tienen). El service devuelve el
documento "vivo", no un objeto plano.

**`| null`** es una **unión de tipos**: el valor es `AutoDoc` **o** `null`. `null`
significa **"no lo encontré"** y es un resultado **normal** (el controller lo
traduce a 404). TypeScript **obliga** a chequear el `null` antes de usar el doc.
Se ve textual en `profesor.service.ts`:

```ts
const profesor = await ProfesorModel.findById(id);
if (profesor === null) return null;   // ← corta acá si no está

profesor.fotoPerfil = foto;
return profesor.save();
```

---

## 5. Dónde se toca la base: los métodos de Mongoose que usa el proyecto

Los services usan exactamente estos:

| Método de Mongoose | Dónde en el proyecto | Devuelve |
|---|---|---|
| `Model.find()` | el `listar()` de todos los services | `Promise<Doc[]>` |
| `Model.findById(id)` | `obtenerPorId()`, y dentro de las mutaciones que primero traen el doc | `Promise<Doc \| null>` |
| `Model.create(datos)` | `crear()` de auto / alumno / administrador | `Promise<Doc>` |
| `Model.findByIdAndUpdate(id, cambios, opts)` | `actualizar()`, `cambiarEstado()`, `cambiarNomApe()` | `Promise<Doc \| null>` |
| `doc.save()` | cuando se hizo `findById` y se modificó el doc (§8, §10) | `Promise<Doc>` |

`findById` con un id **mal formado** (que no tiene forma de ObjectId) **no**
devuelve `null`: **lanza `CastError`**. El comentario real en `alumno.service.ts`:

```ts
// Si el id no tiene forma de ObjectId, Mongoose lanza un
// CastError (el controller lo traduce a 400).
export async function obtenerPorId(id: string): Promise<AlumnoDoc | null> {
  return AlumnoModel.findById(id);
}
```

O sea: **id inexistente → `null` (→ 404). id inválido → `CastError` (→ 400).** Son
casos distintos.

---

## 6. `actualizar`: `Partial<T>` + las opciones de `findByIdAndUpdate`

Real, de `auto.service.ts`:

```ts
export async function actualizar(
  id: string,
  cambios: Partial<Auto>,
): Promise<AutoDoc | null> {
  return AutoModel.findByIdAndUpdate(id, cambios, {
    new: true,           // devolver el documento actualizado, no el previo
    runValidators: true, // correr las validaciones del esquema también en el update
  });
}
```

- **`Partial<Auto>`** — utilitario de TypeScript: toma `Auto`
  (`{ marca; modelo; patente; cambios; activo }`) y hace **todos los campos
  opcionales** → `{ marca?; modelo?; patente?; cambios?; activo? }`. Así el
  cliente manda **solo lo que quiere cambiar** y los demás campos no se tocan.
- **`new: true`** — por defecto `findByIdAndUpdate` devuelve el documento **como
  estaba ANTES** del update. Con `new: true` devuelve el **ya actualizado** (que
  es lo que casi siempre querés responder).
- **`runValidators: true`** — por defecto Mongoose **no** corre las validaciones
  del esquema en un update (solo en `.save()` / `.create()`). Con esta opción, un
  `cambios` inválido (ej. `{ cambios: 'cohete' }` cuando el enum del modelo solo
  acepta `'automatico'` / `'manual'`) lanza `ValidationError`.

`cambiarEstado` (auto) y `cambiarNomApe` (profesor) son el mismo patrón, pero con
un campo fijo en vez de un `Partial`:

```ts
// auto.service.ts
export async function cambiarEstado(id, estadoNuevo): Promise<AutoDoc | null> {
  return AutoModel.findByIdAndUpdate(
    id,
    { activo: estadoNuevo },
    { new: true, runValidators: true },
  );
}
```

---

## 7. `crear` + `bcrypt`: la contraseña nunca se guarda en texto plano

`alumno.service.ts` y `administrador.service.ts` hashean la contraseña **antes** de
guardar:

```ts
import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 10;

export async function crear(datos: Alumno): Promise<AlumnoDoc> {
  const datosAGuardar =
    typeof datos.password === 'string'
      ? { ...datos, password: await bcrypt.hash(datos.password, BCRYPT_ROUNDS) }
      : datos;

  return AlumnoModel.create(datosAGuardar);
}
```

- **`bcrypt.hash(texto, rounds)`** convierte la contraseña en un **hash**
  irreversible. En la base nunca queda el texto original.
- **`BCRYPT_ROUNDS = 10`** — cuánto "cuesta" calcular el hash (más alto = más
  lento y más seguro). 10 es un default razonable.
- **El ternario `typeof datos.password === 'string' ? A : B`:**
  - si vino un `password` string → lo hasheamos (`A`);
  - si **no** vino → dejamos `datos` tal cual (`B`), **para que el validador
    `required` del esquema lo rechace** con un `ValidationError` limpio. (Si
    llamáramos `bcrypt.hash(undefined, 10)` explotaría con un error feo, no un
    `ValidationError`.) El comentario del código lo dice textual.
- **`{ ...datos, password: <hash> }`** (spread) — copia todos los campos en un
  objeto nuevo y **pisa** `password` con el hash.
- Del otro lado, el modelo tiene un `toJSON` que **borra `password`** de las
  respuestas: nunca sale, ni siquiera hasheado (ver la otra guía).

`auto.service.ts` **no** usa bcrypt (un auto no tiene contraseña). Su `crear` es
directo:

```ts
export async function crear(datos: Auto): Promise<AutoDoc> {
  return AutoModel.create(datos);
}
```

---

## 8. `findById` + `.save()`: cuando necesitás el documento en la mano

`findByIdAndUpdate` sirve para updates simples. Pero a veces hay que **traer el
documento, modificarlo y guardarlo**. Estructura siempre igual:

```
findById  →  if (=== null) return null  →  mutar el doc  →  return doc.save()
```

En el proyecto pasa acá:

**a) `alumno.service.ts` — `ajustarClasesPorReservar` (helper interno, sin
`export`):**

```ts
async function ajustarClasesPorReservar(id: string, delta: number): Promise<AlumnoDoc | null> {
  const alumno = await AlumnoModel.findById(id);
  if (alumno === null) return null;

  alumno.clasesPorReservar += delta;   // modificar EN FUNCIÓN del valor actual

  return alumno.save();                 // save() corre el validador min:0 del esquema
}
```

Comentario real: *"Usa findById + save (en vez de `$inc`) para que el validador
`min:0` del esquema corra siempre sobre el valor final: si el saldo quedara
negativo, `save()` lanza `ValidationError`."*

**b) `profesor.service.ts` — `cambiarFotoPerfil`:**

```ts
export async function cambiarFotoPerfil(id: string, foto: Buffer): Promise<ProfesorDoc | null> {
  const profesor = await ProfesorModel.findById(id);
  if (profesor === null) return null;

  profesor.fotoPerfil = foto;
  return profesor.save();
}
```

**c) `profesor.service.ts` — `agregarDisponibilidad` / `quitarDisponibilidad`**
(ver §10).

Usás este patrón cuando necesitás: modificar un campo **según su valor actual**
(`x += delta`), correr validadores/hooks del esquema que solo funcionan con
`.save()`, o tocar subdocumentos.

---

## 9. Reglas de negocio: `throw new Error(...)`

Algunas reglas **no** van en el esquema del modelo porque dependen de los
**argumentos** de la función. Se chequean al principio del service con un `throw`.

Real, de `alumno.service.ts`:

```ts
export async function sumarClasesPorReservar(id: string, cantidad: number): Promise<AlumnoDoc | null> {
  if (cantidad < 0) {
    throw new Error('La cantidad a sumar no puede ser negativa');
  }
  return ajustarClasesPorReservar(id, cantidad);
}

export async function restarClasesPorReservar(id: string, cantidad: number): Promise<AlumnoDoc | null> {
  if (cantidad < 0) {
    throw new Error('La cantidad a restar no puede ser negativa');
  }
  return ajustarClasesPorReservar(id, -cantidad);
}
```

- El service **lanza** el error, **no lo atrapa**. El controller lo agarra con
  `try/catch` y responde 400. (Por eso los services casi nunca tienen `try/catch`.)
- El mensaje va a llegar al cliente: que se entienda.
- `restar` reusa el mismo helper que `sumar` pasando `-cantidad`: la lógica de
  tocar la base está en un solo lugar.

**Dos formas de "salió mal", según el proyecto:**

| Situación | El service... | El controller responde |
|---|---|---|
| id inexistente | devuelve `null` | 404 |
| campo obligatorio faltante / valor fuera de rango | deja que Mongoose lance `ValidationError` | 400 |
| id mal formado | deja que Mongoose lance `CastError` | 400 |
| valor `unique` repetido (email, patente) | deja pasar el error `{ code: 11000 }` de MongoDB | 409 |
| regla de negocio rota (cantidad negativa, día inválido) | hace `throw new Error(...)` | 400 |

---

## 10. Un service que se apoya en otro: `profesor.service` + `calendarioSemanal.service`

`calendarioSemanal.service.ts` es distinto a los demás: **no tiene colección
propia ni toca la base.** Son **funciones puras** que operan sobre un objeto
`CalendarioSemanal` (`{ lunes: [tramo], martes: [...], ..., domingo: [...] }`, ver
la otra guía).

```ts
// calendarioSemanal.service.ts (completo)
import { DIAS, type CalendarioSemanal, type Dia, type Tramo } from '../models/CalendarioSemanal.js';

export function validarDia(dia: string): void {
  if (!(DIAS as readonly string[]).includes(dia)) {
    throw new Error(`Día inválido: "${dia}". Debe ser uno de: ${DIAS.join(', ')}.`);
  }
}

export function agregarTramo(calendario: CalendarioSemanal, dia: Dia, tramo: Tramo): void {
  validarDia(dia);
  calendario[dia].push(tramo);
}

export function quitarTramo(calendario: CalendarioSemanal, dia: Dia, tramoId: string): boolean {
  validarDia(dia);
  const tramos = calendario[dia];
  const indice = tramos.findIndex((t) => t._id?.toString() === tramoId);
  if (indice === -1) return false;
  tramos.splice(indice, 1);
  return true;
}
```

- No son `async` (no hay nada asíncrono: solo tocan un objeto en memoria).
- `agregarTramo` **muta** el `calendario` que recibe y no devuelve nada.
- `quitarTramo` devuelve un `boolean`: `true` si encontró y quitó el tramo,
  `false` si ese día no tenía un tramo con ese `_id`.

`profesor.service.ts` **usa** esas funciones en vez de manipular la agenda a mano:

```ts
import { agregarTramo, quitarTramo } from './calendarioSemanal.service.js';

export async function agregarDisponibilidad(id, dia, tramo): Promise<ProfesorDoc | null> {
  const profesor = await ProfesorModel.findById(id);
  if (profesor === null) return null;

  agregarTramo(profesor.disponibilidad, dia, tramo);   // ← le delega el "cómo"
  return profesor.save();
}

export async function quitarDisponibilidad(id, dia, tramoId): Promise<ProfesorDoc | null> {
  const profesor = await ProfesorModel.findById(id);
  if (profesor === null) return null;

  const quitado = quitarTramo(profesor.disponibilidad, dia, tramoId);
  if (!quitado) return null;   // ese día no tenía un tramo con ese _id → 404

  return profesor.save();
}
```

- `profesor.service` **le dice** a `calendarioSemanal.service` que agregue/quite un
  tramo. No le saca los datos para operarlos él (*tell, don't ask*). El "cómo"
  (validar el día, buscar por `_id`, `splice`) vive en un solo lugar.
- El `boolean` de `quitarTramo` es lo que `profesor.service` usa para decidir
  entre `null` y `save()`.
- Cuando exista el service del horario de la escuela, va a reusar
  `agregarTramo` / `quitarTramo` igual.

---

## 11. Probar un service

Los tests están en `tests/services/`. Hay dos estilos, según si el service toca la
base.

**a) Services con base (auto, alumno, administrador, profesor)** — se levanta un
MongoDB en memoria. De `auto.service.test.ts`:

```ts
import { setupTestDB } from '../setupTestDB.js';
import { crear, obtenerPorId } from '../../src/services/auto.service.js';

setupTestDB(); // conecta Mongoose a un Mongo en memoria, limpia entre tests, apaga al final

it('guarda el auto y le asigna un _id', async () => {
  const auto = await crear({ marca: 'Toyota', modelo: 'Corolla', patente: 'AB123CD', cambios: 'automatico', activo: true });
  expect(auto._id).toBeDefined();
});

it('devuelve null si el id no existe', async () => {
  expect(await obtenerPorId('64b7f0f0f0f0f0f0f0f0f0f0')).toBeNull();
});

it('tira ValidationError si falta la patente', async () => {
  await expect(crear({ /* sin patente */ } as Auto)).rejects.toThrow(/patente/);
});

it('tira error de clave duplicada (11000) si la patente ya existe', async () => {
  await crear(datos);
  await expect(crear(datos)).rejects.toMatchObject({ code: 11000 });
});
```

- **`setupTestDB()`** (en `tests/setupTestDB.ts`) registra los hooks
  `beforeAll` / `afterEach` / `afterAll` usando `mongodb-memory-server`. La
  primera corrida descarga el binario de Mongo (por eso el timeout de 60s).
- Se importa **la función del service** y se la llama directo. Los tests del
  service no usan HTTP.

**b) `calendarioSemanal.service` (funciones puras)** — sin base, corre al
instante. De `calendarioSemanal.service.test.ts`:

```ts
import { agregarTramo } from '../../src/services/calendarioSemanal.service.js';
import { crearCalendarioSemanal } from '../../src/models/CalendarioSemanal.js';

it('agrega el tramo al día indicado', () => {
  const cal = crearCalendarioSemanal();            // { lunes: [], ..., domingo: [] }
  agregarTramo(cal, 'lunes', tramo);
  expect(cal.lunes).toHaveLength(1);
});
```

Matchers que aparecen en los tests: `.toBeDefined()`, `.toBeNull()`,
`.toHaveLength(n)`, `await expect(promesa).rejects.toThrow(/regex/)`,
`.rejects.toMatchObject({ code: 11000 })`.

---

## 12. `auto.service.ts` completo, comentado

Es el service más simple del proyecto (un auto no tiene contraseña ni
subdocumentos). Sirve de plantilla mental para los demás.

```ts
// ============================================================
//  auto.service.ts — Capa de servicio de Autos
// ============================================================

import { AutoModel, type AutoDoc, type Auto } from '../models/Auto.js';
//         ↑ valor        ↑ tipos (del modelo, ver la otra guía)

// --- Lectura ------------------------------------------------

// Todos los autos. Siempre un array (vacío si no hay ninguno).
export async function listar(): Promise<AutoDoc[]> {
  return AutoModel.find();
}

// Un auto por id. null si no existe; CastError si el id es inválido.
export async function obtenerPorId(id: string): Promise<AutoDoc | null> {
  return AutoModel.findById(id);
}

// --- Escritura --------------------------------------------

// Alta. El controller ya se aseguró de que "datos" traiga solo
// los campos permitidos. Si falta uno obligatorio, .create()
// lanza ValidationError; si la patente ya existe, MongoDB tira
// el error 11000.
export async function crear(datos: Auto): Promise<AutoDoc> {
  return AutoModel.create(datos);
}

// Modificación parcial. "cambios" es Partial<Auto>: solo lo que
// se quiere cambiar. new:true -> devolver el doc actualizado.
// runValidators:true -> validar también en el update.
export async function actualizar(
  id: string,
  cambios: Partial<Auto>,
): Promise<AutoDoc | null> {
  return AutoModel.findByIdAndUpdate(id, cambios, {
    new: true,
    runValidators: true,
  });
}

// --- Operación propia del recurso ------------------------

// Poner o sacar el auto de servicio (no se borra, se desactiva).
// Es un actualizar con un solo campo fijo.
export async function cambiarEstado(
  id: string,
  estadoNuevo: boolean,
): Promise<AutoDoc | null> {
  return AutoModel.findByIdAndUpdate(
    id,
    { activo: estadoNuevo },
    { new: true, runValidators: true },
  );
}
```

---

## 13. Flujo mental (un `PUT /api/autos/:id`)

```
 CLIENTE                                                              MongoDB
   │                                                                    ▲
   │  PUT /api/autos/64b7...   { "modelo": "Yaris" }                     │
   ▼                                                                    │
┌────────┐   ┌────────────────────┐   ┌───────────────────────┐   ┌──────┴─────┐
│ routes │──▶│    controller      │──▶│       service         │──▶│   model    │
│        │   │ lee req.params.id  │   │ actualizar(id, cambios)│  │  AutoModel │
│        │   │ arma cambios desde │   │  = AutoModel.find-     │   │            │
│        │   │  req.body          │   │    ByIdAndUpdate(...)  │   │            │
│        │   │ try/catch          │   │                       │   │            │
└────────┘   └────────────────────┘   └───────────────────────┘   └────────────┘
   ▲                  │                          │
   │  200 + JSON      │  AutoDoc                 │  AutoDoc | null
   │  (o 404 / 400)   │  ó throw (Cast/Valid.)   │  ó throw
   └──────────────────┴──────────────────────────┘
```

- El **service** solo devuelve `AutoDoc` / `null`, o deja propagar un error.
- El **controller** traduce: `null` → 404, `ValidationError`/`CastError` → 400,
  `11000` → 409, otra cosa → 500. Y `AutoDoc` → `res.json(auto)`.

---

## 14. Glosario rápido

| Término | En una frase |
|---|---|
| **Capa service** | Los archivos de `src/services/`: lógica de negocio + todo el acceso a MongoDB. No conoce HTTP. |
| **`async` / `await`** | `async` marca una función que devuelve una `Promise`; `await` espera a que una promesa se resuelva. |
| **`Promise<T>`** | "Un valor de tipo `T` que va a estar listo más adelante". |
| **`XxxDoc`** | El documento que devuelve Mongoose: tiene `_id`, `.save()`, `toJSON`, etc. |
| **`XxxDoc \| null`** | El resultado es el doc **o** `null` ("no encontrado"). TS obliga a chequearlo. |
| **`Partial<T>`** | Utilitario de TS: `T` con todos los campos opcionales. Se usa en `actualizar`. |
| **`Model.find()`** | Trae todos los documentos de la colección. |
| **`Model.findById(id)`** | Trae uno por `_id`. `null` si no está; `CastError` si el id es inválido. |
| **`Model.create(datos)`** | Inserta un documento nuevo. Corre las validaciones del esquema. |
| **`findByIdAndUpdate(id, cambios, opts)`** | Update en una sola consulta. `new: true` = devolver el nuevo; `runValidators: true` = validar en el update. |
| **`doc.save()`** | Guarda un documento que ya se trajo con `findById` y se modificó. Corre validadores y hooks. |
| **`ValidationError`** | Error de Mongoose por no cumplir el esquema (`required`, `enum`, `min`...). → 400 |
| **`CastError`** | Error de Mongoose al no poder convertir un valor (id mal formado). → 400 |
| **`11000`** | Código de error de MongoDB por violar un índice `unique` (email/patente repetido). → 409 |
| **`bcrypt.hash`** | Convierte una contraseña en un hash irreversible antes de guardarla. |
| **`throw new Error(...)`** | Cómo el service corta ante una regla de negocio rota. El controller lo mapea a 400. |
| **Función pura** | Función que solo trabaja con sus argumentos y no toca nada de afuera (`calendarioSemanal.service`). |
| **`mongodb-memory-server` / `setupTestDB()`** | Un MongoDB real, en memoria, para los tests de los services que tocan la base. |

---

## 15. Para seguir leyendo

- Mongoose — Queries: <https://mongoosejs.com/docs/queries.html>
- Mongoose — Validación (`runValidators`): <https://mongoosejs.com/docs/validation.html#update-validators>
- MDN — `async` / `await`: <https://developer.mozilla.org/es/docs/Learn/JavaScript/Asynchronous/Promises>
- TypeScript Handbook — Utility Types (`Partial`, ...): <https://www.typescriptlang.org/docs/handbook/utility-types.html>
- Códigos de estado HTTP: <https://developer.mozilla.org/es/docs/Web/HTTP/Status>
