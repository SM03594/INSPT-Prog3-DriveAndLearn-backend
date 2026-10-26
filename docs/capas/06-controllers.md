# Controllers: traductores entre HTTP y el negocio

## Qué es esto, en una frase

Un controller es la función que va **al final** de cada ruta. Saca los datos
del pedido HTTP (`req`), convierte el body en un **DTO**, llama al service y
convierte lo que el service devuelve en una respuesta HTTP (`res`). No decide
nada del negocio: **traduce**.

---

## El mapa

```
              ┌──────────────────── controller ────────────────────┐
req.params.id │                                                    │
req.body   ───┼─► aXDto(req.body) ─► await service.funcion(dto) ─► traducir ─┼─► res.status(...).json(...)
req.auth      │                      │                             │
              └──────────────────────┼─────────────────────────────┘
                                     │ throw
                                     ▼
                               errorHandler (no pasa por el controller)
```

| Lee de `req` | Para qué |
|---|---|
| `req.params` | El `:id` de la URL (`/api/autos/:id`). |
| `req.body` | Los datos que mandó el cliente. |
| `req.auth` | Quién hace el pedido. Lo cargó `requireAuthentication`. |

| Escribe en `res` | Para qué |
|---|---|
| `res.json(x)` | Responde 200 con `x` como JSON. |
| `res.status(201).json(x)` | Responde con otro status. |
| `res.status(204).end()` | Responde **sin cuerpo**. |

Hay un archivo por recurso en `src/controllers/`: `alumno`, `administrador`,
`auth`, `auto`, `clase`, `horarioEscuela` y `profesor`.

---

## El recorrido

### 1. La forma de un controller

`src/controllers/auto.controller.ts` es el ejemplo más simple:

```ts
import type { Request, Response } from 'express';
import * as autoService from '../services/auto.service.js';

export async function listar(_req: Request, res: Response) {
  const autos = await autoService.listar();
  res.json(autos);
}
```

- Son **funciones sueltas exportadas**, no una clase. El router las importa
  todas juntas con `import * as autoController` y usa `autoController.listar`.
- Son `async` porque el service habla con la base, y eso devuelve promesas.
- `import type` importa solo los tipos de Express. Ese import desaparece al
  compilar.
- `_req` lleva guion bajo porque `listar` no lo usa.

### 2. Leer la entrada

**Parámetros de la URL.** `Request<{ id: string }>` le indica a TypeScript que
`req.params.id` existe (`auto.controller.ts:18`):

```ts
export async function obtener(req: Request<{ id: string }>, res: Response) {
  const auto = await autoService.obtenerPorId(req.params.id);
```

**El body.** En Express, `req.body` es de tipo **`any`**: TypeScript no sabe
qué trae y tampoco lo controla. Por eso el controller **nunca** se lo pasa al
service tal cual: primero lo convierte en el **DTO** de la operación
(`src/controllers/auto.controller.ts:27`):

```ts
export async function crear(req: Request, res: Response) {
  const auto = await autoService.crear(aCrearAutoDto(req.body));
  res.status(201).json(auto);
}
```

`aCrearAutoDto` comprueba que el body traiga solo los campos del contrato, del
tipo correcto y con los obligatorios. Si algo no cumple, lanza un error 400 y
el service ni se entera. Si cumple, devuelve un objeto **nuevo** y tipado.
Cuando el service necesita un solo campo, el controller lo saca del DTO:
`aCambiarActivoDto(req.body).activo`. Todo esto se explica en
[`06b-dtos.md`](06b-dtos.md).

¿Y `validacionDeCuerpo`, el middleware de la ruta? Comprueba antes que el
pedido traiga un objeto JSON, y respeta el orden 401 → 403 → 400 (ver
[`05-middlewares.md`](05-middlewares.md)). El DTO vuelve a comprobarlo, como
red de seguridad, y además revisa los campos.

**Quién hace el pedido.** Solo `clase.controller.ts` lo necesita, porque los
permisos de las clases dependen del usuario. Tiene un pequeño **adaptador**
(`clase.controller.ts:15`):

```ts
function actorDe(req: Request): ActorClase {
  const auth = req.auth!;                 // la ruta garantiza requireAuthentication
  return { id: auth.id, rol: auth.role };
}
```

Convierte `req.auth`, que es un concepto de HTTP y usa `role` en inglés, en un
`ActorClase`, que es lo que entiende el service y usa `rol`. Así el service no
depende de la forma de `req`. El rol también decide el contrato de la reserva:
`aCrearClaseDto(req.body, actor.rol)` acepta el campo `alumno` solo si reserva
un admin.

### 3. Llamar al service, sin `try/catch`

```ts
const auto = await autoService.crear(aCrearAutoDto(req.body));
```

Si el DTO o el service lanzan un error (por ejemplo, un campo de más o una
patente repetida), el controller **no lo atrapa**. Express 5 ve que la promesa del handler se
rechazó y le pasa el error al `errorHandler`. Por eso ningún controller tiene
`try/catch`, y casi todos tienen 3 a 6 líneas.

### 4. Traducir el resultado a HTTP

