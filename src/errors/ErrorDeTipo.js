export default class ErrorDeTipo extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorDeTipo';
    this.statusCode = 400;
  }
}
