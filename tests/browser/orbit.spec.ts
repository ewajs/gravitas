import type { Page } from '@playwright/test';
import type { FlightHud } from '@gravitas/ui';
import { expectClearCentre, inside, box, overflowing } from './layout';
import { PHONES } from './phone';
import { test, expect } from './test';

// The orbit sandbox (5.3b): ?scenario=orbit puts the first lander in a 15 × 100 km
// lunar orbit with time warp, the map, and orbital readouts.

async function openSandbox(page: Page, project: string, lang = 'en') {
  const backend = project === 'webgl2' ? 'webgl2' : 'auto';
  await page.goto(`http://127.0.0.1:4173/gravitas/?scenario=orbit&backend=${backend}&lang=${lang}`);
  await expect(page.locator('#viewport')).toHaveAttribute('data-backend', project);
}

/** Parses an English readout such as "100.0 km · 56:51" (the first number only). */
async function first(page: Page, id: string): Promise<number> {
  const text = (await page.getByTestId(id).textContent()) ?? '';
  return Number(/-?[\d,]+(\.\d+)?/.exec(text)![0].replace(/,/g, ''));
}

async function countdown(page: Page, id: string): Promise<number> {
  const text = (await page.getByTestId(`${id}-time`).textContent()) ?? '';
  const parts = text
    .replace(/[^\d:]/g, '')
    .split(':')
    .map(Number);
  return parts.reduce((total, part) => total * 60 + part, 0);
}

test('the sandbox: orbit readouts, physics and rails warp, refusals, the map, and Help', async ({
  page,
}, info) => {
  await openSandbox(page, info.project.name);
  const hud = page.locator('gravitas-flight-hud');
  await expect(page.locator('#subtitle')).toHaveText('Lunar orbit · sandbox');
  await expect(page.locator('canvas')).toHaveAttribute(
    'aria-label',
    'A lunar lander in orbit around the Moon.',
  );
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByTestId('apoapsis')).toContainText('100.0 km');
  await expect(page.getByTestId('periapsis')).toContainText('15.0 km');
  await expect(page.getByTestId('altitude')).toContainText('100.0 km');
  await expect(page.getByTestId('pad-distance')).toHaveCount(0);
  expect(await first(page, 'orbital-speed')).toBeGreaterThan(1500);
  await page.screenshot({ path: info.outputPath('sandbox-chase.png') });

  // Physics warp, then rails: lever closed, no rotation, 100 km up.
  const warp = hud.getByTestId('warp');
  await expect(warp).toHaveText('×1');
  await page.keyboard.press('Period');
  await expect(warp).toHaveText('×2');
  await page.keyboard.press('Period');
  await page.keyboard.press('Period');
  await expect(warp).toHaveText('×10');
  const before = await countdown(page, 'periapsis');
  await page.keyboard.press('Period');
  await expect(warp).toHaveText('×100');
  await page.waitForTimeout(1500);
  // At 100× even a slow software renderer covers well over a minute of orbit.
  expect(before - (await countdown(page, 'periapsis'))).toBeGreaterThan(60);
  await page.keyboard.press('Comma');
  await expect(warp).toHaveText('×10');

  // Input drops to real time; with the lever open, rails are refused and explained.
  await page.keyboard.down('KeyR');
  await page.waitForTimeout(300);
  await page.keyboard.up('KeyR');
  await expect(warp).toHaveText('×1');
  for (let n = 0; n < 3; n++) await page.keyboard.press('Period');
  await expect(warp).toHaveText('×4');
  await expect(hud.locator('#notice')).toHaveText('Close the throttle to speed up time further.');
  await page.keyboard.press('KeyX'); // Cut the engine.
  await page.waitForTimeout(200);
  await page.keyboard.press('Period');
  await expect(warp).toHaveText('×10');

  // The map, by key and by button.
  const map = hud.getByRole('button', { name: 'Map' });
  await page.keyboard.press('KeyV');
  await expect(map).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(500);
  await page.screenshot({ path: info.outputPath('sandbox-map.png') });
  await map.click();
  await expect(map).toHaveAttribute('aria-pressed', 'false');

  // Pausing returns to real time; Help lists time warp and the map.
  await page.keyboard.press('KeyP');
  await expect(warp).toHaveText('×1');
  await hud.getByRole('button', { name: 'Help' }).click();
  const dialog = hud.getByRole('dialog');
  await expect(dialog).toContainText('Time: slower / faster');
  await expect(dialog).toContainText('Map and orbit');
});

