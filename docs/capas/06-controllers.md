# Controllers: traductores entre HTTP y el negocio

## Qué es esto, en una frase

Un controller es la función que va **al final** de cada ruta. Saca los datos
del pedido HTTP (`req`), llama al service con argumentos comunes y convierte lo
que el service devuelve en una respuesta HTTP (`res`). No decide nada del
negocio: **traduce**.

---

## El mapa

```
              ┌──────────────────── controller ────────────────────┐
req.params.id │                                                    │
req.body   ───┼─► extraer ─► await service.funcion(args) ─► traducir ─┼─► res.status(...).json(...)
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
`req.params.id` existe (`auto.controller.ts:17`):

```ts
export async function obtener(req: Request<{ id: string }>, res: Response) {
  const auto = await autoService.obtenerPorId(req.params.id);
```

**El body.** En Express, `req.body` es de tipo **`any`**: TypeScript no sabe
qué trae y tampoco lo controla. Por eso los controllers **no lo validan ni
confían en él**: se lo pasan al service, que es el que decide qué campos acepta
(ver [`07-services.md`](07-services.md)). En el proyecto hay tres formas de
pasarlo:

| Forma | Ejemplo | Dónde |
|---|---|---|
| Entero, tal cual | `autoService.crear(req.body)` | auto, administrador, clase, horarioEscuela |
| Con `cuerpoComoObjeto` | `alumnoService.crear(cuerpoComoObjeto(req.body))` | alumno, profesor |
| Solo un campo | `autoService.cambiarEstado(id, req.body.activo)` | `cambiarActivo`, `login`, `sumarClases` |

`cuerpoComoObjeto` (`src/utils/cuerpoPeticion.ts`) lanza un error 400 si el
body no es un objeto, y si lo es, lo devuelve con el tipo
`Record<string, unknown>` en lugar de `any`. Es un chequeo **repetido**:
`validacionDeCuerpo` ya lo hizo en la ruta. Pero funciona como segunda red de
seguridad y le da al body un tipo seguro.

**Quién hace el pedido.** Solo `clase.controller.ts` lo necesita, porque los
permisos de las clases dependen del usuario. Tiene un pequeño **adaptador**
(`clase.controller.ts:14`):

```ts
function actorDe(req: Request): ActorClase {
  const auth = req.auth!;                 // la ruta garantiza requireAuthentication
  return { id: auth.id, rol: auth.role };
}
```

Convierte `req.auth`, que es un concepto de HTTP y usa `role` en inglés, en un
`ActorClase`, que es lo que entiende el service y usa `rol`. Así el service no
depende de la forma de `req`.

### 3. Llamar al service, sin `try/catch`

```ts
const auto = await autoService.crear(req.body);
```

Si el service lanza un error (por ejemplo, una patente repetida), el
controller **no lo atrapa**. Express 5 ve que la promesa del handler se
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
(`alumno.controller.ts:18`):

```ts
const alumno = await alumnoService.obtenerPorId(req.params.id);
if (alumno === null) {
  return res.status(404).json({ mensaje: 'Alumno no encontrado' });
}
res.json(alumno);
```

¿Por qué el `return` delante de `res.status(404)`? Para **cortar** la función.
Sin él, después de responder 404 también se ejecutaría `res.json(alumno)`, y
Express lanzaría *"Cannot set headers after they are sent"*, porque no se puede
responder dos veces el mismo pedido.

¿Por qué `eliminar` responde **204 sin cuerpo**? Porque, una vez borrado el
recurso, no hay nada útil que devolver. `.end()` cierra la respuesta sin
enviar JSON.

### 5. El controller más chico: `auth.controller.ts`

```ts
export async function login(req: Request, res: Response) {
  const resultado = await authService.autenticar(req.body?.email, req.body?.password);
  res.status(200).json(resultado);
}
```

`req.body?.email` usa `?.`: si `req.body` fuera `undefined`, da `undefined` en
lugar de lanzar un error. El service recibe `unknown` y valida que los dos
valores sean texto. Si las credenciales son incorrectas, el service lanza
`ErrorAutenticacion` y el resultado es un 401.

---

## Todos los controllers

| Controller | Funciones | Service |
|---|---|---|
| `alumno` | `listar`, `obtener`, `crear`, `actualizar`, `eliminar`, `sumarClases`, `restarClases` | `alumno.service` |
| `administrador` | `listar`, `obtener`, `crear`, `actualizar`, `eliminar` | `administrador.service` |
| `auth` | `login` | `auth.service` |
| `auto` | `listar`, `obtener`, `crear`, `actualizar`, `cambiarActivo` | `auto.service` |
| `clase` | `listar`, `obtener`, `crear`, `actualizar`, `cancelar` | `clase.service` |
| `horarioEscuela` | `obtener`, `reemplazar`, `validar`, `agregar`, `quitar` | `horarioEscuela.service` |
| `profesor` | `listar`, `obtener`, `crear`, `cambiarNomApe`, `cambiarFotoPerfil`, `agregarDisponibilidad`, `quitarDisponibilidad` | `profesor.service` |

Cada controller usa **un solo** service, el de su recurso. La excepción es
`horarioEscuela.controller`, que para `validar` también importa `validarDia`
de `calendarioSemanal.service`.

---

## Qué puede salir mal

| Síntoma | Causa |
|---|---|
| *"Cannot set headers after they are sent"* | Falta el `return` antes de `res.status(404)...`. |
| La respuesta es `{}` | Falta el `await`: se respondió con la **promesa** en lugar del resultado. Si además el service falla, el error no llega al `errorHandler`. |
| Un `DELETE` responde 204 pero el cliente espera un JSON | Es lo esperado: 204 significa "sin cuerpo". |
| Un controller crece con `if` y validaciones | Hay lógica de negocio en el controller. Movela al service, que es donde se puede testear sin HTTP. |
| `req.auth` es `undefined` | La ruta no pasa por `requireAuthentication`. El `!` de `actorDe` solo le asegura a TypeScript que no lo es, pero no lo comprueba al ejecutar. |

---

## Resumen

- Un controller **extrae** datos de `req`, **llama** a un service y
  **traduce** el resultado a status + JSON.
- No valida reglas, no maneja errores y no habla con la base.
- La convención de respuestas: 200 para leer o editar, 201 para crear, 204
  para borrar y 404 si el service devuelve `null`.
- `req.body` es `any`: se le pasa al service, que lo trata como `unknown` y lo
  valida.

**Siguiente lectura:** [`07-services.md`](07-services.md).
