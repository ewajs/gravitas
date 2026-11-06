import { test, expect } from './test';
import type { InspectionHud } from '@gravitas/ui';

function appUrl(project: string) {
  return `http://127.0.0.1:4173/gravitas/?backend=${project === 'webgl2' ? 'webgl2' : 'auto'}`;
}

test('locale switching preserves the canvas, camera, and pose while translating all visible UI', async ({
  page,
}, info) => {
  await page.goto(appUrl(info.project.name));
  const host = page.locator('#viewport');
  const hud = page.locator('gravitas-inspection-hud');
  await expect(host).toHaveAttribute('data-backend', info.project.name);
  // Exercise real nonzero presentation data, without introducing a simulation fixture into the app.
  await hud.evaluate((element: InspectionHud) => {
    element.pose = {
      position: { x: 3, y: 40, z: 4 },
      orientation: { x: 0.5, y: 0, z: 0, w: Math.sqrt(3) / 2 },
    };
  });
  await expect(page.getByTestId('offset')).toHaveText('5,0 m');
  await expect(page.getByTestId('tilt')).toHaveText('60,0°');
  await page.mouse.move(450, 300);
  await page.mouse.down();
  await page.mouse.move(520, 340, { steps: 8 });
  await page.mouse.up();
  const canvas = await page.locator('canvas').elementHandle();
  // Sample an unobscured central scene region; UI text changes must not reset its camera.
  const scene = { x: 300, y: 180, width: 400, height: 330 };
  const before = await page.screenshot({ clip: scene });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/assets/en-*.js', async (route) => {
    await gate;
    await route.continue();
  });
  const language = page.getByRole('combobox', { name: 'Idioma' });
  try {
    await language.focus();
    await language.selectOption('en');
    await expect(language).toHaveAttribute('aria-busy', 'true');
    await expect(language).toBeFocused();
  } finally {
    release();
  }
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('combobox', { name: 'Language' })).toHaveValue('en');
  await expect(page.getByRole('combobox', { name: 'Language' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Help', exact: true })).toBeVisible();
  await expect(page.locator('#subtitle')).toHaveText('Inspection view');
  await expect(page.locator('#controls')).toContainText('Drag to orbit');
  await expect(page.getByTestId('offset')).toHaveText('5.0 m');
  await expect(page.getByTestId('tilt')).toHaveText('60.0°');
  await expect(page.locator('canvas')).toHaveAttribute(
    'aria-label',
    'A lunar lander on a landing pad.',
  );
  expect(await canvas!.evaluate((element) => element === document.querySelector('canvas'))).toBe(
    true,
  );
  expect((await page.screenshot({ clip: scene })).equals(before)).toBe(true);
  expect(new URL(page.url()).searchParams.get('backend')).toBe(
    info.project.name === 'webgl2' ? 'webgl2' : 'auto',
  );
  expect(new URL(page.url()).searchParams.get('lang')).toBe('en');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('es-AR');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es-AR');
  await expect(page.getByTestId('offset')).toHaveText('5,0 m');
  await expect(page.getByRole('button', { name: 'Ayuda', exact: true })).toBeVisible();
  await expect(page.locator('canvas')).toHaveAttribute(
    'aria-label',
    'Un módulo lunar sobre una plataforma de aterrizaje.',
  );
});

test('keyboard help traps focus, restores it on Escape, and both locales fit narrow screens', async ({
  page,
}, info) => {
  await page.goto(appUrl(info.project.name));
  await expect(page.locator('#viewport')).toHaveAttribute('data-backend', info.project.name);
  await page.keyboard.press('Tab');
  await expect(page.locator('canvas')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('combobox', { name: 'Idioma' })).toBeFocused();
  await page.keyboard.press('Tab');
  const help = page.getByRole('button', { name: 'Ayuda', exact: true });
  await expect(help).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Explorá la escena' })).toBeVisible();
  const close = page.getByRole('button', { name: 'Cerrar', exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(help).toBeFocused();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 375, height: 667 });
  for (const locale of ['es-AR', 'en']) {
    await page.getByRole('combobox').selectOption(locale);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.getByTestId('offset')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    // Clipped overlays do not affect document scrollWidth; check their actual boxes too.
    for (const selector of ['header', 'nav', '.instruments', '#controls']) {
      const bounds = await page.locator('gravitas-inspection-hud').locator(selector).boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(667);
    }
    await page.screenshot({ path: info.outputPath(`hud-${locale}-narrow.png`) });
    await page
      .getByRole('button', { name: locale === 'en' ? 'Help' : 'Ayuda', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const box = await page.getByRole('dialog').boundingBox();
    expect(box!.width).toBeLessThanOrEqual(375);
    expect(box!.height).toBeLessThanOrEqual(667);
    await page
      .getByRole('button', { name: locale === 'en' ? 'Close' : 'Cerrar', exact: true })
      .click();
  }
  await page.setViewportSize({ width: 1000, height: 750 });
  await page.screenshot({ path: info.outputPath('hud-en-desktop.png') });
});

test('language can change while the renderer is loading', async ({ page }, info) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/assets/src-*.js', async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto(appUrl(info.project.name));
    await expect(page.getByRole('status')).toHaveText('Preparando la vista 3D…');
    await page.getByRole('combobox', { name: 'Idioma' }).selectOption('en');
    await expect(page.getByRole('status')).toHaveText('Preparing the 3D view…');
  } finally {
    release();
  }
  await expect(page.locator('#viewport')).toHaveAttribute('data-backend', info.project.name);
  await expect(page.locator('canvas')).toHaveAttribute(
    'aria-label',
    'A lunar lander on a landing pad.',
  );
});

test.describe('translation download failure', () => {
  test.use({
    allowedMessages: {
      patterns: [/^Failed to load resource: the server responded with a status of 503/],
    },
  });
  test('keeps the scene and committed language usable', async ({ page }, info) => {
    await page.goto(appUrl(info.project.name));
    await expect(page.locator('#viewport')).toHaveAttribute('data-backend', info.project.name);
    await page.route('**/assets/en-*.js', (route) =>
      route.fulfill({ status: 503, body: 'Unavailable' }),
    );
    const canvas = await page.locator('canvas').elementHandle();
    await page.getByRole('combobox', { name: 'Idioma' }).selectOption('en');
    await expect(page.getByRole('alert')).toContainText('No pudimos cambiar el idioma');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es-AR');
    await expect(page.getByRole('combobox', { name: 'Idioma' })).toBeEnabled();
    await expect(page.getByRole('combobox', { name: 'Idioma' })).toHaveValue('es-AR');
    expect(await canvas!.evaluate((element) => element === document.querySelector('canvas'))).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Ayuda', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
