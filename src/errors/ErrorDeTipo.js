import ErrorPeticionInvalida from './ErrorPeticionInvalida.js';

export default class ErrorDeTipo extends ErrorPeticionInvalida {
  constructor(mensaje) {
    super(mensaje, 400);
    this.name = 'ErrorDeTipo';
  }
}
