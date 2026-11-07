import { expect, it } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from './settings';

const memory = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    items,
  };
};

it('round-trips settings', () => {
  const storage = memory();
  const settings: Settings = {
    locale: 'en',
    muted: true,
    controlsSeen: true,
    reduceTransparency: true,
    touchControls: 'never',
  };
  saveSettings(storage, settings);
  expect(loadSettings(storage)).toEqual(settings);
});

it('loads settings saved before reduced transparency existed', () => {
  const storage = memory();
  storage.items.set(
    'gravitas.settings.v1',
    JSON.stringify({ locale: 'en', muted: true, controlsSeen: true }),
  );
  expect(loadSettings(storage)).toEqual({
    locale: 'en',
    muted: true,
    controlsSeen: true,
    reduceTransparency: false,
    touchControls: 'auto',
  });
});

it('loads settings saved before the touch-controls setting existed', () => {
  const storage = memory();
  storage.items.set(
    'gravitas.settings.v1',
    JSON.stringify({ locale: 'es-AR', muted: false, controlsSeen: true, reduceTransparency: true }),
  );
  expect(loadSettings(storage)).toEqual({
    locale: 'es-AR',
    muted: false,
    controlsSeen: true,
    reduceTransparency: true,
    touchControls: 'auto',
  });
  storage.items.set('gravitas.settings.v1', JSON.stringify({ touchControls: 'sometimes' }));
  expect(loadSettings(storage).touchControls).toBe('auto');
  storage.items.set('gravitas.settings.v1', JSON.stringify({ touchControls: 'always' }));
  expect(loadSettings(storage).touchControls).toBe('always');
});

it('falls back field by field on corrupt or foreign data', () => {
  const storage = memory();
  expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
  for (const raw of ['not json', 'null', '42', '[]']) {
    storage.items.set('gravitas.settings.v1', raw);
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
  }
  storage.items.set(
    'gravitas.settings.v1',
    JSON.stringify({ locale: 'fr', muted: 'yes', controlsSeen: true }),
  );
  expect(loadSettings(storage)).toEqual({
    locale: undefined,
    muted: false,
    controlsSeen: true,
    reduceTransparency: false,
    touchControls: 'auto',
  });
});

it('never throws when storage is missing or failing', () => {
  const failing = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('quota');
    },
  };
  expect(loadSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  expect(loadSettings(failing)).toEqual(DEFAULT_SETTINGS);
  expect(() => saveSettings(failing, DEFAULT_SETTINGS)).not.toThrow();
});
