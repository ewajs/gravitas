import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Frame-rate measurement, run on demand with `npm run measure`; never in CI or the
// regular browser suites. Reuses the browser projects and the production preview.
export default defineConfig({
  testDir: './tests/measure',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
  ...(base.use ? { use: base.use } : {}),
  ...(base.projects ? { projects: base.projects } : {}),
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort --base /gravitas/',
    url: 'http://127.0.0.1:4173/gravitas/',
    timeout: 60_000,
  },
});
