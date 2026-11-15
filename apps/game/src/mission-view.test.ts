import { describe, expect, it } from 'vitest';
import { MOON, type FlightState } from '@gravitas/engine';
import { missionTelemetry, reachedBareSurface } from './mission-view';
import { MISSIONS } from './missions';
import { orbitTelemetry, sphereAltitude } from './orbital';
import { FlightSession, type FlightScenario } from './session';
import { flightTelemetry } from './telemetry';

function sessionFor(key: keyof typeof MISSIONS): FlightSession {
  return new FlightSession(MISSIONS[key].scenario(undefined));
}

describe('mission telemetry', () => {
  it('reads the pad over the flat site', () => {
    const session = sessionFor('quick-landing');
    const telemetry = missionTelemetry(MISSIONS['quick-landing'], session, undefined);
    expect(telemetry).toEqual(
      flightTelemetry(session.state, session.throttle, session.scenario.vehicle),
    );
    expect(telemetry.pad).toBeDefined();
    expect(telemetry.orbit).toBeUndefined();
  });

  it('reads the orbit around the Moon, with altitude above the mean radius until terrain loads', () => {
    const mission = MISSIONS['orbit-landing'];
    const session = sessionFor('orbit-landing');
    const telemetry = missionTelemetry(mission, session, undefined);
    expect(telemetry.orbit).toEqual(orbitTelemetry(session.state, session.time));
    expect(telemetry.pad).toBeUndefined();
    expect(telemetry.altitude).toBeCloseTo(
      sphereAltitude(session.state, session.scenario.vehicle),
      6,
    );
  });
});

describe('reaching the bare sphere', () => {
  // The sandbox's flight, started with its feet just under the mean radius.
  function sunk(): FlightSession {
    const base = MISSIONS['orbit-sandbox'].scenario(undefined);
    const height = MOON.radius + base.vehicle.model.centerOfMassHeight - 1;
    const start: FlightState = { ...base.start, position: { x: 0, y: height, z: 0 } };
    const scenario: FlightScenario = { ...base, start };
    return new FlightSession(scenario);
  }

  it('is false in orbit and over the flat site', () => {
    const orbit = sessionFor('orbit-sandbox');
    orbit.start();
    expect(reachedBareSurface(MISSIONS['orbit-sandbox'], orbit, undefined)).toBe(false);
    const flat = sessionFor('quick-landing');
    flat.start();
    expect(reachedBareSurface(MISSIONS['quick-landing'], flat, undefined)).toBe(false);
  });

  it('is true once a flying vehicle is at the mean radius with no surface to touch', () => {
    const session = sunk();
    expect(reachedBareSurface(MISSIONS['orbit-sandbox'], session, undefined)).toBe(false);
    session.start();
    expect(reachedBareSurface(MISSIONS['orbit-sandbox'], session, undefined)).toBe(true);
  });
});
