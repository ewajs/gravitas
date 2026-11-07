import type { Page } from '@playwright/test';
import type { FlightHud } from '@gravitas/ui';
import {
  box,
  expectClearCentre,
  hudParts,
  inside,
  overflowing,
  overlaps,
  type Box,
} from './layout';
import { centre, emulateInsets, Fingers, openPhone, PHONES, PORTRAIT, type Phone } from './phone';
import { test, expect } from './test';

const t = (lang: string, es: string, en: string) => (lang === 'en' ? en : es);

// Screenshots for review wait out the 200–280 ms entrances, so cards are opaque.
async function shot(page: Page, path: string) {
  await page.waitForTimeout(450);
  await page.screenshot({ path });
}

async function expectNoOverflow(page: Page, state: string) {
  // Entrances (fade, rise) are transforms; wait them out so boxes are final.
  await page.waitForTimeout(350);
  expect(await overflowing(page), `nothing overflows while ${state}`).toEqual([]);
}

async function open(page: Page, project: string, phone: Phone, lang: string) {
  await openPhone(page, project, lang);
  if (!(await emulateInsets(page, phone.insets)))
    test.skip(true, 'This Chromium cannot emulate safe-area insets.');
}

const REPORT = {
  verdict: 'landed-off-pad',
  checks: [
    { id: 'vertical-speed', value: 1.2, limit: 2, pass: true },
    { id: 'horizontal-speed', value: 0.4, limit: 1, pass: true },
    { id: 'tilt', value: 0.05, limit: (10 * Math.PI) / 180, pass: true },
    { id: 'pad-distance', value: 6.2, limit: 3.8, pass: false },
  ],
  fuel: 0.31,
  flightTime: 41,
} as const;

