import ErrorDeNegocio from './ErrorDeNegocio.js';

export default class ErrorPasswordInvalida extends ErrorDeNegocio {
  constructor(mensaje = 'La contraseña no es válida') {
    super(mensaje, 400);
    this.name = 'ErrorPasswordInvalida';
  }
}
