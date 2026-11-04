import ErrorCampoInvalido from '../../src/errors/ErrorCampoInvalido.js';
import ErrorDeTipo from '../../src/errors/ErrorDeTipo.js';
import ErrorPeticionInvalida from '../../src/errors/ErrorPeticionInvalida.js';
import { capturarError } from '../helpers/capturarError.js';
import {
  validarCrearAlumnoDTO,
  validarActualizarAlumnoDTO,
  validarSumarSaldoClasesDTO,
  validarRestarSaldoClasesDTO,
} from '../../src/dtos/alumnoDTO.js';

function crearCuerpoAlumnoCompleto() {
  return {
    NomApe: 'Lucas Benítez',
    email: 'lucas@driveandlearn.com',
    password: 'passwordSegura123',
    saldoClases: 5,
  };
}

describe('alumnoDTO', () => {
  describe('validarCrearAlumnoDTO', () => {
    describe('casos válidos', () => {
      it('debería aceptar un cuerpo con todos los campos obligatorios y el saldo opcional', () => {
        const cuerpoAlumno = crearCuerpoAlumnoCompleto();

        expect(() => validarCrearAlumnoDTO(cuerpoAlumno)).not.toThrow();
      });

      it('debería aceptar un cuerpo omitiendo el campo opcional saldoClases', () => {
        const cuerpoSinSaldo = {
          NomApe: 'Lucas Benítez',
          email: 'lucas@driveandlearn.com',
          password: 'passwordSegura123',
        };

        expect(validarCrearAlumnoDTO(cuerpoSinSaldo)).toEqual(cuerpoSinSaldo);
      });

      it('debería aceptar saldoClases con valor 0', () => {
        const cuerpoConSaldoCero = {
          ...crearCuerpoAlumnoCompleto(),
          saldoClases: 0,
        };

        const resultado = validarCrearAlumnoDTO(cuerpoConSaldoCero);

        expect(resultado.saldoClases).toBe(0);
      });

      it('debería devolver una copia con los mismos datos sin mutar el cuerpo original', () => {
        const cuerpoAlumno = crearCuerpoAlumnoCompleto();
        const copiaOriginal = { ...cuerpoAlumno };

        const datosValidados = validarCrearAlumnoDTO(cuerpoAlumno);

        expect(datosValidados).toEqual(cuerpoAlumno);
        expect(datosValidados).not.toBe(cuerpoAlumno);
        expect(cuerpoAlumno).toEqual(copiaOriginal);
      });

      it('debería aceptar los campos en cualquier orden', () => {
        const cuerpoDesordenado = {
          saldoClases: 3,
          password: 'passwordSegura123',
          email: 'lucas@driveandlearn.com',
          NomApe: 'Lucas Benítez',
        };

        expect(validarCrearAlumnoDTO(cuerpoDesordenado)).toEqual(
          cuerpoDesordenado
        );
      });

      // El DTO solo valida estructura y tipos: si saldoClases es negativo,
      // la validación semántica pertenece al modelo Mongoose / servicio.
      it('no debería validar contenido de dominio como saldo negativo o formato de email', () => {
        const cuerpoConValoresNegocioInvalidos = {
          NomApe: '',
          email: 'correo-invalido',
          password: '123',
          saldoClases: -10,
        };

        expect(() =>
          validarCrearAlumnoDTO(cuerpoConValoresNegocioInvalidos)
        ).not.toThrow();
      });
    });

    describe('cuerpo vacío', () => {
      it('debería rechazar un cuerpo sin campos con ErrorCampoInvalido', () => {
        const error = capturarError(() => validarCrearAlumnoDTO({}));

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error).toBeInstanceOf(ErrorPeticionInvalida);
        expect(error.statusCode).toBe(400);
        expect(error.message).toBe('El cuerpo de la solicitud no puede estar vacío');
      });
    });

    describe('campos obligatorios faltantes', () => {
      it.each(['NomApe', 'email', 'password'])(
        'debería rechazar si falta el campo obligatorio %s',
        (campoFaltante) => {
          const cuerpoAlumno = crearCuerpoAlumnoCompleto();
          delete cuerpoAlumno[campoFaltante];

          const error = capturarError(() => validarCrearAlumnoDTO(cuerpoAlumno));

          expect(error).toBeInstanceOf(ErrorCampoInvalido);
          expect(error.message).toBe(
            `Campos obligatorios faltantes: ${campoFaltante}`
          );
        }
      );

      it('nunca debería reportar saldoClases como faltante si no se envía', () => {
        const error = capturarError(() =>
          validarCrearAlumnoDTO({ email: 'solo@email.com' })
        );

        expect(error.message).toContain('Campos obligatorios faltantes:');
        expect(error.message).not.toContain('saldoClases');
      });
    });

    describe('campos no permitidos', () => {
      it.each(['cantidad', 'rol', '_id', '$set', 'activo', '__v'])(
        'debería rechazar el campo desconocido %s',
        (campoExtra) => {
          const cuerpoAlumno = {
            ...crearCuerpoAlumnoCompleto(),
            [campoExtra]: 'valor',
          };

          const error = capturarError(() => validarCrearAlumnoDTO(cuerpoAlumno));

          expect(error).toBeInstanceOf(ErrorCampoInvalido);
          expect(error.message).toBe(`Campos no permitidos: ${campoExtra}`);
        }
      );

      it('debería rechazar "cantidad" ya que es exclusivo de sumar y restar saldo', () => {
        const cuerpoConCantidad = {
          ...crearCuerpoAlumnoCompleto(),
          cantidad: 5,
        };

        const error = capturarError(() =>
          validarCrearAlumnoDTO(cuerpoConCantidad)
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe('Campos no permitidos: cantidad');
      });

      it('debería validar la estructura antes que los tipos', () => {
        const error = capturarError(() =>
          validarCrearAlumnoDTO({ NomApe: 12345, campoDesconocido: 'invalido' })
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error).not.toBeInstanceOf(ErrorDeTipo);
      });
    });

    describe('tipos incorrectos', () => {
      describe.each(['NomApe', 'email', 'password'])('campo %s', (campo) => {
        it.each([
          ['un número', 123],
          ['un booleano', true],
          ['null', null],
          ['un objeto', { valor: 'x' }],
          ['un array', ['x']],
        ])(
          'debería rechazar %s con ErrorDeTipo',
          (_descripcion, valorInvalido) => {
            const cuerpoAlumno = {
              ...crearCuerpoAlumnoCompleto(),
              [campo]: valorInvalido,
            };

            const error = capturarError(() =>
              validarCrearAlumnoDTO(cuerpoAlumno)
            );

            expect(error).toBeInstanceOf(ErrorDeTipo);
            expect(error.message).toBe(
              `Tipos de datos incorrectos en: ${campo} (se esperaba string)`
            );
          }
        );
      });

      describe('campo saldoClases (number)', () => {
        it.each([
          ['un string numérico', '5'],
          ['un booleano', true],
          ['null', null],
          ['un objeto', { saldo: 5 }],
          ['un array', [5]],
          ['NaN', Number.NaN],
        ])(
          'debería rechazar %s con ErrorDeTipo esperando number',
          (_desc, valorInvalido) => {
            const cuerpoAlumno = {
              ...crearCuerpoAlumnoCompleto(),
              saldoClases: valorInvalido,
            };

            const error = capturarError(() =>
              validarCrearAlumnoDTO(cuerpoAlumno)
            );

            expect(error).toBeInstanceOf(ErrorDeTipo);
            expect(error.message).toBe(
              'Tipos de datos incorrectos en: saldoClases (se esperaba number)'
            );
          }
        );
      });
    });
  });

  describe('validarActualizarAlumnoDTO', () => {
    describe('casos válidos', () => {
      it.each([
        ['NomApe', 'Nombre Actualizado'],
        ['email', 'nuevo@email.com'],
        ['password', 'nuevaPass123'],
      ])('debería aceptar la actualización parcial de solo %s', (campo, valor) => {
        const cuerpoParcial = { [campo]: valor };

        expect(validarActualizarAlumnoDTO(cuerpoParcial)).toEqual(cuerpoParcial);
      });

      it('debería aceptar la actualización de varios campos válidos', () => {
        const cuerpoParcial = {
          NomApe: 'Lucas B.',
          email: 'lucasb@correo.com',
        };

        expect(validarActualizarAlumnoDTO(cuerpoParcial)).toEqual(cuerpoParcial);
      });

      it('debería devolver una copia sin mutar el cuerpo original', () => {
        const cuerpoParcial = { NomApe: 'Lucas B.' };
        const copiaOriginal = { ...cuerpoParcial };

        const resultado = validarActualizarAlumnoDTO(cuerpoParcial);

        expect(resultado).toEqual(cuerpoParcial);
        expect(resultado).not.toBe(cuerpoParcial);
        expect(cuerpoParcial).toEqual(copiaOriginal);
      });
    });

    describe('cuerpo vacío', () => {
      it('debería rechazar un cuerpo sin campos con ErrorCampoInvalido', () => {
        const error = capturarError(() => validarActualizarAlumnoDTO({}));

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe('El cuerpo de la solicitud no puede estar vacío');
      });
    });

    describe('campos no permitidos', () => {
      it.each(['saldoClases', 'cantidad', 'rol', '_id', '$set'])(
        'debería rechazar el campo no permitido %s',
        (campoExtra) => {
          const error = capturarError(() =>
            validarActualizarAlumnoDTO({ [campoExtra]: 'valor' })
          );

          expect(error).toBeInstanceOf(ErrorCampoInvalido);
          expect(error.message).toBe(`Campos no permitidos: ${campoExtra}`);
        }
      );

      it('debería rechazar saldoClases al actualizar ya que debe gestionarse por sumar/restar', () => {
        const error = capturarError(() =>
          validarActualizarAlumnoDTO({ saldoClases: 10 })
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe('Campos no permitidos: saldoClases');
      });

      it('nunca debería informar campos obligatorios faltantes', () => {
        const error = capturarError(() =>
          validarActualizarAlumnoDTO({ campoInvalido: 'algo' })
        );

        expect(error.message).not.toContain('Campos obligatorios faltantes');
      });
    });

    describe('tipos incorrectos', () => {
      it.each([
        ['NomApe', 123],
        ['email', true],
        ['password', null],
      ])('debería rechazar %s con un valor no string', (campo, valorInvalido) => {
        const error = capturarError(() =>
          validarActualizarAlumnoDTO({ [campo]: valorInvalido })
        );

        expect(error).toBeInstanceOf(ErrorDeTipo);
        expect(error.message).toBe(
          `Tipos de datos incorrectos en: ${campo} (se esperaba string)`
        );
      });
    });
  });

  describe('validarSumarSaldoClasesDTO', () => {
    describe('casos válidos', () => {
      it('debería aceptar un cuerpo con el campo obligatorio cantidad', () => {
        const cuerpo = { cantidad: 5 };

        expect(validarSumarSaldoClasesDTO(cuerpo)).toEqual(cuerpo);
      });

      it('debería aceptar cantidad con valor 0', () => {
        const cuerpo = { cantidad: 0 };

        expect(validarSumarSaldoClasesDTO(cuerpo)).toEqual(cuerpo);
      });

      it('debería devolver una copia sin mutar el cuerpo original', () => {
        const cuerpo = { cantidad: 3 };
        const copiaOriginal = { ...cuerpo };

        const resultado = validarSumarSaldoClasesDTO(cuerpo);

        expect(resultado).toEqual(cuerpo);
        expect(resultado).not.toBe(cuerpo);
        expect(cuerpo).toEqual(copiaOriginal);
      });

      // El DTO solo valida tipo y estructura; los números negativos o decimales
      // son validados por el servicio alumnoService.
      it('no debería validar reglas de dominio como cantidades negativas', () => {
        expect(() => validarSumarSaldoClasesDTO({ cantidad: -5 })).not.toThrow();
      });
    });

    describe('cuerpo vacío y campos faltantes', () => {
      it('debería rechazar un cuerpo vacío', () => {
        const error = capturarError(() => validarSumarSaldoClasesDTO({}));

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe('El cuerpo de la solicitud no puede estar vacío');
      });

      it('debería rechazar si falta el campo cantidad', () => {
        const error = capturarError(() =>
          validarSumarSaldoClasesDTO({ saldoClases: 5 })
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toContain('Campos obligatorios faltantes: cantidad');
      });
    });

    describe('campos no permitidos', () => {
      it.each(['saldoClases', 'NomApe', 'email', 'password', '_id', '$set'])(
        'debería rechazar el campo no permitido %s',
        (campoExtra) => {
          const error = capturarError(() =>
            validarSumarSaldoClasesDTO({ cantidad: 1, [campoExtra]: 'extra' })
          );

          expect(error).toBeInstanceOf(ErrorCampoInvalido);
          expect(error.message).toBe(`Campos no permitidos: ${campoExtra}`);
        }
      );
    });

    describe('tipos incorrectos', () => {
      it.each([
        ['un string numérico', '5'],
        ['un booleano', true],
        ['null', null],
        ['un objeto', { cant: 5 }],
        ['un array', [5]],
        ['NaN', Number.NaN],
      ])(
        'debería rechazar %s en cantidad con ErrorDeTipo',
        (_desc, valorInvalido) => {
          const error = capturarError(() =>
            validarSumarSaldoClasesDTO({ cantidad: valorInvalido })
          );

          expect(error).toBeInstanceOf(ErrorDeTipo);
          expect(error.message).toBe(
            'Tipos de datos incorrectos en: cantidad (se esperaba number)'
          );
        }
      );
    });
  });

  describe('validarRestarSaldoClasesDTO', () => {
    describe('casos válidos', () => {
      it('debería aceptar un cuerpo con el campo obligatorio cantidad', () => {
        const cuerpo = { cantidad: 2 };

        expect(validarRestarSaldoClasesDTO(cuerpo)).toEqual(cuerpo);
      });

      it('debería devolver una copia sin mutar el cuerpo original', () => {
        const cuerpo = { cantidad: 2 };
        const copiaOriginal = { ...cuerpo };

        const resultado = validarRestarSaldoClasesDTO(cuerpo);

        expect(resultado).toEqual(cuerpo);
        expect(resultado).not.toBe(cuerpo);
        expect(cuerpo).toEqual(copiaOriginal);
      });
    });

    describe('cuerpo vacío y campos faltantes', () => {
      it('debería rechazar un cuerpo vacío', () => {
        const error = capturarError(() => validarRestarSaldoClasesDTO({}));

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe('El cuerpo de la solicitud no puede estar vacío');
      });

      it('debería rechazar si falta el campo cantidad', () => {
        const error = capturarError(() =>
          validarRestarSaldoClasesDTO({ total: 2 })
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toContain('Campos obligatorios faltantes: cantidad');
      });
    });

    describe('campos no permitidos', () => {
      it.each(['saldoClases', 'NomApe', 'email', 'password', '_id'])(
        'debería rechazar el campo no permitido %s',
        (campoExtra) => {
          const error = capturarError(() =>
            validarRestarSaldoClasesDTO({ cantidad: 1, [campoExtra]: 'extra' })
          );

          expect(error).toBeInstanceOf(ErrorCampoInvalido);
          expect(error.message).toBe(`Campos no permitidos: ${campoExtra}`);
        }
      );
    });

    describe('tipos incorrectos', () => {
      it.each([
        ['un string', '2'],
        ['un booleano', false],
        ['null', null],
        ['un objeto', { cant: 2 }],
        ['un array', [2]],
        ['NaN', Number.NaN],
      ])(
        'debería rechazar %s en cantidad con ErrorDeTipo',
        (_desc, valorInvalido) => {
          const error = capturarError(() =>
            validarRestarSaldoClasesDTO({ cantidad: valorInvalido })
          );

          expect(error).toBeInstanceOf(ErrorDeTipo);
          expect(error.message).toBe(
            'Tipos de datos incorrectos en: cantidad (se esperaba number)'
          );
        }
      );
    });
  });
});
