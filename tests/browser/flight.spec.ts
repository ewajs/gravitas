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

  // R moves the lever at 0.5 per simulated second: it ramps rather than jumping,
  // and holds its position on release. Polling keeps this independent of frame rate.
  await page.keyboard.down('r');
  await expect.poll(() => reading(page, 'throttle')).toBeGreaterThan(0);
  expect(await reading(page, 'throttle')).toBeLessThan(60);
  await expect.poll(() => reading(page, 'throttle')).toBeGreaterThanOrEqual(40);
  await page.keyboard.up('r');
  await settle(page);
  const held = await reading(page, 'throttle');
  expect(held).toBeLessThan(100);
  await settle(page);
  expect(await reading(page, 'throttle')).toBe(held);
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

test('focus loss releases held keys, and a hidden tab pauses until resumed', async ({
  page,
}, info) => {
  await open(page, info.project.name);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('#phase')).toBeEmpty();

  await page.keyboard.down('w');
  await page.waitForTimeout(800);
  // The browser may never deliver keyup after focus moves away.
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  // Rate assistance brakes once input is released. A stuck key would keep turning at
  // 30°/s and never give two equal readings; poll so slow renderers have time to settle.
  let previous = Number.NaN;
  await expect
    .poll(
      async () => {
        const tilt = await reading(page, 'tilt');
        const settled = tilt === previous;
        previous = tilt;
        return settled;
      },
      { intervals: [600], timeout: 15_000 },
    )
    .toBe(true);
  expect(previous).toBeGreaterThan(5);
  await page.keyboard.up('w');

  await setHidden(page, true);
  await expect(page.locator('#phase')).toHaveText('Paused. Press P or Resume.');
  const altitude = await page.getByTestId('altitude').textContent();
  await page.waitForTimeout(1000);
  await setHidden(page, false);
  await settle(page);
  await expect(page.getByTestId('altitude')).toHaveText(altitude!);
  await expect(page.locator('#phase')).toHaveText('Paused. Press P or Resume.');
  // Resuming continues the flight from where it was frozen.
  await page.keyboard.press('p');
  await expect(page.locator('#phase')).toBeEmpty();
  await expect.poll(() => page.getByTestId('altitude').textContent()).not.toBe(altitude);
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

test('landing radar is heading-up: pitch leans ahead and a left yaw swings the pad right', async ({
  page,
}, info) => {
  await open(page, info.project.name);
  const point = async (id: string) => {
    const element = page.getByTestId(id);
    return {
      x: Number(await element.getAttribute('data-x')),
      y: Number(await element.getAttribute('data-y')),
    };
  };
  // Facing the pad: 30 m ahead (half of the 60 m rim scale), drifting 2 m/s toward it.
  expect(await point('radar-pad')).toEqual({ x: 0, y: -32 });
  expect(await point('radar-drift')).toEqual({ x: 0, y: -12.8 });
  expect(await point('radar-lean')).toEqual({ x: 0, y: 0 });
  await expect(page.getByTestId('hover-mark')).toBeAttached();

  await page.keyboard.press('p');
  await page.keyboard.down('w');
  await page.waitForTimeout(700);
  await page.keyboard.up('w');
  await settle(page);
  const lean = await point('radar-lean');
  expect(lean.y).toBeLessThan(-5); // Up the screen: thrust leans forward.
  expect(Math.abs(lean.x)).toBeLessThan(1);

  await page.keyboard.down('q');
  await page.waitForTimeout(1200);
  await page.keyboard.up('q');
  await settle(page);
  expect((await point('radar-pad')).x).toBeGreaterThan(5);
  await page.screenshot({ path: info.outputPath('radar.png') });
});
