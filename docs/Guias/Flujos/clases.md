# Flujo de Asignación y Eliminación de Clases

Esta guía describe exhaustivamente el ciclo de vida de las **clases prácticas de manejo** en **DriveAndLearn**, detallando el proceso de reserva (*agendamiento*), la política de cancelación y restitución de saldo, el control de acceso basado en roles (RBAC), el desacoplamiento entre servicios y el funcionamiento del motor de **calendarización** en hora local con **Luxon** mediante [turnosYFechasHelper.js](file:///home/wolf753/Proyectos/sandbox-docker/agy-env/INSPT-Prog3-DriveAndLearn-backend/src/services/helpers/turnosYFechasHelper.js).

---

## 1. Visión General y Reglas de Negocio

Una clase práctica representa una sesión de instrucción de manejo de **exactamente 1 hora en punto** que coordina tres recursos fundamentales del sistema:
- Un **Alumno** (quien toma la clase y consume un crédito de su saldo prepago).
- Un **Profesor** (quien imparte la clase según su disponibilidad semanal).
- Un **Auto** de la flota (vehículo asignado para la práctica).

```mermaid
flowchart TD
    subgraph Recursos["Recursos Coordinados"]
        A["Alumno<br/>(Saldo >= 1)"]
        P["Profesor<br/>(Disponible en horario)"]
        V["Auto<br/>(Libre en horario)"]
    end

    subgraph ClasePractica["Clase Práctica (1 Hora en Punto)"]
        C["Clase<br/>{ alumno, profesor, auto, inicio, fin }"]
    end

    A --> C
    P --> C
    V --> C
```

### 1.1. Principios Clave de Diseño

1. **Almacenamiento en Hora Local (Sin Desplazamiento UTC):**
   - Los campos `inicio` y `fin` se almacenan en MongoDB como `String` en formato ISO local: **`"YYYY-MM-DDTHH:00"`** (ej. `"2026-11-20T10:00"` a `"2026-11-20T11:00"`).
   - Evita desfasajes arbitrarios provocados por conversiones a UTC o cambios de huso horario/horario de verano.
   - Preserva el orden cronológico directo en comparaciones lexicográficas y optimiza consultas directas por día con prefijo regex (`^YYYY-MM-DDT`).
2. **Duración Fija y Fechas Futuras:**
   - Toda clase dura obligatoriamente **60 minutos exactos** (`DURACION_CLASE_HORAS = 1`).
   - La fecha y hora de inicio debe ser estrictamente posterior al momento actual (`verificarFechaFutura`). Está prohibido agendar clases en el pasado o presente inmediato.
3. **Aislamiento e Inyección de Identidad (Seguridad):**
   - El cliente **no envía** el campo `alumno` en el cuerpo JSON de la petición.
   - El DTO `validarAgendarClaseDTO` rechaza explícitamente el campo `alumno` para impedir suplantación de identidad.
   - El controlador inyecta el ID verificado a partir del token JWT (`req.usuario.id`).
4. **Desacoplamiento Absoluto entre Servicios (SRP):**
   - [claseService.js](file:///home/wolf753/Proyectos/sandbox-docker/agy-env/INSPT-Prog3-DriveAndLearn-backend/src/services/claseService.js) **no interactúa directamente** con los modelos Mongoose `Alumno`, `Profesor` ni `Auto`.
   - Toda verificación de existencia física, disponibilidad semanal o modificación de saldo se delega a [alumnoService.js](file:///home/wolf753/Proyectos/sandbox-docker/agy-env/INSPT-Prog3-DriveAndLearn-backend/src/services/alumnoService.js), [profesorService.js](file:///home/wolf753/Proyectos/sandbox-docker/agy-env/INSPT-Prog3-DriveAndLearn-backend/src/services/profesorService.js) y [autoService.js](file:///home/wolf753/Proyectos/sandbox-docker/agy-env/INSPT-Prog3-DriveAndLearn-backend/src/services/autoService.js).
5. **Transaccionalidad Lógica de Créditos:**
   - Agendar una clase resta de inmediato `1` crédito del `saldoClases` del alumno mediante `alumnoService.restarSaldoClases`.
   - Cancelar una clase reintegra de inmediato `1` crédito al alumno mediante `alumnoService.sumarSaldoClases`.

---

## 2. Modelo de Datos Mongoose (`Clase.js`)

El modelo `Clase` ([src/models/Clase.js](file:///home/wolf753/Proyectos/sandbox-docker/agy-env/INSPT-Prog3-DriveAndLearn-backend/src/models/Clase.js)) define la persistencia de las reservas en la colección `clases`:

```javascript
const claseSchema = new mongoose.Schema(
  {
    alumno: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Alumno',
      required: [true, 'El alumno es obligatorio'],
    },
    profesor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profesor',
      required: [true, 'El profesor es obligatorio'],
    },
    auto: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Auto',
      required: [true, 'El auto es obligatorio'],
    },
    inicio: {
      type: String,
      required: [true, 'La fecha y hora de inicio son obligatorias'],
      trim: true,
      match: [
        /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d$/,
        'El inicio debe tener un formato válido YYYY-MM-DDTHH:MM',
      ],
    },
    fin: {
      type: String,
      required: [true, 'La fecha y hora de fin son obligatorias'],
      trim: true,
      match: [
        /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d$/,
        'El fin debe tener un formato válido YYYY-MM-DDTHH:MM',
      ],
    },
  },
  {
    timestamps: true,
    collection: 'clases',
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);
```

> [!NOTE]
> Al serializar a JSON, la configuración `toJSON` de Mongoose elimina automáticamente la propiedad interna `__v` manteniendo inalterado el identificador canónico `_id`.

---

## 3. Arquitectura en Capas y Desacoplamiento

El caso de uso de agendamiento y cancelación involucra múltiples subsistemas coordinados por `claseService`:

```mermaid
flowchart TD
    Route["claseRoutes.js<br/>(/api/clases)"]
    Auth["authMiddleware.js<br/>(autenticar)"]
    DTO["claseDTO.js<br/>(validarAgendarClaseDTO)"]
    Ctrl["claseController.js"]
    Svc["claseService.js"]

    MClase["Modelo Propio: Clase<br/>(MongoDB colección clases)"]
    SAlum["alumnoService.js<br/>(obtenerPorId, restar/sumarSaldoClases)"]
    SProf["profesorService.js<br/>(obtenerPorId)"]
    SAuto["autoService.js<br/>(obtenerPorId)"]
    HTurnos["turnosYFechasHelper.js<br/>(validarIntervalo, estaDentroDeDisponibilidad, verificarSuperposiciones)"]

    Route --> Auth --> Ctrl
    Ctrl --> DTO
    Ctrl --> Svc
    Svc --> MClase
    Svc --> SAlum
    Svc --> SProf
    Svc --> SAuto
    Svc --> HTurnos
```

---

## 4. Flujo de Asignación / Agendamiento (`agendar`)

El agendamiento orquesta un conjunto riguroso de reglas de negocio antes de persistir cualquier cambio en la base de datos.

### 4.1. Contrato HTTP

- **Método y Ruta:** `POST /api/clases`
- **Autenticación Requerida:** Sí (`Bearer <token_jwt>`)
- **Rol Autorizado:** `alumno` (para sí mismo)
- **Cuerpo JSON Enviado por el Cliente:**
  ```json
  {
    "profesor": "6727be05a3e14f828a2b5e01",
    "auto": "6727be05a3e14f828a2b5e02",
    "inicio": "2026-11-20T10:00",
    "fin": "2026-11-20T11:00"
  }
  ```

> [!IMPORTANT]
> **El campo `alumno` está prohibido en el JSON de entrada:**
> Si un cliente envía `"alumno": "..."` en el cuerpo de la solicitud, `validarAgendarClaseDTO` arroja de inmediato `ErrorCampoInvalido('Campos no permitidos: alumno')` (**`400 Bad Request`**).
> La identidad del alumno se inyecta de forma segura en [claseController.js](file:///home/wolf753/Proyectos/sandbox-docker/agy-env/INSPT-Prog3-DriveAndLearn-backend/src/controllers/claseController.js#L26-L34):
> ```javascript
> const datosClase = { ...req.body, alumno: req.usuario?.id };
> ```

---

### 4.2. Diagrama de Secuencia de Agendamiento

```mermaid
sequenceDiagram
    autonumber
    actor Alumno as Alumno Autenticado
    participant Route as claseRoutes
    participant Ctrl as claseController
    participant DTO as claseDTO
    participant Svc as claseService
    participant HTurnos as turnosYFechasHelper
    participant SAlum as alumnoService
    participant SProf as profesorService
    participant SAuto as autoService
    participant MClase as Modelo Clase

    Alumno->>Route: POST /api/clases (Bearer token)
    Route->>Ctrl: agendar(req, res)
    Ctrl->>DTO: validarAgendarClaseDTO(req.body)
    DTO-->>Ctrl: OK (valida profesor, auto, inicio, fin)
    Note over Ctrl: Inyecta alumno: req.usuario.id
    Ctrl->>Svc: agendar(datosClase, req.usuario)

    Note over Svc: 1. Valida ObjectIds de alumno, profesor y auto
    Note over Svc: 2. verificarPermisoAgendamiento (solo alumno para sí mismo)
    
    Svc->>HTurnos: verificarFechaFutura(inicio)
    HTurnos-->>Svc: OK (es fecha futura)
    Svc->>HTurnos: validarIntervaloDeClase(inicio, fin)
    HTurnos-->>Svc: OK (duración = 1 hora en punto)

    Note over Svc: 3. Verificar existencia física de entidades
    Svc->>SAlum: obtenerPorId(alumnoId)
    SAlum-->>Svc: alumno (o lanza 404)
    Svc->>SProf: obtenerPorId(profesorId)
    SProf-->>Svc: profesor (o lanza 404)
    Svc->>SAuto: obtenerPorId(autoId)
    SAuto-->>Svc: auto (o lanza 404)

    Note over Svc: 4. Verificar saldo suficiente (saldoClases >= 1)
    
    Note over Svc: 5. Disponibilidad semanal del profesor
    Svc->>HTurnos: estaDentroDeDisponibilidad(profesor.disponibilidad, inicio, fin)
    HTurnos-->>Svc: true (dentro de tramo semanal proyectado)

    Note over Svc: 6. Verificar ausencia de superposiciones (overlap)
    par Consultas paralelas con crearFiltroSuperposicion
        Svc->>MClase: exists({ alumno, inicio < fin, fin > inicio })
        Svc->>MClase: exists({ profesor, inicio < fin, fin > inicio })
        Svc->>MClase: exists({ auto, inicio < fin, fin > inicio })
    end
    MClase-->>Svc: Ninguno colisiona

    Note over Svc: 7. Débito de saldo y persistencia
    Svc->>SAlum: restarSaldoClases(alumnoId, { cantidad: 1 })
    SAlum-->>Svc: alumno con saldo descontado
    Svc->>MClase: create({ alumno, profesor, auto, inicio, fin })
    MClase-->>Svc: documento claseCreada

    Svc-->>Ctrl: claseCreada
    Ctrl-->>Alumno: 201 Created (JSON de la clase)
```

---

### 4.3. Las 7 Reglas de Negocio en la Asignación

Para consolidar una reserva, el servicio ejecuta la siguiente secuencia inquebrantable:

| Orden | Regla de Negocio | Función Responsable | Excepción en Caso de Fallo |
| :---: | :--- | :--- | :--- |
| **1** | **Validación Sintáctica de IDs:** `alumno`, `profesor` y `auto` deben cumplir con el formato ObjectId de Mongoose. | `validarMongooseObjId` | `ErrorMongooseObjIdInvalido` (`400`) |
| **2** | **Autorización del Solicitante:** Solo un usuario con rol `alumno` puede agendar para sí mismo (`usuarioActual.id === alumnoId`). Un administrador u otro alumno no tienen permitido agendar clases en esta etapa. | `verificarPermisoAgendamiento` | `ErrorAutorizacion` (`403`) |
| **3** | **Fecha Futura e Integridad Horaria:** La fecha/hora de inicio debe ser estrictamente posterior a `DateTime.now()` y durar exactamente 1 hora en punto (`:00`). | `verificarFechaFutura`<br/>`validarIntervaloDeClase` | `ErrorDeNegocio` (`400`)<br/>`ErrorFormatoDeFecha` (`400`) |
| **4** | **Existencia Física de Entidades (SRP):** Alumno, profesor y auto deben existir previamente en MongoDB (verificados a través de sus respectivos servicios). | `verificarEntidadesExistentes` | `ErrorRegistroInexistente` (`404`) |
| **5** | **Saldo Disponible:** El alumno debe poseer al menos `1` clase en `saldoClases`. | `verificarSaldoSuficiente` | `ErrorSaldoClasesInsuficiente` (`400`) |
| **6** | **Disponibilidad Semanal del Profesor:** El horario solicitado debe estar totalmente contenido en la disponibilidad semanal del docente, evaluado con `bloque.engulfs(intervaloClase)` sobre una ventana de 3 días. | `verificarDisponibilidadProfesor`<br/>(`estaDentroDeDisponibilidad`) | `ErrorDeNegocio` (`400`) |
| **7** | **Ausencia de Superposiciones (Overlap):** Ni el alumno, ni el profesor, ni el vehículo pueden tener otra clase activa en ese intervalo de tiempo. | `verificarSuperposiciones`<br/>(`crearFiltroSuperposicion`) | `ErrorDeNegocio` (`400`) |

---

## 5. Flujo de Cancelación y Eliminación (`eliminar`)

La cancelación permite liberar los recursos asignados (profesor y auto) y restituir automáticamente el crédito de saldo al alumno.

### 5.1. Contrato HTTP

- **Método y Ruta:** `DELETE /api/clases/:id`
- **Autenticación Requerida:** Sí (`Bearer <token_jwt>`)
- **Roles Autorizados:**
  - `alumno`: Solo si la clase le pertenece (`clase.alumno.toString() === usuarioActual.id`).
  - `administrador`: Puede cancelar cualquier clase del sistema.

### 5.2. Diagrama de Secuencia de Cancelación

```mermaid
sequenceDiagram
    autonumber
    actor Actor as Alumno o Administrador
    participant Route as claseRoutes
    participant Ctrl as claseController
    participant Svc as claseService
    participant SAlum as alumnoService
    participant MClase as Modelo Clase

    Actor->>Route: DELETE /api/clases/:id (Bearer token)
    Route->>Ctrl: eliminar(req, res)
    Ctrl->>Svc: eliminar(id, req.usuario)

    Note over Svc: 1. validarMongooseObjId(id)
    Svc->>MClase: findById(id)
    MClase-->>Svc: documento clase (o null)
    
    alt Si la clase no existe
        Note over Svc: Lanza ErrorRegistroInexistente (404)
    end

    Note over Svc: 2. verificarActorValido(clase.alumno, usuarioActual)
    alt Si el actor es Alumno pero la clase pertenece a otro alumno
        Note over Svc: Lanza ErrorAutorizacion (403)
    end

    Note over Svc: 3. Reintegro de saldo al alumno
    Svc->>SAlum: sumarSaldoClases(clase.alumno, { cantidad: 1 })
    SAlum-->>Svc: alumno actualizado (saldo + 1)

    Note over Svc: 4. Eliminación física del registro
    Svc->>MClase: findByIdAndDelete(id)
    MClase-->>Svc: documento eliminado

    Svc-->>Ctrl: clase
    Ctrl-->>Actor: 200 OK (JSON de la clase eliminada)
```

### 5.3. Reutilización de Validación con `verificarActorValido`

Para garantizar el cumplimiento estricto de los permisos de acceso tanto en `eliminar` como en `obtenerPorId`, se encapsula la validación en una función auxiliar privada:

```javascript
function verificarActorValido(
  alumnoIdClase,
  usuarioActual,
  mensaje = 'No tiene permisos para acceder a esta clase'
) {
  if (
    usuarioActual?.rol === ROLES.ALUMNO &&
    alumnoIdClase.toString() !== usuarioActual?.id?.toString()
  ) {
    throw new ErrorAutorizacion(mensaje);
  }
}
```

---

## 6. Flujos de Consulta y Lectura

### 6.1. Listado de Clases (`listar`)

- **Ruta:** `GET /api/clases`
- **Comportamiento según Rol:**
  - **Si el actor es `ALUMNO`:** El servicio fuerza internamente el filtro `{ alumno: usuarioActual.id }`. Un alumno **nunca puede ver clases de otros compañeros**.
  - **Si el actor es `ADMINISTRADOR`:** Puede visualizar la totalidad de las clases agendadas y aplicar filtros opcionales recibidos por query parameters (`req.query`).

### 6.2. Detalle de Clase (`obtenerPorId`)

- **Ruta:** `GET /api/clases/:id`
- **Comportamiento:**
  - Valida el `id` con `validarMongooseObjId`.
  - Si la clase no existe, devuelve `null` y el controlador responde `404 Not Found` (`{ "mensaje": "Clase no encontrada" }`).
  - Si la clase existe:
    - Aplica `verificarActorValido`: si quien consulta es un alumno y la clase pertenece a otro alumno, arroja `ErrorAutorizacion` (**`403 Forbidden`**).
    - Si es el propio alumno o un administrador, responde `200 OK` con el documento completo.

---

## 7. Calendarización: Evaluación de Disponibilidad y Superposición

El agendamiento depende críticamente de dos comprobaciones temporales provistas por [turnosYFechasHelper.js](file:///home/wolf753/Proyectos/sandbox-docker/agy-env/INSPT-Prog3-DriveAndLearn-backend/src/services/helpers/turnosYFechasHelper.js):

### 7.1. Comprobación de Disponibilidad Semanal (`estaDentroDeDisponibilidad`)

```mermaid
flowchart LR
    C["Clase Solicitada<br/>Lunes 10:00 - 11:00"]
    D["Disponibilidad del Profesor (Lunes)<br/>[08:00 ----------------------- 14:00]"]

    D -- "engulfs (cubre totalmente)" --> C
```

1. La clase solicita un intervalo puntual (ej. lunes de `10:00` a `11:00`).
2. Se extrae el día de la semana correspondiente a esa fecha mediante `DateTime.weekday` y `MAPA_WEEKDAY_DIA`.
3. Se proyecta la disponibilidad semanal del profesor sobre una **ventana de 3 días** (`[diaAnterior, diaActual, diaSiguiente]`) utilizando `Interval.merge()` vía `proyectarDisponibilidadEnVentana`.
4. Se verifica si el intervalo de la clase queda totalmente contenido (`bloque.engulfs(intervaloClase)`) dentro de algún tramo unificado del profesor. Si no está cubierto, la solicitud es rechazada con `ErrorDeNegocio`.

### 7.2. Comprobación de Conflictos de Horario con `crearFiltroSuperposicion`

Para verificar que ninguna entidad tenga solapamientos temporales con otras clases ya agendadas, se construye la consulta de MongoDB mediante `crearFiltroSuperposicion`:

```javascript
// turnosYFechasHelper.js
export function crearFiltroSuperposicion(inicio, fin, filtroBase = {}) {
  return {
    ...filtroBase,
    inicio: { $lt: fin },
    fin: { $gt: inicio },
  };
}
```

En [claseService.js](file:///home/wolf753/Proyectos/sandbox-docker/agy-env/INSPT-Prog3-DriveAndLearn-backend/src/services/claseService.js#L95-L99), se ejecutan las tres comprobaciones en paralelo con `Promise.all`:

```javascript
const [claseAlumno, claseProfesor, claseAuto] = await Promise.all([
  Clase.exists(crearFiltroSuperposicion(inicio, fin, { alumno: alumnoId })),
  Clase.exists(crearFiltroSuperposicion(inicio, fin, { profesor: profesorId })),
  Clase.exists(crearFiltroSuperposicion(inicio, fin, { auto: autoId })),
]);
```

- Si `claseAlumno` existe $\rightarrow$ *"El alumno ya posee una clase agendada en ese horario"*
- Si `claseProfesor` existe $\rightarrow$ *"El profesor ya posee una clase asignada en ese horario"*
- Si `claseAuto` existe $\rightarrow$ *"El auto seleccionado ya se encuentra asignado a otra clase en ese horario"*

---

## 8. Matriz de Errores y Códigos de Respuesta HTTP

| Causa del Rechazo | Tipo de Error | Código HTTP | Mensaje de Respuesta |
| :--- | :--- | :---: | :--- |
| Enviar campo `alumno` en el cuerpo JSON | `ErrorCampoInvalido` | `400` | `"Campos no permitidos: alumno"` |
| Enviar tipos no string en `profesor`, `auto`, etc. | `ErrorDeTipo` | `400` | `"Tipos de datos incorrectos en: ..."` |
| ID con formato Mongoose inválido | `ErrorMongooseObjIdInvalido` | `400` | `"El id proporcionado no es un ObjectId válido de Mongoose"` |
| Alumno inexistente en MongoDB | `ErrorRegistroInexistente` | `404` | `"El alumno solicitado no existe"` |
| Profesor inexistente en MongoDB | `ErrorRegistroInexistente` | `404` | `"El profesor solicitado no existe"` |
| Auto inexistente en MongoDB | `ErrorRegistroInexistente` | `404` | `"El auto solicitado no existe"` |
| Saldo de clases insuficiente (`saldoClases < 1`) | `ErrorSaldoClasesInsuficiente` | `400` | `"El alumno no posee saldo de clases suficiente para agendar"` |
| Alumno intentando agendar para otro alumno | `ErrorAutorizacion` | `403` | `"Solo un alumno puede agendar clases para sí mismo"` |
| Administrador intentando agendar | `ErrorAutorizacion` | `403` | `"Solo un alumno puede agendar clases para sí mismo"` |
| Intentar agendar en fecha u hora pasada | `ErrorDeNegocio` | `400` | `"No se pueden agendar clases en fechas u horarios pasados"` |
| Fecha u hora no en punto (ej. `"10:30"`) | `ErrorFormatoDeFecha` | `400` | `"La fecha y hora de la clase debe tener el formato YYYY-MM-DDTHH:00 en punto"` |
| Duración distinta a 1 hora (ej. 2 horas) | `ErrorDeNegocio` | `400` | `"La clase debe durar exactamente 1 hora"` |
| Fuera de la disponibilidad semanal del profesor | `ErrorDeNegocio` | `400` | `"El horario seleccionado no se encuentra dentro de la disponibilidad del profesor"` |
| Superposición de horario en el alumno | `ErrorDeNegocio` | `400` | `"El alumno ya posee una clase agendada en ese horario"` |
| Superposición de horario en el profesor | `ErrorDeNegocio` | `400` | `"El profesor ya posee una clase asignada en ese horario"` |
| Superposición de horario en el vehículo | `ErrorDeNegocio` | `400` | `"El auto seleccionado ya se encuentra asignado a otra clase en ese horario"` |
| Alumno intentando cancelar clase ajena | `ErrorAutorizacion` | `403` | `"No tiene permisos para eliminar esta clase"` |
| Clase a eliminar no encontrada | `ErrorRegistroInexistente` | `404` | `"La clase solicitada no existe"` |
| Clase a consultar por ID no encontrada | Retorno `null` | `404` | `"Clase no encontrada"` |
