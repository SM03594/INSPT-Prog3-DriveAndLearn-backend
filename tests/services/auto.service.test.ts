// ============================================================
//  auto.service.test.ts — Tests de la CAPA SERVICE de Autos
// ============================================================


import { describe, it, expect } from 'vitest';
import { setupTestDB } from '../setupTestDB.js';
import {
  listar,
  obtenerPorId,
  crear,
  actualizar,
  cambiarEstado,
} from '../../src/services/auto.service.js';
import type { AutoInterface } from '../../src/models/Auto.js';

// Registra los hooks (Mongo en memoria, limpiar entre tests, cerrar).
setupTestDB();

// Datos de ejemplo reutilizables.
const datosValidos: AutoInterface = {
  marca: 'Toyota',
  modelo: 'Corolla',
  patente: 'AB123CD',
  cambios: 'automatico',
  activo: true,
};

// Un ObjectId con forma válida pero que no existe en la base.
const ID_INEXISTENTE = '64b7f0f0f0f0f0f0f0f0f0f0';

describe('auto.service', () => {
  
  describe('crear', () => {
    it('guarda el auto y le asigna un _id', async () => {
      const auto = await crear(datosValidos);

      expect(auto._id).toBeDefined();
      expect(auto.marca).toBe('Toyota');
      expect(auto.cambios).toBe('automatico');
    });

    it('normaliza la patente a mayúsculas (uppercase del esquema)', async () => {
      const auto = await crear({ ...datosValidos, patente: 'xy999zz' });
      expect(auto.patente).toBe('XY999ZZ');
    });

    it('pone activo=true por defecto si no se especifica', async () => {
      // activo: _omitido hace que el atributo activo se guarde en la varible _omitido
      // mientras que el resto de los atributos en sinActivo
      const { activo: _omitido, ...sinActivo } = datosValidos;
      const auto = await crear(sinActivo as AutoInterface);

      expect(auto.activo).toBe(true);
    });

    it('tira ValidationError si falta la patente', async () => {
      const { patente: _omitido, ...sinPatente } = datosValidos;

      await expect(crear(sinPatente as AutoInterface)).rejects.toThrow(
        /patente es obligatoria/,
      );
    });

    it('tira ValidationError si "cambios" no está en el enum', async () => {
      await expect(
        crear({ ...datosValidos, cambios: 'cohete' as AutoInterface['cambios'] }),
      ).rejects.toThrow(/cambios/);
    });

    it('tira un error con mensaje humano si la patente ya existe', async () => {
      await crear(datosValidos);

      await expect(crear(datosValidos)).rejects.toThrow(
        /Ya existe un auto con esos datos./,
      );
    });
  });

  // --------------------------------------------------------
  //  listar
  // --------------------------------------------------------
  describe('listar', () => {
    it('devuelve [] cuando no hay autos', async () => {
      expect(await listar()).toEqual([]);
    });

    it('devuelve todos los autos creados', async () => {
      await crear(datosValidos);
      await crear({ ...datosValidos, patente: 'CD456EF' });
      await crear({ ...datosValidos, patente: 'ABC8741' });

      expect(await listar()).toHaveLength(3);
    });
  });

  // --------------------------------------------------------
  //  obtenerPorId
  // --------------------------------------------------------
  describe('obtenerPorId', () => {
    it('devuelve el auto pedido', async () => {
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
        modelo: 'Yaris',
      });

      expect(actualizado?.modelo).toBe('Yaris');
      expect(actualizado?.marca).toBe('Toyota'); // intacto
    });

    it('devuelve null si el auto no existe', async () => {
      expect(await actualizar(ID_INEXISTENTE, { modelo: 'X' })).toBeNull();
    });

    it('tira ValidationError si se manda un "cambios" inválido (runValidators)', async () => {
      const creado = await crear(datosValidos);

      await expect(
        actualizar(creado._id.toString(), {
          cambios: 'cohete' as AutoInterface['cambios'],
        }),
      ).rejects.toThrow(/cambios/);
    });
  });

  // --------------------------------------------------------
  //  cambiarEstado  (baja / alta, sin borrar)
  // --------------------------------------------------------
  describe('cambiarEstado', () => {
    it('cambia "activo" y devuelve el doc con el estado nuevo', async () => {
      const creado = await crear(datosValidos);

      const res = await cambiarEstado(creado._id.toString(), false);

      expect(res?.activo).toBe(false);
    });

    it('vuelve a poner el auto en servicio (activo: true)', async () => {
      const creado = await crear({ ...datosValidos, activo: false });

      const res = await cambiarEstado(creado._id.toString(), true);

      expect(res?.activo).toBe(true);
    });

    it('devuelve null si el auto no existe', async () => {
      expect(await cambiarEstado(ID_INEXISTENTE, false)).toBeNull();
    });
  });
});
