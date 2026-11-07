import { describe, expect, it } from 'vitest';
import { composite, contrastRatio, themeCss, themeProperties, themes, type Theme } from './index';

/**
 * The brightest wide area that sits behind the HUD's panels in the game: sunlit
 * regolith, measured as the median of the rendered ground (#666661) between the
 * panels. Backdrop blur averages it, so small bright rocks do not count.
 */
const LIT_REGOLITH = '#666661';

// Every background a theme's text can sit on: the page, and each panel composited
// over the page and over lit ground (translucent panels show what is behind them).
function surfaces(theme: Theme): [string, string][] {
  const page = theme.colors.surface;
  const panels = ['panel', 'panelStrong', 'panelSolid'] as const;
  return [
    ['surface', page],
    ...panels.flatMap((role): [string, string][] => [
      [`${role} over surface`, composite(theme.colors[role], page)],
      [`${role} over regolith`, composite(theme.colors[role], LIT_REGOLITH)],
    ]),
  ];
}

describe.each(themes.map((theme) => [theme.id, theme] as const))('theme %s', (_, theme) => {
  const { colors } = theme;

  it('keeps body and secondary text at 4.5:1 or more on every surface', () => {
    for (const [name, background] of surfaces(theme)) {
      for (const role of ['text', 'muted'] as const) {
        expect(contrastRatio(colors[role], background), `${role} on ${name}`).toBeGreaterThan(4.5);
      }
    }
  });

  it('keeps accent, focus, and status marks at 3:1 or more on every surface', () => {
    for (const [name, background] of surfaces(theme)) {
      for (const role of ['accent', 'focus', 'good', 'warn', 'bad'] as const) {
        expect(contrastRatio(colors[role], background), `${role} on ${name}`).toBeGreaterThan(3);
      }
    }
  });

  it('keeps accent ink readable on the accent, also under the pointer', () => {
    expect(contrastRatio(colors.accentInk, colors.accent)).toBeGreaterThan(4.5);
    expect(contrastRatio(colors.accentInk, colors.accentHover)).toBeGreaterThan(4.5);
  });

  it('keeps focus rings visible where they float over the scene', () => {
    expect(contrastRatio(colors.focus, LIT_REGOLITH)).toBeGreaterThan(3);
  });

  it('keeps instrument marks visible in recessed wells', () => {
    // Wells and tracks sit inside panels, which sit over the scene.
    for (const backdrop of [colors.surface, LIT_REGOLITH]) {
      const panel = composite(colors.panel, backdrop);
      for (const recess of ['well', 'track'] as const) {
        const behind = composite(colors[recess], panel);
        for (const role of ['text', 'accent', 'focus'] as const) {
          expect(contrastRatio(colors[role], behind), `${role} on ${recess}`).toBeGreaterThan(3);
        }
      }
    }
  });

  it('uses only valid colours', () => {
    for (const value of [...Object.values(colors), ...Object.values(theme.scene)]) {
      expect(() => contrastRatio(value, '#000000')).not.toThrow();
    }
  });
});

describe('colour arithmetic', () => {
  it('matches WCAG reference ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 10);
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1);
    // WebAIM's checker: #767676 on white is 4.54:1, the lightest grey that passes AA.
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });

  it('composites translucent colours over their background', () => {
    expect(composite('#ffffff80', '#000000')).toBe('#808080');
    expect(composite('#0c14208c', '#666661')).toBe(composite('#0c14208c', '#666661ff'));
    expect(() => contrastRatio('red', '#000000')).toThrow(RangeError);
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
