# Reservas de clases

## Reglas

- Una reserva dura exactamente una hora. `inicio` y `fin` deben ser instantes
  ISO 8601 con zona horaria y precisión de minutos.
- El inicio debe ser futuro y la clase no puede cruzar el cambio de día local.
- El tramo completo debe caber tanto en el horario general de la escuela como
  en la disponibilidad semanal del profesor.
- El auto debe existir y estar activo.
- El alumno, el profesor y el auto no pueden tener otra clase no cancelada que
  se superponga con el intervalo.
- Reservar descuenta una clase del saldo del alumno. Sin saldo disponible, la
  operación responde `409 Conflict`.
- Un alumno solo puede listar, consultar, modificar o cancelar sus clases.
  No puede asignar el alumno de la reserva desde el body. Un administrador
  puede consultar y gestionar clases de cualquier alumno.
- Solo se pueden modificar o cancelar clases futuras. Cancelar una clase
  futura reintegra el crédito; repetir la cancelación no vuelve a sumarlo.

## Configurar horarios

Un administrador debe establecer el horario general antes de aceptar reservas.
`PUT /api/horario` reemplaza el calendario completo; el JSON es el calendario
semanal directamente:

```http
PUT /api/horario
Authorization: Bearer <token-administrador>
Content-Type: application/json
```

```json
{
  "lunes": [
    {
      "horaInicio": { "hora": 8, "minuto": 0 },
      "horaFin": { "hora": 18, "minuto": 0 }
    }
  ],
  "martes": [],
  "miercoles": [],
  "jueves": [],
  "viernes": [],
  "sabado": [],
  "domingo": []
}
```

`GET /api/horario` devuelve el calendario. La disponibilidad del profesor se
administra con `POST /api/profesores/:id/disponibilidad` y
`DELETE /api/profesores/:id/disponibilidad`; esas modificaciones también
requieren token de administrador.

Los profesores se crean con `POST /api/profesores` y el body
`{"nomApe":"Nombre Apellido"}`; la ruta requiere un token de administrador y
el profesor comienza con la disponibilidad vacía.

`POST /api/horario/agregar` y `POST /api/horario/quitar` aplican cambios sobre
un tramo individual. Las rutas equivalentes bajo `/api/calendario-semanal`
comparten el mismo calendario persistido.

## Reservar

El alumno envía profesor, auto e instantes, sin `alumno` ni `estado`:

```http
POST /api/clases
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "profesor": "<id-profesor>",
  "auto": "<id-auto>",
  "inicio": "2030-01-07T12:00:00.000Z",
  "fin": "2030-01-07T13:00:00.000Z"
}
```

El backend toma la identidad del alumno del token y crea la clase en estado
`pendiente`. Un administrador puede reservar en nombre de un alumno incluyendo
`alumno` en el body.

## Consultar y cambiar una reserva

| Método | Ruta | Acceso |
| --- | --- | --- |
| `GET` | `/api/clases` | Alumnos: solo sus clases. Administradores: todas. |
| `GET` | `/api/clases/:id` | Propietario o administrador. |
| `PUT` | `/api/clases/:id` | Propietario o administrador; modifica parcialmente `profesor`, `auto`, `inicio` o `fin`. |
| `PATCH` | `/api/clases/:id/cancelar` | Propietario o administrador; cancela y reintegra el crédito si es futura. |

La reprogramación valida de nuevo duración, horario, estado de los recursos y
superposiciones, y no descuenta un crédito adicional.

## Errores principales

- `400 Bad Request`: body inválido, identificador inválido, fecha sin zona,
  duración distinta de una hora o fecha pasada.
- `401 Unauthorized`: token ausente o inválido.
- `403 Forbidden`: cuenta inactiva o intento de modificar el horario sin rol
  administrador.
- `404 Not Found`: recurso inexistente o clase ajena al alumno autenticado.
- `409 Conflict`: sin saldo, recurso ocupado/inactivo, horario no disponible,
  modificación de una clase cancelada o cancelación de una clase iniciada.

Pruebas automatizadas: `tests/services/clase.service.test.ts` y
`tests/clases.http.test.ts`.
