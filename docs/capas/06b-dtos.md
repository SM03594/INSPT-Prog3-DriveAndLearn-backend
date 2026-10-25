# DTOs: el contrato de cada operación

## Qué es esto, en una frase

Un **DTO** (*Data Transfer Object*) define **qué puede mandar el cliente en
una operación**: qué campos, de qué tipo y cuáles son obligatorios. El
controller convierte el body en un DTO, y si no cumple el contrato responde
400. El service recibe el DTO **ya validado y tipado**, y se queda solo con las
reglas del negocio.

---

## El mapa

```
pedido ─► routes ─► middlewares ─► controller ──────────────────► service ──► model
                    (auth, ¿hay       │                            (reglas)   (esquema)
                     un objeto?)      │ aCrearAutoDto(req.body)
                                      ▼
                               src/dtos/auto.dto.ts
                               ┌───────────────────────────────────┐
                               │ ¿solo campos del contrato?        │──► 400 "No se pueden enviar estos campos: color"
                               │ ¿cada uno del tipo correcto?      │──► 400 "La marca debe ser un texto"
                               │ ¿están los obligatorios?          │──► 400 "La patente es obligatoria"
                               └───────────────────────────────────┘
                                      │ CrearAutoDto (un objeto NUEVO, tipado)
                                      ▼
                               autoService.crear(dto)
```

| Archivo (`src/dtos/`) | DTOs | Endpoints |
|---|---|---|
| `auth.dto.ts` | `LoginDto` | `POST /auth/login` |
| `alumno.dto.ts` | `CrearAlumnoDto`, `ActualizarAlumnoDto`, `CantidadClasesDto` | registro, `PUT`, `sumar-clases`/`restar-clases` |
| `administrador.dto.ts` | `CrearAdministradorDto`, `ActualizarAdministradorDto` | `POST`, `PUT` |
| `auto.dto.ts` | `CrearAutoDto`, `ActualizarAutoDto`, `CambiarActivoDto` | `POST`, `PUT`, `PATCH .../activo` |
| `profesor.dto.ts` | `CrearProfesorDto`, `CambiarNomApeDto` | `POST`, `nom-ape` |
| `calendarioSemanal.dto.ts` | `AgregarTramoDto`, `QuitarTramoDto`, `ReemplazarCalendarioDto` | disponibilidad del profesor **y** horario de la escuela |
| `clase.dto.ts` | `CrearClaseDto`, `ActualizarClaseDto` | `POST`, `PUT` |

Todos se apoyan en un helper: `validarCampos` (`src/utils/validacionCampos.ts`).

---

## El recorrido

### 1. El problema que resuelven

Antes, varios services recibían `req.body` (que es `any`) y se lo pasaban a
Mongoose casi sin revisar. Eso tenía consecuencias, todas comprobadas y
registradas en [`../inconsistencias.md`](../inconsistencias.md):

| Pedido | Qué pasaba |
|---|---|
| `POST /autos { ..., "color": "rojo" }` | 201: `color` se descartaba en silencio (I-04) |
| `PUT /autos/:id { "marca": 123 }` | 200: se guardaba `"123"`, porque Mongoose convierte los tipos (I-04) |
| `PUT /administradores/:id { "$set": { "password": "corta" } }` | 200: la contraseña quedaba **en texto plano** y la cuenta, bloqueada (I-45) |
| `POST /autos { "_id": "...", "createdAt": "2000-01-01" }` | 201 con el id y la fecha elegidos por el cliente (I-46) |
| `POST /horario-escuela/agregar { "dia": "martes" }` | 200: se guardaba un `null` y **todas las reservas del martes daban 500** (I-32) |

Todos tienen la misma causa: **nadie definía qué podía mandar el cliente**. El
DTO es esa definición.

### 2. Las dos partes de un DTO

`src/dtos/alumno.dto.ts:16` y `:50`:

```ts
// ① el TIPO: lo que el service va a recibir
export interface CrearAlumnoDto {
  email: string;
  password: string;
  nomApe: string;
}

// ② la FUNCIÓN que lo construye a partir del body, comprobando en runtime
export function aCrearAlumnoDto(body: unknown): CrearAlumnoDto {
  const datos = validarCampos(body, CAMPOS_ALUMNO, {
    ...SIN_CAMPOS_DE_MAS,
    ayudaPorCampo: AYUDA_SALDO,
  });

  return {
    email: exigido(datos.email, 'El email es obligatorio'),
    password: exigido(datos.password, 'La contraseña es obligatoria'),
    nomApe: exigido(datos.nomApe, 'El nombre y apellido es obligatorio'),
  };
}
```

