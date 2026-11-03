import ErrorDeNegocio from '../../../src/errors/ErrorDeNegocio.js';
import ErrorFormatoDeFecha from '../../../src/errors/ErrorFormatoDeFecha.js';
import ErrorPeticionInvalida from '../../../src/errors/ErrorPeticionInvalida.js';
import {
  validarEntradaTramosDisponibilidad,
  agregarTramosADia,
  quitarTramosDeDia,
  validarIntervaloDeClase,
  estaDentroDeDisponibilidad,
  obtenerTurnosDeUnaHora,
} from '../../../src/services/helpers/calendarizacion.js';

describe('calendarizacion helper', () => {
  describe('validarEntradaTramosDisponibilidad', () => {
    it('debería aceptar una lista válida de tramos en punto (incluyendo 00:00 y 24:00)', () => {
      expect(() =>
        validarEntradaTramosDisponibilidad([
          {
            dia: 'lunes',
            tramoHorario: { horaInicio: '00:00', horaFin: '06:00' },
          },
          {
            dia: 'domingo',
            tramoHorario: { horaInicio: '18:00', horaFin: '24:00' },
          },
        ])
      ).not.toThrow();
    });

    it('debería lanzar ErrorPeticionInvalida si la lista no es un array, está vacía o tiene un día inválido', () => {
      expect(() => validarEntradaTramosDisponibilidad(null)).toThrow(
        ErrorPeticionInvalida
      );
      expect(() => validarEntradaTramosDisponibilidad([])).toThrow(
        ErrorPeticionInvalida
      );
      expect(() =>
        validarEntradaTramosDisponibilidad([
          {
            dia: 'feriado',
            tramoHorario: { horaInicio: '08:00', horaFin: '12:00' },
          },
        ])
      ).toThrow(ErrorPeticionInvalida);
    });

    it('debería lanzar ErrorFormatoDeFecha si las horas no son en punto (:00) o están fuera de 00:00-24:00', () => {
      expect(() =>
        validarEntradaTramosDisponibilidad([
          {
            dia: 'lunes',
            tramoHorario: { horaInicio: '08:30', horaFin: '12:00' },
          },
        ])
      ).toThrow(ErrorFormatoDeFecha);

      expect(() =>
        validarEntradaTramosDisponibilidad([
          {
            dia: 'lunes',
            tramoHorario: { horaInicio: '8:00', horaFin: '12:00' },
          },
        ])
      ).toThrow(ErrorFormatoDeFecha);

      expect(() =>
        validarEntradaTramosDisponibilidad([
          {
            dia: 'lunes',
            tramoHorario: { horaInicio: '08:00', horaFin: '25:00' },
          },
        ])
      ).toThrow(ErrorFormatoDeFecha);
    });

    it('debería lanzar ErrorDeNegocio si no hay al menos 1 hora entre horaInicio y horaFin', () => {
      expect(() =>
        validarEntradaTramosDisponibilidad([
          {
            dia: 'lunes',
            tramoHorario: { horaInicio: '14:00', horaFin: '08:00' },
          },
        ])
      ).toThrow(ErrorDeNegocio);

      expect(() =>
        validarEntradaTramosDisponibilidad([
          {
            dia: 'lunes',
            tramoHorario: { horaInicio: '10:00', horaFin: '10:00' },
          },
        ])
      ).toThrow(ErrorDeNegocio);

      expect(() =>
        validarEntradaTramosDisponibilidad([
          {
            dia: 'lunes',
            tramoHorario: { horaInicio: '24:00', horaFin: '24:00' },
          },
        ])
      ).toThrow(ErrorDeNegocio);
    });
  });

  describe('agregarTramosADia', () => {
    it('debería agregar tramos no superpuestos y devolverlos ordenados cronológicamente', () => {
      const resultado = agregarTramosADia(
        [{ horaInicio: '16:00', horaFin: '20:00' }],
        [{ horaInicio: '08:00', horaFin: '12:00' }]
      );

      expect(resultado).toEqual([
        { horaInicio: '08:00', horaFin: '12:00' },
        { horaInicio: '16:00', horaFin: '20:00' },
      ]);
    });

    it('debería unificar tramos superpuestos y contiguos en un único tramo, preservando 24:00 al cierre', () => {
      const superpuestos = agregarTramosADia(
        [{ horaInicio: '08:00', horaFin: '14:00' }],
        [{ horaInicio: '06:00', horaFin: '12:00' }]
      );
      expect(superpuestos).toEqual([
        { horaInicio: '06:00', horaFin: '14:00' },
      ]);

      const contiguosHastaMedianoche = agregarTramosADia(
        [{ horaInicio: '18:00', horaFin: '21:00' }],
        [{ horaInicio: '21:00', horaFin: '24:00' }]
      );
      expect(contiguosHastaMedianoche).toEqual([
        { horaInicio: '18:00', horaFin: '24:00' },
      ]);
    });
  });

  describe('quitarTramosDeDia', () => {
    it('debería dividir un tramo en dos al quitar una franja intermedia', () => {
      const resultado = quitarTramosDeDia(
        [{ horaInicio: '08:00', horaFin: '14:00' }],
        [{ horaInicio: '10:00', horaFin: '12:00' }]
      );

      expect(resultado).toEqual([
        { horaInicio: '08:00', horaFin: '10:00' },
        { horaInicio: '12:00', horaFin: '14:00' },
      ]);
    });

    it('debería recortar bordes, eliminar tramos cubiertos totalmente o mantener tramos sin cruce', () => {
      const recorteFinal = quitarTramosDeDia(
        [{ horaInicio: '18:00', horaFin: '24:00' }],
        [{ horaInicio: '22:00', horaFin: '24:00' }]
      );
      expect(recorteFinal).toEqual([
        { horaInicio: '18:00', horaFin: '22:00' },
      ]);

      const eliminadoTotal = quitarTramosDeDia(
        [{ horaInicio: '08:00', horaFin: '14:00' }],
        [{ horaInicio: '06:00', horaFin: '16:00' }]
      );
      expect(eliminadoTotal).toEqual([]);

      const sinCruce = quitarTramosDeDia(
        [{ horaInicio: '08:00', horaFin: '12:00' }],
        [{ horaInicio: '14:00', horaFin: '18:00' }]
      );
      expect(sinCruce).toEqual([{ horaInicio: '08:00', horaFin: '12:00' }]);
    });
  });

  describe('validarIntervaloDeClase', () => {
    it('debería aceptar una clase de exactamente 1 hora en punto (incluso cruzando medianoche de 23:00 a 00:00)', () => {
      const intervaloDiurno = validarIntervaloDeClase(
        '2026-11-03T10:00',
        '2026-11-03T11:00'
      );
      expect(intervaloDiurno.length('hours')).toBe(1);

      const intervaloMedianoche = validarIntervaloDeClase(
        '2026-11-03T23:00',
        '2026-11-04T00:00'
      );
      expect(intervaloMedianoche.length('hours')).toBe(1);
    });

    it('debería lanzar ErrorFormatoDeFecha si el formato no es YYYY-MM-DDTHH:00 o la fecha no existe', () => {
      expect(() =>
        validarIntervaloDeClase('2026-11-03T10:30', '2026-11-03T11:30')
      ).toThrow(ErrorFormatoDeFecha);

      expect(() =>
        validarIntervaloDeClase('2026-11-03T23:00', '2026-11-03T24:00')
      ).toThrow(ErrorFormatoDeFecha);

      expect(() =>
        validarIntervaloDeClase('2026-02-30T10:00', '2026-02-30T11:00')
      ).toThrow(ErrorFormatoDeFecha);
    });

    it('debería lanzar ErrorDeNegocio si la clase no dura exactamente 1 hora', () => {
      expect(() =>
        validarIntervaloDeClase('2026-11-03T10:00', '2026-11-03T12:00')
      ).toThrow(ErrorDeNegocio);

      expect(() =>
        validarIntervaloDeClase('2026-11-03T12:00', '2026-11-03T11:00')
      ).toThrow(ErrorDeNegocio);
    });
  });

  describe('estaDentroDeDisponibilidad', () => {
    const disponibilidad = {
      lunes: [],
      martes: [
        { horaInicio: '08:00', horaFin: '14:00' },
        { horaInicio: '20:00', horaFin: '24:00' },
      ],
      miercoles: [],
      jueves: [],
      viernes: [],
      sabado: [],
      domingo: [],
    };

    it('debería devolver true si la clase de 1 hora está contenida en la disponibilidad del día (incluyendo cierre a las 24:00)', () => {
      // 2026-11-03 es martes
      expect(
        estaDentroDeDisponibilidad(
          disponibilidad,
          '2026-11-03T10:00',
          '2026-11-03T11:00'
        )
      ).toBe(true);

      // Clase de 23:00 del martes a 00:00 del miércoles cubierta por martes 20:00-24:00
      expect(
        estaDentroDeDisponibilidad(
          disponibilidad,
          '2026-11-03T23:00',
          '2026-11-04T00:00'
        )
      ).toBe(true);
    });

    it('debería devolver false si la clase cae fuera de los tramos disponibles o en un día sin disponibilidad', () => {
      expect(
        estaDentroDeDisponibilidad(
          disponibilidad,
          '2026-11-03T15:00',
          '2026-11-03T16:00'
        )
      ).toBe(false);

      // 2026-11-02 es lunes (sin disponibilidad)
      expect(
        estaDentroDeDisponibilidad(
          disponibilidad,
          '2026-11-02T10:00',
          '2026-11-02T11:00'
        )
      ).toBe(false);
    });
  });

  describe('obtenerTurnosDeUnaHora', () => {
    it('debería dividir un intervalo en bloques de 1 hora exacta', () => {
      const intervalo = validarIntervaloDeClase(
        '2026-11-03T10:00',
        '2026-11-03T11:00'
      );
      const intervaloDeTresHoras = intervalo.set({
        end: intervalo.start.plus({ hours: 3 }),
      });

      const turnos = obtenerTurnosDeUnaHora(intervaloDeTresHoras);

      expect(turnos).toHaveLength(3);
      expect(turnos[0].start.toFormat('HH:mm')).toBe('10:00');
      expect(turnos[2].end.toFormat('HH:mm')).toBe('13:00');
    });
  });
});
