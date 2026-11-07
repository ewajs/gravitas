import { defineConfig } from 'vitepress';

// Player manual, separate from the developer docs. Served under the game at
// /gravitas/manual/ (Spanish) and /gravitas/manual/en/ (English) from one build.
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
  lastUpdated: false,
  head: [['link', { rel: 'icon', href: 'data:,' }]],
  locales: {
    root: {
      label: 'Español',
      lang: 'es-AR',
      title: 'Manual de Gravitas',
      description: 'Cómo volar y aterrizar en Gravitas.',
      themeConfig: {
        nav: [{ text: 'Jugar', link: '/../', target: '_self' }],
        sidebar: [{ text: 'Manual', items: pages('es') }],
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
        sidebar: [{ text: 'Manual', items: pages('en') }],
        outline: { label: 'On this page' },
      },
    },
  },
  themeConfig: {
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
