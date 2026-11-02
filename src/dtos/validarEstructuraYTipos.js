import ErrorCampoInvalido from '../errors/ErrorCampoInvalido.js';
import ErrorDeTipo from '../errors/ErrorDeTipo.js';

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
    throw new ErrorCampoInvalido('El cuerpo de la solicitud no puede estar vacío');
  }

  const camposNoPermitidos = clavesEnviadas.filter(
    (campo) => !camposPermitidos.includes(campo)
  );

  const camposFaltantes = camposRequeridos.filter(
    (campo) => datos[campo] === undefined
  );

  const erroresDeCampos = [
    camposNoPermitidos.length > 0
      ? `Campos no permitidos: ${camposNoPermitidos.join(', ')}`
      : null,
    camposFaltantes.length > 0
      ? `Campos obligatorios faltantes: ${camposFaltantes.join(', ')}`
      : null,
  ].filter(Boolean);

  if (erroresDeCampos.length > 0) {
    throw new ErrorCampoInvalido(erroresDeCampos.join(' | '));
  }

  const camposConTipoErroneo = clavesEnviadas
    .filter((campo) => !tieneTipoValido(datos[campo], tiposCampos[campo]))
    .map((campo) => `${campo} (se esperaba ${tiposCampos[campo]})`);

  if (camposConTipoErroneo.length > 0) {
    throw new ErrorDeTipo(
      `Tipos de datos incorrectos en: ${camposConTipoErroneo.join(', ')}`
    );
  }

  return Object.fromEntries(
    clavesEnviadas.map((campo) => [campo, datos[campo]])
  );
}
