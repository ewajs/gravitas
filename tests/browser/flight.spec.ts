import type { Page } from '@playwright/test';
import { test, expect } from './test';

async function open(page: Page, project: string, lang = 'en') {
  const backend = project === 'webgl2' ? 'webgl2' : 'auto';
  await page.goto(`http://127.0.0.1:4173/gravitas/?backend=${backend}&lang=${lang}`);
  await expect(page.locator('#viewport')).toHaveAttribute('data-backend', project);
}

/** Parses an English readout such as "-12.3 m/s", "1,234.5 m", "54%", or "60°". */
async function reading(page: Page, id: string): Promise<number> {
  const text = (await page.getByTestId(id).textContent()) ?? '';
  return Number(text.replace(/[^0-9.-]/g, ''));
}

// Instruments refresh at 10 Hz; wait past a few updates.
const settle = (page: Page) => page.waitForTimeout(400);

function setHidden(page: Page, hidden: boolean) {
  return page.evaluate((value) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

test('keyboard flight: start, throttle lever, pause, language switch, and restart', async ({
  page,
}, info) => {
  await open(page, info.project.name);
  const phase = page.locator('#phase');
  await expect(phase).toHaveText('Ready to descend. Press P or Start.');
  await expect(page.getByTestId('altitude')).toHaveText('80.0 m');
  await settle(page);
  await expect(page.getByTestId('altitude')).toHaveText('80.0 m'); // Nothing moves until start.

  await page.keyboard.press('p');
  await expect(phase).toBeEmpty();
  await expect.poll(() => reading(page, 'altitude')).toBeLessThan(79);

  await page.keyboard.down('r');
  await page.waitForTimeout(1000);
  await page.keyboard.up('r');
  await settle(page);
  const ramped = await reading(page, 'throttle');
  // 0.5 per second while held; allow for key and frame timing.
  expect(ramped).toBeGreaterThanOrEqual(35);
  expect(ramped).toBeLessThanOrEqual(65);
  await page.keyboard.press('z');
  await expect(page.getByTestId('throttle')).toHaveText('100%');
  await expect.poll(() => reading(page, 'vertical-speed')).toBeGreaterThan(-3);
  await page.keyboard.press('x');
  await expect(page.getByTestId('throttle')).toHaveText('0%');
  expect(await reading(page, 'fuel')).toBeLessThan(100);

  await page.keyboard.press('p');
  await expect(phase).toHaveText('Paused. Press P or Resume.');
  const paused = await page.getByTestId('altitude').textContent();
  await page.waitForTimeout(600);
  await expect(page.getByTestId('altitude')).toHaveText(paused!);

  // Language changes keep the flight: same altitude in the other locale's notation.
  await page.getByRole('combobox', { name: 'Language' }).selectOption('es-AR');
  await expect(page.locator('#phase')).toHaveText('En pausa. Pulsá P o Reanudar.');
  await expect(page.getByTestId('altitude')).toHaveText(paused!.replace('.', ','));
  await page.getByRole('combobox', { name: 'Idioma' }).selectOption('en');
  await expect(page.getByTestId('altitude')).toHaveText(paused!);

  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(phase).toBeEmpty();
  await expect.poll(() => page.getByTestId('altitude').textContent()).not.toBe(paused);

  await page.locator('canvas').focus();
  await page.keyboard.press('Enter');
  await expect(phase).toHaveText('Ready to descend. Press P or Start.');
  await expect(page.getByTestId('altitude')).toHaveText('80.0 m');
  await expect(page.getByTestId('throttle')).toHaveText('0%');
  await expect(page.getByTestId('fuel')).toHaveText('100%');
});

test('focus loss releases held keys, and a hidden tab pauses without catching up', async ({
  page,
}, info) => {
  await open(page, info.project.name);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('#phase')).toBeEmpty();

  await page.keyboard.down('w');
  await page.waitForTimeout(800);
  // The browser may never deliver keyup after focus moves away.
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForTimeout(1500); // Rate assistance brakes once input is released.
  const tilt = await reading(page, 'tilt');
  expect(tilt).toBeGreaterThan(5);
  await page.waitForTimeout(600);
  expect(await reading(page, 'tilt')).toBe(tilt);
  await page.keyboard.up('w');

  await setHidden(page, true);
  await expect(page.locator('#phase')).toHaveText('Paused. Press P or Resume.');
  const altitude = await page.getByTestId('altitude').textContent();
  await page.waitForTimeout(1000);
  await setHidden(page, false);
  await settle(page);
  await expect(page.getByTestId('altitude')).toHaveText(altitude!);
  await expect(page.locator('#phase')).toHaveText('Paused. Press P or Resume.');
  // On resume, the hidden second is not simulated as a burst of catch-up steps.
  await page.keyboard.press('p');
  await page.waitForTimeout(150);
  const resumed = await reading(page, 'altitude');
  expect(Number(altitude!.replace(/[^0-9.-]/g, '')) - resumed).toBeLessThan(5);
});

test('flight keys stay out of form controls and help, which pauses the flight', async ({
  page,
}, info) => {
  await open(page, info.project.name);
  await page.keyboard.press('p');
  await expect(page.locator('#phase')).toBeEmpty();
  await page.getByRole('combobox', { name: 'Language' }).focus();
  await page.keyboard.press('p');
  await settle(page);
  await expect(page.locator('#phase')).toBeEmpty();

  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Flight controls' })).toBeVisible();
  await expect(page.locator('#phase')).toHaveText('Paused. Press P or Resume.');
  await page.keyboard.press('p');
  await page.keyboard.press('Enter'); // Activates Close, not a flight restart.
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('#phase')).toHaveText('Paused. Press P or Resume.');
  expect(await reading(page, 'altitude')).toBeLessThan(80);
});

test('placeholder ground halt keeps touchdown speeds until restart', async ({ page }, info) => {
  await open(page, info.project.name);
  await page.keyboard.press('p');
  // Unpowered from 80 m at -4 m/s: contact after about 7.8 s at about -16.6 m/s.
  await expect(page.locator('#phase')).toContainText('Surface contact', { timeout: 15_000 });
  await expect(page.getByTestId('altitude')).toHaveText('0.0 m');
  const speed = await reading(page, 'vertical-speed');
  expect(speed).toBeGreaterThan(-17);
  expect(speed).toBeLessThan(-16.2);
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('contact.png') });
  await page.keyboard.press('p'); // No effect after contact.
  await expect(page.locator('#phase')).toContainText('Surface contact');
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(page.getByTestId('altitude')).toHaveText('80.0 m');
  await page.screenshot({ path: info.outputPath('start.png') });
});
