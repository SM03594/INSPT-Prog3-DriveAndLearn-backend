# Tests con Vitest

## Qué es esto, en una frase

Los tests de `tests/` son programas que **ejecutan el código del proyecto y
comprueban que haga lo que debe**: que un service rechace una patente
repetida, que una ruta pida token, que una fecha sin zona se rechace. Corren
con **Vitest**, usan una **MongoDB en memoria** y prueban la API por HTTP **sin
levantar un servidor**. Son unos 280 tests (283 al 22/10/2026) y tardan
segundos.

---

## El mapa

```
tests/
├── setupTestDB.ts                     ← prepara la MongoDB en memoria
├── utils/                             FUNCIONES PURAS: sin base y sin HTTP
│   ├── fechas.test.ts
│   ├── password.test.ts
│   ├── validacionCampos.test.ts
│   └── validacionTipos.test.ts
├── dtos/                              DTOs: también funciones puras
│   ├── alumno.dto.test.ts  auto.dto.test.ts  clase.dto.test.ts ...
├── services/                          SERVICES: con base en memoria y sin HTTP
│   ├── alumno.service.test.ts  auto.service.test.ts  clase.service.test.ts ...
├── middlewares/
│   ├── validacionDeCuerpo.test.ts     middleware llamado a mano (sin base y sin HTTP)
│   ├── auth.http.test.ts              HTTP con supertest + base
│   ├── validacionDeCuerpo.http.test.ts
│   └── errorHandler.http.test.ts      HTTP sin base (el pedido no llega a ningún router)
└── clases.http.test.ts               HTTP de punta a punta (supertest + base)
```

Hay cuatro tipos de test, del más simple al más completo:

| Tipo | Qué ejecuta | ¿Base? | ¿HTTP? | Velocidad |
|---|---|---|---|---|
| Función pura | Una función de `utils/` o un DTO | No | No | Instantáneo |
| Middleware a mano | El middleware con un `req` armado a mano | No | No | Instantáneo |
| Service | Una función del service | En memoria | No | Rápido |
| HTTP | `app` completa: rutas → middlewares → controller → service | En memoria | Supertest | Más lento |

---

## Cómo correrlos

| Comando | Qué hace |
|---|---|
| `npm test` | Modo *watch*: corre todo y repite cada vez que guardás un archivo. |
| `npm run test:run` | Corre todo **una vez** y termina (útil en CI). |
| `npx vitest run tests/utils` | Solo una carpeta o un archivo. |
| `npx vitest run -t "patente"` | Solo los tests cuyo nombre contiene "patente". |
| `npx vitest run --coverage` | Además, mide qué líneas del código se ejecutaron (`@vitest/coverage-v8`). |
| `npx vitest --ui` | Interfaz web para explorar y relanzar tests (`@vitest/ui`). |

La configuración está en `vitest.config.ts`:

| Opción | Valor | Por qué |
|---|---|---|
| `environment` | `'node'` | Es un backend: no hay `window` ni DOM. |
| `env` | `{ TZ: 'UTC' }` | Simula un servidor en UTC (ver la sección 6). |
| `include` | `tests/**/*.test.ts` | Dónde buscar tests. |
| `testTimeout`, `hookTimeout` | `10000` | Los tests con base pueden tardar más que los 5 s por defecto. |
| `globals` | `true` | Permite usar `describe`/`it`/`expect` sin importarlos, aunque igual todos los archivos los importan explícitamente. |

---

## El recorrido

### 1. Anatomía de un test

`tests/utils/fechas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { aHoraLocal } from '../../src/utils/fechas.js';

describe('aHoraLocal', () => {                                     // agrupa tests relacionados
  it('usa el día local aunque en UTC ya sea el día siguiente', () => { // UN caso, con nombre descriptivo
    // 01:30 UTC del lunes 21 = 22:30 del domingo 20 en Argentina.
    expect(aHoraLocal(new Date('2026-09-21T01:30:00Z')))             // lo que se obtiene...
      .toEqual({ dia: 'domingo', hora: 22, minuto: 30 });          // ...lo que se espera
  });
});
```

- `describe(nombre, fn)` agrupa los tests en la salida.
- `it(nombre, fn)` es **un** caso. El nombre describe el comportamiento, para
  que al fallar se entienda qué se rompió.
- `expect(valor).matcher(esperado)` es la comprobación. Los *matchers* que más
  usa el proyecto son:

