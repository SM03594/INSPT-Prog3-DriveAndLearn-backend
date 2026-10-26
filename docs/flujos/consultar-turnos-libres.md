# Flujo: consultar los turnos libres de un profesor

## Qué es esto, en una frase

Antes de reservar, un alumno (o un admin) manda
`POST /api/profesores/:id/turnos-libres` con un día y, si quiere, el tipo de
auto y un rango de horas. La API cruza el horario de la escuela, la
disponibilidad del profesor y las clases ya reservadas, y devuelve los turnos
de una hora en los que se puede reservar, cada uno con los autos libres para
elegir.

> Todas las respuestas de esta guía son **salidas reales** de la API, con el
> escenario de abajo cargado en una base en memoria. El plan con todas las
> decisiones está en [`../plan-turnos-libres.txt`](../plan-turnos-libres.txt).

Resolvió I-20 ("No hay forma de consultar turnos libres") de
[`../inconsistencias.md`](../inconsistencias.md).

---

## Antes de consultar: las normas que el endpoint da por hechas

La consulta se apoya en cinco reglas de la reserva para no ofrecer nunca un
turno que `POST /api/clases` vaya a rechazar:

| Norma | Qué dice | Qué le aporta a la consulta |
|---|---|---|
| N1 | El alumno reserva para sí mismo; el admin, para el alumno que indique | La consulta no recibe `alumno` para ningún rol |
| N2 | Un alumno no puede tener dos clases a la misma hora | Si consulta un alumno, se sacan sus horarios ocupados |
| N3 | Toda clase empieza en una hora en punto y dura exactamente 1 h | Los turnos salen siempre en punto: 09, 10, 11… |
| N4 | Los tramos de la escuela y del profesor empiezan y terminan en punto | Las ventanas libres también son en punto |
| N5 | La hora de la escuela se define con `OFFSET_HORA_UTC` en el `.env` (`-3` por defecto), única fuente de verdad | Consulta y reserva convierten las horas con la misma constante |

Cómo se representan los horarios y qué significa "caber en un tramo" se
explica en [`../temas/horarios-y-agendamiento.md`](../temas/horarios-y-agendamiento.md).

---

## El mapa

```
POST /api/profesores/:id/turnos-libres   Authorization: Bearer <token de Ana>
{ "fecha": "2026-11-09", "cambios": "MANUAL", "desde": "08:00", "hasta": "18:00" }
 │
 ▼ profesor.routes        requireAuthentication → validacionDeCuerpo           401 · 400
 ▼ profesor.controller    turnosLibres
 │   ① aConsultarTurnosDto        campos · fecha AAAA-MM-DD · H:MM · cambios    400
 │   ② extraerActor(req)          → Actor { id: Ana, rol: 'alumno' }
 ▼ turno.service.listarTurnosLibres
 │   ③ reglas del pedido          fecha no pasada · desde < hasta · rango ≥ 1 h 400
 │   ④ la cuenta                  ¿sigue existiendo?                            403
 │   ⑤ en paralelo                profesor · horario de la escuela · autos      400 · 404
 │   ⑥ el saldo                   solo si consulta un alumno                    409
 │   ⑦ ventanas                   tramo del profesor ∩ escuela ∩ desde/hasta
 │   ⑧ la grilla                  turnos de 1 h en punto · sin repetidos · sin los ya empezados
 │   ⑨ una sola consulta          clases que pisan esos turnos (profesor, alumno, autos)
 │   ⑩ autos libres               se sacan los turnos ocupados y los que no tienen auto
 ▼
200 { fecha, dia, turnos: [ { inicio, fin, autos: [...] } ] }
```

Nada se guarda ni se bloquea: la respuesta es una **foto del momento**.

---

## El escenario

Lunes 09/11/2026. La escuela abre de lunes a sábado de 08 a 20. El profesor
Juan trabaja los lunes de 09 a 13 y de 15 a 17. Autos: `AA111AA` y `BB222BB`
(manuales, activos), `CC333CC` (automático, activo) y `DD444DD` (automático,
fuera de servicio). Ana tiene saldo. Ese día ya hay tres clases:

```
              08   09   10   11   12   13   14   15   16   17   18
Escuela       ├────────────────────────────────────────────────────┤
Juan (prof.)       ├───────────────────┤         ├─────────┤
Juan + Beto                  [AA111AA]                               ← 11–12
Marta + Carla      [BB222BB]                                         ← 09–10 (otro profesor)
Ana + Marta                                      [CC333CC]           ← 15–16 (otro profesor)
```

---

## El recorrido

### Paso 1. La ruta: un POST que no crea nada

`src/routes/profesor.routes.ts:25`, junto a las demás rutas del profesor:

```ts
router.post('/:id/turnos-libres', validacionDeCuerpo, profesorController.turnosLibres);
```

