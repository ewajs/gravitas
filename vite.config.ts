import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { gravitasTheme, themeCss } from '@gravitas/ui/themes';

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
  plugins: [theme()],
});
