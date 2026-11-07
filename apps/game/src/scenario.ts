import type { FlightEnvironment, FlightState } from '@gravitas/engine';
import { CENTER_OF_MASS_HEIGHT } from './lander';

/** Constant lunar surface gravity (rounded) over flat ground at y = 0, pad flush with it. */
export const ENVIRONMENT: FlightEnvironment = {
  gravity: { x: 0, y: -1.62, z: 0 },
  surface: { kind: 'flat', height: 0 },
};

/** Centre of the landing pad, on the surface, in world metres. */
export const PAD_POSITION = { x: 0, y: 0, z: 0 } as const;

/**
 * Propellant loaded for the first descent, in kg (20% of the 300 kg tank). A
 * scripted pilot flying straight to the pad uses about 24 kg; this leaves a
 * careful human roughly 2.5 times that, so hovering indefinitely runs dry.
 */
export const START_FUEL = 60;

/** Feet height above the surface when the first descent begins, in metres. */
export const START_ALTITUDE = 80;

/**
 * Opening of the first descent: upright and facing the pad (yawed −90°, so body
 * forward is world +X), 30 m from it, sinking at 4 m/s and drifting toward it at
 * 2 m/s, with START_FUEL loaded. Left alone, it reaches the surface in about 7.8 s at
 * about 16.6 m/s.
 */
export const START_STATE: FlightState = {
  position: { x: -30, y: START_ALTITUDE + CENTER_OF_MASS_HEIGHT, z: 0 },
  orientation: { x: 0, y: -Math.SQRT1_2, z: 0, w: Math.SQRT1_2 },
  velocity: { x: 2, y: -4, z: 0 },
  angularVelocity: { x: 0, y: 0, z: 0 },
  fuelMass: START_FUEL,
};
