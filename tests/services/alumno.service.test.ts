// ============================================================
//  alumno.service.test.ts — Tests de la CAPA SERVICE de Alumnos
// ============================================================

import { describe, it, expect } from 'vitest';
import { setupTestDB } from '../setupTestDB.js';
import {
  listar,
  obtenerPorId,
  crear,
  actualizar,
  sumarClasesPorReservar,
  restarClasesPorReservar,
} from '../../src/services/alumno.service.js';
import { AlumnoModel, type Alumno } from '../../src/models/Alumno.js';
import { ErrorClaveDuplicada } from '../../src/errors/errorClaveDuplicada.js';
import { ErrorDeNegocio } from '../../src/errors/errorDeNegocio.js';

// Registra los hooks (Mongo en memoria, limpiar entre tests, cerrar).
setupTestDB();

// Datos de ejemplo reutilizables.
const datosValidos: Omit<Alumno, 'clasesPorReservar'> = {
  email: 'ana@example.com',
  password: 'unHashDeBcrypt',
  nomApe: 'Ana Pérez',
};

async function crearConSaldo(clasesPorReservar: number) {
  const alumno = await crear(datosValidos);
  const actualizado = await sumarClasesPorReservar(
    alumno._id.toString(),
    clasesPorReservar,
  );
  if (actualizado === null) throw new Error('El alumno de prueba no existe');
  return actualizado;
}

// Un ObjectId con forma válida pero que no existe en la base.
const ID_INEXISTENTE = '64b7f0f0f0f0f0f0f0f0f0f0';

