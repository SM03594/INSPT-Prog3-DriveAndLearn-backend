import ErrorPeticionInvalida from './ErrorPeticionInvalida.js';

export default class ErrorCampoInvalido extends ErrorPeticionInvalida {
  constructor(mensaje) {
    super(mensaje, 400);
    this.name = 'ErrorCampoInvalido';
  }
}
