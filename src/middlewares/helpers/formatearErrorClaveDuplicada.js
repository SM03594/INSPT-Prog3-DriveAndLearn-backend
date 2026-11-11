export function formatearMensajeClaveDuplicada(err) {
  const campoDuplicado = err?.keyValue
    ? Object.keys(err.keyValue)[0]
    : err?.keyPattern
    ? Object.keys(err.keyPattern)[0]
    : 'El registro';

  return `${campoDuplicado} ya se encuentra registrado`;
}
