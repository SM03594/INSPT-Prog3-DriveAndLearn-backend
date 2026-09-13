// ============================================================
//  reglasEscuela.service.test.ts — Tests de las reglas de la escuela
// ============================================================
// Este archivo valida la parte de negocio relacionada con el
// calendario semanal de la escuela: días válidos, agregación de
// tramos y eliminación por id.

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

const DIA_INVALIDO = 'narnia' as unknown as Dia;

const nuevoTramo = (horaInicio: number, horaFin: number): Tramo => ({
  _id: new Types.ObjectId(),
  horaInicio: { hora: horaInicio, minuto: 0 },
  horaFin: { hora: horaFin, minuto: 0 },
});

describe('reglasEscuela.service', () => {
  describe('validarDia', () => {
    it('acepta cualquiera de los días permitidos por la escuela', () => {
      for (const dia of DIAS) {
        expect(() => validarDia(dia)).not.toThrow();
      }
    });

    it('rechaza un día inexistente', () => {
      expect(() => validarDia('narnia')).toThrow(/día/i);
    });

    it('incluye el valor recibido en el mensaje de error', () => {
      expect(() => validarDia('narnia')).toThrow(/narnia/);
    });
  });

  describe('agregarTramo', () => {
    it('agrega el tramo al día indicado y muta el calendario', () => {
      const cal = crearCalendarioSemanal();
      const tramo = nuevoTramo(9, 12);

      agregarTramo(cal, 'lunes', tramo);

      expect(cal.lunes).toHaveLength(1);
      expect(cal.lunes[0]).toBe(tramo);
    });

    it('acumula varios tramos en el mismo día sin pisar los anteriores', () => {
      const cal = crearCalendarioSemanal();

      agregarTramo(cal, 'lunes', nuevoTramo(9, 12));
      agregarTramo(cal, 'lunes', nuevoTramo(14, 18));

      expect(cal.lunes).toHaveLength(2);
    });

    it('mantiene los días independientes entre sí', () => {
      const cal = crearCalendarioSemanal();

      agregarTramo(cal, 'lunes', nuevoTramo(9, 12));
      agregarTramo(cal, 'martes', nuevoTramo(14, 18));

      expect(cal.lunes).toHaveLength(1);
      expect(cal.martes).toHaveLength(1);
      expect(cal.miercoles).toHaveLength(0);
    });

    it('lanza si el día es inválido y no altera el calendario', () => {
      const cal = crearCalendarioSemanal();

      expect(() =>
        agregarTramo(cal, DIA_INVALIDO, nuevoTramo(9, 12)),
      ).toThrow(/día/i);

      expect(cal.lunes).toHaveLength(0);
    });
  });

  describe('quitarTramo', () => {
    it('quita el tramo con ese _id y devuelve true', () => {
      const cal = crearCalendarioSemanal();
      const tramoA = nuevoTramo(9, 12);
      const tramoB = nuevoTramo(14, 18);
      cal.lunes.push(tramoA, tramoB);

      const quitado = quitarTramo(cal, 'lunes', tramoA._id!.toString());

      expect(quitado).toBe(true);
      expect(cal.lunes).toHaveLength(1);
      expect(cal.lunes[0]).toBe(tramoB);
    });

    it('devuelve false y no muta si no existe un tramo con ese _id', () => {
      const cal = crearCalendarioSemanal();
      cal.lunes.push(nuevoTramo(9, 12));

      const idQueNoEsta = new Types.ObjectId().toString();
      const quitado = quitarTramo(cal, 'lunes', idQueNoEsta);

      expect(quitado).toBe(false);
      expect(cal.lunes).toHaveLength(1);
    });

    it('devuelve false si el tramo existe en otro día', () => {
      const cal = crearCalendarioSemanal();
      const tramo = nuevoTramo(9, 12);
      cal.lunes.push(tramo);

      const quitado = quitarTramo(cal, 'martes', tramo._id!.toString());

      expect(quitado).toBe(false);
      expect(cal.lunes).toHaveLength(1);
    });

    it('lanza si el día es inválido', () => {
      const cal = crearCalendarioSemanal();

      expect(() =>
        quitarTramo(cal, DIA_INVALIDO, new Types.ObjectId().toString()),
      ).toThrow(/día/i);
    });
  });
});