describe('alumno.service', () => {
  // --------------------------------------------------------
  //  crear
  // --------------------------------------------------------
  describe('crear', () => {
    it('guarda el alumno y le asigna un _id', async () => {
      const alumno = await crear(datosValidos);

      expect(alumno._id).toBeDefined();
      expect(alumno.email).toBe('ana@example.com');
      expect(alumno.nomApe).toBe('Ana Pérez');
    });

    it('guarda la contraseña hasheada, no en texto plano', async () => {
      const alumno = await crear(datosValidos);

      expect(alumno.password).not.toBe('unHashDeBcrypt');
      expect(alumno.password).toMatch(/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/);
    });

    it('normaliza el email a minúsculas (lowercase del esquema)', async () => {
      const alumno = await crear({ ...datosValidos, email: 'ANA@Example.COM' });
      expect(alumno.email).toBe('ana@example.com');
    });

    it('acepta el email con espacios y mayúsculas: trim y lowercase corren antes del match', async () => {
      const alumno = await crear({ ...datosValidos, email: '  Ana@Example.COM ' });
      expect(alumno.email).toBe('ana@example.com');
    });

    it.each(['hola', 'ana@example', 'ana perez@example.com', '@example.com', 'ana@@example.com'])(
      'rechaza un email sin formato válido (%s)',
      async (email) => {
        await expect(crear({ ...datosValidos, email })).rejects.toThrow(
          'El email no tiene un formato válido',
        );
      },
    );

    it('pone clasesPorReservar=0 por defecto si no se especifica', async () => {
      const alumno = await crear(datosValidos);

      expect(alumno.clasesPorReservar).toBe(0);
    });

    it('rechaza que el cliente envíe clasesPorReservar', async () => {
      await expect(
        crear({ ...datosValidos, clasesPorReservar: 100 }),
      ).rejects.toThrow(/clasesPorReservar/);
    });

    it.each([
      [{ email: 123, password: 'clave', nomApe: 'Ana' }],
      [{ email: 'ana@example.com', password: null, nomApe: 'Ana' }],
      [{ email: 'ana@example.com', password: 'clave', nomApe: false }],
    ])('rechaza tipos inválidos al crear (%j)', async (datos) => {
      await expect(crear(datos)).rejects.toThrow(
        'Email, contraseña y nombre y apellido son obligatorios',
      );
    });

    it('rechaza si falta el email', async () => {
      const { email: _omitido, ...sinEmail } = datosValidos;

      await expect(crear(sinEmail)).rejects.toThrow(
        'Email, contraseña y nombre y apellido son obligatorios',
      );
    });

    it('rechaza si falta la password', async () => {
      const { password: _omitido, ...sinPassword } = datosValidos;

      await expect(crear(sinPassword)).rejects.toThrow(
        'Email, contraseña y nombre y apellido son obligatorios',
      );
    });

    it('rechaza campos extra aunque su valor sea válido', async () => {
      await expect(
        crear({ ...datosValidos, rol: 'administrador' }),
      ).rejects.toThrow(/rol/);
    });

    it('tira ErrorClaveDuplicada (409) si el email ya existe', async () => {
      await crear(datosValidos);

      // crear() atrapa el 11000 crudo y lo relanza como
      // ErrorClaveDuplicada (ver alumno.service.ts / errorClaveDuplicada.ts).
      const promesa = crear(datosValidos);
      await expect(promesa).rejects.toBeInstanceOf(ErrorClaveDuplicada);
      await expect(promesa).rejects.toMatchObject({ status: 409 });
      await expect(promesa).rejects.toThrow(/email/i);
    });
  });

  // --------------------------------------------------------
  //  listar
  // --------------------------------------------------------
  describe('listar', () => {
    it('devuelve [] cuando no hay alumnos', async () => {
      expect(await listar()).toEqual([]);
    });

    it('devuelve todos los alumnos creados', async () => {
      await crear(datosValidos);
      await crear({ ...datosValidos, email: 'beto@example.com' });
      await crear({ ...datosValidos, email: 'caro@example.com' });

      expect(await listar()).toHaveLength(3);
    });
  });

  // --------------------------------------------------------
  //  obtenerPorId
  // --------------------------------------------------------
  describe('obtenerPorId', () => {
    it('devuelve el alumno pedido', async () => {
      const creado = await crear(datosValidos);
      const encontrado = await obtenerPorId(creado._id.toString());

      expect(encontrado?._id.toString()).toBe(creado._id.toString());
    });

    it('devuelve null si el id no existe', async () => {
      expect(await obtenerPorId(ID_INEXISTENTE)).toBeNull();
    });

    it('tira CastError si el id no tiene forma de ObjectId', async () => {
      await expect(obtenerPorId('no-es-un-objectid')).rejects.toThrow();
    });
  });

  // --------------------------------------------------------
  //  actualizar
  // --------------------------------------------------------
  describe('actualizar', () => {
    it('modifica solo los campos enviados y devuelve el doc actualizado', async () => {
      const creado = await crear(datosValidos);

      const actualizado = await actualizar(creado._id.toString(), {
        nomApe: 'Ana Gómez',
      });

      expect(actualizado?.nomApe).toBe('Ana Gómez');
      expect(actualizado?.email).toBe('ana@example.com'); // intacto
    });

    it('devuelve null si el alumno no existe', async () => {
      expect(
        await actualizar(ID_INEXISTENTE, { nomApe: 'X' }),
      ).toBeNull();
    });

    it('hashea la contraseña si se actualiza', async () => {
      const creado = await crear(datosValidos);

      const actualizado = await actualizar(creado._id.toString(), {
        password: 'nuevaPassword123',
      });

      expect(actualizado?.password).not.toBe('nuevaPassword123');
      expect(actualizado?.password).toMatch(/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/);
    });

    it('no toca la contraseña si no viene en los cambios', async () => {
      const creado = await crear(datosValidos);

      const actualizado = await actualizar(creado._id.toString(), {
        nomApe: 'Ana Editada',
      });

      expect(actualizado?.password).toBe(creado.password);
    });

    it('rechaza clasesPorReservar: el saldo se cambia con sumar/restar', async () => {
      const creado = await crear(datosValidos);

      const promesa = actualizar(creado._id.toString(), { clasesPorReservar: 5 });
      await expect(promesa).rejects.toBeInstanceOf(ErrorDeNegocio);
      await expect(promesa).rejects.toThrow(
        'No se pueden modificar estos campos: clasesPorReservar (el saldo de clases se cambia con sumar-clases / restar-clases)',
      );
    });

    it.each([
      [{ rol: 'administrador' }, 'rol'],
      [{ _id: ID_INEXISTENTE }, '_id'],
      [{ nomApe: 'X', color: 'rojo' }, 'color'],
    ])('rechaza campos que no se pueden modificar (%j)', async (cambios, campo) => {
      const creado = await crear(datosValidos);

      await expect(actualizar(creado._id.toString(), cambios)).rejects.toThrow(
        `No se pueden modificar estos campos: ${campo}`,
      );
    });

    it('rechaza un objeto vacío', async () => {
      const creado = await crear(datosValidos);

      await expect(actualizar(creado._id.toString(), {})).rejects.toThrow(
        'Debe indicarse al menos un campo para actualizar',
      );
    });

    it.each([
      [{ email: 123 }, 'El email debe ser un texto'],
      [{ nomApe: 123 }, 'El nombre y apellido debe ser un texto'],
      [{ nomApe: null }, 'El nombre y apellido debe ser un texto'],
      [{ password: 12345678 }, 'La contraseña debe ser un texto'],
    ])('rechaza tipos incorrectos (%j)', async (cambios, mensaje) => {
      const creado = await crear(datosValidos);

      await expect(actualizar(creado._id.toString(), cambios)).rejects.toThrow(mensaje);
    });

    it('rechaza un email sin formato válido (runValidators)', async () => {
      const creado = await crear(datosValidos);

      await expect(actualizar(creado._id.toString(), { email: 'hola' })).rejects.toThrow(
        'El email no tiene un formato válido',
      );
    });

    it('valida los cambios antes de buscar al alumno', async () => {
      await expect(actualizar(ID_INEXISTENTE, { color: 'rojo' })).rejects.toThrow(
        /No se pueden modificar/,
      );
    });

    it('tira ErrorClaveDuplicada (409) si el email ya está en uso por otro alumno', async () => {
      await crear(datosValidos);
      const otro = await crear({ ...datosValidos, email: 'beto@example.com' });

      const promesa = actualizar(otro._id.toString(), {
        email: datosValidos.email,
      });
      await expect(promesa).rejects.toBeInstanceOf(ErrorClaveDuplicada);
      await expect(promesa).rejects.toMatchObject({ status: 409 });
      await expect(promesa).rejects.toThrow(/email/i);
    });
  });

  // --------------------------------------------------------
  //  sumarClasesPorReservar  (le suma N clases al saldo actual)
  // --------------------------------------------------------
  // Espera una CANTIDAD a sumar (un delta), no el valor final:
  // si el alumno tenía 3 y sumás 2, queda con 5.
  describe('sumarClasesPorReservar', () => {
    it('suma la cantidad al saldo y devuelve el doc actualizado', async () => {
      const creado = await crearConSaldo(3);

      const res = await sumarClasesPorReservar(creado._id.toString(), 2);

      expect(res?.clasesPorReservar).toBe(5);
    });

    it('devuelve null si el alumno no existe', async () => {
      expect(await sumarClasesPorReservar(ID_INEXISTENTE, 1)).toBeNull();
    });

    // Un alumno guardado antes de que el esquema validara el formato
    // del email: save() revalida el email aunque no cambie, así que
    // no se le puede cargar saldo hasta corregirle el email.
    it('falla si el alumno tiene un email inválido guardado de antes', async () => {
      const { insertedId } = await AlumnoModel.collection.insertOne({
        rol: 'alumno',
        email: 'email-viejo-sin-formato',
        password: 'unHashDeBcrypt',
        nomApe: 'Alumno Viejo',
        clasesPorReservar: 0,
      });

      await expect(sumarClasesPorReservar(insertedId.toString(), 1)).rejects.toThrow(
        'El email no tiene un formato válido',
      );
    });

    it.each([-2, 0])('rechaza una cantidad que no es mayor que 0 (%s)', async (cantidad) => {
      const creado = await crear(datosValidos);

      const promesa = sumarClasesPorReservar(creado._id.toString(), cantidad);
      await expect(promesa).rejects.toBeInstanceOf(ErrorDeNegocio);
      await expect(promesa).rejects.toThrow('La cantidad a sumar debe ser mayor que 0');
    });

    it.each([undefined, null, '2', 1.5, Number.NaN])(
      'rechaza una cantidad que no es un número entero (%s)',
      async (cantidad) => {
        const creado = await crear(datosValidos);

        const promesa = sumarClasesPorReservar(creado._id.toString(), cantidad);
        await expect(promesa).rejects.toBeInstanceOf(ErrorDeNegocio);
        await expect(promesa).rejects.toThrow('La cantidad a sumar debe ser un número entero');
      },
    );

    it('valida la cantidad antes de buscar al alumno', async () => {
      await expect(sumarClasesPorReservar(ID_INEXISTENTE, '2')).rejects.toThrow(
        /número entero/,
      );
    });
  });

  // --------------------------------------------------------
  //  restarClasesPorReservar  (le resta N clases al saldo actual)
  // --------------------------------------------------------
  describe('restarClasesPorReservar', () => {
    it('resta la cantidad al saldo y devuelve el doc actualizado', async () => {
      const creado = await crearConSaldo(3);

      const res = await restarClasesPorReservar(creado._id.toString(), 2);

      expect(res?.clasesPorReservar).toBe(1);
    });

    it('devuelve null si el alumno no existe', async () => {
      expect(await restarClasesPorReservar(ID_INEXISTENTE, 1)).toBeNull();
    });

    it('no deja el saldo por debajo de 0 (min: 0 del esquema)', async () => {
      const creado = await crearConSaldo(3);

      await expect(
        restarClasesPorReservar(creado._id.toString(), 5),
      ).rejects.toThrow(/clasesPorReservar/);
    });

    it.each([-1, 0])('rechaza una cantidad que no es mayor que 0 (%s)', async (cantidad) => {
      const creado = await crear(datosValidos);

      await expect(
        restarClasesPorReservar(creado._id.toString(), cantidad),
      ).rejects.toThrow('La cantidad a restar debe ser mayor que 0');
    });

    it.each([undefined, '1', 0.5])(
      'rechaza una cantidad que no es un número entero (%s)',
      async (cantidad) => {
        const creado = await crear(datosValidos);

        await expect(
          restarClasesPorReservar(creado._id.toString(), cantidad),
        ).rejects.toThrow('La cantidad a restar debe ser un número entero');
      },
    );
  });
});
