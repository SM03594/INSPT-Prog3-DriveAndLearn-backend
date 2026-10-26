// ============================================================
//  bootstrapAdminDesdeEnv.ts — Primer administrador desde el .env
// ============================================================
// Igual que bootstrapAdmin.ts, pero sin preguntar nada: toma el
// email, la contraseña y el nombre de ADMIN_EMAIL, ADMIN_PASSWORD y
// ADMIN_NOMAPE (ver config/env.ts). Sirve para levantar la app en un
// entorno sin terminal interactiva (un deploy, por ejemplo).
//
// Se puede correr siempre antes de iniciar la app: si ya existe algún
// administrador, no hace nada y termina sin error.
//
//   npm run admin:desde-env

import { AdministradorModel } from '../models/Administrador.js';
import { crear } from '../services/administrador.service.js';
import { obtenerPorEmail } from '../services/usuario.service.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { obtenerAdminInicial } from '../config/env.js';

async function main(): Promise<void> {
  // Se lee antes de conectar: si falta algo en el .env, falla rápido.
  const datos = obtenerAdminInicial();

  await connectDB();
  try {
    if (await AdministradorModel.exists({})) {
      console.log('Ya existe un administrador: no se crea otro.');
      return;
    }

    // El email es único entre todos los usuarios: si ya lo usa un
    // alumno, create() fallaría con un error crudo de MongoDB.
    if ((await obtenerPorEmail(datos.email)) !== null) {
      throw new Error(`El email ${datos.email} ya lo usa otro usuario`);
    }

    // crear() hashea la contraseña y valida su largo mínimo. El spread
    // copia los campos a un objeto literal: DatosAdminInicial es una
    // interface, y una interface no se puede pasar donde se espera
    // Record<string, unknown> (le falta la index signature).
    const administrador = await crear({ ...datos });
    console.log(`Administrador inicial creado: ${administrador.email}`);
  } finally {
    await disconnectDB();
  }
}

main().catch((error: unknown) => {
  console.error(
    'No se pudo crear el administrador inicial:',
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
