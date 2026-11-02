export function validarObjetoJson(req, res, next) {
  const esObjetoPlano =
    typeof req.body === 'object' &&
    req.body !== null &&
    !Array.isArray(req.body);

  if (!esObjetoPlano) {
    return res
      .status(400)
      .json({ mensaje: 'El cuerpo de la solicitud debe ser un objeto JSON válido' });
  }

  next();
}
