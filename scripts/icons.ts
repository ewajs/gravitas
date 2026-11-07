/**
 * Renders the Gravitas mark into the committed icon set. The sources are the two
 * hand-drawn SVGs in apps/game/public/: mark.svg (above 32 px) and mark-small.svg
 * (32 px and below). Everything else this writes is generated:
 * favicons, the Apple touch icon, PWA icons, the social preview, and the manual's
 * logos. Uses the pinned Playwright Chromium, so the output is reproducible.
 *
 *   npm run icons
 *
 * Outputs are committed; run this after changing the mark, the accent, or this file.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium, type Page } from '@playwright/test';
import { gravitasTheme } from '@gravitas/ui/themes';

const root = new URL('../', import.meta.url);
const path = (relative: string) => new URL(relative, root);
const game = path('apps/game/public/');
const manual = path('manual/public/');
const require = createRequire(import.meta.url);

const { accent, muted, text } = gravitasTheme.colors;
/** Tile behind app icons and favicons, from the approved design. */
const TILE = '#070b11';
/** Hairline around tiles: the theme's panel line at this opacity, solid on the tile. */
const TILE_LINE = 'rgba(150, 215, 255, 0.14)';
/** The mark on light backgrounds. */
const INK = '#0b1220';

const full = readFileSync(new URL('mark.svg', game), 'utf8');
const small = readFileSync(new URL('mark-small.svg', game), 'utf8');

// Inline copies drop the XML comments and title, and recolour through `color`.
const inline = (svg: string, color: string, size: number | string) =>
  svg
    .replace(/<!--[\s\S]*?-->\s*/g, '')
    .replace(/<title>.*?<\/title>\s*/, '')
    .replace(/color="#[0-9a-f]{6}"/i, `color="${color}" width="${size}" height="${size}"`);

// A standalone SVG file in another colour (for light backgrounds).
const recolour = (svg: string, color: string) =>
  svg.replace(/color="#[0-9a-f]{6}"/i, `color="${color}"`);

/** The small cut on a rounded dark tile, as an SVG favicon. */
function faviconSvg(): string {
  const mark = inline(small, accent, 36)
    .replace('<svg ', '<svg x="6" y="6" ')
    .replace(/\s+/g, ' ')
    .trim();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <title>Gravitas</title>
  <rect width="48" height="48" rx="11" fill="${TILE}" />
  ${mark}
</svg>
`;
}

const fontFace = (family: string, file: string) => {
  const data = readFileSync(require.resolve(file)).toString('base64');
  return `@font-face { font-family: '${family}'; font-weight: 100 900;
    src: url(data:font/woff2;base64,${data}) format('woff2'); }`;
};
const fonts = [
  fontFace(
    'Space Grotesk',
    '@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2',
  ),
  fontFace('Inter', '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'),
].join('\n');

async function render(
  page: Page,
  body: string,
  width: number,
  height: number,
  file: URL,
  transparent = false,
) {
  await page.setViewportSize({ width, height });
  await page.setContent(
    `<!doctype html><style>${fonts} html, body { margin: 0; background: transparent; }
    body { width: ${width}px; height: ${height}px; overflow: hidden; }</style>${body}`,
  );
  await page.evaluate('document.fonts.ready'); // A string: this file has no DOM types.
  writeFileSync(file, await page.screenshot({ omitBackground: transparent, type: 'png' }));
}

// Mark centred on a square: a rounded tile with a hairline, or full bleed.
const square = (size: number, mark: string, markSize: number, radius: number, line = true) =>
  `<div style="box-sizing: border-box; width: ${size}px; height: ${size}px;
    border-radius: ${radius}px; background: ${TILE}; display: grid; place-items: center;
    ${line ? `border: ${Math.max(1, size / 180)}px solid ${TILE_LINE};` : ''}">
    ${inline(mark, accent, markSize)}</div>`;

const social = `<div style="position: relative; width: 1200px; height: 630px; overflow: hidden;
    background: ${gravitasTheme.colors.surface}; color: ${text};
    display: grid; place-items: center; font-family: Inter, sans-serif;">
  <svg width="1200" height="630" viewBox="0 0 1200 630" style="position: absolute; inset: 0">
    <g fill="#c9d6e6" opacity="0.45">
      <circle cx="96" cy="74" r="1.2" /><circle cx="232" cy="168" r="1.4" />
      <circle cx="388" cy="58" r="1" /><circle cx="902" cy="88" r="1.3" />
      <circle cx="1030" cy="190" r="1" /><circle cx="1122" cy="62" r="1.4" />
      <circle cx="704" cy="40" r="0.9" /><circle cx="160" cy="300" r="1" />
      <circle cx="1080" cy="320" r="1.1" />
    </g>
    <path d="M0 520 C 300 500 900 500 1200 520 L 1200 630 L 0 630 Z" fill="#2b2f34" />
    <path d="M0 520 C 300 500 900 500 1200 520" stroke="#4a4f56" fill="none" />
    <ellipse cx="600" cy="572" rx="170" ry="22" fill="none" stroke="${accent}"
      stroke-width="3" stroke-dasharray="14 10" opacity="0.8" />
  </svg>
  <div style="position: relative; display: grid; justify-items: center; gap: 28px;
      margin-top: -70px">
    <div style="display: flex; align-items: center; gap: 30px">
      ${inline(full, accent, 132)}
      <span style="font: 600 76px 'Space Grotesk', sans-serif; letter-spacing: 0.22em;
        margin-right: -0.22em">GRAVITAS</span>
    </div>
    <span style="font-size: 30px; color: ${muted}">Descenso lunar · Lunar descent</span>
  </div>
</div>`;

mkdirSync(game, { recursive: true });
mkdirSync(manual, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  writeFileSync(new URL('favicon.svg', game), faviconSvg());
  writeFileSync(new URL('mark.svg', manual), full);
  writeFileSync(new URL('mark-light.svg', manual), recolour(full, INK));
  writeFileSync(new URL('favicon.svg', manual), faviconSvg());
  // Browser tabs: the small cut, up to 32 px.
  for (const size of [16, 32]) {
    const body = square(size, small, Math.round(size * 0.75), Math.round(size * 0.23), false);
    await render(page, body, size, size, new URL(`favicon-${size}.png`, game), true);
  }
  // Browsers without SVG favicons fall back to the 32 px PNG in the manual, too.
  writeFileSync(new URL('favicon-32.png', manual), readFileSync(new URL('favicon-32.png', game)));
  // iOS rounds the corners itself and wants no transparency.
  await render(
    page,
    square(180, full, 128, 0, false),
    180,
    180,
    new URL('apple-touch-icon.png', game),
  );
  // Install icons (4.4 wires the manifest): rounded tiles, and a full-bleed
  // maskable icon whose mark stays inside the 80% safe zone.
  for (const size of [192, 512]) {
    const body = square(size, full, Math.round(size * 0.7), Math.round(size * 0.22));
    await render(page, body, size, size, new URL(`icon-${size}.png`, game), true);
  }
  await render(
    page,
    square(512, full, 300, 0, false),
    512,
    512,
    new URL('icon-maskable-512.png', game),
  );
  await render(page, social, 1200, 630, new URL('social.png', game));
} finally {
  await browser.close();
}
console.log('Icons written to apps/game/public/ and manual/public/.');
