function tieneTipoValido(valor, tipoEsperado) {
  return (
    typeof valor === tipoEsperado &&
    !(tipoEsperado === 'number' && Number.isNaN(valor))
  );
}

export function validarEstructuraYTipos(
  datos,
  tiposCampos,
  camposPermitidos,
  camposRequeridos = []
) {
  const clavesEnviadas = Object.keys(datos);

  if (clavesEnviadas.length === 0) {
    throw new Error('El cuerpo de la solicitud no puede estar vacío');
  }

  const camposNoPermitidos = clavesEnviadas.filter(
    (campo) => !camposPermitidos.includes(campo)
  );

  const camposFaltantes = camposRequeridos.filter(
    (campo) => datos[campo] === undefined
  );

  const camposConTipoErroneo = clavesEnviadas
    .filter((campo) => camposPermitidos.includes(campo))
    .filter((campo) => !tieneTipoValido(datos[campo], tiposCampos[campo]))
    .map((campo) => `${campo} (se esperaba ${tiposCampos[campo]})`);

  const mensajesError = [
    camposNoPermitidos.length > 0
      ? `Campos no permitidos: ${camposNoPermitidos.join(', ')}`
      : null,
    camposFaltantes.length > 0
      ? `Campos obligatorios faltantes: ${camposFaltantes.join(', ')}`
      : null,
    camposConTipoErroneo.length > 0
      ? `Tipos de datos incorrectos en: ${camposConTipoErroneo.join(', ')}`
      : null,
  ].filter(Boolean);

  if (mensajesError.length > 0) {
    throw new Error(mensajesError.join(' | '));
  }

  return Object.fromEntries(
    clavesEnviadas.map((campo) => [campo, datos[campo]])
  );
}
