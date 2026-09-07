# Tipos derivados del esquema y creación del modelo

Este documento explica en detalle las últimas líneas de
[`src/models/Auto.ts`](../src/models/Auto.ts):

```ts
export type Auto = InferSchemaType<typeof autoSchema>;

export type AutoDoc = HydratedDocument<Auto>;

export const AutoModel = model<Auto>('Auto', autoSchema);
```

Son tres piezas chiquitas pero hacen bastante trabajo. Vamos una por una.

---

## 0. El punto de partida: `autoSchema`

Antes de estas líneas ya definimos un **esquema** de Mongoose:

```ts
const autoSchema = new Schema(
  {
    marca:   { type: String, trim: true },
    modelo:  { type: String, trim: true },
    patente: { type: String, required: true, trim: true, uppercase: true, unique: true },
    cambios: { type: String, required: true, enum: { values: ['automatico', 'manual'], /* ... */ } },
    activo:  { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: { /* ... */ } },
);
```

El esquema es un **objeto de JavaScript en tiempo de ejecución**: describe qué
campos hay, de qué tipo, y qué reglas de validación aplican. Mongoose lo usa
cuando lee/escribe en MongoDB.

El problema: TypeScript **no sabe nada** de ese objeto. Para TS, cualquier
documento de autos sería `any`. Necesitamos "traducir" el esquema a un **tipo**
de TypeScript. Eso es lo que hacen las dos primeras líneas.

---

## 1. `export type Auto = InferSchemaType<typeof autoSchema>;`

### Qué es `typeof autoSchema`

Ojo: acá `typeof` **no** es el `typeof` de JavaScript (`typeof x === 'string'`).
Es el `typeof` de TypeScript, que solo existe en el "mundo de los tipos".

- `autoSchema` (sin `typeof`) es un **valor**: el objeto Schema real.
- `typeof autoSchema` es el **tipo** de ese valor: algo como
  `Schema<{ marca?: string; modelo?: string; patente: string; ... }>`.

En resumen: `typeof` agarra una variable que existe en el código y te da su
tipo, para poder pasárselo a otro tipo genérico.

### Qué es `InferSchemaType<...>`

`InferSchemaType` es un **tipo utilitario** que trae Mongoose. Recibe el tipo de
un Schema y "deduce" (infiere) cómo sería el objeto plano correspondiente.

Aplicado a nuestro esquema, `Auto` termina siendo, más o menos:

```ts
type Auto = {
  marca?: string | null;
  modelo?: string | null;
  patente: string;          // required: true  -> no es opcional
  cambios: string;          // required: true
  activo: boolean;          // tiene default   -> siempre presente
  createdAt: Date;          // timestamps: true
  updatedAt: Date;          // timestamps: true
};
```

Detalles de cómo infiere:

| En el esquema | En el tipo `Auto` |
|---|---|
| `required: true` | campo **obligatorio** (`patente: string`) |
| sin `required` | campo **opcional** (`marca?: string`) |
| `default: ...` | campo presente (no opcional) |
| `timestamps: true` | agrega `createdAt` y `updatedAt` de tipo `Date` |
| `type: String` | `string`; `type: Boolean` → `boolean`; etc. |

> **Detalle fino sobre `cambios`:** aunque en el esquema hay un `enum` con
> `'automatico'` y `'manual'`, en el código escribimos `values: [...CAMBIOS]`.
> El *spread* (`...`) crea un array nuevo y TypeScript pierde los valores
> literales, así que `cambios` queda inferido como `string` y no como
> `'automatico' | 'manual'`. Si quisieras el tipo estrecho, habría que pasar
> `values: CAMBIOS` directamente (y ajustar tipos) o declarar el tipo a mano.

### Por qué se hace así (y no una `interface` a mano)

Podríamos haber escrito:

```ts
interface Auto {
  marca?: string;
  modelo?: string;
  patente: string;
  cambios: string;
  activo: boolean;
}
```

Pero entonces tendríamos **dos fuentes de verdad**: el esquema y la interface.
El día que agregás un campo (por ejemplo `anio: Number`) al esquema y te olvidás
de la interface, TypeScript no te avisa y quedan desincronizados.

Con `InferSchemaType`, **el esquema es la única fuente de verdad**. Agregás el
campo al esquema y el tipo `Auto` se actualiza solo. Menos código, menos bugs.

### Qué NO incluye `Auto`

`InferSchemaType` describe los **datos** del documento, no la "maquinaria" de
Mongoose. En particular, `Auto` **no** tiene:

- `_id` (lo agrega `HydratedDocument`, ver abajo)
- `__v` (versión interna)
- métodos como `.save()`, `.toJSON()`, `.populate()`

Por eso `Auto` es el tipo ideal para representar un auto "pelado": lo que manda
el cliente en el body, lo que devolvés en un JSON, un objeto de prueba, etc.

---

## 2. `export type AutoDoc = HydratedDocument<Auto>;`

### "Objeto plano" vs "documento de Mongoose"

Cuando trabajás con Mongoose hay dos cosas parecidas pero distintas:

1. **Objeto plano (POJO — Plain Old JavaScript Object):**
   `{ marca: 'Toyota', patente: 'AB123CD', ... }`. Datos y nada más.

2. **Documento "hidratado" (hydrated document):** además de los datos, trae
   métodos y estado interno de Mongoose:
   - `.save()` — guarda los cambios en MongoDB
   - `.toJSON()` / `.toObject()` — lo convierte a objeto plano (acá se aplica el
     `transform` que le sacamos `__v`)
   - `.isModified('campo')`, `.isNew`
   - `._id` ya tipado como `ObjectId`
   - getters/setters, virtuals, validación con `.validate()`, etc.

