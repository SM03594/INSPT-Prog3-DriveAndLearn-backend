// ============================================================
//  horarioEscuela.service.test.ts — Tests de la CAPA SERVICE del
//  horario de la escuela
// ============================================================

import { describe, it, expect } from 'vitest';
import { setupTestDB } from '../setupTestDB.js';
import {
  agregarTramo,
  reemplazar,
} from '../../src/services/horarioEscuela.service.js';
import { HorarioEscuelaModel } from '../../src/models/HorarioEscuela.js';
import { crearCalendarioSemanal } from '../../src/models/CalendarioSemanal.js';
import type { Tramo } from '../../src/models/Tramo.js';

setupTestDB();

const MENSAJE_EN_PUNTO = 'Los tramos deben empezar y terminar en una hora en punto';

const tramo = (inicio: [number, number], fin: [number, number]): Tramo => ({
  horaInicio: { hora: inicio[0], minuto: inicio[1] },
  horaFin: { hora: fin[0], minuto: fin[1] },
});

describe('horarioEscuela.service', () => {
  describe('reemplazar', () => {
    it('guarda una semana con tramos en punto', async () => {
      const calendario = { ...crearCalendarioSemanal(), lunes: [tramo([8, 0], [20, 0])] };

      const guardado = await reemplazar(calendario);

      expect(guardado.lunes).toHaveLength(1);
    });

    it('rechaza la semana entera si un tramo no es en punto, sin guardar nada', async () => {
      const calendario = {
        ...crearCalendarioSemanal(),
        lunes: [tramo([8, 0], [20, 0])],
        martes: [tramo([9, 0], [12, 30])],
      };

      await expect(reemplazar(calendario)).rejects.toThrow(MENSAJE_EN_PUNTO);
      expect(await HorarioEscuelaModel.findById('escuela')).toBeNull();
    });
  });

  describe('agregarTramo', () => {
    it('agrega un tramo en punto', async () => {
      const calendario = await agregarTramo('lunes', tramo([8, 0], [12, 0]));

      expect(calendario.lunes).toHaveLength(1);
    });

    it('rechaza un tramo que no es en punto (08:30–12:00)', async () => {
      await expect(agregarTramo('lunes', tramo([8, 30], [12, 0]))).rejects.toThrow(
        MENSAJE_EN_PUNTO,
      );
    });

    // La regla está en el service y no en el esquema: un tramo guardado
    // antes de la regla no impide agregar otro.
    it('un tramo viejo que no es en punto no bloquea agregar otro', async () => {
      await HorarioEscuelaModel.create({
        _id: 'escuela',
        calendario: { ...crearCalendarioSemanal(), lunes: [tramo([8, 0], [12, 30])] },
      });

      const calendario = await agregarTramo('lunes', tramo([14, 0], [18, 0]));

      expect(calendario.lunes).toHaveLength(2);
    });
  });
});
