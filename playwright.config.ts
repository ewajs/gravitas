import { defineConfig } from '@playwright/test';

const executable = process.env.GRAVITAS_CHROMIUM;
const software = process.env.GRAVITAS_SOFTWARE_GPU === '1';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  workers: 1,
  use: {
    viewport: { width: 1000, height: 750 },
    trace: 'retain-on-failure',
    launchOptions: {
      ...(executable ? { executablePath: executable } : {}),
    },
  },
  projects: [
    {
      name: 'webgl2',
      use: {
        launchOptions: {
          ...(executable ? { executablePath: executable } : {}),
          args: software ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
        },
      },
    },
    // Full Chromium's new headless mode; requires usable WebGPU presentation.
    { name: 'webgpu', use: { channel: 'chromium' } },
  ],
  webServer: [
    {
      command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      timeout: 60_000,
    },
    {
      command:
        'vite --config tests/browser/vite.config.ts --host 127.0.0.1 --port 4174 --strictPort',
      url: 'http://127.0.0.1:4174/fixture/',
      timeout: 30_000,
    },
  ],
});
