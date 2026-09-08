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
tipo de TypeScript es el mismo molde pero en tiempo de compilación.** En estos
archivos escribimos el esquema una vez y *derivamos* el tipo de TS a partir de él,
para no repetir la definición en dos lados.

---

## 2. El `import` de mongoose

```ts
import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';
```

Esto trae cuatro cosas del paquete `mongoose`:

- **`Schema`** — clase para *construir* un esquema (valor, existe en runtime).
- **`model`** — función para *crear el modelo* a partir de un esquema (valor).
- **`InferSchemaType`** — *tipo* utilitario de TypeScript (no existe en runtime).
- **`HydratedDocument`** — *tipo* utilitario de TypeScript (no existe en runtime).

> **Valor vs tipo.** `Schema` y `model` son código que se ejecuta.
> `InferSchemaType` y `HydratedDocument` son solo información para el compilador:
> desaparecen cuando TypeScript se transpila a JavaScript. Por eso los primeros
> dos "hacen algo" y los otros dos solo aparecen en anotaciones de tipo
> (`type X = ...`, `: X`).

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
  `as const`, es `readonly ['bebida', 'comida', 'limpieza']`. Eso permite que más
  adelante el tipo derivado del campo sea `'bebida' | 'comida' | 'limpieza'` en
  vez de un `string` cualquiera.
- **`[...CATEGORIAS]`** hace una copia mutable del array, porque `enum.values`
  espera un array normal (no uno `readonly`).
- **`{VALUE}`** en el mensaje lo reemplaza Mongoose por el valor que falló.
- La forma corta `enum: [...CATEGORIAS]` también funciona si no te importa
  personalizar el mensaje.

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
- **`<Producto>`** — el tipo del documento (ver sección siguiente). Hace que
  `ProductoModel.create(...)`, los resultados de `.find()`, etc. estén tipados.
- `model()` **crea o recupera** el modelo: si ya se registró uno con ese nombre,
  te devuelve el existente. Por eso no pasa nada si el archivo se importa varias
  veces.

Convención del proyecto: exportamos el modelo como `XxxModel` (`AutoModel`,
`AlumnoModel`) y el **tipo** como `Xxx` (`Auto`, `Alumno`).

---

## 5. `InferSchemaType` — derivar el tipo de TypeScript del esquema

```ts
export type Producto = InferSchemaType<typeof productoSchema>;
```

`InferSchemaType` **lee el esquema y arma el tipo del documento
automáticamente**. Desglose:

- **`typeof productoSchema`** — en TypeScript, `typeof` sobre una variable te da
  *su tipo*. Necesitamos el tipo del schema (no el valor) para pasárselo al
  utilitario.
- **`InferSchemaType<...>`** — recorre los campos y produce algo equivalente a:

  ```ts
  type Producto = {
    nombre: string;
    precio?: number | null;
    categoria: 'bebida' | 'comida' | 'limpieza';
    enStock: boolean;
    createdAt: Date;   // por timestamps: true
    updatedAt: Date;
  };
  ```

**La gran ventaja:** si mañana agregás un campo al esquema, el tipo `Producto` se
actualiza solo. No hay una interfaz escrita a mano que se pueda desincronizar del
esquema real.

Detalles de cómo infiere:

- `required: true` → propiedad no opcional.
- sin `required` → suele quedar opcional y `| null`.
- `default` → la propiedad deja de ser opcional (siempre va a tener valor).
- `enum` con `as const` → unión de literales en vez de `string`.

Este tipo describe un **objeto plano** (los datos), no un documento de Mongoose
con métodos.

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

- **`HydratedDocument<Producto>`** = "los campos de `Producto`" **+** "las cosas
  que Mongoose le agrega a cada documento" (`_id`, `save`, `toJSON`, `id`, ...).
- Usás **`Producto`** (plano) cuando trabajás con datos "muertos": el body de un
  request, un `.lean()`, un objeto que vas a serializar.
- Usás **`ProductoDoc`** cuando necesitás un documento con el que vas a
  `.save()`, modificar campos, etc.

| Necesito... | Tipo |
|---|---|
| describir la forma de los datos (input, respuesta, `.lean()`) | `Producto` |
| una variable que sale de `findById` y le voy a hacer `.save()` | `ProductoDoc` |

---

## 7. Cómo encaja todo (archivo completo comentado)

```ts
import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';

// 1. Lista de valores permitidos, declarada una sola vez.
export const CATEGORIAS = ['bebida', 'comida', 'limpieza'] as const;

// 2. El esquema: la forma + las reglas, en tiempo de ejecución.
const productoSchema = new Schema(
  {
    nombre: { type: String, required: [true, 'El nombre es obligatorio'], trim: true },
    precio: { type: Number, min: [0, 'El precio no puede ser negativo'] },
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

// 3. El tipo de los datos, DERIVADO del esquema (no escrito a mano).
export type Producto = InferSchemaType<typeof productoSchema>;

// 4. El tipo del documento "vivo" de Mongoose (con .save(), .toJSON(), ...).
export type ProductoDoc = HydratedDocument<Producto>;

// 5. El modelo: el objeto con el que se consulta la colección "productos".
export const ProductoModel = model<Producto>('Producto', productoSchema);
```

Flujo mental:

```
esquema (runtime)  ──InferSchemaType──▶  Producto (tipo, datos planos)
     │                                        │
     │                                   HydratedDocument
     ▼                                        ▼
model('Producto', esquema)  ─────────────▶  ProductoDoc (tipo, documento vivo)
     │
     ▼
colección "productos" en MongoDB
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
| **`InferSchemaType`** | Utilitario de TS que arma el tipo de los datos a partir del esquema. |
| **`HydratedDocument<T>`** | Utilitario de TS: los campos de `T` + lo que Mongoose agrega a cada documento. |
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
