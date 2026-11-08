import type { Vector3 } from './pose';
import { clamp, smoothstep, smoothstepSlope } from './math';
import { gradientNoise, hash3, noiseSample, rehash } from './noise';
import { finite, positive } from './validation';

// A body's ground as one height function over its sphere (ADR 0021): a coarse
// measured elevation grid sampled smoothly, plus seeded procedural detail below
// the grid's resolution. Contact, normals, and altitude all come from here, and
// so will the rendered mesh, so what is drawn is what the legs touch.
//
// Directions follow the body-fixed frame of frames.ts: +Y north, +X toward
// longitude 0, 90°E along −Z.

/**
 * Heights on a simple-cylindrical (latitude–longitude) grid, pixel-registered:
 * row 0 is the northernmost band and column 0 starts at longitude 0, increasing
 * eastward, so sample (row, column) sits at the centre of its cell. NASA's LOLA
 * LDEM products have this layout.
 */
export interface HeightGrid {
  /** Samples per row, covering 360° of longitude. */
  readonly columns: number;
  /** Rows, covering 180° of latitude from north to south. */
  readonly rows: number;
  /** Row-major raw values, `rows × columns` of them. */
  readonly samples: ArrayLike<number>;
  /** Metres per raw value: height = sample × scale, relative to the body's radius. */
  readonly scale: number;
}

/** What createTerrain needs: the body's reference radius, its grid, and the detail seed. */
export interface TerrainOptions {
  /** Reference radius the grid's heights are measured from, in metres. */
  readonly radius: number;
  readonly grid: HeightGrid;
  /** Seed for the procedural detail; the same seed always gives the same ground. */
  readonly seed: number;
  /** Add procedural detail below the grid's resolution (default true). */
  readonly detail?: boolean;
}

/** A validated, ready-to-sample terrain. Create with {@link createTerrain}. */
export interface Terrain {
  readonly radius: number;
  readonly grid: HeightGrid;
  readonly seed: number;
  readonly detail: boolean;
  /** No ground is higher than this above the reference radius, in metres. */
  readonly maximumHeight: number;
  /** No ground is lower than this (negative: below the reference radius), in metres. */
  readonly minimumHeight: number;
}

/** The ground at one place. */
export interface TerrainSample {
  /** Height above the reference radius, in metres. */
  readonly height: number;
  /** Outward unit normal of the ground, in the body-fixed frame. */
  readonly normal: Vector3;
  /** Angle between the normal and the local vertical, in radians. */
  readonly slope: number;
}

// Procedural detail (ADR 0021). Lengths in metres.
//
// Craters and boulders live in 3D cells of the body-fixed frame, so nothing
// depends on a map projection and there are no seams or polar pinches. Each cell
// draws a few random centres; one that lies within a thin shell around the sphere
// becomes a feature centred on its projection onto the sphere. A feature reaches
// at most FEATURE_REACH cells from its centre and the shell is at most
// SHELL_HALF_WIDTH cells thick, together under half a cell, so a point only needs
// the 2 × 2 × 2 cells around it.
const FEATURE_REACH = 0.35;
const SHELL_HALF_WIDTH = 0.15;
// Craters: one layer per cell size, halving from the largest to the smallest.
// Equal odds per layer give a cumulative count growing as D⁻², the small-crater
// equilibrium seen on the Moon. Radii span half a reach to a reach (in diameters,
// 0.175 to 0.35 cells), so the layers meet without gaps.
const CRATER_CELL_LARGEST = 8192;
const CRATER_CELL_SMALLEST = 8;
const CRATERS_PER_CELL = 2;
// Boulders: rounded bumps, sparse everywhere and dense in fields.
const BOULDER_CELLS = [16, 8, 4] as const;
const BOULDERS_PER_CELL = 2;
const BOULDER_FIELD_WAVELENGTH = 300;
const BOULDER_BACKGROUND = 0.1;
// Rolling roughness: fractal gradient noise, amplitude ∝ wavelength^HURST, scaled
// by the grid's ruggedness: stronger on steep highlands, weaker on flat maria.
const ROUGHNESS_LONGEST = 4096;
const ROUGHNESS_SHORTEST = 1;
const ROUGHNESS_AT_KILOMETRE = 6;
const HURST = 0.9;
const RUGGED_FLAT = 0.6;
const RUGGED_STEEP = 1.8;
/** Grid slopes (m/m) over which ruggedness rises from flat to steep. */
const RUGGED_FROM = 0.01;
const RUGGED_TO = 0.15;

