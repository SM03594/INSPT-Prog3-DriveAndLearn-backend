# Índices de MongoDB (y cómo los declara Mongoose)

## Qué es esto, en una frase

Un índice es una **lista aparte, ordenada** por uno o más campos, en la que
cada entrada apunta a su documento. Gracias a ese orden, MongoDB puede ir
directo a los documentos que le piden, como cuando buscás una palabra en un
diccionario, en vez de leer la colección entera. En Mongoose se declaran en
el esquema, y Mongoose los crea en la base al conectar.

> Los números de esta guía se midieron **ejecutando el código real** sobre una
> base en memoria, con `explain('executionStats')`.

---

## El mapa

```
 Clase.ts                                  MongoDB, colección "clases"
 ────────                                  ───────────────────────────
 claseSchema.index({ profesor: 1, fin: 1 })  ──► profesor_1_fin_1 ┐
 claseSchema.index({ alumno: 1, fin: 1 })    ──► alumno_1_fin_1   ├─ los crea Mongoose
 claseSchema.index({ auto: 1, fin: 1 })      ──► auto_1_fin_1     ┘  al conectar
                                                 _id_                 ← siempre existe

 Una consulta:  find({ ...filtro })
                     │
                     ▼
            ¿hay un índice que sirva?
             │                     │
            SÍ                     NO
             ▼                     ▼
         IXSCAN                 COLLSCAN
   recorre un pedazo        lee TODOS los documentos
   del índice y busca       y prueba el filtro en
   solo esos documentos     cada uno
```

---

## El recorrido

### 1. Sin índice: COLLSCAN

La reserva de una clase (`validarAusenciaDeConflictos`,
`src/services/clase.service.ts:141`) y la consulta de turnos libres
(`listarSuperpuestas`, `clase.service.ts:188`) hacen esta búsqueda:

```js
{
  inicio: { $lt: finPedido },
  fin:    { $gt: inicioPedido },
  $or: [ { profesor: X }, { auto: { $in: [...] } }, { alumno: Y } ]
}
```

Si no hay ningún índice que sirva, MongoDB hace un **COLLSCAN** (*collection
scan*): lee cada documento de la colección y le aplica el filtro. Las clases
no se borran cuando ya pasaron, así que la colección crece para siempre, y con
ella lo que cuesta cada reserva.

### 2. Un índice compuesto, por dentro

`{ profesor: 1, fin: 1 }` se ordena **primero por profesor** y, dentro de cada
profesor, **por `fin`** (el `1` significa de menor a mayor):

```
 profesor │ fin
 ─────────┼──────────────────
 Ana      │ ...
 Juan     │ 2024-01-01 13:00  ┐
 Juan     │ 2024-01-02 13:00  │ 500 clases que ya terminaron
 Juan     │ ...               ┘
 Juan     │ 2030-01-07 13:00  ┐ ← primera con fin > inicioPedido: arranca acá
 Juan     │ 2030-01-08 13:00  │ 5 clases futuras: lee solo estas
 Juan     │ ...               ┘
 Marta    │ ...
```

Con `profesor: Juan`, MongoDB salta al bloque de Juan. Con
`fin > inicioPedido`, salta dentro de ese bloque a la primera clase que todavía
no terminó. Ni siquiera mira las anteriores.

La regla general es que en un índice compuesto **va primero el campo que se
compara por igualdad** (`profesor`) y **después el de rango** (`fin`). Al
revés, el orden por profesor quedaría partido en pedacitos y el índice no
serviría para saltar.

### 3. Elegir bien el campo de rango

La consulta tiene dos condiciones de tiempo, pero no filtran lo mismo:

- `fin > inicioPedido` es una cota **por abajo**: deja afuera todo lo que ya
  terminó.
- `inicio < finPedido` es una cota **por arriba**: toda clase pasada empezó
  antes, así que **la cumple**.

Medido con 500 clases pasadas y 5 futuras del mismo profesor, alumno y auto:

| Índices | Plan | Documentos leídos |
|---|---|---|
| Ninguno | `COLLSCAN` | **505** |
| `{ profesor: 1, inicio: 1 }` y los otros dos por `inicio` | `IXSCAN` | **501** |
| `{ profesor: 1, fin: 1 }` y los otros dos por `fin` | `IXSCAN` | **5** |

Con índices por `inicio`, MongoDB **usa** el índice, pero tiene que recorrer
todo el historial. Que un plan diga `IXSCAN` no alcanza: hay que mirar
cuánto lee.

### 4. `$or`: un índice por rama

MongoDB resuelve cada rama de un `$or` **por separado**, cada una con su
índice, y después junta los resultados sin repetir documentos. El plan
ganador de la búsqueda es:

```
FETCH            ← trae los documentos y aplica "inicio < finPedido"
 └── OR          ← junta las ramas
      ├── IXSCAN   profesor_1_fin_1
      ├── IXSCAN   alumno_1_fin_1
      └── IXSCAN   auto_1_fin_1
```

