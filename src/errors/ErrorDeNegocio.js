export default class ErrorDeNegocio extends Error {
  constructor(mensaje, statusCode = 400) {
    super(mensaje);
    this.name = 'ErrorDeNegocio';
    this.statusCode = statusCode;
  }
}
