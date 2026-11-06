import { configureLocalization, msg } from '@lit/localize';

/** Locales currently available for player-facing text. */
export type Locale = 'es-AR' | 'en';

const localization = configureLocalization({
  sourceLocale: 'es-AR',
  targetLocales: ['en'],
  loadLocale: () => import('./locales/en'),
});

/** Loads the requested locale before the host renders localized text. */
export function setLocale(locale: Locale): Promise<void> {
  return localization.setLocale(locale);
}

/** Loading, accessibility, and inspection copy; call after awaiting setLocale(). */
export function viewportMessages() {
  return {
    loading: msg('Preparando la vista 3D…', { id: 'viewport-loading' }),
    failed: msg(
      'No pudimos mostrar la vista 3D. Probá actualizar el navegador o usar otro dispositivo.',
      {
        id: 'viewport-failed',
      },
    ),
    scene: msg('Un módulo lunar sobre una plataforma de aterrizaje.', { id: 'viewport-scene' }),
    subtitle: msg('Vista de inspección', { id: 'viewport-subtitle' }),
    controls: msg('Arrastrá para girar · Rueda para acercar · Flechas para desplazar', {
      id: 'viewport-controls',
    }),
  };
}
