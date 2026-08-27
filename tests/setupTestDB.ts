import { beforeAll, afterEach, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Registra los hooks de ciclo de vida para una BD virtual.
 * Llamalo al principio de cada archivo de test de integración.
 */
export function setupTestDB() {
  let mongo: MongoMemoryServer;

  // Arranca el Mongo en memoria y conecta Mongoose (una vez por archivo)
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  }, 60000); // 60s: la PRIMERA vez descarga el binario de Mongo

  // Limpia todas las colecciones después de cada test
  afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  // Cierra la conexión y apaga el servidor al terminar
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongo.stop();
  });
}