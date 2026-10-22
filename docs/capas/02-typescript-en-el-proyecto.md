# TypeScript en el proyecto

## Qué es esto, en una frase

TypeScript es **JavaScript con tipos**: escribís casi el mismo código, pero
indicás qué forma tienen los datos, y el compilador te avisa de los errores
**antes** de ejecutar. Esta guía es para alguien que ya sabe JavaScript y está
empezando con TypeScript. Explica cada concepto con código real del proyecto.

---

## El mapa: dónde viven los tipos

```
   escribís .ts                       chequeo                    ejecución
 ┌──────────────┐   tsc / editor   ┌────────────┐   tsc build  ┌──────────────┐
 │ const x: Rol │ ───────────────► │ ¿cuadran   │ ───────────► │ const x = …  │
 │ = 'alumno';  │                  │ los tipos? │   (borra     │  (JS puro,   │
 └──────────────┘                  └────────────┘   los tipos) │   en dist/)  │
                                     │ no                      └──────────────┘
                                     ▼
                              error en el editor
```

La idea más importante de toda la guía es que **los tipos no existen cuando la
app corre**. Un `if (x is Rol)` no existe en tiempo de ejecución: si
necesitás comprobar algo de un dato que llega del cliente, lo tenés que
comprobar con JavaScript común (`typeof`, `includes`, etc.). TypeScript solo
te ayuda a que esa comprobación sea completa. Esto explica gran parte de la
sección 7.

---

## El recorrido

### 1. Anotar tipos: lo mismo que en JS, con etiquetas

Así se ve una función en JavaScript y su versión en TypeScript
(`src/services/auto.service.ts:45`):

```js
// JavaScript
export async function actualizar(id, cambios) { ... }
```

```ts
// TypeScript
export async function actualizar(
  id: string,
  cambios: Partial<Auto>,
): Promise<AutoDoc | null> { ... }
```

- `id: string` es el tipo de un **parámetro**.
- `): Promise<AutoDoc | null>` es el tipo de lo que **devuelve** la función.
  Como es `async`, siempre devuelve una `Promise`. Lo que va entre `< >` es lo
  que obtenés al hacer `await`: un `AutoDoc`, o `null` si el auto no existe.
- `|` se lee "o". `AutoDoc | null` obliga a quien la llama a contemplar el
  `null`. Por eso el controller hace `if (auto === null) return res.status(404)…`.

Las variables casi nunca necesitan anotación: TypeScript **infiere** el tipo a
partir del valor (`const id = usuario._id.toString()` ya es `string`).

### 2. `interface` y `type`: describir la forma de un objeto

Un `interface` describe qué campos tiene un objeto (`src/models/Auto.ts:65`):

```ts
export interface Auto {
  marca: string;
  modelo: string;
  patente: string;
  cambios: string;
  activo: boolean;
}
```

Un `interface` puede **extender** a otro, igual que una clase hereda de otra.
El proyecto lo aprovecha para los usuarios (`src/models/Usuario.ts:71` y
`src/models/Alumno.ts:29`):

```
DatosUsuario { email, password, nomApe }
   ├── extends ─► Usuario  { + rol: Rol }
   └── extends ─► Alumno   { + clasesPorReservar }
                    │
   Usuario + Alumno └─► AlumnoGuardado { rol: 'alumno' }
```

`type` sirve para lo mismo, pero también puede expresar cosas que `interface`
no puede, como uniones:

```ts
export type UsuarioDoc = AlumnoDoc | AdministradorDoc;   // Usuario.ts:83
```

La regla práctica del proyecto: `interface` para la forma de un objeto, y
`type` para uniones, alias y tipos derivados de otros.

### 3. Tipos literales y uniones: valores exactos

Un tipo puede ser un **valor exacto**, y no solo "cualquier string":

```ts
rol: 'alumno' | 'administrador'
```

Con ese tipo, `rol = 'admin'` es un error de compilación. En JavaScript ese
typo pasaría sin aviso y fallaría recién en runtime, o peor, no fallaría nunca.

