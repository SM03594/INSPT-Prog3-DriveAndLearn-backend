// ============================================================
//  turno.dto.test.ts — Tests de src/dtos/turno.dto.ts (sin DB)
// ============================================================
// Las filas de la tabla de errores del plan que le tocan al DTO. Que
// la fecha no sea pasada, que "desde" sea anterior a "hasta" y que el
// rango alcance para una clase los revisa el service: se prueban en
// turno.service.test.ts.

import { describe, it, expect } from 'vitest';
import { aConsultarTurnosDto } from '../../src/dtos/turno.dto.js';
import { ErrorDeNegocio } from '../../src/errors/errorDeNegocio.js';

const lunes = { anio: 2026, mes: 11, diaDelMes: 9 };

describe('aConsultarTurnosDto', () => {
  it('convierte todos los campos', () => {
    const dto = aConsultarTurnosDto({
      fecha: '2026-11-09',
      cambios: 'manual',
      desde: '8:00',
      hasta: '12:30',
    });

    expect(dto).toEqual({
      fecha: lunes,
      cambios: 'MANUAL',
      desde: { hora: 8, minuto: 0 },
      hasta: { hora: 12, minuto: 30 },
    });
  });

  it('solo "fecha" es obligatoria: lo demás queda undefined', () => {
    expect(aConsultarTurnosDto({ fecha: '2026-11-09' })).toEqual({
      fecha: lunes,
      cambios: undefined,
      desde: undefined,
      hasta: undefined,
    });
  });

  // No compara desde con hasta: eso lo hace el service.
  it('acepta un "desde" posterior al "hasta"', () => {
    expect(() => aConsultarTurnosDto({ fecha: '2026-11-09', desde: '12:00', hasta: '08:00' }))
      .not.toThrow();
  });

  it.each([
    [{ alumno: '64b7f0f0f0f0f0f0f0f0f0f0' }, 'alumno'],
    [{ auto: '64b7f0f0f0f0f0f0f0f0f0f0' }, 'auto'],
    [{ $where: '1' }, '$where'],
  ])('rechaza campos que no son del contrato (%j)', (extra, campo) => {
    expect(() => aConsultarTurnosDto({ fecha: '2026-11-09', ...extra }))
      .toThrow(`No se pueden enviar estos campos: ${campo}`);
  });

  it.each([
    [{ fecha: 20261109 }, 'La fecha debe ser un texto'],
    [{}, 'La fecha es obligatoria'],
    [{ fecha: '09/11/2026' }, 'La fecha debe tener el formato AAAA-MM-DD'],
    [{ fecha: '2026-02-31' }, 'La fecha debe tener el formato AAAA-MM-DD'],
    [{ fecha: '2026-11-09', cambios: 'cohete' }, 'El tipo de cambios debe ser MANUAL o AUTOMATICO'],
    [{ fecha: '2026-11-09', cambios: 1 }, 'El tipo de cambios debe ser un texto'],
    [{ fecha: '2026-11-09', desde: '24:00' }, 'El desde debe tener el formato HH:MM'],
    [{ fecha: '2026-11-09', hasta: '12:5' }, 'El hasta debe tener el formato HH:MM'],
    [{ fecha: '2026-11-09', desde: 800 }, 'El desde debe ser un texto'],
  ])('rechaza %j', (body, mensaje) => {
    const llamada = () => aConsultarTurnosDto(body);

    expect(llamada).toThrow(ErrorDeNegocio);
    expect(llamada).toThrow(mensaje);
  });
});
