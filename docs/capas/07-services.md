# Services: donde viven las reglas

## Qué es esto, en una frase

Un service es donde se decide **qué se puede hacer y qué no**: aplica las
reglas de negocio ("un alumno sin saldo no puede reservar") y lee o escribe en
la base a través de los models. No sabe que existe HTTP: recibe un DTO ya
validado (o argumentos comunes) y devuelve datos, o lanza un error.

---

## El mapa

| Service | Modelo(s) que usa | Responsabilidad |
|---|---|---|
| `auth.service` | — (usa `usuario.service`) | Login: comprobar las credenciales y firmar el JWT. |
| `usuario.service` | `UsuarioModel` | Buscar usuarios de **cualquier** rol (por id o por email). |
| `alumno.service` | `AlumnoModel` | Alta, edición y baja de alumnos, y el saldo de clases. |
| `administrador.service` | `AdministradorModel` | Alta, edición y baja de admins, y `existe()` para los middlewares. |
| `auto.service` | `AutoModel` | Alta y edición de autos, y ponerlos o sacarlos de servicio. |
| `profesor.service` | `ProfesorModel` | Alta, nombre y disponibilidad de los profesores. |
| `calendarioSemanal.service` | — (no toca la base) | Operaciones sobre **cualquier** calendario semanal. |
| `tramo.service` | — (no toca la base) | Reglas de un tramo: que empiece y termine en una hora en punto. |
| `horarioEscuela.service` | `HorarioEscuelaModel` | El horario único de la escuela. |
| `clase.service` | `Clase`, `Alumno`, `Profesor`, `Auto`, `HorarioEscuela`, `Administrador` | Reservar, modificar y eliminar clases. |
| `turno.service` | — (usa **solo** otros services) | Consultar los turnos libres de un profesor para un día. |

Algunos services usan a otros:

```
auth.service ─────────────► usuario.service
horarioEscuela.service ──┐
profesor.service ────────┴► calendarioSemanal.service ──► tramo.service
auth.middleware ──────────► administrador.service.existe()
                 └────────► clase.service.obtenerPorIdAlumno()
clase.service ────────────► alumno.service.sumarClasesPorReservar()   (al eliminar)
                 ├────────► tramo.service.entraEnAlgunTramo()
                 └────────► los MODELS de los demás, para lo demás
turno.service ────────────► profesor, horarioEscuela, auto (listarActivos),
                            clase (listarSuperpuestas, DURACION_CLASE_MS),
                            alumno, administrador y tramo.service
```

`turno.service` es el único que no toca ningún model: todo lo pide a otros
services. Así la consulta de turnos usa **las mismas reglas** que la reserva
(la duración de una clase, las cuentas con tramos) y no puede contradecirla.

---

## El recorrido

### 1. La forma: funciones `async` que devuelven datos

`src/services/auto.service.ts`:

```ts
export async function obtenerPorId(id: string): Promise<AutoDoc | null> {
  return AutoModel.findById(id);
}
```

Igual que los controllers, los services son **funciones sueltas exportadas**.
El tipo de retorno es el **contrato** con quien las llama:

| El service... | Significa | El controller... |
|---|---|---|
| devuelve un valor | Todo salió bien. | Responde 200 o 201. |
| devuelve `null` | "No encontré ese recurso". | Responde 404. |
| **lanza** un error | Se rompió una regla o los datos son inválidos. | No hace nada: lo responde el `errorHandler`. |

`null` no es un error: que un id no exista es un resultado esperado. Lanzar
queda reservado para cuando el pedido **no se puede cumplir**.

### 2. Recibe un DTO: la forma ya viene validada

El service **no** comprueba qué campos mandó el cliente ni de qué tipo son: de
eso se encarga el **DTO**, que arma el controller antes de llamarlo (ver
[`06b-dtos.md`](06b-dtos.md)). El service recibe el DTO tipado y se queda con
las **reglas** (`src/services/alumno.service.ts:41`):

```ts
export async function crear(datos: CrearAlumnoDto): Promise<AlumnoDoc> {
  // regla: el saldo inicial lo fija el service, nunca el cliente
  const datosAGuardar = await conPasswordHasheada({ ...datos, clasesPorReservar: 0 });
  ...
}
```

Esa línea es una **regla de seguridad** en dos partes. El DTO no deja pasar un
`clasesPorReservar` mandado por el cliente: responde 400. Y el service fija el
saldo en 0 él mismo. Si se aceptara cualquier campo, alguien podría
registrarse con `{ "clasesPorReservar": 100 }` y obtener clases gratis.

Algunos ejemplos de lo que queda en cada lugar:

| En el DTO (forma) | En el service (reglas) |
|---|---|
| `cantidad` es un número | `cantidad` es entera y mayor que 0 |
| `nomApe` es un texto | El nombre no puede quedar vacío (`"   "`) |
| `dia` es un texto, `tramo` es un objeto | El día existe (`validarDia`) |
| La reserva trae `profesor`, `auto`, `inicio`, `fin` | Ids válidos, 1 hora, en punto, horario, saldo |
| La consulta trae `fecha` AAAA-MM-DD y horas H:MM | Fecha no pasada, `desde` < `hasta`, rango de al menos 1 hora |

El service confía en el tipo del DTO. Esa confianza solo existe al compilar:
si alguien le pasara `req.body` directamente, compilaría igual, porque es
`any`. Por eso todo body tiene que pasar por su DTO en el controller.

**Quién hace el pedido.** Cuando una regla depende del usuario, el service
recibe un `Actor` (`src/types/actor.ts`), no `req`:

```ts
export interface Actor {
  id: string;
  rol: Rol;   // 'alumno' | 'administrador'
}
```

Lo usan `clase.service` (un alumno solo ve y reserva sus clases) y
`turno.service` (a un alumno no se le ofrecen turnos en los que ya tiene
clase, y se le revisa el saldo). El controller lo arma con `extraerActor(req)`.
Vive en `types/` y no en un service porque lo usan varios y ninguno es su
dueño.

### 3. Romper una regla: `ErrorDeNegocio`

Cuando una regla no se cumple, el service **lanza** un error del dominio, sin
pensar en HTTP (`alumno.service.ts`, `validarCantidad`):

```ts
if (cantidad <= 0) {
  throw new ErrorDeNegocio(`La cantidad a ${operacion} debe ser mayor que 0`);
}
```

`ErrorDeNegocio` usa 400 por defecto, pero puede llevar otro status cuando
corresponde. `clase.service` usa **409 Conflict** para "el recurso está en un
estado que no lo permite" (sin saldo, horario ocupado, auto inactivo):

```ts
function errorConflicto(mensaje: string): ErrorDeNegocio {
  return new ErrorDeNegocio(mensaje, 409);
}
```

`clase.service` tiene además un helper `exigir`, que
convierte una condición en un error y le avisa a TypeScript que, si no lanzó,
la condición se cumple (`asserts condicion`):

```ts
exigir(auto.activo, 'El auto no está disponible para reservas', 409);
// a partir de acá, el tipo de "auto" ya no incluye null
```

### 4. Traducir errores de la base: claves duplicadas

El email de un usuario y la patente de un auto son `unique` en el esquema. Si
se repiten, MongoDB lanza un error **crudo** (`code: 11000`). El service lo
atrapa y lo convierte en un error del proyecto (`auto.service.ts:78`):

```ts
await verificarPatenteLibre(datos.patente);   // primero, buscar el duplicado

try {
  return await AutoModel.create(datos);
} catch (err) {
  throw verSiErrorClaveDuplicada(err, MENSAJE_PATENTE_DUPLICADA);   // → ErrorClaveDuplicada (409)
}
```

¿Por qué en el service y no en el `errorHandler`? Porque el service sabe **qué
campo** se repitió y qué mensaje tiene sentido ("La patente ya está en uso"). Si
el error no es de clave duplicada, `verSiErrorClaveDuplicada` lo devuelve sin
cambios y sigue su camino.