"Hidratar" = tomar los datos crudos que vienen de la base y "envolverlos" con
toda esa funcionalidad.

### Qué hace `HydratedDocument<Auto>`

`HydratedDocument` es otro tipo utilitario de Mongoose. Toma el tipo de los datos
(`Auto`) y devuelve el tipo del **documento completo**: `Auto` + `_id` + los
métodos de instancia.

```ts
type AutoDoc = HydratedDocument<Auto>;
// ≈ Auto & { _id: ObjectId; save(): Promise<AutoDoc>; toJSON(): any; ... }
```

### Cuándo aparece cada uno en nuestro código

En [`src/services/auto.service.ts`](../src/services/auto.service.ts) las
funciones devuelven `AutoDoc` porque los métodos de Mongoose te dan documentos
hidratados:

| Operación | Devuelve |
|---|---|
| `AutoModel.create(datos)` | `AutoDoc` |
| `AutoModel.findById(id)` | `AutoDoc \| null` |
| `AutoModel.find()` | `AutoDoc[]` |
| `AutoModel.findByIdAndUpdate(...)` | `AutoDoc \| null` |
| `new AutoModel(datos)` | `AutoDoc` (todavía sin guardar) |

Si en algún momento usás `.lean()` (por ejemplo
`AutoModel.find().lean()`), Mongoose **no hidrata**: te devuelve objetos planos
(`Auto[]`), más livianos y rápidos, pero sin `.save()` ni transforms. Ahí el
tipo correcto sería `Auto`, no `AutoDoc`.

### Por qué exportamos los dos tipos

- **`Auto`**: para hablar de los datos (DTOs, respuestas, tests).
- **`AutoDoc`**: para hablar de lo que devuelve Mongoose dentro del service.

Tener ambos hace que el resto del código (controller, service, tests) sea
type-safe sin castear a `any`.

---

## 3. `export const AutoModel = model<Auto>('Auto', autoSchema);`

### Qué hace `model(...)`

`mongoose.model(nombre, esquema)` es lo que **conecta el esquema con una
colección de MongoDB** y te devuelve el objeto con el que hacés todas las
operaciones: `AutoModel.find()`, `AutoModel.create()`, etc.

Un "modelo" en Mongoose es como una **clase**: representa a la colección entera y
sabe cómo crear documentos individuales de ella.

### El parámetro genérico `<Auto>`

`model<Auto>(...)` le dice a TypeScript: "los documentos de este modelo tienen la
forma `Auto`". Gracias a eso:

- `AutoModel.create({ marca: 123 })` → **error de tipo** (marca debe ser string)
- `const a = await AutoModel.findById(id); a?.patente` → TS sabe que `patente`
  es `string`
- el autocompletado del editor te muestra los campos reales

Sin el genérico, Mongoose usaría un tipo más flojo y perderías gran parte del
chequeo.

### `'Auto'`: el nombre del modelo y el nombre de la colección

El primer argumento (`'Auto'`) es el **nombre interno** del modelo. Mongoose lo
usa para dos cosas:

1. **Registro global:** Mongoose guarda todos los modelos en un registro por
   nombre. Por eso `model('Auto')` (sin el segundo argumento) en otro archivo
   **recupera** el mismo modelo ya creado. Si llamás `model('Auto', schema)` dos
   veces con esquema, tira `OverwriteModelError`. De ahí el comentario
   "crea (o recupera)".

2. **Nombre de la colección:** por defecto Mongoose toma el nombre del modelo,
   lo pasa a minúsculas y lo **pluraliza**:

   | Nombre del modelo | Colección en MongoDB |
   |---|---|
   | `'Auto'` | `autos` ✅ |
   | `'Alumno'` | `alumnos` |
   | `'Clase'` | `clases` |
   | `'Persona'` | `people` (¡pluralización "inteligente"!) |

   En nuestro caso `'Auto'` → `autos`, que es justo el nombre que usa el diseño
   de la base ([`contexto-claude/MongoDB-Model-DriveAndLearn.json`](../contexto-claude/MongoDB-Model-DriveAndLearn.json)).

   Si el nombre no pluralizara bien, se puede forzar la colección con un tercer
   argumento: `model('Auto', autoSchema, 'autos')`, o en las opciones del
   esquema: `new Schema({...}, { collection: 'autos' })`.

### A qué base de datos se conecta

El modelo **no** abre la conexión. Usa la conexión global de Mongoose que
abrimos en [`src/config/db.ts`](../src/config/db.ts) con `connectDB()`
(`mongoose.connect(MONGODB_URI)`). Por eso el orden en
[`src/server.ts`](../src/server.ts) es: primero `connectDB()`, después
`app.listen()`.

En los tests pasa lo mismo, pero la conexión la abre `setupTestDB()` contra un
Mongo en memoria. El modelo es el mismo; cambia a dónde apunta la conexión.

---

## Resumen

| Línea | Rol | Mundo |
|---|---|---|
| `autoSchema` | describe forma + validaciones | valor (runtime) |
| `type Auto = InferSchemaType<typeof autoSchema>` | tipo de los **datos** planos | solo tipos (compilación) |
| `type AutoDoc = HydratedDocument<Auto>` | tipo del **documento vivo** de Mongoose (datos + `_id` + `.save()`, etc.) | solo tipos |
| `AutoModel = model<Auto>('Auto', autoSchema)` | objeto para operar la colección `autos` | valor (runtime), tipado con `Auto` |

Idea central: **el esquema se escribe una sola vez** y de ahí salen, sin
duplicar nada, tanto los tipos de TypeScript como el modelo que habla con
MongoDB.