// Seeds for each family of detail, mixed with the terrain's seed.
const CRATER_SALT = 0x63726174;
const BOULDER_SALT = 0x626f756c;
const FIELD_SALT = 0x6669656c;
const ROUGH_SALT = 0x726f7567;

/** Values on the grid's latitude–longitude layout, in metres or as factors. */
interface Map {
  readonly values: ArrayLike<number>;
  readonly scale: number;
  /** Mean of the first and last rows: the value at each pole. */
  readonly north: number;
  readonly south: number;
}

interface Internals {
  readonly heights: Map;
  /** Roughness factor per grid cell, from the grid's own slope. */
  readonly rugged: Map;
  readonly roughness: readonly { readonly wavelength: number; readonly amplitude: number }[];
}

const internals = new WeakMap<Terrain, Internals>();

/**
 * Validates a grid and seed and precomputes what sampling needs. The grid's samples
 * are read, never copied or changed; keep them unchanged while the terrain is used.
 */
export function createTerrain(options: TerrainOptions): Terrain {
  const { grid, radius, seed } = options;
  positive(radius, 'terrain radius');
  positive(grid.scale, 'grid scale');
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('terrain seed must be an unsigned 32-bit integer');
  }
  if (!Number.isInteger(grid.columns) || grid.columns < 4 || grid.columns % 2 !== 0) {
    throw new RangeError('grid columns must be an even integer of at least 4');
  }
  if (!Number.isInteger(grid.rows) || grid.rows * 2 !== grid.columns) {
    throw new RangeError('grid rows must be half the columns (square cells in degrees)');
  }
  if (grid.samples.length !== grid.rows * grid.columns) {
    throw new RangeError('grid samples must hold rows × columns values');
  }
  let lowest = Infinity;
  let highest = -Infinity;
  for (let n = 0; n < grid.samples.length; n++) {
    const value = grid.samples[n]!;
    finite(value, 'grid sample');
    if (value < lowest) lowest = value;
    if (value > highest) highest = value;
  }
  const detail = options.detail ?? true;
  const roughness: { wavelength: number; amplitude: number }[] = [];
  for (let wavelength = ROUGHNESS_LONGEST; wavelength >= ROUGHNESS_SHORTEST; wavelength /= 2) {
    roughness.push({
      wavelength,
      amplitude: ROUGHNESS_AT_KILOMETRE * Math.pow(wavelength / 1000, HURST),
    });
  }
  const bound = detailBound(roughness);
  const terrain: Terrain = Object.freeze({
    radius,
    grid,
    seed,
    detail,
    maximumHeight: highest * grid.scale + (detail ? bound.up : 0),
    minimumHeight: lowest * grid.scale - (detail ? bound.down : 0),
  });
  const heights = withPoles(grid, grid.samples, grid.scale);
  internals.set(terrain, {
    heights,
    rugged: withPoles(grid, detail ? ruggedness(grid, radius) : new Float32Array(1), 1),
    roughness,
  });
  return terrain;
}

/** Rejects anything not made by createTerrain. */
export function validateTerrain(terrain: Terrain): void {
  if (!internals.has(terrain)) throw new RangeError('terrain must come from createTerrain');
}

/**
 * Height of the ground above the reference radius along `direction` (any non-zero
 * vector from the centre), in metres. Features smaller than `resolution` metres are
 * left out, for drawing far ground coarsely; contact uses the default, everything.
 */
export function terrainHeight(terrain: Terrain, direction: Vector3, resolution = 0): number {
  return evaluate(terrain, direction, resolution).height;
}