Hace falta tener las dos partes porque **los tipos de TypeScript no existen al
ejecutar** (ver [`02-typescript-en-el-proyecto.md`](02-typescript-en-el-proyecto.md)).
El tipo le dice al compilador qué recibe el service, y la función es la que
**de verdad** comprueba los datos que llegan.

La convención de nombres es `aXDto(body)`: "convertir a XDto".

### 3. `validarCampos`: la tabla de campos

Cada DTO declara una tabla con los campos del contrato, el tipo de cada uno y
cómo nombrarlo en los mensajes (`src/dtos/auto.dto.ts:33`):

```ts
const CAMPOS_DATOS_AUTO = {
  marca:   { tipo: 'string', nombre: 'La marca' },
  modelo:  { tipo: 'string', nombre: 'El modelo' },
  patente: { tipo: 'string', nombre: 'La patente' },
  cambios: { tipo: 'string', nombre: 'El tipo de cambios' },
} as const;
```

`validarCampos(body, tabla, opciones)` (`src/utils/validacionCampos.ts:89`)
la recorre en cuatro pasos:

```
body
 ├─ ① ¿es un objeto?                       no → 400 "El cuerpo de la petición debe ser un objeto JSON"
 ├─ ② ¿todas las claves están en la tabla? no → 400 "No se pueden enviar estos campos: color, _id"
 ├─ ③ ¿cada valor es del tipo de la tabla? no → 400 "La marca debe ser un texto"
 └─ ④ arma un objeto NUEVO, solo con los campos de la tabla
```

El paso ④ es la clave de la seguridad. El service nunca recibe el body
original, sino una copia que solo tiene campos de la tabla. Un `$set`, un `_id`
o un `createdAt` **no pueden llegar a la base**, porque no están en la tabla.

Tipos que admite la tabla:

| `tipo` | Acepta | Ejemplo |
|---|---|---|
| `'string'` / `'number'` / `'boolean'` | Ese tipo exacto: `"2"` no es un número | `nomApe`, `cantidad`, `activo` |
| `'objeto'` | Un `{...}`, ni `null` ni un array | `tramo` |
| `'lista'` | Un `[...]` | los días del calendario |

Las tres opciones:

| Opción | Para qué | Ejemplo |
|---|---|---|
| `mensajeNoPermitidos` | El comienzo del mensaje del paso ② | `'No se pueden modificar estos campos'` |
| `alMenosUno` | Rechazar `{}` en las actualizaciones | "Debe indicarse al menos un campo para actualizar" |
| `ayudaPorCampo` | Una pista si mandan un campo conocido que no va | `clasesPorReservar` → "(el saldo de clases se cambia con sumar-clases / restar-clases)" |

Casi todos los DTO usan una de dos combinaciones, así que `validacionCampos.ts`
las exporta ya armadas:

| Constante | Opciones | Se usa en |
|---|---|---|
| `SIN_CAMPOS_DE_MAS` | `mensajeNoPermitidos: 'No se pueden enviar estos campos'` | Altas y pedidos de un solo dato (login, `cantidad`, `activo`, un tramo) |
| `AL_MODIFICAR` | `mensajeNoPermitidos: 'No se pueden modificar estos campos'`, `alMenosUno: true` | Los `PUT` |

Si un DTO necesita además `ayudaPorCampo`, la suma con *spread*:
`{ ...AL_MODIFICAR, ayudaPorCampo: AYUDA_SALDO }`. Así el mensaje se escribe
en un solo lugar, y todos los DTO lo dicen igual.

### 4. Campos obligatorios: `exigido`

`validarCampos` devuelve todos los campos como **opcionales**, porque la misma
tabla sirve para crear y para editar. Cuando un DTO **promete** que un campo
está, lo exige con `exigido` (`validacionCampos.ts:132`):

```ts
export function exigido<T>(valor: T | undefined, mensaje: string): T {
  if (valor === undefined) throw new ErrorDeNegocio(mensaje);
  return valor;
}

patente: exigido(datos.patente, 'La patente es obligatoria'),   // string | undefined → string
```

Hace dos cosas: responde 400 con el mensaje del campo, y le avisa a
TypeScript que, si no lanzó el error, el valor ya no es `undefined`. Por eso el
`return` cumple el tipo `CrearAutoDto` sin ningún `as`.