El service devuelve **datos**: un documento, una lista o `null`. El controller
decide el **status**:

```
service devuelve...        controller responde...
──────────────────         ──────────────────────
lista                  ──► 200  res.json(lista)
documento (al leer)    ──► 200  res.json(doc)
documento (al crear)   ──► 201  res.status(201).json(doc)
documento (al editar)  ──► 200  res.json(doc)
documento (al borrar)  ──► 204  res.status(204).end()
null                   ──► 404  res.status(404).json({ mensaje: 'X no encontrado' })
lanza un error         ──► (no llega acá: lo responde el errorHandler)
```

El caso de `null` aparece en casi todos los controllers
(`alumno.controller.ts:22`):

```ts
const alumno = await alumnoService.obtenerPorId(req.params.id);
if (alumno === null) {
  res.status(404).json({ mensaje: 'Alumno no encontrado' });
} else {
  res.json(alumno);
}
```

¿Por qué `if / else` y no dos `if` seguidos? Porque un pedido se responde
**una sola vez**. Con el `else`, cada camino responde exactamente una vez y la
función tiene una única salida, sin `return`. Si después del 404 también se
ejecutara `res.json(alumno)`, Express lanzaría *"Cannot set headers after they
are sent"*.

En el proyecto se evita cortar una función con un `return` temprano (como
`return res.status(404)…`): cada función tiene, como mucho, un `return` al
final. Los handlers de Express no necesitan ninguno, porque Express no usa lo
que devuelven.

¿Por qué `eliminar` responde **204 sin cuerpo**? Porque, una vez borrado el
recurso, no hay nada útil que devolver. `.end()` cierra la respuesta sin
enviar JSON.

### 5. El controller más chico: `auth.controller.ts`

```ts
export async function login(req: Request, res: Response) {
  const resultado = await authService.autenticar(aLoginDto(req.body));
  res.status(200).json(resultado);
}
```

`aLoginDto` exige email y contraseña como texto: si falta alguno, o no es
texto, responde **400** (un pedido mal armado). Si las credenciales no
coinciden, el service lanza `ErrorAutenticacion` y el resultado es un **401**.

---

## Todos los controllers

| Controller | Funciones | DTO (`src/dtos/`) | Service |
|---|---|---|---|
| `alumno` | `listar`, `obtener`, `crear`, `actualizar`, `eliminar`, `sumarClases`, `restarClases` | `alumno.dto` | `alumno.service` |
| `administrador` | `listar`, `obtener`, `crear`, `actualizar`, `eliminar` | `administrador.dto` | `administrador.service` |
| `auth` | `login` | `auth.dto` | `auth.service` |
| `auto` | `listar`, `obtener`, `crear`, `actualizar`, `cambiarActivo` | `auto.dto` | `auto.service` |
| `clase` | `listar`, `obtener`, `crear`, `actualizar`, `eliminar` | `clase.dto` | `clase.service` |
| `horarioEscuela` | `obtener`, `reemplazar`, `validar`, `agregar`, `quitar` | `calendarioSemanal.dto` | `horarioEscuela.service` |
| `profesor` | `listar`, `obtener`, `crear`, `cambiarNomApe`, `agregarDisponibilidad`, `quitarDisponibilidad` | `profesor.dto` y `calendarioSemanal.dto` | `profesor.service` |

Cada controller usa **un solo** service, el de su recurso. La excepción es
`horarioEscuela.controller`, que para `validar` también importa `validarDia`
de `calendarioSemanal.service`. Las rutas sin body (`listar`, `obtener`,
`eliminar`) no tienen DTO.

---

## Qué puede salir mal

| Síntoma | Causa |
|---|---|
| *"Cannot set headers after they are sent"* | Se respondió dos veces: falta el `else` después de `res.status(404)...`. |
| La respuesta es `{}` | Falta el `await`: se respondió con la **promesa** en lugar del resultado. Si además el service falla, el error no llega al `errorHandler`. |
| Un `DELETE` responde 204 pero el cliente espera un JSON | Es lo esperado: 204 significa "sin cuerpo". |
| Un controller crece con `if` y validaciones | Hay lógica en el controller. Si es de **forma** (qué campos, de qué tipo), va en el DTO; si es una **regla**, en el service. |
| Un body con campos de más se guarda sin error | El controller le pasó `req.body` al service sin pasar por el DTO. Compila igual, porque `req.body` es `any`. |
| `req.auth` es `undefined` | La ruta no pasa por `requireAuthentication`. El `!` de `actorDe` solo le asegura a TypeScript que no lo es, pero no lo comprueba al ejecutar. |

---

## Resumen

- Un controller **extrae** datos de `req`, **convierte** el body en un DTO,
  **llama** a un service y **traduce** el resultado a status + JSON.
- No valida reglas, no maneja errores y no habla con la base.
- La convención de respuestas: 200 para leer o editar, 201 para crear, 204
  para borrar y 404 si el service devuelve `null`.
- `req.body` es `any`: **nunca** se le pasa tal cual al service. Primero se
  convierte en el DTO de la operación.

**Siguiente lectura:** [`06b-dtos.md`](06b-dtos.md).
