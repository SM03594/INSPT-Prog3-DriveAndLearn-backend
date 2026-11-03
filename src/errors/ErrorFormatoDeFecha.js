import ErrorPeticionInvalida from './ErrorPeticionInvalida.js';

export default class ErrorFormatoDeFecha extends ErrorPeticionInvalida {
  constructor(mensaje = 'El formato de fecha u hora no es válido') {
    super(mensaje, 400);
    this.name = 'ErrorFormatoDeFecha';
  }
}
