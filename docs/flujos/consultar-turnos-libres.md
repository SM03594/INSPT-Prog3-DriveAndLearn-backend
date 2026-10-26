# Flujo: consultar los turnos libres de un profesor

## Qué es esto, en una frase

Antes de reservar, un alumno (o un admin) manda
`POST /api/profesores/:id/turnos-libres` con un día y, si quiere, el tipo de
auto y un rango de horas. La API cruza el horario de la escuela, la
disponibilidad del profesor y las clases ya reservadas, y devuelve los turnos
de una hora en los que se puede reservar, cada uno con los autos libres para
elegir.

> **Endpoint planificado, todavía no implementado.** Esta guía resume el plan
> de [`../plan-turnos-libres.txt`](../plan-turnos-libres.txt). Las respuestas
> son las que el plan define, **no** salidas reales de la API, y los archivos
> nuevos (`turno.service.ts`, `turno.dto.ts`) se citan sin número de línea.
> Cuando se implemente, hay que reemplazarlas por respuestas reales, como en
> el resto de los flujos.

Responde a I-20 ("No hay forma de consultar turnos libres") de
[`../inconsistencias.md`](../inconsistencias.md).

---

## Antes de consultar: las normas que el endpoint da por hechas

El plan cambia o confirma cinco reglas de la reserva. La consulta se apoya en
ellas para no ofrecer nunca un turno que `POST /api/clases` vaya a rechazar:

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
 ▼ profesor.routes        requireAuthentication → validacionDeCuerpo
 ▼ profesor.controller    actorDe(req) → { id: Ana, rol: 'alumno' }
 │   ① aConsultarTurnosDto        campos · fecha AAAA-MM-DD · HH:MM · rango ≥ 1 h   400
 ▼ turno.service.listarTurnosLibres
 │   ② cuenta y saldo             ¿la cuenta existe? ¿el alumno tiene saldo?    403/409
 │   ③ en paralelo                profesor · horario de la escuela · autos       404
 │   ④ ventanas                   tramo del profesor ∩ escuela ∩ desde/hasta
 │   ⑤ una sola consulta          clases del día: profesor, alumno, autos
 │   ⑥ restar ocupados            del profesor y (si consulta un alumno) del alumno
 │   ⑦ partir en turnos           de 1 h, desde la primera hora en punto
 │   ⑧ autos libres               por turno; un turno sin autos se saca
 │   ⑨ hoy · repetidos · instante sacar los ya empezados, sin inicios repetidos
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

En `src/routes/profesor.routes.ts`, junto a las demás rutas del profesor:

```ts
router.post('/:id/turnos-libres', validacionDeCuerpo, profesorController.turnosLibres);
```

- Sin `requireAdministrator`: pueden consultar alumnos y admins. El router ya
  aplica `requireAuthentication` a todas sus rutas (`profesor.routes.ts:17`).
- **¿Por qué POST si solo consulta?** Porque los datos van en un body JSON, y
  el navegador no permite un GET con body: `fetch` lanza *"Request with
  GET/HEAD method cannot have body"*. Responde **200**, no 201: no crea nada.
- Lleva `validacionDeCuerpo`, así que un pedido sin body responde 400 antes de
  llegar al controller.

### Paso 2. El controller

`profesorController.turnosLibres` arma el DTO, llama al service y responde
`res.json(...)`. Si el profesor no existe, el service devuelve `null` y el
controller responde 404 "Profesor no encontrado", con `if / else` (sin
`return`), como el resto de los controllers.

### Paso 3. ① El DTO: la forma del pedido

`aConsultarTurnosDto` (`src/dtos/turno.dto.ts`, nuevo) usa `validarCampos`
con `SIN_CAMPOS_DE_MAS`:

| Campo | Obligatorio | Formato | Sale convertido a |
|---|---|---|---|
| `fecha` | Sí | `AAAA-MM-DD`, hoy o posterior | `{ año, mes, día }` (`parsearFecha`) |
| `cambios` | No | `MANUAL` o `AUTOMATICO` (también en minúsculas) | `'MANUAL' \| 'AUTOMATICO'` |
| `desde` | No | `HH:MM`, hora de la escuela | `HoraDelDia` (`parsearHoraDelDia`) |
| `hasta` | No | `HH:MM`, hora de la escuela | `HoraDelDia` |

Si vienen `desde` y `hasta`, el primero tiene que ser anterior y el rango, de
al menos una hora.

**No existe el campo `alumno`**, ni para el alumno ni para el admin: la
consulta muestra en qué horarios está libre el profesor. Un admin que lo
manda recibe 400 "No se pueden enviar estos campos: alumno", como con
cualquier campo de más.

