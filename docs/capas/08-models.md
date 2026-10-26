# Models: la forma de los datos

## Qué es esto, en una frase

Un model describe **cómo es un documento** en MongoDB: qué campos tiene, de
qué tipo son, cuáles son obligatorios y qué valores acepta. Mongoose usa esa
descripción para **validar** antes de guardar y para **limpiar** los datos
(recortar espacios, pasar a mayúsculas, poner valores por defecto). Es la
capa más baja: la única que habla directamente con la base.

---

## El mapa

```
colección "usuarios"                       colección "profesores"
┌────────────────────────────┐             ┌──────────────────────────────┐
│ Usuario (base)             │             │ Profesor                     │
│  rol, email, password,     │             │  nomApe,                     │
│  nomApe                    │             │  disponibilidad ─────────────┼──┐
│   ├─ Alumno  (rol:'alumno')│             └──────────────────────────────┘  │
│   │    + clasesPorReservar │                                               │
│   └─ Administrador         │             colección "horario_escuela"       │
│        (rol:'administrador')│            ┌──────────────────────────────┐  │
└────────────────────────────┘             │ HorarioEscuela  _id:'escuela'│  │
            ▲ ref                          │  calendario ─────────────────┼──┤
            │                              └──────────────────────────────┘  │
colección "clases"                                                           ▼
┌────────────────────────────┐   colección "autos"        sub-esquemas (no son colecciones)
│ Clase                      │   ┌─────────────────┐      CalendarioSemanal { lunes: [Tramo], ... }
│  alumno ─► Alumno          │   │ Auto            │        Tramo { horaInicio, horaFin }
│  profesor ─► Profesor      │   │  patente (único)│          HoraDelDia { hora, minuto }
│  auto ─► Auto ─────────────┼──►│  cambios, activo│
│  inicio, fin               │   └─────────────────┘
└────────────────────────────┘
```

| Archivo | Exporta | Colección |
|---|---|---|
| `Usuario.ts` | `UsuarioModel` (modelo base) | `usuarios` |
| `Alumno.ts` | `AlumnoModel` (discriminator) | `usuarios` |
| `Administrador.ts` | `AdministradorModel` (discriminator) | `usuarios` |
| `Profesor.ts` | `ProfesorModel` | `profesores` |
| `Auto.ts` | `AutoModel` | `autos` |
| `Clase.ts` | `ClaseModel` | `clases` |
| `HorarioEscuela.ts` | `HorarioEscuelaModel` | `horario_escuela` |
| `CalendarioSemanal.ts`, `Tramo.ts`, `Horario.ts` | sub-esquemas y tipos | — (van **dentro** de otros documentos) |

---

## El recorrido

### 1. Anatomía de un model: `Auto.ts`

Todos los archivos siguen los mismos cuatro pasos:

```ts
// ① El esquema: los campos y las opciones
const autoSchema = new Schema({ marca: {...}, patente: {...}, ... }, { timestamps: true, ... });

// ② El tipo de TypeScript: los mismos campos, escritos a mano
export interface Auto { marca?: string; modelo?: string; patente: string; cambios: Cambios; activo: boolean; }

// ③ El tipo del documento "vivo" (con _id, .save(), .toJSON()...)
export type AutoDoc = HydratedDocument<Auto>;

// ④ El modelo: la clase con la que se consulta y se guarda
export const AutoModel = model<Auto>('Auto', autoSchema);
```

El **esquema** (①) es lo que valida al **ejecutar**. La **interfaz** (②) solo
existe para el **compilador**. Mongoose no las relaciona automáticamente:
mantenerlas sincronizadas es tarea de quien escribe el código (ver la
sección 8).

`AutoModel` es lo que usan los services: `AutoModel.find()`,
`AutoModel.findById(id)`, `AutoModel.create(datos)`, etc.

### 2. Las opciones de cada campo

```ts
patente: {
  type: String,
  required: [true, 'La patente es obligatoria'],   // [valor, mensaje de error]
  trim: true,                                       // "  ab123cd " → "ab123cd"
  uppercase: true,                                  // → "AB123CD"
  unique: [true, 'La patente ingresada ya está en uso'],
},
```

