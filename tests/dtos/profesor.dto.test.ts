// ============================================================
//  profesor.dto.test.ts — Tests de src/dtos/profesor.dto.ts (sin DB)
// ============================================================
// Que el nombre no esté vacío es una regla: se prueba en
// profesor.service.test.ts. La disponibilidad usa los DTO compartidos
// de calendarioSemanal.dto.ts (ver calendarioSemanal.dto.test.ts).

import { describe, it, expect } from 'vitest';
import { aCambiarNomApeDto, aCrearProfesorDto } from '../../src/dtos/profesor.dto.js';

describe('aCrearProfesorDto', () => {
  it('devuelve el nombre', () => {
    expect(aCrearProfesorDto({ nomApe: 'Juan Gómez' })).toEqual({ nomApe: 'Juan Gómez' });
  });

  it('rechaza la disponibilidad al crear: arranca vacía', () => {
    expect(() => aCrearProfesorDto({ nomApe: 'Juan', disponibilidad: {} })).toThrow(
      'No se pueden enviar estos campos: disponibilidad',
    );
  });

  it('rechaza un nombre que no es texto', () => {
    expect(() => aCrearProfesorDto({ nomApe: 123 })).toThrow('El nombre y apellido debe ser un texto');
  });

  it('exige el nombre', () => {
    expect(() => aCrearProfesorDto({})).toThrow('El nombre y apellido es obligatorio');
  });
});

describe('aCambiarNomApeDto', () => {
  // Antes, 123 se guardaba como "123" y un body sin nomApe respondía 200
  // sin cambiar nada (I-34).
  it('rechaza un nombre que no es texto', () => {
    expect(() => aCambiarNomApeDto({ nomApe: 123 })).toThrow('El nombre y apellido debe ser un texto');
  });

  it('exige el nombre', () => {
    expect(() => aCambiarNomApeDto({ otro: 'x' })).toThrow('No se pueden enviar estos campos: otro');
    expect(() => aCambiarNomApeDto({})).toThrow('El nombre y apellido es obligatorio');
  });

  it('rechaza campos de más', () => {
    expect(() => aCambiarNomApeDto({ nomApe: 'Otro', extra: 1 })).toThrow('No se pueden enviar estos campos: extra');
  });
});
