import ErrorCampoInvalido from '../../src/errors/ErrorCampoInvalido.js';
import ErrorDeTipo from '../../src/errors/ErrorDeTipo.js';
import ErrorPeticionInvalida from '../../src/errors/ErrorPeticionInvalida.js';
import { capturarError } from '../helpers/capturarError.js';
import { validarLoginDTO } from '../../src/dtos/authDTO.js';

function crearCuerpoLoginValido() {
  return {
    email: 'alumno@driveandlearn.com',
    password: 'passwordSegura123',
  };
}

describe('authDTO', () => {
  describe('validarLoginDTO', () => {
    describe('casos válidos', () => {
      it('debería aceptar un cuerpo con todos los campos obligatorios y tipos correctos', () => {
        const cuerpoLogin = crearCuerpoLoginValido();

        expect(() => validarLoginDTO(cuerpoLogin)).not.toThrow();
      });

      it('debería devolver una copia con los mismos datos sin mutar el cuerpo original', () => {
        const cuerpoLogin = crearCuerpoLoginValido();
        const copiaOriginal = { ...cuerpoLogin };

        const datosValidados = validarLoginDTO(cuerpoLogin);

        expect(datosValidados).toEqual(cuerpoLogin);
        expect(datosValidados).not.toBe(cuerpoLogin);
        expect(cuerpoLogin).toEqual(copiaOriginal);
      });

      it('debería aceptar los campos en cualquier orden', () => {
        const cuerpoDesordenado = {
          password: 'passwordSegura123',
          email: 'alumno@driveandlearn.com',
        };

        expect(validarLoginDTO(cuerpoDesordenado)).toEqual(cuerpoDesordenado);
      });

      // El DTO solo valida estructura y tipos: el formato del email,
      // la longitud de password y las credenciales las valida el servicio.
      it('no debería validar contenido de dominio (formato de email o longitud de contraseña)', () => {
        const cuerpoConContenidoInvalido = {
          email: 'email-sin-formato',
          password: '',
        };

        expect(() => validarLoginDTO(cuerpoConContenidoInvalido)).not.toThrow();
      });
    });

    describe('cuerpo vacío', () => {
      it('debería rechazar un cuerpo sin campos con ErrorCampoInvalido', () => {
        const error = capturarError(() => validarLoginDTO({}));

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error).toBeInstanceOf(ErrorPeticionInvalida);
        expect(error.statusCode).toBe(400);
        expect(error.message).toBe('El cuerpo de la solicitud no puede estar vacío');
      });
    });

    describe('campos obligatorios faltantes', () => {
      it.each(['email', 'password'])(
        'debería rechazar si falta el campo %s',
        (campoFaltante) => {
          const cuerpoLogin = crearCuerpoLoginValido();
          delete cuerpoLogin[campoFaltante];

          const error = capturarError(() => validarLoginDTO(cuerpoLogin));

          expect(error).toBeInstanceOf(ErrorCampoInvalido);
          expect(error.message).toBe(
            `Campos obligatorios faltantes: ${campoFaltante}`
          );
        }
      );

      it('debería listar todos los campos faltantes si se envía un objeto solo con campos no permitidos', () => {
        const error = capturarError(() =>
          validarLoginDTO({ rol: 'administrador' })
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe(
          'Campos no permitidos: rol | Campos obligatorios faltantes: email, password'
        );
      });
    });

    describe('campos no permitidos', () => {
      it.each(['rol', 'NomApe', '_id', '$set', 'activo', 'token', '__v'])(
        'debería rechazar el campo desconocido %s',
        (campoExtra) => {
          const cuerpoLogin = {
            ...crearCuerpoLoginValido(),
            [campoExtra]: 'valor',
          };

          const error = capturarError(() => validarLoginDTO(cuerpoLogin));

          expect(error).toBeInstanceOf(ErrorCampoInvalido);
          expect(error.message).toBe(`Campos no permitidos: ${campoExtra}`);
        }
      );

      it('debería listar todos los campos no permitidos en un único mensaje', () => {
        const cuerpoLogin = {
          ...crearCuerpoLoginValido(),
          rol: 'administrador',
          token: 'jwt-falso',
        };

        const error = capturarError(() => validarLoginDTO(cuerpoLogin));

        expect(error.message).toBe('Campos no permitidos: rol, token');
      });

      it('debería informar campos no permitidos y faltantes juntos separados por " | "', () => {
        const error = capturarError(() =>
          validarLoginDTO({ email: 'usuario@correo.com', extra: 'invalido' })
        );

        expect(error).toBeInstanceOf(ErrorCampoInvalido);
        expect(error.message).toBe(
          'Campos no permitidos: extra | Campos obligatorios faltantes: password'
        );
      });

      it('debería validar la estructura antes que los tipos', () => {
        const error = capturarError(() =>
          validarLoginDTO({ email: 12345, campoDesconocido: 'invalido' })
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

      describe.each(['email', 'password'])('campo %s', (campo) => {
        it.each(valoresNoString)(
          'debería rechazar %s con ErrorDeTipo',
          (_descripcion, valorInvalido) => {
            const cuerpoLogin = {
              ...crearCuerpoLoginValido(),
              [campo]: valorInvalido,
            };

            const error = capturarError(() => validarLoginDTO(cuerpoLogin));

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
        const cuerpoLogin = {
          email: 12345,
          password: false,
        };

        const error = capturarError(() => validarLoginDTO(cuerpoLogin));

        expect(error).toBeInstanceOf(ErrorDeTipo);
        expect(error.message).toBe(
          'Tipos de datos incorrectos en: email (se esperaba string), password (se esperaba string)'
        );
      });
    });
  });
});
