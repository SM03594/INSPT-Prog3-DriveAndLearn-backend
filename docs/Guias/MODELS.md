# Guía de Modelos (DriveAndLearn Backend)

Esta guía documenta la capa **Model** dentro de la arquitectura de **DriveAndLearn**, sus principios de diseño, esquemas de persistencia en MongoDB y el detalle técnico de cada modelo implementado.

---

## 1. Principios de Diseño de la Capa Model

1. **Responsabilidad Única (SRP):** Define exclusivamente los esquemas de Mongoose (`Schema`), tipos de datos almacenados en base de datos, restricciones estructurales (`required`, `unique`, `match`, `min`, `max`, `enum`), índices y transformaciones de serialización (`toJSON`).
2. **Sin lógica de aplicación:** Un modelo nunca orquesta casos de uso de negocio ni se acopla a peticiones HTTP. La lógica de negocio reside estrictamente en los **Services**.
3. **Herencia mediante Discriminadores:** Permite modelar jerarquías en una misma colección (ej. `Usuario` como base con discriminadores para `Alumno` y `Administrador`).
4. **Sanitización automática (`toJSON`):** Todos los esquemas configuran la propiedad `toJSON.transform` para omitir propiedades internas de MongoDB como `__v` o datos confidenciales como `password`.

---

## 2. Modelos Implementados

### 2.1. `TokenRevocado.js`

Modelo utilizado para almacenar los tokens JWT revocados antes de su expiración natural (lista negra para el cierre de sesión / logout seguro).

- **Colección en MongoDB:** `tokens_revocados`
- **Archivo:** `src/models/TokenRevocado.js`

#### Esquema de Campos:

| Campo | Tipo Mongoose | Restricciones / Validaciones | Descripción |
| :--- | :--- | :--- | :--- |
| **`token`** | `String` | `required`, `unique: true`, `trim: true` | Cadena de texto del token JWT revocado durante el logout. |
| **`expiraEn`** | `Date` | `required` | Fecha y hora en la que el token expira de forma natural (extraída del claim `exp` del JWT). |
| **`createdAt`** | `Date` | Automático (`timestamps: true`) | Marca temporal de cuándo se revocó el token. |
| **`updatedAt`** | `Date` | Automático (`timestamps: true`) | Marca temporal de última actualización. |

#### Optimización con Índice TTL (*Time-To-Live*):

```javascript
tokenRevocadoSchema.index({ expiraEn: 1 }, { expireAfterSeconds: 0 });
```

- **Mecanismo:** MongoDB cuenta con un hilo interno de monitoreo TTL (*TTL monitor thread*) que escanea los índices con la opción `expireAfterSeconds`.
- **Comportamiento:** En cuanto la fecha del sistema supera el valor almacenado en `expiraEn`, MongoDB **elimina automáticamente el documento** de la colección.
- **Beneficio:** Evita el crecimiento desmedido de la base de datos sin requerir scripts adicionales de limpieza periódica ni tareas cron.

#### Serialización (`toJSON`):
Excluye la propiedad interna `__v` de Mongoose para entregar objetos limpios.

---

### 2.2. Resumen de Otros Modelos del Sistema

| Modelo | Colección | Descripción Principal |
| :--- | :--- | :--- |
| **`Usuario`** | `usuarios` | Modelo base con `NomApe`, `email`, `password` hasheada y discriminador `rol`. |
| **`Alumno`** | `usuarios` (discriminador) | Extiende de `Usuario` agregando el control de `saldoClases`. |
| **`Administrador`** | `usuarios` (discriminador) | Extiende de `Usuario` para la gestión de recursos de la escuela. |
| **`Auto`** | `autos` | Vehículos de la flota (`marca`, `modelo`, `patente` argentina, `cambios`, `activo`). |
| **`Profesor`** | `profesores` | Docentes con su `NomApe` y su esquema embebido de `disponibilidad` semanal. |
| **`Clase`** | `clases` | Reservas vinculadas a `alumno`, `profesor`, `auto`, con `inicio` y `fin`. |

