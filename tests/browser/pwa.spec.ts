import { test, expect } from './test';

const game = 'http://127.0.0.1:4173/gravitas/';

interface Manifest {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  id: string;
  display: string;
  display_override: string[];
  orientation: string;
  theme_color: string;
  background_color: string;
  icons: { src: string; sizes: string; type: string; purpose: string }[];
}

test('the game can be installed: manifest, icons, and iOS tags', async ({ page }, info) => {
  test.skip(info.project.name !== 'webgl2', 'Static files; one backend is enough.');
  await page.goto(`${game}?scenario=quick-landing&backend=webgl2`);
  const head = page.locator('head');
  const href = await head.locator('link[rel="manifest"]').getAttribute('href');
  const manifestUrl = new URL(href!, page.url()).href;
  expect(manifestUrl).toBe(`${game}manifest.webmanifest`);
  const response = await page.request.get(manifestUrl);
  expect(response.ok()).toBe(true);
  const manifest = (await response.json()) as Manifest;
  expect(manifest).toMatchObject({
    name: 'Gravitas',
    short_name: 'Gravitas',
    display: 'standalone',
    display_override: ['fullscreen', 'standalone'],
    orientation: 'landscape',
    // The theme's page colour, like theme-color.
    theme_color: '#04060b',
    background_color: '#04060b',
  });
  // Start and scope stay under the Pages prefix.
  for (const key of ['start_url', 'scope', 'id'] as const) {
    expect(new URL(manifest[key], manifestUrl).href, key).toBe(game);
  }
  const purposes = manifest.icons.map((icon) => icon.purpose);
  expect(purposes).toContain('any');
  expect(purposes).toContain('maskable');
  for (const icon of manifest.icons) {
    const file = await page.request.get(new URL(icon.src, manifestUrl).href);
    expect(file.ok(), icon.src).toBe(true);
    const bytes = await file.body();
    const [width] = icon.sizes.split('x').map(Number);
    expect(bytes.readUInt32BE(16), icon.src).toBe(width);
  }
  await expect(head.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
    'content',
    'yes',
  );
  await expect(head.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute(
    'content',
    'yes',
  );
  await expect(head.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute(
    'content',
    'Gravitas',
  );
  await expect(head.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute(
    'content',
    'black-translucent',
  );
  // No service worker: offline play is a later decision.
  expect(await page.evaluate(() => navigator.serviceWorker?.controller ?? null)).toBeNull();
});
