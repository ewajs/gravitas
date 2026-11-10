import { test } from '@playwright/test';

// Flies a representative workload with ?debug and reports what the overlay measured:
// frame rate, per-frame main-thread work, dropped simulation time, draw calls.
test('frame rate during a powered descent', async ({ page }, info) => {
  const backend = info.project.name === 'webgl2' ? 'webgl2' : 'auto';
  await page.goto(
    `http://127.0.0.1:4173/gravitas/?scenario=quick-landing&backend=${backend}&lang=en&debug`,
  );
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

// The Moon's terrain (5.4b): low over Tranquility Base, falling at 2× so tiles
// refine and get replaced, and from 100 km in orbit, where the most ground shows.
for (const [name, scenario, keys] of [
  ['low over the Moon’s terrain', 'terrain', ['Period']],
  ['in lunar orbit over the terrain', 'orbit', []],
] as const) {
  test(`frame rate ${name}`, async ({ page }, info) => {
    const backend = info.project.name === 'webgl2' ? 'webgl2' : 'auto';
    await page.goto(
      `http://127.0.0.1:4173/gravitas/?scenario=${scenario}&backend=${backend}&lang=en&debug`,
    );
    await page.waitForSelector('#viewport[data-backend]');
    await page.keyboard.press('p');
    for (const key of keys) await page.keyboard.press(key);
    await page.waitForTimeout(8000);
    const data = await page
      .locator('#diagnostics')
      .evaluate((element: HTMLElement) => ({ ...element.dataset }));
    const result = { project: info.project.name, workload: scenario, ...data };
    await info.attach(`framerate-${scenario}.json`, {
      body: JSON.stringify(result, null, 2),
      contentType: 'application/json',
    });
    console.log(`MEASURE ${JSON.stringify(result)}`);
  });
}
