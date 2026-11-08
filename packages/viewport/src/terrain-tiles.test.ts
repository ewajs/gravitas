import { describe, expect, it } from 'vitest';
import { createTerrain, terrainHeight, type Vector3 } from '@gravitas/engine';
import {
  faceDirection,
  meshTile,
  TILE_SEGMENTS,
  tileChildren,
  tileIndices,
  tileSpan,
  type TileKey,
} from './terrain-tiles';
import { createTerrainTiles } from './terrain';
import { MeshStandardNodeMaterial } from 'three/webgpu';

const R = 1_737_400;
const columns = 72;
const rows = 36;

function grid(height: (row: number, column: number) => number) {
  const samples = new Float64Array(rows * columns);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      samples[row * columns + column] = height(row, column);
    }
  }
  return { columns, rows, samples, scale: 1 };
}

const level = createTerrain({ radius: R, grid: grid(() => 0), seed: 3, detail: false });
const hilly = createTerrain({
  radius: R,
  grid: grid((row, column) => 3000 * Math.sin(row / 3) * Math.cos(column / 5)),
  seed: 3,
});

const length = (v: Vector3) => Math.hypot(v.x, v.y, v.z);
const dot = (a: Vector3, b: Vector3) => a.x * b.x + a.y * b.y + a.z * b.z;

describe('cube-sphere tiles', () => {
  it('puts each face around its axis and meets neighbouring faces edge to edge', () => {
    expect(faceDirection(0, 0, 0)).toEqual({ x: 1, y: 0, z: 0 });
    expect(faceDirection(3, 0, 0)).toEqual({ x: 0, y: -1, z: 0 });
    for (const t of [-1, -0.4, 0.3, 1]) {
      // +X's right edge is −Z's left edge, with the same parameter along it.
      const a = faceDirection(0, 1, t);
      const b = faceDirection(5, -1, t);
      expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeLessThan(1e-15);
      expect(length(a)).toBeCloseTo(1, 15);
    }
  });

  it('splits a tile into four quarters that cover it exactly', () => {
    const parent: TileKey = { face: 2, level: 3, x: 5, y: 2 };
    const span = tileSpan(parent);
    const quarters = tileChildren(parent).map(tileSpan);
    expect(Math.min(...quarters.map((q) => q.s0))).toBe(span.s0);
    expect(Math.max(...quarters.map((q) => q.s1))).toBe(span.s1);
    expect(Math.min(...quarters.map((q) => q.t0))).toBe(span.t0);
    expect(Math.max(...quarters.map((q) => q.t1))).toBe(span.t1);
    const area = quarters.reduce((sum, q) => sum + (q.s1 - q.s0) * (q.t1 - q.t0), 0);
    expect(area).toBeCloseTo((span.s1 - span.s0) * (span.t1 - span.t0), 15);
  });

  it('winds every surface triangle outward and indexes only real vertices', () => {
    const tile = meshTile(level, { face: 4, level: 2, x: 1, y: 2 });
    const indices = tileIndices();
    const vertices = tile.positions.length / 3;
    expect(vertices).toBe((TILE_SEGMENTS + 1) ** 2 + 4 * (TILE_SEGMENTS + 1));
    expect(Math.max(...indices)).toBeLessThan(vertices);
    const at = (n: number) => ({
      x: tile.positions[n * 3]! + tile.origin.x,
      y: tile.positions[n * 3 + 1]! + tile.origin.y,
      z: tile.positions[n * 3 + 2]! + tile.origin.z,
    });
    const surfaceTriangles = TILE_SEGMENTS * TILE_SEGMENTS * 2;
    for (let n = 0; n < surfaceTriangles; n++) {
      const a = at(indices[n * 3]!);
      const b = at(indices[n * 3 + 1]!);
      const c = at(indices[n * 3 + 2]!);
      const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
      const v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
      const normal = {
        x: u.y * v.z - u.z * v.y,
        y: u.z * v.x - u.x * v.z,
        z: u.x * v.y - u.y * v.x,
      };
      expect(dot(normal, a)).toBeGreaterThan(0);
    }
  });
});

