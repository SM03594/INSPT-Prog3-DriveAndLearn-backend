# Guía: cómo funcionan los archivos de `src/models/`

Esta guía explica, pieza por pieza, todo lo que aparece en un archivo de modelo
(`Auto.ts`, `Alumno.ts`, etc.). Está pensada para alguien que está aprendiendo
**MongoDB**, **TypeScript** y **Mongoose** al mismo tiempo, así que arranca desde
lo más básico.

Los ejemplos son genéricos (usamos una entidad imaginaria `Producto`), no copian
un modelo concreto del proyecto.

---

## 1. El panorama: ¿qué es cada tecnología?

| Tecnología | Qué es | Qué aporta al archivo de modelo |
|---|---|---|
| **MongoDB** | Base de datos orientada a documentos. Guarda **documentos** parecidos a objetos JSON, agrupados en **colecciones** (el equivalente a las "tablas"). | Es dónde terminan guardados los datos. MongoDB por sí sola **no valida** casi nada: acepta el documento que le mandes. |
| **Mongoose** | Librería de Node que se pone **entre** tu código y MongoDB (un "ODM": Object-Document Mapper). | Te deja definir un **esquema** (qué campos tiene un documento, de qué tipo, qué reglas), te da **validación**, valores por defecto, hooks, y métodos cómodos (`.save()`, `.find()`, ...). |
| **TypeScript** | JavaScript con **tipos** que se chequean antes de ejecutar. | Nos permite tener un **tipo** `Producto` que describe la forma del documento, para que el editor autocomplete y el compilador avise si usás mal un campo. |

