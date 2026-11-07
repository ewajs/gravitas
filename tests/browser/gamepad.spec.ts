import type { Page } from '@playwright/test';
import { test, expect } from './test';

// A simulated standard-mapping gamepad: navigator.getGamepads() is replaced
// before the app loads, and tests change the pad's state between frames.
interface PadState {
  mapping?: string;
  axes?: Record<number, number>;
  buttons?: Record<number, number>;
}

async function open(page: Page, project: string) {
  await page.addInitScript(() => {
    const pads: unknown[] = [null, null, null, null];
    Object.defineProperty(window, '__pads', { value: pads });
    Object.defineProperty(navigator, 'getGamepads', { value: () => pads, configurable: true });
  });
  const backend = project === 'webgl2' ? 'webgl2' : 'auto';
  await page.goto(`http://127.0.0.1:4173/gravitas/?backend=${backend}&lang=en`);
  await expect(page.locator('#viewport')).toHaveAttribute('data-backend', project);
}

/** Sets pad 0's state (undefined disconnects it), firing the connection events. */
function setPad(page: Page, state: PadState | undefined) {
  return page.evaluate((state) => {
    const pads = (window as unknown as { __pads: unknown[] }).__pads;
    const before = pads[0];
    const pad = state && {
      id: 'Simulated pad (STANDARD GAMEPAD)',
      index: 0,
      connected: true,
      mapping: state.mapping ?? 'standard',
      timestamp: performance.now(),
      axes: [0, 1, 2, 3].map((index) => state.axes?.[index] ?? 0),
      buttons: Array.from({ length: 17 }, (_, index) => {
        const value = state.buttons?.[index] ?? 0;
        return { pressed: value > 0.5, touched: value > 0, value };
      }),
    };
    pads[0] = pad ?? null;
    const type = pad && !before ? 'gamepadconnected' : !pad && before ? 'gamepaddisconnected' : '';
    if (type) {
      const event = new Event(type);
      Object.defineProperty(event, 'gamepad', { value: pad ?? before });
      window.dispatchEvent(event);
    }
  }, state);
}

/** Presses and releases one button across a few frames. */
async function press(page: Page, button: number) {
  await setPad(page, { buttons: { [button]: 1 } });
  await page.waitForTimeout(150);
  await setPad(page, {});
  await page.waitForTimeout(150);
}

async function reading(page: Page, id: string): Promise<number> {
  const text = (await page.getByTestId(id).textContent()) ?? '';
  return Number(text.replace(/[^0-9.-]/g, ''));
}

const A = 0;
const LB = 4;
const RT = 7;
const START = 9;

test('a standard gamepad starts, flies, pauses, and shows its own controls', async ({
  page,
}, info) => {
  await open(page, info.project.name);
  const card = page.getByRole('complementary', { name: 'How to fly' });
  await expect(card).toContainText('W A S D');
  await setPad(page, {});
  await press(page, LB); // Any deliberate input makes it the device in use.
  await expect(card).toContainText('Right stick');
  await expect(card).toContainText('LB RB');
  await expect(page.locator('#phase')).toHaveText('Ready to descend. Press A or Start.');
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toContainText('A');
  await page.screenshot({ path: info.outputPath('gamepad-ready.png') });

  await press(page, A);
  await expect(page.locator('#phase')).toBeEmpty();

  // A light trigger moves the lever slowly; release holds it where it is.
  await setPad(page, { buttons: { [RT]: 0.4 } });
  await expect.poll(() => reading(page, 'throttle')).toBeGreaterThanOrEqual(10);
  await setPad(page, {});
  await page.waitForTimeout(400);
  const held = await reading(page, 'throttle');
  expect(held).toBeLessThan(60);
  await page.waitForTimeout(400);
  expect(await reading(page, 'throttle')).toBe(held);

  // Right stick up leans thrust forward: up the heading-up radar.
  await setPad(page, { axes: { 3: -1 } });
  await page.waitForTimeout(700);
  await setPad(page, {});
  await page.waitForTimeout(400);
  expect(Number(await page.getByTestId('radar-lean').getAttribute('data-y'))).toBeLessThan(-5);

  await press(page, START);
  await expect(page.locator('#phase')).toHaveText('Paused. Press A or Resume.');
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Flight controls' });
  await expect(dialog).toContainText('Right stick');
  await expect(dialog).toContainText('RT / LT');
  await page.screenshot({ path: info.outputPath('gamepad-help.png') });
  await press(page, A); // Waits while Help is open.
  await expect(page.locator('#phase')).toHaveText('Paused. Press A or Resume.');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await press(page, A);
  await expect(page.locator('#phase')).toBeEmpty();

  // Losing the pad pauses the flight and returns the hints to the keyboard.
  await setPad(page, undefined);
  await expect(page.locator('#phase')).toHaveText('Paused. Press P or Resume.');
});

test('after a verdict, A tries again', async ({ page }, info) => {
  await open(page, info.project.name);
  await setPad(page, {});
  await press(page, A);
  await expect(page.locator('#phase')).toBeEmpty();
  const report = page.locator('#report');
  await expect(report).toBeVisible({ timeout: 30_000 });
  await expect(report.getByRole('button', { name: 'Try again' })).toContainText('A');
  await press(page, A);
  await expect(report).toHaveCount(0);
  await expect(page.getByTestId('altitude')).toHaveText('80.0 m');
  await expect(page.locator('#phase')).toHaveText('Ready to descend. Press A or Start.');
});

test('a pad without the standard mapping is ignored', async ({ page }, info) => {
  await open(page, info.project.name);
  await setPad(page, { mapping: '', buttons: { [A]: 1, [RT]: 1 } });
  await page.waitForTimeout(500);
  await expect(page.locator('#phase')).toHaveText('Ready to descend. Press P or Start.');
  await expect(page.getByRole('complementary', { name: 'How to fly' })).toContainText('W A S D');
});