/** Height, normal, and slope of the ground along `direction`; see {@link terrainHeight}. */
export function sampleTerrain(terrain: Terrain, direction: Vector3, resolution = 0): TerrainSample {
  const ground = evaluate(terrain, direction, resolution);
  // Keep only the gradient's component along the sphere.
  const { ux, uy, uz } = ground;
  const radial = ground.gx * ux + ground.gy * uy + ground.gz * uz;
  const gx = ground.gx - radial * ux;
  const gy = ground.gy - radial * uy;
  const gz = ground.gz - radial * uz;
  // The normal of r = R + h(û): û tilted against the slope, which is R / (R + h)
  // times shallower at the ground's actual radius.
  const stretch = terrain.radius / (terrain.radius + ground.height);
  const nx = ux - gx * stretch;
  const ny = uy - gy * stretch;
  const nz = uz - gz * stretch;
  const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
  return {
    height: ground.height,
    normal: { x: nx / length, y: ny / length, z: nz / length },
    // The gradient is tangential, so the normal leans by atan(|gradient| × stretch).
    slope: Math.atan(Math.sqrt(gx * gx + gy * gy + gz * gz) * stretch),
  };
}

/**
 * Height of `position` (body-fixed, metres from the centre) above the ground
 * straight below it, in metres; negative below ground.
 */
export function heightAboveTerrain(terrain: Terrain, position: Vector3): number {
  const r = Math.sqrt(position.x ** 2 + position.y ** 2 + position.z ** 2);
  return r - terrain.radius - terrainHeight(terrain, position);
}

// ---------------------------------------------------------------------------

/** The working state of one evaluation; reused, never returned to callers. */
interface Evaluation {
  /** Unit direction. */
  ux: number;
  uy: number;
  uz: number;
  height: number;
  /** Gradient of the height, metres per metre, not yet made tangential. */
  gx: number;
  gy: number;
  gz: number;
}

const result: Evaluation = { ux: 0, uy: 0, uz: 0, height: 0, gx: 0, gy: 0, gz: 0 };
const noise = noiseSample();
const onMap = { value: 0, gx: 0, gy: 0, gz: 0 };

function evaluate(terrain: Terrain, direction: Vector3, resolution: number): Evaluation {
  const inside = internals.get(terrain);
  if (!inside) throw new RangeError('terrain must come from createTerrain');
  const length = Math.sqrt(direction.x ** 2 + direction.y ** 2 + direction.z ** 2);
  positive(length, 'distance from the centre');
  const out = result;
  out.ux = direction.x / length;
  out.uy = direction.y / length;
  out.uz = direction.z / length;
  locate(terrain.grid, out.ux, out.uy, out.uz);
  sampleMap(terrain, inside.heights, onMap);
  out.height = onMap.value;
  out.gx = onMap.gx;
  out.gy = onMap.gy;
  out.gz = onMap.gz;
  if (terrain.detail) {
    sampleMap(terrain, inside.rugged, onMap);
    addDetail(terrain, inside, out, resolution, onMap);
  }
  return out;
}

function withPoles(grid: HeightGrid, values: ArrayLike<number>, scale: number): Map {
  const mean = (row: number) => {
    let sum = 0;
    for (let column = 0; column < grid.columns; column++) {
      sum += values[row * grid.columns + column]!;
    }
    return (sum / grid.columns) * scale;
  };
  return values.length === 1
    ? { values, scale, north: 0, south: 0 }
    : { values, scale, north: mean(0), south: mean(grid.rows - 1) };
}

// One map value, with rows past a pole continuing on the far side.
function mapValue(grid: HeightGrid, map: Map, row: number, column: number): number {
  let r = row;
  let c = column;
  if (r < 0) {
    r = -1 - r;
    c += grid.columns / 2;
  } else if (r >= grid.rows) {
    r = 2 * grid.rows - 1 - r;
    c += grid.columns / 2;
  }
  c %= grid.columns;
  if (c < 0) c += grid.columns;
  return map.values[r * grid.columns + c]!;
}

