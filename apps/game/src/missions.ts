import type { Terrain, Vector3 } from '@gravitas/engine';
import type { MissionChoice, MissionId } from '@gravitas/ui';
import { DESCENT_VEHICLE } from './descent-vehicle';
import { orbitSandbox, SUN_DIRECTION, TERRAIN_SUN, terrainSandbox } from './orbital';
import { FIRST_DESCENT } from './scenario';
import type { FlightScenario } from './session';

// What the player can fly (5.5b): the missions on the picker, and the developer
// sandboxes reached only by URL. A mission decides the scenario, the scene around
// it, and which instruments and rules apply; main.ts switches between them.

/** A picker mission, or a developer sandbox (`?scenario=orbit` or `terrain`). */
export type MissionKey = MissionId | 'orbit-sandbox' | 'terrain-sandbox';

export interface Mission {
  readonly id: MissionKey;
  /**
   * Around the Moon (central gravity, the planet, time warp, the map, orbital
   * instruments), or over the opening's flat site.
   */
  readonly around: boolean;
  /** Whether it needs the Moon's terrain to start, can fly without it, or never uses it. */
  readonly terrain: 'required' | 'optional' | 'none';
  /** Sunlight around the Moon (inertial); the flat site has its own. */
  readonly sun?: Vector3;
  /** Whether touchdowns are judged against a pad. */
  readonly pad: boolean;
  /** The flight, given the terrain once loaded (always, when required). */
  scenario(terrain: Terrain | undefined): FlightScenario;
}

export const MISSIONS: Readonly<Record<MissionKey, Mission>> = {
  'quick-landing': {
    id: 'quick-landing',
    around: false,
    terrain: 'none',
    pad: true,
    scenario: () => FIRST_DESCENT,
  },
  // A preview until 5.5c adds its own limits, instruments, and pages: the orbit
  // sandbox's flight, in the descent vehicle.
  'orbit-landing': {
    id: 'orbit-landing',
    around: true,
    terrain: 'optional',
    sun: SUN_DIRECTION,
    pad: false,
    scenario: (terrain) => orbitSandbox(terrain, DESCENT_VEHICLE),
  },
  'orbit-sandbox': {
    id: 'orbit-sandbox',
    around: true,
    terrain: 'optional',
    sun: SUN_DIRECTION,
    pad: false,
    scenario: (terrain) => orbitSandbox(terrain),
  },
  'terrain-sandbox': {
    id: 'terrain-sandbox',
    around: true,
    terrain: 'required',
    sun: TERRAIN_SUN,
    pad: false,
    scenario: (terrain) => terrainSandbox(terrain!),
  },
};

/** The picker's missions, in order. */
export const PICKER_MISSIONS: readonly MissionChoice[] = [
  { id: 'quick-landing' },
  { id: 'orbit-landing', preview: true },
];

/**
 * The mission a `?scenario=` developer shortcut opens, skipping the picker: a
 * picker mission by its id, or `orbit` and `terrain` for the sandboxes.
 */
export function shortcutMission(value: string | null): MissionKey | undefined {
  if (value === 'orbit') return 'orbit-sandbox';
  if (value === 'terrain') return 'terrain-sandbox';
  if (value === 'quick-landing' || value === 'orbit-landing') return value;
  return undefined;
}
