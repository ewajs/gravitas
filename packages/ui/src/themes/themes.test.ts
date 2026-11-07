import { describe, expect, it } from 'vitest';
import { themeCss, themeProperties, themes, type Theme } from './index';

type Rgba = readonly [number, number, number, number];

function parse(hex: string): Rgba {
  const match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex);
  if (!match) throw new Error(`Not a #rrggbb[aa] colour: ${hex}`);
  const value = parseInt(match[1]!, 16);
  const alpha = match[2] ? parseInt(match[2], 16) / 255 : 1;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, alpha];
}

// Source-over compositing in sRGB, as browsers blend translucent fills.
function over(top: Rgba, bottom: Rgba): Rgba {
  const [r, g, b, a] = top;
  return [r * a + bottom[0] * (1 - a), g * a + bottom[1] * (1 - a), b * a + bottom[2] * (1 - a), 1];
}

// WCAG 2.x relative luminance and contrast ratio.
function luminance([r, g, b]: Rgba): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(foreground: Rgba, background: Rgba): number {
  const [hi, lo] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (hi! + 0.05) / (lo! + 0.05);
}

/**
 * The brightest wide area that sits behind the HUD's panels in the game: sunlit
 * regolith, measured as the median of the rendered ground (#666661) between the
 * panels. Backdrop blur averages it, so small bright rocks do not count.
 */
const LIT_REGOLITH = parse('#666661');

// Every background a theme's text can sit on: the page, and each panel composited
// over the page and over lit ground (translucent panels show what is behind them).
function surfaces(theme: Theme): [string, Rgba][] {
  const page = parse(theme.colors.surface);
  const panels = ['panel', 'panelStrong', 'panelSolid'] as const;
  return [
    ['surface', page],
    ...panels.flatMap((role): [string, Rgba][] => [
      [`${role} over surface`, over(parse(theme.colors[role]), page)],
      [`${role} over regolith`, over(parse(theme.colors[role]), LIT_REGOLITH)],
    ]),
  ];
}

describe.each(themes.map((theme) => [theme.id, theme] as const))('theme %s', (_, theme) => {
  const { colors } = theme;

  it('keeps body and secondary text at 4.5:1 or more on every surface', () => {
    for (const [name, background] of surfaces(theme)) {
      for (const role of ['text', 'muted'] as const) {
        expect(contrast(parse(colors[role]), background), `${role} on ${name}`).toBeGreaterThan(
          4.5,
        );
      }
    }
  });

  it('keeps accent, focus, and status marks at 3:1 or more on every surface', () => {
    for (const [name, background] of surfaces(theme)) {
      for (const role of ['accent', 'focus', 'good', 'warn', 'bad'] as const) {
        expect(contrast(parse(colors[role]), background), `${role} on ${name}`).toBeGreaterThan(3);
      }
    }
  });

  it('keeps accent ink readable on the accent, also under the pointer', () => {
    expect(contrast(parse(colors.accentInk), parse(colors.accent))).toBeGreaterThan(4.5);
    expect(contrast(parse(colors.accentInk), parse(colors.accentHover))).toBeGreaterThan(4.5);
  });

  it('keeps focus rings visible where they float over the scene', () => {
    expect(contrast(parse(colors.focus), LIT_REGOLITH)).toBeGreaterThan(3);
  });

  it('keeps instrument marks visible in recessed wells', () => {
    // Wells and tracks sit inside panels, which sit over the scene.
    for (const backdrop of [parse(colors.surface), LIT_REGOLITH]) {
      const panel = over(parse(colors.panel), backdrop);
      for (const recess of ['well', 'track'] as const) {
        const behind = over(parse(colors[recess]), panel);
        for (const role of ['text', 'accent', 'focus'] as const) {
          expect(contrast(parse(colors[role]), behind), `${role} on ${recess}`).toBeGreaterThan(3);
        }
      }
    }
  });

  it('uses only valid colours', () => {
    for (const value of [...Object.values(colors), ...Object.values(theme.scene)]) {
      expect(() => parse(value)).not.toThrow();
    }
  });
});

describe('theme CSS', () => {
  it('declares every role as a custom property', () => {
    const [theme] = themes;
    const properties = themeProperties(theme!);
    expect(properties['--gravitas-text']).toBe(theme!.colors.text);
    expect(properties['--gravitas-radius']).toBe(`${theme!.radius}px`);
    expect(themeCss(theme!, ':root')).toContain(`--gravitas-backdrop: ${theme!.colors.backdrop};`);
  });

  it('gives every theme a unique id', () => {
    expect(new Set(themes.map((theme) => theme.id)).size).toBe(themes.length);
  });
});
