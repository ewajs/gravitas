import { describe, expect, it } from 'vitest';
import {
  createTerrain,
  heightAboveTerrain,
  sampleTerrain,
  terrainHeight,
  type HeightGrid,
  type Terrain,
  type Vector3,
} from './index';

const R = 1_737_400;
const columns = 360;
const rows = 180;

/** A deterministic, bumpy grid: heights in half metres, a few kilometres of relief. */
function bumpyGrid(): HeightGrid {
  const samples = new Int16Array(rows * columns);
  let state = 12345;
  for (let n = 0; n < samples.length; n++) {
    state = (Math.imul(state, 1103515245) + 12345) | 0;
    const row = Math.floor(n / columns);
    const column = n % columns;
    samples[n] =
      4000 * Math.sin((row / rows) * 7) * Math.cos((column / columns) * 2 * Math.PI * 3) +
      ((state >>> 16) % 400) -
      200;
  }
  return { columns, rows, samples, scale: 0.5 };
}

const grid = bumpyGrid();
const smooth = createTerrain({ radius: R, grid, seed: 7, detail: false });
const detailed = createTerrain({ radius: R, grid, seed: 7 });

function direction(latitudeDegrees: number, longitudeDegrees: number): Vector3 {
  const latitude = (latitudeDegrees * Math.PI) / 180;
  const longitude = (longitudeDegrees * Math.PI) / 180;
  return {
    x: Math.cos(latitude) * Math.cos(longitude),
    y: Math.sin(latitude),
    z: -Math.cos(latitude) * Math.sin(longitude),
  };
}

/** Evenly spread directions (a Fibonacci sphere). */
function spread(count: number): Vector3[] {
  return Array.from({ length: count }, (_, n) => {
    const y = 1 - (2 * (n + 0.5)) / count;
    const ring = Math.sqrt(1 - y * y);
    const angle = n * Math.PI * (3 - Math.sqrt(5));
    return { x: ring * Math.cos(angle), y, z: ring * Math.sin(angle) };
  });
}

/** The normal from central differences of the height, for checking the analytic one. */
function numericNormal(terrain: Terrain, at: Vector3, step: number): Vector3 {
  const up = at;
  const pole = Math.abs(up.y) > 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const east = normalize(cross(pole, up));
  const north = cross(up, east);
  const point = (axis: Vector3, d: number) => ({
    x: up.x * R + axis.x * d,
    y: up.y * R + axis.y * d,
    z: up.z * R + axis.z * d,
  });
  const slope = (axis: Vector3) =>
    (terrainHeight(terrain, point(axis, step)) - terrainHeight(terrain, point(axis, -step))) /
    (2 * step);
  const h = terrainHeight(terrain, up);
  const stretch = R / (R + h);
  const se = slope(east) * stretch;
  const sn = slope(north) * stretch;
  return normalize({
    x: up.x - se * east.x - sn * north.x,
    y: up.y - se * east.y - sn * north.y,
    z: up.z - se * east.z - sn * north.z,
  });
}

