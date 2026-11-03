import { beforeAll, afterEach, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Registra los hooks de ciclo de vida para una base de datos MongoDB en memoria.
 * Llamalo al principio de cada archivo de test para aislar las pruebas.
 */
export function setupTestDB() {
  let mongo;

  // Arranca el servidor de Mongo en memoria y conecta Mongoose (una sola vez por archivo de test)
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  }, 60000); // 60s de margen por si la primera vez necesita descargar el binario de Mongo

  // Vacía los documentos de todas las colecciones después de cada test
  // sin destruir las colecciones ni sus índices (como unique: true en email)
  afterEach(async () => {
    const collections = mongoose.connection.collections;

    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  // Elimina la base en memoria, cierra la conexión de Mongoose y apaga el servidor al terminar todo el archivo
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongo.stop();
  });
}
