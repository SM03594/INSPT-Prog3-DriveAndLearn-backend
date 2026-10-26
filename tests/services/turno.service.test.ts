// ============================================================
//  turno.service.test.ts — Tests de la consulta de turnos libres
// ============================================================
// Escenario: la escuela abre de lunes a sábado de 08 a 20 (el domingo
// cierra). El profesor Juan trabaja los lunes de 09 a 13 y de 15 a 17;
// Marta, los lunes de 08 a 20. Autos: AA111AA y BB222BB (manuales),
// CC333CC (automático) y DD444DD (automático, fuera de servicio). Ana
// y Beto tienen saldo. Las horas de los tests son de la escuela
// (-03:00, el OFFSET_HORA_UTC por defecto).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { setupTestDB } from '../setupTestDB.js';
import { AlumnoModel } from '../../src/models/Alumno.js';
import { AdministradorModel } from '../../src/models/Administrador.js';
import { AutoModel } from '../../src/models/Auto.js';
import { ClaseModel } from '../../src/models/Clase.js';
import { HorarioEscuelaModel } from '../../src/models/HorarioEscuela.js';
import { ProfesorModel } from '../../src/models/Profesor.js';
import { crearCalendarioSemanal, type Dia } from '../../src/models/CalendarioSemanal.js';
import type { Tramo } from '../../src/models/Tramo.js';
import { crear as reservar, type ActorClase } from '../../src/services/clase.service.js';
import { listarTurnosLibres, type TurnosLibres } from '../../src/services/turno.service.js';
import type { ConsultarTurnosDto } from '../../src/dtos/turno.dto.js';
import {
  aHoraLocal,
  hoyEnLaEscuela,
  instanteLocal,
  type FechaCalendario,
} from '../../src/utils/fechas.js';

setupTestDB();

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

const juanId = new Types.ObjectId();
const martaId = new Types.ObjectId();
const anaId = new Types.ObjectId();
const betoId = new Types.ObjectId();
const adminId = new Types.ObjectId();
const autos = {
  AA: new Types.ObjectId(),
  BB: new Types.ObjectId(),
  CC: new Types.ObjectId(),
  DD: new Types.ObjectId(),
};

const ana: ActorClase = { id: anaId.toString(), rol: 'alumno' };
const beto: ActorClase = { id: betoId.toString(), rol: 'alumno' };
const admin: ActorClase = { id: adminId.toString(), rol: 'administrador' };

let lunes: FechaCalendario;

// "08:00" → { hora: 8, minuto: 0 }; "08:30" → { hora: 8, minuto: 30 }
const hora = (texto: string) => {
  const [h, m] = texto.split(':').map(Number);
  return { hora: h, minuto: m };
};

const tramo = (inicio: string, fin: string): Tramo => ({
  horaInicio: hora(inicio),
  horaFin: hora(fin),
});

// El próximo lunes (al menos a 7 días, así nunca es "hoy").
function proximoLunes(): FechaCalendario {
  let instante = new Date(Date.now() + 7 * DIA);
  while (aHoraLocal(instante).dia !== 'lunes') {
    instante = new Date(instante.getTime() + DIA);
  }
  return hoyEnLaEscuela(instante);
}

function masDias(fecha: FechaCalendario, dias: number): FechaCalendario {
  return hoyEnLaEscuela(new Date(instanteLocal(fecha, hora('12:00')).getTime() + dias * DIA));
}

async function disponibilidadDeJuan(tramos: Tramo[], dia: Dia = 'lunes') {
  await ProfesorModel.findByIdAndUpdate(juanId, {
    disponibilidad: { ...crearCalendarioSemanal(), [dia]: tramos },
  });
}

// Una clase guardada directo en la base (sin las reglas de la reserva),
// por ejemplo para simular una clase vieja que no empieza en punto.
async function claseGuardada(
  alumno: Types.ObjectId,
  profesor: Types.ObjectId,
  auto: Types.ObjectId,
  inicio: string,
  fin: string,
) {
  await ClaseModel.create({
    alumno,
    profesor,
    auto,
    inicio: instanteLocal(lunes, hora(inicio)),
    fin: instanteLocal(lunes, hora(fin)),
  });
}

const consulta = (extra: Partial<ConsultarTurnosDto> = {}): ConsultarTurnosDto => ({
  fecha: lunes,
  cambios: 'MANUAL',
  ...extra,
});

