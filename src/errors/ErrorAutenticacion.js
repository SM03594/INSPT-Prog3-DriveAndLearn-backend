export default class ErrorAutenticacion extends Error {
  constructor(mensaje = 'No autenticado', statusCode = 401) {
    super(mensaje);
    this.name = 'ErrorAutenticacion';
    this.statusCode = statusCode;
  }
}