`auto.service` además **busca** la patente antes de guardar
(`verificarPatenteLibre`, `auto.service.ts:34`), y si ya la tiene otro auto
lanza el mismo `ErrorClaveDuplicada`. No confía solo en el índice porque, si
el índice no se pudo crear, Mongoose no avisa y los duplicados entran (ver
[`../guias/indices-de-mongoose.md`](../guias/indices-de-mongoose.md#6-unique-es-un-índice-no-una-validación)).
El `try/catch` queda para cuando dos altas con la misma patente llegan a la
vez: las dos pasan la búsqueda y el índice frena a la segunda.

### 5. Contraseñas: siempre hasheadas antes de guardar

`alumno.service` y `administrador.service` pasan los datos por
`conPasswordHasheada` (`src/utils/password.ts`) tanto al **crear** como al
**actualizar**:

```ts
const datosAGuardar = await conPasswordHasheada({ ...datos, clasesPorReservar: 0 });
```

Si los datos traen `password`, la función comprueba que tenga al menos 8
caracteres y la reemplaza por su hash bcrypt. Si no la traen, por ejemplo en
una edición que solo cambia el nombre, devuelve los datos sin tocarlos.

### 6. Dos formas de modificar un documento

**A. `findByIdAndUpdate`, en un solo paso** (`auto.service.ts:103`):

```ts
AutoModel.findByIdAndUpdate(id, cambios, { new: true, runValidators: true });
```

- `new: true` devuelve el documento **después** del cambio. Mongoose 9 lo
  marca como deprecado: la forma nueva es `returnDocument: 'after'`, que ya
  usa `clase.service`. Los demás services todavía usan `new: true` (I-05).
- `runValidators: true` hace que corran las validaciones del esquema. Sin esa
  opción, un update se las saltea.
- Ojo: los hooks `pre('validate')` del esquema **no** corren en un update.

**B. Buscar, modificar y `.save()`** (`alumno.service.ts`, `ajustarClasesPorReservar`):

```ts
const alumno = await AlumnoModel.findById(id);
let alumnoActualizado: AlumnoDoc | null = null;

if (alumno !== null) {
  alumno.clasesPorReservar += delta;
  alumnoActualizado = await alumno.save();   // corre TODAS las validaciones (min: 0)
}

return alumnoActualizado;
```

Se usa cuando el valor nuevo depende del anterior, o cuando hace falta que
corran todas las validaciones y hooks. Por ejemplo, para agregar un tramo al
horario o a la disponibilidad de un profesor.

### 7. Operaciones atómicas y compensación: reservar una clase

La forma B tiene un punto débil. Entre el `findById` y el `.save()` pasa
tiempo: si dos pedidos llegan a la vez, los dos leen el mismo saldo. Para
operaciones administrativas poco frecuentes, como sumar clases, no es un
problema. Para **reservar**, donde muchos alumnos compiten, `clase.service`
usa una operación **condicional y atómica** (`clase.service.ts:271`):

```ts
AlumnoModel.findOneAndUpdate(
  { _id: alumnoId, clasesPorReservar: { $gte: 1 } },   // solo si tiene saldo...
  { $inc: { clasesPorReservar: -1 } },                 // ...restá 1, todo en una operación
);
```

Después crea la clase. Si **eso** falla, **devuelve** el crédito que descontó
(una *compensación*), para no dejar al alumno con un crédito menos y sin clase:

```
descontar crédito ──► ok ──► crear clase ──► ok ──► 201
                              │
                              └─ falla ──► devolver crédito ──► relanzar el error
```

Cómo funciona la reserva completa se explica en
[`../temas/horarios-y-agendamiento.md`](../temas/horarios-y-agendamiento.md#parte-4-reservar-una-clase-post-apiclases).

### 8. Probar un service

Como un service no depende de HTTP, se prueba **llamándolo directamente**
(`tests/services/auto.service.test.ts`):

```ts
setupTestDB();                                   // MongoDB en memoria

it('guarda el auto y le asigna un _id', async () => {
  const auto = await crear(datosValidos);
  expect(auto._id).toBeDefined();
});
```

No hace falta ni token, ni `req`, ni servidor. Esa es la gran ventaja de
mantener la lógica fuera de los controllers.

---

## Qué puede salir mal

| Síntoma | Causa |
|---|---|
| Un update guarda un valor inválido | Falta `runValidators: true` en `findByIdAndUpdate`. |
| La contraseña queda en texto plano | Se guardó sin pasar por `conPasswordHasheada`. |
| Un email repetido responde 500 en lugar de 409 | Falta el `try/catch` con `verSiErrorClaveDuplicada` alrededor del `create` o `update`. |
| Un campo enviado "no se guarda" y nadie avisa | El controller no pasó el body por el DTO, y Mongoose descarta en silencio los campos que no conoce. |
| Dos reservas simultáneas dejan el saldo en negativo | Se usó buscar → modificar → guardar en lugar de una operación atómica con condición. |
| Un service importa `Request` de Express | Se mezcló HTTP con negocio. El service tiene que recibir argumentos comunes. |

---

## Resumen

- Un service **aplica reglas** y **persiste**. No conoce HTTP.
- Contrato: devuelve un valor, devuelve `null` (no existe) o lanza un error (no
  se puede).
- Recibe un DTO con la forma ya validada. Los valores que **no debe** elegir
  el cliente (como el saldo inicial) los fija él mismo.
- Traduce los errores crudos de MongoDB (`11000`) a errores del proyecto con
  mensaje propio.
- Para modificar, usa `findByIdAndUpdate` con `runValidators`, o buscar →
  modificar → `.save()`. Para lo que compite (reservas), usa operaciones
  atómicas con condición, y compensación si falla un paso posterior.

**Siguiente lectura:** [`08-models.md`](08-models.md).