// Las horas de inicio de los turnos, en la hora de la escuela.
const horas = (res: TurnosLibres | null) => res?.turnos.map((t) => aHoraLocal(t.inicio).hora);

const patentesALas = (res: TurnosLibres | null, horaDelTurno: number) =>
  res?.turnos
    .find((t) => aHoraLocal(t.inicio).hora === horaDelTurno)
    ?.autos.map((auto) => auto.patente);

beforeEach(async () => {
  lunes = proximoLunes();

  const escuela = crearCalendarioSemanal();
  for (const dia of ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const) {
    escuela[dia].push(tramo('08:00', '20:00'));
  }

  await Promise.all([
    HorarioEscuelaModel.create({ _id: 'escuela', calendario: escuela }),
    ProfesorModel.create([
      {
        _id: juanId,
        nomApe: 'Juan',
        disponibilidad: {
          ...crearCalendarioSemanal(),
          lunes: [tramo('09:00', '13:00'), tramo('15:00', '17:00')],
        },
      },
      {
        _id: martaId,
        nomApe: 'Marta',
        disponibilidad: { ...crearCalendarioSemanal(), lunes: [tramo('08:00', '20:00')] },
      },
    ]),
    AutoModel.create([
      { _id: autos.AA, marca: 'Fiat', modelo: 'Cronos', patente: 'AA111AA', cambios: 'MANUAL' },
      { _id: autos.BB, marca: 'Fiat', modelo: 'Cronos', patente: 'BB222BB', cambios: 'MANUAL' },
      { _id: autos.CC, marca: 'VW', modelo: 'Gol', patente: 'CC333CC', cambios: 'AUTOMATICO' },
      { _id: autos.DD, patente: 'DD444DD', cambios: 'AUTOMATICO', activo: false },
    ]),
    AlumnoModel.create([
      { _id: anaId, email: 'ana@example.com', password: 'hash', nomApe: 'Ana', clasesPorReservar: 2 },
      { _id: betoId, email: 'beto@example.com', password: 'hash', nomApe: 'Beto', clasesPorReservar: 2 },
    ]),
    AdministradorModel.create({ _id: adminId, email: 'admin@example.com', password: 'hash', nomApe: 'Admin' }),
  ]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('listarTurnosLibres', () => {
  // --------------------------------------------------------
  //  La respuesta
  // --------------------------------------------------------
  it('todo libre: los turnos en punto de Juan, cada uno con los autos manuales', async () => {
    const res = await listarTurnosLibres(juanId.toString(), consulta(), ana);

    expect(res?.dia).toBe('lunes');
    expect(res?.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(horas(res)).toEqual([9, 10, 11, 12, 15, 16]);
    for (const turno of res?.turnos ?? []) {
      expect(turno.fin.getTime() - turno.inicio.getTime()).toBe(HORA);
      expect(turno.autos.map((auto) => auto.patente)).toEqual(['AA111AA', 'BB222BB']);
    }
  });

  it('el primer turno es 09:00 en la escuela = 12:00 UTC', async () => {
    const res = await listarTurnosLibres(juanId.toString(), consulta(), ana);

    expect(res?.turnos[0].inicio.toISOString()).toMatch(/T12:00:00\.000Z$/);
  });

  it('sin "cambios": los autos activos de los dos tipos', async () => {
    const res = await listarTurnosLibres(juanId.toString(), consulta({ cambios: undefined }), ana);

    expect(patentesALas(res, 9)).toEqual(['AA111AA', 'BB222BB', 'CC333CC']);
  });

  it('AUTOMATICO con CC333CC fuera de servicio: no hay turnos (DD444DD tampoco anda)', async () => {
    await AutoModel.findByIdAndUpdate(autos.CC, { activo: false });

    const res = await listarTurnosLibres(juanId.toString(), consulta({ cambios: 'AUTOMATICO' }), ana);

    expect(res?.turnos).toEqual([]);
  });

  // --------------------------------------------------------
  //  Días sin turnos
  // --------------------------------------------------------
  it('el domingo la escuela cierra', async () => {
    await disponibilidadDeJuan([tramo('09:00', '13:00')], 'domingo');

    const res = await listarTurnosLibres(juanId.toString(), consulta({ fecha: masDias(lunes, 6) }), ana);

    expect(res?.dia).toBe('domingo');
    expect(res?.turnos).toEqual([]);
  });

  it('si la escuela no cargó su horario, no hay turnos', async () => {
    await HorarioEscuelaModel.deleteMany({});

    const res = await listarTurnosLibres(juanId.toString(), consulta(), ana);

    expect(res?.turnos).toEqual([]);
  });

  it('el martes Juan no trabaja', async () => {
    const res = await listarTurnosLibres(juanId.toString(), consulta({ fecha: masDias(lunes, 1) }), ana);

    expect(res?.turnos).toEqual([]);
  });

  // --------------------------------------------------------
  //  Cómo se arman las ventanas
  // --------------------------------------------------------
  it('si la disponibilidad se sale del horario de la escuela, solo queda la parte común', async () => {
    await disponibilidadDeJuan([tramo('06:00', '10:00')]);

    expect(horas(await listarTurnosLibres(juanId.toString(), consulta(), ana))).toEqual([8, 9]);
  });

  it('tramos superpuestos: cada uno por separado, sin repetir inicios', async () => {
    await disponibilidadDeJuan([tramo('09:00', '12:00'), tramo('11:00', '13:00')]);

    expect(horas(await listarTurnosLibres(juanId.toString(), consulta(), ana))).toEqual([9, 10, 11, 12]);
  });

  it('tramos pegados en punto: no se pierde ningún turno', async () => {
    await disponibilidadDeJuan([tramo('09:00', '10:00'), tramo('10:00', '12:00')]);

    expect(horas(await listarTurnosLibres(juanId.toString(), consulta(), ana))).toEqual([9, 10, 11]);
  });

  it('tramos viejos pegados que no son en punto: la de 10 cruzaría los dos y no se ofrece', async () => {
    await disponibilidadDeJuan([tramo('09:00', '10:30'), tramo('10:30', '12:00')]);

    expect(horas(await listarTurnosLibres(juanId.toString(), consulta(), ana))).toEqual([9, 11]);
  });

  it('desde 10:00 hasta 12:00: solo los turnos que entran completos', async () => {
    const res = await listarTurnosLibres(
      juanId.toString(),
      consulta({ desde: hora('10:00'), hasta: hora('12:00') }),
      ana,
    );

    expect(horas(res)).toEqual([10, 11]);
  });

  it('solo "desde": 15:00', async () => {
    const res = await listarTurnosLibres(juanId.toString(), consulta({ desde: hora('15:00') }), ana);

    expect(horas(res)).toEqual([15, 16]);
  });

  it('desde 08:30 con Marta: arranca en la primera hora en punto', async () => {
    const res = await listarTurnosLibres(
      martaId.toString(),
      consulta({ desde: hora('08:30'), hasta: hora('11:00') }),
      ana,
    );

    expect(horas(res)).toEqual([9, 10]);
  });

  // --------------------------------------------------------
  //  Clases ya reservadas
  // --------------------------------------------------------
  it('un auto ocupado sale solo de ese turno', async () => {
    await claseGuardada(betoId, martaId, autos.AA, '10:00', '11:00');

    const res = await listarTurnosLibres(juanId.toString(), consulta(), ana);

    expect(horas(res)).toEqual([9, 10, 11, 12, 15, 16]);
    expect(patentesALas(res, 10)).toEqual(['BB222BB']);
    expect(patentesALas(res, 11)).toEqual(['AA111AA', 'BB222BB']);
  });

  it('con todos los autos ocupados, el turno no aparece', async () => {
    await claseGuardada(betoId, martaId, autos.AA, '10:00', '11:00');
    await claseGuardada(new Types.ObjectId(), new Types.ObjectId(), autos.BB, '10:00', '11:00');

    expect(horas(await listarTurnosLibres(juanId.toString(), consulta(), ana))).toEqual([9, 11, 12, 15, 16]);
  });

  it('si Juan ya tiene clase, ese turno no aparece', async () => {
    await claseGuardada(betoId, juanId, autos.CC, '10:00', '11:00');

    expect(horas(await listarTurnosLibres(juanId.toString(), consulta(), ana))).toEqual([9, 11, 12, 15, 16]);
  });

  it('una clase vieja de Juan de 10:30 a 11:30 tapa los turnos de 10 y de 11', async () => {
    await claseGuardada(betoId, juanId, autos.CC, '10:30', '11:30');

    expect(horas(await listarTurnosLibres(juanId.toString(), consulta(), ana))).toEqual([9, 12, 15, 16]);
  });

  it('a Ana no se le ofrece un turno en el que ya tiene clase (con otro profesor); a un admin, sí', async () => {
    await claseGuardada(anaId, martaId, autos.CC, '11:00', '12:00');

    expect(horas(await listarTurnosLibres(juanId.toString(), consulta(), ana))).toEqual([9, 10, 12, 15, 16]);
    expect(horas(await listarTurnosLibres(juanId.toString(), consulta(), admin))).toEqual([9, 10, 11, 12, 15, 16]);
  });

  // --------------------------------------------------------
  //  Hoy
  // --------------------------------------------------------
  it('si la fecha es hoy, se sacan los turnos que ya empezaron (son las 10:20)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(instanteLocal(lunes, hora('10:20')));

    expect(horas(await listarTurnosLibres(juanId.toString(), consulta(), ana))).toEqual([11, 12, 15, 16]);
  });

  it('si la fecha es hoy y ya pasó el horario, no hay turnos', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(instanteLocal(lunes, hora('19:00')));

    expect((await listarTurnosLibres(juanId.toString(), consulta(), ana))?.turnos).toEqual([]);
  });

  // --------------------------------------------------------
  //  Errores, en orden: 400 → 403 → 404 → 409
  // --------------------------------------------------------
  it('fecha pasada → 400', async () => {
    await expect(
      listarTurnosLibres(juanId.toString(), consulta({ fecha: { anio: 2020, mes: 1, diaDelMes: 6 } }), ana),
    ).rejects.toMatchObject({ status: 400, message: 'La fecha debe ser hoy o posterior' });
  });

  it('cuenta borrada → 403', async () => {
    await AlumnoModel.findByIdAndDelete(anaId);
    await AdministradorModel.findByIdAndDelete(adminId);

    await expect(listarTurnosLibres(juanId.toString(), consulta(), ana))
      .rejects.toMatchObject({ status: 403 });
    await expect(listarTurnosLibres(juanId.toString(), consulta(), admin))
      .rejects.toMatchObject({ status: 403 });
  });

  it('profesor inexistente → null (404), aunque el alumno tampoco tenga saldo', async () => {
    await AlumnoModel.findByIdAndUpdate(anaId, { clasesPorReservar: 0 });

    expect(await listarTurnosLibres(new Types.ObjectId().toString(), consulta(), ana)).toBeNull();
  });

  it('alumno sin saldo → 409; el admin no tiene saldo que revisar', async () => {
    await AlumnoModel.findByIdAndUpdate(anaId, { clasesPorReservar: 0 });

    await expect(listarTurnosLibres(juanId.toString(), consulta(), ana))
      .rejects.toMatchObject({ status: 409, message: 'No tenés clases disponibles para reservar' });
    expect(await listarTurnosLibres(juanId.toString(), consulta(), admin)).not.toBeNull();
  });

  // --------------------------------------------------------
  //  De punta a punta: la consulta y la reserva no se contradicen
  // --------------------------------------------------------
  it('cada turno devuelto se puede reservar tal cual, y después ya no aparece', async () => {
    const antes = await listarTurnosLibres(juanId.toString(), consulta({ cambios: undefined }), ana);

    for (const turno of antes?.turnos ?? []) {
      // Beto reserva todos los turnos del día: le cargamos saldo de sobra.
      await AlumnoModel.updateMany({}, { clasesPorReservar: 10 });
      const clase = await reservar(
        { profesor: juanId.toString(), auto: turno.autos[0]._id.toString(), inicio: turno.inicio, fin: turno.fin },
        beto,
      );
      expect(clase.inicio.toISOString()).toBe(turno.inicio.toISOString());
    }

    const despues = await listarTurnosLibres(juanId.toString(), consulta(), ana);
    expect(despues?.turnos).toEqual([]);
  });

  it('un admin reserva un turno devuelto para un alumno', async () => {
    const res = await listarTurnosLibres(juanId.toString(), consulta(), admin);
    const turno = res!.turnos[0];

    const clase = await reservar(
      {
        profesor: juanId.toString(),
        auto: turno.autos[0]._id.toString(),
        inicio: turno.inicio,
        fin: turno.fin,
        alumno: anaId.toString(),
      },
      admin,
    );

    expect(clase.alumno.toString()).toBe(anaId.toString());
    expect((await AlumnoModel.findById(anaId))?.clasesPorReservar).toBe(1);
  });
});
