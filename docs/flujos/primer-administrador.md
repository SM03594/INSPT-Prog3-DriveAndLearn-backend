# Flujo: crear el primer administrador

## Qué es esto, en una frase

Para crear un administrador por la API hace falta **ser** administrador
(`POST /api/administradores` pide el rol), y el registro público solo crea
alumnos. Entonces, ¿cómo se crea el **primero**? Con un **script** que se
ejecuta por consola y escribe directamente en la base, sin pasar por HTTP.
Esta guía recorre los dos scripts del proyecto y qué pasa después.

> Las salidas son **reales**: se obtuvieron corriendo los scripts contra una
> base en memoria.

---

## El mapa

```
base vacía
   │
   │  npm run admin:bootstrap      (pregunta los datos por consola)
   │  npm run admin:desde-env      (los lee de ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NOMAPE)
   ▼
primer admin en la colección usuarios (rol: 'administrador')
   │
   │  POST /api/auth/login  → token de admin
   ▼
POST /api/administradores   → los demás admins se crean por la API
```

| | `admin:bootstrap` | `admin:desde-env` |
|---|---|---|
| Archivo | `src/scripts/bootstrapAdmin.ts` | `src/scripts/bootstrapAdminDesdeEnv.ts` |
| De dónde saca los datos | Los pregunta; la contraseña no se muestra al escribirla | Del `.env` (`config/env.ts`) |
| Necesita una terminal interactiva | **Sí** | No |
| Si ya existe un admin | Error, código de salida 1 | Mensaje, código de salida **0** (no hace nada) |
| Pensado para | Instalar en tu máquina | Un deploy o un arranque automático |

---

## El recorrido

### Parte 1. Lo que comparten

Los dos scripts siguen el mismo esqueleto:

```ts
async function main(): Promise<void> {
  // 1. conseguir y validar los datos (ANTES de conectar)
  await connectDB();
  try {
    // 2. ¿ya hay algún administrador?  AdministradorModel.exists({})
    // 3. crear(...) del administrador.service
  } finally {
    await disconnectDB();          // se desconecta siempre, aunque haya error
  }
}

main().catch((error: unknown) => {
  console.error('No se pudo crear el administrador inicial:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
```

Algunos detalles:

- **Usan el service, no el model**, para crear: `administrador.service.crear`
  hashea la contraseña (y exige 8 caracteres) y traduce un email repetido. Así
  el admin se guarda exactamente igual que si se creara por la API.