test('the sandbox reads in Spanish too', async ({ page }, info) => {
  await openSandbox(page, info.project.name, 'es-AR');
  await expect(page.locator('#subtitle')).toHaveText('Órbita lunar · prueba');
  await page.getByRole('button', { name: 'Comenzar', exact: true }).click();
  await expect(page.getByTestId('apoapsis')).toContainText('100,0 km');
  await expect(
    page.locator('gravitas-flight-hud').getByRole('button', { name: 'Mapa' }),
  ).toBeVisible();
});

test('the opening offers no time warp or map', async ({ page }, info) => {
  const backend = info.project.name === 'webgl2' ? 'webgl2' : 'auto';
  await page.goto(`http://127.0.0.1:4173/gravitas/?backend=${backend}&lang=en`);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const hud = page.locator('gravitas-flight-hud');
  await expect(hud.getByRole('button', { name: 'Pause' })).toBeVisible();
  await expect(hud.getByTestId('warp')).toHaveCount(0);
  await expect(hud.getByRole('button', { name: 'Map' })).toHaveCount(0);
  await page.keyboard.press('Period');
  await page.keyboard.press('KeyV');
  await expect(hud.getByTestId('warp')).toHaveCount(0);
  await expect(page.getByTestId('pad-distance')).toBeVisible();
});

for (const name of ['iPhone 15 Pro in Safari', 'Galaxy A70 in Chrome'] as const) {
  const size = PHONES[name]!;
  test.describe(`the sandbox on an emulated ${name}`, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: size.deviceScaleFactor,
      isMobile: true,
      hasTouch: true,
    });
    test.slow();

    test('fits: warp beside pause, Ap and Pe in the radar card, map in the menu', async ({
      page,
    }, info) => {
      await openSandbox(page, info.project.name);
      const hud = page.locator('gravitas-flight-hud');
      await expect(hud).toHaveAttribute('touch-layout', '');
      await page.getByRole('button', { name: 'Start', exact: true }).tap();
      await expect(page.locator('gravitas-touch-controls')).toBeVisible();
      const stepper = hud.getByRole('group', { name: 'Time warp' });
      inside(await box(stepper), size.width, size.height, 'time warp');
      await hud.getByRole('button', { name: 'Faster time' }).tap();
      await expect(hud.getByTestId('warp')).toHaveText('×2');
      await expect(hud.getByTestId('apoapsis')).toBeVisible();
      await expect(hud.getByTestId('orbital-speed')).toBeHidden();
      await expectClearCentre(page, 'flying in orbit');
      await page.waitForTimeout(350);
      expect(await overflowing(page), 'nothing overflows in orbit').toEqual([]);
      await page.screenshot({ path: info.outputPath('sandbox-phone.png') });
      // The map from the ⋯ menu (opening it pauses, as everywhere).
      await hud.getByRole('button', { name: 'Menu' }).tap();
      await hud.locator('#menu').getByRole('button', { name: 'Map' }).tap();
      // Choosing closes the menu; the HUD shows the map camera.
      await expect.poll(() => hud.evaluate((element: FlightHud) => element.camera)).toBe('map');
      await page.waitForTimeout(500);
      await page.screenshot({ path: info.outputPath('sandbox-phone-map.png') });
    });
  });
}