| Opción | Qué hace | Dónde se usa |
|---|---|---|
| `type` | Tipo del dato (`String`, `Number`, `Boolean`, `Date`, `Buffer`, `ObjectId`). Mongoose **convierte** si puede: `"8"` → `8`. Por eso los DTO comprueban el tipo **antes** (ver [`06b-dtos.md`](06b-dtos.md)). | todos |
| `required` | El campo no puede faltar. | casi todos |
| `trim` / `lowercase` / `uppercase` | Limpian el texto **antes** de guardar. | email, patente, nomApe |
| `enum` | Lista cerrada de valores. | `Auto.cambios`, `Usuario.rol` |
| `min` / `max` | Rango numérico. | `HoraDelDia`, `clasesPorReservar` |
| `default` | Valor si no viene. | `activo: true`, `clasesPorReservar: 0` |
| `match` | El texto tiene que cumplir una regex. Corre **después** de `trim`/`lowercase`. | Formato de `Usuario.email` |
| `validate` | Una función propia: `{ validator, message }`. | `Number.isInteger` en horas y minutos |
| `unique` | **No es un validador**: crea un **índice** en MongoDB. | `email`, `patente` |

El primer valor de `required: [true, '...']` activa la regla, y el segundo es
el mensaje que va a llegar al cliente. Cuando falla una validación, Mongoose
lanza un `ValidationError`, y el `errorHandler` junta todos los mensajes en un
400.

### 3. `unique` es un índice, no una validación

