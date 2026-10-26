# Práctica de examen: 15 rutas para probar en Postman

Esta guía recorre los endpoints centrales de autenticación, configuración de
recursos y gestión de clases. Las rutas se pueden probar una por una o en el
orden sugerido para completar el flujo.

## Preparación en Postman

1. Iniciá el backend y confirmá que está conectado a MongoDB.
2. Elegí el environment local. Configurá `baseUrl` como
   `http://localhost:3000/api`. No agregues `/api` otra vez al final de cada
   URL.
3. Necesitás un administrador existente. Si la base local está vacía, crealo
   con el procedimiento documentado en
   [`primer-administrador.md`](primer-administrador.md).
4. Para cada pedido, elegí el método HTTP y escribí la URL indicada. En los
   pedidos protegidos, abrí **Authorization**, seleccioná **Bearer Token** y
   pegá el token correspondiente. Para los pedidos con body, elegí **Body →
   raw → JSON**. Los cuerpos de esta guía no llevan campos extra.
5. Guardá los valores que devuelve la API para reutilizarlos:
   `tokenAdmin`, `tokenAlumno`, `alumnoId`, `autoId`, `profesorId` y `claseId`.
   Podés copiarlos a variables locales de Postman o pegarlos directamente en
   cada pedido.

El alta de alumno y el login son públicos. El resto requiere autenticación;
las rutas de preparación de autos, profesores, horarios y saldo requieren un
administrador. El alumno puede consultar y administrar sus propias clases.

> Las operaciones que cambian el horario afectan a toda la escuela. Probá la
> guía contra una base local, no contra una base compartida o de producción.

## Las 15 rutas

### 1. Iniciar sesión

**Método y URL:** `POST {{baseUrl}}/auth/login`  
**Quién:** cualquiera; repetí este pedido para iniciar sesión como admin y,
tras registrar al alumno, como alumno.  
**Authorization:** No Auth.  
**Body JSON:**

```json
{
  "email": "admin@example.com",
  "password": "claveAdmin123"
}
```

Reemplazá las credenciales por las de tu administrador. La respuesta esperada
es `200` con `token` y `usuario`. Copiá `token` como `tokenAdmin`. Después de
crear al alumno, repetí el mismo endpoint con su email y contraseña; guardá ese
token como `tokenAlumno`.

### 2. Registrar un alumno

**Método y URL:** `POST {{baseUrl}}/alumnos`  
**Quién:** público.  
**Authorization:** No Auth.  
**Body JSON:**

```json
{
  "email": "alumno.postman@example.com",
  "password": "claveSegura123",
  "nomApe": "Alumno de Prueba"
}
```

Usá un email que no exista en la base. La respuesta esperada es `201`; copiá
`_id` como `alumnoId`. El saldo arranca en cero. No mandes `rol` ni
`clasesPorReservar`: son campos que el servidor controla.

### 3. Cargar saldo al alumno

**Método y URL:** `PATCH {{baseUrl}}/alumnos/{{alumnoId}}/sumar-clases`  
**Quién:** administrador.  
**Authorization:** Bearer `tokenAdmin`.  
**Body JSON:**

```json
{
  "cantidad": 2
}
```

La respuesta esperada es `200` y el alumno queda con 2 clases para reservar.
La cantidad debe ser un número entero mayor que cero.

### 4. Crear un auto

**Método y URL:** `POST {{baseUrl}}/autos`  
**Quién:** administrador.  
**Authorization:** Bearer `tokenAdmin`.  
**Body JSON:**

```json
{
  "marca": "Toyota",
  "modelo": "Etios",
  "patente": "POSTMAN-001",
  "cambios": "MANUAL"
}
```

Usá una patente única. `cambios` debe ser `MANUAL` o `AUTOMATICO`. La respuesta
esperada es `201`; copiá `_id` como `autoId`. El auto se crea activo por
defecto.

### 5. Listar autos

**Método y URL:** `GET {{baseUrl}}/autos`  
**Quién:** cualquier usuario autenticado.  
**Authorization:** Bearer `tokenAdmin` o `tokenAlumno`.  
**Body:** ninguno.

La respuesta esperada es `200` con una lista. Verificá que aparezca el auto
creado y que tenga `activo: true`. Este endpoint también sirve al final para
comprobar el efecto del logout: si lo repetís con el token que cerraste,
debe responder `401`.

### 6. Crear un profesor

**Método y URL:** `POST {{baseUrl}}/profesores`  
**Quién:** administrador.  
**Authorization:** Bearer `tokenAdmin`.  
**Body JSON:**

```json
{
  "nomApe": "Profesor de Prueba"
}
```

La disponibilidad no se configura en el alta. La respuesta esperada es `201`;
copiá `_id` como `profesorId`.

### 7. Agregar disponibilidad al profesor

**Método y URL:** `POST {{baseUrl}}/profesores/{{profesorId}}/disponibilidad`  
**Quién:** administrador.  
**Authorization:** Bearer `tokenAdmin`.  
**Body JSON:**

```json
{
  "dia": "lunes",
  "tramo": {
    "horaInicio": { "hora": 8, "minuto": 0 },
    "horaFin": { "hora": 18, "minuto": 0 }
  }
}
```

La respuesta esperada es `200`. El día debe escribirse en minúscula y sin
tilde: `miercoles`, `sabado`. La franja debe tener inicio anterior al fin.
Después, reservá la clase dentro de esta disponibilidad.

### 8. Consultar el horario de la escuela

