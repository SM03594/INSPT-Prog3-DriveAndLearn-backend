import mongoose from 'mongoose';
import { setupTestDB } from '../helpers/setupTestDB.js';
import { ROLES } from '../../src/constants/roles.js';
import ErrorDeNegocio from '../../src/errors/ErrorDeNegocio.js';
import ErrorFormatoDeFecha from '../../src/errors/ErrorFormatoDeFecha.js';
import ErrorRegistroInexistente from '../../src/errors/ErrorRegistroInexistente.js';
import ErrorSaldoClasesInsuficiente from '../../src/errors/ErrorSaldoClasesInsuficiente.js';
import ErrorAutorizacion from '../../src/errors/ErrorAutorizacion.js';
import ErrorMongooseObjIdInvalido from '../../src/errors/ErrorMongooseObjIdInvalido.js';
import Clase from '../../src/models/Clase.js';
import * as alumnoService from '../../src/services/alumnoService.js';
import * as profesorService from '../../src/services/profesorService.js';
import * as autoService from '../../src/services/autoService.js';
import * as claseService from '../../src/services/claseService.js';

setupTestDB();

async function crearAlumnoFixture({
  nomApe = 'Alumno Test',
  email = `alumno.${Date.now()}.${Math.random()}@email.com`,
  saldo = 3,
} = {}) {
  return await alumnoService.crear({
    NomApe: nomApe,
    email,
    password: 'passwordSegura123',
    saldoClases: saldo,
  });
}

async function crearProfesorFixture({
  nomApe = 'Profesor Test',
  tramos = [
    {
      dia: 'lunes',
      tramoHorario: { horaInicio: '08:00', horaFin: '14:00' },
    },
    {
      dia: 'martes',
      tramoHorario: { horaInicio: '20:00', horaFin: '24:00' },
    },
  ],
} = {}) {
  const profesor = await profesorService.crear({ NomApe: nomApe });
  await profesorService.agregarDisponibilidad(profesor._id.toString(), tramos);

  return await profesorService.obtenerPorId(profesor._id.toString());
}

async function crearAutoFixture({
  marca = 'Volkswagen',
  modelo = 'Gol Trend',
  patente = `AB${Math.floor(100 + Math.random() * 900)}CD`,
  cambios = 'MANUAL',
} = {}) {
  return await autoService.crear({
    marca,
    modelo,
    patente,
    cambios,
  });
}

