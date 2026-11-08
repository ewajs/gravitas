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

/** When on-screen touch controls show: as the device suggests, always, or never. */
export type TouchControlsMode = 'auto' | 'always' | 'never';

/**
 * A requested display setting from Help; the host applies and persists it, then
 * sets the matching property. Only the changed setting is present.
 */
export interface AppearanceRequest {
  /** Solid panels without backdrop blur. */
  readonly reduceTransparency?: boolean;
  /** When the touch controls show. */
  readonly touchControls?: TouchControlsMode;
}

/** The touch lever moved: its new position in [0, 1]. */
export interface LeverInput {
  readonly value: number;
}

/**
 * The touch stick's deflection: x to the right, y up, each in [-1, 1] and at
 * most 1 long together. Both are zero when it is released.
 */
export interface StickInput {
  readonly x: number;
  readonly y: number;
}

/** Yaw buttons held: −1 turns left, +1 right, 0 neither (or both). */
export interface YawInput {
  readonly direction: -1 | 0 | 1;
}

/**
 * The input device the player is using, as the host judges it; help, hints, and
 * the start card describe its controls. Gamepad labels follow the standard
 * mapping's Xbox-style names (A, Start, LB/RB, LT/RT); touch describes the
 * on-screen controls.
 */
export type InputDevice = 'keyboard' | 'gamepad' | 'touch';

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
  /** `landed-no-pad`: a safe landing where there is no pad to aim for. */
  readonly verdict: 'landed' | 'landed-off-pad' | 'landed-no-pad' | 'rough' | 'crashed';
  /** Why a crash happened. */
  readonly cause?: 'hull' | 'impact' | 'tipped';
  readonly checks: readonly LandingCheck[];
  /** Remaining fuel as a fraction of capacity. */
  readonly fuel: number;
  /** Seconds from start to the verdict. */
  readonly flightTime: number;
}

/** Asks the host for the next faster (+1) or slower (−1) time warp. */
export interface WarpRequest {
  readonly direction: 1 | -1;
}

/** Asks the host to show the chase camera or the map. */
export interface ViewRequest {
  readonly camera: 'chase' | 'map';
}

/**
 * A short message the host shows for a moment: why faster time warp was refused
 * (the lever is open, the vehicle is turning, or it is too low), or that a
 * vehicle reached the surface where no landing is modelled yet.
 */
export type FlightNotice = 'warp-throttle' | 'warp-rotation' | 'warp-altitude' | 'surface';

/**
 * The orbit, for flights around a body: distances in metres above the reference
 * sphere, times in seconds, speed in metres per second.
 */
export interface OrbitTelemetry {
  /** Highest point above the surface; Infinity when escaping. */
  readonly apoapsis: number;
  /** Lowest point above the surface; negative when the orbit dips into the body. */
  readonly periapsis: number;
  /** Seconds to the next apoapsis; undefined when circular or escaping. */
  readonly timeToApoapsis?: number;
  /** Seconds to the next periapsis; undefined when circular or already past it while escaping. */
  readonly timeToPeriapsis?: number;
  /** Speed relative to the body's centre in inertial space (orbital speed). */
  readonly speed: number;
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
  /** Horizontal distance from the pad reference, in metres; omit where there is no pad. */
  readonly padDistance?: number;
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
  /** Pad reference relative to the vehicle, in metres; omit where there is no pad. */
  readonly pad?: RadarVector;
  /** The orbit, for flights around a body; the right panel shows it instead of the pad. */
  readonly orbit?: OrbitTelemetry;
}