**Método y URL:** `GET {{baseUrl}}/horario-escuela`  
**Quién:** cualquier usuario autenticado.  
**Authorization:** Bearer `tokenAdmin` o `tokenAlumno`.  
**Body:** ninguno.

La respuesta esperada es `200` con los siete días. Revisá si el lunes ya tiene
una franja que incluya el horario elegido para la clase. Si ya existe, no
agregues otra igual; podés usar la franja existente.

### 9. Agregar horario a la escuela

**Método y URL:** `POST {{baseUrl}}/horario-escuela/agregar`  
**Quién:** administrador.  
**Authorization:** Bearer `tokenAdmin`.  
**Body JSON:**

```json
{
  "dia": "lunes",
  "tramo": {
    "horaInicio": { "hora": 8, "minuto": 0 },
    "horaFin": { "hora": 18, "minuto": 0 }
  }
}
```

Usá esta ruta si la consulta anterior mostró que hace falta configurar esa
franja. La respuesta esperada es `200` con el calendario semanal actualizado.
El intervalo elegido debe contener la hora de la clase.

### 10. Crear una clase

Antes, repetí la ruta 1 con las credenciales del alumno y usá `tokenAlumno`.
Elegí un lunes futuro; el ejemplo siguiente usa el 2 de noviembre de 2026,
que debe reemplazarse si ya pasó. La clase debe durar exactamente una hora,
ser futura y estar dentro del horario escolar y la disponibilidad del profesor.

**Método y URL:** `POST {{baseUrl}}/clases`  
**Quién:** alumno autenticado; reserva para sí mismo.  
**Authorization:** Bearer `tokenAlumno`.  
**Body JSON:**

```json
{
  "profesor": "{{profesorId}}",
  "auto": "{{autoId}}",
  "inicio": "2026-11-02T10:00:00-03:00",
  "fin": "2026-11-02T11:00:00-03:00"
}
```

Reemplazá la fecha por el próximo lunes disponible y conservá el offset
horario correcto para la escuela. Como alumno, no incluyas el campo `alumno`:
la clase se asocia automáticamente a quien inició sesión. La respuesta
esperada es `201`; copiá `_id` como `claseId`. El saldo disminuye en una clase.

### 11. Listar las clases

**Método y URL:** `GET {{baseUrl}}/clases`  
**Quién:** cualquier usuario autenticado.  
**Authorization:** Bearer `tokenAlumno`.  
**Body:** ninguno.

La respuesta esperada es `200`. Como alumno, vas a ver las clases asociadas a
tu cuenta. Usá `tokenAdmin` para consultar la vista de administrador.

### 12. Consultar una clase

**Método y URL:** `GET {{baseUrl}}/clases/{{claseId}}`  
**Quién:** el alumno dueño de la clase o un administrador.  
**Authorization:** Bearer `tokenAlumno` o `tokenAdmin`.  
**Body:** ninguno.

La respuesta esperada es `200` con el detalle de la clase. Un alumno no puede
consultar la clase de otro alumno.

### 13. Modificar una clase

**Método y URL:** `PUT {{baseUrl}}/clases/{{claseId}}`  
**Quién:** el alumno dueño de la clase o un administrador.  
**Authorization:** Bearer `tokenAlumno` o `tokenAdmin`.  
**Body JSON:**

```json
{
  "inicio": "2026-11-02T11:00:00-03:00",
  "fin": "2026-11-02T12:00:00-03:00"
}
```

La respuesta esperada es `200`. Usá una nueva franja futura, de una hora,
libre y dentro de los horarios de la escuela y del profesor. Se puede enviar
solo el campo que se modifica, pero la clase debe seguir siendo válida.

### 14. Cancelar una clase

**Método y URL:** `DELETE {{baseUrl}}/clases/{{claseId}}`  
**Quién:** el alumno dueño de la clase o un administrador.  
**Authorization:** Bearer `tokenAlumno` o `tokenAdmin`.  
**Body:** ninguno.

La respuesta esperada es `204 No Content`. Si la clase todavía no comenzó,
de estas 15 seleccionadas.
el saldo del alumno se reintegra.

### 15. Cerrar sesión

**Método y URL:** `POST {{baseUrl}}/auth/logout`  
**Quién:** cualquier usuario autenticado.  
**Authorization:** Bearer `tokenAlumno`.  
**Body:** ninguno.

La respuesta esperada es `204 No Content`. Después repetí la ruta 5,
`GET {{baseUrl}}/autos`, con el mismo `tokenAlumno`: ahora debe responder
`401` porque el JWT fue revocado. Un nuevo login emite otro token; el logout
no revoca las sesiones de otros dispositivos.

## Orden de ejecución

Para que la reserva funcione, seguí esta secuencia:

1. Login de administrador (ruta 1).
2. Registrar alumno y cargar saldo (rutas 2 y 3).
3. Crear auto y profesor; configurar disponibilidad (rutas 4, 6 y 7).
4. Consultar y, si hace falta, agregar el horario escolar (rutas 8 y 9).
5. Login de alumno y crear la clase (rutas 1 y 10).
6. Consultar, modificar y cancelar la clase (rutas 11 a 14).
7. Cerrar sesión y comprobar el `401` con el mismo token (ruta 15 y ruta 5).

Si una ruta protegida responde `401`, revisá que el header sea
`Authorization: Bearer <token>` y que no hayas usado un token revocado. Un
`403` suele indicar que usaste token de alumno en una operación exclusiva del
administrador. Un `409` al reservar suele indicar que falta saldo, el auto está
inactivo, o la fecha no cabe en los horarios configurados.
