import {
  crear,
  listar,
  obtenerPorId,
  actualizar,
  restarClasesPorReservar,
  sumarClasesPorReservar,
} from '../services/alumno.service.js';

export async function listarAlumnos() {
  return listar();
}

export async function obtenerAlumno(id: string) {
  return obtenerPorId(id);
}

export async function crearAlumno(datos: Parameters<typeof crear>[0]) {
  return crear(datos);
}

export async function actualizarAlumno(
  id: string,
  cambios: Parameters<typeof actualizar>[1],
) {
  return actualizar(id, cambios);
}

export async function sumarClasesAlumno(id: string, cantidad: number) {
  return sumarClasesPorReservar(id, cantidad);
}

export async function restarClasesAlumno(id: string, cantidad: number) {
  return restarClasesPorReservar(id, cantidad);
}
