import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { gravitasTheme, themeCss } from '@gravitas/ui/themes';

/**
 * The web app manifest: what a phone needs to install the game to its home
 * screen. Colours come from the theme; paths are relative to the manifest, so
 * they resolve under /gravitas/ on Pages and under / in development. Android
 * Chrome opens it full screen (display_override); iOS, which reads only
 * `display`, opens it standalone. Landscape, like flight. No service worker:
 * offline play is a later decision.
 */
export function webManifest() {
  const { surface } = gravitasTheme.colors;
  return {
    id: './',
    name: 'Gravitas',
    short_name: 'Gravitas',
    description:
      'Posá un módulo lunar en la plataforma, con física real. Land a lunar module on the pad, with real physics.',
    lang: 'es-AR',
    dir: 'ltr',
    start_url: './',
    scope: './',
    display: 'standalone',
    display_override: ['fullscreen', 'standalone'],
    orientation: 'landscape',
    background_color: surface,
    theme_color: surface,
    categories: ['games', 'education'],
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

const MANIFEST = 'manifest.webmanifest';

// Emitted with the build and served in development; linked from index.html.
function manifest(): Plugin {
  const body = () => `${JSON.stringify(webManifest(), null, 2)}\n`;
  return {
    name: 'gravitas-manifest',
    configureServer(server) {
      server.middlewares.use(`/${MANIFEST}`, (_request, response) => {
        response.setHeader('Content-Type', 'application/manifest+json');
        response.end(body());
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: MANIFEST, source: body() });
    },
    transformIndexHtml: () => [
      { tag: 'link', attrs: { rel: 'manifest', href: MANIFEST }, injectTo: 'head' },
    ],
  };
}

// The page's colours come from the same typed theme as the HUD. They are written
// into index.html when it is served or built, so the first paint already has them.
function theme(): Plugin {
  return {
    name: 'gravitas-theme',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { name: 'theme-color', content: gravitasTheme.colors.surface },
        injectTo: 'head',
      },
      { tag: 'style', children: themeCss(gravitasTheme), injectTo: 'head' },
    ],
  };
}

export default defineConfig({
  root: fileURLToPath(new URL('./apps/game', import.meta.url)),
  base: './',
  plugins: [theme(), manifest()],
});