function cross(a: Vector3, b: Vector3): Vector3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function normalize(v: Vector3): Vector3 {
  const length = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

function angleBetween(a: Vector3, b: Vector3): number {
  return Math.atan2(Math.hypot(...Object.values(cross(a, b))), a.x * b.x + a.y * b.y + a.z * b.z);
}

describe('the height grid', () => {
  it('passes through every sample at its cell centre', () => {
    for (let n = 0; n < 500; n++) {
      const row = (n * 37) % rows;
      const column = (n * 101) % columns;
      const latitude = 90 - ((row + 0.5) * 180) / rows;
      const longitude = ((column + 0.5) * 360) / columns;
      expect(terrainHeight(smooth, direction(latitude, longitude))).toBeCloseTo(
        grid.samples[row * columns + column]! * grid.scale,
        6,
      );
    }
  });

  it('is continuous across the date line, value and slope', () => {
    for (const latitude of [-60, -12.3, 0, 33.3, 71]) {
      const west = sampleTerrain(smooth, direction(latitude, -1e-9));
      const east = sampleTerrain(smooth, direction(latitude, 1e-9));
      expect(east.height).toBeCloseTo(west.height, 6);
      expect(angleBetween(east.normal, west.normal)).toBeLessThan(1e-9);
    }
  });

  it('meets at each pole in one height, level, from every longitude', () => {
    for (const pole of [90, -90]) {
      const row = pole > 0 ? 0 : rows - 1;
      let mean = 0;
      for (let column = 0; column < columns; column++) {
        mean += grid.samples[row * columns + column]! * grid.scale;
      }
      mean /= columns;
      const at = sampleTerrain(smooth, { x: 0, y: Math.sign(pole), z: 0 });
      expect(at.height).toBeCloseTo(mean, 9);
      expect(at.slope).toBeCloseTo(0, 9);
      // A metre from the pole, every approach agrees to well under a millimetre.
      const near = (longitude: number) =>
        terrainHeight(smooth, direction(pole - Math.sign(pole) * (180 / Math.PI / R), longitude));
      for (const longitude of [0, 45, 135, 200, 300]) {
        expect(near(longitude)).toBeCloseTo(mean, 3);
      }
    }
  });

  it('turns the grid slope into the normal: analytic matches finite differences', () => {
    for (const at of spread(400)) {
      expect(
        angleBetween(sampleTerrain(smooth, at).normal, numericNormal(smooth, at, 1)),
      ).toBeLessThan(1e-6);
    }
  });

  it('measures height above the ground straight below', () => {
    const at = direction(12, 34);
    const ground = terrainHeight(detailed, at);
    const position = {
      x: at.x * (R + ground + 50),
      y: at.y * (R + ground + 50),
      z: at.z * (R + ground + 50),
    };
    expect(heightAboveTerrain(detailed, position)).toBeCloseTo(50, 6);
  });
});

describe('procedural detail', () => {
  it('is the same for the same seed, in any order, and different for another seed', () => {
    const points = spread(200);
    const first = points.map((at) => terrainHeight(detailed, at));
    const again = createTerrain({ radius: R, grid, seed: 7 });
    const reversed = [...points]
      .reverse()
      .map((at) => terrainHeight(again, at))
      .reverse();
    expect(reversed).toEqual(first);
    const other = createTerrain({ radius: R, grid, seed: 8 });
    const differing = points.filter((at, n) => terrainHeight(other, at) !== first[n]);
    expect(differing.length).toBeGreaterThan(190);
  });

  it('adds relief below the grid without moving it far: the grid at coarse resolution', () => {
    for (const at of spread(200)) {
      expect(terrainHeight(detailed, at, Infinity)).toBe(terrainHeight(smooth, at));
      // Detail stays within a few hundred metres of the grid.
      expect(Math.abs(terrainHeight(detailed, at) - terrainHeight(smooth, at))).toBeLessThan(800);
    }
  });

  it('stays within the declared bounds', () => {
    let highest = -Infinity;
    let lowest = Infinity;
    for (const at of spread(20000)) {
      const h = terrainHeight(detailed, at);
      highest = Math.max(highest, h);
      lowest = Math.min(lowest, h);
    }
    expect(highest).toBeLessThan(detailed.maximumHeight);
    expect(lowest).toBeGreaterThan(detailed.minimumHeight);
  });

  it('has metre-scale texture: heights a few metres apart differ', () => {
    const at = direction(-20, 140);
    const base = { x: at.x * R, y: at.y * R, z: at.z * R };
    const h0 = terrainHeight(detailed, base);
    const differences = [1, 2, 4, 8].map((d) =>
      Math.abs(terrainHeight(detailed, { ...base, x: base.x + d }) - h0),
    );
    expect(Math.max(...differences)).toBeGreaterThan(0.01);
  });

  it('has normals that match finite differences (the detail is smooth)', () => {
    const errors = spread(1500).map((at) =>
      angleBetween(sampleTerrain(detailed, at).normal, numericNormal(detailed, at, 0.002)),
    );
    errors.sort((a, b) => a - b);
    expect(errors[Math.floor(errors.length * 0.99)]!).toBeLessThan((0.2 * Math.PI) / 180);
    expect(errors[errors.length - 1]!).toBeLessThan((1 * Math.PI) / 180);
  });

  it('reports slope as the normal’s lean from the vertical', () => {
    for (const at of spread(100)) {
      const ground = sampleTerrain(detailed, at);
      expect(ground.slope).toBeCloseTo(angleBetween(ground.normal, at), 9);
    }
  });
});

describe('createTerrain validation', () => {
  it('rejects bad seeds, shapes, and samples', () => {
    expect(() => createTerrain({ radius: R, grid, seed: -1 })).toThrow(RangeError);
    expect(() => createTerrain({ radius: R, grid, seed: 1.5 })).toThrow(RangeError);
    expect(() => createTerrain({ radius: 0, grid, seed: 1 })).toThrow(RangeError);
    expect(() => createTerrain({ radius: R, grid: { ...grid, rows: 100 }, seed: 1 })).toThrow(
      RangeError,
    );
    expect(() =>
      createTerrain({ radius: R, grid: { ...grid, samples: new Int16Array(10) }, seed: 1 }),
    ).toThrow(RangeError);
    const broken = Float64Array.from(grid.samples);
    broken[5] = Number.NaN;
    expect(() => createTerrain({ radius: R, grid: { ...grid, samples: broken }, seed: 1 })).toThrow(
      RangeError,
    );
    // Only terrain made by createTerrain samples.
    expect(() => terrainHeight({ ...smooth }, { x: 1, y: 0, z: 0 })).toThrow(RangeError);
    expect(() => terrainHeight(smooth, { x: 0, y: 0, z: 0 })).toThrow(RangeError);
  });
});
