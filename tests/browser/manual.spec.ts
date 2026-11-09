import { test, expect } from './test';

// The manual is built into the same Pages artifact, under /gravitas/manual/.
// Its Play link opens the game with automatic backend selection; this browser has
// no WebGPU, so the documented fallback messages are expected.
test.use({
  allowedMessages: {
    patterns: [
      /^No available adapters\.$/,
      /^THREE\.WebGPURenderer: WebGPU is not available, running under WebGL2 backend\.$/,
    ],
  },
});

test('Help links to the manual in the current language, and the manual links back', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'webgl2', 'Static pages; one backend is enough.');
  await page.goto('http://127.0.0.1:4173/gravitas/?scenario=quick-landing&backend=webgl2');
  await page.getByRole('button', { name: 'Ayuda', exact: true }).click();
  const spanish = page.getByRole('link', { name: 'Abrir el manual (pestaña nueva)' });
  // The game's relative base makes this ./manual/; check where it actually resolves.
  const resolved = (link: typeof spanish) => link.evaluate((a: HTMLAnchorElement) => a.href);
  expect(await resolved(spanish)).toBe('http://127.0.0.1:4173/gravitas/manual/');
  await expect(spanish).toHaveAttribute('target', '_blank');
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('combobox', { name: 'Idioma' }).selectOption('en');
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  expect(await resolved(page.getByRole('link', { name: 'Open the manual (new tab)' }))).toBe(
    'http://127.0.0.1:4173/gravitas/manual/en/',
  );

  await page.goto('http://127.0.0.1:4173/gravitas/manual/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Bienvenido a Gravitas/);
  await page.getByRole('link', { name: 'Aterrizar' }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Aterrizar/);
  await page.screenshot({ path: info.outputPath('manual-es.png'), fullPage: false });
  await page.goto('http://127.0.0.1:4173/gravitas/manual/en/landing.html');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Landing/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByRole('link', { name: 'Play' }).first().click();
  await expect(page).toHaveURL(/\/gravitas\/\?lang=en$/);
  await expect(page.locator('#viewport')).toHaveAttribute('data-backend', /webgl2|webgpu/);
});
