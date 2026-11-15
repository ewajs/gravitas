import { MOON, type Terrain } from '@gravitas/engine';
import type { Viewport } from '@gravitas/viewport';
import { viewportMessages, type FlightTelemetry } from '@gravitas/ui';
import type { Mission, MissionKey } from './missions';
import { groundAltitude, localGravity, orbitalScene, orbitPath, orbitTelemetry } from './orbital';
import type { FlightSession } from './session';
import { flightTelemetry, orbitalFlightTelemetry } from './telemetry';

// How a mission is shown: what the viewport draws and what the instruments read
// for a flight around the Moon or over the opening's flat site. main.ts owns the
// session, the viewport, and when these run; nothing here keeps state, and nothing
// here decides a flight's outcome.

/** The canvas description for `mission` in the current language. */
export function sceneLabel(mission: Mission): string {
  const messages = viewportMessages();
  const labels: Record<MissionKey, string> = {
    'quick-landing': messages.scene,
    'orbit-landing': messages.descentScene,
    'orbit-sandbox': messages.orbitScene,
    'terrain-sandbox': messages.terrainScene,
  };
  return labels[mission.id];
}

/** The subtitle under the heading; empty for the HUD's own "Lunar descent". */
export function missionSubtitle(mission: Mission): string {
  const messages = viewportMessages();
  const subtitles: Record<MissionKey, string> = {
    'quick-landing': '',
    'orbit-landing': messages.descentSubtitle,
    'orbit-sandbox': messages.orbitSubtitle,
    'terrain-sandbox': messages.terrainSubtitle,
  };
  return subtitles[mission.id];
}

/**
 * Hands the viewport this frame's poses. Around the Moon the world is re-centred
 * on the vehicle each frame, so the Moon and the Sun move too; over the flat site
 * only the vehicle does. A session that has just started or restarted has equal
 * current and previous states, so the vehicle jumps instead of easing across.
 */
export function placeVehicle(viewport: Viewport, mission: Mission, session: FlightSession): void {
  if (!mission.around) {
    viewport.setVehiclePose(session.state, session.previous);
    return;
  }
  const scene = orbitalScene(session.state, session.previous, session.time, mission.sun!);
  viewport.setPlanetPose(scene.planet);
  viewport.setSunDirection(scene.sun);
  viewport.setVehiclePose(scene.current, scene.previous);
}

/**
 * Sets up the viewport for a mission whose session has just been created: its
 * vehicle, the Moon (with `terrain` once loaded) or the flat site, the chase
 * camera, and the orbit line. `baseUrl` is where the app's assets are served.
 */
export function showMissionScene(
  viewport: Viewport,
  mission: Mission,
  session: FlightSession,
  terrain: Terrain | undefined,
  baseUrl: string,
): void {
  viewport.setVehicle(session.scenario.vehicle.model);
  if (mission.around) {
    viewport.setPlanet({
      radius: MOON.radius,
      surfaceMap: `${baseUrl}moon/lroc-color-2k.jpg`,
      ...(terrain ? { terrain } : {}),
    });
    viewport.setCameraMode('chase');
    placeVehicle(viewport, mission, session);
    viewport.setOrbitPath(orbitPath(session.state, session.time) ?? null);
  } else {
    viewport.setPlanet(null);
    placeVehicle(viewport, mission, session);
  }
}

/** The instruments' snapshot for the mission: orbital readouts around the Moon, the pad's otherwise. */
export function missionTelemetry(
  mission: Mission,
  session: FlightSession,
  terrain: Terrain | undefined,
): FlightTelemetry {
  const vehicle = session.scenario.vehicle;
  if (!mission.around) return flightTelemetry(session.state, session.throttle, vehicle);
  return orbitalFlightTelemetry(
    orbitalScene(session.state, session.state, session.time, mission.sun!).current,
    session.throttle,
    Math.max(0, groundAltitude(session.state, terrain, vehicle)),
    localGravity(session.state),
    orbitTelemetry(session.state, session.time),
    vehicle,
  );
}

/**
 * Whether a flight around the Moon without terrain to touch has come down to the
 * mean radius, where there is nothing to land on.
 */
export function reachedBareSurface(
  mission: Mission,
  session: FlightSession,
  terrain: Terrain | undefined,
): boolean {
  return (
    mission.around &&
    !session.scenario.environment.surface &&
    session.phase === 'flying' &&
    groundAltitude(session.state, terrain, session.scenario.vehicle) <= 0
  );
}
