import ErrorCampoInvalido from '../../src/errors/ErrorCampoInvalido.js';
import ErrorDeTipo from '../../src/errors/ErrorDeTipo.js';
import ErrorPeticionInvalida from '../../src/errors/ErrorPeticionInvalida.js';
import { capturarError } from '../helpers/capturarError.js';
import {
  validarCrearAutoDTO,
  validarActualizarAutoDTO,
} from '../../src/dtos/autoDTO.js';


function crearCuerpoAutoValido() {
  return {
    marca: 'Volkswagen',
    modelo: 'Gol Trend',
    patente: 'ABC123',
    cambios: 'MANUAL',
  };
}

describe('autoDTO', () => {
  describe('validarCrearAutoDTO', () => {
    describe('casos válidos', () => {
      it('debería aceptar un cuerpo con todos los campos obligatorios y tipos correctos', () => {
        const cuerpoAuto = crearCuerpoAutoValido();

        expect(() => validarCrearAutoDTO(cuerpoAuto)).not.toThrow();
      });

      it('debería devolver una copia con los mismos datos sin mutar el cuerpo original', () => {
        const cuerpoAuto = crearCuerpoAutoValido();
        const copiaOriginal = { ...cuerpoAuto };

        const datosValidados = validarCrearAutoDTO(cuerpoAuto);

        expect(datosValidados).toEqual(cuerpoAuto);
        expect(datosValidados).not.toBe(cuerpoAuto);
        expect(cuerpoAuto).toEqual(copiaOriginal);
      });

      it('debería aceptar los campos en cualquier orden', () => {
        const cuerpoDesordenado = {
          cambios: 'AUTOMATICO',
          patente: 'AB123CD',
          modelo: 'Etios',
          marca: 'Toyota',
        };

        expect(validarCrearAutoDTO(cuerpoDesordenado)).toEqual(cuerpoDesordenado);
      });

      // El DTO solo valida estructura y tipos: el formato de la patente,
      // los valores de cambios y los strings vacíos los valida el modelo/servicio.
      it('no debería validar contenido de dominio (formato de patente, valor de cambios, strings vacíos)', () => {
        const cuerpoConContenidoInvalido = {
          marca: '',
          modelo: '   ',
          patente: 'patente-invalida',
          cambios: 'semiautomatico',
        };

        expect(() => validarCrearAutoDTO(cuerpoConContenidoInvalido)).not.toThrow();
      });
    });

    describe('cuerpo vacío', () => {
      it('debería rechazar un cuerpo sin campos con ErrorCampoInvalido', () => {
        const error = capturarError(() => validarCrearAutoDTO({}));

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error).toBeInstanceOf(ErrorPeticionInvalida);
        expect(error.statusCode).toBe(400);
        expect(error.message).toBe('El cuerpo de la solicitud no puede estar vacío');
      });
    });

    describe('campos obligatorios faltantes', () => {
      it.each(['marca', 'modelo', 'patente', 'cambios'])(
        'debería rechazar si falta el campo %s',
        (campoFaltante) => {
          const cuerpoAuto = crearCuerpoAutoValido();
          delete cuerpoAuto[campoFaltante];

          const error = capturarError(() => validarCrearAutoDTO(cuerpoAuto));

          expect(error).toBeInstanceOf(ErrorCampoInvalido);
          expect(error.message).toBe(
            `Campos obligatorios faltantes: ${campoFaltante}`
          );
        }
      );

      it('debería listar todos los campos faltantes en un único mensaje', () => {
        const error = capturarError(() =>
          validarCrearAutoDTO({ marca: 'Fiat' })
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe(
          'Campos obligatorios faltantes: modelo, patente, cambios'
        );
      });
    });

    describe('campos no permitidos', () => {
      it.each(['_id', 'activo', 'color', '$set', '__v'])(
        'debería rechazar el campo desconocido %s',
        (campoExtra) => {
          const cuerpoAuto = { ...crearCuerpoAutoValido(), [campoExtra]: 'valor' };

          const error = capturarError(() => validarCrearAutoDTO(cuerpoAuto));

          expect(error).toBeInstanceOf(ErrorCampoInvalido);
          expect(error.message).toBe(`Campos no permitidos: ${campoExtra}`);
        }
      );

      it('debería listar todos los campos no permitidos en un único mensaje', () => {
        const cuerpoAuto = {
          ...crearCuerpoAutoValido(),
          color: 'rojo',
          anio: 2020,
        };

        const error = capturarError(() => validarCrearAutoDTO(cuerpoAuto));

        expect(error.message).toBe('Campos no permitidos: color, anio');
      });

      it('debería informar campos no permitidos y faltantes juntos separados por " | "', () => {
        const error = capturarError(() =>
          validarCrearAutoDTO({ marca: 'Fiat', color: 'rojo' })
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe(
          'Campos no permitidos: color | Campos obligatorios faltantes: modelo, patente, cambios'
        );
      });

      it('debería validar la estructura antes que los tipos', () => {
        const error = capturarError(() =>
          validarCrearAutoDTO({ marca: 123, color: 'rojo' })
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

      describe.each(['marca', 'modelo', 'patente', 'cambios'])(
        'campo %s',
        (campo) => {
          it.each(valoresNoString)(
            'debería rechazar %s con ErrorDeTipo',
            (_descripcion, valorInvalido) => {
              const cuerpoAuto = {
                ...crearCuerpoAutoValido(),
                [campo]: valorInvalido,
              };

              const error = capturarError(() => validarCrearAutoDTO(cuerpoAuto));

              expect(error).toBeInstanceOf(ErrorDeTipo);
              expect(error).toBeInstanceOf(ErrorPeticionInvalida);
              expect(error.statusCode).toBe(400);
              expect(error.message).toBe(
                `Tipos de datos incorrectos en: ${campo} (se esperaba string)`
              );
            }
          );
        }
      );

      it('debería listar todos los campos con tipo incorrecto en un único mensaje', () => {
        const cuerpoAuto = {
          marca: 1,
          modelo: 'Gol',
          patente: false,
          cambios: null,
        };

        const error = capturarError(() => validarCrearAutoDTO(cuerpoAuto));

        expect(error).toBeInstanceOf(ErrorDeTipo);
        expect(error.message).toBe(
          'Tipos de datos incorrectos en: marca (se esperaba string), patente (se esperaba string), cambios (se esperaba string)'
        );
      });
    });
  });

  describe('validarActualizarAutoDTO', () => {
    describe('casos válidos', () => {
      it.each([
        ['marca', 'Renault'],
        ['modelo', 'Clio'],
        ['patente', 'AA111BB'],
        ['cambios', 'AUTOMATICO'],
      ])('debería aceptar la actualización parcial de solo %s', (campo, valor) => {
        const cuerpoParcial = { [campo]: valor };

        expect(validarActualizarAutoDTO(cuerpoParcial)).toEqual(cuerpoParcial);
      });

      it('debería aceptar la actualización de varios campos a la vez', () => {
        const cuerpoParcial = { marca: 'Renault', modelo: 'Clio' };

        expect(validarActualizarAutoDTO(cuerpoParcial)).toEqual(cuerpoParcial);
      });

      it('debería aceptar la actualización de todos los campos', () => {
        const cuerpoAuto = crearCuerpoAutoValido();

        expect(validarActualizarAutoDTO(cuerpoAuto)).toEqual(cuerpoAuto);
      });

      it('debería devolver una copia sin mutar el cuerpo original', () => {
        const cuerpoParcial = { modelo: 'Polo' };

        const datosValidados = validarActualizarAutoDTO(cuerpoParcial);

        expect(datosValidados).not.toBe(cuerpoParcial);
        expect(cuerpoParcial).toEqual({ modelo: 'Polo' });
      });
    });

    describe('cuerpo vacío', () => {
      it('debería rechazar un cuerpo sin campos con ErrorCampoInvalido', () => {
        const error = capturarError(() => validarActualizarAutoDTO({}));

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe('El cuerpo de la solicitud no puede estar vacío');
      });
    });

    describe('campos no permitidos', () => {
      it.each(['_id', 'activo', 'color', '$set'])(
        'debería rechazar el campo desconocido %s',
        (campoExtra) => {
          const error = capturarError(() =>
            validarActualizarAutoDTO({ [campoExtra]: 'valor' })
          );

          expect(error).toBeInstanceOf(ErrorCampoInvalido);
          expect(error.message).toBe(`Campos no permitidos: ${campoExtra}`);
        }
      );

      it('debería rechazar un campo desconocido aunque venga junto a campos válidos', () => {
        const error = capturarError(() =>
          validarActualizarAutoDTO({ marca: 'Fiat', color: 'rojo' })
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe('Campos no permitidos: color');
      });

      it('nunca debería informar campos obligatorios faltantes', () => {
        const error = capturarError(() =>
          validarActualizarAutoDTO({ color: 'rojo' })
        );

        expect(error.message).not.toContain('Campos obligatorios faltantes');
      });
    });

    describe('tipos incorrectos', () => {
      it.each([
        ['marca', 123],
        ['modelo', true],
        ['patente', null],
        ['cambios', ['MANUAL']],
      ])('debería rechazar %s con un valor no string', (campo, valorInvalido) => {
        const error = capturarError(() =>
          validarActualizarAutoDTO({ [campo]: valorInvalido })
        );

        expect(error).toBeInstanceOf(ErrorDeTipo);
        expect(error.message).toBe(
          `Tipos de datos incorrectos en: ${campo} (se esperaba string)`
        );
      });

      it('debería rechazar si un campo es válido y otro tiene tipo incorrecto', () => {
        const error = capturarError(() =>
          validarActualizarAutoDTO({ marca: 'Fiat', modelo: 500 })
        );

        expect(error).toBeInstanceOf(ErrorDeTipo);
        expect(error.message).toBe(
          'Tipos de datos incorrectos en: modelo (se esperaba string)'
        );
      });
    });
  });
});
