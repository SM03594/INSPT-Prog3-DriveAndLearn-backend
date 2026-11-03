import mongoose from 'mongoose';
import ErrorAutenticacion from '../errors/ErrorAutenticacion.js';
import ErrorAutorizacion from '../errors/ErrorAutorizacion.js';
import ErrorDeNegocio from '../errors/ErrorDeNegocio.js';
import ErrorPeticionInvalida from '../errors/ErrorPeticionInvalida.js';
import { verSiErrorLecturaCuerpo } from './helpers/verSiErrorLecturaCuerpo.js';

export function errorHandler(errOriginal, _req, res, _next) {
  // Si express.json() falló al parsear el body por JSON malformado,
  // lo traduce a una instancia de ErrorLecturaCuerpo (subclase de ErrorPeticionInvalida).
  const err = verSiErrorLecturaCuerpo(errOriginal);

  // Cada rama solo decide qué status y mensaje responder; se envía la respuesta una única vez al final.
  let status;
  let mensaje;

  if (err instanceof mongoose.Error.ValidationError) {
    // ValidationError: falló una o más validaciones definidas en el schema de Mongoose.
    status = 400;
    mensaje = Object.values(err.errors)
      // Concatena todos los mensajes de error de los distintos campos que fallaron.
      .map((e) => e.message)
      .join('. ');
  } else if (err instanceof Error && err.name === 'CastError') {
    // CastError: el valor recibido no pudo convertirse al tipo esperado por Mongoose (ej. ObjectId mal formado).
    status = 400;
    mensaje = 'Id inválido';
  } else if (err && err.code === 11000) {
    // Código 11000 de MongoDB: violación de restricción unique (ej. email o patente ya existente).
    status = 400;
    mensaje = err.message;
  } else if (
    // Errores propios de validación de entrada, autenticación, autorización y reglas de negocio:
    // ErrorPeticionInvalida agrupa también a sus subclases (ErrorCampoInvalido, ErrorDeTipo,
    // ErrorMongooseObjIdInvalido, ErrorLecturaCuerpo).
    // ErrorDeNegocio agrupa a sus subclases (ErrorPasswordInvalida, ErrorSaldoClasesInsuficiente, etc.).
    err instanceof ErrorPeticionInvalida ||
    err instanceof ErrorAutenticacion ||
    err instanceof ErrorAutorizacion ||
    err instanceof ErrorDeNegocio
  ) {
    // Cada una de nuestras clases de error ya trae configurado su statusCode y su message.
    status = err.statusCode;
    mensaje = err.message;
  } else {
    // Cualquier otro caso no contemplado: es un error inesperado (bug o caída).
    // Se registra por consola para diagnóstico y se responde 500 sin exponer detalles internos al cliente.
    console.error(err);
    status = 500;
    mensaje = 'Error interno del servidor';
  }

  res.status(status).json({ mensaje });
}
