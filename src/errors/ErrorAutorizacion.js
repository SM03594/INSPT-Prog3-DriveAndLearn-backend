export default class ErrorAutorizacion extends Error {
  constructor(mensaje = 'No autorizado', statusCode = 403) {
    super(mensaje);
    this.name = 'ErrorAutorizacion';
    this.statusCode = statusCode;
  }
}
