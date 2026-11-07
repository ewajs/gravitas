import type { Locator, Page } from '@playwright/test';
import type { FlightHud } from '@gravitas/ui';
import { openPhone, PHONES } from './phone';
import { test, expect } from './test';

type Box = { x: number; y: number; width: number; height: number };

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

async function box(locator: Locator): Promise<Box> {
  const found = await locator.boundingBox();
  expect(found, 'element is laid out').not.toBeNull();
  return found!;
}

function inside(b: Box, width: number, height: number, label: string) {
  expect(b.x, `${label} left`).toBeGreaterThanOrEqual(0);
  expect(b.y, `${label} top`).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width, `${label} right`).toBeLessThanOrEqual(width + 0.5);
  expect(b.y + b.height, `${label} bottom`).toBeLessThanOrEqual(height + 0.5);
}

// The notch and home indicator, as an iPhone 15 Pro reports them in landscape.
async function safeArea(page: Page, insets: { left: number; right: number; bottom: number }) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send(
    'Emulation.setSafeAreaInsetsOverride' as never,
    {
      insets: { top: 0, ...insets },
    } as never,
  );
}

const t = (lang: string, es: string, en: string) => (lang === 'en' ? en : es);

// Screenshots for review wait out the 200–280 ms entrances, so cards are opaque.
async function shot(page: Page, path: string) {
  await page.waitForTimeout(450);
  await page.screenshot({ path });
}

