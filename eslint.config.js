import { fileURLToPath, URL } from 'node:url';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/root-path': fileURLToPath(new URL('.', import.meta.url)),
      'boundaries/elements': [
        { type: 'engine', pattern: 'packages/engine' },
        { type: 'viewport', pattern: 'packages/viewport' },
        { type: 'ui', pattern: 'packages/ui' },
        { type: 'game', pattern: 'apps/game' },
      ],
      'boundaries/files': [{ pattern: '**/*.test.ts', category: 'test' }],
      // Classify npm workspace links by their real package paths, not node_modules.
      'import/resolver': {
        node: { extensions: ['.ts', '.js', '.css'], preserveSymlinks: false },
      },
    },
    rules: {
      'boundaries/no-unknown-files': 'error',
      'boundaries/no-unknown-dependencies': 'error',
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          checkAllOrigins: true,
          policies: [
            {
              from: { element: { type: 'viewport' } },
              allow: {
                to: { element: { type: 'engine', fileInternalPath: 'src/index.ts' } },
                dependency: { source: '@gravitas/engine' },
              },
            },
            {
              from: { element: { type: 'ui' } },
              allow: {
                to: { element: { type: 'engine', fileInternalPath: 'src/index.ts' } },
                dependency: { source: '@gravitas/engine', kind: 'type' },
              },
            },
            {
              from: { element: { type: 'game' } },
              allow: {
                to: {
                  element: {
                    types: ['engine', 'viewport', 'ui'],
                    fileInternalPath: 'src/index.ts',
                  },
                },
                dependency: { source: '@gravitas/*' },
              },
            },
            {
              from: { element: { type: 'viewport' } },
              allow: { to: { module: { origin: 'external', source: 'three' } } },
            },
            {
              from: { element: { type: 'ui' } },
              allow: { to: { module: { origin: 'external', source: ['lit', '@lit/localize'] } } },
            },
            {
              from: { file: { categories: 'test' } },
              allow: { to: { module: { origin: 'external', source: 'vitest' } } },
            },
          ],
        },
      ],
    },
  },
  prettier,
];
