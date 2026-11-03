export default class ErrorPeticionInvalida extends Error {
  constructor(mensaje = 'Petición inválida', statusCode = 400) {
    super(mensaje);
    this.name = 'ErrorPeticionInvalida';
    this.statusCode = statusCode;
  }
}
