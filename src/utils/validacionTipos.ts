// ============================================================
//  validacionTipos.ts — Chequeo de tipos de valores recibidos (unknown)
// ============================================================
// Para los services que validan campos que mandó el cliente. Cada
// service arma su tabla de campos con un "tipo" por campo (el texto
// que devuelve typeof: 'string', 'number', 'boolean') y usa:
//   - esDelTipo(valor, tipo): comprueba el valor y, si pasa,
//     TypeScript lo trata como el tipo que corresponde, sin "as";
//   - DESCRIPCION_TIPO[tipo]: cómo nombrar el tipo en el mensaje
//     de error ("El email debe ser un texto").

// Une cada nombre de tipo (el texto que devuelve typeof) con el
// tipo de TypeScript que le corresponde. Hace falta porque los
// tipos de TypeScript no existen cuando corre la app: la
// comparación se hace con texto, y este mapa le dice a TypeScript
// qué tipo representa cada texto.
type TipoSegunNombre = {
  string: string;
  number: number;
  boolean: boolean;
};

// 'string' | 'number' | 'boolean': lo que puede ir en el "tipo" de
// la tabla de campos de un service.
export type NombreTipo = keyof TipoSegunNombre;

// Cómo se nombra cada tipo en los mensajes de error. "satisfies"
// obliga a que haya una descripción por cada NombreTipo (si se
// agrega uno a TipoSegunNombre y no acá, no compila).
export const DESCRIPCION_TIPO = {
  string: 'un texto',
  number: 'un número',
  boolean: 'verdadero o falso',
} as const satisfies Record<NombreTipo, string>;

// Type guard: ¿"valor" es del tipo que indica "tipo"? Si devuelve
// true, TypeScript pasa a tratar a "valor" como ese tipo (con
// tipo 'string', valor queda como string).
export function esDelTipo<T extends NombreTipo>(
  valor: unknown,
  tipo: T,
): valor is TipoSegunNombre[T] {
  return typeof valor === tipo;
}
