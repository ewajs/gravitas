import type { TouchControls } from '@gravitas/ui';
import { centre, Fingers, openPhone, PHONES, reading } from './phone';
import { test, expect } from './test';

for (const [name, size] of Object.entries(PHONES)) {
  test.describe(`touch controls on an emulated ${name}`, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: size.deviceScaleFactor,
      isMobile: true,
      hasTouch: true,
    });

    test('lever, stick, and yaw work at once and release cleanly', async ({ page }, info) => {
      await openPhone(page, info.project.name);
      const card = page.getByRole('complementary', { name: 'How to fly' });
      await expect(card).toContainText('Left thumb');
      const controls = page.locator('gravitas-touch-controls');
      await expect(controls).toBeHidden(); // Only during a flight.
      await page.getByRole('button', { name: 'Start', exact: true }).tap();
      await expect(page.locator('#phase')).toBeEmpty();
      await expect(controls).toBeVisible();
      const fingers = await Fingers.on(page);

      // The lever does not jump to the thumb: touching it changes nothing.
      const lever = await centre(page, 'touch-lever');
      await fingers.down(1, lever.x, lever.y);
      await page.waitForTimeout(200);
      expect(await reading(page, 'throttle')).toBe(0);
      // Slide up 85% of the track, relative to the grab: enough to climb while leaning.
      const track = (await page
        .locator('gravitas-touch-controls')
        .locator('.track')
        .boundingBox())!;
      await fingers.move(1, lever.x, lever.y - track.height * 0.85);
      await expect.poll(() => reading(page, 'throttle')).toBeGreaterThanOrEqual(80);

      // Second finger, upright: a left yaw swings the heading-up radar's pad right.
      const yaw = await centre(page, 'touch-yaw-left');
      const padBefore = Number(await page.getByTestId('radar-pad').getAttribute('data-x'));
      await fingers.down(3, yaw.x, yaw.y);
      await expect(page.getByTestId('touch-yaw-left')).toHaveClass(/pressed/);
      await expect
        .poll(async () => Number(await page.getByTestId('radar-pad').getAttribute('data-x')))
        .toBeGreaterThan(padBefore + 3);
      await fingers.up(3);
      await expect(page.getByTestId('touch-yaw-left')).not.toHaveClass(/pressed/);

      // The stick appears where its thumb lands; pushed up, thrust leans forward.
      const zone = (await page.getByTestId('touch-stick-zone').boundingBox())!;
      const stickAt = { x: zone.x + zone.width * 0.55, y: zone.y + zone.height * 0.6 };
      await fingers.down(2, stickAt.x, stickAt.y);
      await expect(page.getByTestId('touch-stick')).toBeVisible();
      await fingers.move(2, stickAt.x, stickAt.y - 60);
      await expect
        .poll(async () => Number(await page.getByTestId('radar-lean').getAttribute('data-y')))
        .toBeLessThan(-3);
      await page.screenshot({ path: info.outputPath('touch-flying.png') });
      await fingers.up(2);
      await expect(page.getByTestId('touch-stick')).toHaveCount(0);

      // The lever stays where the thumb left it (non-centering).
      const held = await reading(page, 'throttle');
      await fingers.up(1);
      await page.waitForTimeout(300);
      await expect(page.locator('#phase')).toBeEmpty(); // Still flying.
      expect(await reading(page, 'throttle')).toBe(held);
      expect(held).toBeGreaterThanOrEqual(80);
    });

    test('the lever snaps to the hover detent', async ({ page }, info) => {
      await openPhone(page, info.project.name);
      await page.getByRole('button', { name: 'Start', exact: true }).tap();
      const fingers = await Fingers.on(page);
      const lever = await centre(page, 'touch-lever');
      const track = (await page
        .locator('gravitas-touch-controls')
        .locator('.track')
        .boundingBox())!;
      const hover = Number(
        await page
          .locator('gravitas-touch-controls')
          .evaluate((element: TouchControls) => element.hoverThrottle),
      );
      await fingers.down(1, lever.x, lever.y);
      // Aim 2% short of hover: inside the detent, so it lands exactly on hover.
      await fingers.move(1, lever.x, lever.y - track.height * (hover - 0.02));
      const slider = page.getByRole('slider', { name: 'Throttle' });
      await expect(slider).toHaveAttribute('aria-valuenow', String(Math.round(hover * 100)));
      await expect(page.getByTestId('touch-detent')).toHaveClass(/\bon\b/);
      await fingers.up(1);
    });

    test('a cancelled touch, blur, or hidden page leave nothing held', async ({ page }, info) => {
      await openPhone(page, info.project.name);
      await page.getByRole('button', { name: 'Start', exact: true }).tap();
      const fingers = await Fingers.on(page);
      const zone = (await page.getByTestId('touch-stick-zone').boundingBox())!;
      const at = { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 };
      for (const release of ['cancel', 'blur', 'hidden'] as const) {
        await fingers.down(1, at.x, at.y);
        await fingers.move(1, at.x + 50, at.y);
        await expect(page.getByTestId('touch-stick')).toBeVisible();
        if (release === 'cancel') await fingers.cancel();
        else {
          await page.evaluate((hide) => {
            if (hide) {
              Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
              document.dispatchEvent(new Event('visibilitychange'));
            } else window.dispatchEvent(new Event('blur'));
          }, release === 'hidden');
          await fingers.cancel();
        }
        await expect(page.getByTestId('touch-stick')).toHaveCount(0);
      }
      // Rolling stopped: attitude assist brakes once nothing is held.
      let previous = Number.NaN;
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await expect(page.locator('#phase')).toHaveText('Paused. Tap Resume.');
      await page.getByRole('button', { name: 'Resume', exact: true }).tap();
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
    });
  });
}