| Matcher | Comprueba | Ejemplo |
|---|---|---|
| `toBe(x)` | Igualdad exacta (`===`) | `expect(alumno.clasesPorReservar).toBe(0)` |
| `toEqual(obj)` | Mismo contenido, aunque sea otro objeto | `toEqual({ dia: 'lunes', hora: 0, minuto: 0 })` |
| `toMatchObject(obj)` | Que **incluya** esos campos (puede tener más) | `toMatchObject({ status: 400 })` |
| `toThrow(X)` | Que una función **síncrona** lance un error | `expect(() => verificarCuerpo(...)).toThrow(ErrorRequestSinCuerpo)` |
| `rejects.toThrow(X)` | Que una **promesa** se rechace | `await expect(crear(...)).rejects.toThrow(ErrorClaveDuplicada)` |
| `toBeUndefined()` | Que no exista | `expect(registro.body.password).toBeUndefined()` |

### 2. Muchos casos con una tabla: `it.each`

Para probar la misma regla con muchas entradas (`fechas.test.ts:33`):

```ts
it.each([
  ['sin zona',        '2026-09-20T09:00:00'],
  ['solo fecha',      '2026-09-20'],
  ['fecha imposible', '2026-02-31T09:00:00Z'],
  ['hora imposible',  '2026-09-20T25:00:00Z'],
])('rechaza %s', (_caso, valor) => {
  expect(() => parsearInstante(valor, 'inicio')).toThrow(ErrorDeNegocio);
});
```

Se genera **un test por fila**, con nombres como "rechaza sin zona" o
"rechaza fecha imposible". Por eso Vitest cuenta unos 280 tests aunque en el
código haya menos `it(`.

### 3. Tests de service con MongoDB en memoria

Un service necesita una base, pero no conviene usar la real: sería lenta,
podría tener datos viejos y los tests la modificarían. `setupTestDB()`
(`tests/setupTestDB.ts`) levanta un **MongoDB temporal** con
`mongodb-memory-server`:

```
archivo de test
 │ setupTestDB()  registra 3 hooks:
 │
 ├─ beforeAll  ── MongoMemoryServer.create() + mongoose.connect()    (una vez por archivo)
 │
 ├─ it(...) ─┐
 ├─ afterEach ├─ deleteMany({}) en TODAS las colecciones   → cada test arranca con la base vacía
 ├─ it(...) ─┘
 │
 └─ afterAll   ── dropDatabase + close + mongo.stop()
```

Con eso, un test de service es simplemente llamar a la función
(`tests/services/auto.service.test.ts`):

```ts
setupTestDB();

it('guarda el auto y le asigna un _id', async () => {
  const auto = await crear(datosValidos);
  expect(auto._id).toBeDefined();
  expect(auto.marca).toBe('Toyota');
});
```

Para comprobar un error en código `async`:

```ts
await expect(crear(datosValidos)).rejects.toThrow(ErrorClaveDuplicada);
//  ↑ el await es OBLIGATORIO: sin él, el test termina antes de comprobar nada
```

Un test de DTO es todavía más simple: no necesita base ni `setupTestDB()`,
porque un DTO es una función pura (`tests/dtos/auto.dto.test.ts`):

```ts
it('rechaza activo, con la pista de dónde se cambia el estado', () => {
  expect(() => aActualizarAutoDto({ activo: false })).toThrow(
    'No se pueden modificar estos campos: activo (el estado se cambia con PATCH /autos/:id/activo)',
  );
});
```

Es `expect(() => ...)`, con una **función** adentro: si se pasara
`aActualizarAutoDto(...)` directamente, el error se lanzaría antes de que
`expect` pudiera atraparlo. Como el DTO es síncrono, no hace falta `await`.

Desde que existen los DTO, los tests de los services prueban **reglas**: que
el saldo inicial sea 0, que la cantidad sea entera, que el horario esté libre.
Los casos de **forma** (un campo de más, un número en lugar de un texto) están
en `tests/dtos/`.

### 4. Tests HTTP con supertest

Supertest le manda pedidos **directamente** a `app`, sin abrir un puerto. Por
eso `app.ts` está separado de `server.ts`. `tests/middlewares/auth.http.test.ts`:

```ts
import request from 'supertest';
import app from '../../src/app.js';

process.env.JWT_SECRET = 'secreto-de-prueba-de-al-menos-32-caracteres';
setupTestDB();

const login = await request(app)
  .post('/api/auth/login')                       // método + URL
  .send({ email: 'ANA@example.com', password: 'claveSegura123' })   // body JSON
  .expect(200);                                  // falla el test si el status es otro

await request(app)
  .get('/api/autos')
  .set('Authorization', `Bearer ${login.body.token}`)   // cabeceras
  .expect(200);
```

Un test HTTP recorre **todas** las capas: router, middlewares, controller,
service, model y `errorHandler`. Comprueba que estén bien **conectadas**, cosa
que un test de service no puede.

¿Por qué se puede asignar `process.env.JWT_SECRET` arriba del archivo, después
de importar `app`? Porque `obtenerJwtSecret()` lee la variable **cada vez que
se la llama**, no al importar `env.ts`. Si fuera una constante, el valor ya
estaría fijado.

