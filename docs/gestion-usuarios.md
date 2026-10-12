# Gestión de usuarios: permisos, actualización y eliminación

Esta guía describe cómo quedaron implementadas las operaciones sobre alumnos y
administradores. La regla de acceso es:

- Un usuario puede consultar, modificar o eliminar **su propia cuenta**.
- Un administrador puede consultar, modificar o eliminar **cualquier cuenta**.
- Solo un administrador puede listar usuarios, crear administradores o cambiar
  el saldo de clases de un alumno.

Todas las rutas descritas requieren el encabezado:

```http
Authorization: Bearer <token>
```

El token se obtiene en `POST /api/auth/login`. Para registrar un alumno no se
necesita token.

## Endpoints

| Método | Ruta | Quién puede usarla | Resultado |
| --- | --- | --- | --- |
| `POST` | `/api/alumnos` | Público | Registra un alumno nuevo con saldo inicial cero. |
| `GET` | `/api/alumnos` | Administrador | Lista todos los alumnos. |
| `GET` | `/api/alumnos/:id` | El mismo alumno o un administrador | Consulta el perfil. |
| `PUT` | `/api/alumnos/:id` | El mismo alumno o un administrador | Actualiza el perfil. |
| `DELETE` | `/api/alumnos/:id` | El mismo alumno o un administrador | Elimina la cuenta del alumno. |
| `GET` | `/api/administradores` | Administrador | Lista administradores. |
| `GET` | `/api/administradores/:id` | El mismo administrador o un administrador | Consulta el perfil. |
| `POST` | `/api/administradores` | Administrador | Crea una cuenta administradora. |
| `PUT` | `/api/administradores/:id` | El mismo administrador o un administrador | Actualiza el perfil. |
| `DELETE` | `/api/administradores/:id` | El mismo administrador o un administrador | Elimina la cuenta administradora. |

`POST /api/alumnos` permite únicamente `email`, `password` y `nomApe`; el saldo
de clases se inicia en cero y no puede asignarse desde el registro público.

## Actualizar una cuenta

`PUT` acepta solo los campos que se quieren cambiar. No es necesario enviar los
que no se modifican.

Ejemplo para modificar el nombre del propio alumno:

```http
PUT /api/alumnos/ID_DEL_ALUMNO
Authorization: Bearer TOKEN_DEL_ALUMNO
Content-Type: application/json
```

```json
{
  "nomApe": "Ana Pérez actualizada"
}
```

Campos de perfil permitidos para actualizar:

```json
{
  "email": "nuevo@example.com",
  "password": "nuevaClaveSegura123",
  "nomApe": "Nombre actualizado"
}
```

La contraseña se vuelve a hashear con bcrypt. Si un alumno intenta cambiar
`clasesPorReservar` u otro campo no permitido en su propio perfil, recibe
`403 Forbidden`. Un administrador sí puede modificar `clasesPorReservar` al
actualizar un alumno:

```http
PUT /api/alumnos/ID_DEL_ALUMNO
Authorization: Bearer TOKEN_DEL_ADMIN
Content-Type: application/json
```

```json
{
  "clasesPorReservar": 3
}
```

Las cuentas administradoras solo tienen los campos `email`, `password` y
`nomApe`; un administrador puede modificar esos campos de otra cuenta
administradora. El backend no permite al cliente cambiar el rol de una cuenta.

## Eliminar una cuenta

Ejemplo para que un alumno elimine su propia cuenta:

```http
DELETE /api/alumnos/ID_DEL_ALUMNO
Authorization: Bearer TOKEN_DEL_ALUMNO
```

Un administrador puede usar el mismo método y ruta con su propio token para
eliminar otro alumno. Las cuentas de administrador se eliminan de forma
equivalente con `DELETE /api/administradores/:id`.

La respuesta correcta es `204 No Content` y no contiene JSON. Si el ID no
existe, la API devuelve `404 Not Found`. El borrado de una cuenta no elimina
automáticamente clases u otros registros que guarden su ID; esos datos
relacionados permanecen en la base.

## Respuestas de autorización

- `401 Unauthorized`: falta el token o no es válido.
- `403 Forbidden`: el token es válido, pero el usuario no tiene permiso para
  esa operación o intenta cambiar un campo que no puede modificar.
- `404 Not Found`: no existe una cuenta con el ID indicado.
- `400 Bad Request`: el cuerpo de la petición no tiene el formato esperado o
  incumple las validaciones del modelo.
- `204 No Content`: cuenta eliminada correctamente.

El middleware comprueba que el administrador autenticado todavía exista en la
colección de administradores. Así, un token de una cuenta administradora
eliminada deja de autorizar las operaciones de gestión, aunque aún no haya
vencido. Los tokens válidos restantes vencen en una hora, como se explica en
[AUTENTICACION.md](./AUTENTICACION.md).

## Cómo se aplica en el código

El recorrido sigue la estructura por capas del backend:

1. `src/routes/alumno.routes.ts` y `src/routes/administrador.routes.ts` conectan
   cada método HTTP con su middleware y controlador.
2. `requireAuthentication` valida el JWT. `requireAdministrator` reserva las
   operaciones globales para administradores. `requireSelfOrAdministrator`
   compara el ID del token con `:id` y permite administrar otras cuentas solo
   al administrador.
3. En la ruta de actualización de alumnos, el middleware también limita los
   campos modificables por el propio alumno. El controlador de registro público
   rechaza campos adicionales para que nadie pueda asignarse saldo al crear la
   cuenta.
4. Los controladores llaman a la capa de servicios y convierten los resultados
   en respuestas HTTP. Los servicios consultan MongoDB mediante Mongoose.
5. `eliminar` en ambos servicios usa `findByIdAndDelete`: devuelve el documento
   eliminado, o `null` si no había una cuenta con ese ID. Los controladores
   responden `204` o `404`, respectivamente.

## Pruebas

Desde `INSPT-Prog3-DriveAndLearn-backend`:

```sh
npm run test:run -- tests/auth.http.test.ts
npm run build
```

Las pruebas HTTP comprueban el acceso al propio perfil, la denegación de cambios
a otros usuarios por parte de un alumno, la protección de campos y operaciones
de administrador, la actualización y eliminación de cuentas por administradores
y la invalidación del permiso administrativo tras eliminar esa cuenta.
