import type { Page } from '@playwright/test';
import { test, expect } from './test';

const url = (project: string, query = '') =>
  `http://127.0.0.1:4173/gravitas/?backend=${project === 'webgl2' ? 'webgl2' : 'auto'}${query}`;
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