### 4. Derivar el tipo desde un valor: `as const` + `typeof`

Muchas veces hace falta **la misma lista dos veces**: como array para usarla
en runtime (un `enum` de Mongoose, un `includes`) y como tipo para el
compilador. Para no escribirla dos veces, el proyecto la declara una sola vez y
saca el tipo de ella (`src/types/roles.ts:8`):

```ts
export const ROLES = ['alumno', 'administrador'] as const;
export type Rol = (typeof ROLES)[number];   // 'alumno' | 'administrador'
```

Paso a paso:

| Expresión | Qué es |
|---|---|
| `['alumno', 'administrador']` | Sin `as const`, TS lo ve como `string[]`: se pierden los valores. |
| `... as const` | Lo ve como `readonly ['alumno', 'administrador']`: conserva cada valor exacto. |
| `typeof ROLES` | "El tipo de la variable ROLES" (este `typeof` es del lado de los tipos, no el de JS). |
| `[number]` | "El tipo de cualquier elemento del array", o sea la unión de sus valores. |

El mismo patrón aparece en `DIAS` y `Dia` (`src/models/CalendarioSemanal.ts:21-32`)
y en `CAMBIOS` (`src/models/Auto.ts:8`). Si agregás un valor al array, el tipo
se actualiza solo.

Una variante usa las **claves** de un objeto (`src/services/alumno.service.ts:91-98`):

```ts
const CAMPOS_ACTUALIZABLES = {
  email:    { tipo: 'string', nombre: 'El email' },
  password: { tipo: 'string', nombre: 'La contraseña' },
  nomApe:   { tipo: 'string', nombre: 'El nombre y apellido' },
} as const;

type CampoActualizable = keyof typeof CAMPOS_ACTUALIZABLES;
//   → 'email' | 'password' | 'nomApe'
```

### 5. Tipos utilitarios: transformar un tipo en otro

TypeScript trae "funciones" que reciben un tipo y devuelven otro. El proyecto
usa tres:

| Utilitario | Qué hace | Ejemplo en el proyecto |
|---|---|---|
| `Partial<T>` | Todos los campos pasan a ser opcionales. | `cambios: Partial<Auto>`: un update trae **algunos** campos. |
| `Pick<T, 'a' \| 'b'>` | Se queda solo con esos campos. | `Pick<Clase, 'inicio' \| 'fin'>` en `clase.service.ts:221` |
| `Omit<T, 'a'>` | Saca esos campos. | `DatosClase` en `clase.service.ts:26` |

`&` (intersección) **suma** campos. `DatosClase` combina ambas cosas: toma
`Clase`, le saca los campos que guardan ids de Mongo y los vuelve a agregar
como `string`, que es como llegan del cliente:

```ts
export type DatosClase = Omit<Clase, 'alumno' | 'profesor' | 'auto' | 'estado' | 'inicio' | 'fin'>
  & { alumno?: string; profesor: string; auto: string; inicio: Date | string; fin: Date | string };
```

El `?` en `alumno?` marca un campo **opcional**: puede no estar.

### 6. Genéricos: tipos con parámetro

`Promise<AutoDoc>`, `Partial<Auto>` y `Request<{ id: string }>` son
**genéricos**: tipos que reciben otro tipo como parámetro, de la misma forma
en que una función recibe argumentos. También podés escribir funciones
genéricas propias (`src/utils/password.ts:27`):

```ts
export async function conPasswordHasheada<Datos extends DatosConPasswordOpcional>(
  datos: Datos,
): Promise<Datos> { ... }
```

`Datos` es "el tipo que le pases, siempre que tenga un `password` opcional".
Si le pasás datos de un alumno, te devuelve datos de un alumno, no un objeto
genérico, y así no se pierde información de tipos en el camino.

En los controllers, `Request<{ id: string }>` le indica a Express que
`req.params.id` existe y es un `string`.

