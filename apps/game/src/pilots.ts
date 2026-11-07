import { bodyToWorld, clamp } from '@gravitas/engine';
import { ATTITUDE, LANDER } from './lander';
import { PAD_POSITION, SURFACE_GRAVITY } from './scenario';
import type { FlightSession, PilotInput } from './session';
import { footClearance } from './telemetry';

/**
 * Scripted pilots for regression flights and tuning; never used in play. They
 * use only the player's inputs (held rate keys and the throttle lever ramp).
 */
export type Pilot = (session: FlightSession) => PilotInput;

// Moves the lever toward a target with the held-key ramp, like a player would.
function lever(session: FlightSession, target: number): -1 | 0 | 1 {
  if (target > session.throttle + 0.02) return 1;
  if (target < session.throttle - 0.02) return -1;
  return 0;
}

// Throttle for a sink rate proportional to altitude, compensating tilt and mass.
function descentThrottle(session: FlightSession, sink: number): number {
  const s = session.state;
  const g = SURFACE_GRAVITY;
  const up = bodyToWorld(s.orientation, { x: 0, y: 1, z: 0 }).y;
  const mass = LANDER.dryMass + s.fuelMass;
  return (mass * (g + 1.5 * (sink - s.velocity.y))) / (LANDER.maxThrust * Math.max(0.5, up));
}

/** No input at all: the opening's unpowered fall. */
export const idlePilot: Pilot = () => ({ rates: { x: 0, y: 0, z: 0 }, throttleChange: 0 });

/** Throttle only: holds a zero sink rate while upright, so it hovers until the tank runs dry. */
export const hoverPilot: Pilot = (session) => {
  const s = session.state;
  const mass = LANDER.dryMass + s.fuelMass;
  const hold = (mass * (SURFACE_GRAVITY + 1.5 * (0 - s.velocity.y))) / LANDER.maxThrust;
  return { rates: { x: 0, y: 0, z: 0 }, throttleChange: lever(session, hold) };
};

/** Throttle only: holds a sink rate of altitude/6 and ignores drift. */
export const verticalPilot: Pilot = (session) => {
  const altitude = footClearance(session.state);
  return {
    rates: { x: 0, y: 0, z: 0 },
    throttleChange: lever(session, descentThrottle(session, -Math.max(0.8, altitude / 6))),
  };
};

/**
 * Flies to the pad: descends at altitude/8 and leans to steer horizontal velocity
 * toward the pad, levelling out for the last metres. Assumes it faces world +X,
 * as the opening does, so pitch alone steers along X and roll holds Z.
 */
export const padPilot: Pilot = (session) => {
  const s = session.state;
  const altitude = footClearance(s);
  const g = SURFACE_GRAVITY;
  const up = bodyToWorld(s.orientation, { x: 0, y: 1, z: 0 });
  // Lean along world X (forward) and Z (left of forward is −Z here).
  const steer = (offset: number, velocity: number) => {
    const wanted = clamp(-0.25 * offset, -2.5, 2.5);
    return altitude < 2 ? 0 : clamp(Math.atan((0.8 * (wanted - velocity)) / g), -0.3, 0.3);
  };
  const leanX = steer(s.position.x - PAD_POSITION.x, s.velocity.x);
  const leanZ = steer(s.position.z - PAD_POSITION.z, s.velocity.z);
  // Rate requests are fractions of the assist's maximum rate.
  const { maxRate } = ATTITUDE;
  return {
    // −X body rate leans thrust toward +X world; +Z body rate leans it toward −Z world.
    rates: {
      x: -clamp((2 * (leanX - Math.asin(clamp(up.x, -1, 1)))) / maxRate.x, -1, 1),
      y: 0,
      z: -clamp((2 * (leanZ - Math.asin(clamp(up.z, -1, 1)))) / maxRate.z, -1, 1),
    },
    throttleChange: lever(session, descentThrottle(session, -Math.max(0.6, altitude / 8))),
  };
};

/** Runs a pilot until the session completes or the time limit passes, at 60 Hz. */
export function fly(session: FlightSession, pilot: Pilot, seconds = 120): FlightSession {
  session.start();
  for (let n = 0; n < seconds * 60 && session.phase === 'flying'; n++) {
    session.advance(1 / 60, pilot(session));
  }
  return session;
}
