import type { APIResponse } from '@playwright/test';
import { test, expect } from './test';

const game = 'http://127.0.0.1:4173/gravitas/';

// Width and height from a PNG's IHDR chunk.
async function pngSize(response: APIResponse) {
  const bytes = await response.body();
  expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test('the game serves its icons, link preview, and theme colour', async ({ page }, info) => {
  test.skip(info.project.name !== 'webgl2', 'Static files; one backend is enough.');
  await page.goto(`${game}?backend=webgl2`);
  const head = page.locator('head');
  await expect(head.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#04060b');
  for (const [selector, size] of [
    ['link[rel="icon"][type="image/svg+xml"]', null],
    ['link[rel="icon"][sizes="32x32"]', 32],
    ['link[rel="icon"][sizes="16x16"]', 16],
    ['link[rel="apple-touch-icon"]', 180],
  ] as const) {
    const href = await head.locator(selector).getAttribute('href');
    const response = await page.request.get(new URL(href!, page.url()).href);
    expect(response.ok(), selector).toBe(true);
    if (size) expect(await pngSize(response)).toEqual({ width: size, height: size });
  }
  // Install icons for 4.4's manifest.
  for (const [file, size] of [
    ['icon-192.png', 192],
    ['icon-512.png', 512],
    ['icon-maskable-512.png', 512],
  ] as const) {
    expect(await pngSize(await page.request.get(`${game}${file}`))).toEqual({
      width: size,
      height: size,
    });
  }
  // Link previews use absolute URLs to the deployment; the image itself is served here.
  const image = await head.locator('meta[property="og:image"]').getAttribute('content');
  expect(image).toBe('https://ewajs.github.io/gravitas/social.png');
  await expect(head.locator('meta[name="twitter:card"]')).toHaveAttribute(
    'content',
    'summary_large_image',
  );
  expect(await pngSize(await page.request.get(`${game}social.png`))).toEqual({
    width: 1200,
    height: 630,
  });
});

test('the HUD shows the mark beside the name and on the start card', async ({ page }, info) => {
  await page.goto(`${game}?backend=${info.project.name === 'webgl2' ? 'webgl2' : 'auto'}&lang=en`);
  await expect(page.locator('#viewport')).toHaveAttribute('data-backend', info.project.name);
  for (const slot of ['mark', 'mark-large']) {
    const mark = page.locator(`gravitas-flight-hud > img[slot="${slot}"]`);
    await expect(mark).toBeVisible();
    // Decorative: the name beside it is the accessible text.
    await expect(mark).toHaveAttribute('alt', '');
    expect(await mark.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Gravitas' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'How to fly' })).toBeVisible();
});

test('the manual carries the mark, favicon, and brand colours', async ({ page }, info) => {
  test.skip(info.project.name !== 'webgl2', 'Static pages; one backend is enough.');
  await page.goto(`${game}manual/en/`);
  const logo = page.locator('.VPNavBarTitle img.logo').first();
  await expect(logo).toBeVisible();
  expect(await logo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  const icon = await page.locator('link[rel="icon"][type="image/svg+xml"]').getAttribute('href');
  expect((await page.request.get(new URL(icon!, page.url()).href)).ok()).toBe(true);
  // The manual opens in dark appearance, with the theme's accent as its brand.
  const brand = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--vp-c-brand-1').trim(),
  );
  expect(brand).toBe('#4cc3e0');
});