Leyó 15 entradas de índice (5 por rama) y solo **5 documentos**, porque las
tres ramas encontraron las mismas clases.

El detalle importante es que **si a una sola rama le falta índice, todo vuelve
a COLLSCAN**. Con los índices de profesor y alumno, pero sin el de auto, la
búsqueda leyó otra vez los **505** documentos. Por eso `Clase.ts` declara tres
(`src/models/Clase.ts:69-71`).

### 5. Cómo los declara Mongoose

Hay dos formas:

```ts
// En el campo: índice de un solo campo
patente: { type: String, unique: [true, 'La patente ingresada ya está en uso'] }

// En el esquema: cualquier índice, incluidos los compuestos
claseSchema.index({ profesor: 1, fin: 1 });
```

Al conectar (`mongoose.connect`, `src/config/db.ts:41`), Mongoose recorre los
modelos y le pide a MongoDB que cree los índices que faltan. Los nombres los
arma MongoDB con los campos y el orden: `profesor_1_fin_1`, `patente_1`.

Hay dos cosas que Mongoose **no** hace:

- **No espera** a que los índices estén creados para que la app empiece a
  responder. Si hace falta esperar (por ejemplo, en un test que mira el plan),
  se usa `await Modelo.init()` (`tests/models/Clase.test.ts:36`).
- **No borra** de la base un índice que se sacó del esquema. Para alinear la
  base con el esquema existe `Modelo.syncIndexes()`.

### 6. `unique` es un índice, no una validación

Los índices `unique` del proyecto son `autos.patente_1`
(`src/models/Auto.ts:33`) y `usuarios.email_1` (`src/models/Usuario.ts:33`).
Funcionan distinto de las validaciones del esquema:

- `validate()` **no** lo revisa: un auto con una patente ya usada pasa la
  validación sin error.
- Quien rechaza el duplicado es **MongoDB, al guardar**, con el código
  `11000`. Mongoose lo envuelve en un error con el mensaje del esquema, y
  `verSiErrorClaveDuplicada` (`src/errors/errorClaveDuplicada.ts:43`) lo
  convierte en un 409.
- Si la colección ya tiene duplicados cuando Mongoose intenta crear el índice,
  la creación falla y **la colección queda sin el `unique`**. Como Mongoose no
  espera a los índices, el servidor arranca igual y acepta duplicados.

Los tres índices de `clases` no son `unique`, así que no pueden fallar por los
datos.

### 7. Qué cuestan

- **Escrituras**: cada vez que se crea, mueve o borra una clase, MongoDB
  actualiza también sus tres índices. Es poco al lado de una búsqueda que lee
  toda la colección, y cada reserva hace las dos cosas.
- **Espacio**: cada índice guarda sus campos y un puntero por documento.

Por eso no se indexa "por las dudas": cada índice se justifica con una
consulta que lo usa.

---

## Qué puede salir mal

| Síntoma | Causa |
|---|---|
| Reservar se vuelve más lento a medida que pasan los meses | La búsqueda hace COLLSCAN: falta un índice, o le falta a una rama del `$or`. |
| El plan dice `IXSCAN` pero igual lee casi todo | El índice termina en un campo con cota por arriba (`inicio`) en vez de por abajo (`fin`). |
| Se guardan dos autos con la misma patente | El índice `unique` no se pudo crear (la colección ya tenía duplicados) y Mongoose no esperó a que fallara. |
| Un test que mira el plan falla a veces | El índice todavía se estaba creando: falta `await Modelo.init()`. |
| Se sacó un índice del esquema y sigue en la base | Mongoose no borra índices: hay que usar `syncIndexes()` o borrarlo a mano. |

---

## Resumen

- Un índice es una lista ordenada que apunta a los documentos. Sin un índice
  que sirva, MongoDB hace COLLSCAN y lee la colección entera.
- En un índice compuesto va primero el campo de igualdad y después el de
  rango. El campo de rango tiene que **descartar** lo que no interesa (`fin`
  para dejar afuera las clases que ya terminaron).
- Un `$or` necesita un índice por rama: con una sola sin índice, todo vuelve
  a COLLSCAN.
- Mongoose crea los índices al conectar, sin esperarlos ni borrar los viejos.
- `unique` no es una validación: lo hace cumplir MongoDB al guardar.
- `explain('executionStats')` muestra el plan y cuántos documentos se leyeron.

---

## Siguiente lectura

- [`../capas/08-models.md`](../capas/08-models.md): cómo se arma un esquema de
  Mongoose, incluido `unique` (sección 3).
- [`../flujos/agendar-una-clase.md`](../flujos/agendar-una-clase.md): la
  búsqueda de superposiciones dentro de una reserva de punta a punta.
- [`../flujos/consultar-turnos-libres.md`](../flujos/consultar-turnos-libres.md):
  la otra consulta que usa estos índices.
