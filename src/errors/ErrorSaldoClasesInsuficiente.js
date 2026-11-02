import ErrorDeNegocio from './ErrorDeNegocio.js';

export default class ErrorSaldoClasesInsuficiente extends ErrorDeNegocio {
  constructor(mensaje = 'El saldo de clases es insuficiente') {
    super(mensaje, 400);
    this.name = 'ErrorSaldoClasesInsuficiente';
  }
}
