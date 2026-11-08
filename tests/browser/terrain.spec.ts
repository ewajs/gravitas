import type { Page } from '@playwright/test';
import { test, expect } from './test';

// The terrain sandbox (5.4b): ?scenario=terrain puts the first lander 300 m above
// Tranquility Base, over tiles meshed from the Moon's height function.

async function openTerrain(page: Page, project: string, lang = 'en') {
  const backend = project === 'webgl2' ? 'webgl2' : 'auto';
  await page.goto(
    `http://127.0.0.1:4173/gravitas/?scenario=terrain&backend=${backend}&lang=${lang}&debug`,
  );
  await expect(page.locator('#viewport')).toHaveAttribute('data-backend', project);
}

/** The debug overlay's terrain counts once every wanted tile is meshed. */
async function settledTerrain(page: Page) {
  const overlay = page.locator('#diagnostics');
  await expect
    .poll(async () => Number(await overlay.getAttribute('data-terrain-tiles')), { timeout: 30_000 })
    .toBeGreaterThan(0);
  await expect
    .poll(async () => await overlay.getAttribute('data-terrain-pending'), { timeout: 30_000 })
    .toBe('0');
  return {
    tiles: Number(await overlay.getAttribute('data-terrain-tiles')),
    level: Number(await overlay.getAttribute('data-terrain-level')),
  };
}

test('the terrain sandbox: tiles over Tranquility Base, finer near the ground, then the ground', async ({
  page,
}, info) => {
  test.slow();
  await openTerrain(page, info.project.name);
  await expect(page.locator('#subtitle')).toHaveText('Lunar surface · sandbox');
  await expect(page.locator('canvas')).toHaveAttribute(
    'aria-label',
    "A lunar lander above the Moon's surface.",
  );
  const hud = page.locator('gravitas-flight-hud');
  // 300 m up, give or take the first frames' fall.
  await expect(hud.getByTestId('altitude')).toContainText(/\b(29\d\.\d|300\.0) m\b/);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const high = await settledTerrain(page);
  // 300 m up, tiles of about 40 m (level 16) or finer are drawn near the lander.
  expect(high.level).toBeGreaterThanOrEqual(15);
  expect(high.tiles).toBeLessThan(150);
  await page.screenshot({ path: info.outputPath('terrain-high.png') });

  // Fall at 4× until the ground, which pauses (no contact until 5.4c).
  for (let n = 0; n < 2; n++) await page.keyboard.press('Period');
  await expect(hud.getByTestId('warp')).toHaveText('×4');
  await expect(hud.locator('#notice')).toHaveText(
    'You reached the ground. Touching it comes with the next step; restart to start over.',
    { timeout: 30_000 },
  );
  const low = await settledTerrain(page);
  expect(low.level).toBeGreaterThanOrEqual(17);
  await page.screenshot({ path: info.outputPath('terrain-low.png') });
});

test('the terrain sandbox reads in Spanish', async ({ page }, info) => {
  await openTerrain(page, info.project.name, 'es-AR');
  await expect(page.locator('#subtitle')).toHaveText('Superficie lunar · prueba');
});
