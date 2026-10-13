import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { AdministradorModel } from '../models/Administrador.js';
import { crear } from '../services/administrador.service.js';
import { connectDB, disconnectDB } from '../config/db.js';

function preguntar(texto: string): Promise<string> {
  const readline = createInterface({ input: stdin, output: stdout });
  return readline.question(texto).finally(() => readline.close());
}

function preguntarPasswordOculta(): Promise<string> {
  if (!stdin.isTTY) {
    return Promise.reject(
      new Error('Este comando necesita una terminal interactiva para ocultar la contraseña'),
    );
  }

  return new Promise((resolve, reject) => {
    let password = '';
    stdout.write('Contraseña (mínimo 8 caracteres, no se mostrará): ');
    stdin.setRawMode(true);
    stdin.resume();

    const finalizar = (error?: Error) => {
      stdin.setRawMode(false);
      stdin.off('data', alRecibirDatos);
      stdout.write('\n');
      if (error !== undefined) reject(error);
      else resolve(password);
    };

    const alRecibirDatos = (datos: Buffer) => {
      for (const caracter of datos.toString('utf8')) {
        if (caracter === '\u0003') {
          finalizar(new Error('Operación cancelada'));
          return;
        }
        if (caracter === '\r' || caracter === '\n') {
          finalizar();
          return;
        }
        if (caracter === '\u007f' || caracter === '\b') {
          password = Array.from(password).slice(0, -1).join('');
        } else if (caracter >= ' ') {
          password += caracter;
        }
      }
    };

    stdin.on('data', alRecibirDatos);
  });
}

async function main(): Promise<void> {
  const email = (await preguntar('Email del administrador: ')).trim().toLowerCase();
  const nomApe = (await preguntar('Nombre y apellido: ')).trim();
  const password = await preguntarPasswordOculta();

  if (email.length === 0 || nomApe.length === 0) {
    throw new Error('El email y el nombre y apellido son obligatorios');
  }
  if (password.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres');
  }

  await connectDB();
  try {
    if (await AdministradorModel.exists({})) {
      throw new Error(
        'Ya existe un administrador. Para crear otros, inicia sesión y usa POST /api/administradores.',
      );
    }

    const administrador = await crear({ email, nomApe, password });
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
