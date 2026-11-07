import { centre, openPhone, PHONES, reading } from './phone';
import { test, expect } from './test';

test.describe('touch controls follow the device and the setting', () => {
  const phone = PHONES['iPhone 15 Pro installed']!;
  test.use({
    viewport: { width: phone.width, height: phone.height },
    deviceScaleFactor: phone.deviceScaleFactor,
    isMobile: true,
    hasTouch: true,
  });

  test('keys hide them, a touch brings them back, and Never persists', async ({ page }, info) => {
    await openPhone(page, info.project.name, 'es-AR');
    const controls = page.locator('gravitas-touch-controls');
    // A phone starts with touch help, in Spanish too.
    await expect(page.getByRole('complementary', { name: 'Cómo volar' })).toContainText(
      'Pulgar izq.',
    );
    await expect(page.locator('#phase')).toHaveText('Listo para descender. Tocá Comenzar.');
    await page.screenshot({ path: info.outputPath('touch-ready-es.png') });
    await page.getByRole('button', { name: 'Comenzar', exact: true }).tap();
    await expect(controls).toBeVisible();
    await page.keyboard.down('w');
    await expect(controls).toBeHidden();
    await page.keyboard.up('w');
    await page.touchscreen.tap(phone.width / 2, phone.height / 2);
    await expect(controls).toBeVisible();

    // On a phone the view options and Help live in the ⋯ menu. Opening the menu
    // pauses (the controls stay, inert); Help lists the touch controls.
    await page.getByRole('button', { name: 'Menú' }).tap();
    await expect(controls).toHaveAttribute('disabled', '');
    await page.getByRole('button', { name: 'Ayuda', exact: true }).tap();
    const dialog = page.getByRole('dialog', { name: 'Controles de vuelo' });
    await expect(dialog).toContainText('el control aparece donde tocás');
    await expect(controls).toHaveAttribute('disabled', '');
    await dialog.getByRole('combobox', { name: 'Controles táctiles' }).selectOption('never');
    await page.screenshot({ path: info.outputPath('touch-help-es.png') });
    await dialog.getByRole('button', { name: 'Cerrar' }).tap();
    await expect(controls).toBeHidden();
    await page.reload();
    await expect(page.locator('#viewport')).toHaveAttribute('data-backend', info.project.name);
    await page.getByRole('button', { name: 'Comenzar', exact: true }).tap();
    await page.touchscreen.tap(phone.width / 2, phone.height / 2);
    await expect(page.locator('#phase')).toBeEmpty();
    await expect(controls).toBeHidden(); // Never, remembered.
  });
});

test('Always shows them on a desktop, and a mouse can drag the lever', async ({ page }, info) => {
  const backend = info.project.name === 'webgl2' ? 'webgl2' : 'auto';
  await page.goto(`http://127.0.0.1:4173/gravitas/?backend=${backend}&lang=en`);
  await expect(page.locator('#viewport')).toHaveAttribute('data-backend', info.project.name);
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Touch controls' }).selectOption('always');
  await dialog.getByRole('button', { name: 'Close' }).click();
  const controls = page.locator('gravitas-touch-controls');
  await expect(controls).toBeHidden(); // Only during a flight.
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(controls).toBeVisible();
  const lever = await centre(page, 'touch-lever');
  await page.mouse.move(lever.x, lever.y);
  await page.mouse.down();
  await page.mouse.move(lever.x, lever.y - 60, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => reading(page, 'throttle')).toBeGreaterThan(10);
  // The keyboard still works beside them, and does not hide them under Always.
  await page.keyboard.press('x');
  await expect(page.getByTestId('throttle')).toHaveText('0%');
  await expect(controls).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Throttle' })).toHaveAttribute(
    'aria-valuenow',
    '0',
  );
  // A right-click never starts a drag (its menu can swallow the release).
  const zone = (await controls.getByTestId('touch-stick-zone').boundingBox())!;
  await page.mouse.click(zone.x + zone.width / 2, zone.y + zone.height / 2, { button: 'right' });
  await expect(controls.getByTestId('touch-stick')).toHaveCount(0);
  // The yaw buttons also hold from the keyboard (Space), and release on key up.
  const yawLeft = controls.getByTestId('touch-yaw-left');
  await yawLeft.focus();
  await page.keyboard.down(' ');
  await expect(yawLeft).toHaveClass(/pressed/);
  await page.keyboard.up(' ');
  await expect(yawLeft).not.toHaveClass(/pressed/);
  // Named controls; motion follows the 4.2 rules and stops for reduced motion.
  await expect(page.getByRole('button', { name: 'Turn left' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Turn right' })).toBeVisible();
  await expect(page.getByRole('group', { name: /^Tilt stick/ })).toBeVisible();
  const grip = controls.locator('.grip');
  const transition = () => grip.evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(await transition()).toBe('0.2s');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await transition()).toBe('0s');
});

test.describe('on a short phone screen (browser bars showing)', () => {
  test.use({ viewport: { width: 852, height: 330 }, isMobile: true, hasTouch: true });

  test('the yaw buttons stay below the header buttons', async ({ page }, info) => {
    await openPhone(page, info.project.name);
    await page.getByRole('button', { name: 'Start', exact: true }).tap();
    const controls = page.locator('gravitas-touch-controls');
    await expect(controls).toBeVisible();
    const menu = (await page.getByRole('button', { name: 'Menu' }).boundingBox())!;
    for (const id of ['touch-yaw-left', 'touch-yaw-right']) {
      const yaw = (await controls.getByTestId(id).boundingBox())!;
      expect(yaw.y, id).toBeGreaterThanOrEqual(menu.y + menu.height);
    }
    const zone = (await controls.getByTestId('touch-stick-zone').boundingBox())!;
    const yaw = (await controls.getByTestId('touch-yaw-left').boundingBox())!;
    expect(zone.y).toBeGreaterThanOrEqual(yaw.y + yaw.height);
  });
});