- Sin `requireAdministrator`: pueden consultar alumnos y admins. El router ya
  aplica `requireAuthentication` a todas sus rutas (`profesor.routes.ts:17`).
- **¿Por qué POST si solo consulta?** Porque los datos van en un body JSON, y
  el navegador no permite un GET con body: `fetch` lanza *"Request with
  GET/HEAD method cannot have body"*. Responde **200**, no 201: no crea nada.
- Lleva `validacionDeCuerpo`: un pedido sin body responde
  400 *"La petición debe incluir un cuerpo JSON"* antes de llegar al controller.

### Paso 2. El controller

`src/controllers/profesor.controller.ts:102`:

```ts
export async function turnosLibres(req: Request<{ id: string }>, res: Response) {
  const idProfesor: string = req.params.id;
  const consulta: ConsultarTurnosDto = aConsultarTurnosDto(req.body);
  const actor: Actor = extraerActor(req);
  const turnos: TurnosLibres | null =
    await turnoService.listarTurnosLibres(idProfesor, consulta, actor);

  if (turnos === null) {
    res.status(404).json({ mensaje: 'Profesor no encontrado' });
  } else {
    res.json(turnos);
  }
}
```

Cada dato va en su constante, en el orden en que los recibe el service. El
DTO va antes que el actor, así que un body mal armado responde 400 antes de
mirar quién consulta. `extraerActor` (`src/utils/extraerActor.ts`) traduce
`req.auth` (`{ id, role }`) al `Actor { id, rol }` que entienden los services
(ver [`../capas/06-controllers.md`](../capas/06-controllers.md)).

### Paso 3. ① El DTO: la forma del pedido

`aConsultarTurnosDto` (`src/dtos/turno.dto.ts:50`) usa `validarCampos` con
`SIN_CAMPOS_DE_MAS`, y convierte cada texto con su `parsear…`:

| Campo | Obligatorio | Formato | Sale convertido a |
|---|---|---|---|
| `fecha` | Sí | `AAAA-MM-DD`, un día que exista | `{ anio, mes, diaDelMes }` (`parsearFecha`) |
| `cambios` | No | `MANUAL` o `AUTOMATICO`, también en minúsculas | `'MANUAL' \| 'AUTOMATICO'` (`parsearCambios`) |
| `desde` | No | `H:MM` o `HH:MM`, hora de la escuela (`8:00` vale) | `{ hora, minuto }` (`parsearHoraDelDia`) |
| `hasta` | No | Ídem | Ídem |

El DTO mira cada dato **por separado**. Que la fecha no sea pasada o que
`desde` sea anterior a `hasta` son reglas: las revisa el service (paso 4).

**No existe el campo `alumno`**, ni para el alumno ni para el admin: la
consulta muestra en qué horarios está libre el profesor. Un admin que lo
manda recibe 400 *"No se pueden enviar estos campos: alumno"*, como con
cualquier campo de más.

### Paso 4. ③ Las reglas del pedido

`turno.service.listarTurnosLibres(idProfesor, consulta, actor)`
(`src/services/turno.service.ts:276`) empieza por las reglas que no necesitan
la base:

| Regla | Dónde | Si no se cumple |
|---|---|---|
| La fecha es hoy o posterior, **en la escuela** (`hoyEnLaEscuela`) | `exigirFechaNoPasada` (`:81`) | 400 *"La fecha debe ser hoy o posterior"* |
| Si vienen los dos, `desde` < `hasta` | `exigirRangoValido` (`:92`) | 400 *"El desde debe ser anterior al hasta"* |
| Y el rango alcanza para una clase (`DURACION_CLASE_MS`) | ídem | 400 *"El rango debe ser de al menos una hora"* |

"Al menos una hora" sale de la misma constante con la que la reserva mide una
clase: si algún día las clases duraran otra cosa, las dos cambian juntas.

### Paso 5. ④ ⑤ ⑥ La cuenta, los datos y el saldo

```
cuentaQueConsulta(actor)              (:108)  alumno: ¿existe? · admin: ¿existe?    403
  │
  ▼ en paralelo, solo con services (nunca models ajenos):
profesorService.obtenerPorId          id mal formado → 400 "Id inválido" · null → 404
horarioEscuelaService.obtener         si no se configuró, un calendario vacío
autoService.listarActivos(cambios?)   autos en servicio, del tipo pedido o de los dos
  │
  ▼
exigirSaldo(alumno)                   (:128)  solo si consulta un alumno: saldo ≥ 1  409
```

- La cuenta se revisa **antes** que el id del profesor: una cuenta borrada no
  recibe información sobre ids.
- El saldo va **después** del profesor: con un profesor inexistente responde
  404, aunque el alumno tampoco tenga saldo.
- Un alumno sin saldo no puede ni consultar: no tiene sentido mostrarle turnos
  que no va a poder reservar. Al admin no se le revisa ningún saldo, porque no
  indica alumno.

