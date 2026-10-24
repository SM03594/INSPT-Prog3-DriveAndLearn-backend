# Tests con Postman

## Qué es esto, en una frase

La colección de `postman/` prueba la API **de punta a punta, como lo haría el
frontend**: con el servidor levantado de verdad, contra una base real,
haciendo login y encadenando pedidos. Son 192 requests, organizados en 11
carpetas que se ejecutan en orden, y cada uno tiene scripts que comprueban la
respuesta.

---

## Vitest y Postman: ¿por qué los dos?

| | Vitest ([guía 11](11-tests-vitest.md)) | Postman |
|---|---|---|
| Contra qué corre | `app` en memoria (supertest) | El servidor levantado (`npm run dev` o un deploy) |
| Base de datos | MongoDB en memoria, vacía en cada test | La base real (local o remota) |
| Independencia | Cada test crea sus datos | Los requests **dependen** de los anteriores (tokens, ids) |
| Cuándo | En cada cambio, en segundos | Antes de entregar, o contra el servidor desplegado |
| Qué detecta además | — | Configuración real (`.env`, CORS, red, tiempos de respuesta) |

---

## El mapa

```
postman/
├── DriveAndLearn.postman_collection.json   11 carpetas, 192 requests
├── environments/
│   ├── local.postman_environment.json      baseUrl = http://localhost:3000/api
│   └── remoto.postman_environment.json     baseUrl = https://<servidor>/api
└── README.md                               instrucciones de uso
```

Las carpetas, en el orden en que se ejecutan:

```
00 Setup (15) ──► 01 Auth (9) ──► 02 Alumnos (32) ──► 03 Administradores (12)
   │ login admin, crea alumnos,                                     │
   │ autos, profesor, tramos;                                       ▼
   │ guarda tokens e ids            04 Autos (15) ──► 05 Profesores (19) ──► 06 Horario de la escuela (13)
   │                                                                │
   │ (variables de colección)                                       ▼
   └────────────────────────────►  07 Clases (30) ──► 08 Errores generales (5) ──► 09 Validación de campos y tipos (32)
                                                                                         │
                                                                                         ▼
                                                                                   99 Teardown (10)
                                                                     deja el horario como estaba,
                                                                     borra alumnos, saca autos de servicio
```

---

## El recorrido

### 1. Preparar

1. Configurar `.env` y levantar la API: `npm run dev`.
2. Si la base está vacía, crear el primer admin: `npm run admin:bootstrap` o
   `npm run admin:desde-env`.
3. En Postman, **Import** → arrastrar la carpeta `postman/`.
4. Elegir el environment `DriveAndLearn — local` y completar `adminEmail` y
   `adminPassword`.

**La contraseña va solo en *Current value*.** Postman tiene dos valores por
variable: el *Initial value* se exporta (y terminaría en el repo), y el
*Current value* queda solo en tu máquina.

### 2. Correr

Clic derecho en la colección → **Run collection** → orden por defecto →
**Run**. Para correr **una carpeta suelta**, hay que correr antes `00 Setup`,
que es el que genera los tokens y los ids. `07 Clases` además supone que el
alumno 1 tiene exactamente 2 clases de saldo: para repetirla, volvé a correr
el Setup.

**Tests que fallan a propósito.** Si se encuentra un problema en la API, la
convención es escribir la request con el comportamiento **correcto** y poner
"hallazgo (I-NN)" en el nombre: queda en rojo hasta que se corrija la
inconsistencia de [`../inconsistencias.md`](../inconsistencias.md). Hoy no hay
ninguno: los 12 de `09 Validación de campos y tipos` pasaron a verde cuando cada
endpoint tuvo su DTO.

### 3. Anatomía de un request

Tomemos uno de `07 Clases`:

```
Nombre:   [400] Clase de 2 horas                ← [status esperado] qué se prueba
Método:   POST {{baseUrl}}/clases
Auth:     Bearer {{tokenAlumno}}                 ← sobrescribe el de la colección
Body:     { "profesor": "{{profesorId}}", "auto": "{{autoId}}",
            "inicio": "{{inicio}}", "fin": "{{fin}}" }

Pre-request (corre ANTES de enviar):
  pm.collectionVariables.set('inicio', utils.fechaIso(pm, fechaClase, 10, 0));
  pm.collectionVariables.set('fin',    utils.fechaIso(pm, fechaClase, 12, 0));

Post-response (corre DESPUÉS, son los tests):
  utils.esperarError(pm, 400, "exactamente una hora");
```

