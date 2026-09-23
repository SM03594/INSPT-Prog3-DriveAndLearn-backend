import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Entorno de backend (no navegador)
    environment: 'node',

    // Proceso en UTC (como un deploy típico): si algún código usa
    // getDay()/getHours() en vez de aHoraLocal (src/utils/fechas.ts),
    // el test falla en todas las máquinas, no solo en producción.
    env: { TZ: 'UTC' },

    // Hace disponibles describe, it, expect, etc. sin importarlos
    globals: true,

    // Patrones de archivos de test
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],

    // Timeout amplio para tests que tocan la base de datos
    testTimeout: 10000,
    hookTimeout: 10000,

    // Cobertura de código
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/index.ts',
      ],
    },
  },
});