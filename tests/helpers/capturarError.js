// Ejecuta la validación esperando que falle y devuelve el error lanzado,
// para poder verificar tanto su clase como su mensaje exacto.
export function capturarError(validacion) {
  try {
    validacion();
  } catch (error) {
    return error;
  }
  throw new Error('Se esperaba que la validación lanzara un error');
}