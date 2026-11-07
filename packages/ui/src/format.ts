import type { Locale } from './localization';

/** How the HUD writes numbers in one locale. */
export interface NumberFormats {
  /** One decimal: distances and speeds. */
  readonly decimal: Intl.NumberFormat;
  /** One decimal with a sign except at zero: vertical speed. */
  readonly signed: Intl.NumberFormat;
  /** Whole numbers: degrees and seconds. */
  readonly whole: Intl.NumberFormat;
  /** Whole percentages: fuel and throttle. */
  readonly percent: Intl.NumberFormat;
  /** Exactly `digits` decimals, for results that need a precise reading. */
  fixed(digits: number): Intl.NumberFormat;
}

// Building an Intl.NumberFormat is costly and the HUD re-renders ten times a
// second, so each locale's formats are created once and reused.
const cache = new Map<Locale, NumberFormats>();

/** The HUD's number formats for `locale`, with its grouping, decimal mark, and percent pattern. */
export function numberFormats(locale: Locale): NumberFormats {
  const cached = cache.get(locale);
  if (cached) return cached;
  const fixed = new Map<number, Intl.NumberFormat>();
  const formats: NumberFormats = {
    decimal: new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    signed: new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      signDisplay: 'exceptZero',
    }),
    whole: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
    percent: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }),
    fixed(digits) {
      let format = fixed.get(digits);
      if (!format) {
        format = new Intl.NumberFormat(locale, {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        });
        fixed.set(digits, format);
      }
      return format;
    },
  };
  cache.set(locale, formats);
  return formats;
}

/**
 * Radians to degrees for display. Telemetry stays in SI units; UI may import only
 * engine types, so it keeps this one conversion of its own.
 */
export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}
