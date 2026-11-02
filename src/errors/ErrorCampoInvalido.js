export default class ErrorCampoInvalido extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorCampoInvalido';
    this.statusCode = 400;
  }
}
