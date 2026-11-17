import { DateTime } from 'luxon';
import { vi } from 'vitest';
import ErrorDeNegocio from '../../../src/errors/ErrorDeNegocio.js';
import ErrorFormatoDeFecha from '../../../src/errors/ErrorFormatoDeFecha.js';
import ErrorPeticionInvalida from '../../../src/errors/ErrorPeticionInvalida.js';
import {
  validarIntervaloDeClase,
  estaDentroDeDisponibilidad,
  obtenerTurnosDeUnaHora,
  verificarFechaFutura,
  validarFechaCalendario,
  parsearFechaConsulta,
  obtenerDiaDeLaSemana,
  generarTurnosDeFecha,
  crearIntervaloValido,
  seSuperponenIntervalos,
  evaluarSuperposicionConClasesAgendadas,
  crearFiltroSuperposicion,
} from '../../../src/services/helpers/turnosYFechasHelper.js';

describe('turnosYFechasHelper', () => {
  describe('validarIntervaloDeClase', () => {
    it('debería aceptar una clase de exactamente 1 hora en punto (incluso cruzando medianoche de 23:00 a 00:00)', () => {
      const intervaloDiurno = validarIntervaloDeClase(
        '2030-11-05T10:00',
        '2030-11-05T11:00'
      );
      expect(intervaloDiurno.length('hours')).toBe(1);

      const intervaloMedianoche = validarIntervaloDeClase(
        '2030-11-05T23:00',
        '2030-11-06T00:00'
      );
      expect(intervaloMedianoche.length('hours')).toBe(1);
    });

    it('debería lanzar ErrorFormatoDeFecha si el formato no es YYYY-MM-DDTHH:00 o la fecha no existe', () => {
      expect(() =>
        validarIntervaloDeClase('2030-11-05T10:30', '2030-11-05T11:30')
      ).toThrow(ErrorFormatoDeFecha);

      expect(() =>
        validarIntervaloDeClase('2030-11-05T23:00', '2030-11-05T24:00')
      ).toThrow(ErrorFormatoDeFecha);

      expect(() =>
        validarIntervaloDeClase('2030-02-30T10:00', '2030-02-30T11:00')
      ).toThrow(ErrorFormatoDeFecha);
    });

    it('debería lanzar ErrorDeNegocio si la clase no dura exactamente 1 hora', () => {
      expect(() =>
        validarIntervaloDeClase('2030-11-05T10:00', '2030-11-05T12:00')
      ).toThrow(ErrorDeNegocio);

      expect(() =>
        validarIntervaloDeClase('2030-11-05T12:00', '2030-11-05T11:00')
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
      // 2030-11-05 es martes
      expect(
        estaDentroDeDisponibilidad(
          disponibilidad,
          '2030-11-05T10:00',
          '2030-11-05T11:00'
        )
      ).toBe(true);

      // Clase de 23:00 del martes a 00:00 del miércoles cubierta por martes 20:00-24:00
      expect(
        estaDentroDeDisponibilidad(
          disponibilidad,
          '2030-11-05T23:00',
          '2030-11-06T00:00'
        )
      ).toBe(true);
    });

    it('debería devolver false si la clase cae fuera de los tramos disponibles o en un día sin disponibilidad', () => {
      expect(
        estaDentroDeDisponibilidad(
          disponibilidad,
          '2030-11-05T15:00',
          '2030-11-05T16:00'
        )
      ).toBe(false);

      // 2030-11-04 es lunes (sin disponibilidad)
      expect(
        estaDentroDeDisponibilidad(
          disponibilidad,
          '2030-11-04T10:00',
          '2030-11-04T11:00'
        )
      ).toBe(false);
    });
  });

  describe('obtenerTurnosDeUnaHora', () => {
    it('debería dividir un intervalo en bloques de 1 hora exacta', () => {
      const intervalo = validarIntervaloDeClase(
        '2030-11-05T10:00',
        '2030-11-05T11:00'
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

  describe('verificarFechaFutura', () => {
    const referenciaFija = DateTime.fromISO('2030-11-06T12:00');

    it('debería aceptar una fecha y hora posterior a la referencia', () => {
      const resultado = verificarFechaFutura(
        '2030-11-06T13:00',
        referenciaFija
      );
      expect(resultado.isValid).toBe(true);
      expect(resultado.toFormat('yyyy-MM-dd HH:mm')).toBe('2030-11-06 13:00');
    });

    it('debería lanzar ErrorDeNegocio si la fecha es anterior a la referencia', () => {
      expect(() =>
        verificarFechaFutura('2030-11-06T11:00', referenciaFija)
      ).toThrow(ErrorDeNegocio);

      expect(() =>
        verificarFechaFutura('2030-11-05T18:00', referenciaFija)
      ).toThrow('No se pueden agendar clases en fechas u horarios pasados');
    });

    it('debería admitir un mensaje personalizado de ErrorDeNegocio al fallar', () => {
      const mensajePersonalizado = 'No se pueden eliminar clases en fechas u horarios pasados';

      expect(() =>
        verificarFechaFutura('2030-11-06T11:00', referenciaFija, mensajePersonalizado)
      ).toThrow(mensajePersonalizado);
    });

    it('debería lanzar ErrorDeNegocio si la fecha es exactamente igual a la referencia', () => {
      expect(() =>
        verificarFechaFutura('2030-11-06T12:00', referenciaFija)
      ).toThrow(ErrorDeNegocio);
    });

    it('debería lanzar ErrorFormatoDeFecha si el formato no es válido o la fecha no existe', () => {
      expect(() =>
        verificarFechaFutura('2030-11-07T10:30', referenciaFija)
      ).toThrow(ErrorFormatoDeFecha);

      expect(() =>
        verificarFechaFutura('2030-02-30T10:00', referenciaFija)
      ).toThrow(ErrorFormatoDeFecha);
    });

    it('debería usar la zona horaria oficial de la escuela (Buenos Aires) con DateTime.now() por defecto', () => {
      // Si en UTC son las 15:00:00Z, en Buenos Aires (UTC-3) son las 12:00:00
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2030-11-07T15:00:00Z'));

      try {
        // En Buenos Aires (12:00), 13:00 es en el futuro -> debe ser aceptada
        expect(() => verificarFechaFutura('2030-11-07T13:00')).not.toThrow();

        // En Buenos Aires (12:00), 11:00 ya pasó -> debe lanzar ErrorDeNegocio
        expect(() => verificarFechaFutura('2030-11-07T11:00')).toThrow(
          ErrorDeNegocio
        );
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('validarFechaCalendario', () => {
    it('debería aceptar una fecha válida en formato YYYY-MM-DD (tanto pasada como futura)', () => {
      const fechaPasada = validarFechaCalendario('2020-01-15');
      const fechaFutura = validarFechaCalendario('2035-12-31');

      expect(fechaPasada.isValid).toBe(true);
      expect(fechaPasada.toISODate()).toBe('2020-01-15');
      expect(fechaFutura.isValid).toBe(true);
      expect(fechaFutura.toISODate()).toBe('2035-12-31');
    });

    it('debería lanzar ErrorFormatoDeFecha si el formato no es YYYY-MM-DD o no es string', () => {
      expect(() => validarFechaCalendario('15-01-2030')).toThrow(
        ErrorFormatoDeFecha
      );
      expect(() => validarFechaCalendario('2030/01/15')).toThrow(
        ErrorFormatoDeFecha
      );
      expect(() => validarFechaCalendario(12345)).toThrow(ErrorFormatoDeFecha);
      expect(() => validarFechaCalendario(null)).toThrow(ErrorFormatoDeFecha);
    });

    it('debería lanzar ErrorFormatoDeFecha si el día o mes no existe en el calendario', () => {
      expect(() => validarFechaCalendario('2030-02-30')).toThrow(
        ErrorFormatoDeFecha
      );
      expect(() => validarFechaCalendario('2030-13-01')).toThrow(
        ErrorFormatoDeFecha
      );
    });
  });

  describe('parsearFechaConsulta', () => {
    const referenciaFija = DateTime.fromISO('2030-11-07T12:00');

    it('debería aceptar una fecha futura válida y devolver su DateTime', () => {
      // 2030-11-12 es martes
      const resultado = parsearFechaConsulta('2030-11-12', referenciaFija);

      expect(resultado.isValid).toBe(true);
      expect(resultado.toISODate()).toBe('2030-11-12');
    });

    it('debería aceptar la fecha del día actual', () => {
      const resultado = parsearFechaConsulta('2030-11-07', referenciaFija);

      expect(resultado.isValid).toBe(true);
      expect(resultado.toISODate()).toBe('2030-11-07');
    });

    it('debería lanzar ErrorPeticionInvalida si fecha no es provista o es vacía', () => {
      expect(() => parsearFechaConsulta(undefined, referenciaFija)).toThrow(
        ErrorPeticionInvalida
      );
      expect(() => parsearFechaConsulta('', referenciaFija)).toThrow(
        'El parámetro fecha es obligatorio'
      );
      expect(() => parsearFechaConsulta('   ', referenciaFija)).toThrow(
        ErrorPeticionInvalida
      );
      expect(() => parsearFechaConsulta(12345, referenciaFija)).toThrow(
        ErrorPeticionInvalida
      );
    });

    it('debería lanzar ErrorFormatoDeFecha si el formato no es YYYY-MM-DD', () => {
      expect(() =>
        parsearFechaConsulta('12-11-2030', referenciaFija)
      ).toThrow(ErrorFormatoDeFecha);
      expect(() =>
        parsearFechaConsulta('2026/11/10', referenciaFija)
      ).toThrow(ErrorFormatoDeFecha);
      expect(() =>
        parsearFechaConsulta('2026-11-1', referenciaFija)
      ).toThrow(ErrorFormatoDeFecha);
      expect(() =>
        parsearFechaConsulta('invalido', referenciaFija)
      ).toThrow(ErrorFormatoDeFecha);
    });

    it('debería lanzar ErrorFormatoDeFecha si el mes es inválido', () => {
      expect(() =>
        parsearFechaConsulta('2030-14-03', referenciaFija)
      ).toThrow(ErrorFormatoDeFecha);
      expect(() =>
        parsearFechaConsulta('2030-00-10', referenciaFija)
      ).toThrow(ErrorFormatoDeFecha);
    });

    it('debería lanzar ErrorFormatoDeFecha si el día no existe en el calendario', () => {
      expect(() =>
        parsearFechaConsulta('2030-02-30', referenciaFija)
      ).toThrow(ErrorFormatoDeFecha);
      expect(() =>
        parsearFechaConsulta('2030-11-31', referenciaFija)
      ).toThrow(ErrorFormatoDeFecha);
    });

    it('debería lanzar ErrorDeNegocio si la fecha es estrictamente anterior al día de hoy', () => {
      expect(() =>
        parsearFechaConsulta('2030-11-06', referenciaFija)
      ).toThrow(ErrorDeNegocio);
      expect(() =>
        parsearFechaConsulta('2030-11-06', referenciaFija)
      ).toThrow('No se pueden consultar turnos libres de fechas pasadas');
      expect(() =>
        parsearFechaConsulta('2020-01-01', referenciaFija)
      ).toThrow(ErrorDeNegocio);
    });
  });

  describe('obtenerDiaDeLaSemana', () => {
    it('debería devolver el nombre del día en español para un string YYYY-MM-DD', () => {
      // 2030-11-11 es lunes, 2030-11-12 es martes, 2030-11-17 es domingo
      expect(obtenerDiaDeLaSemana('2030-11-11')).toBe('lunes');
      expect(obtenerDiaDeLaSemana('2030-11-12')).toBe('martes');
      expect(obtenerDiaDeLaSemana('2030-11-17')).toBe('domingo');
    });

    it('debería devolver el nombre del día en español para una instancia DateTime de Luxon', () => {
      const dt = DateTime.fromISO('2030-11-13'); // miércoles
      expect(obtenerDiaDeLaSemana(dt)).toBe('miercoles');
    });

    it('debería lanzar ErrorPeticionInvalida si la fecha falta o no es string ni DateTime', () => {
      expect(() => obtenerDiaDeLaSemana(null)).toThrow(ErrorPeticionInvalida);
      expect(() => obtenerDiaDeLaSemana(undefined)).toThrow(
        ErrorPeticionInvalida
      );
      expect(() => obtenerDiaDeLaSemana('')).toThrow(ErrorPeticionInvalida);
      expect(() => obtenerDiaDeLaSemana(12345)).toThrow(
        ErrorPeticionInvalida
      );
    });

    it('debería lanzar ErrorFormatoDeFecha si el formato es inválido o el mes es incorrecto', () => {
      expect(() => obtenerDiaDeLaSemana('12-11-2030')).toThrow(
        ErrorFormatoDeFecha
      );
      expect(() => obtenerDiaDeLaSemana('2030-14-03')).toThrow(
        ErrorFormatoDeFecha
      );
    });

    it('debería lanzar ErrorFormatoDeFecha si el día no existe en el calendario', () => {
      expect(() => obtenerDiaDeLaSemana('2030-02-30')).toThrow(
        ErrorFormatoDeFecha
      );
      expect(() => obtenerDiaDeLaSemana('2030-11-31')).toThrow(
        ErrorFormatoDeFecha
      );
    });
  });

  describe('generarTurnosDeFecha', () => {
    const fechaTest = '2030-11-12'; // Martes en el futuro

    it('debería devolver array vacío si no hay tramos o tramos no es array', () => {
      expect(generarTurnosDeFecha(fechaTest, [])).toEqual([]);
      expect(generarTurnosDeFecha(fechaTest, null)).toEqual([]);
    });

    it('debería generar turnos de 1 hora exacta en formato YYYY-MM-DDTHH:00', () => {
      const tramos = [{ horaInicio: '08:00', horaFin: '11:00' }];
      const turnos = generarTurnosDeFecha(fechaTest, tramos);

      expect(turnos).toEqual([
        { inicio: '2030-11-12T08:00', fin: '2030-11-12T09:00' },
        { inicio: '2030-11-12T09:00', fin: '2030-11-12T10:00' },
        { inicio: '2030-11-12T10:00', fin: '2030-11-12T11:00' },
      ]);
    });

    it('debería manejar tramos que terminan a las 24:00 conectando con las 00:00 del día siguiente', () => {
      const tramos = [{ horaInicio: '22:00', horaFin: '24:00' }];
      const turnos = generarTurnosDeFecha(fechaTest, tramos);

      expect(turnos).toEqual([
        { inicio: '2030-11-12T22:00', fin: '2030-11-12T23:00' },
        { inicio: '2030-11-12T23:00', fin: '2030-11-13T00:00' },
      ]);
    });

    it('debería unificar tramos contiguos o superpuestos antes de dividir en turnos', () => {
      const tramos = [
        { horaInicio: '08:00', horaFin: '10:00' },
        { horaInicio: '09:00', horaFin: '11:00' },
      ];
      const turnos = generarTurnosDeFecha(fechaTest, tramos);

      expect(turnos).toHaveLength(3);
      expect(turnos[0]).toEqual({
        inicio: '2030-11-12T08:00',
        fin: '2030-11-12T09:00',
      });
      expect(turnos[2]).toEqual({
        inicio: '2030-11-12T10:00',
        fin: '2030-11-12T11:00',
      });
    });

    it('debería descartar turnos pasados cuando la fecha coincide con el día de la referencia', () => {
      const fechaHoy = '2030-11-07';
      const tramos = [
        { horaInicio: '08:00', horaFin: '12:00' },
        { horaInicio: '14:00', horaFin: '16:00' },
      ];
      // Supongamos que son las 10:15 del día de hoy
      const referenciaHoy = DateTime.fromISO('2030-11-07T10:15');

      const turnos = generarTurnosDeFecha(fechaHoy, tramos, referenciaHoy);

      // Los turnos de 08:00 a 09:00 y de 09:00 a 10:00 ya pasaron (start <= 10:15)
      // El turno de 10:00 a 11:00 también empezó antes de las 10:15 (start <= 10:15)
      // Por lo tanto, el primer turno disponible es 11:00 a 12:00
      expect(turnos).toEqual([
        { inicio: '2030-11-07T11:00', fin: '2030-11-07T12:00' },
        { inicio: '2030-11-07T14:00', fin: '2030-11-07T15:00' },
        { inicio: '2030-11-07T15:00', fin: '2030-11-07T16:00' },
      ]);
    });
  });

  describe('seSuperponenIntervalos', () => {
    it('debería devolver true cuando los intervalos son idénticos', () => {
      expect(
        seSuperponenIntervalos(
          '2030-11-12T10:00',
          '2030-11-12T11:00',
          '2030-11-12T10:00',
          '2030-11-12T11:00'
        )
      ).toBe(true);
    });

    it('debería devolver false cuando los intervalos son contiguos consecutivos', () => {
      expect(
        seSuperponenIntervalos(
          '2030-11-12T10:00',
          '2030-11-12T11:00',
          '2030-11-12T11:00',
          '2030-11-12T12:00'
        )
      ).toBe(false);

      expect(
        seSuperponenIntervalos(
          '2030-11-12T11:00',
          '2030-11-12T12:00',
          '2030-11-12T10:00',
          '2030-11-12T11:00'
        )
      ).toBe(false);
    });

    it('debería devolver true cuando un intervalo engloba o contiene al otro', () => {
      expect(
        seSuperponenIntervalos(
          '2030-11-12T10:00',
          '2030-11-12T12:00',
          '2030-11-12T10:30',
          '2030-11-12T11:30'
        )
      ).toBe(true);

      expect(
        seSuperponenIntervalos(
          '2030-11-12T10:30',
          '2030-11-12T11:30',
          '2030-11-12T10:00',
          '2030-11-12T12:00'
        )
      ).toBe(true);
    });

    it('debería devolver true cuando hay solapamiento parcial al inicio', () => {
      expect(
        seSuperponenIntervalos(
          '2030-11-12T09:30',
          '2030-11-12T10:30',
          '2030-11-12T10:00',
          '2030-11-12T11:00'
        )
      ).toBe(true);
    });

    it('debería devolver true cuando hay solapamiento parcial al final', () => {
      expect(
        seSuperponenIntervalos(
          '2030-11-12T10:30',
          '2030-11-12T11:30',
          '2030-11-12T10:00',
          '2030-11-12T11:00'
        )
      ).toBe(true);
    });

    it('debería devolver false cuando los intervalos son completamente disjuntos', () => {
      expect(
        seSuperponenIntervalos(
          '2030-11-12T08:00',
          '2030-11-12T09:00',
          '2030-11-12T14:00',
          '2030-11-12T15:00'
        )
      ).toBe(false);
    });

    it('debería lanzar ErrorFormatoDeFecha si alguna fecha es inválida', () => {
      expect(() =>
        seSuperponenIntervalos(
          '2030-02-30T10:00',
          '2030-02-30T11:00',
          '2030-11-12T10:00',
          '2030-11-12T11:00'
        )
      ).toThrow(ErrorFormatoDeFecha);
    });

    it('debería lanzar ErrorDeNegocio si inicio no es anterior a fin', () => {
      expect(() =>
        seSuperponenIntervalos(
          '2030-11-12T11:00',
          '2030-11-12T10:00',
          '2030-11-12T10:00',
          '2030-11-12T11:00'
        )
      ).toThrow(ErrorDeNegocio);
    });
  });

  describe('crearIntervaloValido', () => {
    it('debería crear un Interval válido para fechas ISO incluso con minutos que no sean en punto', () => {
      const intervalo = crearIntervaloValido(
        '2030-11-12T10:15',
        '2030-11-12T11:45'
      );

      expect(intervalo.isValid).toBe(true);
      expect(intervalo.length('minutes')).toBe(90);
    });

    it('debería aceptar instancias de DateTime de Luxon', () => {
      const dtInicio = DateTime.fromISO('2030-11-12T10:00');
      const dtFin = DateTime.fromISO('2030-11-12T11:30');

      const intervalo = crearIntervaloValido(dtInicio, dtFin);
      expect(intervalo.isValid).toBe(true);
      expect(intervalo.length('hours')).toBe(1.5);
    });

    it('debería lanzar ErrorFormatoDeFecha si la fecha no existe o el formato es incorrecto', () => {
      expect(() =>
        crearIntervaloValido('2030-02-30T10:00', '2030-02-30T11:00')
      ).toThrow(ErrorFormatoDeFecha);

      expect(() =>
        crearIntervaloValido('formato-invalido', '2030-11-12T11:00')
      ).toThrow(ErrorFormatoDeFecha);
    });

    it('debería lanzar ErrorDeNegocio si inicio es igual a fin (duración cero) o posterior a fin', () => {
      expect(() =>
        crearIntervaloValido('2030-11-12T10:00', '2030-11-12T10:00')
      ).toThrow(ErrorDeNegocio);

      expect(() =>
        crearIntervaloValido('2030-11-12T11:00', '2030-11-12T10:00')
      ).toThrow(ErrorDeNegocio);
    });
  });

  describe('evaluarSuperposicionConClasesAgendadas', () => {
    it('debería retornar true si el intervalo propuesto se superpone con alguna clase de la lista', () => {
      const clases = [
        { inicio: '2030-11-12T08:00', fin: '2030-11-12T09:00' },
        { inicio: '2030-11-12T10:00', fin: '2030-11-12T11:00' },
      ];

      // Caso: coincide exactamente con 10:00 a 11:00
      expect(
        evaluarSuperposicionConClasesAgendadas(
          '2030-11-12T10:00',
          '2030-11-12T11:00',
          clases
        )
      ).toBe(true);
    });

    it('debería retornar false si las clases son contiguas o no comparten tiempo', () => {
      const clases = [
        { inicio: '2030-11-12T08:00', fin: '2030-11-12T09:00' },
        { inicio: '2030-11-12T10:00', fin: '2030-11-12T11:00' },
      ];

      // Contigua entre las 09:00 y las 10:00
      expect(
        evaluarSuperposicionConClasesAgendadas(
          '2030-11-12T09:00',
          '2030-11-12T10:00',
          clases
        )
      ).toBe(false);

      // Posterior: 11:00 a 12:00
      expect(
        evaluarSuperposicionConClasesAgendadas(
          '2030-11-12T11:00',
          '2030-11-12T12:00',
          clases
        )
      ).toBe(false);
    });

    it('debería retornar false si la lista de clases está vacía', () => {
      expect(
        evaluarSuperposicionConClasesAgendadas(
          '2030-11-12T10:00',
          '2030-11-12T11:00',
          []
        )
      ).toBe(false);
    });
  });

  describe('crearFiltroSuperposicion', () => {
    it('debería generar el filtro con inicio menor a fin y fin mayor a inicio', () => {
      const filtro = crearFiltroSuperposicion(
        '2030-11-12T10:00',
        '2030-11-12T11:00'
      );

      expect(filtro).toEqual({
        inicio: { $lt: '2030-11-12T11:00' },
        fin: { $gt: '2030-11-12T10:00' },
      });
    });

    it('debería fusionar las condiciones adicionales del filtroBase provisto', () => {
      const filtro = crearFiltroSuperposicion(
        '2030-11-12T10:00',
        '2030-11-12T11:00',
        { alumno: 'alumnoId123' }
      );

      expect(filtro).toEqual({
        alumno: 'alumnoId123',
        inicio: { $lt: '2030-11-12T11:00' },
        fin: { $gt: '2030-11-12T10:00' },
      });
    });
  });
});
