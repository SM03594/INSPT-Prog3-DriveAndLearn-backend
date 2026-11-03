import ErrorDeNegocio from './ErrorDeNegocio.js';

export default class ErrorRegistroInexistente extends ErrorDeNegocio {
  constructor(mensaje = 'El registro solicitado no existe') {
    super(mensaje, 404);
    this.name = 'ErrorRegistroInexistente';
  }
}
