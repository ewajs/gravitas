import { describe, expect, it } from 'vitest';
import { contrastRatio, themes } from '@gravitas/ui/themes';
import { brandColors, brandCss, darken, VITEPRESS_BACKGROUNDS } from './brand';

describe.each(themes.map((theme) => [theme.id, theme] as const))('manual brand: %s', (_, theme) => {
  const colors = brandColors(theme);

  it('keeps brand links and their hover readable on every page background', () => {
    for (const mode of ['light', 'dark'] as const) {
      for (const background of VITEPRESS_BACKGROUNDS[mode]) {
        for (const role of ['text', 'hover'] as const) {
          expect(
            contrastRatio(colors[mode][role], background),
            `${mode} ${role} on ${background}`,
          ).toBeGreaterThan(4.5);
        }
      }
    }
  });

  it('keeps brand button text readable on the button, also under the pointer', () => {
    for (const mode of ['light', 'dark'] as const) {
      for (const fill of [colors[mode].text, colors[mode].hover]) {
        expect(contrastRatio(colors[mode].buttonText, fill), `${mode} on ${fill}`).toBeGreaterThan(
          4.5,
        );
      }
    }
  });

  it('declares the theme accent for dark pages', () => {
    expect(brandCss(theme)).toContain(`--vp-c-brand-1: ${theme.colors.accent};`);
  });
});

it('darkens in sRGB toward black', () => {
  expect(darken('#ffffff', 0.5)).toBe('#808080');
  expect(darken('#4cc3e0', 0)).toBe('#4cc3e0');
  expect(darken('#4cc3e0', 1)).toBe('#000000');
});