/**
 * The grid's slope magnitude (m/m) per cell from central differences, mapped to a
 * roughness factor between RUGGED_FLAT and RUGGED_STEEP.
 */
function ruggedness(grid: HeightGrid, radius: number): Float32Array {
  const { columns, rows } = grid;
  const heights: Map = { values: grid.samples, scale: grid.scale, north: 0, south: 0 };
  const out = new Float32Array(rows * columns);
  const northStep = (Math.PI / rows) * radius;
  for (let row = 0; row < rows; row++) {
    const latitude = Math.PI / 2 - ((row + 0.5) * Math.PI) / rows;
    const eastStep = ((2 * Math.PI) / columns) * radius * Math.cos(latitude);
    for (let column = 0; column < columns; column++) {
      const east =
        (mapValue(grid, heights, row, column + 1) - mapValue(grid, heights, row, column - 1)) *
        grid.scale;
      const north =
        (mapValue(grid, heights, row - 1, column) - mapValue(grid, heights, row + 1, column)) *
        grid.scale;
      const steepness = Math.sqrt((east / (2 * eastStep)) ** 2 + (north / (2 * northStep)) ** 2);
      out[row * columns + column] =
        RUGGED_FLAT + (RUGGED_STEEP - RUGGED_FLAT) * smoothstep(RUGGED_FROM, RUGGED_TO, steepness);
    }
  }
  return out;
}

// Where the current direction falls on the grid, shared by the height and
// ruggedness maps: the cell, Catmull–Rom weights and slopes along each axis, and
// the local east and north unit vectors.
const at = {
  row: 0,
  column: 0,
  rowAt: 0,
  /** cos(latitude): distance from the polar axis on the unit sphere. */
  horizontal: 0,
  ex: 0,
  ez: 0,
  nx: 0,
  ny: 0,
  nz: 0,
};
const weight = new Float64Array(4);
const slope = new Float64Array(4);
const rowWeight = new Float64Array(4);
const rowSlope = new Float64Array(4);

function locate(grid: HeightGrid, ux: number, uy: number, uz: number): void {
  const horizontal = Math.sqrt(ux * ux + uz * uz);
  const latitude = Math.atan2(uy, horizontal);
  let longitude = Math.atan2(-uz, ux);
  if (longitude < 0) longitude += 2 * Math.PI;
  // Pixel-registered: sample centres sit half a cell in from the edges.
  const columnAt = (longitude / (2 * Math.PI)) * grid.columns - 0.5;
  const rowAt = ((Math.PI / 2 - latitude) / Math.PI) * grid.rows - 0.5;
  at.column = Math.floor(columnAt);
  at.row = Math.floor(rowAt);
  at.rowAt = rowAt;
  at.horizontal = horizontal;
  catmullRom(columnAt - at.column, weight, slope);
  catmullRom(rowAt - at.row, rowWeight, rowSlope);
  // East is (−sin λ, 0, −cos λ) and north (−sin φ cos λ, cos φ, sin φ sin λ), with
  // sin φ = uy, cos φ = h, cos λ = ux / h, and sin λ = −uz / h. At a pole, where
  // east is undefined, the eased map is flat and these go unused.
  if (horizontal > 1e-12) {
    at.ex = uz / horizontal;
    at.ez = -ux / horizontal;
    at.nx = (-uy * ux) / horizontal;
    at.ny = horizontal;
    at.nz = (-uy * uz) / horizontal;
  } else {
    at.ex = at.ez = at.nx = at.nz = 0;
    at.ny = 1;
  }
}

function catmullRom(t: number, w: Float64Array, s: Float64Array): void {
  const t2 = t * t;
  const t3 = t2 * t;
  w[0] = 0.5 * (-t3 + 2 * t2 - t);
  w[1] = 0.5 * (3 * t3 - 5 * t2 + 2);
  w[2] = 0.5 * (-3 * t3 + 4 * t2 + t);
  w[3] = 0.5 * (t3 - t2);
  s[0] = 0.5 * (-3 * t2 + 4 * t - 1);
  s[1] = 0.5 * (9 * t2 - 10 * t);
  s[2] = 0.5 * (-9 * t2 + 8 * t + 1);
  s[3] = 0.5 * (3 * t2 - 2 * t);
}

