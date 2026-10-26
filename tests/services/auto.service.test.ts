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
  listarActivos,
} from '../../src/services/auto.service.js';
import { AutoModel, type Auto } from '../../src/models/Auto.js';
import { ErrorClaveDuplicada } from '../../src/errors/errorClaveDuplicada.js';

// Registra los hooks (Mongo en memoria, limpiar entre tests, cerrar).
setupTestDB();

// Datos de ejemplo reutilizables.
const datosValidos: Auto = {
  marca: 'Toyota',
  modelo: 'Corolla',
  patente: 'AB123CD',
  cambios: 'AUTOMATICO',
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
      expect(auto.cambios).toBe('AUTOMATICO');
    });

    it('normaliza la patente a mayúsculas (uppercase del esquema)', async () => {
      const auto = await crear({ ...datosValidos, patente: 'xy999zz' });
      expect(auto.patente).toBe('XY999ZZ');
    });

    it('normaliza "cambios" a mayúsculas (uppercase del esquema)', async () => {
      const auto = await crear({
        ...datosValidos,
        cambios: 'automatico' as Auto['cambios'],
      });
      expect(auto.cambios).toBe('AUTOMATICO');
    });

    it('pone activo=true por defecto si no se especifica', async () => {
      // activo: _omitido hace que el atributo activo se guarde en la varible _omitido
      // mientras que el resto de los atributos en sinActivo
      const { activo: _omitido, ...sinActivo } = datosValidos;
      const auto = await crear(sinActivo as Auto);

      expect(auto.activo).toBe(true);
    });

    it('tira ValidationError si falta la patente', async () => {
      const { patente: _omitido, ...sinPatente } = datosValidos;

      await expect(crear(sinPatente as Auto)).rejects.toThrow(
        /patente es obligatoria/,
      );
    });

    it('tira ValidationError si "cambios" no está en el enum', async () => {
      await expect(
        crear({ ...datosValidos, cambios: 'cohete' as Auto['cambios'] }),
      ).rejects.toThrow(/cambios/);
    });

    it('tira ErrorClaveDuplicada (409) si la patente ya existe', async () => {
      await crear(datosValidos);

      // crear() atrapa el 11000 crudo y lo relanza como
      // ErrorClaveDuplicada (ver auto.service.ts / errorClaveDuplicada.ts).
      const promesa = crear(datosValidos);
      await expect(promesa).rejects.toBeInstanceOf(ErrorClaveDuplicada);
      await expect(promesa).rejects.toMatchObject({ status: 409 });
      await expect(promesa).rejects.toThrow(/patente/i);
    });

    it('tira ErrorClaveDuplicada aunque la patente repetida venga en minúsculas y con espacios', async () => {
      await crear(datosValidos);

      const promesa = crear({ ...datosValidos, patente: '  ab123cd ' });
      await expect(promesa).rejects.toBeInstanceOf(ErrorClaveDuplicada);
    });

    it('tira ErrorClaveDuplicada aunque falte el índice unique de la patente', async () => {
      // Simula una base donde el índice no se pudo crear: sin la
      // consulta previa del service, el segundo auto se guardaría.
      await AutoModel.init();
      await AutoModel.collection.dropIndex('patente_1');

      try {
        await crear(datosValidos);
        await expect(crear(datosValidos)).rejects.toBeInstanceOf(ErrorClaveDuplicada);
        expect(await AutoModel.countDocuments()).toBe(1);
      } finally {
        // Deja el índice como estaba para los tests que siguen.
        await AutoModel.createIndexes();
      }
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
  //  listarActivos
  // --------------------------------------------------------
  describe('listarActivos', () => {
    it('trae solo los activos, ordenados por patente, con los datos para elegir', async () => {
      await crear({ ...datosValidos, patente: 'ZZ999ZZ', cambios: 'MANUAL' });
      await crear({ ...datosValidos, patente: 'AA111AA' });
      await crear({ ...datosValidos, patente: 'MM555MM', activo: false });

      const autos = await listarActivos();

      expect(autos.map((auto) => auto.patente)).toEqual(['AA111AA', 'ZZ999ZZ']);
      expect(Object.keys(autos[0].toJSON()).sort()).toEqual(
        ['_id', 'cambios', 'marca', 'modelo', 'patente'],
      );
    });

    it('filtra por tipo de cambios', async () => {
      await crear({ ...datosValidos, patente: 'AA111AA', cambios: 'MANUAL' });
      await crear({ ...datosValidos, patente: 'BB222BB', cambios: 'AUTOMATICO' });

      const manuales = await listarActivos('MANUAL');

      expect(manuales.map((auto) => auto.patente)).toEqual(['AA111AA']);
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
          cambios: 'cohete' as Auto['cambios'],
        }),
      ).rejects.toThrow(/cambios/);
    });

    it('tira ErrorClaveDuplicada (409) si la patente nueva es la de otro auto', async () => {
      await crear(datosValidos);
      const otro = await crear({ ...datosValidos, patente: 'XY999ZZ' });

      const promesa = actualizar(otro._id.toString(), { patente: 'ab123cd' });
      await expect(promesa).rejects.toBeInstanceOf(ErrorClaveDuplicada);
      await expect(promesa).rejects.toMatchObject({ status: 409 });
    });

    it('deja mandar la patente que el auto ya tenía', async () => {
      const creado = await crear(datosValidos);

      const actualizado = await actualizar(creado._id.toString(), {
        patente: 'AB123CD',
        modelo: 'Yaris',
      });

      expect(actualizado?.modelo).toBe('Yaris');
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

    // Que "activo" sea un booleano lo garantiza aCambiarActivoDto (ver tests/dtos/auto.dto.test.ts).
  });
});