Idea central: **el esquema de Mongoose es el "molde" en tiempo de ejecución, y el
tipo de TypeScript es el mismo molde pero en tiempo de compilación.** Lo *ideal*
sería escribir el esquema una sola vez y que TS *derive* el tipo a partir de él
(con `InferSchemaType`). En este proyecto, por un problema de versiones
(ver [§5](#5-el-tipo-de-los-datos-una-interfaz-a-mano)), escribimos **las dos
cosas**: el esquema y **una interfaz a mano** con los mismos campos, y hay que
mantenerlas sincronizadas.

---

## 2. El `import` de mongoose

```ts
import { Schema, model, HydratedDocument } from 'mongoose';
```

Esto trae tres cosas del paquete `mongoose`:

- **`Schema`** — clase para *construir* un esquema (valor, existe en runtime).
- **`model`** — función para *crear el modelo* a partir de un esquema (valor).
- **`HydratedDocument`** — *tipo* utilitario de TypeScript (no existe en runtime).

> En muchos tutoriales vas a ver un cuarto import, **`InferSchemaType`**, que
> deriva el tipo del esquema automáticamente. En este proyecto **no lo usamos**
> (ver [§5](#5-el-tipo-de-los-datos-una-interfaz-a-mano)): con la combinación de
> versiones actual devuelve `unknown` en todos los campos.

> **Valor vs tipo.** `Schema` y `model` son código que se ejecuta.
> `HydratedDocument` (e `InferSchemaType`) son solo información para el
> compilador: desaparecen cuando TypeScript se transpila a JavaScript. Por eso
> `Schema`/`model` "hacen algo" y `HydratedDocument` solo aparece en anotaciones
> de tipo (`type X = ...`, `: X`).

### Detalle de ESM: la extensión `.js` en los imports

Cuando en el proyecto importás **archivos propios**, la ruta lleva `.js` aunque el
archivo sea `.ts`:

```ts
import { AutoModel } from '../models/Auto.js'; // el archivo real es Auto.ts
```

Es una regla de Node con módulos ESM nativos (`"type": "module"` +
`module: nodenext` en `tsconfig`): hay que escribir la extensión del archivo
**tal como quedará compilado** (`.js`). Los paquetes de `node_modules` como
`mongoose` se importan sin extensión, como siempre.

---

## 3. `new Schema({...}, {...})` — definir la forma del documento

```ts
const productoSchema = new Schema(
  {
    // 1er argumento: los CAMPOS
  },
  {
    // 2do argumento: OPCIONES del esquema
  },
);
```

El **primer argumento** describe cada campo del documento. El **segundo** son
opciones que aplican a todo el esquema (timestamps, transformaciones, etc.).

### 3.1 Definir un campo

La forma corta es `campo: Tipo`:

```ts
const productoSchema = new Schema({
  nombre: String,
  precio: Number,
  enStock: Boolean,
});
```

La forma larga es `campo: { type: Tipo, ...reglas }`, y es la que usamos casi
siempre porque permite agregar validaciones y opciones:

```ts
const productoSchema = new Schema({
  nombre: {
    type: String,
    required: true,
    trim: true,
  },
  precio: {
    type: Number,
    min: 0,
  },
});
```

Tipos más comunes: `String`, `Number`, `Boolean`, `Date`, `Schema.Types.ObjectId`
(para referenciar a otro documento), y arrays con `[...]` (ej. `[String]`).

### 3.2 Reglas / opciones de campo que se usan en el proyecto

| Opción | Sirve para | Ejemplo |
|---|---|---|
| `type` | Indicar el tipo del valor. | `type: String` |
| `required` | Hacerlo obligatorio. Si le pasás `[true, 'mensaje']`, ese texto es el error de validación. | `required: [true, 'El email es obligatorio']` |
| `default` | Valor que se usa si no viene ninguno al crear. Puede ser un valor o una función. | `default: true` · `default: 0` · `default: Date.now` |
| `unique` | Pide a MongoDB crear un **índice único**: no puede haber dos documentos con el mismo valor. **Ojo:** no es una validación de Mongoose, es un índice; si se viola, MongoDB tira el error `11000`. | `unique: true` |
| `enum` | Restringe un `String` (o `Number`) a una lista de valores permitidos. | ver más abajo |
| `trim` | Recorta espacios al principio y al final del string antes de guardar. | `trim: true` |
| `lowercase` / `uppercase` | Convierte el string a minúsculas / mayúsculas antes de guardar. Útil para normalizar (emails en minúscula, patentes en mayúscula). | `lowercase: true` |
| `min` / `max` | Rango permitido para números (y fechas). Acepta `[valor, 'mensaje']`. | `min: [0, 'No puede ser negativo']` |
| `minlength` / `maxlength` | Largo permitido para strings. | `maxlength: 100` |

`trim`, `lowercase` y `uppercase` son **setters**: transforman el valor. `required`,
`enum`, `min`, etc. son **validadores**: aceptan o rechazan el valor.

### 3.3 `enum` y el patrón `as const`

Para un campo que solo puede tomar ciertos valores conviene declarar la lista una
sola vez y reutilizarla:

```ts
export const CATEGORIAS = ['bebida', 'comida', 'limpieza'] as const;

const productoSchema = new Schema({
  categoria: {
    type: String,
    required: true,
    enum: {
      values: [...CATEGORIAS],
      message: 'categoria inválida (recibido: "{VALUE}")',
    },
  },
});
```

- **`as const`** le dice a TypeScript: "esta tupla es de solo lectura y sus
  valores son literales exactos". Sin `as const`, el tipo sería `string[]`; con
  `as const`, es `readonly ['bebida', 'comida', 'limpieza']`.
- **`[...CATEGORIAS]`** hace una copia mutable del array, porque `enum.values`
  espera un array normal (no uno `readonly`).
- **`{VALUE}`** en el mensaje lo reemplaza Mongoose por el valor que falló.
- La forma corta `enum: [...CATEGORIAS]` también funciona si no te importa
  personalizar el mensaje.
- En la **interfaz a mano** podés reusar esa lista para no repetir los literales:
  `categoria: (typeof CATEGORIAS)[number]` (equivale a
  `'bebida' | 'comida' | 'limpieza'`).

### 3.4 Opciones del esquema (segundo argumento)

```ts
new Schema(
  { /* campos */ },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret) => { /* ... */ return ret; } },
  },
);
```

- **`timestamps: true`** — Mongoose agrega y mantiene solo dos campos:
  `createdAt` (cuándo se creó) y `updatedAt` (cuándo se modificó por última vez).
  No tenés que tocarlos nunca.

- **`toJSON.transform`** — una función que se ejecuta cada vez que el documento
  se convierte a JSON (por ejemplo cuando hacés `res.json(producto)` en Express,
  que internamente llama a `.toJSON()`). Recibe:
  - `_doc`: el documento original (el guion bajo es una convención para "no lo
    uso").
  - `ret`: el objeto plano que se va a devolver; **lo modificás y lo retornás**.

  Se usa para **no exponer** ciertos campos en la respuesta de la API:

  ```ts
  toJSON: {
    transform: (_doc, ret) => {
      delete (ret as Record<string, unknown>).__v;       // metadato interno
      delete (ret as Record<string, unknown>).password;  // nunca sale el hash
      return ret;
    },
  }
  ```

  El `as Record<string, unknown>` es un **type assertion**: el tipo de `ret` no
  incluye `__v`/`password` de forma directa, así que le decimos a TypeScript
  "tratá esto como un objeto con claves string" para poder hacer `delete` sin que
  se queje. No cambia nada en runtime.

  > **`__v`** es el *version key* que agrega Mongoose a cada documento
  > (`versionKey`). Lo usa internamente para detectar conflictos al actualizar
  > arrays. No aporta nada a quien consume la API, por eso lo sacamos.

---

## 4. `model('Producto', productoSchema)` — crear el modelo

```ts
export const ProductoModel = model<Producto>('Producto', productoSchema);
```

El **modelo** es el objeto con el que realmente interactuás con la base:

```ts
await ProductoModel.create({ nombre: 'Agua', precio: 500 });
await ProductoModel.find({ enStock: true });
await ProductoModel.findById(id);
await ProductoModel.findByIdAndUpdate(id, { precio: 600 }, { new: true });
```

Sobre los argumentos y el genérico:

- **`'Producto'`** — el nombre del modelo. Mongoose lo **pluraliza y pasa a
  minúsculas** para decidir el nombre de la colección en MongoDB:
  `'Producto'` → colección `productos`, `'Auto'` → `autos`, `'Alumno'` →
  `alumnos`. (Si el plural automático no te sirve, se puede forzar el nombre de
  la colección con una opción del esquema, pero en este proyecto no hace falta.)
- **`<Producto>`** — la interfaz con la forma de los datos (ver sección
  siguiente). Hace que `ProductoModel.create(...)`, los resultados de `.find()`,
  etc. estén tipados.
- `model()` **crea o recupera** el modelo: si ya se registró uno con ese nombre,
  te devuelve el existente. Por eso no pasa nada si el archivo se importa varias
  veces.

Convención del proyecto: exportamos el modelo como `XxxModel` (`AutoModel`,
`AlumnoModel`), la interfaz de datos con **el nombre de la entidad** (`Auto`,
`Alumno`, `Administrador`) y el tipo del documento hidratado como `XxxDoc`
(`AutoDoc`, `AlumnoDoc`).

---

## 5. El tipo de los datos: una interfaz a mano

```ts
export interface Producto {
  nombre: string;
  precio: number;
  categoria: string;
  enStock: boolean;
}
```

Esta interfaz describe la **forma de los datos** de un producto: qué campos tiene
y de qué tipo. Es un **objeto plano** (los datos), no un documento de Mongoose con
métodos. La usamos en dos lugares del modelo:

- como genérico de `model<Producto>(...)`, para que `create`, `find`,
  etc. estén tipados;
- como base de `ProductoDoc` (sección siguiente).

### Cómo traducir el esquema a la interfaz, campo por campo

| En el esquema | En la interfaz |
|---|---|
| `required: true` (o con `default`) | `campo: T` |
| sin `required` ni `default` | `campo?: T` |
| `enum` (`['a', 'b']`) | `campo: 'a' \| 'b'`, o `string` si no te importa afinar |
| `type: [String]` | `campo: string[]` |
| `type: Schema.Types.ObjectId` | `campo: Types.ObjectId` (o `string`) |

Los campos que agrega Mongoose (`createdAt` / `updatedAt` por `timestamps`) **no**
van en esta interfaz salvo que los necesites tipados; si es así, agregalos a mano
(`createdAt: Date; updatedAt: Date;`). El `_id` sí aparece igual en `ProductoDoc`
porque lo pone `HydratedDocument`.

### ¿Por qué a mano? `InferSchemaType`

Mongoose trae un utilitario, `InferSchemaType`, que **lee el esquema y arma el
tipo solo**:

```ts
export type Producto = InferSchemaType<typeof productoSchema>;
// -> { nombre: string; precio?: number | null; enStock: boolean; createdAt: Date; ... }
```

La ventaja es enorme: si agregás un campo al esquema, el tipo se actualiza solo y
no hay forma de que una interfaz aparte quede desincronizada.

**En este proyecto no lo usamos** porque con la combinación actual
(`mongoose@9` + `typescript@6`) `InferSchemaType` devuelve `unknown` en todos los
campos, y eso rompe cualquier código que dependa del tipo (por ejemplo
`alumno.clasesPorReservar += 1` deja de compilar). Hasta que se resuelva —bajando
TypeScript a la 5.x, o con una versión futura de Mongoose— escribimos la interfaz
a mano.

**El costo:** la interfaz y el `new Schema({...})` son dos definiciones separadas
de la misma forma. Si tocás una, **acordate de tocar la otra**. Un comentario en
cada modelo (`Auto.ts`, `Alumno.ts`) lo recuerda.

---

## 6. `HydratedDocument` — el tipo del documento "vivo"

```ts
export type ProductoDoc = HydratedDocument<Producto>;
```

Cuando Mongoose te devuelve un documento (de `.create()`, `.findById()`, etc.),
no es un objeto plano: es un **documento "hidratado"**, que además de los datos
tiene métodos y propiedades de instancia:

```ts
const prod: ProductoDoc = await ProductoModel.findById(id);
prod.precio = 700;
await prod.save();        // método de instancia
prod.toJSON();            // dispara el transform de la sección 3.4
prod._id;                 // ObjectId
prod.isModified('precio');
```

- **`HydratedDocument<Producto>`** = "los campos de `Producto`"
  **+** "las cosas que Mongoose le agrega a cada documento" (`_id`, `save`,
  `toJSON`, `id`, ...).
- Usás **`Producto`** (plano) cuando trabajás con datos "muertos": el
  body de un request, un `.lean()`, un objeto que vas a serializar.
- Usás **`ProductoDoc`** cuando necesitás un documento con el que vas a
  `.save()`, modificar campos, etc.

| Necesito... | Tipo |
|---|---|
| describir la forma de los datos (input, respuesta, `.lean()`) | `Producto` |
| una variable que sale de `findById` y le voy a hacer `.save()` | `ProductoDoc` |

---

## 7. Cómo encaja todo (archivo completo comentado)

```ts
import { Schema, model, HydratedDocument } from 'mongoose';

// 1. Lista de valores permitidos, declarada una sola vez.
export const CATEGORIAS = ['bebida', 'comida', 'limpieza'] as const;

// 2. El esquema: la forma + las reglas, en tiempo de ejecución.
const productoSchema = new Schema(
  {
    nombre: { type: String, required: [true, 'El nombre es obligatorio'], trim: true },
    precio: { type: Number, min: [0, 'El precio no puede ser negativo'], default: 0 },
    categoria: {
      type: String,
      required: true,
      enum: { values: [...CATEGORIAS], message: 'categoria inválida (recibido: "{VALUE}")' },
    },
    activo: { type: Boolean, default: true },
  },
  {
    timestamps: true, // createdAt + updatedAt automáticos
    toJSON: {
      transform: (_doc, ret) => {
        delete (ret as Record<string, unknown>).__v;
        return ret;
      },
    },
  },
);

// 3. La forma de los datos, escrita A MANO. Lo ideal sería
//    InferSchemaType<typeof productoSchema>, pero hoy devuelve
//    "unknown" (mongoose 9 + TS 6). Mantener sincronizada con (2).
export interface Producto {
  nombre: string;
  precio: number;
  categoria: string;
  activo: boolean;
}

// 4. El tipo del documento "vivo" de Mongoose (con .save(), .toJSON(), _id, ...).
export type ProductoDoc = HydratedDocument<Producto>;

// 5. El modelo: el objeto con el que se consulta la colección "productos".
export const ProductoModel = model<Producto>('Producto', productoSchema);
```

Flujo mental — la misma forma se escribe **dos veces**, en paralelo:

```
                    ┌─ new Schema({ ... })          ──▶  validación en runtime + colección "productos"
  forma del     ────┤
  producto          └─ interface Producto  ──HydratedDocument──▶  ProductoDoc (documento vivo)
                          │
                          └──▶  model<Producto>('Producto', productoSchema)
```

---

## 8. Glosario rápido

| Término | En una frase |
|---|---|
| **Documento** | Un registro en MongoDB, con forma de objeto JSON. |
| **Colección** | Un conjunto de documentos (≈ tabla). Su nombre lo deduce Mongoose del nombre del modelo. |
| **Esquema (`Schema`)** | La definición de qué campos tiene un documento y qué reglas cumplen, en runtime. |
| **Modelo (`model()`)** | El objeto que usás para crear/leer/actualizar documentos de una colección. |
| **Hidratar / documento hidratado** | Convertir los datos crudos de la base en un objeto de Mongoose con métodos. |
| **Setter** | Opción que *transforma* el valor antes de guardar (`trim`, `lowercase`). |
| **Validador** | Opción que *acepta o rechaza* el valor (`required`, `enum`, `min`). |
| **Índice único (`unique`)** | Regla a nivel MongoDB: no se repiten valores en ese campo. Violación → error `11000`. |
| **Interfaz de datos (`Auto`, `Alumno`, …)** | La forma de los campos de una entidad, escrita a mano, con el nombre de la entidad. Base de `XxxDoc` y genérico de `model<Xxx>()`. |
| **`InferSchemaType`** | Utilitario de TS que arma el tipo a partir del esquema. En este proyecto **no se usa**: devuelve `unknown` con mongoose 9 + TS 6, por eso la interfaz va a mano. |
| **`HydratedDocument<T>`** | Utilitario de TS: los campos de `T` + lo que Mongoose agrega a cada documento (`_id`, `.save()`, `.toJSON()`, ...). |
| **`as const`** | Le pide a TS tratar un literal como de solo lectura y con valores exactos. |
| **`typeof x` (en TS)** | El *tipo* de la variable `x`. |
| **type assertion (`as T`)** | "Tratá esta expresión como de tipo `T`". No cambia nada en runtime. |
| **`__v`** | Version key interno de Mongoose. Se suele ocultar en las respuestas. |
| **`timestamps`** | Opción que agrega y mantiene `createdAt` y `updatedAt`. |

---

## 9. Para seguir leyendo

- Mongoose — Schemas: <https://mongoosejs.com/docs/guide.html>
- Mongoose — SchemaTypes y opciones de campo: <https://mongoosejs.com/docs/schematypes.html>
- Mongoose — Validación: <https://mongoosejs.com/docs/validation.html>
- Mongoose + TypeScript: <https://mongoosejs.com/docs/typescript.html>
- TypeScript Handbook (en español): <https://www.typescriptlang.org/docs/handbook/intro.html>
