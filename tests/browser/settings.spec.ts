import type { Page } from '@playwright/test';
import { test, expect } from './test';

const url = (project: string, query = '') =>
  `http://127.0.0.1:4173/gravitas/?scenario=quick-landing&backend=${project === 'webgl2' ? 'webgl2' : 'auto'}${query}`;
const ready = (page: Page, project: string) =>
  expect(page.locator('#viewport')).toHaveAttribute('data-backend', project);

test('language, mute, and the start card persist across visits', async ({ page }, info) => {
  await page.goto(url(info.project.name));
  await ready(page, info.project.name);
  await expect(page.getByRole('complementary', { name: 'Cómo volar' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Idioma' }).selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const mute = page.getByRole('button', { name: 'Mute' });
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('p'); // Starting marks the card as read.

  // A later visit without ?lang= remembers English, mute, and the read card.
  await page.goto(url(info.project.name));
  await ready(page, info.project.name);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: 'Mute' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#phase')).toHaveText('Ready to descend. Press P or Start.');
  await expect(page.getByRole('complementary', { name: 'How to fly' })).toHaveCount(0);
  // An explicit ?lang= still wins over the saved language.
  await page.goto(url(info.project.name, '&lang=es-AR'));
  await expect(page.locator('html')).toHaveAttribute('lang', 'es-AR');
});

test('sound waits for a gesture, follows pause, and M toggles mute', async ({ page }, info) => {
  await page.goto(url(info.project.name, '&lang=en'));
  await ready(page, info.project.name);
  const host = page.locator('#viewport');
  expect(await host.getAttribute('data-audio')).toBeNull(); // No context before a gesture.
  await page.keyboard.press('p'); // First gesture unlocks audio and starts the flight.
  await expect(host).toHaveAttribute('data-audio', 'running');
  await page.keyboard.press('p');
  await expect(host).toHaveAttribute('data-audio', 'suspended');
  await page.keyboard.press('m');
  await expect(host).toHaveAttribute('data-audio', 'muted');
  await expect(page.getByRole('button', { name: 'Mute' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('m');
  await page.keyboard.press('p');
  await expect(host).toHaveAttribute('data-audio', 'running');
});

test('a hidden tab silences the crash playout after a verdict', async ({ page }, info) => {
  await page.goto(url(info.project.name, '&lang=en'));
  await ready(page, info.project.name);
  const host = page.locator('#viewport');
  await page.keyboard.press('p'); // Unpowered: crashes after about 7.8 s.
  await expect(page.locator('#report')).toBeVisible({ timeout: 30_000 });
  await expect(host).toHaveAttribute('data-audio', 'running');
  const hide = (hidden: boolean) =>
    page.evaluate((value) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  await hide(true);
  await expect(host).toHaveAttribute('data-audio', 'suspended');
  await hide(false);
  await expect(host).toHaveAttribute('data-audio', 'running');
});

test('Reduce transparency gives solid panels and persists; the system preference does too', async ({
  page,
}, info) => {
  await page.goto(url(info.project.name, '&lang=en'));
  await ready(page, info.project.name);
  const hud = page.locator('gravitas-flight-hud');
  const panel = hud.locator('.flight-panel');
  const filter = () => panel.evaluate((element) => getComputedStyle(element).backdropFilter);
  expect(await filter()).toContain('blur');
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  const setting = page.getByRole('checkbox', { name: 'Reduce transparency' });
  await expect(setting).not.toBeChecked();
  await setting.check();
  await expect(hud).toHaveAttribute('reduce-transparency', '');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  expect(await filter()).toBe('none');
  expect(await panel.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
    'rgb(12, 20, 32)',
  );

  await page.goto(url(info.project.name, '&lang=en'));
  await ready(page, info.project.name);
  await expect(hud).toHaveAttribute('reduce-transparency', '');
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Reduce transparency' }).uncheck();
  await expect(hud).not.toHaveAttribute('reduce-transparency', '');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  expect(await filter()).toContain('blur');

  // Without the setting, the system's request for less transparency is honoured.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
  });
  expect(await filter()).toBe('none');
});