- **`AdministradorModel.exists({})`** pregunta si existe *algún*
  administrador. Gracias al discriminator, ignora a los alumnos de la misma
  colección. Ver
  [`../capas/08-models.md`](../capas/08-models.md#7-discriminators-alumnos-y-administradores-en-la-misma-colección).
- **`process.exitCode = 1`** en lugar de `process.exit(1)`: marca el error
  pero deja terminar lo pendiente, como el `finally` que cierra la conexión.
  El código de salida le dice a quien ejecutó el script (una terminal, un
  deploy) si salió bien (0) o mal (1).
- Conectan con `connectDB()`, así que usan el `MONGODB_URI` del `.env`. **Se
  crea el admin en la base a la que apunte esa variable.**

### Parte 2. `admin:bootstrap`: preguntando por consola

`src/scripts/bootstrapAdmin.ts:55`:

```
Email del administrador: duena@escuela.com          ← readline: se normaliza (trim + lowercase)
Nombre y apellido: Dueña de la escuela
Contraseña (mínimo 8 caracteres, no se mostrará):   ← se escribe sin que se vea
   │
   ├─ email o nombre vacíos ............ "El email y el nombre y apellido son obligatorios"
   ├─ contraseña de menos de 8 ......... "La contraseña debe tener al menos 8 caracteres"
   ├─ connectDB()
   ├─ ¿ya existe un admin? ............. "Ya existe un administrador. Para crear otros,
   │                                       inicia sesión y usa POST /api/administradores."
   └─ crear() → "Administrador inicial creado: duena@escuela.com"
```

**La contraseña oculta** (`preguntarPasswordOculta`, `:12`) pone la terminal
en **modo crudo** (`stdin.setRawMode(true)`): cada tecla llega al programa
apenas se presiona, sin mostrarse en pantalla. El script la procesa carácter
por carácter:

| Tecla | Qué hace |
|---|---|
| Enter (`\r` o `\n`) | Termina |
| Retroceso (`\u007f` o `\b`) | Borra el último carácter |
| Ctrl+C (`\u0003`) | Cancela con "Operación cancelada" |
| Cualquier carácter imprimible | Se agrega a la contraseña |

Por eso **necesita una terminal de verdad** (TTY). Si `stdin` no es una
terminal, el código prevé lanzar *"Este comando necesita una terminal
interactiva para ocultar la contraseña"*. Pero al probarlo con la entrada
redirigida (`printf 'email\nnombre\n' | npm run admin:bootstrap`) ese mensaje
**nunca aparece**. Muestra las dos preguntas, y el proceso termina con
**código 0** sin llegar a pedir la contraseña, sin crear nada y sin mostrar
ningún error (I-41). Lo más probable es que el primer `readline` consuma toda
la entrada redirigida, y que la segunda pregunta no reciba respuesta. Como ya
no queda nada pendiente, Node termina el proceso como si todo hubiera salido
bien. Para automatizar, usá el
otro script.

### Parte 3. `admin:desde-env`: desde el `.env`

Variables (`.env.example`):

```bash
ADMIN_EMAIL=duena@escuela.com
ADMIN_PASSWORD=claveAdmin123        # al menos 8 caracteres
#ADMIN_NOMAPE=Administrador         # opcional
```

`obtenerAdminInicial()` (`src/config/env.ts:59`) las lee y normaliza el email.
Es una **función** y no una constante, para que el servidor arranque aunque
esas variables no existan: solo las necesita este script.

`src/scripts/bootstrapAdminDesdeEnv.ts:20`:

```
obtenerAdminInicial()  ─ faltan variables → error (antes de conectar)
connectDB()
¿ya existe un admin?  ─ sí → "Ya existe un administrador: no se crea otro."   (exit 0)
¿el email lo usa otro usuario?  ─ sí → error
crear()  → "Administrador inicial creado: ..."
```

Salidas reales:

| Situación | Código de salida | Salida |
|---|---|---|
| `ADMIN_EMAIL` vacío | 1 | No se pudo crear el administrador inicial: ADMIN_EMAIL y ADMIN_PASSWORD deben estar configurados en el .env |
| `ADMIN_PASSWORD=123` | 1 | … La contraseña debe tener al menos 8 caracteres |
| Email de un alumno existente | 1 | … El email ocupado@escuela.com ya lo usa otro usuario |
| Todo bien (`ADMIN_EMAIL="  Duena@Escuela.com "`) | **0** | Administrador inicial creado: duena@escuela.com |
| Correrlo otra vez | **0** | Ya existe un administrador: no se crea otro. |

La última fila es la clave de este script: es **idempotente**. Se puede correr
antes de **cada** arranque de la app, y solo hace algo la primera vez.

Una vez creado el admin, conviene **borrar `ADMIN_PASSWORD` del `.env`** (o
cambiar la contraseña por la API), para que no quede escrita en un archivo.

### Parte 4. Después: login y más admins

El admin creado por el script es igual a cualquier otro:

```
POST /api/auth/login { "email": "duena@escuela.com", "password": "claveAdmin123" }
200 { "token": "...", "usuario": { "id": "...", "email": "duena@escuela.com",
                                   "nomApe": "Dueña de la escuela", "role": "administrador" } }

POST /api/administradores   (con ese token)
{ "email": "segundo@escuela.com", "password": "claveAdmin456", "nomApe": "Segundo" }
201 { "rol": "administrador", "email": "segundo@escuela.com", "nomApe": "Segundo", ... }
```

A partir de acá, los dos scripts ya no sirven para crear más admins: los dos
se niegan si existe alguno.

### Parte 5. En producción

Los dos scripts de `package.json` usan **`tsx`**, que está en
`devDependencies`. En un servidor instalado sin las dependencias de
desarrollo (`npm install --omit=dev`), `npm run admin:desde-env` no funciona.
Pero `npm run build` también compila los scripts a `dist/scripts/`, y se
pueden correr con `node`. Lo comprobé:

```bash
node dist/scripts/bootstrapAdminDesdeEnv.js
# ✅ Conectado a MongoDB
# Administrador inicial creado: a@b.com
```

Un comando de arranque típico para un deploy:

```bash
node dist/scripts/bootstrapAdminDesdeEnv.js && node dist/server.js
```

Esto está registrado como I-43, porque falta un script de `npm` para esto.

### ¿Y si se borran todos los admins?

Nada lo impide: el **único** administrador puede borrarse a sí mismo
(`DELETE /api/administradores/<su id>` → **204**, comprobado), y la escuela
queda sin ningún admin (I-44). En ese caso, la única forma de recuperarse es
volver a correr uno de los scripts, que funcionan porque `exists({})` vuelve a
dar falso.

---

## Qué puede salir mal

| Situación | Resultado |
|---|---|
| `admin:bootstrap` sin terminal (en un pipeline, por ejemplo) | Termina con código 0 sin crear nada (I-41) |
| `MONGODB_URI` apunta a otra base | Se crea el admin **ahí** |
| Ya hay un admin | `bootstrap`: error (código 1). `desde-env`: no hace nada (código 0) |
| El email ya lo usa un alumno | Error: "ya lo usa otro usuario" / "La direccion de email ya esta en uso." |
| `npm run admin:desde-env` en producción sin devDependencies | No encuentra `tsx`. Usá `node dist/scripts/…` |
| `ADMIN_PASSWORD` queda en el `.env` | Riesgo de seguridad: borrala después de crear el admin |
| El único admin se borra a sí mismo | 204, y la escuela queda sin admins (I-44) |

---

## Resumen

- El primer admin no se puede crear por la API: se crea con un **script** que
  usa el mismo `administrador.service.crear`, así que hashea la contraseña y
  valida igual que la API.
- `admin:bootstrap` es interactivo, oculta la contraseña y necesita una
  terminal. `admin:desde-env` lee el `.env`, es idempotente y sirve para
  deploys.
- Los dos se niegan si ya existe **algún** admin. Los siguientes admins se
  crean con `POST /api/administradores`.
- En producción se corren como `node dist/scripts/…`.

**Siguiente lectura:** [`../00-indice.md`](../00-indice.md).
