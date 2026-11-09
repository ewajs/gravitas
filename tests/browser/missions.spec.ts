import type { Page } from '@playwright/test';
import { box, inside, overflowing } from './layout';
import { PHONES, PORTRAIT } from './phone';
import { test, expect } from './test';

// The mission picker (5.5b): the first screen without a ?scenario= shortcut.

async function open(page: Page, project: string, lang = 'en') {
  const backend = project === 'webgl2' ? 'webgl2' : 'auto';
  await page.goto(`http://127.0.0.1:4173/gravitas/?backend=${backend}&lang=${lang}`);
  await expect(page.locator('#viewport')).toHaveAttribute('data-backend', project);
}

const hud = (page: Page) => page.locator('gravitas-flight-hud');

test('opens on the mission picker, with nothing to fly until a mission is chosen', async ({
  page,
}, info) => {
  await open(page, info.project.name);
  const picker = page.getByRole('region', { name: 'Choose a mission' });
  await expect(picker).toBeVisible();
  const quick = picker.getByRole('button', { name: /Quick landing/ });
  const orbit = picker.getByRole('button', { name: /Landing from orbit/ });
  await expect(quick).toContainText('First lander · from 80 m');
  await expect(orbit).toContainText('Descent vehicle · from 100 km');
  await expect(orbit).toContainText('Preview');
  await expect(quick).toBeFocused();
  // No flight behind it yet: no Start, no instruments, and flight keys do nothing.
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('altitude')).toHaveCount(0);
  await page.keyboard.press('KeyP');
  await expect(picker).toBeVisible();
  await page.screenshot({ path: info.outputPath('picker.png') });
});

test('speaks Spanish by default', async ({ page }, info) => {
  await open(page, info.project.name, 'es-AR');
  const picker = page.getByRole('region', { name: 'Elegí una misión' });
  await expect(picker.getByRole('button', { name: /Aterrizaje rápido/ })).toBeVisible();
  await expect(picker.getByRole('button', { name: /Aterrizaje desde órbita/ })).toContainText(
    'Vista previa',
  );
});

test('flies the quick landing, then returns to the picker and lands from orbit', async ({
  page,
}, info) => {
  await open(page, info.project.name);
  await page.getByRole('button', { name: /Quick landing/ }).click();
  await expect(page.locator('#subtitle')).toHaveText('Lunar descent');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByTestId('pad-distance')).toBeVisible();
  await expect(hud(page).getByTestId('warp')).toHaveCount(0);
  // Missions leaves the flight for the picker, which focuses the mission just flown.
  await hud(page).getByRole('button', { name: 'Missions' }).click();
  const orbit = page.getByRole('button', { name: /Landing from orbit/ });
  await expect(page.getByRole('button', { name: /Quick landing/ })).toBeFocused();
  await expect(hud(page).getByRole('button', { name: 'Pause' })).toHaveCount(0);
  await orbit.click();
  await expect(page.locator('#subtitle')).toHaveText('Landing from orbit · preview');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByTestId('apoapsis')).toContainText('100.0 km');
  await expect(hud(page).getByTestId('warp')).toBeVisible();
  await expect(hud(page).getByRole('button', { name: 'Map' })).toBeVisible();
  // The descent vehicle's 1,900 kg tank: the fuel gauge reads full.
  await expect(page.getByTestId('fuel')).toContainText('100');
  await page.screenshot({ path: info.outputPath('orbit-landing.png') });
  // And back: the opening's flat site and pad again, with no warp.
  await hud(page).getByRole('button', { name: 'Missions' }).click();
  await page.getByRole('button', { name: /Quick landing/ }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByTestId('pad-distance')).toBeVisible();
  await expect(hud(page).getByTestId('warp')).toHaveCount(0);
  await expect(page.locator('#subtitle')).toHaveText('Lunar descent');
});

test('chooses with the keyboard: arrows move, Enter flies', async ({ page }, info) => {
  await open(page, info.project.name);
  await expect(page.getByRole('button', { name: /Quick landing/ })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: /Landing from orbit/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#subtitle')).toHaveText('Landing from orbit · preview');
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
});

test('offers the picker again from the results card', async ({ page }, info) => {
  await open(page, info.project.name);
  await page.getByRole('button', { name: /Quick landing/ }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  // Left alone, the opening falls to a crash in about 8 s.
  const report = page.locator('#report');
  await expect(report).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('report-title')).toHaveText('Crash');
  await report.getByRole('button', { name: 'Missions' }).click();
  await expect(page.getByRole('region', { name: 'Choose a mission' })).toBeVisible();
});

test('a gamepad moves with the D-pad and chooses with A', async ({ page }, info) => {
  await page.addInitScript(() => {
    const pads: unknown[] = [null, null, null, null];
    Object.defineProperty(window, '__pads', { value: pads });
    Object.defineProperty(navigator, 'getGamepads', { value: () => pads, configurable: true });
  });
  await open(page, info.project.name);
  const press = async (button: number) => {
    for (const value of [1, 0]) {
      await page.evaluate(
        ([button, value]: [number, number]) => {
          const pads = (window as unknown as { __pads: unknown[] }).__pads;
          const first = pads[0] === null;
          pads[0] = {
            id: 'Simulated pad (STANDARD GAMEPAD)',
            index: 0,
            connected: true,
            mapping: 'standard',
            timestamp: performance.now(),
            axes: [0, 0, 0, 0],
            buttons: Array.from({ length: 17 }, (_, index) => ({
              pressed: index === button && value > 0,
              touched: index === button && value > 0,
              value: index === button ? value : 0,
            })),
          };
          if (first) {
            const event = new Event('gamepadconnected');
            Object.defineProperty(event, 'gamepad', { value: pads[0] });
            window.dispatchEvent(event);
          }
        },
        [button, value] as [number, number],
      );
      await page.waitForTimeout(150);
    }
  };
  await press(15); // D-pad right.
  await expect(page.getByRole('button', { name: /Landing from orbit/ })).toBeFocused();
  await press(0); // A.
  await expect(page.locator('#subtitle')).toHaveText('Landing from orbit · preview');
});

// Phones: the picker fits landscape and portrait (it is shown before a flight, so
// both orientations work), and a tap chooses.
for (const [name, size] of [
  ['iPhone 15 Pro in Safari', PHONES['iPhone 15 Pro in Safari']!],
  ['Galaxy A70 in Chrome', PHONES['Galaxy A70 in Chrome']!],
  ['iPhone 15 Pro upright', PORTRAIT['iPhone 15 Pro in Safari']!],
] as const) {
  test.describe(`the picker on an emulated ${name}`, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: size.deviceScaleFactor,
      isMobile: true,
      hasTouch: true,
    });

    test('fits the screen and chooses with a tap', async ({ page }, info) => {
      await open(page, info.project.name);
      const picker = page.getByRole('region', { name: 'Choose a mission' });
      await expect(picker).toBeVisible();
      for (const mission of [/Quick landing/, /Landing from orbit/]) {
        const choice = picker.getByRole('button', { name: mission });
        await choice.scrollIntoViewIfNeeded();
        inside(await box(choice), size.width, size.height, `${mission}`);
      }
      await page.waitForTimeout(300);
      expect(await overflowing(page), 'nothing overflows on the picker').toEqual([]);
      await page.screenshot({ path: info.outputPath('picker-phone.png') });
      await picker.getByRole('button', { name: /Landing from orbit/ }).tap();
      await expect(page.locator('#subtitle')).toHaveText('Landing from orbit · preview');
      await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
    });
  });
}