/**
 * A map's smooth (bicubic Catmull–Rom) value at the located direction and its
 * gradient along the sphere, per metre at the reference radius. Within half a cell
 * of a pole it eases to the pole's mean, so it is single-valued and flat there.
 */
function sampleMap(
  terrain: Terrain,
  map: Map,
  out: { value: number; gx: number; gy: number; gz: number },
): void {
  const { grid, radius } = terrain;
  let value = 0;
  let perColumn = 0;
  let perRow = 0;
  for (let j = 0; j < 4; j++) {
    let across = 0;
    let acrossSlope = 0;
    for (let i = 0; i < 4; i++) {
      const sample = mapValue(grid, map, at.row - 1 + j, at.column - 1 + i);
      across += weight[i]! * sample;
      acrossSlope += slope[i]! * sample;
    }
    value += rowWeight[j]! * across;
    perColumn += rowWeight[j]! * acrossSlope;
    perRow += rowSlope[j]! * across;
  }
  value *= map.scale;
  perColumn *= map.scale;
  perRow *= map.scale;
  const { rowAt } = at;
  if (rowAt < 0 || rowAt > grid.rows - 1) {
    const pole = rowAt < 0 ? map.north : map.south;
    const into = rowAt < 0 ? -rowAt : rowAt - (grid.rows - 1);
    const s = smoothstep(0, 0.5, into);
    const ds = smoothstepSlope(0, 0.5, into) * (rowAt < 0 ? -1 : 1);
    perRow = perRow * (1 - s) + (pole - value) * ds;
    perColumn *= 1 - s;
    value += (pole - value) * s;
  }
  // Per radian of latitude (north) and longitude (east), then per metre at radius R.
  const north = (-perRow * grid.rows) / Math.PI / radius;
  const east =
    at.horizontal > 1e-12
      ? (perColumn * grid.columns) / (2 * Math.PI) / (radius * at.horizontal)
      : 0;
  out.value = value;
  out.gx = east * at.ex + north * at.nx;
  out.gy = north * at.ny;
  out.gz = east * at.ez + north * at.nz;
}

/** Roughness, craters, and boulders, evaluated at the point R·û. */
function addDetail(
  terrain: Terrain,
  inside: Internals,
  out: Evaluation,
  resolution: number,
  rugged: { value: number; gx: number; gy: number; gz: number },
): void {
  const R = terrain.radius;
  const px = out.ux * R;
  const py = out.uy * R;
  const pz = out.uz * R;
  const seed = terrain.seed;

  // Rolling roughness, scaled by the ruggedness (whose own gradient counts too).
  let rough = 0;
  let rx = 0;
  let ry = 0;
  let rz = 0;
  let octave = 0;
  for (const { wavelength, amplitude } of inside.roughness) {
    octave++;
    if (wavelength < resolution) break;
    gradientNoise(
      px / wavelength,
      py / wavelength,
      pz / wavelength,
      seed ^ (ROUGH_SALT + octave),
      noise,
    );
    rough += amplitude * noise.value;
    rx += (amplitude * noise.gx) / wavelength;
    ry += (amplitude * noise.gy) / wavelength;
    rz += (amplitude * noise.gz) / wavelength;
  }
  out.height += rugged.value * rough;
  out.gx += rugged.value * rx + rough * rugged.gx;
  out.gy += rugged.value * ry + rough * rugged.gy;
  out.gz += rugged.value * rz + rough * rugged.gz;

  // Craters, largest first.
  let layer = 0;
  for (let cell = CRATER_CELL_LARGEST; cell >= CRATER_CELL_SMALLEST; cell /= 2) {
    layer++;
    if (cell / 4 < resolution) break;
    features(px, py, pz, R, cell, seed ^ (CRATER_SALT + layer), CRATERS_PER_CELL, CRATER, out);
  }

  // Boulders, scaled by a smooth field so they gather in patches.
  bumps.height = bumps.gx = bumps.gy = bumps.gz = 0;
  let boulderLayer = 0;
  for (const cell of BOULDER_CELLS) {
    boulderLayer++;
    if (cell / 4 < resolution) break;
    features(
      px,
      py,
      pz,
      R,
      cell,
      seed ^ (BOULDER_SALT + boulderLayer),
      BOULDERS_PER_CELL,
      BOULDER,
      bumps,
    );
  }
  if (bumps.height !== 0) {
    const w = BOULDER_FIELD_WAVELENGTH;
    gradientNoise(px / w, py / w, pz / w, seed ^ FIELD_SALT, noise);
    const level = 0.5 + 0.5 * noise.value;
    const field = BOULDER_BACKGROUND + (1 - BOULDER_BACKGROUND) * smoothstep(0.62, 0.8, level);
    const fieldSlope = ((1 - BOULDER_BACKGROUND) * smoothstepSlope(0.62, 0.8, level) * 0.5) / w;
    out.height += field * bumps.height;
    out.gx += field * bumps.gx + bumps.height * fieldSlope * noise.gx;
    out.gy += field * bumps.gy + bumps.height * fieldSlope * noise.gy;
    out.gz += field * bumps.gz + bumps.height * fieldSlope * noise.gz;
  }
}

