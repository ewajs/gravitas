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

/** Loading, accessibility, and flight copy; call after awaiting setLocale(). */
export function viewportMessages() {
  return {
    loading: msg('Preparando la vista 3D…', { id: 'viewport-loading' }),
    failed: msg(
      'No pudimos mostrar la vista 3D. Probá actualizar el navegador o usar otro dispositivo.',
      {
        id: 'viewport-failed',
      },
    ),
    scene: msg('Un módulo lunar y su plataforma de aterrizaje.', { id: 'viewport-scene' }),
    subtitle: msg('Descenso lunar', { id: 'viewport-subtitle' }),
    orbitScene: msg('Un módulo lunar en órbita alrededor de la Luna.', {
      id: 'viewport-scene-orbit',
    }),
    orbitSubtitle: msg('Órbita lunar · prueba', { id: 'viewport-subtitle-orbit' }),
    terrainScene: msg('Un módulo lunar sobre la superficie de la Luna.', {
      id: 'viewport-scene-terrain',
    }),
    terrainSubtitle: msg('Superficie lunar · prueba', { id: 'viewport-subtitle-terrain' }),
    descentScene: msg('Un módulo de descenso en órbita alrededor de la Luna.', {
      id: 'viewport-scene-descent',
    }),
    descentSubtitle: msg('Aterrizaje desde órbita · vista previa', {
      id: 'viewport-subtitle-descent',
    }),
    controls: msg('W/S cabeceo · A/D alabeo · Q/E guiñada · R/F empuje · P pausa', {
      id: 'viewport-controls',
    }),
  };
}
