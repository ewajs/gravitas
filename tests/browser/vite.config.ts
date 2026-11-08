import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  // The game's public assets (such as the Moon's colour map) for planet fixtures.
  publicDir: fileURLToPath(new URL('../../apps/game/public', import.meta.url)),
});
