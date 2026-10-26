// ============================================================
//  Clase.test.ts — Tests de los índices del modelo Clase
// ============================================================
// Se pregunta a MongoDB cómo resolvería la búsqueda de superposiciones
// (explain) y cuántos documentos tuvo que leer: con los índices, las
// clases que ya terminaron no se leen.

import { beforeAll, describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { setupTestDB } from '../setupTestDB.js';
import { ClaseModel } from '../../src/models/Clase.js';

setupTestDB();

const UNA_HORA_MS = 60 * 60 * 1000;
const CLASES_PASADAS = 50;

const profesor = new Types.ObjectId();
const alumno = new Types.ObjectId();
const auto = new Types.ObjectId();

function clase(inicio: Date) {
  const datos = { profesor, alumno, auto, inicio, fin: new Date(inicio.getTime() + UNA_HORA_MS) };
  return datos;
}

// Lo que devuelve explain('executionStats'), solo lo que se mira acá.
interface Explicacion {
  executionStats: { totalDocsExamined: number };
  queryPlanner: { winningPlan: unknown };
}

describe('índices de Clase', () => {
  // Espera a que los índices estén creados antes de preguntar el plan.
  beforeAll(async () => {
    await ClaseModel.init();
  });

  it('crea un índice por cada rama de la búsqueda, terminado en "fin"', async () => {
    const indices = await ClaseModel.listIndexes();
    const claves = indices.map((indice) => indice.key);

    expect(claves).toEqual(
      expect.arrayContaining([
        { profesor: 1, fin: 1 },
        { alumno: 1, fin: 1 },
        { auto: 1, fin: 1 },
      ]),
    );
  });

  it('la búsqueda de superposiciones no lee las clases que ya terminaron', async () => {
    const pasadas = Array.from({ length: CLASES_PASADAS }, (_, i) =>
      clase(new Date(Date.UTC(2020, 0, 1 + i, 12))),
    );
    const futura = clase(new Date(Date.UTC(2030, 0, 7, 12)));
    await ClaseModel.insertMany([...pasadas, futura]);

    // La misma forma que la consulta de clase.service (listarSuperpuestas).
    const inicioPedido = new Date(Date.UTC(2030, 0, 7, 11));
    const finPedido = new Date(Date.UTC(2030, 0, 7, 15));
    const explicacion = (await ClaseModel.find({
      inicio: { $lt: finPedido },
      fin: { $gt: inicioPedido },
      $or: [{ profesor }, { auto: { $in: [auto] } }, { alumno }],
    }).explain('executionStats')) as unknown as Explicacion;

    const leidos = explicacion.executionStats.totalDocsExamined;
    const plan = JSON.stringify(explicacion.queryPlanner.winningPlan);

    // Cada rama lee, a lo sumo, la única clase futura.
    expect(leidos).toBeLessThanOrEqual(3);
    expect(plan).not.toContain('COLLSCAN');
  });
});
