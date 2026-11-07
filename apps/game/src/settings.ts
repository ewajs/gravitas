import type { Locale } from '@gravitas/ui';

/** Player preferences kept in the browser between visits. */
export interface Settings {
  /** Last chosen language; a `?lang=` URL parameter still takes precedence. */
  readonly locale: Locale | undefined;
  readonly muted: boolean;
  /** The "How to fly" card has been read: hide it on later visits. */
  readonly controlsSeen: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  locale: undefined,
  muted: false,
  controlsSeen: false,
};

const KEY = 'gravitas.settings.v1';

/**
 * Reads settings, validating each field: stored data is external input that may be
 * missing, corrupt, or from another version. Never throws; storage can be
 * unavailable (private browsing, blocked cookies).
 */
export function loadSettings(storage: Pick<Storage, 'getItem'> | undefined): Settings {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return DEFAULT_SETTINGS;
    const record = data as Record<string, unknown>;
    return {
      locale: record.locale === 'es-AR' || record.locale === 'en' ? record.locale : undefined,
      muted: record.muted === true,
      controlsSeen: record.controlsSeen === true,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Saves settings at meaningful moments (never per frame). Failures are ignored. */
export function saveSettings(
  storage: Pick<Storage, 'setItem'> | undefined,
  settings: Settings,
): void {
  try {
    storage?.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Quota or blocked storage: preferences simply do not persist.
  }
}

/** The browser's storage, if reachable at all. */
export function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