for (const [name, size] of Object.entries(PHONES)) {
  test.describe(`phone layout on an emulated ${name} (${size.width} × ${size.height})`, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: size.deviceScaleFactor,
      isMobile: true,
      hasTouch: true,
    });
    // Phone-resolution screenshots are slow on the software-paced WebGL 2 project.
    test.slow();
    const insets = size.insets ?? { left: 0, right: 0, bottom: 0 };

    for (const lang of ['es-AR', 'en']) {
      test(`corner chips keep the centre and both thumb zones clear (${lang})`, async ({
        page,
      }, info) => {
        await open(page, info.project.name, size, lang);
        const hud = page.locator('gravitas-flight-hud');
        const controls = page.locator('gravitas-touch-controls');
        await expect(hud).toHaveAttribute('touch-layout', '');

        // Ready, first visit: the start card and Start fit, nothing behind them.
        const card = page.getByRole('complementary', { name: t(lang, 'Cómo volar', 'How to fly') });
        const start = page.getByRole('button', { name: t(lang, 'Comenzar', 'Start'), exact: true });
        inside(await box(card), size.width, size.height, 'start card');
        inside(await box(start), size.width, size.height, 'Start');
        await expect(hud.locator('.instruments')).toBeHidden();
        await expectNoOverflow(page, 'ready with the start card');
        await shot(page, info.outputPath(`ready-card-${lang}.png`));

        // Ready, returning: the same corner layout as in flight, Start in the top band.
        await hud.evaluate((element: FlightHud) => {
          element.showControls = false;
        });
        await expect(hud.locator('.flight-panel')).toBeVisible();
        await expect(hud.getByRole('combobox')).toBeHidden(); // In the ⋯ menu.
        await expectClearCentre(page, 'ready');
        await expectNoOverflow(page, 'ready');
        const readyParts = await hudParts(page);
        const startBox = await box(start);
        for (const [label, part] of Object.entries(readyParts))
          if (!label.startsWith('button.primary'))
            expect(overlaps(part, startBox), `Start clear of ${label}`).toBe(false);
        await shot(page, info.outputPath(`ready-${lang}.png`));

        await start.tap();
        await expect(controls).toBeVisible();
        await expect(hud).toHaveAttribute('touch-controls', '');
        // Full throttle with the lever, so a slow renderer cannot crash mid-test.
        const fingers = await Fingers.on(page);
        const grip = await centre(page, 'touch-lever');
        await fingers.down(1, grip.x, grip.y);
        await fingers.move(1, grip.x, grip.y - size.height);
        await fingers.up(1);
        await page.waitForTimeout(300);

        const lever = await box(controls.getByTestId('touch-lever'));
        const stickZone = await box(controls.getByTestId('touch-stick-zone'));
        const leverZone = await box(controls.getByTestId('touch-lever-zone'));
        const yaw = [
          await box(controls.getByTestId('touch-yaw-left')),
          await box(controls.getByTestId('touch-yaw-right')),
        ];
        const pause = await box(hud.getByRole('button', { name: t(lang, 'Pausar', 'Pause') }));
        const menu = await box(hud.getByRole('button', { name: t(lang, 'Menú', 'Menu') }));
        const panels = {
          readouts: await box(hud.locator('.flight-panel')),
          radar: await box(hud.locator('.navigation-panel')),
          pause,
          menu,
        };
        for (const [label, panel] of Object.entries(panels)) {
          inside(panel, size.width, size.height, label);
          expect(overlaps(panel, lever), `${label} clear of the lever`).toBe(false);
          expect(overlaps(panel, leverZone), `${label} clear of the lever zone`).toBe(false);
          expect(overlaps(panel, stickZone), `${label} clear of the stick zone`).toBe(false);
          for (const button of yaw)
            expect(overlaps(panel, button), `${label} clear of yaw`).toBe(false);
        }
        expect(overlaps(panels.readouts, pause), 'readouts and buttons').toBe(false);
        // Corners: readouts top left, pause and ⋯ top right, the radar card under
        // them, and the yaw column just left of the radar card.
        expect(panels.readouts.x).toBeLessThan(size.width / 3);
        expect(panels.radar.x).toBeGreaterThan((2 * size.width) / 3);
        expect(panels.radar.y).toBeGreaterThanOrEqual(menu.y + menu.height);
        for (const button of yaw) {
          inside(button, size.width, size.height, 'yaw button');
          expect(button.width, '40 px yaw buttons').toBeCloseTo(40, 0);
          expect(button.x + button.width).toBeLessThanOrEqual(panels.radar.x);
          expect(panels.radar.x - (button.x + button.width)).toBeLessThan(16);
          expect(button.y).toBeGreaterThanOrEqual(pause.y + pause.height);
        }
        expect(yaw[1]!.y, 'yaw buttons in a column').toBeGreaterThan(
          yaw[0]!.y + yaw[0]!.height - 1,
        );
        inside(lever, size.width, size.height, 'lever');
        // Safe areas: clear of the notch and the home indicator when installed.
        expect(panels.readouts.x).toBeGreaterThanOrEqual(insets.left);
        expect(lever.x).toBeGreaterThanOrEqual(insets.left);
        expect(menu.x + menu.width).toBeLessThanOrEqual(size.width - insets.right);
        expect(panels.radar.x + panels.radar.width).toBeLessThanOrEqual(size.width - insets.right);
        expect(lever.y + lever.height).toBeLessThanOrEqual(size.height - insets.bottom);
        await expect(hud.getByTestId('pad-distance')).toBeVisible();
        await expectClearCentre(page, 'flying');
        await expectNoOverflow(page, 'flying');
        await shot(page, info.outputPath(`flying-${lang}.png`));

        await hud.getByRole('button', { name: t(lang, 'Pausar', 'Pause') }).tap();
        await expect(controls).toHaveAttribute('disabled', '');
        await expectClearCentre(page, 'paused');
        await expectNoOverflow(page, 'paused');
        await shot(page, info.outputPath(`paused-${lang}.png`));
        // Paused, so the snapshot stays. The widest values (three-digit altitude, a
        // fast sink with the caution, a full tank) keep the card to its lines.
        const readouts = hud.locator('.flight-panel');
        const height = (await box(readouts)).height;
        await hud.evaluate((element: FlightHud) => {
          element.telemetry = {
            ...element.telemetry!,
            altitude: 123.4,
            verticalSpeed: -13.5,
            safeSink: 2,
            horizontalSpeed: 12.3,
            tilt: 0.78,
            fuel: 1,
          };
        });
        await expect(hud.getByTestId('sink-scale')).toBeVisible(); // A thin bar here.
        await expect(
          hud.getByRole('img', { name: /faster than the safe sink|más rápido/i }),
        ).toBeVisible();
        const wide = await box(readouts);
        expect(wide.height, 'the readout card never wraps').toBeLessThan(height + 4);
        expect(await hud.locator('.details').evaluate((e) => e.clientHeight)).toBeLessThan(20);
        expect(overlaps(wide, leverZone), 'card clear of the lever zone').toBe(false);
        expect(overlaps(wide, await box(hud.locator('#phase'))), 'card clear of the phase').toBe(
          false,
        );
        await expectNoOverflow(page, 'paused with the widest readouts');
        await shot(page, info.outputPath(`widest-${lang}.png`));

        // The ⋯ menu: language, sound, restart, and Help, reachable and on screen.
        const toggle = hud.getByRole('button', { name: t(lang, 'Menú', 'Menu') });
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await toggle.tap();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        const group = hud.getByRole('group', { name: t(lang, 'Menú', 'Menu') });
        await expect(
          group.getByRole('combobox', { name: t(lang, 'Idioma', 'Language') }),
        ).toBeVisible();
        await expect(
          group.getByRole('button', { name: t(lang, 'Silenciar', 'Mute') }),
        ).toBeVisible();
        await expect(
          group.getByRole('button', { name: t(lang, 'Reiniciar', 'Restart') }),
        ).toBeVisible();
        inside(await box(group), size.width, size.height, 'menu');
        await expectNoOverflow(page, 'the menu is open');
        await shot(page, info.outputPath(`menu-${lang}.png`));
        await group.getByRole('button', { name: t(lang, 'Ayuda', 'Help'), exact: true }).tap();
        const dialog = page.getByRole('dialog');
        await expect(group).toBeHidden();
        inside(await box(dialog), size.width, size.height, 'Help');
        await expectNoOverflow(page, 'Help is open');
        await shot(page, info.outputPath(`help-${lang}.png`));
        // A finger scrolls Help inside itself (the page itself never pans).
        const help = await box(dialog);
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Input.synthesizeScrollGesture', {
          x: help.x + help.width / 2,
          y: help.y + help.height * 0.7,
          yDistance: -250,
          gestureSourceType: 'touch',
        });
        await expect.poll(() => dialog.evaluate((e) => e.scrollTop)).toBeGreaterThan(50);
        expect(await page.evaluate(() => [scrollX, scrollY])).toEqual([0, 0]);
        const last = dialog.getByRole('combobox', {
          name: t(lang, 'Controles táctiles', 'Touch controls'),
        });
        await last.scrollIntoViewIfNeeded();
        await expect(last).toBeInViewport();
        await dialog.getByRole('button', { name: t(lang, 'Cerrar', 'Close') }).tap();
        await expect(dialog).toBeHidden();
        await expect(toggle).toBeFocused(); // Back where Help came from.
      });

      test(`the results card sits over the same layout (${lang})`, async ({ page }, info) => {
        await open(page, info.project.name, size, lang);
        const hud = page.locator('gravitas-flight-hud');
        await hud.evaluate((element: FlightHud, report) => {
          element.showControls = false;
          element.report = report;
          element.phase = 'complete';
        }, REPORT);
        const report = page.locator('#report');
        await expect(report).toBeVisible();
        inside(await box(report), size.width, size.height, 'results card');
        const retry = report.getByRole('button', { name: t(lang, 'Reintentar', 'Try again') });
        await retry.scrollIntoViewIfNeeded();
        await expect(retry).toBeInViewport();
        // Two columns: the checks beside the verdict.
        const verdict = await box(report.locator('.verdict'));
        const checks = await box(report.locator('.checks'));
        expect(checks.x).toBeGreaterThan(verdict.x + verdict.width - 1);
        // Behind it, the corner chips, not the desktop panels.
        await expect(hud).toHaveAttribute('touch-layout', '');
        const readouts: Box = await box(hud.locator('.flight-panel'));
        expect(readouts.y).toBeLessThan(size.height / 3);
        expect(readouts.width).toBeLessThan(size.width / 3 + 20);
        expect((await box(hud.locator('.navigation-panel'))).width).toBeLessThan(100);
        await expect(hud.locator('header nav')).toBeHidden();
        await expectNoOverflow(page, 'the results card shows');
        await shot(page, info.outputPath(`results-${lang}.png`));
      });
    }

    test('page zoom is blocked while the 3D view keeps its own pinch', async ({ page }, info) => {
      await openPhone(page, info.project.name);
      const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
      expect(viewport).toContain('user-scalable=no');
      expect(viewport).toContain('maximum-scale=1');
      expect(viewport).toContain('viewport-fit=cover');
      expect(await page.locator('#viewport').evaluate((e) => getComputedStyle(e).touchAction)).toBe(
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

for (const [name, size] of Object.entries(PORTRAIT)) {
  const landscape = PHONES[size.landscape]!;
  test.describe(`upright on an emulated ${name} (${size.width} × ${size.height})`, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: size.deviceScaleFactor,
      isMobile: true,
      hasTouch: true,
    });
    test.slow();

    for (const lang of ['es-AR', 'en']) {
      test(`the start screen wraps, hints to turn, and shows no instruments (${lang})`, async ({
        page,
      }, info) => {
        await openPhone(page, info.project.name, lang);
        const hud = page.locator('gravitas-flight-hud');
        const card = page.getByRole('complementary', { name: t(lang, 'Cómo volar', 'How to fly') });
        inside(await box(card), size.width, size.height, 'start card');
        expect(await card.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
        const hint = hud.locator('.turn-hint');
        await expect(hint).toBeVisible();
        await expect(hint).toContainText(t(lang, 'Girá el teléfono', 'Turn your phone'));
        inside(await box(hint), size.width, size.height, 'turn hint');
        const start = page.getByRole('button', { name: t(lang, 'Comenzar', 'Start'), exact: true });
        inside(await box(start), size.width, size.height, 'Start');
        await expect(hud.locator('.instruments')).toBeHidden();
        await expect(hud.locator('.identity')).toBeVisible();
        await expect(hud.getByRole('button', { name: t(lang, 'Menú', 'Menu') })).toBeVisible();
        await expect(hud.locator('header nav')).toBeHidden();
        await expectNoOverflow(page, 'upright before the start');
        await shot(page, info.outputPath(`portrait-ready-card-${lang}.png`));
        await hud.evaluate((element: FlightHud) => {
          element.showControls = false;
        });
        await expect(hud.locator('.instruments')).toBeHidden();
        await expectNoOverflow(page, 'upright, ready without the card');
        // Results upright: the card, no instruments behind it.
        await hud.evaluate((element: FlightHud, report) => {
          element.report = report;
          element.phase = 'complete';
        }, REPORT);
        await expect(page.locator('#report')).toBeInViewport();
        await expect(hud.locator('.instruments')).toBeHidden();
        await expectNoOverflow(page, 'upright with the results');
        await shot(page, info.outputPath(`portrait-results-${lang}.png`));
      });
    }

    test('a flight asks to turn the phone, pauses, and leaves the menu usable', async ({
      page,
    }, info) => {
      await openPhone(page, info.project.name, 'es-AR');
      const prompt = page.getByTestId('rotate-prompt');
      await expect(prompt).toHaveCount(0);
      await page.getByRole('button', { name: 'Comenzar', exact: true }).tap();
      await expect(prompt).toBeVisible();
      await expect(prompt).toContainText('Girá el teléfono');
      await expect(page.locator('#phase')).toHaveText('En pausa. Tocá Reanudar.');
      await expect(page.locator('gravitas-touch-controls')).toBeHidden();
      await expectNoOverflow(page, 'the rotate prompt shows');
      await shot(page, info.outputPath('portrait-prompt-es.png'));
      // Resuming upright pauses again at once.
      await page.getByRole('button', { name: 'Reanudar' }).tap();
      await expect(page.locator('#phase')).toHaveText('En pausa. Tocá Reanudar.');
      const altitude = await page.getByTestId('altitude').textContent();
      await page.waitForTimeout(500);
      await expect(page.getByTestId('altitude')).toHaveText(altitude!);
      // Help and the language, through the menu.
      const toggle = page.getByRole('button', { name: 'Menú' });
      await toggle.tap();
      await page.getByRole('button', { name: 'Ayuda', exact: true }).tap();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expectNoOverflow(page, 'Help is open upright');
      await page.getByRole('button', { name: 'Cerrar' }).tap();
      await toggle.tap();
      await page.getByRole('combobox', { name: 'Idioma' }).selectOption('en');
      await expect(prompt).toContainText('Turn your phone sideways');
      await page.keyboard.press('Escape'); // Closes the menu.
      await expect(page.getByRole('group', { name: 'Menu' })).toBeHidden();
      await expect(page.getByRole('button', { name: 'Menu' })).toBeFocused();
      await shot(page, info.outputPath('portrait-prompt-en.png'));

      // Sideways again: the prompt goes, the flight waits for the player.
      await page.setViewportSize({ width: landscape.width, height: landscape.height });
      await expect(prompt).toHaveCount(0);
      await expect(page.locator('#phase')).toHaveText('Paused. Tap Resume.');
      await page.getByRole('button', { name: 'Resume' }).tap();
      await expect(page.locator('#phase')).toBeEmpty();
      await expect(page.locator('gravitas-touch-controls')).toBeVisible();
      // Results are usable upright too: crash (no input), then turn the phone.
      await expect(page.locator('#report')).toBeVisible({ timeout: 30_000 });
      // After a real verdict on a phone, the corner layout stays behind the card.
      await expect(page.locator('gravitas-flight-hud')).toHaveAttribute('touch-layout', '');
      await expect(page.locator('gravitas-flight-hud').locator('header nav')).toBeHidden();
      await page.setViewportSize({ width: size.width, height: size.height });
      await expect(page.locator('#report')).toBeInViewport();
      await expect(page.getByRole('button', { name: 'Try again' })).toBeInViewport();
      await shot(page, info.outputPath('portrait-results-en.png'));
      await expect(prompt).toHaveCount(0);
    });
  });
}

test.describe('a tablet keeps its layout (1180 × 820, touch)', () => {
  test.use({
    viewport: { width: 1180, height: 820 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  test('the readout strip and view options, not the phone corners', async ({ page }, info) => {
    await openPhone(page, info.project.name);
    const hud = page.locator('gravitas-flight-hud');
    await expect(hud).toHaveAttribute('touch-layout', '');
    // Before the start: the desktop panels and header, no ⋯ menu.
    await expect(hud.locator('header nav')).toBeVisible();
    await expect(hud.getByRole('button', { name: 'Menu' })).toBeHidden();
    await page.getByRole('button', { name: 'Start', exact: true }).tap();
    await expect(page.locator('gravitas-touch-controls')).toBeVisible();
    // Flying: the 4.4a strip along the top and the radar between the thumbs.
    const strip = await box(hud.locator('.flight-panel'));
    const radar = await box(hud.locator('.navigation-panel'));
    expect(strip.y).toBeLessThan(40);
    expect(radar.y + radar.height).toBeGreaterThan(820 - 40);
    expect(radar.x).toBeGreaterThan(1180 * 0.25);
    await expect(hud.locator('header nav')).toBeVisible();
    await shot(page, info.outputPath('tablet-flying.png'));
  });
});

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
    // Without touch, the desktop panels and view options, not the phone layout.
    await expect(hud).not.toHaveAttribute('touch-layout', '');
    await expect(hud.locator('header nav')).toBeVisible();
    for (const selector of ['.flight-panel', '.navigation-panel']) {
      inside(await box(hud.locator(selector)), 800, 420, selector);
    }
    await shot(page, info.outputPath('flying-800x420.png'));
  });
});
