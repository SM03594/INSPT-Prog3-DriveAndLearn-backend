import ErrorCampoInvalido from '../../src/errors/ErrorCampoInvalido.js';
import ErrorDeTipo from '../../src/errors/ErrorDeTipo.js';
import ErrorPeticionInvalida from '../../src/errors/ErrorPeticionInvalida.js';
import { capturarError } from '../helpers/capturarError.js';
import {
  validarCrearProfesorDTO,
  validarActualizarProfesorDTO,
  validarModificarDisponibilidadDTO,
  validarAgregarDisponibilidadDTO,
  validarQuitarDisponibilidadDTO,
  validarTurnosLibresQueryDTO,
} from '../../src/dtos/profesorDTO.js';

function crearCuerpoProfesorValido() {
  return {
    NomApe: 'Mariana López',
  };
}

function crearCuerpoDisponibilidadValido() {
  return {
    tramos: [
      {
        dia: 'lunes',
        tramoHorario: {
          horaInicio: '08:00',
          horaFin: '14:00',
        },
      },
      {
        dia: 'martes',
        tramoHorario: {
          horaInicio: '10:00',
          horaFin: '16:00',
        },
      },
    ],
  };
}

describe('profesorDTO', () => {
  describe('validarCrearProfesorDTO', () => {
    describe('casos válidos', () => {
      it('debería aceptar un cuerpo con todos los campos obligatorios y tipos correctos', () => {
        const cuerpoProfesor = crearCuerpoProfesorValido();

        expect(() => validarCrearProfesorDTO(cuerpoProfesor)).not.toThrow();
      });

      it('debería devolver una copia con los mismos datos sin mutar el cuerpo original', () => {
        const cuerpoProfesor = crearCuerpoProfesorValido();
        const copiaOriginal = { ...cuerpoProfesor };

        const datosValidados = validarCrearProfesorDTO(cuerpoProfesor);

        expect(datosValidados).toEqual(cuerpoProfesor);
        expect(datosValidados).not.toBe(cuerpoProfesor);
        expect(cuerpoProfesor).toEqual(copiaOriginal);
      });

      // El DTO solo valida estructura y tipos: si el string está vacío o contiene espacios,
      // la validación de negocio la realiza el modelo o servicio correspondiente.
      it('no debería validar reglas de dominio como strings vacíos en NomApe', () => {
        const cuerpoConNomApeVacio = { NomApe: '' };

        expect(() => validarCrearProfesorDTO(cuerpoConNomApeVacio)).not.toThrow();
      });
    });

    describe('cuerpo vacío', () => {
      it('debería rechazar un cuerpo sin campos con ErrorCampoInvalido', () => {
        const error = capturarError(() => validarCrearProfesorDTO({}));

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error).toBeInstanceOf(ErrorPeticionInvalida);
        expect(error.statusCode).toBe(400);
        expect(error.message).toBe('El cuerpo de la solicitud no puede estar vacío');
      });
    });

    describe('campos obligatorios faltantes', () => {
      it('debería rechazar si falta el campo obligatorio NomApe', () => {
        const error = capturarError(() =>
          validarCrearProfesorDTO({ otroCampo: 'valor' })
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toContain('Campos obligatorios faltantes: NomApe');
      });
    });

    describe('campos no permitidos', () => {
      it.each(['disponibilidad', '_id', 'rol', '$set', 'activo', 'telefono', '__v'])(
        'debería rechazar el campo desconocido %s',
        (campoExtra) => {
          const cuerpoProfesor = {
            ...crearCuerpoProfesorValido(),
            [campoExtra]: 'valor',
          };

          const error = capturarError(() => validarCrearProfesorDTO(cuerpoProfesor));

          expect(error).toBeInstanceOf(ErrorCampoInvalido);
          expect(error.message).toBe(`Campos no permitidos: ${campoExtra}`);
        }
      );

      it('debería listar múltiples campos no permitidos en un único mensaje', () => {
        const cuerpoProfesor = {
          ...crearCuerpoProfesorValido(),
          disponibilidad: {},
          edad: 35,
        };

        const error = capturarError(() => validarCrearProfesorDTO(cuerpoProfesor));

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe('Campos no permitidos: disponibilidad, edad');
      });

      it('debería validar la estructura antes que los tipos', () => {
        const error = capturarError(() =>
          validarCrearProfesorDTO({ NomApe: 12345, campoInvalido: 'algo' })
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error).not.toBeInstanceOf(ErrorDeTipo);
      });
    });

    describe('tipos incorrectos', () => {
      const valoresNoString = [
        ['un número', 123],
        ['un booleano', true],
        ['null', null],
        ['un objeto', { valor: 'x' }],
        ['un array', ['x']],
      ];

      it.each(valoresNoString)(
        'debería rechazar %s con ErrorDeTipo en NomApe',
        (_descripcion, valorInvalido) => {
          const cuerpoProfesor = { NomApe: valorInvalido };

          const error = capturarError(() => validarCrearProfesorDTO(cuerpoProfesor));

          expect(error).toBeInstanceOf(ErrorDeTipo);
          expect(error).toBeInstanceOf(ErrorPeticionInvalida);
          expect(error.statusCode).toBe(400);
          expect(error.message).toBe(
            'Tipos de datos incorrectos en: NomApe (se esperaba string)'
          );
        }
      );
    });
  });

  describe('validarActualizarProfesorDTO', () => {
    describe('casos válidos', () => {
      it('debería aceptar un cuerpo con el campo opcional NomApe', () => {
        const cuerpoActualizar = { NomApe: 'Mariana López Actualizada' };

        expect(validarActualizarProfesorDTO(cuerpoActualizar)).toEqual(
          cuerpoActualizar
        );
      });

      it('debería devolver una copia sin mutar el cuerpo original', () => {
        const cuerpoActualizar = { NomApe: 'Mariana L.' };
        const copiaOriginal = { ...cuerpoActualizar };

        const resultado = validarActualizarProfesorDTO(cuerpoActualizar);

        expect(resultado).toEqual(cuerpoActualizar);
        expect(resultado).not.toBe(cuerpoActualizar);
        expect(cuerpoActualizar).toEqual(copiaOriginal);
      });
    });

    describe('cuerpo vacío', () => {
      it('debería rechazar un cuerpo sin campos con ErrorCampoInvalido', () => {
        const error = capturarError(() => validarActualizarProfesorDTO({}));

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe('El cuerpo de la solicitud no puede estar vacío');
      });
    });

    describe('campos no permitidos', () => {
      it.each(['disponibilidad', '_id', 'rol', '$set', 'email'])(
        'debería rechazar el campo no permitido %s',
        (campoExtra) => {
          const error = capturarError(() =>
            validarActualizarProfesorDTO({ [campoExtra]: 'valor' })
          );

          expect(error).toBeInstanceOf(ErrorCampoInvalido);
          expect(error.message).toBe(`Campos no permitidos: ${campoExtra}`);
        }
      );

      it('nunca debería informar campos obligatorios faltantes', () => {
        const error = capturarError(() =>
          validarActualizarProfesorDTO({ campoInexistente: 'valor' })
        );

        expect(error.message).not.toContain('Campos obligatorios faltantes');
      });
    });

    describe('tipos incorrectos', () => {
      it.each([
        ['un número', 999],
        ['un booleano', false],
        ['null', null],
        ['un array', ['nombre']],
      ])('debería rechazar %s en NomApe con ErrorDeTipo', (_desc, valorInvalido) => {
        const error = capturarError(() =>
          validarActualizarProfesorDTO({ NomApe: valorInvalido })
        );

        expect(error).toBeInstanceOf(ErrorDeTipo);
        expect(error.message).toBe(
          'Tipos de datos incorrectos en: NomApe (se esperaba string)'
        );
      });
    });
  });

  describe('validarModificarDisponibilidadDTO', () => {
    describe('casos válidos', () => {
      it('debería aceptar un cuerpo con una lista válida de tramos', () => {
        const cuerpoDisponibilidad = crearCuerpoDisponibilidadValido();

        expect(() =>
          validarModificarDisponibilidadDTO(cuerpoDisponibilidad)
        ).not.toThrow();
      });

      it('debería devolver el mismo objeto de entrada', () => {
        const cuerpoDisponibilidad = crearCuerpoDisponibilidadValido();

        const resultado =
          validarModificarDisponibilidadDTO(cuerpoDisponibilidad);

        expect(resultado).toBe(cuerpoDisponibilidad);
      });

      it('debería aceptar un array de tramos vacío', () => {
        const cuerpoVacio = { tramos: [] };

        expect(() =>
          validarModificarDisponibilidadDTO(cuerpoVacio)
        ).not.toThrow();
      });

      // El DTO solo valida estructura y tipos: el chequeo de si el día pertenece
      // a DIAS_SEMANA y si las horas tienen formato en punto lo hace calendarizacion.js.
      it('no debería validar contenido de dominio en día o formato de horas', () => {
        const cuerpoSinFormatoDominio = {
          tramos: [
            {
              dia: 'dia-inexistente',
              tramoHorario: {
                horaInicio: '08:30',
                horaFin: '14:15',
              },
            },
          ],
        };

        expect(() =>
          validarModificarDisponibilidadDTO(cuerpoSinFormatoDominio)
        ).not.toThrow();
      });
    });

    describe('validación estructural de la raíz', () => {
      it('debería rechazar un cuerpo vacío', () => {
        const error = capturarError(() =>
          validarModificarDisponibilidadDTO({})
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe('El cuerpo de la solicitud no puede estar vacío');
      });

      it('debería rechazar si falta el campo obligatorio tramos', () => {
        const error = capturarError(() =>
          validarModificarDisponibilidadDTO({ otro: 'valor' })
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toContain('Campos obligatorios faltantes: tramos');
      });

      it('debería rechazar campos adicionales en la raíz', () => {
        const cuerpoConExtra = {
          ...crearCuerpoDisponibilidadValido(),
          extra: 'no permitido',
        };

        const error = capturarError(() =>
          validarModificarDisponibilidadDTO(cuerpoConExtra)
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe('Campos no permitidos: extra');
      });

      it('debería rechazar si tramos no es de tipo object (por ejemplo, string)', () => {
        const error = capturarError(() =>
          validarModificarDisponibilidadDTO({ tramos: 'no-es-array' })
        );

        expect(error).toBeInstanceOf(ErrorDeTipo);
        expect(error.message).toBe(
          'Tipos de datos incorrectos en: tramos (se esperaba object)'
        );
      });

      it('debería rechazar si tramos es un objeto pero no un array', () => {
        const error = capturarError(() =>
          validarModificarDisponibilidadDTO({ tramos: { dia: 'lunes' } })
        );

        expect(error).toBeInstanceOf(ErrorDeTipo);
        expect(error.message).toBe('El campo tramos debe ser un array');
      });

      it('debería rechazar si tramos es null con ErrorDeTipo', () => {
        const error = capturarError(() =>
          validarModificarDisponibilidadDTO({ tramos: null })
        );

        expect(error).toBeInstanceOf(ErrorDeTipo);
        expect(error.message).toBe('El campo tramos debe ser un array');
      });
    });

    describe('validación de cada item dentro de tramos', () => {
      it.each([
        ['un número', 123],
        ['un string', 'lunes'],
        ['un booleano', true],
        ['null', null],
        ['un array anidado', []],
      ])(
        'debería rechazar si un elemento de tramos es %s',
        (_desc, itemInvalido) => {
          const error = capturarError(() =>
            validarModificarDisponibilidadDTO({ tramos: [itemInvalido] })
          );

          expect(error).toBeInstanceOf(ErrorDeTipo);
          expect(error.message).toBe(
            'Cada elemento de tramos debe ser un objeto válido'
          );
        }
      );

      it('debería rechazar un item vacío {} dentro de tramos', () => {
        const error = capturarError(() =>
          validarModificarDisponibilidadDTO({ tramos: [{}] })
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe('El cuerpo de la solicitud no puede estar vacío');
      });

      it('debería rechazar si falta dia en un item', () => {
        const error = capturarError(() =>
          validarModificarDisponibilidadDTO({
            tramos: [
              {
                tramoHorario: { horaInicio: '08:00', horaFin: '12:00' },
              },
            ],
          })
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe('Campos obligatorios faltantes: dia');
      });

      it('debería rechazar si falta tramoHorario en un item', () => {
        const error = capturarError(() =>
          validarModificarDisponibilidadDTO({
            tramos: [{ dia: 'lunes' }],
          })
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe('Campos obligatorios faltantes: tramoHorario');
      });

      it('debería rechazar campos desconocidos dentro del item', () => {
        const error = capturarError(() =>
          validarModificarDisponibilidadDTO({
            tramos: [
              {
                dia: 'lunes',
                tramoHorario: { horaInicio: '08:00', horaFin: '12:00' },
                campoExtra: 'invalido',
              },
            ],
          })
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe('Campos no permitidos: campoExtra');
      });

      it('debería rechazar si dia no es string', () => {
        const error = capturarError(() =>
          validarModificarDisponibilidadDTO({
            tramos: [
              {
                dia: 1,
                tramoHorario: { horaInicio: '08:00', horaFin: '12:00' },
              },
            ],
          })
        );

        expect(error).toBeInstanceOf(ErrorDeTipo);
        expect(error.message).toBe(
          'Tipos de datos incorrectos en: dia (se esperaba string)'
        );
      });
    });

    describe('validación de tramoHorario anidado', () => {
      it('debería rechazar si tramoHorario es null', () => {
        const error = capturarError(() =>
          validarModificarDisponibilidadDTO({
            tramos: [
              {
                dia: 'lunes',
                tramoHorario: null,
              },
            ],
          })
        );

        expect(error).toBeInstanceOf(ErrorDeTipo);
        expect(error.message).toBe(
          'El campo tramoHorario debe ser un objeto válido'
        );
      });

      it('debería rechazar si tramoHorario es un array', () => {
        const error = capturarError(() =>
          validarModificarDisponibilidadDTO({
            tramos: [
              {
                dia: 'lunes',
                tramoHorario: ['08:00', '12:00'],
              },
            ],
          })
        );

        expect(error).toBeInstanceOf(ErrorDeTipo);
        expect(error.message).toBe(
          'El campo tramoHorario debe ser un objeto válido'
        );
      });

      it('debería rechazar si tramoHorario es un objeto vacío {}', () => {
        const error = capturarError(() =>
          validarModificarDisponibilidadDTO({
            tramos: [
              {
                dia: 'lunes',
                tramoHorario: {},
              },
            ],
          })
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe('El cuerpo de la solicitud no puede estar vacío');
      });

      it.each(['horaInicio', 'horaFin'])(
        'debería rechazar si falta %s dentro de tramoHorario',
        (campoFaltante) => {
          const tramoHorarioIncompleto = {
            horaInicio: '08:00',
            horaFin: '12:00',
          };
          delete tramoHorarioIncompleto[campoFaltante];

          const error = capturarError(() =>
            validarModificarDisponibilidadDTO({
              tramos: [
                {
                  dia: 'lunes',
                  tramoHorario: tramoHorarioIncompleto,
                },
              ],
            })
          );

          expect(error).toBeInstanceOf(ErrorCampoInvalido);
          expect(error.message).toBe(
            `Campos obligatorios faltantes: ${campoFaltante}`
          );
        }
      );

      it('debería rechazar campos adicionales dentro de tramoHorario', () => {
        const error = capturarError(() =>
          validarModificarDisponibilidadDTO({
            tramos: [
              {
                dia: 'lunes',
                tramoHorario: {
                  horaInicio: '08:00',
                  horaFin: '12:00',
                  observacion: 'turno matutino',
                },
              },
            ],
          })
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe('Campos no permitidos: observacion');
      });

      it.each([
        ['horaInicio', 800],
        ['horaFin', false],
      ])(
        'debería rechazar si %s no es de tipo string',
        (campo, valorInvalido) => {
          const tramoHorarioConTipoInvalido = {
            horaInicio: '08:00',
            horaFin: '12:00',
            [campo]: valorInvalido,
          };

          const error = capturarError(() =>
            validarModificarDisponibilidadDTO({
              tramos: [
                {
                  dia: 'lunes',
                  tramoHorario: tramoHorarioConTipoInvalido,
                },
              ],
            })
          );

          expect(error).toBeInstanceOf(ErrorDeTipo);
          expect(error.message).toBe(
            `Tipos de datos incorrectos en: ${campo} (se esperaba string)`
          );
        }
      );
    });

    describe('alias validarAgregarDisponibilidadDTO y validarQuitarDisponibilidadDTO', () => {
      it('validarAgregarDisponibilidadDTO debería referenciar a la misma función', () => {
        expect(validarAgregarDisponibilidadDTO).toBe(
          validarModificarDisponibilidadDTO
        );
      });

      it('validarQuitarDisponibilidadDTO debería referenciar a la misma función', () => {
        expect(validarQuitarDisponibilidadDTO).toBe(
          validarModificarDisponibilidadDTO
        );
      });

      it('validarAgregarDisponibilidadDTO debería validar correctamente un cuerpo válido', () => {
        const cuerpo = crearCuerpoDisponibilidadValido();

        expect(() => validarAgregarDisponibilidadDTO(cuerpo)).not.toThrow();
      });

      it('validarQuitarDisponibilidadDTO debería validar correctamente un cuerpo válido', () => {
        const cuerpo = crearCuerpoDisponibilidadValido();

        expect(() => validarQuitarDisponibilidadDTO(cuerpo)).not.toThrow();
      });
    });
  });

  describe('validarTurnosLibresQueryDTO', () => {
    describe('casos válidos', () => {
      it('debería aceptar query solo con fecha requerida', () => {
        const query = { fecha: '2026-11-10' };

        expect(() => validarTurnosLibresQueryDTO(query)).not.toThrow();
      });

      it('debería aceptar query con fecha y cambios opcional', () => {
        const query = { fecha: '2026-11-10', cambios: 'MANUAL' };

        expect(() => validarTurnosLibresQueryDTO(query)).not.toThrow();
      });

      it('debería devolver una copia con los campos válidos sin mutar el original', () => {
        const query = { fecha: '2026-11-10', cambios: 'MANUAL' };
        const copia = { ...query };

        const resultado = validarTurnosLibresQueryDTO(query);

        expect(resultado).toEqual(query);
        expect(resultado).not.toBe(query);
        expect(query).toEqual(copia);
      });
    });

    describe('query vacía o inválida', () => {
      it('debería rechazar si query es null, undefined o no es objeto con ErrorDeTipo', () => {
        expect(() => validarTurnosLibresQueryDTO(null)).toThrow(ErrorDeTipo);
        expect(() => validarTurnosLibresQueryDTO(undefined)).toThrow(
          ErrorDeTipo
        );
        expect(() => validarTurnosLibresQueryDTO('string')).toThrow(
          ErrorDeTipo
        );
        expect(() => validarTurnosLibresQueryDTO(['array'])).toThrow(
          ErrorDeTipo
        );
      });

      it('debería rechazar un objeto vacío con ErrorCampoInvalido', () => {
        const error = capturarError(() => validarTurnosLibresQueryDTO({}));

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.statusCode).toBe(400);
        expect(error.message).toBe('Los parámetros de consulta no pueden estar vacíos');
      });
    });

    describe('campos obligatorios faltantes', () => {
      it('debería rechazar si falta el campo obligatorio fecha', () => {
        const error = capturarError(() =>
          validarTurnosLibresQueryDTO({ cambios: 'MANUAL' })
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toContain('Campos obligatorios faltantes: fecha');
      });
    });

    describe('campos no permitidos', () => {
      it('debería rechazar si se envían parámetros de consulta no permitidos', () => {
        const error = capturarError(() =>
          validarTurnosLibresQueryDTO({
            fecha: '2026-11-10',
            invalido: 'algo',
          })
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toContain('Campos no permitidos: invalido');
      });
    });

    describe('tipos de datos incorrectos', () => {
      it('debería rechazar si fecha no es un string', () => {
        const error = capturarError(() =>
          validarTurnosLibresQueryDTO({ fecha: 12345 })
        );

        expect(error).toBeInstanceOf(ErrorDeTipo);
        expect(error.message).toContain('fecha (se esperaba string)');
      });

      it('debería rechazar si fecha es un array por parameter pollution', () => {
        const error = capturarError(() =>
          validarTurnosLibresQueryDTO({
            fecha: ['2026-11-10', '2026-11-11'],
          })
        );

        expect(error).toBeInstanceOf(ErrorDeTipo);
        expect(error.message).toContain('fecha (se esperaba string)');
      });

      it('debería rechazar si cambios no es un string', () => {
        const error = capturarError(() =>
          validarTurnosLibresQueryDTO({ fecha: '2026-11-10', cambios: 123 })
        );

        expect(error).toBeInstanceOf(ErrorDeTipo);
        expect(error.message).toContain('cambios (se esperaba string)');
      });
    });
  });
});
