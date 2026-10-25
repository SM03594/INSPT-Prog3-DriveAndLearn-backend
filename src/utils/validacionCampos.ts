// ============================================================
//  validacionCampos.ts — Qué campos puede mandar el cliente
// ============================================================
// Lo usan los DTO (src/dtos/). Cada DTO arma una tabla con los campos
// que acepta la operación: de qué tipo es cada uno y cómo nombrarlo
// en los mensajes ("El email"). validarCampos la recorre y:
//   - rechaza lo que no es un objeto (cuerpoComoObjeto);
//   - rechaza los campos que no están en la tabla;
//   - rechaza los valores que no son del tipo indicado, en vez de
//     dejar que Mongoose los convierta (123 -> "123").
//
// Devuelve un objeto NUEVO armado solo con los campos de la tabla: lo
// que no está ahí (_id, createdAt, operadores como $set...) nunca
// llega a la base. Lo obligatorio se exige en cada DTO con exigido().

import { ErrorDeNegocio } from '../errors/errorDeNegocio.js';
import { cuerpoComoObjeto, esObjetoJson } from './cuerpoPeticion.js';
import {
  DESCRIPCION_TIPO,
  esDelTipo,
  type TipoSegunNombre,
} from './validacionTipos.js';

// Los tipos de typeof, más dos que hacen falta en un JSON:
//   objeto -> un {...}, por ejemplo un tramo;
//   lista  -> un [...], por ejemplo los tramos de un día.
type TipoSegunCampo = TipoSegunNombre & {
  objeto: object;
  lista: unknown[];
};
export type TipoCampo = keyof TipoSegunCampo;

const DESCRIPCION_CAMPO = {
  ...DESCRIPCION_TIPO,
  objeto: 'un objeto',
  lista: 'una lista',
} as const satisfies Record<TipoCampo, string>;

function cumpleTipo(valor: unknown, tipo: TipoCampo): boolean {
  switch (tipo) {
    case 'objeto':
      return esObjetoJson(valor);
    case 'lista':
      return Array.isArray(valor);
    default:
      return esDelTipo(valor, tipo);
  }
}

// Una fila de la tabla: { tipo: 'string', nombre: 'El email' }.
export interface CampoPermitido {
  tipo: TipoCampo;
  nombre: string;
}

export type CamposPermitidos = Readonly<Record<string, CampoPermitido>>;

// Lo que devuelve validarCampos, deducido de la tabla:
//   { email: { tipo: 'string', ... } }  ->  { email?: string }
// Todos opcionales: los obligatorios los exige cada DTO con exigido().
export type DatosValidados<C extends CamposPermitidos> = {
  [K in keyof C]?: TipoSegunCampo[C[K]['tipo']];
};

export interface OpcionesValidarCampos {
  // Comienzo del mensaje si llegan campos que no están en la tabla:
  // "No se pueden modificar estos campos" -> "...: rol, _id".
  mensajeNoPermitidos: string;
  // true en las actualizaciones: un objeto vacío no cambia nada.
  alMenosUno?: boolean;
  // Una pista para el cliente si manda un campo que no corresponde,
  // por ejemplo dónde se cambia: { clasesPorReservar: 'usá sumar-clases' }.
  ayudaPorCampo?: Readonly<Record<string, string>>;
}

// Las dos opciones que usan casi todos los DTO:
//   SIN_CAMPOS_DE_MAS -> altas y pedidos de un solo dato (login, cantidad...);
//   AL_MODIFICAR      -> actualizaciones: además exige al menos un campo.
// Si un DTO necesita algo más (ayudaPorCampo), las extiende con spread.
export const SIN_CAMPOS_DE_MAS: OpcionesValidarCampos = {
  mensajeNoPermitidos: 'No se pueden enviar estos campos',
};

export const AL_MODIFICAR: OpcionesValidarCampos = {
  mensajeNoPermitidos: 'No se pueden modificar estos campos',
  alMenosUno: true,
};

export function validarCampos<C extends CamposPermitidos>(
  entrada: unknown,
  campos: C,
  opciones: OpcionesValidarCampos,
): DatosValidados<C> {
  // Si no es un objeto, es un pedido mal armado: ErrorPeticionInvalida (400).
  const datos = cuerpoComoObjeto(entrada);

  // Object.hasOwn y no "campo in campos": "in" también mira las
  // propiedades heredadas, y aceptaría campos como "toString".
  const noPermitidos = Object.keys(datos).filter((campo) => !Object.hasOwn(campos, campo));
  if (noPermitidos.length > 0) {
    const ayudas = noPermitidos
      .filter((campo) => opciones.ayudaPorCampo !== undefined && Object.hasOwn(opciones.ayudaPorCampo, campo))
      .map((campo) => ` (${opciones.ayudaPorCampo?.[campo]})`)
      .join('');
    throw new ErrorDeNegocio(`${opciones.mensajeNoPermitidos}: ${noPermitidos.join(', ')}${ayudas}`);
  }

  if (opciones.alMenosUno === true && Object.keys(datos).length === 0) {
    throw new ErrorDeNegocio('Debe indicarse al menos un campo para actualizar');
  }

  const resultado: Record<string, unknown> = {};
  for (const campo of Object.keys(datos)) {
    const { tipo, nombre } = campos[campo];
    const valor = datos[campo];

    if (!cumpleTipo(valor, tipo)) {
      throw new ErrorDeNegocio(`${nombre} debe ser ${DESCRIPCION_CAMPO[tipo]}`);
    }

    resultado[campo] = valor;
  }

  // Los tipos se comprobaron en runtime, campo por campo: TypeScript
  // no puede seguir ese chequeo, por eso el "as".
  return resultado as DatosValidados<C>;
}

// Para los campos obligatorios de un DTO: si no vino, 400 con el
// mensaje del campo; si vino, TypeScript ya sabe que no es undefined.
//   email: exigido(datos.email, 'El email es obligatorio')
export function exigido<T>(valor: T | undefined, mensaje: string): T {
  if (valor === undefined) throw new ErrorDeNegocio(mensaje);
  return valor;
}
