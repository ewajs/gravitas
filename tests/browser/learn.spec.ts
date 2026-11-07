import { test, expect } from './test';

// The Learn section: rendered equations and explorers running the real engine.
// Static pages: one backend is enough.
const once = (project: string) =>
  test.skip(project !== 'webgl2', 'Static pages; one backend is enough.');

const base = 'http://127.0.0.1:4173/gravitas/manual';
const chapters = ['', 'motion', 'rockets', 'rotation', 'integration', 'contact', 'orbits'];

test('every chapter renders its equations and explorer in both languages', async ({
  page,
}, info) => {
  once(info.project.name);
  for (const lang of ['', '/en']) {
    for (const chapter of chapters) {
      await page.goto(`${base}${lang}/learn/${chapter ? `${chapter}.html` : ''}`);
      await expect(page.locator('h1')).toBeVisible();
      if (chapter) {
        expect(await page.locator('mjx-container svg').count()).toBeGreaterThan(1);
        await expect(page.locator('.explorer')).toHaveCount(1);
      }
      await page.screenshot({
        path: info.outputPath(`learn${lang.replace('/', '-') || '-es'}-${chapter || 'index'}.png`),
        fullPage: true,
      });
    }
  }
});

test('free-fall explorer reacts to its controls and explains its plots', async ({ page }, info) => {
  once(info.project.name);
  await page.goto(`${base}/en/learn/motion.html`);
  await expect(page.getByTestId('impact-time')).toHaveText('7.77 s');
  await expect(page.getByTestId('impact-speed')).toHaveText('16.6 m/s');
  const path = page.locator('.explorer svg path.series').first();
  const before = await path.getAttribute('d');
  const height = page.getByRole('slider').first();
  await height.focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight'); // +20 m
  await expect(page.getByTestId('impact-time')).not.toHaveText('7.77 s');
  expect(await path.getAttribute('d')).not.toBe(before);
  // Keyboard crosshair: focus the plot and step along time.
  const plot = page.locator('.explorer .lp svg').first();
  await plot.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.lp-tooltip').first()).toContainText('Gravitas engine');
  await expect(page.locator('.lp-table').first()).toBeAttached();
  await page.getByRole('radio', { name: 'Earth 9.81 m/s²' }).check();
  await expect(page.getByTestId('impact-speed')).not.toHaveText('16.6 m/s');
});

test("Newton's cannon orbits at circular speed and crashes when slow", async ({ page }, info) => {
  once(info.project.name);
  await page.goto(`${base}/learn/orbits.html`);
  const outcome = page.getByTestId('cannon-outcome');
  await expect(outcome).toHaveText('orbita');
  await page.getByRole('slider').fill('800');
  await expect(outcome).toHaveText('cae y choca');
  const slider = page.getByRole('slider');
  await slider.fill('1650');
  await expect(outcome).toHaveText('orbita');
  await slider.fill('2400');
  await expect(outcome).toHaveText('escapa de la Luna');
});

test('the convergence table shows real values that change across rows', async ({ page }, info) => {
  once(info.project.name);
  await page.goto(`${base}/en/learn/integration.html`);
  const table = page.locator('.lp-table').nth(1);
  await table.locator('summary').click();
  const rows = await table.locator('tbody tr').allTextContents();
  expect(rows.length).toBe(11);
  expect(new Set(rows).size).toBe(11); // Each row its own step size and errors.
  expect(rows[0]).toMatch(/× 10⁻/); // Scientific notation, not a bare log exponent.
  expect(rows.join(' ')).not.toMatch(/(^|\s)-\d/); // No negative "step sizes".
});