Cuando la app arranca, Mongoose le pide a MongoDB que cree un **índice único**
sobre `email` (en `usuarios`) y sobre `patente` (en `autos`). Quien rechaza
el duplicado es **MongoDB**, al intentar insertarlo, con el error crudo
`code: 11000`. Por eso no aparece como `ValidationError`: el service lo atrapa
y lo traduce a `ErrorClaveDuplicada` (409). Se explica en
[`07-services.md`](07-services.md#4-traducir-errores-de-la-base-claves-duplicadas).

### 3b. Índices propios: `schema.index()`

Un índice no tiene por qué ser `unique`: también sirve para que una búsqueda
no tenga que leer la colección entera. `Clase.ts` declara tres, uno por cada
rama del `$or` con el que la reserva y la consulta de turnos buscan
superposiciones (`Clase.ts:69-71`):

```ts
claseSchema.index({ profesor: 1, fin: 1 });
claseSchema.index({ alumno: 1, fin: 1 });
claseSchema.index({ auto: 1, fin: 1 });
```

Van por `fin` porque "`fin` > inicio pedido" deja afuera, de una, todas las
clases que ya terminaron. Medido con 500 clases pasadas y 5 futuras, la
búsqueda pasa de leer 505 documentos a leer 5. Cómo funcionan y por qué hacen
falta tres está en
[`../guias/indices-de-mongoose.md`](../guias/indices-de-mongoose.md).

### 4. Reglas entre campos: `pre('validate')`

Algunas reglas comparan **dos campos** entre sí. `Clase.ts:76`:

```ts
claseSchema.pre('validate', async function () {
  const inicio = this.get('inicio') as Date | undefined;
  const fin = this.get('fin') as Date | undefined;
  if (inicio && fin && inicio >= fin) {
    this.invalidate('fin', 'El fin de la clase debe ser posterior al inicio');
  }
});
```

Un *hook* `pre('validate')` corre justo antes de validar el documento.
`this.invalidate(campo, mensaje)` marca el campo como inválido, y el resultado
es el mismo `ValidationError` que con cualquier otra regla. El tramo
(`Tramo.ts:35`) usa el mismo truco para exigir que `horaFin` sea
posterior a `horaInicio`.

**Importante:** este hook corre en `create()` y en `.save()`, pero **no** en
`findByIdAndUpdate()`. Por eso los services que modifican tramos usan
`findById` + `.save()`.

### 5. Las opciones del esquema

El segundo argumento de `new Schema(campos, opciones)` (`Usuario.ts:52`):

| Opción | Qué hace |
|---|---|
| `timestamps: true` | Agrega `createdAt` y `updatedAt`, y los mantiene actualizados solo. |
| `collection: 'usuarios'` | Fija el nombre de la colección. Sin esta opción, Mongoose lo deriva del nombre del modelo. |
| `toJSON: { transform }` | Modifica el objeto cuando se convierte a JSON (`res.json(doc)`). |
| `versionKey: false` | No guarda el campo `__v` (lo usa `HorarioEscuela`). |
| `_id: false` | No genera un `_id` (lo usan los sub-esquemas `HoraDelDia` y `CalendarioSemanal`). |
| `discriminatorKey: 'rol'` | El campo que distingue alumnos de administradores (sección 7). |

El `transform` de `Usuario` es una medida de **seguridad**:

```ts
toJSON: {
  transform: (_doc, ret) => {
    delete ret.__v;        // contador interno de Mongoose
    delete ret.password;   // el hash nunca sale de la API
    return ret;
  },
},
```

En la base, el documento **sí** tiene el `password` hasheado. Lo que el cliente
recibe no lo tiene.

### 6. Sub-esquemas: piezas que se reutilizan

`HoraDelDia`, `Tramo` y `CalendarioSemanal` **no son colecciones**: son formas
que van **dentro** de otros documentos. `calendarioSemanalSchema` se usa dos
veces:

```ts
// HorarioEscuela.ts
calendario:     { type: calendarioSemanalSchema, default: crearCalendarioSemanal },
// Profesor.ts
disponibilidad: { type: calendarioSemanalSchema, default: crearCalendarioSemanal },
```

**¿Por qué `default` recibe una función y no un objeto?** Si fuera un objeto
literal `{ lunes: [], ... }`, todos los profesores nuevos podrían terminar
**compartiendo el mismo** objeto en memoria. Con una función, Mongoose la
llama una vez por documento y cada uno recibe su propio calendario.

Cómo se usan estas piezas se explica en
[`../temas/horarios-y-agendamiento.md`](../temas/horarios-y-agendamiento.md).

### 7. Discriminators: alumnos y administradores en la misma colección

Alumnos y administradores comparten casi todo (email, password, nomApe), así
que se guardan en **una sola colección**, `usuarios`, y el campo `rol` indica
qué es cada uno:

```ts
// Usuario.ts — el modelo base
const usuarioSchema = new Schema({ rol, email, password, nomApe }, { discriminatorKey: 'rol', ... });
export const UsuarioModel = model<Usuario>('Usuario', usuarioSchema);

// Alumno.ts — agrega un campo y fija rol = 'alumno'
export const AlumnoModel = UsuarioModel.discriminator<AlumnoGuardado>(
  'Alumno', alumnoSchema, { value: 'alumno' });

// Administrador.ts — no agrega campos, solo fija rol = 'administrador'
export const AdministradorModel = UsuarioModel.discriminator<AdministradorGuardado>(
  'Administrador', new Schema({}), { value: 'administrador' });
```

Cada modelo "ve" una parte distinta de la colección:

```
colección usuarios
┌──────────────────────────────────────────┐
│ { rol:'alumno', email:'ana@...', ... }   │ ◄─ AlumnoModel        ◄─┐
│ { rol:'alumno', email:'beto@...', ... }  │ ◄─ AlumnoModel        ◄─┤ UsuarioModel
│ { rol:'administrador', email:'adm@...' } │ ◄─ AdministradorModel ◄─┘ (ve todos)
└──────────────────────────────────────────┘
```

Esto tiene consecuencias concretas, que comprobé con una base en memoria:

- `AlumnoModel.findById(idDeUnAdmin)` devuelve **`null`**: el discriminator
  agrega `rol: 'alumno'` a cada consulta. Así, `administrador.service.existe()`
  no confunde un alumno con un admin.
- `UsuarioModel.find()` devuelve documentos de **las dos** clases (`Alumno` y
  `Administrador`). Lo usa `usuario.service` para el login, que no sabe de
  antemano el rol de quien entra.
- El índice único de `email` es **de la colección**, no de cada rol: un admin
  **no puede** usar el email de un alumno (409).

En `Usuario.ts:9-10` hay un detalle: importa `AlumnoDoc` y `AdministradorDoc`
con `import type`, aunque esos archivos a su vez importan `UsuarioModel` de
`Usuario.ts`. Como son imports **solo de tipos**, se borran al compilar y no
se produce un import circular al ejecutar.

### 8. Los tipos escritos a mano y sus desajustes

Como el esquema y la interfaz se escriben por separado, pueden **no
coincidir**, y TypeScript no se da cuenta. Pasó en `Auto` (I-06, ya
resuelta):

| Campo | Esquema (lo que valida al ejecutar) | Interfaz antes | Interfaz hoy |
|---|---|---|---|
| `marca`, `modelo` | Opcionales (no tienen `required`) | `string`, obligatorios | `string` opcionales (`?`) |
| `cambios` | Solo `'AUTOMATICO'` o `'MANUAL'` | Cualquier `string` | `Cambios` |

`Cambios` se deriva de la constante que ya usa el `enum` del esquema,
igual que `Rol` y `Dia` (ver
[`02-typescript-en-el-proyecto.md`](02-typescript-en-el-proyecto.md#4-derivar-el-tipo-desde-un-valor-as-const--typeof)):

```ts
export const CAMBIOS = ['AUTOMATICO', 'MANUAL'] as const;
export type Cambios = (typeof CAMBIOS)[number];
```

Corregir la interfaz tuvo una consecuencia en otra capa: Mongoose 9 tipa
`AutoModel.create()` con la interfaz, así que un `cambios` de tipo `string`
dejó de compilar. Por eso el DTO de autos ahora **convierte** `cambios`
(`"manual"` → `'MANUAL'`) en lugar de dejárselo al esquema (ver
[`06b-dtos.md`](06b-dtos.md#5b-validar-y-además-convertir-los-parsear)). Que la
interfaz diga la verdad hizo que TypeScript encontrara el lugar donde llegaba
un valor sin revisar.

### 9. Referencias entre colecciones

`Clase` guarda solo los **ids** de alumno, profesor y auto:

```ts
alumno: { type: Schema.Types.ObjectId, required: [...], ref: 'Alumno' },
```

`ref: 'Alumno'` le indica a Mongoose a qué modelo apunta ese id. Con eso se
podría usar `.populate('alumno')` para traer el documento completo en lugar
del id. **Hoy ningún service usa `populate`**: la API devuelve las clases con
los ids, y el cliente los busca aparte si los necesita.

### 10. Un documento con `_id` fijo: `HorarioEscuela`

```ts
_id: { type: String, default: 'escuela' },
```

En lugar del `ObjectId` automático, el `_id` es el texto `'escuela'`. Así hay
**un solo** horario y siempre se encuentra con `findById('escuela')`, sin
búsquedas ni listas.

---

## Qué puede salir mal

| Síntoma | Causa |
|---|---|
| A un usuario viejo no se le puede hacer `.save()`: "El email no tiene un formato válido" | `.save()` revalida **todos** los campos con validadores, no solo los que cambiaron. Si el email se guardó antes de que existiera el `match`, hay que corregirlo primero (con un `PUT`, que solo valida lo que cambia). |
| Un duplicado no da 409 | El índice único no se creó, por ejemplo porque ya había duplicados en la base cuando arrancó la app. |
| Una regla `pre('validate')` no se aplica | Se modificó con `findByIdAndUpdate` en lugar de `.save()`. |
| Una validación de rango no se aplica en un update | Falta `runValidators: true`. |
| Aparece el `password` en una respuesta | Se envió algo que no pasa por `toJSON`, por ejemplo un resultado de `.lean()` o un objeto armado a mano. |
| TypeScript dice que un campo existe pero viene `undefined` | La interfaz no coincide con el esquema (sección 8). |
| Reservar o consultar turnos se vuelve más lento a medida que pasan los meses | Falta un índice para alguna rama de la búsqueda de superposiciones (sección 3b). |

---

## Resumen

- Cada model tiene un **esquema** (valida al ejecutar), una **interfaz**
  (para TypeScript, escrita a mano), un tipo `XxxDoc` y el **modelo**.
- Las opciones de cada campo validan (`required`, `enum`, `min`, `validate`) y
  limpian (`trim`, `lowercase`, `default`). `unique` es un **índice**, no un
  validador.
- `schema.index()` declara índices propios: `Clase` tiene uno por cada rama
  de la búsqueda de superposiciones, terminados en `fin`.
- `pre('validate')` permite reglas entre campos, pero no corre en los
  `findByIdAndUpdate`.
- `toJSON.transform` quita `__v` y `password` de todas las respuestas.
- Los sub-esquemas (`CalendarioSemanal`) se reutilizan dentro de varios
  documentos.
- Los discriminators guardan alumnos y admins en `usuarios`, distinguidos por
  `rol`.

**Siguiente lectura:** [`09-errores.md`](09-errores.md).