describe('meshing a tile from the terrain', () => {
  it('places vertices on the ground and normals straight up on level ground', () => {
    const tile = meshTile(level, { face: 1, level: 5, x: 9, y: 20 });
    const surface = (TILE_SEGMENTS + 1) ** 2;
    for (let n = 0; n < surface; n += 7) {
      const p = {
        x: tile.positions[n * 3]! + tile.origin.x,
        y: tile.positions[n * 3 + 1]! + tile.origin.y,
        z: tile.positions[n * 3 + 2]! + tile.origin.z,
      };
      expect(length(p) - R).toBeCloseTo(0, 1);
      const normal = {
        x: tile.normals[n * 3]!,
        y: tile.normals[n * 3 + 1]!,
        z: tile.normals[n * 3 + 2]!,
      };
      expect(dot(normal, p) / length(p)).toBeCloseTo(1, 6);
    }
  });

  it('draws the engine’s height at every vertex, at the tile’s resolution', () => {
    const key: TileKey = { face: 4, level: 9, x: 300, y: 260 };
    const tile = meshTile(hilly, key);
    const span = tileSpan(key);
    const resolution = (3 * ((Math.PI / 2) * R)) / 2 ** key.level / TILE_SEGMENTS;
    for (const [i, j] of [
      [0, 0],
      [5, 17],
      [32, 32],
      [16, 3],
    ] as const) {
      const d = faceDirection(
        key.face,
        span.s0 + ((span.s1 - span.s0) * i) / TILE_SEGMENTS,
        span.t0 + ((span.t1 - span.t0) * j) / TILE_SEGMENTS,
      );
      const n = j * (TILE_SEGMENTS + 1) + i;
      const drawn = length({
        x: tile.positions[n * 3]! + tile.origin.x,
        y: tile.positions[n * 3 + 1]! + tile.origin.y,
        z: tile.positions[n * 3 + 2]! + tile.origin.z,
      });
      // Float32 offsets from the tile's origin: within a few millimetres here.
      expect(Math.abs(drawn - R - terrainHeight(hilly, d, resolution))).toBeLessThan(0.01);
    }
  });

  it('shares edge vertices with its neighbour at the same level: no cracks', () => {
    const left = meshTile(hilly, { face: 0, level: 6, x: 10, y: 33 });
    const right = meshTile(hilly, { face: 0, level: 6, x: 11, y: 33 });
    const row = TILE_SEGMENTS + 1;
    for (let j = 0; j < row; j++) {
      const a = (j * row + TILE_SEGMENTS) * 3;
      const b = j * row * 3;
      for (let k = 0; k < 3; k++) {
        const axis = (['x', 'y', 'z'] as const)[k]!;
        expect(left.positions[a + k]! + left.origin[axis]).toBeCloseTo(
          right.positions[b + k]! + right.origin[axis],
          1,
        );
      }
    }
  });

  it('hangs skirts below every edge to hide cracks against coarser tiles', () => {
    const tile = meshTile(hilly, { face: 2, level: 4, x: 3, y: 7 });
    const row = TILE_SEGMENTS + 1;
    const radius = (n: number) =>
      length({
        x: tile.positions[n * 3]! + tile.origin.x,
        y: tile.positions[n * 3 + 1]! + tile.origin.y,
        z: tile.positions[n * 3 + 2]! + tile.origin.z,
      });
    const edge = ((Math.PI / 2) * R) / 2 ** 4;
    // The bottom edge's first vertex and its skirt copy.
    expect(radius(0) - radius(row * row)).toBeCloseTo(0.05 * edge, 0);
  });
});

describe('the tile quadtree', () => {
  it('starts from six faces and refines toward a camera near the ground', async () => {
    const tiles = createTerrainTiles(level, new MeshStandardNodeMaterial());
    const camera = { x: 0, y: R + 200, z: 0 };
    let stats = tiles.update(camera);
    expect(tiles.ready).toBe(false);
    // Meshing runs on later tasks (no workers in Node); let it finish.
    for (let round = 0; round < 400 && (stats.pending > 0 || !tiles.ready); round++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      stats = tiles.update(camera);
    }
    expect(tiles.ready).toBe(true);
    expect(stats.pending).toBe(0);
    // 200 m up, the finest tiles are drawn under the camera.
    expect(stats.deepest).toBeGreaterThanOrEqual(15);
    // Nothing beyond the horizon (about 26 km away from 200 m up) is drawn: every
    // tile reaches within a few kilometres of the visible cap.
    for (const key of tiles.drawnKeys()) {
      const span = tileSpan(key);
      const corners = [
        faceDirection(key.face, span.s0, span.t0),
        faceDirection(key.face, span.s1, span.t0),
        faceDirection(key.face, span.s0, span.t1),
        faceDirection(key.face, span.s1, span.t1),
      ];
      const closest = Math.min(...corners.map((c) => Math.acos(Math.min(1, c.y))));
      const across = Math.max(
        ...corners.map((c) =>
          Math.acos(
            Math.min(
              1,
              dot(c, faceDirection(key.face, (span.s0 + span.s1) / 2, (span.t0 + span.t1) / 2)),
            ),
          ),
        ),
      );
      expect(closest - 2 * across).toBeLessThan(Math.acos(R / (R + 200)));
    }
    tiles.dispose();
  });
});
