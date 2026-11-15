import { connectDB, disconnectDB } from '../config/db.js';
import { obtenerAdminInicial } from '../config/env.js';
import Usuario from '../models/Usuario.js';
import * as administradorService from '../services/administradorService.js';

async function bootstrapAdmin() {
  try {
    // 1. Obtener y validar variables de entorno requeridas (ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NOMAPE)
    const { email, password, nomApe } = obtenerAdminInicial();

    // 2. Conectar a MongoDB
    await connectDB();

    // 3. Verificar si ya existe un usuario con ese email (garantía de idempotencia)
    const adminExistente = await Usuario.findOne({ email });

    if (adminExistente) {
      console.log(
        `ℹ️ El administrador (${email}) ya se encuentra registrado. No se realizaron cambios.`
      );
      return;
    }

    // 4. Crear el administrador a través del servicio de dominio (valida y hashea password con bcrypt)
    const nuevoAdmin = await administradorService.crear({
      NomApe: nomApe,
      email,
      password,
    });

    console.log(
      `✅ Administrador inicial creado con éxito: ${nuevoAdmin.email} (ID: ${nuevoAdmin._id})`
    );
  } catch (error) {
    console.error('❌ Error durante el bootstrap del administrador:', error.message);
    process.exitCode = 1;
  } finally {
    // 5. Cerrar la conexión a la base de datos de forma limpia
    await disconnectDB();
  }
}

bootstrapAdmin();
