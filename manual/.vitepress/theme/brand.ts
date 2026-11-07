import type { Theme } from '@gravitas/ui/themes';

/** VitePress's own page backgrounds, which the manual keeps (Learn's plot palette is validated on them). */
export const VITEPRESS_BACKGROUNDS = {
  light: ['#ffffff', '#f6f6f7'],
  dark: ['#1b1b1f', '#161618', '#202127'],
} as const;

/** `hex` moved toward black by `amount` in [0, 1], in sRGB. */
export function darken(hex: string, amount: number): string {
  const value = parseInt(hex.slice(1, 7), 16);
  return `#${[16, 8, 0]
    .map((shift) => Math.round(((value >> shift) & 255) * (1 - amount)))
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * The manual's brand colours from the game's theme. Dark pages use the accent as
 * it is, with the theme's ink on accent buttons. Light pages need darker steps of
 * the accent (hover goes darker still): on white the accent reaches only about 2:1.
 */
export function brandColors(theme: Theme) {
  const { accent, accentHover, accentInk } = theme.colors;
  return {
    light: {
      text: darken(accent, 0.45),
      hover: darken(accent, 0.55),
      buttonText: '#ffffff',
    },
    dark: { text: accent, hover: accentHover, buttonText: accentInk },
    soft: `${accent}24`,
  };
}

/** VitePress custom properties and the display face for headings, as a style block. */
export function brandCss(theme: Theme): string {
  const { light, dark, soft } = brandColors(theme);
  return `:root {
  --vp-c-brand-1: ${light.text};
  --vp-c-brand-2: ${light.hover};
  --vp-c-brand-3: ${light.text};
  --vp-c-brand-soft: ${soft};
  --vp-button-brand-text: ${light.buttonText};
  --vp-button-brand-hover-text: ${light.buttonText};
  --vp-button-brand-active-text: ${light.buttonText};
  --vp-font-family-base: ${theme.fonts.body};
  --gravitas-font-display: ${theme.fonts.display};
}
.dark {
  --vp-c-brand-1: ${dark.text};
  --vp-c-brand-2: ${dark.hover};
  --vp-c-brand-3: ${dark.text};
  --vp-c-brand-soft: ${soft};
  --vp-button-brand-text: ${dark.buttonText};
  --vp-button-brand-hover-text: ${dark.buttonText};
  --vp-button-brand-active-text: ${dark.buttonText};
}
.vp-doc h1, .vp-doc h2, .vp-doc h3, .VPNavBarTitle .title {
  font-family: var(--gravitas-font-display);
}
.VPNavBarTitle .title {
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}
`;
}
