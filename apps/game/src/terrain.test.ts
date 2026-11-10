import { describe, expect, it } from 'vitest';
import { MOON, sampleTerrain } from '@gravitas/engine';
import { groundAltitude, sandboxStart, sphereAltitude } from './orbital';
import { FIRST_LANDER } from './lander';
import { decodeHeightGrid, LDEM_4, moonTerrain } from './terrain';

/** A synthetic LDEM_4-shaped file: little-endian 16-bit values in half metres. */
function file(value: (n: number) => number): ArrayBuffer {
  const bytes = new ArrayBuffer(LDEM_4.columns * LDEM_4.rows * 2);
  const view = new DataView(bytes);
  for (let n = 0; n < LDEM_4.columns * LDEM_4.rows; n++) view.setInt16(n * 2, value(n), true);
  return bytes;
}

describe('the elevation grid file', () => {
  it('decodes little-endian half metres, whatever the platform byte order', () => {
    const grid = decodeHeightGrid(file((n) => (n % 7) - 3 - (n === 5 ? 20000 : 0)));
    expect(grid.columns).toBe(1440);
    expect(grid.rows).toBe(720);
    expect(grid.scale).toBe(0.5);
    expect(Array.from(grid.samples).slice(0, 8)).toEqual([-3, -2, -1, 0, 1, -19998, 3, -3]);
  });

  it('rejects a file of the wrong size', () => {
    expect(() => decodeHeightGrid(new ArrayBuffer(100))).toThrow(RangeError);
  });

  it('makes the Moon: its radius and the fixed seed, with detail', () => {
    const terrain = moonTerrain(file(() => 0));
    expect(terrain.radius).toBe(MOON.radius);
    expect(terrain.detail).toBe(true);
    // A level grid still has seeded relief.
    expect(sampleTerrain(terrain, { x: 1, y: 0.2, z: 0.3 }).height).not.toBe(0);
  });
});

describe('the altitude readout', () => {
  it('is height above the ground below once the terrain is in, the mean radius before', () => {
    const start = sandboxStart();
    expect(groundAltitude(start, undefined, FIRST_LANDER)).toBe(
      sphereAltitude(start, FIRST_LANDER),
    );
    // On a level grid, the feet are 100 km up less the seeded relief right below.
    const terrain = moonTerrain(file(() => 0));
    const relief = sampleTerrain(terrain, start.position).height;
    expect(groundAltitude(start, terrain, FIRST_LANDER)).toBeCloseTo(
      sphereAltitude(start, FIRST_LANDER) - relief,
      6,
    );
  });
});