### 5. Crear y actualizar: la misma tabla, otro contrato

```ts
export type ActualizarAlumnoDto = Partial<CrearAlumnoDto>;   // cualquiera de los campos

export function aActualizarAlumnoDto(body: unknown): ActualizarAlumnoDto {
  // AL_MODIFICAR: "No se pueden modificar estos campos" y al menos uno
  return validarCampos(body, CAMPOS_ALUMNO, { ...AL_MODIFICAR, ayudaPorCampo: AYUDA_SALDO });
}
```

Algunos recursos tienen contratos distintos para cada operación. En autos,
`activo` se acepta al crear, porque un auto puede nacer fuera de servicio,
pero **no** al editar: tiene su propia ruta (`src/dtos/auto.dto.ts:67`).

```ts
export type ActualizarAutoDto = Partial<Omit<CrearAutoDto, 'activo'>>;
// PUT /autos/:id { "activo": false }
// → 400 "No se pueden modificar estos campos: activo (el estado se cambia con PATCH /autos/:id/activo)"
```

### 6. Un contrato que depende del rol: clases

Un alumno reserva **para sí mismo**, así que no puede mandar `alumno`. Un admin
reserva **para otro**, así que tiene que mandarlo. Por eso la función recibe el
rol (`src/dtos/clase.dto.ts:60`):

```ts
export function aCrearClaseDto(body: unknown, rol: Rol): CrearClaseDto {
  let reserva: CrearClaseDto;

  if (rol === 'administrador') {
    const datos = validarCampos(body, CAMPOS_RESERVA_ADMIN, SIN_CAMPOS_DE_MAS);   // con "alumno"
    reserva = { ...reservaDe(datos), alumno: exigido(datos.alumno, 'El alumno es obligatorio') };
  } else {
    reserva = reservaDe(validarCampos(body, CAMPOS_RESERVA, SIN_CAMPOS_DE_MAS));  // sin "alumno"
  }

  return reserva;
}
```

En el controller: `aCrearClaseDto(req.body, actor.rol)`.

### 7. Un DTO compartido: el calendario semanal

El horario de la escuela y la disponibilidad de un profesor tienen **la misma
forma**, un `CalendarioSemanal`. Por eso agregar y quitar un tramo usan los
mismos DTO, igual que comparten `calendarioSemanal.service`:

```
src/dtos/calendarioSemanal.dto.ts
   aAgregarTramoDto  ◄── horarioEscuela.controller.agregar   y   profesor.controller.agregarDisponibilidad
   aQuitarTramoDto   ◄── horarioEscuela.controller.quitar    y   profesor.controller.quitarDisponibilidad
   aReemplazarCalendarioDto ◄── horarioEscuela.controller.reemplazar
```

`aReemplazarCalendarioDto` (`:91`) hace un chequeo más: exige los 7 días, y
que **cada elemento** de cada lista sea un objeto. Un `"lunes": [null]` se
guardaba tal cual y rompía las reservas de ese día.

### 8. Forma en el DTO, reglas en el service y en el esquema

El DTO **no** reemplaza al service: cada capa valida una cosa distinta.

| | DTO (forma) | Service (reglas) | Esquema (dato) |
|---|---|---|---|
| Alumno | Campos, texto, obligatorios; `cantidad` número | Saldo inicial 0; `cantidad` entera y > 0 | Formato del email, unique |
| Auto | Campos, tipos, patente y cambios obligatorios | — | Valores de `cambios` (enum), unique de la patente |
| Profesor | `nomApe` texto | Nombre no vacío | — |
| Tramo | `dia` texto, `tramo` objeto | Que el día exista (`validarDia`) | Horas 0–23, fin > inicio |
| Clase | Campos según el rol, todos texto | Ids válidos, fecha ISO, 1 hora, horario, saldo | Fin > inicio |
| Login | Email y contraseña texto | No vacíos; credenciales (401) | — |

Una forma práctica de decidir dónde va cada cosa: **si para comprobarlo hay
que mirar el valor o la base, es una regla.** "Es un texto" es forma. "Es un
email válido", "existe ese día" o "el auto está libre" son reglas.

### 9. El service confía en el tipo

```ts
// src/services/auto.service.ts
export async function crear(datos: CrearAutoDto): Promise<AutoDoc> { ... }
```

