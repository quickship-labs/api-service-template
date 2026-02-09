import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'clover'],
      include: ['src/**/*.ts'],
      exclude: ['src/types/**', 'src/db/migrations/**'],
    },
    setupFiles: [],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
