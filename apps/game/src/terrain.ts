import { createTerrain, MOON, type HeightGrid, type Terrain } from '@gravitas/engine';

// The Moon's ground (5.4, ADR 0021): NASA's LOLA LDEM_4 elevation grid, written by
// `npm run moon-data`, plus procedural detail from one fixed seed, so every spot
// always looks and feels the same.

/** The detail seed: the same Moon for every player and every flight. */
export const MOON_TERRAIN_SEED = 0x6c756e61;

/** LDEM_4's layout: 4 samples per degree, 16-bit integers in half metres above 1,737.4 km. */
export const LDEM_4 = { columns: 1440, rows: 720, scale: 0.5 } as const;

/** Where the game serves the grid, under the app's base URL. */
export const LDEM_4_PATH = 'moon/ldem-4.bin';

/**
 * The grid from the file's bytes: little-endian 16-bit integers, read explicitly so
 * the result is the same on any platform's byte order.
 */
export function decodeHeightGrid(bytes: ArrayBuffer): HeightGrid {
  const { columns, rows, scale } = LDEM_4;
  if (bytes.byteLength !== columns * rows * 2) {
    throw new RangeError(
      `elevation grid: expected ${columns * rows * 2} bytes, got ${bytes.byteLength}`,
    );
  }
  const view = new DataView(bytes);
  const samples = new Int16Array(columns * rows);
  for (let n = 0; n < samples.length; n++) samples[n] = view.getInt16(n * 2, true);
  return { columns, rows, samples, scale };
}

/** The Moon's terrain from the grid's bytes. */
export function moonTerrain(bytes: ArrayBuffer): Terrain {
  return createTerrain({
    radius: MOON.radius,
    grid: decodeHeightGrid(bytes),
    seed: MOON_TERRAIN_SEED,
  });
}

/** Downloads the grid (about 2 MB, once; the browser caches it) and builds the terrain. */
export async function loadMoonTerrain(baseUrl: string): Promise<Terrain> {
  const response = await fetch(`${baseUrl}${LDEM_4_PATH}`);
  if (!response.ok) throw new Error(`elevation grid: HTTP ${response.status}`);
  return moonTerrain(await response.arrayBuffer());
}