### Paso 4. ② La cuenta y el saldo

`turno.service.listarTurnosLibres(idProfesor, consulta, actor)`:

| Quién consulta | Qué se comprueba |
|---|---|
| Alumno | Que la cuenta exista (403) y que tenga saldo ≥ 1 (409 "No tenés clases disponibles para reservar") |
| Admin | Solo que la cuenta exista (403). No se revisa ningún saldo: no indica alumno |

Que un alumno sin saldo no pueda ni consultar evita mostrarle turnos que
después no va a poder reservar.

### Paso 5. ③ Los datos, en paralelo

El service solo usa otros **services**, nunca models ajenos:

```
profesorService.obtenerPorId        → null = 404 "Profesor no encontrado"
horarioEscuelaService.obtener       → si no se configuró, un calendario vacío (horarioEscuela.service.ts:19)
autoService.listarActivos(cambios?) → NUEVA: autos activos, del tipo pedido o de los dos
```

El día de la semana sale de la fecha con `Date.UTC(año, mes - 1, día)`: un día
de calendario no depende de la zona horaria.

### Paso 6. ④ Las ventanas: cruzar tres horarios

Cada tramo del profesor ese día se cruza con los tramos de la escuela y con
`desde`/`hasta`, en minutos (`aMinutos`, `src/models/Horario.ts:40`):

```
Juan 09–13  ∩  escuela 08–20  ∩  desde 08 / hasta 18   →  09–13
Juan 15–17  ∩  escuela 08–20  ∩  desde 08 / hasta 18   →  15–17
```

Los tramos **no se unen**: cada uno se procesa por separado. Así se respeta la
misma regla que la reserva, donde una clase tiene que entrar entera en **un**
tramo (`validarHorarioClase`, `clase.service.ts:118`). Si dos tramos se
superponen y producen el mismo turno, se muestra una sola vez (paso 10).

Si el profesor se sale del horario de la escuela (por ejemplo, 06–10), solo
queda la parte común: 08–10 (I-21).

### Paso 7. ⑤ Una sola consulta de clases

`claseService.listarSuperpuestas({ inicio, fin, profesor, alumno?, autos })`
(NUEVA) trae en **una** consulta las clases de ese día que sean del profesor,
del alumno (solo si consulta un alumno) o de alguno de los autos candidatos.
Es la misma idea que `validarAusenciaDeConflictos` (`clase.service.ts:141`),
pero para un día entero en vez de una hora.

### Paso 8. ⑥ Restar los horarios ocupados

De cada ventana se restan las clases del **profesor** y, si consulta un
alumno, las del **alumno** (con cualquier profesor):

```
ventana 09–13  −  Juan 11–12         →  09–11 y 12–13
ventana 15–17  −  Ana 15–16          →  16–17
```

Las clases de los autos todavía no se restan: un auto ocupado no saca el
turno, solo ese auto (paso 9).

Si consulta un **admin**, no se resta ningún alumno: la ventana 15–17 queda
entera.

### Paso 9. ⑦ y ⑧ Partir en turnos y elegir autos

Cada ventana se parte en clases de una hora **desde su primera hora en
punto** (N3):

```
09–11  →  09, 10
12–13  →  12
16–17  →  16
```

Por cada turno se buscan los autos sin una clase que se superponga:

| Turno | AA111AA | BB222BB | Autos que se ofrecen |
|---|---|---|---|
| 09–10 | libre | con Carla | `AA111AA` |
| 10–11 | libre | libre | `AA111AA`, `BB222BB` |
| 12–13 | libre | libre | `AA111AA`, `BB222BB` |
| 16–17 | libre | libre | `AA111AA`, `BB222BB` |

Un turno sin ningún auto libre **no se muestra**.

Si una ventana no empieza en punto (un `desde` de 08:30, o un tramo o una
clase guardados antes de N3/N4), se arranca en la hora en punto siguiente:

```
ventana 09:00–13:00  →  09, 10, 11, 12
ventana 09:30–12:00  →  10, 11          (09:30 no es en punto)
ventana 08:20–09:10  →  []              (no entra ninguna hora en punto)
```

### Paso 10. ⑨ Hoy, repetidos e instantes

- **Si la fecha es hoy**, se sacan los turnos que ya empezaron. A las 10:20,
  la ventana 09–13 da 11 y 12 (la grilla no se corre a 10:20–11:20).
- **Inicios repetidos**: si dos tramos superpuestos dieron el mismo turno, se
  deja uno.
- **De hora de la escuela a instante** con `OFFSET_HORA_UTC`, las horas de
  diferencia con UTC que se configuran en el `.env` (`-3` si no se indica, norma N5):

