import { centre, openPhone, PHONES, reading } from './phone';
import { test, expect } from './test';

test.describe('touch controls follow the device and the setting', () => {
  const phone = PHONES['iPhone 15 Pro'];
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

    // Help pauses (the controls stay, inert) and lists the touch controls.
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