### 7. `unknown`, *narrowing* y *type guards*: datos que llegan de afuera

Este es el tema más importante del proyecto. Lo que manda el cliente
(`req.body`) **puede ser cualquier cosa**, y TypeScript no puede saber qué
será. Hay dos tipos para representar "no sé qué es":

| | `any` | `unknown` |
|---|---|---|
| Qué permite | Todo: `x.foo.bar()` compila. | Nada, hasta que compruebes qué es. |
| Riesgo | Apaga el chequeo; los errores aparecen en runtime. | Te obliga a validar primero. |
| En el proyecto | No se usa. | Es el tipo estándar para todo lo que llega del cliente. |

**Narrowing** ("acotar") quiere decir que, después de un `if`, TypeScript
sabe más sobre la variable:

```ts
// src/services/auto.service.ts:64
estadoNuevo: unknown
if (typeof estadoNuevo !== 'boolean') {
  throw new ErrorDeNegocio('activo debe ser un valor booleano');
}
// a partir de acá, estadoNuevo es boolean
```

Cuando la comprobación es más compleja, se arma una función **type guard**, que
devuelve `valor is Tipo` (`src/middlewares/validacionDeCuerpo.middleware.ts:26`):

```ts
function esObjetoJson(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}
```

El cuerpo de la función es JavaScript normal: comprueba de verdad en runtime.
El `valor is ...` es la promesa que le hacés a TypeScript: "si devuelvo
`true`, tratalo como un objeto". Ojo, **TypeScript te cree**: si la
comprobación está mal hecha, el tipo miente.

Así acota el tipo un `req.body` a medida que pasa por las capas:

```
req.body                              unknown
   │ esObjetoJson()   (validacionDeCuerpo)
   ▼
                                      Record<string, unknown>
   │ esCampoActualizable(campo)   (alumno.service.ts:103)
   ▼
campo                                 'email' | 'password' | 'nomApe'
   │ esDelTipo(valor, 'string')   (utils/validacionTipos.ts:39)
   ▼
validados                             Partial<Alumno>   → se puede guardar
```

Otros dos guards que vale la pena leer:

- `esPayloadAutenticado` (`src/middlewares/auth.middleware.ts:69`) confirma
  que el JWT trae `sub` y un `role` válido.
- `validarDia` (`src/services/calendarioSemanal.service.ts:20`) usa una
  variante, `asserts dia is Dia`: en lugar de devolver `true`/`false`, lanza
  un error si la comprobación falla, y después de llamarla `dia` ya es `Dia`.

### 8. `satisfies`: comprobar sin perder precisión

En `src/utils/validacionTipos.ts:30`:

```ts
export const DESCRIPCION_TIPO = {
  string: 'un texto',
  number: 'un número',
  boolean: 'verdadero o falso',
} as const satisfies Record<NombreTipo, string>;
```

- Si lo **anotaras** (`const X: Record<NombreTipo, string> = …`), TS olvidaría
  los valores exactos y solo recordaría "un string".
- Con `satisfies`, TS **comprueba** que haya una descripción por cada
  `NombreTipo`, y si falta una no compila, pero **conserva** el tipo exacto
  del objeto.

### 9. `as` y `!`: cuando le decís a TypeScript "confiá en mí"

```ts
const auth = req.auth!;                          // clase.controller.ts:15
delete (ret as Record<string, unknown>).__v;     // models/Auto.ts:57
```

- `!` significa "esto no es `undefined`". Acá es seguro porque la ruta pasó
  antes por `requireAuthentication`, que es el que carga `req.auth`.
- `as` significa "tratá este valor como si fuera este tipo".

Ninguno de los dos comprueba nada en runtime: si te equivocás, el error
aparece al ejecutar. Por eso el proyecto los usa poco y siempre con un
comentario que explica por qué es seguro. En lo posible, preferí un type guard.

### 10. Ampliar los tipos de una librería: `req.auth`

