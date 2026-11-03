import ErrorPeticionInvalida from '../errors/ErrorPeticionInvalida.js';

export function validarObjetoJson(req, _res, next) {
  const esObjetoPlano =
    typeof req.body === 'object' &&
    req.body !== null &&
    !Array.isArray(req.body);

  if (!esObjetoPlano) {
    throw new ErrorPeticionInvalida(
      'El cuerpo de la solicitud debe ser un objeto JSON válido'
    );
  }

  next();
}