`errorHandler.http.test.ts` es un caso especial: **no** llama a
`setupTestDB()`, porque los pedidos con un JSON mal escrito los rechaza
`express.json()` antes de llegar a cualquier router, y nunca tocan la base.

### 5. Un middleware sin Express: `vi.fn()`

`tests/middlewares/validacionDeCuerpo.test.ts` prueba el middleware como una
función común. Le pasa un `req` armado a mano y un `next` **falso**:

```ts
it('llama a next() si el body es un objeto', () => {
  const next = vi.fn();                      // función espía: registra cómo la llamaron
  validacionDeCuerpo(pedido({ a: 1 }, '7') as Request, res, next);
  expect(next).toHaveBeenCalledOnce();
});

it('lanza (y no llama a next) si no hay body', () => {
  const next = vi.fn();
  expect(() => validacionDeCuerpo(pedido(undefined) as Request, res, next))
    .toThrow(ErrorRequestSinCuerpo);
  expect(next).not.toHaveBeenCalled();
});
```

`vi.fn()` crea una función que no hace nada, pero **registra** cada llamada.
Así se puede comprobar si el middleware dejó pasar el pedido o no.

### 6. Fechas en los tests

Hay dos detalles que evitan tests que fallan "de repente":

- **Fechas relativas, no fijas.** Una clase tiene que ser futura, y una fecha
  fija como `2026-11-02` deja de serlo con el tiempo. `clase.service.test.ts`
  calcula siempre el **próximo lunes** desde hoy:
  ```ts
  function proximoLunes(): Date {
    const fecha = new Date();
    fecha.setUTCHours(12, 0, 0, 0);
    do { fecha.setUTCDate(fecha.getUTCDate() + 1); }
    while (aHoraLocal(fecha).dia !== 'lunes');
    return fecha;
  }
  ```
- **Zona UTC.** `vitest.config.ts` fija `TZ: 'UTC'`, como en un servidor
  real. Si alguien usa `getHours()` en lugar de `aHoraLocal`, el test falla en
  **todas** las máquinas, no solo en producción. Más detalles en
  [`10-utils-y-fechas.md`](10-utils-y-fechas.md#55-por-qué-los-tests-corren-en-utc).

### 7. Aislamiento: cada test empieza de cero

- Cada **archivo** tiene su propia MongoDB en memoria, y Vitest corre varios
  archivos **en paralelo** sin que se pisen.
- Cada **test** empieza con las colecciones vacías (`afterEach`). Por eso los
  datos que un test necesita se crean en su `beforeEach` o dentro del propio
  test, nunca en otro test.
- La **primera vez** que se corre en una máquina, `mongodb-memory-server`
  descarga el binario de MongoDB. Por eso `beforeAll` tiene un timeout de 60 s.

---

## ¿Qué test escribo?

| Cambiaste... | Escribí un test de... | Ejemplo |
|---|---|---|
| Una función de `utils/` | Función pura (`tests/utils/`) | Nuevo formato de fecha aceptado |
| Qué campos acepta un endpoint | DTO (`tests/dtos/`) | "Al editar un auto no se puede mandar `activo`" → lanza el error |
| Una regla de un service | Service (`tests/services/`) | "No se puede reservar con menos de 24 h" |
| Una ruta, un permiso o un middleware | HTTP (`*.http.test.ts`) | "Un alumno no puede ver a otro" → 403 |
| Un mensaje o status de error | HTTP, o el test del middleware | JSON mal escrito → 400 |

---

## Qué puede salir mal

| Síntoma | Causa |
|---|---|
| Un test con `rejects` pasa aunque el código esté mal | Falta el `await` delante de `expect(...).rejects`. |
| `JWT_SECRET debe estar configurado...` | El archivo HTTP no asigna `process.env.JWT_SECRET` antes del primer login. |
| Timeout en `beforeAll` la primera vez | Se está descargando el binario de MongoDB. Esperá, o revisá la red. |
| Un test pasa solo y falla con todos | Depende de datos que creó **otro** test. Cada test tiene que crear lo suyo. |
| Tests de clases que antes pasaban, ahora fallan | Usan una fecha fija que ya quedó en el pasado. |

---

## Resumen

- 4 tipos de test: **funciones puras**, **middleware a mano**, **services**
  (con base en memoria) y **HTTP** (supertest + base en memoria).
- `setupTestDB()`: una MongoDB por archivo, vacía antes de cada test.
- Supertest prueba `app` completa sin abrir un puerto.
- `it.each` para tablas de casos, `vi.fn()` para espiar `next`, y
  `await expect(...).rejects` para errores async.
- Fechas relativas y `TZ=UTC` para que los tests no dependan del día ni de la
  máquina.

**Siguiente lectura:** [`12-tests-postman.md`](12-tests-postman.md).