describe('claseService', () => {
  describe('agendar', () => {
    describe('casos de éxito', () => {
      it('debería agendar una clase válida, persistirla en la base de datos y descontar 1 crédito al alumno', async () => {
        const alumno = await crearAlumnoFixture({ saldo: 3 });
        const profesor = await crearProfesorFixture();
        const auto = await crearAutoFixture();

        const usuarioActual = {
          id: alumno._id.toString(),
          rol: ROLES.ALUMNO,
        };

        // 2026-11-09 es lunes; cae dentro de la disponibilidad del profesor (08:00 a 14:00)
        const claseCreada = await claseService.agendar(
          {
            alumno: alumno._id.toString(),
            profesor: profesor._id.toString(),
            auto: auto._id.toString(),
            inicio: '2026-11-09T10:00',
            fin: '2026-11-09T11:00',
          },
          usuarioActual
        );

        expect(claseCreada._id).toBeDefined();
        expect(claseCreada.alumno.toString()).toBe(alumno._id.toString());
        expect(claseCreada.profesor.toString()).toBe(profesor._id.toString());
        expect(claseCreada.auto.toString()).toBe(auto._id.toString());
        expect(claseCreada.inicio).toBe('2026-11-09T10:00');
        expect(claseCreada.fin).toBe('2026-11-09T11:00');

        // Verifica persistencia en la colección clases
        const claseEnDb = await Clase.findById(claseCreada._id);
        expect(claseEnDb).not.toBeNull();

        // Verifica que el saldo del alumno se redujo exactamente en 1
        const alumnoActualizado = await alumnoService.obtenerPorId(
          alumno._id.toString()
        );
        expect(alumnoActualizado.saldoClases).toBe(2);
      });

      it('debería permitir agendar una clase en el cierre del día (23:00 a 00:00 del día siguiente) si el profesor está disponible', async () => {
        const alumno = await crearAlumnoFixture({ saldo: 2 });
        const profesor = await crearProfesorFixture(); // Tiene martes 20:00 a 24:00
        const auto = await crearAutoFixture();

        const usuarioActual = {
          id: alumno._id.toString(),
          rol: ROLES.ALUMNO,
        };

        // 2026-11-10 es martes; 23:00 a medianoche (2026-11-11T00:00)
        const claseCreada = await claseService.agendar(
          {
            alumno: alumno._id.toString(),
            profesor: profesor._id.toString(),
            auto: auto._id.toString(),
            inicio: '2026-11-10T23:00',
            fin: '2026-11-11T00:00',
          },
          usuarioActual
        );

        expect(claseCreada._id).toBeDefined();
        expect(claseCreada.inicio).toBe('2026-11-10T23:00');
        expect(claseCreada.fin).toBe('2026-11-11T00:00');
      });
    });

    describe('Regla 0: Validación de formato y existencia de entidades y saldo', () => {
      it('debería rechazar con ErrorMongooseObjIdInvalido si algún id no tiene formato ObjectId', async () => {
        const alumno = await crearAlumnoFixture();
        const profesor = await crearProfesorFixture();
        const auto = await crearAutoFixture();

        const usuarioActual = { id: alumno._id.toString(), rol: ROLES.ALUMNO };

        await expect(
          claseService.agendar(
            {
              alumno: 'id-invalido',
              profesor: profesor._id.toString(),
              auto: auto._id.toString(),
              inicio: '2026-11-09T10:00',
              fin: '2026-11-09T11:00',
            },
            usuarioActual
          )
        ).rejects.toThrow(ErrorMongooseObjIdInvalido);

        await expect(
          claseService.agendar(
            {
              alumno: alumno._id.toString(),
              profesor: 'id-invalido',
              auto: auto._id.toString(),
              inicio: '2026-11-09T10:00',
              fin: '2026-11-09T11:00',
            },
            usuarioActual
          )
        ).rejects.toThrow(ErrorMongooseObjIdInvalido);

        await expect(
          claseService.agendar(
            {
              alumno: alumno._id.toString(),
              profesor: profesor._id.toString(),
              auto: 'id-invalido',
              inicio: '2026-11-09T10:00',
              fin: '2026-11-09T11:00',
            },
            usuarioActual
          )
        ).rejects.toThrow(ErrorMongooseObjIdInvalido);
      });

      it('debería rechazar con ErrorRegistroInexistente si el alumno no existe', async () => {
        const idInexistente = new mongoose.Types.ObjectId().toString();
        const profesor = await crearProfesorFixture();
        const auto = await crearAutoFixture();

        const usuarioActual = { id: idInexistente, rol: ROLES.ALUMNO };

        await expect(
          claseService.agendar(
            {
              alumno: idInexistente,
              profesor: profesor._id.toString(),
              auto: auto._id.toString(),
              inicio: '2026-11-09T10:00',
              fin: '2026-11-09T11:00',
            },
            usuarioActual
          )
        ).rejects.toThrow(ErrorRegistroInexistente);
      });

      it('debería rechazar con ErrorRegistroInexistente si el profesor no existe', async () => {
        const alumno = await crearAlumnoFixture();
        const idProfesorInexistente = new mongoose.Types.ObjectId().toString();
        const auto = await crearAutoFixture();

        const usuarioActual = { id: alumno._id.toString(), rol: ROLES.ALUMNO };

        await expect(
          claseService.agendar(
            {
              alumno: alumno._id.toString(),
              profesor: idProfesorInexistente,
              auto: auto._id.toString(),
              inicio: '2026-11-09T10:00',
              fin: '2026-11-09T11:00',
            },
            usuarioActual
          )
        ).rejects.toThrow(ErrorRegistroInexistente);
      });

      it('debería rechazar con ErrorRegistroInexistente si el auto no existe', async () => {
        const alumno = await crearAlumnoFixture();
        const profesor = await crearProfesorFixture();
        const idAutoInexistente = new mongoose.Types.ObjectId().toString();

        const usuarioActual = { id: alumno._id.toString(), rol: ROLES.ALUMNO };

        await expect(
          claseService.agendar(
            {
              alumno: alumno._id.toString(),
              profesor: profesor._id.toString(),
              auto: idAutoInexistente,
              inicio: '2026-11-09T10:00',
              fin: '2026-11-09T11:00',
            },
            usuarioActual
          )
        ).rejects.toThrow(ErrorRegistroInexistente);
      });

      it('debería rechazar con ErrorSaldoClasesInsuficiente si el alumno tiene saldo 0', async () => {
        const alumnoSinSaldo = await crearAlumnoFixture({ saldo: 0 });
        const profesor = await crearProfesorFixture();
        const auto = await crearAutoFixture();

        const usuarioActual = {
          id: alumnoSinSaldo._id.toString(),
          rol: ROLES.ALUMNO,
        };

        await expect(
          claseService.agendar(
            {
              alumno: alumnoSinSaldo._id.toString(),
              profesor: profesor._id.toString(),
              auto: auto._id.toString(),
              inicio: '2026-11-09T10:00',
              fin: '2026-11-09T11:00',
            },
            usuarioActual
          )
        ).rejects.toThrow(ErrorSaldoClasesInsuficiente);
      });
    });

    describe('Regla 1: Autorización del solicitante (solo el propio alumno)', () => {
      it('debería rechazar con ErrorAutorizacion si un alumno intenta agendar una clase para otro alumno', async () => {
        const alumno1 = await crearAlumnoFixture();
        const alumno2 = await crearAlumnoFixture();
        const profesor = await crearProfesorFixture();
        const auto = await crearAutoFixture();

        // Alumno 1 intenta agendar en la cuenta de Alumno 2
        const usuarioActual = {
          id: alumno1._id.toString(),
          rol: ROLES.ALUMNO,
        };

        await expect(
          claseService.agendar(
            {
              alumno: alumno2._id.toString(),
              profesor: profesor._id.toString(),
              auto: auto._id.toString(),
              inicio: '2026-11-09T10:00',
              fin: '2026-11-09T11:00',
            },
            usuarioActual
          )
        ).rejects.toThrow(ErrorAutorizacion);
      });

      it('debería rechazar con ErrorAutorizacion si un administrador intenta agendar (restringido en esta etapa)', async () => {
        const alumno = await crearAlumnoFixture();
        const profesor = await crearProfesorFixture();
        const auto = await crearAutoFixture();

        const usuarioActualAdmin = {
          id: new mongoose.Types.ObjectId().toString(),
          rol: ROLES.ADMINISTRADOR,
        };

        await expect(
          claseService.agendar(
            {
              alumno: alumno._id.toString(),
              profesor: profesor._id.toString(),
              auto: auto._id.toString(),
              inicio: '2026-11-09T10:00',
              fin: '2026-11-09T11:00',
            },
            usuarioActualAdmin
          )
        ).rejects.toThrow(ErrorAutorizacion);
      });
    });

    describe('Regla 2: Formato e integridad horaria (1 hora en punto)', () => {
      it('debería rechazar con ErrorDeNegocio si se intenta agendar en una fecha u horario pasado', async () => {
        const alumno = await crearAlumnoFixture();
        const profesor = await crearProfesorFixture();
        const auto = await crearAutoFixture();

        const usuarioActual = { id: alumno._id.toString(), rol: ROLES.ALUMNO };

        await expect(
          claseService.agendar(
            {
              alumno: alumno._id.toString(),
              profesor: profesor._id.toString(),
              auto: auto._id.toString(),
              inicio: '2020-01-06T10:00',
              fin: '2020-01-06T11:00',
            },
            usuarioActual
          )
        ).rejects.toThrow(ErrorDeNegocio);
      });

      it('debería rechazar con ErrorFormatoDeFecha si el inicio o fin no están en hora en punto', async () => {
        const alumno = await crearAlumnoFixture();
        const profesor = await crearProfesorFixture();
        const auto = await crearAutoFixture();

        const usuarioActual = { id: alumno._id.toString(), rol: ROLES.ALUMNO };

        await expect(
          claseService.agendar(
            {
              alumno: alumno._id.toString(),
              profesor: profesor._id.toString(),
              auto: auto._id.toString(),
              inicio: '2026-11-09T10:30',
              fin: '2026-11-09T11:30',
            },
            usuarioActual
          )
        ).rejects.toThrow(ErrorFormatoDeFecha);
      });

      it('debería rechazar con ErrorDeNegocio si la duración no es de exactamente 1 hora', async () => {
        const alumno = await crearAlumnoFixture();
        const profesor = await crearProfesorFixture();
        const auto = await crearAutoFixture();

        const usuarioActual = { id: alumno._id.toString(), rol: ROLES.ALUMNO };

        // Intento de agendar 2 horas
        await expect(
          claseService.agendar(
            {
              alumno: alumno._id.toString(),
              profesor: profesor._id.toString(),
              auto: auto._id.toString(),
              inicio: '2026-11-09T10:00',
              fin: '2026-11-09T12:00',
            },
            usuarioActual
          )
        ).rejects.toThrow(ErrorDeNegocio);
      });
    });

    describe('Regla 3: Disponibilidad del profesor', () => {
      it('debería rechazar con ErrorDeNegocio si el profesor no atiende en ese día de la semana', async () => {
        const alumno = await crearAlumnoFixture();
        const profesor = await crearProfesorFixture(); // Solo tiene lunes y martes
        const auto = await crearAutoFixture();

        const usuarioActual = { id: alumno._id.toString(), rol: ROLES.ALUMNO };

        // 2026-11-11 es miércoles (el profesor no tiene disponibilidad)
        await expect(
          claseService.agendar(
            {
              alumno: alumno._id.toString(),
              profesor: profesor._id.toString(),
              auto: auto._id.toString(),
              inicio: '2026-11-11T10:00',
              fin: '2026-11-11T11:00',
            },
            usuarioActual
          )
        ).rejects.toThrow(ErrorDeNegocio);
      });

      it('debería rechazar con ErrorDeNegocio si el horario solicitado está fuera de los tramos de disponibilidad del profesor', async () => {
        const alumno = await crearAlumnoFixture();
        const profesor = await crearProfesorFixture(); // Lunes de 08:00 a 14:00
        const auto = await crearAutoFixture();

        const usuarioActual = { id: alumno._id.toString(), rol: ROLES.ALUMNO };

        // 2026-11-09 es lunes, pero a las 16:00 (fuera de 08:00-14:00)
        await expect(
          claseService.agendar(
            {
              alumno: alumno._id.toString(),
              profesor: profesor._id.toString(),
              auto: auto._id.toString(),
              inicio: '2026-11-09T16:00',
              fin: '2026-11-09T17:00',
            },
            usuarioActual
          )
        ).rejects.toThrow(ErrorDeNegocio);
      });
    });

    describe('Reglas 2, 4 y 5: Ausencia de superposiciones', () => {
      it('debería rechazar con ErrorDeNegocio si el alumno ya tiene agendada otra clase a esa misma hora', async () => {
        const alumno = await crearAlumnoFixture({ saldo: 3 });
        const profesor1 = await crearProfesorFixture();
        const profesor2 = await crearProfesorFixture({ nomApe: 'Segundo Profesor' });
        const auto1 = await crearAutoFixture();
        const auto2 = await crearAutoFixture();

        const usuarioActual = { id: alumno._id.toString(), rol: ROLES.ALUMNO };

        // Primera clase del alumno a las 10:00
        await claseService.agendar(
          {
            alumno: alumno._id.toString(),
            profesor: profesor1._id.toString(),
            auto: auto1._id.toString(),
            inicio: '2026-11-09T10:00',
            fin: '2026-11-09T11:00',
          },
          usuarioActual
        );

        // Intento de agendar segunda clase del mismo alumno a las 10:00
        await expect(
          claseService.agendar(
            {
              alumno: alumno._id.toString(),
              profesor: profesor2._id.toString(),
              auto: auto2._id.toString(),
              inicio: '2026-11-09T10:00',
              fin: '2026-11-09T11:00',
            },
            usuarioActual
          )
        ).rejects.toThrow(ErrorDeNegocio);
      });

      it('debería rechazar con ErrorDeNegocio si el profesor ya tiene agendada otra clase a esa misma hora', async () => {
        const alumno1 = await crearAlumnoFixture({ saldo: 3 });
        const alumno2 = await crearAlumnoFixture({ saldo: 3 });
        const profesor = await crearProfesorFixture();
        const auto1 = await crearAutoFixture();
        const auto2 = await crearAutoFixture();

        // Alumno 1 agenda con el profesor a las 10:00
        await claseService.agendar(
          {
            alumno: alumno1._id.toString(),
            profesor: profesor._id.toString(),
            auto: auto1._id.toString(),
            inicio: '2026-11-09T10:00',
            fin: '2026-11-09T11:00',
          },
          { id: alumno1._id.toString(), rol: ROLES.ALUMNO }
        );

        // Alumno 2 intenta agendar con el mismo profesor a las 10:00
        await expect(
          claseService.agendar(
            {
              alumno: alumno2._id.toString(),
              profesor: profesor._id.toString(),
              auto: auto2._id.toString(),
              inicio: '2026-11-09T10:00',
              fin: '2026-11-09T11:00',
            },
            { id: alumno2._id.toString(), rol: ROLES.ALUMNO }
          )
        ).rejects.toThrow(ErrorDeNegocio);
      });

      it('debería rechazar con ErrorDeNegocio si el auto ya está asignado a otra clase a esa misma hora', async () => {
        const alumno1 = await crearAlumnoFixture({ saldo: 3 });
        const alumno2 = await crearAlumnoFixture({ saldo: 3 });
        const profesor1 = await crearProfesorFixture({ nomApe: 'Profesor Uno' });
        const profesor2 = await crearProfesorFixture({ nomApe: 'Profesor Dos' });
        const auto = await crearAutoFixture();

        // Alumno 1 reserva el auto a las 10:00
        await claseService.agendar(
          {
            alumno: alumno1._id.toString(),
            profesor: profesor1._id.toString(),
            auto: auto._id.toString(),
            inicio: '2026-11-09T10:00',
            fin: '2026-11-09T11:00',
          },
          { id: alumno1._id.toString(), rol: ROLES.ALUMNO }
        );

        // Alumno 2 intenta reservar el mismo auto a las 10:00 con otro profesor
        await expect(
          claseService.agendar(
            {
              alumno: alumno2._id.toString(),
              profesor: profesor2._id.toString(),
              auto: auto._id.toString(),
              inicio: '2026-11-09T10:00',
              fin: '2026-11-09T11:00',
            },
            { id: alumno2._id.toString(), rol: ROLES.ALUMNO }
          )
        ).rejects.toThrow(ErrorDeNegocio);
      });
    });
  });

  describe('eliminar', () => {
    it('debería permitir a un alumno eliminar su propia clase, borrándola de la base y reintegrándole 1 crédito de saldo', async () => {
      const alumno = await crearAlumnoFixture({ saldo: 2 });
      const profesor = await crearProfesorFixture();
      const auto = await crearAutoFixture();

      const usuarioActual = { id: alumno._id.toString(), rol: ROLES.ALUMNO };

      const claseCreada = await claseService.agendar(
        {
          alumno: alumno._id.toString(),
          profesor: profesor._id.toString(),
          auto: auto._id.toString(),
          inicio: '2026-11-09T10:00',
          fin: '2026-11-09T11:00',
        },
        usuarioActual
      );

      // Verificamos que el saldo bajó a 1
      const alumnoConSaldoDescontado = await alumnoService.obtenerPorId(
        alumno._id.toString()
      );
      expect(alumnoConSaldoDescontado.saldoClases).toBe(1);

      // El alumno cancela/elimina su clase
      const resultadoEliminar = await claseService.eliminar(
        claseCreada._id.toString(),
        usuarioActual
      );

      expect(resultadoEliminar).toBeDefined();

      // La clase ya no existe en la base
      const claseEnDb = await Clase.findById(claseCreada._id);
      expect(claseEnDb).toBeNull();

      // El saldo se reintegró a 2
      const alumnoConSaldoReintegrado = await alumnoService.obtenerPorId(
        alumno._id.toString()
      );
      expect(alumnoConSaldoReintegrado.saldoClases).toBe(2);
    });

    it('debería permitir a un administrador eliminar cualquier clase reintegrando el crédito al alumno correspondiente', async () => {
      const alumno = await crearAlumnoFixture({ saldo: 1 });
      const profesor = await crearProfesorFixture();
      const auto = await crearAutoFixture();

      const claseCreada = await claseService.agendar(
        {
          alumno: alumno._id.toString(),
          profesor: profesor._id.toString(),
          auto: auto._id.toString(),
          inicio: '2026-11-09T10:00',
          fin: '2026-11-09T11:00',
        },
        { id: alumno._id.toString(), rol: ROLES.ALUMNO }
      );

      const usuarioAdmin = {
        id: new mongoose.Types.ObjectId().toString(),
        rol: ROLES.ADMINISTRADOR,
      };

      await claseService.eliminar(claseCreada._id.toString(), usuarioAdmin);

      const claseEnDb = await Clase.findById(claseCreada._id);
      expect(claseEnDb).toBeNull();

      const alumnoActualizado = await alumnoService.obtenerPorId(
        alumno._id.toString()
      );
      expect(alumnoActualizado.saldoClases).toBe(1);
    });

    it('debería rechazar con ErrorAutorizacion si un alumno intenta eliminar la clase de otro alumno', async () => {
      const alumno1 = await crearAlumnoFixture({ saldo: 2 });
      const alumno2 = await crearAlumnoFixture({ saldo: 2 });
      const profesor = await crearProfesorFixture();
      const auto = await crearAutoFixture();

      const claseAlumno1 = await claseService.agendar(
        {
          alumno: alumno1._id.toString(),
          profesor: profesor._id.toString(),
          auto: auto._id.toString(),
          inicio: '2026-11-09T10:00',
          fin: '2026-11-09T11:00',
        },
        { id: alumno1._id.toString(), rol: ROLES.ALUMNO }
      );

      // Alumno 2 intenta eliminar la clase de Alumno 1
      const usuarioActualAlumno2 = {
        id: alumno2._id.toString(),
        rol: ROLES.ALUMNO,
      };

      await expect(
        claseService.eliminar(claseAlumno1._id.toString(), usuarioActualAlumno2)
      ).rejects.toThrow(ErrorAutorizacion);

      // La clase no fue eliminada
      const claseEnDb = await Clase.findById(claseAlumno1._id);
      expect(claseEnDb).not.toBeNull();
    });

    it('debería rechazar con ErrorMongooseObjIdInvalido si el id de la clase no es válido', async () => {
      const usuario = {
        id: new mongoose.Types.ObjectId().toString(),
        rol: ROLES.ALUMNO,
      };

      await expect(
        claseService.eliminar('id-invalido', usuario)
      ).rejects.toThrow(ErrorMongooseObjIdInvalido);
    });

    it('debería rechazar con ErrorRegistroInexistente si la clase no existe', async () => {
      const idInexistente = new mongoose.Types.ObjectId().toString();
      const usuario = {
        id: new mongoose.Types.ObjectId().toString(),
        rol: ROLES.ADMINISTRADOR,
      };

      await expect(
        claseService.eliminar(idInexistente, usuario)
      ).rejects.toThrow(ErrorRegistroInexistente);
    });
  });

  describe('obtenerPorId', () => {
    it('debería permitir a un alumno consultar su propia clase', async () => {
      const alumno = await crearAlumnoFixture();
      const profesor = await crearProfesorFixture();
      const auto = await crearAutoFixture();

      const usuarioActual = { id: alumno._id.toString(), rol: ROLES.ALUMNO };

      const claseCreada = await claseService.agendar(
        {
          alumno: alumno._id.toString(),
          profesor: profesor._id.toString(),
          auto: auto._id.toString(),
          inicio: '2026-11-09T10:00',
          fin: '2026-11-09T11:00',
        },
        usuarioActual
      );

      const claseObtenida = await claseService.obtenerPorId(
        claseCreada._id.toString(),
        usuarioActual
      );

      expect(claseObtenida._id.toString()).toBe(claseCreada._id.toString());
    });

    it('debería permitir a un administrador consultar cualquier clase', async () => {
      const alumno = await crearAlumnoFixture();
      const profesor = await crearProfesorFixture();
      const auto = await crearAutoFixture();

      const claseCreada = await claseService.agendar(
        {
          alumno: alumno._id.toString(),
          profesor: profesor._id.toString(),
          auto: auto._id.toString(),
          inicio: '2026-11-09T10:00',
          fin: '2026-11-09T11:00',
        },
        { id: alumno._id.toString(), rol: ROLES.ALUMNO }
      );

      const usuarioAdmin = {
        id: new mongoose.Types.ObjectId().toString(),
        rol: ROLES.ADMINISTRADOR,
      };

      const claseObtenida = await claseService.obtenerPorId(
        claseCreada._id.toString(),
        usuarioAdmin
      );

      expect(claseObtenida._id.toString()).toBe(claseCreada._id.toString());
    });

    it('debería rechazar con ErrorAutorizacion si un alumno intenta consultar una clase ajena', async () => {
      const alumno1 = await crearAlumnoFixture();
      const alumno2 = await crearAlumnoFixture();
      const profesor = await crearProfesorFixture();
      const auto = await crearAutoFixture();

      const claseCreada = await claseService.agendar(
        {
          alumno: alumno1._id.toString(),
          profesor: profesor._id.toString(),
          auto: auto._id.toString(),
          inicio: '2026-11-09T10:00',
          fin: '2026-11-09T11:00',
        },
        { id: alumno1._id.toString(), rol: ROLES.ALUMNO }
      );

      await expect(
        claseService.obtenerPorId(claseCreada._id.toString(), {
          id: alumno2._id.toString(),
          rol: ROLES.ALUMNO,
        })
      ).rejects.toThrow(ErrorAutorizacion);
    });

    it('debería retornar null si la clase solicitada no existe', async () => {
      const idInexistente = new mongoose.Types.ObjectId().toString();
      const usuarioAdmin = {
        id: new mongoose.Types.ObjectId().toString(),
        rol: ROLES.ADMINISTRADOR,
      };

      const resultado = await claseService.obtenerPorId(idInexistente, usuarioAdmin);
      expect(resultado).toBeNull();
    });
  });

  describe('listar', () => {
    it('un alumno solo debería ver sus propias clases', async () => {
      const alumno1 = await crearAlumnoFixture({ saldo: 3 });
      const alumno2 = await crearAlumnoFixture({ saldo: 3 });
      const profesor = await crearProfesorFixture();
      const auto1 = await crearAutoFixture();
      const auto2 = await crearAutoFixture();

      await claseService.agendar(
        {
          alumno: alumno1._id.toString(),
          profesor: profesor._id.toString(),
          auto: auto1._id.toString(),
          inicio: '2026-11-09T10:00',
          fin: '2026-11-09T11:00',
        },
        { id: alumno1._id.toString(), rol: ROLES.ALUMNO }
      );

      await claseService.agendar(
        {
          alumno: alumno2._id.toString(),
          profesor: profesor._id.toString(),
          auto: auto2._id.toString(),
          inicio: '2026-11-09T12:00',
          fin: '2026-11-09T13:00',
        },
        { id: alumno2._id.toString(), rol: ROLES.ALUMNO }
      );

      const clasesAlumno1 = await claseService.listar({}, {
        id: alumno1._id.toString(),
        rol: ROLES.ALUMNO,
      });

      expect(clasesAlumno1).toHaveLength(1);
      expect(clasesAlumno1[0].alumno.toString()).toBe(alumno1._id.toString());
    });

    it('un administrador debería ver todas las clases registradas en el sistema', async () => {
      const alumno1 = await crearAlumnoFixture({ saldo: 3 });
      const alumno2 = await crearAlumnoFixture({ saldo: 3 });
      const profesor = await crearProfesorFixture();
      const auto1 = await crearAutoFixture();
      const auto2 = await crearAutoFixture();

      await claseService.agendar(
        {
          alumno: alumno1._id.toString(),
          profesor: profesor._id.toString(),
          auto: auto1._id.toString(),
          inicio: '2026-11-09T10:00',
          fin: '2026-11-09T11:00',
        },
        { id: alumno1._id.toString(), rol: ROLES.ALUMNO }
      );

      await claseService.agendar(
        {
          alumno: alumno2._id.toString(),
          profesor: profesor._id.toString(),
          auto: auto2._id.toString(),
          inicio: '2026-11-09T12:00',
          fin: '2026-11-09T13:00',
        },
        { id: alumno2._id.toString(), rol: ROLES.ALUMNO }
      );

      const todasLasClases = await claseService.listar({}, {
        id: new mongoose.Types.ObjectId().toString(),
        rol: ROLES.ADMINISTRADOR,
      });

      expect(todasLasClases).toHaveLength(2);
    });
  });

  describe('listarPorFecha', () => {
    it('debería listar únicamente las clases que correspondan a la fecha indicada', async () => {
      const alumno = await crearAlumnoFixture({ saldo: 3 });
      const profesor = await crearProfesorFixture();
      const auto = await crearAutoFixture();
      const usuarioActual = { id: alumno._id.toString(), rol: ROLES.ALUMNO };

      await claseService.agendar(
        {
          alumno: alumno._id.toString(),
          profesor: profesor._id.toString(),
          auto: auto._id.toString(),
          inicio: '2026-11-09T10:00',
          fin: '2026-11-09T11:00',
        },
        usuarioActual
      );

      const clasesDia9 = await claseService.listarPorFecha('2026-11-09');
      const clasesDia10 = await claseService.listarPorFecha('2026-11-10');

      expect(clasesDia9).toHaveLength(1);
      expect(clasesDia9[0].inicio).toBe('2026-11-09T10:00');
      expect(clasesDia10).toHaveLength(0);
    });
  });
});