### Paso 6. ⑦ Las ventanas: cruzar tres horarios

`ventanasDelDia` (`:147`) cruza cada tramo del profesor ese día con cada tramo
de la escuela y con `desde`/`hasta`, en minutos (`aIntervalo` y
`cruzarIntervalos`, de `tramo.service.ts`):

```
Juan 09–13  ∩  escuela 08–20  ∩  desde 08 / hasta 18   →  09–13
Juan 15–17  ∩  escuela 08–20  ∩  desde 08 / hasta 18   →  15–17
```

Los tramos **no se unen**: cada uno se procesa por separado. Así se respeta la
misma regla que la reserva, donde una clase tiene que entrar entera en **un**
tramo (`validarHorarioClase`, `clase.service.ts:114`). Si el profesor se sale
del horario de la escuela (por ejemplo, 06–10), solo queda la parte común:
08–10 (I-21).

### Paso 7. ⑧ La grilla: turnos de una hora, en punto

`iniciosEnPunto` (`:172`) parte cada ventana en clases de una hora **desde su
primera hora en punto** (N3), y `turnosDelDia` (`:192`) junta todas, sin
inicios repetidos, las pasa a instantes y saca las que ya empezaron:

```
09–13  →  09, 10, 11, 12
15–17  →  15, 16
```

Si una ventana no empieza en punto (un `desde` de `8:30`, o un tramo
guardado antes de N4), se arranca en la hora en punto siguiente:
`09:30–12:00` da 10 y 11.

**De hora de la escuela a instante** con `instanteLocal` y `OFFSET_HORA_UTC`
(N5), la misma constante que usa la reserva para el camino inverso
(`aHoraLocal`):

```
2026-11-09 a las 09:00 en la escuela (-3)  →  2026-11-09T12:00:00.000Z
```

**Si la fecha es hoy**, se sacan los turnos que ya empezaron (`inicio >
ahora`, la misma condición de la reserva). A las 10:20, la ventana 09–13 da 11
y 12: la grilla no se corre a 10:20–11:20.

### Paso 8. ⑨ ⑩ Una sola consulta y los autos libres

`clasesQuePisan` (`:214`) trae en **una** consulta las clases que pisan
cualquier turno del día: las del profesor, las del alumno (solo si consulta un
alumno) y las de los autos candidatos. Usa `claseService.listarSuperpuestas`
(`clase.service.ts:173`), la misma búsqueda que la reserva
(`validarAusenciaDeConflictos`, `:137`), que aprovecha los índices de `Clase`
(ver [`../guias/indices-de-mongoose.md`](../guias/indices-de-mongoose.md)).

Después, `conAutosLibres` (`:241`) recorre la grilla turno por turno:

| Turno | ¿Profesor o alumno ocupado? | AA111AA | BB222BB | Resultado para Ana |
|---|---|---|---|---|
| 09–10 | no | libre | con Carla | `AA111AA` |
| 10–11 | no | libre | libre | `AA111AA`, `BB222BB` |
| 11–12 | **Juan, con Beto** | — | — | se saca |
| 12–13 | no | libre | libre | `AA111AA`, `BB222BB` |
| 15–16 | **Ana, con Marta** | — | — | se saca (para un admin, queda) |
| 16–17 | no | libre | libre | `AA111AA`, `BB222BB` |

- Un auto ocupado no saca el turno, solo ese auto. Un turno **sin ningún auto
  libre** no se muestra.
- Si consulta un **admin**, no se mira a ningún alumno: el turno de las 15
  queda.

### Paso 9. La respuesta

Ana, con `{ "fecha": "2026-11-09", "cambios": "MANUAL", "desde": "08:00",
"hasta": "18:00" }` (cada auto abreviado a su patente, salvo el primero):

```
200 {
  "fecha": "2026-11-09",
  "dia": "lunes",
  "turnos": [
    { "inicio": "2026-11-09T12:00:00.000Z", "fin": "2026-11-09T13:00:00.000Z",
      "autos": [ { "_id": "6adf…", "marca": "Fiat", "modelo": "Cronos", "patente": "AA111AA", "cambios": "MANUAL" } ] },
    { "inicio": "2026-11-09T13:00:00.000Z", "fin": "2026-11-09T14:00:00.000Z", "autos": [ AA111AA, BB222BB ] },
    { "inicio": "2026-11-09T15:00:00.000Z", "fin": "2026-11-09T16:00:00.000Z", "autos": [ AA111AA, BB222BB ] },
    { "inicio": "2026-11-09T19:00:00.000Z", "fin": "2026-11-09T20:00:00.000Z", "autos": [ AA111AA, BB222BB ] }
  ]
}
```

- `inicio` y `fin` salen en UTC, como en el resto de la API: 12:00Z son las
  09:00 en la escuela.