El service ya no revisa la forma: recibe un `CrearAutoDto` y confía. Esa
confianza tiene un límite, porque el tipo **solo existe al compilar**:

- Si alguien escribe `autoService.crear(req.body)` sin pasar por el DTO,
  **compila igual**: `req.body` es `any`, y un `any` se puede pasar donde sea.
- Un `as` también saltea el chequeo.

Por eso la regla es que **todo body pase por su DTO en el controller**. Los
scripts que llaman a un service directamente, como `admin:desde-env`, arman el
objeto ellos mismos, y el esquema sigue validando lo obligatorio y los
formatos.

### 10. Probar un DTO

Un DTO es una función pura: no necesita base de datos ni HTTP
(`tests/dtos/`):

```ts
it('rechaza activo, con la pista de dónde se cambia el estado', () => {
  expect(() => aActualizarAutoDto({ activo: false })).toThrow(
    'No se pueden modificar estos campos: activo (el estado se cambia con PATCH /autos/:id/activo)',
  );
});
```

Los tests de los services quedan para las **reglas**. Además, TypeScript ya
no deja pasarle al service un objeto con la forma incorrecta. La carpeta
`09 Validación de campos y tipos` de Postman prueba lo mismo por HTTP, un caso
por endpoint (ver [`12-tests-postman.md`](12-tests-postman.md)).

### 11. Receta: agregar un DTO para un endpoint nuevo

1. En `src/dtos/<recurso>.dto.ts`, declarar el **tipo** (`interface XDto`) y
   la **tabla** de campos (`as const`).
2. Escribir `aXDto(body: unknown): XDto`: `validarCampos` con
   `SIN_CAMPOS_DE_MAS` (alta) o `AL_MODIFICAR` (actualización), y `exigido`
   para cada obligatorio.
3. En el controller, `service.operacion(aXDto(req.body))`.
4. En el service, recibir `XDto` y dejar solo las reglas.
5. Agregar el test en `tests/dtos/` y un caso en la carpeta `09` de Postman.

---

## Los mensajes

Todos los DTO responden con el mismo formato (400 en todos los casos):

| Problema | Mensaje |
|---|---|
| El body no es un objeto | "El cuerpo de la petición debe ser un objeto JSON" |
| Campo que no es del contrato, al crear | "No se pueden enviar estos campos: color, _id" |
| Campo que no es del contrato, al editar | "No se pueden modificar estos campos: rol" |
| Tipo incorrecto | "La marca debe ser un texto" / "La cantidad debe ser un número" / "El campo activo debe ser verdadero o falso" / "El tramo debe ser un objeto" / "El lunes debe ser una lista" |
| Falta un obligatorio | "La patente es obligatoria" |
| Edición vacía | "Debe indicarse al menos un campo para actualizar" |

---

## Qué puede salir mal

| Síntoma | Causa |
|---|---|
| Un campo nuevo del modelo responde "No se pueden enviar estos campos" | Falta agregarlo a la tabla del DTO. El DTO es el contrato: si no está ahí, el cliente no lo puede mandar. |
| Un body con campos de más se guarda sin error | El controller le pasó `req.body` al service sin pasar por el DTO (compila porque `req.body` es `any`). |
| `"2"` es rechazado aunque "es un número" | En JSON los números van sin comillas. El DTO no convierte tipos: es justamente lo que evita. |
| TypeScript no deja asignar el resultado al tipo del DTO | Falta un `exigido` para un campo obligatorio: `validarCampos` los devuelve todos opcionales. |
| Un mensaje dice "debe ser un texto" pero el problema es el formato | Es lo esperado: el DTO solo mira la forma. El formato (email, fecha, id) lo valida la regla del service o del esquema, con su propio mensaje. |

---

## Resumen

- Un DTO es el **contrato de una operación**: un tipo de TypeScript, más una
  función `aXDto(body)` que lo comprueba al ejecutar.
- `validarCampos` rechaza los campos que no son del contrato y los tipos
  incorrectos, y devuelve un **objeto nuevo**: por eso un `$set` o un `_id` no
  llegan nunca a la base. `exigido` hace obligatorio un campo.
- El **controller** arma el DTO, y el **service** recibe datos tipados y se
  queda con las **reglas**. El **esquema**, con las validaciones del dato.
- El tipo del DTO solo protege al compilar. Por eso todo body tiene que pasar
  por su DTO en el controller.

**Siguiente lectura:** [`07-services.md`](07-services.md).
