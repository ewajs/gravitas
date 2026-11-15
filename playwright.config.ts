import { defineConfig } from '@playwright/test';

const executable = process.env.GRAVITAS_CHROMIUM;
const software = process.env.GRAVITAS_SOFTWARE_GPU === '1';
// Extra Chromium flags, space-separated, for hosts whose headless Chromium does
// not pick the GPU by itself (Linux: `--use-angle=gl-egl`); see CONTRIBUTING.md.
const extra = (process.env.GRAVITAS_CHROMIUM_ARGS ?? '').split(/\s+/).filter(Boolean);

export default defineConfig({
  testDir: './tests/browser',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
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
          args: software ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : extra,
        },
      },
    },
    // Full Chromium's new headless mode; requires usable WebGPU presentation.
    {
      name: 'webgpu',
      use: {
        channel: 'chromium',
        launchOptions: {
          ...(executable ? { executablePath: executable } : {}),
          args: extra,
        },
      },
    },
  ],
  webServer: [
    {
      command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort --base /gravitas/',
      url: 'http://127.0.0.1:4173/gravitas/',
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
