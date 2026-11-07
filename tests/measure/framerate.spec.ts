import { test } from '@playwright/test';

// Flies a representative workload with ?debug and reports what the overlay measured:
// frame rate, per-frame main-thread work, dropped simulation time, draw calls.
test('frame rate during a powered descent', async ({ page }, info) => {
  const backend = info.project.name === 'webgl2' ? 'webgl2' : 'auto';
  await page.goto(`http://127.0.0.1:4173/gravitas/?backend=${backend}&lang=en&debug`);
  await page.waitForSelector('#viewport[data-backend]');
  await page.keyboard.press('p');
  // Burn hard, then hover with thruster use, so plume, dust, and puffs all draw.
  await page.keyboard.press('z');
  await page.waitForTimeout(2500);
  await page.keyboard.down('w');
  await page.waitForTimeout(400);
  await page.keyboard.up('w');
  await page.keyboard.down('q');
  await page.waitForTimeout(400);
  await page.keyboard.up('q');
  await page.waitForTimeout(3000);
  const overlay = page.locator('#diagnostics');
  const data = await overlay.evaluate((element: HTMLElement) => ({ ...element.dataset }));
  const result = {
    project: info.project.name,
    backend: await page.locator('#viewport').getAttribute('data-backend'),
    renderer: await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      return ext ? String(gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown';
    }),
    ...data,
  };
  await info.attach('framerate.json', {
    body: JSON.stringify(result, null, 2),
    contentType: 'application/json',
  });
  console.log(`MEASURE ${JSON.stringify(result)}`);
});