Express no sabe que este proyecto agrega `req.auth`. Para que TypeScript lo
acepte, `src/types/express.d.ts` **agrega** ese campo a la interfaz `Request`
de Express:

```ts
declare global {
  namespace Express {
    interface Request {
      auth?: { id: string; role: 'alumno' | 'administrador' };
    }
  }
}
export {};
```

Esto funciona porque las interfaces con el mismo nombre se **fusionan**
(*declaration merging*). Un archivo `.d.ts` solo contiene tipos y no genera
JavaScript. El `export {}` del final convierte el archivo en un módulo, que es
un requisito para poder usar `declare global`.

### 11. Clases con tipos y `import type`

En `src/errors/errorDeNegocio.ts:12`:

```ts
export class ErrorDeNegocio extends Error {
  constructor(message: string, public status = 400) { ... }
}
```

Poner `public` delante de un parámetro del constructor lo declara y lo asigna
como propiedad en un solo paso. Es un atajo de TS para `this.status = status`.
Además, como el valor por defecto es `400`, TS infiere que el tipo es `number`.

`import type { Request, Response } from 'express'` importa **solo tipos**. Ese
import se borra por completo al compilar, así que no carga código en runtime.

### 12. El compilador: `tsconfig.json` y `.js` en los imports

- `"strict": true` activa los chequeos que hacen útil a TypeScript. El más
  visible es que obliga a manejar `null` y `undefined`.
- `"module": "nodenext"` hace que los imports relativos lleven la extensión
  `.js` (`import app from './app.js'`), porque Node va a cargar el `.js`
  compilado. Más detalles en
  [`01-stack-y-dependencias.md`](01-stack-y-dependencias.md).

---

## Qué puede salir mal: los errores de `tsc` más comunes

| Mensaje (resumido) | Qué significa | Cómo se arregla |
|---|---|---|
| `'x' is possibly 'undefined'` | Usás algo que puede no estar. | Comprobalo con un `if`, usá `?.` o un valor por defecto con `??`. |
| `Type 'string' is not assignable to type 'Rol'` | Un string cualquiera no es uno de los valores permitidos. | Validá con un type guard (`ROLES.includes(...)`). |
| `Property 'foo' does not exist on type ...` | El tipo no tiene ese campo, o el nombre tiene un typo. | Revisá la interfaz o acotá el tipo primero. |
| `Argument of type 'unknown' is not assignable to ...` | Pasás un dato sin validar. | Acotalo con `typeof` o con un type guard. |
| `Relative import paths need explicit file extensions...` | Falta `.js` en el import. | `'./algo.js'`, aunque el archivo sea `.ts`. |

> Recordá que `npm run dev` (tsx) **no** muestra estos errores. Para verlos
> todos, corré `npm run typecheck`.

---

## Resumen

| Concepto | Para qué sirve | Ejemplo |
|---|---|---|
| Anotación `x: T` | Declarar el tipo de un parámetro o de un retorno | `auto.service.ts:45` |
| `interface` / `extends` | La forma de un objeto, y heredar campos | `models/Usuario.ts:71` |
| Unión `A \| B` | "Una cosa o la otra" | `AutoDoc \| null` |
| `as const` + `typeof X[number]` | Una sola lista, usable como valor y como tipo | `types/roles.ts:8` |
| `Partial` / `Pick` / `Omit` / `&` | Derivar tipos de otros | `services/clase.service.ts:26` |
| Genéricos `<T>` | Tipos con parámetro | `utils/password.ts:27` |
| `unknown` + type guards | Validar datos externos de forma segura | `validacionDeCuerpo.middleware.ts:26` |
| `satisfies` | Comprobar un tipo sin perder los valores exactos | `utils/validacionTipos.ts:30` |
| `!` / `as` | Afirmaciones sin chequeo en runtime (usar poco) | `clase.controller.ts:15` |
| `declare global` | Agregar campos a tipos de librerías | `types/express.d.ts` |

**Siguiente lectura:** [`03-arquitectura.md`](03-arquitectura.md).
