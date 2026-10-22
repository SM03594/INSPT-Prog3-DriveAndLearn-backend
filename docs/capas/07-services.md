# Services: donde viven las reglas

## Qué es esto, en una frase

Un service es donde se decide **qué se puede hacer y qué no**: valida los datos
que llegan, aplica las reglas de negocio ("un alumno sin saldo no puede
reservar") y lee o escribe en la base a través de los models. No sabe que
existe HTTP: recibe argumentos comunes y devuelve datos, o lanza un error.

---

## El mapa

| Service | Modelo(s) que usa | Responsabilidad |
|---|---|---|
| `auth.service` | — (usa `usuario.service`) | Login: comprobar las credenciales y firmar el JWT. |
| `usuario.service` | `UsuarioModel` | Buscar usuarios de **cualquier** rol (por id o por email). |
| `alumno.service` | `AlumnoModel` | Alta, edición y baja de alumnos, y el saldo de clases. |
| `administrador.service` | `AdministradorModel` | Alta, edición y baja de admins, y `existe()` para los middlewares. |
| `auto.service` | `AutoModel` | Alta y edición de autos, y ponerlos o sacarlos de servicio. |
| `profesor.service` | `ProfesorModel` | Alta, nombre, foto y disponibilidad de los profesores. |
| `calendarioSemanal.service` | — (no toca la base) | Operaciones sobre **cualquier** calendario semanal. |
| `horarioEscuela.service` | `HorarioEscuelaModel` | El horario único de la escuela. |
| `clase.service` | `Clase`, `Alumno`, `Profesor`, `Auto`, `HorarioEscuela`, `Administrador` | Reservar, modificar y cancelar clases. |

Algunos services usan a otros:

```
auth.service ─────────────► usuario.service
horarioEscuela.service ──┐
profesor.service ────────┴► calendarioSemanal.service
auth.middleware ──────────► administrador.service.existe()
clase.service ────────────► (usa los MODELS de los demás directamente)
```

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

### 2. Validar lo que llega: `unknown` hasta demostrar lo contrario

El service es la **última puerta** antes de la base, así que valida todo lo que
viene del cliente. Un buen ejemplo es el registro de alumnos
(`src/services/alumno.service.ts:40`):

```ts
const CAMPOS_CREACION = ['email', 'password', 'nomApe'] as const;

function validarDatosCreacion(datosEntrada: unknown): Alumno {
  // 1. ¿es un objeto?                              si no → 400
  // 2. ¿trae solo email, password y nomApe?        si no → 400 "No se pueden enviar estos campos..."
  // 3. ¿los tres son texto?                        si no → 400
  return {
    email: datos.email,
    password: datos.password,
    nomApe: datos.nomApe,
    clasesPorReservar: 0,      // ← lo fija el service, nunca el cliente
  };
}
```

El paso 2 y la última línea son **reglas de seguridad**. Si el service
aceptara cualquier campo, alguien podría registrarse con
`{ "clasesPorReservar": 100 }` y obtener clases gratis. El saldo inicial lo
decide el negocio, no el cliente.

**En el proyecto conviven dos estilos de validación:**

| Estilo | Services | Cómo funciona |
|---|---|---|
| **Explícito** | `alumno`, `profesor`, `clase`, `auth`, `auto`, `administrador` | Reciben `unknown`, rechazan campos que no esperan y comprueban los tipos antes de guardar. Mongoose sigue aplicando las reglas de esquema, como campos obligatorios, formatos y valores permitidos. |

Los services de `auto` y `administrador` también validan explícitamente el
cuerpo. Por ejemplo, `rol` no se acepta al crear o actualizar un administrador:
lo determina el discriminator de Mongoose y no el cliente. Así se evita que
Mongoose descarte campos desconocidos en silencio.

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

`profesor.service` y `clase.service` tienen además un helper `exigir`, que
convierte una condición en un error y le avisa a TypeScript que, si no lanzó,
la condición se cumple (`asserts condicion`):

```ts
exigir(auto.activo, 'El auto no está disponible para reservas', 409);
// a partir de acá, el tipo de "auto" ya no incluye null
```

### 4. Traducir errores de la base: claves duplicadas

El email de un usuario y la patente de un auto son `unique` en el esquema. Si
se repiten, MongoDB lanza un error **crudo** (`code: 11000`). El service lo
atrapa y lo convierte en un error del proyecto (`auto.service.ts:31`):

```ts
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

### 5. Contraseñas: siempre hasheadas antes de guardar

`alumno.service` y `administrador.service` pasan los datos por
`conPasswordHasheada` (`src/utils/password.ts`) tanto al **crear** como al
**actualizar**:

```ts
const datosAGuardar = await conPasswordHasheada(validarDatosCreacion(datosEntrada));
```

Si los datos traen `password`, la función comprueba que tenga al menos 8
caracteres y la reemplaza por su hash bcrypt. Si no la traen, por ejemplo en
una edición que solo cambia el nombre, devuelve los datos sin tocarlos.

### 6. Dos formas de modificar un documento

**A. `findByIdAndUpdate`, en un solo paso** (`auto.service.ts:50`):

```ts
AutoModel.findByIdAndUpdate(id, cambios, { new: true, runValidators: true });
```

- `new: true` devuelve el documento **después** del cambio.
- `runValidators: true` hace que corran las validaciones del esquema. Sin esa
  opción, un update se las saltea.
- Ojo: los hooks `pre('validate')` del esquema **no** corren en un update.

**B. Buscar, modificar y `.save()`** (`alumno.service.ts`, `ajustarClasesPorReservar`):

```ts
const alumno = await AlumnoModel.findById(id);
if (alumno === null) return null;
alumno.clasesPorReservar += delta;
return alumno.save();          // corre TODAS las validaciones (min: 0)
```

Se usa cuando el valor nuevo depende del anterior, o cuando hace falta que
corran todas las validaciones y hooks. Por ejemplo, para agregar un tramo al
horario o a la disponibilidad de un profesor.

### 7. Operaciones atómicas y compensación: reservar una clase

La forma B tiene un punto débil. Entre el `findById` y el `.save()` pasa
tiempo: si dos pedidos llegan a la vez, los dos leen el mismo saldo. Para
operaciones administrativas poco frecuentes, como sumar clases, no es un
problema. Para **reservar**, donde muchos alumnos compiten, `clase.service`
usa una operación **condicional y atómica** (`clase.service.ts:337`):

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
| Un campo enviado "no se guarda" y nadie avisa | Falta una lista explícita de campos permitidos en el service; Mongoose puede descartar en silencio los campos que no conoce. |
| Dos reservas simultáneas dejan el saldo en negativo | Se usó buscar → modificar → guardar en lugar de una operación atómica con condición. |
| Un service importa `Request` de Express | Se mezcló HTTP con negocio. El service tiene que recibir argumentos comunes. |

---

## Resumen

- Un service **valida**, **aplica reglas** y **persiste**. No conoce HTTP.
- Contrato: devuelve un valor, devuelve `null` (no existe) o lanza un error (no
  se puede).
- Trata lo que llega como `unknown`: acepta solo los campos esperados y los
  valores que **no debe** elegir el cliente (como el saldo inicial) los fija
  él mismo.
- Traduce los errores crudos de MongoDB (`11000`) a errores del proyecto con
  mensaje propio.
- Para modificar, usa `findByIdAndUpdate` con `runValidators`, o buscar →
  modificar → `.save()`. Para lo que compite (reservas), usa operaciones
  atómicas con condición, y compensación si falla un paso posterior.

**Siguiente lectura:** [`08-models.md`](08-models.md).
