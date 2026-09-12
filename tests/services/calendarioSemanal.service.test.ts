// ============================================================
//  calendarioSemanal.service.test.ts — Tests de las operaciones
//  sobre un CalendarioSemanal
// ============================================================
// Estas funciones son PURAS: operan sobre un objeto en memoria
// ({ lunes: [tramo], ... }), no tocan la base. Por eso no hace
// falta setupTestDB() y los tests corren al instante.

import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import {
  validarDia,
  agregarTramo,
  quitarTramo,
} from '../../src/services/calendarioSemanal.service.js';
import {
  DIAS,
  crearCalendarioSemanal,
  type Dia,
  type Tramo,
} from '../../src/models/CalendarioSemanal.js';

// Un día que no existe.
const DIA_INVALIDO = 'narnia' as unknown as Dia;

// Un tramo con _id propio (como el que asignaría Mongoose).
const nuevoTramo = (horaInicio: number, horaFin: number): Tramo => ({
  _id: new Types.ObjectId(),
  horaInicio: { hora: horaInicio, minuto: 0 },
  horaFin: { hora: horaFin, minuto: 0 },
});

describe('calendarioSemanal.service', () => {
  // --------------------------------------------------------
  //  validarDia
  // --------------------------------------------------------
  describe('validarDia', () => {
    it('no tira con cualquiera de los días de DIAS', () => {
      for (const dia of DIAS) {
        expect(() => validarDia(dia)).not.toThrow();
      }
    });

    it('tira un Error si el día no está en DIAS', () => {
      expect(() => validarDia('narnia')).toThrow(/día/i);
    });

    it('el mensaje de error incluye el valor recibido', () => {
      expect(() => validarDia('narnia')).toThrow(/narnia/);
    });
  });

  // --------------------------------------------------------
  //  agregarTramo
  // --------------------------------------------------------
  describe('agregarTramo', () => {
    it('agrega el tramo al día indicado (muta el calendario)', () => {
      const cal = crearCalendarioSemanal();
      const tramo = nuevoTramo(9, 12);

      agregarTramo(cal, 'lunes', tramo);

      expect(cal.lunes).toHaveLength(1);
      expect(cal.lunes[0]).toBe(tramo);
    });

    it('acumula tramos en el mismo día sin pisar los previos', () => {
      const cal = crearCalendarioSemanal();

      agregarTramo(cal, 'lunes', nuevoTramo(9, 12));
      agregarTramo(cal, 'lunes', nuevoTramo(14, 18));

      expect(cal.lunes).toHaveLength(2);
    });

    it('cada día es independiente', () => {
      const cal = crearCalendarioSemanal();

      agregarTramo(cal, 'lunes', nuevoTramo(9, 12));
      agregarTramo(cal, 'martes', nuevoTramo(14, 18));

      expect(cal.lunes).toHaveLength(1);
      expect(cal.martes).toHaveLength(1);
      expect(cal.miercoles).toHaveLength(0);
    });

    it('tira si el día es inválido y no toca el calendario', () => {
      const cal = crearCalendarioSemanal();

      expect(() =>
        agregarTramo(cal, DIA_INVALIDO, nuevoTramo(9, 12)),
      ).toThrow(/día/i);
      expect(cal.lunes).toHaveLength(0);
    });
  });

  // --------------------------------------------------------
  //  quitarTramo
  // --------------------------------------------------------
  describe('quitarTramo', () => {
    it('quita el tramo con ese _id y devuelve true', () => {
      const cal = crearCalendarioSemanal();
      const tramoA = nuevoTramo(9, 12);
      const tramoB = nuevoTramo(14, 18);
      cal.lunes.push(tramoA, tramoB);

      const quitado = quitarTramo(cal, 'lunes', tramoA._id!.toString());

      expect(quitado).toBe(true);
      expect(cal.lunes).toHaveLength(1);
      expect(cal.lunes[0]).toBe(tramoB); // quedó el otro
    });

    it('devuelve false (y no muta) si ese día no tiene un tramo con ese _id', () => {
      const cal = crearCalendarioSemanal();
      cal.lunes.push(nuevoTramo(9, 12));

      const idQueNoEsta = new Types.ObjectId().toString();
      const quitado = quitarTramo(cal, 'lunes', idQueNoEsta);

      expect(quitado).toBe(false);
      expect(cal.lunes).toHaveLength(1);
    });

    it('devuelve false si el tramo existe pero en otro día', () => {
      const cal = crearCalendarioSemanal();
      const tramo = nuevoTramo(9, 12);
      cal.lunes.push(tramo);

      const quitado = quitarTramo(cal, 'martes', tramo._id!.toString());

      expect(quitado).toBe(false);
      expect(cal.lunes).toHaveLength(1);
    });

    it('tira si el día es inválido', () => {
      const cal = crearCalendarioSemanal();

      expect(() =>
        quitarTramo(cal, DIA_INVALIDO, new Types.ObjectId().toString()),
      ).toThrow(/día/i);
    });
  });
});