- **`{{variable}}`** se reemplaza por su valor antes de enviar el pedido.
- **Auth:** la colección usa `Bearer {{tokenAdmin}}` por defecto. Los requests
  de otro rol lo sobrescriben (`{{tokenAlumno}}`), y los públicos (login,
  registro) usan *No Auth*.
- **Pre-request** prepara datos. **Post-response** comprueba la respuesta con
  `pm.test(...)` y `pm.expect(...)`.

### 4. Variables: tres niveles

| Nivel | Dónde se define | Ejemplos | Quién lo cambia |
|---|---|---|---|
| **Environment** | `environments/*.json` | `baseUrl`, `adminEmail`, `offsetZona`, `modoSeguro`, `maxTiempoMs` | Vos, según contra qué servidor corrés |
| **Colección** | `variable` de la colección | `tokenAdmin`, `alumnoId`, `autoId`, `fechaClase`, `runId` | Los scripts, mientras corre |
| **Local** | `var` dentro de un script | `var body = pm.response.json()` | Solo existe en ese script |

Así se **encadenan** los requests:

```
[201] Admin crea auto
   post-response: utils.guardarId(pm, 'autoId')   → autoId = "665f..."
                                │
                                ▼
[200] Admin pone el auto fuera de servicio
   URL: {{baseUrl}}/autos/{{autoId}}/activo       → /autos/665f.../activo
```

**`runId`, para no chocar con corridas anteriores.** El primer request del
Setup guarda `runId = Date.now()`, y todo lo que crea la corrida lo incluye
(emails, patentes). Así la colección se puede correr muchas veces contra la
misma base sin errores de "email ya en uso".

**`fechaClase`.** El mismo request calcula una fecha a **7 días** de hoy, en
la zona de la escuela, y su día de la semana (`diaClase`). Las clases se
reservan en esa fecha, así que siempre son futuras.

### 5. Los helpers compartidos: `utils`

El script *Pre-request* **de la colección** corre antes de cada request y
define un objeto `utils`:

| Helper | Qué hace |
|---|---|
| `utils.esperarStatus(pm, 200)` | Test: el status es exactamente ese. |
| `utils.esperarError(pm, 400, "texto")` | Test: status, más que `mensaje` **incluya** el texto (no exige igualdad, para no romperse con cambios menores de redacción). |
| `utils.guardarId(pm, 'autoId')` | Test: la respuesta trae `_id`, y lo guarda en una variable. |
| `utils.ultimoTramoId(calendario, dia)` | El `_id` del último tramo de un día (el recién agregado). |
| `utils.fechaIso(pm, fecha, hh, mm)` | Arma `"2026-10-29T10:00:00-03:00"` usando `offsetZona`. |
| `utils.saltearSiModoSeguro(pm)` | Saltea el request si `modoSeguro = true`. |

Dos detalles de JavaScript en Postman:

- `utils` se define **sin** `var`/`let`/`const` a propósito: así queda global
  y visible desde los scripts de cada request.
- Los helpers reciben `pm` **como parámetro**. Cada script tiene su propio
  `pm`, y el del pre-request de la colección no tiene `response`. Si los
  helpers usaran ese `pm`, `pm.response` sería `undefined` dentro de un test.

### 6. Los tests globales

El script *Post-response* **de la colección** corre después de **cada**
request y comprueba reglas que valen para toda la API:

```
[global] Tiempo de respuesta < maxTiempoMs        (1000 ms por defecto)
[global] La respuesta es JSON                      (salvo 204)
[global] Ninguna respuesta incluye "password"      (lo busca recursivamente en todo el JSON)
[global] Los errores traen un "mensaje" string     (status >= 400)
```

