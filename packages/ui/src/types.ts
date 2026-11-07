import type { Locale } from './localization';

// Data and events exchanged with the host. The host decides every value; the HUD
// presents them and reports player actions as requests.

/** A requested locale; the host loads it and commits the successful selection. */
export interface LocaleRequest {
  /** Requested supported locale; the host commits it after loading succeeds. */
  readonly locale: Locale;
}

/** A requested sound setting; the host applies and persists it, then sets `muted`. */
export interface SoundRequest {
  readonly muted: boolean;
}

/** A requested appearance setting; the host applies and persists it, then sets the property. */
export interface AppearanceRequest {
  /** Solid panels without backdrop blur. */
  readonly reduceTransparency: boolean;
}

/** Session phase decided by the host; the HUD only presents it. */
export type FlightPhase = 'ready' | 'flying' | 'paused' | 'complete';

/** One judged quantity: SI value (m/s, rad, or m), its limit, and whether it passed. */
export interface LandingCheck {
  readonly id: 'vertical-speed' | 'horizontal-speed' | 'tilt' | 'pad-distance';
  readonly value: number;
  readonly limit: number;
  readonly pass: boolean;
}

/** Final result explained to the player; decided by the host, presented by the HUD. */
export interface LandingReport {
  readonly verdict: 'landed' | 'landed-off-pad' | 'rough' | 'crashed';
  /** Why a crash happened. */
  readonly cause?: 'hull' | 'impact' | 'tipped';
  readonly checks: readonly LandingCheck[];
  /** Remaining fuel as a fraction of capacity. */
  readonly fuel: number;
  /** Seconds from start to the verdict. */
  readonly flightTime: number;
}

/** A player action the host may apply to its flight session. */
export interface FlightRequest {
  /** Start from ready, pause or resume flight, or restart from the scenario's start. */
  readonly action: 'start' | 'pause' | 'resume' | 'restart';
}

/**
 * Horizontal vector in the vehicle's heading frame: x to its right, y forward.
 * The radar draws +y up, matching a camera that follows the heading.
 */
export interface RadarVector {
  /** Rightward component. */
  readonly x: number;
  /** Forward component. */
  readonly y: number;
}

/**
 * Presentation snapshot calculated by the host at a deliberate, low rate.
 * SI values; the HUD converts only for display.
 */
export interface FlightTelemetry {
  /** Lowest contact point above the surface plane, in metres. */
  readonly altitude: number;
  /** World vertical velocity in metres per second; negative is descending. */
  readonly verticalSpeed: number;
  /**
   * Fastest sink the host advises at this altitude, in metres per second
   * (positive). A hint drawn under vertical speed; omit it to hide the scale.
   */
  readonly safeSink?: number;
  /** Horizontal speed magnitude in metres per second. */
  readonly horizontalSpeed: number;
  /** Horizontal distance from the pad reference, in metres. */
  readonly padDistance: number;
  /** Angle between body +Y and world +Y, in radians. */
  readonly tilt: number;
  /** Remaining fuel as a fraction of capacity, in [0, 1]. */
  readonly fuel: number;
  /** Main-engine throttle lever in [0, 1]. */
  readonly throttle: number;
  /** Throttle that balances gravity when upright at the current mass (may exceed 1). */
  readonly hoverThrottle: number;
  /** Horizontal part of the thrust axis (unit length, so magnitude is sin of tilt). */
  readonly lean: RadarVector;
  /** Horizontal velocity in metres per second. */
  readonly drift: RadarVector;
  /** Pad reference relative to the vehicle, in metres. */
  readonly pad: RadarVector;
}
