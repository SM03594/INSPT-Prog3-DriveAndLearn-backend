import ErrorPeticionInvalida from './ErrorPeticionInvalida.js';

export default class ErrorMongooseObjIdInvalido extends ErrorPeticionInvalida {
  constructor(mensaje = 'El formato del ID no es un ObjectId válido') {
    super(mensaje, 400);
    this.name = 'ErrorMongooseObjIdInvalido';
  }
}
