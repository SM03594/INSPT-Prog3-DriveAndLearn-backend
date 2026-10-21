# Tests de la API con Postman

Colección de Postman que prueba la API de DriveAndLearn de punta a punta, tal
como la ve un cliente real. El plan completo (decisiones, casos y hallazgos)
está en [`docs/plan-tests-postman.md`](../docs/plan-tests-postman.md).

```
postman/
├── DriveAndLearn.postman_collection.json   # 10 carpetas, 163 requests
└── environments/
    ├── local.postman_environment.json      # http://localhost:3000/api
    └── remoto.postman_environment.json     # servidor desplegado
```

## 1. Antes de empezar

**Local**

1. Configurar `.env` (ver `.env.example`) y levantar la API: `npm run dev`.
2. Si la base está vacía, crear el admin inicial: `npm run admin:bootstrap`.

**Remoto**: hace falta un admin del servidor y completar `baseUrl` en el
environment `remoto` (reemplazar `https://<servidor>/api`).

## 2. Importar

1. Postman → **Import** → arrastrar la carpeta `postman/`.
2. Elegir el environment (`DriveAndLearn — local` o `— remoto`) arriba a la derecha.
3. En el environment, completar `adminEmail` y `adminPassword`.
   **La contraseña va solo en *Current value***: Postman no exporta ese valor, así
   que nunca termina en el repo.

| Variable | Para qué |
|---|---|
| `baseUrl` | Prefijo de todas las URLs. |
| `adminEmail` / `adminPassword` | Admin con el que arranca la corrida. |
| `offsetZona` | Offset de la zona de la escuela (`-03:00`) para armar las fechas de las clases. |
| `modoSeguro` | `true` en remoto: saltea los `PUT /horario`, que reemplazan el horario completo de la escuela. |
| `maxTiempoMs` | Tiempo máximo de respuesta aceptado (test global). |

## 3. Correr

Clic derecho en la colección → **Run collection** → dejar el orden por defecto →
**Run**. Las carpetas se corren en orden:

| Carpeta | Qué prueba |
|---|---|
| `00 Setup` | Login del admin y datos de la corrida: 4 alumnos, autos, profesor, tramo propio en el horario. |
| `01 Auth` | Login y JWT (401). |
| `02 Alumnos` | Registro, permisos propios / de admin, saldo de clases. |
| `03 Administradores` | Alta, edición, baja y token de un admin borrado. |
| `04 Autos` | CRUD y puesta fuera de servicio. |
| `05 Profesores` | Alta, edición, foto y disponibilidad. |
| `06 Horario de la escuela` | Horario semanal y el alias `/calendario-semanal`. |
| `07 Clases` | Reservas: fechas, horarios, solapamientos, saldo, permisos, cancelación. |
| `08 Errores generales` | Ruta inexistente y bodies ilegibles. |
| `99 Teardown` | Limpieza: deja el horario como estaba y borra los alumnos. |

**Correr una carpeta suelta**: correr antes `00 Setup` (genera los tokens y los
ids que usan las demás). `07 Clases` además supone que el alumno 1 tiene 2 clases:
para repetirla, volver a correr el Setup.

### Tests que fallan a propósito

Hoy no hay ninguno: contra la API local pasan todos. Si se encuentra un problema
nuevo en la API, la convención es escribir el test con el comportamiento
correcto, poner "hallazgo" en el nombre del request y anotarlo en §7 del plan;
cuando se corrija, el test pasa a verde solo.

## 4. Convenciones

- **Nombres**: `[status esperado] Quién hace qué`.
- **Auth**: la colección usa `Bearer {{tokenAdmin}}`; los requests de otro rol lo
  sobrescriben (`{{tokenAlumno}}`, `{{tokenAlumno2}}`…) y los públicos usan *No Auth*.
- **Datos únicos**: todo lo que crea una corrida lleva `{{runId}}` (la hora en
  milisegundos), así se puede correr muchas veces contra la misma base.
- **Helpers**: el *Pre-request* de la colección define `utils` (`esperarStatus`,
  `esperarError`, `guardarId`, `fechaIso`, `diaSemana`…), disponible en todos los scripts.
  Los que usan `pm` lo reciben como primer parámetro: `utils.esperarStatus(pm, 200)`.
  En Postman cada script tiene su propio `pm`, y el del pre-request de la colección
  no tiene `response`; si el helper usara ese, el test fallaría con
  `Cannot read properties of undefined (reading 'to')`.
- **Tests globales** (*Post-response* de la colección, corren en cada request):
  respuesta JSON, tiempo < `maxTiempoMs`, nunca aparece `password`, y los errores
  traen un `mensaje`.

## 5. Qué queda en la base

La API no tiene `DELETE` para profesores, autos ni clases, así que después de cada
corrida quedan, marcados con `[POSTMAN]` / patente `PM…`: 2 profesores, 3 autos
fuera de servicio y las clases de prueba. Los alumnos y el admin de prueba se borran,
y el horario de la escuela vuelve a ser el original (el Teardown lo verifica).

## 6. Modificar la colección

1. Editar en Postman.
2. Colección → **…** → **Export** → *Collection v2.1* → sobrescribir
   `postman/DriveAndLearn.postman_collection.json`.
3. Si se cambió un environment: exportarlo también, revisando que `adminPassword`
   no tenga *Initial value*.
4. Commitear.
