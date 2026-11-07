import { defineConfig } from 'vitepress';
import { gravitasTheme } from '@gravitas/ui/themes';
import { brandCss } from './theme/brand';

// Player manual, separate from the developer docs. Served under the game at
// /gravitas/manual/ (Spanish) and /gravitas/manual/en/ (English) from one build.
const learn = (locale: 'es' | 'en') => {
  const prefix = locale === 'en' ? '/en' : '';
  const text =
    locale === 'en'
      ? {
          overview: 'How Gravitas works',
          motion: 'Motion and gravity',
          rockets: 'Rockets and leaning',
          rotation: 'Rotation and the assist',
          integration: 'Stepping time',
          contact: 'Legs and the ground',
          orbits: 'Next: orbits',
        }
      : {
          overview: 'Cómo funciona Gravitas',
          motion: 'Movimiento y gravedad',
          rockets: 'Cohetes e inclinación',
          rotation: 'Rotación y asistencia',
          integration: 'Avanzar en el tiempo',
          contact: 'Patas y suelo',
          orbits: 'Lo que viene: órbitas',
        };
  return [
    { text: text.overview, link: `${prefix}/learn/` },
    { text: text.motion, link: `${prefix}/learn/motion` },
    { text: text.rockets, link: `${prefix}/learn/rockets` },
    { text: text.rotation, link: `${prefix}/learn/rotation` },
    { text: text.integration, link: `${prefix}/learn/integration` },
    { text: text.contact, link: `${prefix}/learn/contact` },
    { text: text.orbits, link: `${prefix}/learn/orbits` },
  ];
};

const pages = (locale: 'es' | 'en') => {
  const prefix = locale === 'en' ? '/en' : '';
  const text =
    locale === 'en'
      ? {
          start: 'Getting started',
          fly: 'Flying',
          instruments: 'Instruments',
          landing: 'Landing',
          lander: 'The lander',
        }
      : {
          start: 'Primeros pasos',
          fly: 'Volar',
          instruments: 'Instrumentos',
          landing: 'Aterrizar',
          lander: 'El módulo',
        };
  return [
    { text: text.start, link: `${prefix}/` },
    { text: text.fly, link: `${prefix}/flying` },
    { text: text.instruments, link: `${prefix}/instruments` },
    { text: text.landing, link: `${prefix}/landing` },
    { text: text.lander, link: `${prefix}/lander` },
  ];
};

export default defineConfig({
  base: '/gravitas/manual/',
  outDir: '../apps/game/dist/manual',
  cleanUrls: false,
  appearance: 'dark',
  // Equations render to SVG at build time (MathJax); no runtime math JavaScript.
  markdown: { math: true },
  lastUpdated: false,
  // Head links are not rewritten for the base, so they carry it. The brand colours
  // and fonts come from the game's theme, written into every page at build time.
  head: [
    ['link', { rel: 'icon', href: '/gravitas/manual/favicon.svg', type: 'image/svg+xml' }],
    [
      'link',
      { rel: 'icon', href: '/gravitas/manual/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    ['style', {}, brandCss(gravitasTheme)],
  ],
  locales: {
    root: {
      label: 'Español',
      lang: 'es-AR',
      title: 'Manual de Gravitas',
      description: 'Cómo volar y aterrizar en Gravitas.',
      themeConfig: {
        nav: [{ text: 'Jugar', link: '/../', target: '_self' }],
        sidebar: [
          { text: 'Manual', items: pages('es') },
          { text: 'Aprender', items: learn('es') },
        ],
        outline: { label: 'En esta página' },
        docFooter: { prev: 'Anterior', next: 'Siguiente' },
        darkModeSwitchLabel: 'Apariencia',
        sidebarMenuLabel: 'Menú',
        returnToTopLabel: 'Volver arriba',
        langMenuLabel: 'Idioma',
        notFound: { title: 'Página no encontrada', quote: '', linkText: 'Volver al inicio' },
      },
    },
    en: {
      label: 'English',
      lang: 'en',
      link: '/en/',
      title: 'Gravitas manual',
      description: 'How to fly and land in Gravitas.',
      themeConfig: {
        nav: [{ text: 'Play', link: '/../?lang=en', target: '_self' }],
        sidebar: [
          { text: 'Manual', items: pages('en') },
          { text: 'Learn', items: learn('en') },
        ],
        outline: { label: 'On this page' },
      },
    },
  },
  themeConfig: {
    // The mark and name in the nav; its icon files come from `npm run icons`.
    logo: { light: '/mark-light.svg', dark: '/mark.svg', alt: '' },
    siteTitle: 'Gravitas',
    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: { buttonText: 'Buscar', buttonAriaLabel: 'Buscar' },
              modal: {
                displayDetails: 'Mostrar detalles',
                resetButtonTitle: 'Borrar búsqueda',
                backButtonTitle: 'Cerrar búsqueda',
                noResultsText: 'Sin resultados para',
                footer: {
                  selectText: 'elegir',
                  navigateText: 'moverse',
                  closeText: 'cerrar',
                },
              },
            },
          },
        },
      },
    },
  },
});
