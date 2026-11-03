import ErrorPeticionInvalida from './ErrorPeticionInvalida.js';

export default class ErrorLecturaCuerpo extends ErrorPeticionInvalida {
  constructor(mensaje = 'El cuerpo de la solicitud no es un JSON válido') {
    super(mensaje, 400);
    this.name = 'ErrorLecturaCuerpo';
  }
}