```
"2026-11-09" + "09:00"  →  "2026-11-09T09:00:00-03:00"  →  2026-11-09T12:00:00.000Z
```

La reserva usa la **misma** constante para el camino inverso, de instante a
hora de la escuela (`aHoraLocal`, `src/utils/fechas.ts:92`). Como hay una sola
fuente de verdad, la consulta y la reserva no pueden desfasarse. "Hoy" (para
rechazar fechas pasadas y sacar los turnos ya empezados) también se calcula
con `OFFSET_HORA_UTC`. Por qué hace falta esa conversión está en
[`../guias/zonas-horarias-y-fechas.md`](../guias/zonas-horarias-y-fechas.md).

### Paso 11. La respuesta

```
200 {
  "fecha": "2026-11-09",
  "dia": "lunes",
  "turnos": [
    { "inicio": "2026-11-09T12:00:00.000Z", "fin": "2026-11-09T13:00:00.000Z",
      "autos": [ { "_id": "…", "marca": "Fiat", "modelo": "Cronos", "patente": "AA111AA", "cambios": "MANUAL" } ] },
    { "inicio": "2026-11-09T13:00:00.000Z", "fin": "2026-11-09T14:00:00.000Z", "autos": [ AA111AA, BB222BB ] },
    { "inicio": "2026-11-09T15:00:00.000Z", "fin": "2026-11-09T16:00:00.000Z", "autos": [ AA111AA, BB222BB ] },
    { "inicio": "2026-11-09T19:00:00.000Z", "fin": "2026-11-09T20:00:00.000Z", "autos": [ AA111AA, BB222BB ] }
  ]
}
```

- `inicio` y `fin` salen en UTC, como en el resto de la API: 12:00Z son las
  09:00 en la escuela.
- Cada auto trae `_id`, `marca`, `modelo`, `patente` y `cambios`.
- Si consultara un admin, aparecería además el turno de las 15 (18:00Z): no se
  restan las clases de Ana.

### Paso 12. Después: reservar

`inicio`, `fin` y el `_id` de uno de los autos se mandan **tal cual** a
`POST /api/clases` (ver [`agendar-una-clase.md`](agendar-una-clase.md)):

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

Ordenado según el paso que lo detecta (respuestas definidas en el plan):

| Pedido | Respuesta |
|---|---|
| Sin token | 401 "Se requiere autenticación válida" |
| Sin body o body que no es objeto | 400 (`validacionDeCuerpo`) |
| Campo de más (`alumno`, `auto`…) | 400 "No se pueden enviar estos campos: …" |
| `"fecha": 20261109` | 400 "La fecha debe ser un texto" |
| Falta `fecha` | 400 "La fecha es obligatoria" |
| `fecha` con otro formato o inexistente (`2026-02-31`) | 400 "La fecha debe tener el formato AAAA-MM-DD" |
| `fecha` pasada | 400 "La fecha debe ser hoy o posterior" |
| `cambios` inválido | 400 "El tipo de cambios debe ser MANUAL o AUTOMATICO" |
| `desde` o `hasta` mal formados | 400 "El desde debe tener el formato HH:MM" |
| `desde` ≥ `hasta` | 400 "El desde debe ser anterior al hasta" |
| Rango menor a una hora | 400 "El rango debe ser de al menos una hora" |
| Id de profesor mal formado | 400 "Id inválido" |
| Token de una cuenta borrada | 403 "La cuenta autenticada ya no está activa" |
| Profesor inexistente | 404 "Profesor no encontrado" |
| Alumno sin saldo | 409 "No tenés clases disponibles para reservar" |

Y casos que **no** son errores, pero devuelven `"turnos": []`: la escuela
cierra ese día, la escuela no cargó su horario, el profesor no trabaja ese
día, el profesor tiene el día lleno, no hay autos activos del tipo pedido, o
la fecha es hoy y ya pasó el horario.

---

## Resumen

- `POST /api/profesores/:id/turnos-libres` es una **consulta**: responde 200 y
  no guarda nada. Es POST porque el navegador no manda un GET con body.
- Pueden consultar alumnos y admins, y ninguno manda `alumno`. Si consulta un
  alumno, se revisa su saldo y se sacan sus clases; si consulta un admin, no.
- Los turnos salen de cruzar tres horarios (escuela, profesor y
  `desde`/`hasta`), restar las clases del profesor (y del alumno), partir en
  horas en punto y quedarse con los turnos que tienen algún auto libre.
- La consulta y la reserva usan las mismas reglas, así que cualquier turno
  devuelto se puede mandar tal cual a `POST /api/clases`. Si otro lo reservó
  antes, la reserva responde 409.

**Siguiente lectura:** [`agendar-una-clase.md`](agendar-una-clase.md).