El tercero es una red de seguridad que verifica en **todas** las respuestas
lo que hace `toJSON.transform` en el modelo `Usuario` (ver
[`08-models.md`](08-models.md#5-las-opciones-del-esquema)).

### 7. Controlar el flujo de la corrida

- **Cortar todo si falla el login del admin.** Sin token, el resto de la
  corrida no tiene sentido:
  ```js
  if (pm.response.code !== 200) {
    console.error('No se pudo loguear al admin: revisá baseUrl, adminEmail y adminPassword...');
    pm.execution.setNextRequest(null);   // no ejecutar nada más
  }
  ```
- **`modoSeguro` contra el servidor desplegado.** `PUT /horario-escuela`
  **reemplaza todo** el horario de la escuela. En el environment `remoto`,
  `modoSeguro = true`, y esos requests llaman a `utils.saltearSiModoSeguro(pm)`
  → `pm.execution.skipRequest()`.

### 8. Limpieza: `99 Teardown`

La corrida deja la base lo más parecida posible a como estaba:

- Saca de servicio los autos creados (el tercero ya quedó inactivo en el
  Setup).
- Quita la disponibilidad del profesor y el tramo que agregó al horario, y
  **verifica** que el horario de la escuela quede igual al original, que se
  guardó al principio en `horarioOriginal`.
- Borra los 4 alumnos: el admin borra a dos, y los otros dos se borran a sí
  mismos. El admin extra ya se había borrado en `03 Administradores`.
- Por último, comprueba que el token de un alumno borrado ya no sirve (403).

La API no tiene `DELETE` para profesores, autos ni clases, así que quedan en
la base, marcados con `[POSTMAN]` o con una patente que empieza con `PM`.

### 9. Modificar la colección

1. Editar en Postman.
2. Colección → **…** → **Export** → *Collection v2.1* → sobrescribir
   `postman/DriveAndLearn.postman_collection.json`.
3. Si cambiaste un environment, exportalo también, y revisá que `adminPassword`
   **no** tenga *Initial value*.
4. Commitear. El JSON se puede revisar en el diff como cualquier archivo.

**Desde la terminal.** La colección también se puede correr con **Newman**,
el runner de Postman para la línea de comandos, que no está instalado en el
proyecto:

```bash
npx newman run postman/DriveAndLearn.postman_collection.json \
  -e postman/environments/local.postman_environment.json \
  --env-var adminEmail=... --env-var adminPassword=...
```

Algunas funciones que usa la colección, como `pm.execution.skipRequest()`,
requieren una versión reciente de Newman.

---

## Qué puede salir mal

| Síntoma | Causa |
|---|---|
| Todo da 401, o URLs con `{{autoId}}` vacío | No se corrió `00 Setup` antes, o falló el login del admin (mirá la consola de Postman). |
| `07 Clases` falla por saldo | Se repitió la carpeta sin volver a correr el Setup (el alumno 1 ya gastó sus 2 clases). |
| `[global] Tiempo de respuesta` falla | El servidor está lento (por ejemplo, un deploy gratuito que "despierta"). Subí `maxTiempoMs` en el environment. |
| La contraseña del admin aparece en el repo | Se cargó como *Initial value* y se exportó el environment. |
| El horario de la escuela quedó distinto | Se cortó la corrida antes del Teardown. Corré solo `99 Teardown` (necesita las variables del Setup). |
| `404 Ruta no encontrada` en horario | La colección es de antes del renombre: la URL actual es `/horario-escuela`. |

---

## Resumen

- Postman prueba la API **levantada de verdad**, como un cliente real.
  Complementa a Vitest, no lo reemplaza.
- Las carpetas corren **en orden**: el Setup prepara tokens, ids y fechas en
  variables de colección, y el Teardown limpia.
- `{{variables}}` en tres niveles: environment (configuración), colección (lo
  que generan los scripts) y local.
- `utils` (pre-request de la colección) da helpers reutilizables, y los tests
  globales (post-response de la colección) comprueban reglas de toda la API en
  cada request.
- `runId` permite repetir la corrida, y `modoSeguro` protege al servidor
  desplegado.

**Siguiente lectura:** [`../flujos/registro-y-login.md`](../flujos/registro-y-login.md).
