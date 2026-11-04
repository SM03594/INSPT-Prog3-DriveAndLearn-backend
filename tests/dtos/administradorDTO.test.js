import ErrorCampoInvalido from '../../src/errors/ErrorCampoInvalido.js';
import ErrorDeTipo from '../../src/errors/ErrorDeTipo.js';
import ErrorPeticionInvalida from '../../src/errors/ErrorPeticionInvalida.js';
import { capturarError } from '../helpers/capturarError.js';
import {
  validarCrearAdministradorDTO,
  validarActualizarAdministradorDTO,
} from '../../src/dtos/administradorDTO.js';

function crearCuerpoAdministradorValido() {
  return {
    NomApe: 'Admin General',
    email: 'admin@driveandlearn.com',
    password: 'passwordSegura123',
  };
}

describe('administradorDTO', () => {
  describe('validarCrearAdministradorDTO', () => {
    describe('casos válidos', () => {
      it('debería aceptar un cuerpo con todos los campos obligatorios y tipos correctos', () => {
        const cuerpoAdmin = crearCuerpoAdministradorValido();

        expect(() => validarCrearAdministradorDTO(cuerpoAdmin)).not.toThrow();
      });

      it('debería devolver una copia con los mismos datos sin mutar el cuerpo original', () => {
        const cuerpoAdmin = crearCuerpoAdministradorValido();
        const copiaOriginal = { ...cuerpoAdmin };

        const datosValidados = validarCrearAdministradorDTO(cuerpoAdmin);

        expect(datosValidados).toEqual(cuerpoAdmin);
        expect(datosValidados).not.toBe(cuerpoAdmin);
        expect(cuerpoAdmin).toEqual(copiaOriginal);
      });

      it('debería aceptar los campos en cualquier orden', () => {
        const cuerpoDesordenado = {
          password: 'passwordSegura123',
          NomApe: 'Admin General',
          email: 'admin@driveandlearn.com',
        };

        expect(validarCrearAdministradorDTO(cuerpoDesordenado)).toEqual(
          cuerpoDesordenado
        );
      });

      // El DTO solo valida estructura y tipos: formato de email, longitud de password, etc.,
      // son validadas por la capa de negocio (servicio o modelo).
      it('no debería validar contenido de dominio (formato de email o longitud de contraseña)', () => {
        const cuerpoConContenidoInvalido = {
          NomApe: '',
          email: 'correo-sin-formato',
          password: '123',
        };

        expect(() =>
          validarCrearAdministradorDTO(cuerpoConContenidoInvalido)
        ).not.toThrow();
      });
    });

    describe('cuerpo vacío', () => {
      it('debería rechazar un cuerpo sin campos con ErrorCampoInvalido', () => {
        const error = capturarError(() => validarCrearAdministradorDTO({}));

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error).toBeInstanceOf(ErrorPeticionInvalida);
        expect(error.statusCode).toBe(400);
        expect(error.message).toBe('El cuerpo de la solicitud no puede estar vacío');
      });
    });

    describe('campos obligatorios faltantes', () => {
      it.each(['NomApe', 'email', 'password'])(
        'debería rechazar si falta el campo %s',
        (campoFaltante) => {
          const cuerpoAdmin = crearCuerpoAdministradorValido();
          delete cuerpoAdmin[campoFaltante];

          const error = capturarError(() =>
            validarCrearAdministradorDTO(cuerpoAdmin)
          );

          expect(error).toBeInstanceOf(ErrorCampoInvalido);
          expect(error.message).toBe(
            `Campos obligatorios faltantes: ${campoFaltante}`
          );
        }
      );

      it('debería listar todos los campos faltantes en un único mensaje', () => {
        const error = capturarError(() =>
          validarCrearAdministradorDTO({ NomApe: 'Admin Solo' })
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe(
          'Campos obligatorios faltantes: email, password'
        );
      });
    });

    describe('campos no permitidos', () => {
      it.each(['rol', '_id', '$set', 'activo', 'saldoClases', 'disponibilidad', '__v'])(
        'debería rechazar el campo desconocido %s',
        (campoExtra) => {
          const cuerpoAdmin = {
            ...crearCuerpoAdministradorValido(),
            [campoExtra]: 'valor',
          };

          const error = capturarError(() =>
            validarCrearAdministradorDTO(cuerpoAdmin)
          );

          expect(error).toBeInstanceOf(ErrorCampoInvalido);
          expect(error.message).toBe(`Campos no permitidos: ${campoExtra}`);
        }
      );

      it('debería listar todos los campos no permitidos en un único mensaje', () => {
        const cuerpoAdmin = {
          ...crearCuerpoAdministradorValido(),
          rol: 'administrador',
          telefono: '11223344',
        };

        const error = capturarError(() =>
          validarCrearAdministradorDTO(cuerpoAdmin)
        );

        expect(error.message).toBe('Campos no permitidos: rol, telefono');
      });

      it('debería informar campos no permitidos y faltantes juntos separados por " | "', () => {
        const error = capturarError(() =>
          validarCrearAdministradorDTO({ NomApe: 'Admin', rol: 'admin' })
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe(
          'Campos no permitidos: rol | Campos obligatorios faltantes: email, password'
        );
      });

      it('debería validar la estructura antes que los tipos', () => {
        const error = capturarError(() =>
          validarCrearAdministradorDTO({ NomApe: 12345, campoDesconocido: 'invalido' })
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

      describe.each(['NomApe', 'email', 'password'])('campo %s', (campo) => {
        it.each(valoresNoString)(
          'debería rechazar %s con ErrorDeTipo',
          (_descripcion, valorInvalido) => {
            const cuerpoAdmin = {
              ...crearCuerpoAdministradorValido(),
              [campo]: valorInvalido,
            };

            const error = capturarError(() =>
              validarCrearAdministradorDTO(cuerpoAdmin)
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
        const cuerpoAdmin = {
          NomApe: 123,
          email: false,
          password: null,
        };

        const error = capturarError(() =>
          validarCrearAdministradorDTO(cuerpoAdmin)
        );

        expect(error).toBeInstanceOf(ErrorDeTipo);
        expect(error.message).toBe(
          'Tipos de datos incorrectos en: NomApe (se esperaba string), email (se esperaba string), password (se esperaba string)'
        );
      });
    });
  });

  describe('validarActualizarAdministradorDTO', () => {
    describe('casos válidos', () => {
      it.each([
        ['NomApe', 'Nuevo Nombre'],
        ['email', 'nuevo@email.com'],
        ['password', 'nuevaPass123'],
      ])('debería aceptar la actualización parcial de solo %s', (campo, valor) => {
        const cuerpoParcial = { [campo]: valor };

        expect(validarActualizarAdministradorDTO(cuerpoParcial)).toEqual(
          cuerpoParcial
        );
      });

      it('debería aceptar la actualización de varios campos a la vez', () => {
        const cuerpoParcial = {
          NomApe: 'Admin Modificado',
          email: 'modificado@driveandlearn.com',
        };

        expect(validarActualizarAdministradorDTO(cuerpoParcial)).toEqual(
          cuerpoParcial
        );
      });

      it('debería aceptar la actualización de todos los campos', () => {
        const cuerpoAdmin = crearCuerpoAdministradorValido();

        expect(validarActualizarAdministradorDTO(cuerpoAdmin)).toEqual(
          cuerpoAdmin
        );
      });

      it('debería devolver una copia sin mutar el cuerpo original', () => {
        const cuerpoParcial = { NomApe: 'Admin Copia' };
        const copiaOriginal = { ...cuerpoParcial };

        const resultado = validarActualizarAdministradorDTO(cuerpoParcial);

        expect(resultado).toEqual(cuerpoParcial);
        expect(resultado).not.toBe(cuerpoParcial);
        expect(cuerpoParcial).toEqual(copiaOriginal);
      });
    });

    describe('cuerpo vacío', () => {
      it('debería rechazar un cuerpo sin campos con ErrorCampoInvalido', () => {
        const error = capturarError(() => validarActualizarAdministradorDTO({}));

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe('El cuerpo de la solicitud no puede estar vacío');
      });
    });

    describe('campos no permitidos', () => {
      it.each(['rol', '_id', 'saldoClases', '$set', 'disponibilidad'])(
        'debería rechazar el campo desconocido %s',
        (campoExtra) => {
          const error = capturarError(() =>
            validarActualizarAdministradorDTO({ [campoExtra]: 'valor' })
          );

          expect(error).toBeInstanceOf(ErrorCampoInvalido);
          expect(error.message).toBe(`Campos no permitidos: ${campoExtra}`);
        }
      );

      it('debería rechazar un campo desconocido aunque venga junto a campos válidos', () => {
        const error = capturarError(() =>
          validarActualizarAdministradorDTO({
            email: 'admin@correo.com',
            rol: 'admin',
          })
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe('Campos no permitidos: rol');
      });

      it('nunca debería informar campos obligatorios faltantes', () => {
        const error = capturarError(() =>
          validarActualizarAdministradorDTO({ campoInvalido: 'algo' })
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
          validarActualizarAdministradorDTO({ [campo]: valorInvalido })
        );

        expect(error).toBeInstanceOf(ErrorDeTipo);
        expect(error.message).toBe(
          `Tipos de datos incorrectos en: ${campo} (se esperaba string)`
        );
      });
    });
  });
});
