import {
  cambiarEstado,
  crear,
  listar,
  obtenerPorId,
  actualizar,
} from '../services/auto.service.js';

export async function listarAutos() {
  return listar();
}

export async function obtenerAuto(id: string) {
  return obtenerPorId(id);
}

export async function crearAuto(datos: Parameters<typeof crear>[0]) {
  return crear(datos);
}

export async function actualizarAuto(
  id: string,
  cambios: Parameters<typeof actualizar>[1],
) {
  return actualizar(id, cambios);
}

export async function cambiarEstadoAuto(id: string, activo: boolean) {
  return cambiarEstado(id, activo);
}