- Cada auto trae solo lo necesario para elegirlo: `_id`, `marca`, `modelo`,
  `patente` y `cambios`. Ni `activo` ni las fechas de alta.
- El mismo pedido hecho por un **admin** devuelve además el turno de las 15
  (`18:00Z`).
- Sin `cambios`, cada turno suma `CC333CC`. `DD444DD` no aparece nunca: está
  fuera de servicio.
- Con `"cambios": "manual"` y `"desde": "8:30"`, la respuesta es la misma: las
  minúsculas valen y la grilla arranca a las 09.

### Paso 10. Después: reservar

`inicio`, `fin` y el `_id` de uno de los autos se mandan **tal cual** a
`POST /api/clases` (ver [`agendar-una-clase.md`](agendar-una-clase.md)). Ana
reserva el primer turno con `AA111AA`: **201**. Si consulta otra vez, el turno
de las 09 (`12:00Z`) ya no aparece.

| Quién reserva | Body | Respuesta |
|---|---|---|
| Ana | `profesor`, `auto`, `inicio`, `fin` | 201 |
| Admin, para Ana | Lo mismo, más `"alumno": "<id de Ana>"` | 201, y el saldo de Ana baja en 1 |
| Admin, para un alumno sin saldo | Ídem | 409 "El alumno no tiene clases disponibles para reservar" |
| Admin, para un alumno con clase a esa hora | Ídem | 409 "El alumno, profesor o auto ya tiene una clase en ese horario" |
| Cualquiera, si otro reservó antes | Ídem | 409 "El alumno, profesor o auto ya tiene una clase en ese horario" |

Como la consulta del admin no mira a ningún alumno, las reglas del alumno que
elige (saldo, otra clase a la misma hora) se comprueban recién en la reserva.

---

## Qué puede salir mal

En el orden en que se comprueban (respuestas reales):

| Pedido | Lo detecta | Respuesta |
|---|---|---|
| Sin token | `requireAuthentication` | 401 "Se requiere autenticación válida" |
| Sin body | `validacionDeCuerpo` | 400 "La petición debe incluir un cuerpo JSON" |
| Campo de más (`alumno`, `auto`…) | DTO | 400 "No se pueden enviar estos campos: alumno" |
| `"fecha": 20261109` | DTO | 400 "La fecha debe ser un texto" |
| Falta `fecha` | DTO | 400 "La fecha es obligatoria" |
| `fecha` con otro formato o inexistente (`2026-02-31`) | DTO | 400 "La fecha debe tener el formato AAAA-MM-DD" |
| `cambios` inválido | DTO | 400 "El tipo de cambios debe ser MANUAL o AUTOMATICO" |
| `desde` o `hasta` mal formados (`24:00`) | DTO | 400 "El desde debe tener el formato HH:MM" |
| `fecha` pasada | service | 400 "La fecha debe ser hoy o posterior" |
| `desde` ≥ `hasta` | service | 400 "El desde debe ser anterior al hasta" |
| Rango menor a una hora | service | 400 "El rango debe ser de al menos una hora" |
| Token de una cuenta borrada | service | 403 "La cuenta autenticada ya no está activa" |
| Id de profesor mal formado | service (`CastError`) | 400 "Id inválido" |
| Profesor inexistente | service (`null`) | 404 "Profesor no encontrado" |
| Alumno sin saldo | service | 409 "No tenés clases disponibles para reservar" |

Y casos que **no** son errores, pero devuelven `"turnos": []`: la escuela
cierra ese día, la escuela no cargó su horario, el profesor no trabaja ese
día, el profesor tiene el día lleno, no hay autos activos del tipo pedido, o
la fecha es hoy y ya pasó el horario.

---

## Resumen

- `POST /api/profesores/:id/turnos-libres` es una **consulta**: responde 200 y
  no guarda nada. Es POST porque el navegador no manda un GET con body.
- El DTO valida y convierte cada dato (`parsearFecha`, `parsearHoraDelDia`,
  `parsearCambios`); el service aplica las reglas que comparan datos o
  dependen de hoy.
- Pueden consultar alumnos y admins, y ninguno manda `alumno`. Si consulta un
  alumno, se revisa su saldo y se sacan sus clases; si consulta un admin, no.
- Los turnos salen de cruzar tres horarios (escuela, profesor y
  `desde`/`hasta`), armar la grilla de horas en punto y descartar los turnos
  en los que el profesor (o el alumno) está ocupado o no queda ningún auto.
- `turno.service` solo usa otros services, así que aplica las mismas reglas
  que la reserva: cualquier turno devuelto se puede mandar tal cual a
  `POST /api/clases`. Si otro lo reservó antes, la reserva responde 409.

**Siguiente lectura:** [`agendar-una-clase.md`](agendar-una-clase.md).
