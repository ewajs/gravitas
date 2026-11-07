import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'packages/*/src/**/*.test.ts',
      'apps/*/src/**/*.test.ts',
      'manual/.vitepress/learn/**/*.test.ts',
      'manual/.vitepress/theme/**/*.test.ts',
    ],
  },
});