const CRATER = 0;
const BOULDER = 1;
const bumps = { height: 0, gx: 0, gy: 0, gz: 0 };
const profile = { slope: 0 };

/**
 * Adds every feature of one layer that reaches (px, py, pz), looking in the
 * 2 × 2 × 2 cells nearest the point (see FEATURE_REACH).
 */
function features(
  px: number,
  py: number,
  pz: number,
  R: number,
  cell: number,
  seed: number,
  perCell: number,
  kind: number,
  out: { height: number; gx: number; gy: number; gz: number },
): void {
  const fx = px / cell;
  const fy = py / cell;
  const fz = pz / cell;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const iz = Math.floor(fz);
  // The neighbour on the near side along each axis.
  const sx = fx - ix < 0.5 ? -1 : 1;
  const sy = fy - iy < 0.5 ? -1 : 1;
  const sz = fz - iz < 0.5 ? -1 : 1;
  const lowest = R - SHELL_HALF_WIDTH * cell;
  const highest = R + SHELL_HALF_WIDTH * cell;
  for (let n = 0; n < 8; n++) {
    const cx = ix + (n & 1 ? sx : 0);
    const cy = iy + (n & 2 ? sy : 0);
    const cz = iz + (n & 4 ? sz : 0);
    // Skip cells that cannot hold a centre within the shell.
    const near2 = nearest(cx, cell) ** 2 + nearest(cy, cell) ** 2 + nearest(cz, cell) ** 2;
    const far2 = farthest(cx, cell) ** 2 + farthest(cy, cell) ** 2 + farthest(cz, cell) ** 2;
    if (near2 >= highest * highest || far2 <= lowest * lowest) continue;
    const hash = hash3(cx, cy, cz, seed);
    for (let k = 0; k < perCell; k++) {
      // One hash places the centre: 11, 11, and 10 bits across the cell.
      const draw = k === 0 ? hash : rehash(hash, k);
      const qx = (cx + (draw >>> 21) / 2048) * cell;
      const qy = (cy + ((draw >>> 10) & 0x7ff) / 2048) * cell;
      const qz = (cz + (draw & 0x3ff) / 1024) * cell;
      const q = Math.sqrt(qx * qx + qy * qy + qz * qz);
      if (q <= lowest || q >= highest) continue;
      // Centre on the sphere, and the point's offset from it.
      const dx = px - (qx * R) / q;
      const dy = py - (qy * R) / q;
      const dz = pz - (qz * R) / q;
      const s = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // A second hash shapes it: 16 bits each for size and character.
      const shape = rehash(draw, 0x5f);
      const size = (shape >>> 16) / 65536;
      const character = (shape & 0xffff) / 65536;
      let radius: number;
      let height: number;
      let perMetre: number;
      if (kind === CRATER) {
        // Rim to rim, half a reach to a reach; the ejecta blanket reaches twice as far.
        radius = 0.5 * FEATURE_REACH * cell * (0.5 + 0.5 * size);
        if (s >= 2 * radius) continue;
        // Mostly old and shallow; a few fresh ones nearly as deep as a fifth of their width.
        const depth = radius * (0.08 + 0.32 * character ** 4);
        height = craterProfile(s / radius, depth, 0.2 * depth, profile);
        perMetre = s > 0 ? profile.slope / radius / s : 0;
      } else {
        // A rounded bump, (1 − x²)², as tall as 0.6 to 1.2 of its radius.
        radius = FEATURE_REACH * cell * (0.5 + 0.5 * size);
        if (s >= radius) continue;
        const tall = radius * (0.6 + 0.6 * character);
        const x2 = (s * s) / (radius * radius);
        const shoulder = 1 - x2;
        height = tall * shoulder * shoulder;
        perMetre = (-4 * tall * shoulder) / (radius * radius);
      }
      out.height += height;
      out.gx += perMetre * dx;
      out.gy += perMetre * dy;
      out.gz += perMetre * dz;
    }
  }
}

