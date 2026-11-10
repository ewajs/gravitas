import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bodyToWorld, magnitude, scale, toRadians } from '@gravitas/engine';
import { DESCENT_VEHICLE } from '../../apps/game/src/descent-vehicle';
import { FIRST_LANDER } from '../../apps/game/src/lander';
import {
  groundAltitude,
  localGravity,
  orbitSandbox,
  terrainSandbox,
  terrainStart,
  TRANQUILITY_BASE,
} from '../../apps/game/src/orbital';
import { landingReport } from '../../apps/game/src/report';
import { FlightSession, type PilotInput } from '../../apps/game/src/session';
import { moonTerrain } from '../../apps/game/src/terrain';
import type { Terrain } from '@gravitas/engine';

// Touchdowns on the Moon's terrain (5.4c), judged against the local vertical, in
// the terrain sandbox's Moon-fixed frame.

const bytes = readFileSync(new URL('../../apps/game/public/moon/ldem-4.bin', import.meta.url));
const moon = moonTerrain(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));

/** A spot 300 m east of Tranquility Base where the lander's footprint tilts about 40°. */
const STEEP_WALL = { latitude: toRadians(0.675385), longitude: toRadians(23.477947) };

/**
 * Throttle only, in the local frame: sinks at a tenth of the altitude (at least
 * 0.8 m/s), like verticalPilot in the opening, flying the session's vehicle.
 */
function localVerticalPilot(terrain: Terrain) {
  return (session: FlightSession): PilotInput => {
    const s = session.state;
    const vehicle = session.scenario.vehicle;
    const up = scale(s.position, 1 / magnitude(s.position));
    const climb = s.velocity.x * up.x + s.velocity.y * up.y + s.velocity.z * up.z;
    const altitude = groundAltitude(s, terrain, vehicle);
    const sink = -Math.max(0.8, altitude / 10);
    const bodyUp = bodyToWorld(s.orientation, { x: 0, y: 1, z: 0 });
    const cosTilt = bodyUp.x * up.x + bodyUp.y * up.y + bodyUp.z * up.z;
    const mass = vehicle.parameters.dryMass + s.fuelMass;
    const target =
      (mass * (localGravity(s) + 1.5 * (sink - climb))) /
      (vehicle.parameters.maxThrust * Math.max(0.5, cosTilt));
    const change = target > session.throttle + 0.02 ? 1 : target < session.throttle - 0.02 ? -1 : 0;
    return { rates: { x: 0, y: 0, z: 0 }, throttleChange: change };
  };
}

function fly(
  session: FlightSession,
  pilot: (session: FlightSession) => PilotInput,
  seconds: number,
) {
  session.start();
  for (let n = 0; n < seconds * 60 && session.phase === 'flying'; n++) {
    session.advance(1 / 60, pilot(session));
  }
  return session;
}

// Minutes of simulated flight on the real terrain: allow a slow runner its time.
describe('touchdowns on the Moon’s terrain', { timeout: 30_000 }, () => {
  it('lands on the level mare at Tranquility Base: landed, with no pad', () => {
    const session = fly(new FlightSession(terrainSandbox(moon)), localVerticalPilot(moon), 240);
    expect(session.phase).toBe('complete');
    expect(session.outcome.status).toBe('landed');
    const report = landingReport(session, { pad: false })!;
    expect(report.verdict).toBe('landed-no-pad');
    expect(report.checks.map((check) => check.id)).toEqual([
      'vertical-speed',
      'horizontal-speed',
      'tilt',
    ]);
    // Measured against the local vertical: a gentle, nearly upright touchdown.
    const touchdown = session.outcome.status === 'landed' ? session.outcome.touchdown : undefined;
    expect(touchdown!.verticalSpeed).toBeGreaterThan(0.5);
    expect(touchdown!.verticalSpeed).toBeLessThan(1.2);
    expect(touchdown!.horizontalSpeed).toBeLessThan(0.1);
    expect(touchdown!.tilt).toBeLessThan(toRadians(1));
    // Resting on its feet on the ground.
    expect(Math.abs(groundAltitude(session.state, moon, FIRST_LANDER))).toBeLessThan(0.2);
  });

  it('lands the descent vehicle there too, gently and level, on its own legs', () => {
    const session = fly(
      new FlightSession(terrainSandbox(moon, DESCENT_VEHICLE)),
      localVerticalPilot(moon),
      240,
    );
    expect(session.phase).toBe('complete');
    expect(session.outcome.status).toBe('landed');
    const touchdown = session.outcome.status === 'landed' ? session.outcome.touchdown : undefined;
    expect(touchdown!.verticalSpeed).toBeLessThan(1.2);
    expect(touchdown!.tilt).toBeLessThan(toRadians(1));
    // Resting at its own centre-of-mass height: feet on the ground.
    expect(Math.abs(groundAltitude(session.state, moon, DESCENT_VEHICLE))).toBeLessThan(0.2);
    // A 300 m descent from a hover uses a small share of its tank.
    expect(session.state.fuelMass).toBeGreaterThan(0.8 * DESCENT_VEHICLE.parameters.fuelCapacity);
  });

  it('fails on a 40° crater wall: the same gentle descent tips over or slides', () => {
    const scenario = { ...terrainSandbox(moon), start: terrainStart(moon, STEEP_WALL, 40) };
    const session = fly(new FlightSession(scenario), localVerticalPilot(moon), 120);
    expect(session.phase).toBe('complete');
    expect(['crashed', 'rough']).toContain(session.outcome.status);
  });

  it('hits the ground at orbital speed in the orbit sandbox: a crash', () => {
    const scenario = orbitSandbox(moon);
    // 300 m above Tranquility Base, flying east at nearly orbital speed, sinking 100 m/s (a slow sink can be outrun by ground falling away beneath).
    const start = terrainStart(moon, TRANQUILITY_BASE, 300);
    const east = {
      x: -Math.sin(TRANQUILITY_BASE.longitude),
      y: 0,
      z: -Math.cos(TRANQUILITY_BASE.longitude),
    };
    const up = scale(start.position, 1 / magnitude(start.position));
    const velocity = {
      x: 1600 * east.x - 100 * up.x,
      y: 1600 * east.y - 100 * up.y,
      z: 1600 * east.z - 100 * up.z,
    };
    const session = new FlightSession({ ...scenario, start: { ...start, velocity } });
    fly(session, () => ({ rates: { x: 0, y: 0, z: 0 }, throttleChange: 0 }), 60);
    expect(session.outcome.status).toBe('crashed');
  });
});
