import ErrorCampoInvalido from '../../src/errors/ErrorCampoInvalido.js';
import ErrorDeTipo from '../../src/errors/ErrorDeTipo.js';
import ErrorPeticionInvalida from '../../src/errors/ErrorPeticionInvalida.js';
import { capturarError } from '../helpers/capturarError.js';
import {
  validarAgendarClaseDTO,
  validarCrearClaseDTO,
} from '../../src/dtos/claseDTO.js';

function crearCuerpoClaseValido() {
  return {
    profesor: '507f1f77bcf86cd799439011',
    auto: '507f1f77bcf86cd799439012',
    inicio: '2026-11-09T10:00',
    fin: '2026-11-09T11:00',
  };
}

describe('claseDTO', () => {
  describe('validarAgendarClaseDTO', () => {
    describe('casos válidos', () => {
      it('debería aceptar un cuerpo con todos los campos obligatorios y tipos correctos', () => {
        const cuerpoClase = crearCuerpoClaseValido();

        expect(() => validarAgendarClaseDTO(cuerpoClase)).not.toThrow();
      });

      it('debería devolver una copia con los mismos datos sin mutar el cuerpo original', () => {
        const cuerpoClase = crearCuerpoClaseValido();
        const copiaOriginal = { ...cuerpoClase };

        const datosValidados = validarAgendarClaseDTO(cuerpoClase);

        expect(datosValidados).toEqual(cuerpoClase);
        expect(datosValidados).not.toBe(cuerpoClase);
        expect(cuerpoClase).toEqual(copiaOriginal);
      });

      it('debería aceptar los campos en cualquier orden', () => {
        const cuerpoDesordenado = {
          fin: '2026-11-09T11:00',
          inicio: '2026-11-09T10:00',
          auto: '507f1f77bcf86cd799439012',
          profesor: '507f1f77bcf86cd799439011',
        };

        expect(validarAgendarClaseDTO(cuerpoDesordenado)).toEqual(
          cuerpoDesordenado
        );
      });

      // El DTO solo valida estructura y tipos: formato de ObjectId, horas en punto,
      // duración de 1 hora y disponibilidad semanal son responsabilidad de la capa service/modelo.
      it('no debería validar contenido de dominio como fechas pasadas o duración distinta a 1 hora', () => {
        const cuerpoConContenidoInvalido = {
          profesor: 'no-es-un-id-valido',
          auto: 'tampoco-id',
          inicio: '2020-01-01T10:30',
          fin: '2020-01-01T15:45',
        };

        expect(() =>
          validarAgendarClaseDTO(cuerpoConContenidoInvalido)
        ).not.toThrow();
      });
    });

    describe('cuerpo vacío', () => {
      it('debería rechazar un cuerpo sin campos con ErrorCampoInvalido', () => {
        const error = capturarError(() => validarAgendarClaseDTO({}));

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error).toBeInstanceOf(ErrorPeticionInvalida);
        expect(error.statusCode).toBe(400);
        expect(error.message).toBe('El cuerpo de la solicitud no puede estar vacío');
      });
    });

    describe('campos obligatorios faltantes', () => {
      it.each(['profesor', 'auto', 'inicio', 'fin'])(
        'debería rechazar si falta el campo obligatorio %s',
        (campoFaltante) => {
          const cuerpoClase = crearCuerpoClaseValido();
          delete cuerpoClase[campoFaltante];

          const error = capturarError(() => validarAgendarClaseDTO(cuerpoClase));

          expect(error).toBeInstanceOf(ErrorCampoInvalido);
          expect(error.message).toBe(
            `Campos obligatorios faltantes: ${campoFaltante}`
          );
        }
      );

      it('debería listar todos los campos faltantes en un único mensaje', () => {
        const error = capturarError(() =>
          validarAgendarClaseDTO({ profesor: '507f1f77bcf86cd799439011' })
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe(
          'Campos obligatorios faltantes: auto, inicio, fin'
        );
      });
    });

    describe('campos no permitidos', () => {
      // Especialmente alumno: por regla de arquitectura, el cliente NO debe enviar el alumno
      // ya que este se inyecta desde la sesión del usuario autenticado (req.usuario.id).
      it('debería rechazar explícitamente el campo alumno', () => {
        const cuerpoConAlumno = {
          ...crearCuerpoClaseValido(),
          alumno: '507f1f77bcf86cd799439013',
        };

        const error = capturarError(() =>
          validarAgendarClaseDTO(cuerpoConAlumno)
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe('Campos no permitidos: alumno');
      });

      it.each(['_id', '$set', 'rol', 'activo', 'estado', 'observaciones', '__v'])(
        'debería rechazar el campo desconocido %s',
        (campoExtra) => {
          const cuerpoClase = {
            ...crearCuerpoClaseValido(),
            [campoExtra]: 'valor',
          };

          const error = capturarError(() => validarAgendarClaseDTO(cuerpoClase));

          expect(error).toBeInstanceOf(ErrorCampoInvalido);
          expect(error.message).toBe(`Campos no permitidos: ${campoExtra}`);
        }
      );

      it('debería listar múltiples campos no permitidos en un único mensaje', () => {
        const cuerpoClase = {
          ...crearCuerpoClaseValido(),
          alumno: '507f1f77bcf86cd799439013',
          observacion: 'clase urgente',
        };

        const error = capturarError(() => validarAgendarClaseDTO(cuerpoClase));

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe(
          'Campos no permitidos: alumno, observacion'
        );
      });

      it('debería informar campos no permitidos y faltantes juntos separados por " | "', () => {
        const error = capturarError(() =>
          validarAgendarClaseDTO({
            profesor: '507f1f77bcf86cd799439011',
            alumno: '507f1f77bcf86cd799439013',
          })
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe(
          'Campos no permitidos: alumno | Campos obligatorios faltantes: auto, inicio, fin'
        );
      });

      it('debería validar la estructura antes que los tipos', () => {
        const error = capturarError(() =>
          validarAgendarClaseDTO({
            profesor: 12345,
            campoInvalido: 'algo',
          })
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

      describe.each(['profesor', 'auto', 'inicio', 'fin'])('campo %s', (campo) => {
        it.each(valoresNoString)(
          'debería rechazar %s con ErrorDeTipo',
          (_descripcion, valorInvalido) => {
            const cuerpoClase = {
              ...crearCuerpoClaseValido(),
              [campo]: valorInvalido,
            };

            const error = capturarError(() =>
              validarAgendarClaseDTO(cuerpoClase)
            );

            expect(error).toBeInstanceOf(ErrorDeTipo);
            expect(error).toBeInstanceOf(ErrorPeticionInvalida);
            expect(error.statusCode).toBe(400);
            expect(error.message).toBe(
              `Tipos de datos incorrectos en: ${campo} (se esperaba string)`
            );
          }
        );
      });

      it('debería listar todos los campos con tipo incorrecto en un único mensaje', () => {
        const cuerpoClase = {
          profesor: 123,
          auto: false,
          inicio: null,
          fin: ['2026-11-09T11:00'],
        };

        const error = capturarError(() => validarAgendarClaseDTO(cuerpoClase));

        expect(error).toBeInstanceOf(ErrorDeTipo);
        expect(error.message).toBe(
          'Tipos de datos incorrectos en: profesor (se esperaba string), auto (se esperaba string), inicio (se esperaba string), fin (se esperaba string)'
        );
      });
    });

    describe('alias validarCrearClaseDTO', () => {
      it('validarCrearClaseDTO debería apuntar a la misma función', () => {
        expect(validarCrearClaseDTO).toBe(validarAgendarClaseDTO);
      });

      it('debería validar correctamente un cuerpo válido utilizando el alias', () => {
        const cuerpo = crearCuerpoClaseValido();
        expect(() => validarCrearClaseDTO(cuerpo)).not.toThrow();
      });
    });
  });
});