/** The coordinate of a cell's face nearest zero along one axis, or 0 if it spans zero. */
function nearest(index: number, cell: number): number {
  return index > 0 ? index * cell : index < -1 ? (index + 1) * cell : 0;
}

/** The coordinate of a cell's face farthest from zero along one axis. */
function farthest(index: number, cell: number): number {
  return Math.max(Math.abs(index * cell), Math.abs((index + 1) * cell));
}

/**
 * A simple bowl crater at x = distance / crater radius: a parabolic floor `depth`
 * below the surroundings rising to a rim `rim` above them, then an ejecta blanket
 * falling as x⁻³ and fading out by x = 2. The rim crest is rounded (a smooth
 * minimum) so normals turn continuously. Writes d(height)/dx to `out.slope`.
 */
function craterProfile(x: number, depth: number, rim: number, out: { slope: number }): number {
  const inner = -depth + (depth + rim) * x * x;
  const innerSlope = 2 * (depth + rim) * x;
  if (x < 0.5) {
    out.slope = innerSlope;
    return inner;
  }
  // The ejecta, windowed to reach zero with zero slope at x = 2.
  let window = 1;
  let windowSlope = 0;
  if (x > 1) {
    const e = x - 1;
    const f = 1 - e * e;
    window = f * f;
    windowSlope = -4 * e * f;
  }
  const inverseCube = 1 / (x * x * x);
  const outer = rim * inverseCube * window;
  const outerSlope = rim * inverseCube * ((-3 * window) / x + windowSlope);
  const k = 0.6 * rim;
  const blend = clamp(0.5 + (0.5 * (outer - inner)) / k, 0, 1);
  out.slope = outerSlope + (innerSlope - outerSlope) * blend;
  return outer + (inner - outer) * blend - k * blend * (1 - blend);
}

/**
 * Generous bounds on how far detail can raise or lower the ground, in metres:
 * the roughness's largest sum, four overlapping rims and two stacked bowls per
 * crater layer, and two stacked boulders.
 */
function detailBound(roughness: readonly { readonly amplitude: number }[]): {
  up: number;
  down: number;
} {
  // Perlin noise stays within ±1.04 in three dimensions; ruggedness scales it up to 1.8×.
  const rough = roughness.reduce((sum, octave) => sum + octave.amplitude, 0) * 1.04 * RUGGED_STEEP;
  let rims = 0;
  let bowls = 0;
  for (let cell = CRATER_CELL_LARGEST; cell >= CRATER_CELL_SMALLEST; cell /= 2) {
    const deepest = 0.5 * FEATURE_REACH * cell * 0.4;
    rims += 4 * 0.2 * deepest;
    bowls += 2 * deepest;
  }
  const boulder = 2 * FEATURE_REACH * BOULDER_CELLS[0] * 1.2;
  return { up: rough + rims + boulder, down: rough + bowls };
}
