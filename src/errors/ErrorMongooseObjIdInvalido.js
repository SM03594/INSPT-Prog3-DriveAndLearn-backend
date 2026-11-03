export default class ErrorMongooseObjIdInvalido extends Error {
  constructor(mensaje = 'El formato del ID no es un ObjectId válido') {
    super(mensaje);
    this.name = 'ErrorMongooseObjIdInvalido';
    this.statusCode = 400;
  }
}