for (const [name, size] of Object.entries(PHONES)) {
  test.describe(`phone layout on an emulated ${name}`, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: size.deviceScaleFactor,
      isMobile: true,
      hasTouch: true,
    });
    // Phone-resolution screenshots are slow on the software-paced WebGL 2 project.
    test.slow();

    for (const lang of ['es-AR', 'en']) {
      test(`flying in landscape keeps both thumb zones clear (${lang})`, async ({ page }, info) => {
        await openPhone(page, info.project.name, lang);
        const hud = page.locator('gravitas-flight-hud');
        const controls = page.locator('gravitas-touch-controls');
        // Ready: the start card and Start fit, with nothing behind them.
        const card = page.getByRole('complementary', { name: t(lang, 'Cómo volar', 'How to fly') });
        const start = page.getByRole('button', { name: t(lang, 'Comenzar', 'Start'), exact: true });
        inside(await box(card), size.width, size.height, 'start card');
        inside(await box(start), size.width, size.height, 'Start');
        await expect(hud.locator('.instruments')).toBeHidden();
        await shot(page, info.outputPath(`ready-${lang}.png`));

        await start.tap();
        await expect(controls).toBeVisible();
        await expect(hud).toHaveAttribute('touch-controls', '');
        await page.waitForTimeout(300);
        const lever = await box(controls.getByTestId('touch-lever'));
        const stickZone = await box(controls.getByTestId('touch-stick-zone'));
        const leverZone = await box(controls.getByTestId('touch-lever-zone'));
        const yaw = [
          await box(controls.getByTestId('touch-yaw-left')),
          await box(controls.getByTestId('touch-yaw-right')),
        ];
        const panels = {
          readouts: await box(hud.locator('.flight-panel')),
          radar: await box(hud.locator('.navigation-panel')),
          'flight buttons': await box(hud.locator('header .actions')),
          'view buttons': await box(hud.locator('nav')),
        };
        for (const [label, panel] of Object.entries(panels)) {
          inside(panel, size.width, size.height, label);
          expect(overlaps(panel, lever), `${label} clear of the lever`).toBe(false);
          expect(overlaps(panel, leverZone), `${label} clear of the lever zone`).toBe(false);
          expect(overlaps(panel, stickZone), `${label} clear of the stick zone`).toBe(false);
          for (const button of yaw)
            expect(overlaps(panel, button), `${label} clear of yaw`).toBe(false);
        }
        expect(overlaps(panels.readouts, panels['flight buttons']), 'readouts and buttons').toBe(
          false,
        );
        for (const button of yaw) inside(button, size.width, size.height, 'yaw button');
        inside(lever, size.width, size.height, 'lever');
        await expect(hud.getByTestId('pad-distance')).toBeVisible();
        await shot(page, info.outputPath(`flying-${lang}.png`));

        await hud.getByRole('button', { name: t(lang, 'Pausar', 'Pause') }).tap();
        await expect(controls).toHaveAttribute('disabled', '');
        await shot(page, info.outputPath(`paused-${lang}.png`));
        // Paused, so the snapshot stays: the readouts never overflow the strip, even
        // sinking fast with the caution icon.
        await hud.evaluate((element: FlightHud) => {
          element.telemetry = { ...element.telemetry!, verticalSpeed: -12.3, safeSink: 2 };
        });
        await expect(hud.getByTestId('sink-scale')).toBeHidden(); // The scale gives way...
        await expect(
          hud.getByRole('img', { name: /faster than the safe sink|más rápido/i }),
        ).toBeVisible(); // ...the caution stays.
        const strip = hud.locator('.flight-panel');
        expect(await strip.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
        inside(await box(strip), size.width, size.height, 'readouts, sinking fast');
        expect(overlaps(await box(strip), leverZone), 'strip clear of the lever zone').toBe(false);
        await hud.getByRole('button', { name: t(lang, 'Ayuda', 'Help'), exact: true }).tap();
        const dialog = page.getByRole('dialog');
        inside(await box(dialog), size.width, size.height, 'Help');
        await shot(page, info.outputPath(`help-${lang}.png`));
        // Help scrolls inside itself to its last setting.
        const last = dialog.getByRole('combobox', {
          name: t(lang, 'Controles táctiles', 'Touch controls'),
        });
        await last.scrollIntoViewIfNeeded();
        await expect(last).toBeInViewport();
      });
    }

    test('the results card fits and Try again is reachable', async ({ page }, info) => {
      await openPhone(page, info.project.name);
      await page.locator('gravitas-flight-hud').evaluate((element: FlightHud) => {
        element.report = {
          verdict: 'landed-off-pad',
          checks: [
            { id: 'vertical-speed', value: 1.2, limit: 2, pass: true },
            { id: 'horizontal-speed', value: 0.4, limit: 1, pass: true },
            { id: 'tilt', value: 0.05, limit: (10 * Math.PI) / 180, pass: true },
            { id: 'pad-distance', value: 6.2, limit: 3.8, pass: false },
          ],
          fuel: 0.31,
          flightTime: 41,
        };
        element.phase = 'complete';
      });
      const report = page.locator('#report');
      await expect(report).toBeVisible();
      const card = await box(report);
      inside(card, size.width, size.height, 'results card');
      const retry = report.getByRole('button', { name: 'Try again' });
      await expect(retry).toBeInViewport();
      inside(await box(retry), size.width, size.height, 'Try again');
      // Two columns: the checks beside the verdict, so nothing needs scrolling.
      const verdict = await box(report.locator('.verdict'));
      const checks = await box(report.locator('.checks'));
      expect(checks.x).toBeGreaterThan(verdict.x + verdict.width - 1);
      expect(await report.evaluate((e) => e.scrollHeight <= e.clientHeight + 1)).toBe(true);
      await shot(page, info.outputPath('results-en.png'));
    });

    test('portrait asks to turn the phone, pauses, and leaves menus usable', async ({
      page,
    }, info) => {
      await page.setViewportSize({ width: size.height, height: size.width });
      await openPhone(page, info.project.name, 'es-AR');
      const prompt = page.getByTestId('rotate-prompt');
      // Before the flight: no prompt; the start card and Help work upright.
      await expect(prompt).toHaveCount(0);
      inside(
        await box(page.getByRole('complementary', { name: 'Cómo volar' })),
        size.height,
        size.width,
        'start card (portrait)',
      );
      await page.getByRole('button', { name: 'Comenzar', exact: true }).tap();
      await expect(prompt).toBeVisible();
      await expect(prompt).toContainText('Girá el teléfono');
      await expect(page.locator('#phase')).toHaveText('En pausa. Tocá Reanudar.');
      await expect(page.locator('gravitas-touch-controls')).toBeHidden();
      await shot(page, info.outputPath('portrait-prompt-es.png'));
      // Resuming upright pauses again at once.
      await page.getByRole('button', { name: 'Reanudar' }).tap();
      await expect(page.locator('#phase')).toHaveText('En pausa. Tocá Reanudar.');
      const altitude = await page.getByTestId('altitude').textContent();
      await page.waitForTimeout(500);
      await expect(page.getByTestId('altitude')).toHaveText(altitude!);
      await page.getByRole('button', { name: 'Ayuda', exact: true }).tap();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: 'Cerrar' }).tap();
      await page.getByRole('combobox', { name: 'Idioma' }).selectOption('en');
      await expect(prompt).toContainText('Turn your phone sideways');
      await shot(page, info.outputPath('portrait-prompt-en.png'));

      // Sideways again: the prompt goes, the flight waits for the player.
      await page.setViewportSize({ width: size.width, height: size.height });
      await expect(prompt).toHaveCount(0);
      await expect(page.locator('#phase')).toHaveText('Paused. Tap Resume.');
      await page.getByRole('button', { name: 'Resume' }).tap();
      await expect(page.locator('#phase')).toBeEmpty();
      await expect(page.locator('gravitas-touch-controls')).toBeVisible();
      // Results are usable upright too: crash (no input), then turn the phone.
      await expect(page.locator('#report')).toBeVisible({ timeout: 30_000 });
      await page.setViewportSize({ width: size.height, height: size.width });
      await expect(page.locator('#report')).toBeInViewport();
      await expect(page.getByRole('button', { name: 'Try again' })).toBeInViewport();
      await shot(page, info.outputPath('portrait-results-en.png'));
      await expect(prompt).toHaveCount(0);
    });

    test('page zoom is blocked while the 3D view keeps its own pinch', async ({ page }, info) => {
      await openPhone(page, info.project.name);
      const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
      expect(viewport).toContain('user-scalable=no');
      expect(viewport).toContain('maximum-scale=1');
      expect(viewport).toContain('viewport-fit=cover');
      expect(await page.locator('main').evaluate((e) => getComputedStyle(e).touchAction)).toBe(
        'none',
      );
      expect(
        await page.evaluate(() => getComputedStyle(document.documentElement).touchAction),
      ).toBe('manipulation');
      // iOS's proprietary pinch events and a double tap outside controls are cancelled.
      const prevented = await page.evaluate(() => {
        const gesture = new Event('gesturestart', { cancelable: true });
        document.dispatchEvent(gesture);
        const tap = () => {
          const event = new TouchEvent('touchend', { cancelable: true, bubbles: true });
          document.querySelector('#viewport')!.dispatchEvent(event);
          return event.defaultPrevented;
        };
        const first = tap();
        const second = tap();
        const button = document
          .querySelector('gravitas-flight-hud')!
          .shadowRoot!.querySelector('button')!;
        const onButton = new TouchEvent('touchend', {
          cancelable: true,
          bubbles: true,
          composed: true,
        });
        button.dispatchEvent(onButton);
        return {
          gesture: gesture.defaultPrevented,
          first,
          second,
          button: onButton.defaultPrevented,
        };
      });
      expect(prevented).toEqual({ gesture: true, first: false, second: true, button: false });
      // A real two-finger pinch on the scene zooms the camera, never the page.
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.synthesizePinchGesture', {
        x: size.width / 2,
        y: size.height / 2,
        scaleFactor: 2,
        gestureSourceType: 'touch',
      });
      await page.waitForTimeout(300);
      expect(await page.evaluate(() => visualViewport?.scale ?? 1)).toBe(1);
    });

    test('the notch and home indicator are kept clear', async ({ page }, info) => {
      await openPhone(page, info.project.name, 'es-AR');
      try {
        await safeArea(page, { left: 59, right: 59, bottom: 21 });
      } catch {
        test.skip(true, 'This Chromium cannot emulate safe-area insets.');
      }
      await page.getByRole('button', { name: 'Comenzar', exact: true }).tap();
      const hud = page.locator('gravitas-flight-hud');
      const controls = page.locator('gravitas-touch-controls');
      await expect(controls).toBeVisible();
      await page.waitForTimeout(300);
      const readouts = await box(hud.locator('.flight-panel'));
      const nav = await box(hud.locator('nav'));
      const lever = await box(controls.getByTestId('touch-lever'));
      const radar = await box(hud.locator('.navigation-panel'));
      expect(readouts.x).toBeGreaterThanOrEqual(59);
      expect(lever.x).toBeGreaterThanOrEqual(59);
      expect(nav.x + nav.width).toBeLessThanOrEqual(size.width - 59);
      expect(radar.y + radar.height).toBeLessThanOrEqual(size.height - 21);
      expect(lever.y + lever.height).toBeLessThanOrEqual(size.height - 21);
      await shot(page, info.outputPath('safe-area.png'));
    });

    test.describe('without WebGPU', () => {
      test.use({
        allowedMessages: {
          patterns: [
            /^THREE\.WebGPURenderer: WebGPU is not available, running under WebGL2 backend\.$/,
          ],
        },
      });
      test('auto falls back to WebGL 2 when WebGPU is unavailable', async ({ page }) => {
        await page.addInitScript(() => {
          Object.defineProperty(Navigator.prototype, 'gpu', {
            get: () => undefined,
            configurable: true,
          });
        });
        await page.goto('http://127.0.0.1:4173/gravitas/?lang=en');
        await expect(page.locator('#viewport')).toHaveAttribute('data-backend', 'webgl2');
        await page.getByRole('button', { name: 'Start', exact: true }).tap();
        await expect(page.locator('gravitas-touch-controls')).toBeVisible();
        await expect
          .poll(async () =>
            Number((await page.getByTestId('altitude').textContent())?.replace(/[^0-9.]/g, '')),
          )
          .toBeLessThan(79);
      });
    });
  });
}

test.describe('a short landscape window without touch (800 × 420)', () => {
  test.use({ viewport: { width: 800, height: 420 } });

  test('the start card no longer overlaps the instruments, and flight keeps them', async ({
    page,
  }, info) => {
    await openPhone(page, info.project.name);
    const hud = page.locator('gravitas-flight-hud');
    const card = await box(page.getByRole('complementary', { name: 'How to fly' }));
    inside(card, 800, 420, 'start card');
    inside(await box(page.getByRole('button', { name: 'Start', exact: true })), 800, 420, 'Start');
    await expect(hud.locator('.instruments')).toBeHidden();
    await shot(page, info.outputPath('ready-800x420.png'));
    await page.keyboard.press('p');
    await expect(hud.locator('.instruments')).toBeVisible();
    await expect(page.locator('gravitas-touch-controls')).toBeHidden();
    for (const selector of ['.flight-panel', '.navigation-panel']) {
      inside(await box(hud.locator(selector)), 800, 420, selector);
    }
    await shot(page, info.outputPath('flying-800x420.png'));
  });
});
