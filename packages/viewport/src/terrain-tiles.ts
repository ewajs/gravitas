import { terrainHeight, type Terrain, type Vector3 } from '@gravitas/engine';

// Terrain tiles (ADR 0022): the body's sphere split into the six faces of a cube,
// each face a quadtree of square tiles. A tile is a grid of vertices placed by the
// engine's height function, so what is drawn is what the legs touch. Pure
// arithmetic, no Three.js, so a worker can run it.

/** One tile: a cube face (0–5), a quadtree level, and its column and row there. */
export interface TileKey {
  readonly face: number;
  readonly level: number;
  readonly x: number;
  readonly y: number;
}

/** A tile's vertices relative to its origin, ready for a buffer geometry. */
export interface TileMesh {
  readonly key: TileKey;
  /** Body-fixed metres; vertices are relative to it, so float32 stays precise. */
  readonly origin: Vector3;
  /** (segments + 1)² surface vertices, then four skirts of segments + 1 each. */
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  /**
   * Where each vertex sits on the parent tile's drawn surface, and the parent's
   * normal there: drawn at these, the tile looks exactly like its parent, so the
   * view can morph between the two instead of popping (ADR 0022). A root tile's
   * are its own.
   */
  readonly coarsePositions: Float32Array;
  readonly coarseNormals: Float32Array;
  /** Colour-map coordinates: u = 0.5 + longitude / 2π (unwrapped near the tile), v = 0.5 + latitude / π. */
  readonly uvs: Float32Array;
  /** Lowest and highest surface vertex above the reference radius, in metres. */
  readonly minimumHeight: number;
  readonly maximumHeight: number;
}

/** Quads along each tile edge. */
export const TILE_SEGMENTS = 32;

/**
 * The terrain's detail resolution, in vertex spacings: features fade in as they
 * grow from this many spacings across to twice as many, and crater rims round off
 * over a spacing either side. Fewer spacings alias: under the low Sun, a crater or
 * boulder only two or three vertices across shades as a black speck.
 */
export const DETAIL_SPACINGS = 2;

// Each face: outward axis, and the in-face directions of increasing x and y,
// with u × v = axis so triangles wound counter-clockwise face outward.
const FACES: readonly (readonly [Vector3, Vector3, Vector3])[] = [
  [
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 0, z: -1 },
    { x: 0, y: 1, z: 0 },
  ],
  [
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 1, z: 0 },
  ],
  [
    { x: 0, y: 1, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 0, z: -1 },
  ],
  [
    { x: 0, y: -1, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
  ],
  [
    { x: 0, y: 0, z: 1 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
  ],
  [
    { x: 0, y: 0, z: -1 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
  ],
];

/**
 * The unit direction at face coordinates (s, t) ∈ [−1, 1]². A tangent warp makes
 * cells nearly equal in angle across the face (within about 30%, against 5× for
 * a plain cube projection).
 */
export function faceDirection(face: number, s: number, t: number): Vector3 {
  const [axis, u, v] = FACES[face]!;
  const a = Math.tan((s * Math.PI) / 4);
  const b = Math.tan((t * Math.PI) / 4);
  const x = axis.x + a * u.x + b * v.x;
  const y = axis.y + a * u.y + b * v.y;
  const z = axis.z + a * u.z + b * v.z;
  const length = Math.sqrt(x * x + y * y + z * z);
  return { x: x / length, y: y / length, z: z / length };
}

/** A tile's span in face coordinates: [s0, s1] × [t0, t1]. */
export function tileSpan(key: TileKey): { s0: number; s1: number; t0: number; t1: number } {
  const size = 2 / 2 ** key.level;
  return {
    s0: -1 + key.x * size,
    s1: -1 + (key.x + 1) * size,
    t0: -1 + key.y * size,
    t1: -1 + (key.y + 1) * size,
  };
}

/** About how long a tile's edge is on the reference sphere, in metres. */
export function tileEdge(radius: number, level: number): number {
  return ((Math.PI / 2) * radius) / 2 ** level;
}

/** The four quarters of a tile, one level down. */
export function tileChildren(key: TileKey): TileKey[] {
  const level = key.level + 1;
  const x = key.x * 2;
  const y = key.y * 2;
  return [
    { face: key.face, level, x, y },
    { face: key.face, level, x: x + 1, y },
    { face: key.face, level, x, y: y + 1 },
    { face: key.face, level, x: x + 1, y: y + 1 },
  ];
}

/** A stable text id, for maps and messages. */
export function tileId(key: TileKey): string {
  return `${key.face}/${key.level}/${key.x}/${key.y}`;
}

/**
 * The triangles shared by every tile: the surface grid wound outward, and each
 * skirt wound both ways so it hides gaps from either side.
 */
export function tileIndices(segments = TILE_SEGMENTS): Uint16Array {
  const row = segments + 1;
  const surface = row * row;
  const indices: number[] = [];
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * row + i;
      indices.push(a, a + 1, a + row + 1, a, a + row + 1, a + row);
    }
  }
  // Skirts hang from the edges in the order of edgeVertex: bottom, right, top, left.
  for (let edge = 0; edge < 4; edge++) {
    for (let k = 0; k < segments; k++) {
      const top0 = edgeVertex(edge, k, segments);
      const top1 = edgeVertex(edge, k + 1, segments);
      const low0 = surface + edge * row + k;
      const low1 = low0 + 1;
      indices.push(top0, low0, low1, top0, low1, top1);
      indices.push(top0, low1, low0, top0, top1, low1);
    }
  }
  return Uint16Array.from(indices);
}

// The surface vertex at step k along an edge: 0 bottom (y = 0), 1 right (x = max),
// 2 top (y = max), 3 left (x = 0).
function edgeVertex(edge: number, k: number, segments: number): number {
  const row = segments + 1;
  switch (edge) {
    case 0:
      return k;
    case 1:
      return k * row + segments;
    case 2:
      return segments * row + k;
    default:
      return k * row;
  }
}

/**
 * Meshes one tile from the terrain, with normals from the drawn surface itself,
 * band-limited to DETAIL_SPACINGS vertex spacings, and the parent's surface under
 * every vertex to morph from. Skirts hang `skirt` of the tile's edge below each
 * border to hide cracks against coarser neighbours.
 */
export function meshTile(
  terrain: Terrain,
  key: TileKey,
  segments = TILE_SEGMENTS,
  skirt = 0.05,
): TileMesh {
  const R = terrain.radius;
  const { s0, s1, t0, t1 } = tileSpan(key);
  const edge = tileEdge(R, key.level);
  const resolution = (DETAIL_SPACINGS * edge) / segments;
  const centre = faceDirection(key.face, (s0 + s1) / 2, (t0 + t1) / 2);
  const centreGround = R + terrainHeight(terrain, centre, resolution);
  const origin = {
    x: centre.x * centreGround,
    y: centre.y * centreGround,
    z: centre.z * centreGround,
  };
  const centreLongitude = Math.atan2(-centre.z, centre.x);
  const row = segments + 1;
  // Ground points on a grid one vertex wider on every side, so normals at the
  // edges see their neighbours in the next tile and shading has no seams.
  const wide = row + 2;
  const ground = new Float64Array(wide * wide * 3);
  const directions = new Float64Array(wide * wide * 3);
  const heights = new Float64Array(wide * wide);
  sampleGround(
    terrain,
    key.face,
    s0,
    t0,
    (s1 - s0) / segments,
    -1,
    wide,
    resolution,
    ground,
    heights,
    directions,
  );
  const count = row * row + 4 * row;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const coarsePositions = new Float32Array(count * 3);
  const coarseNormals = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  let minimumHeight = Infinity;
  let maximumHeight = -Infinity;
  for (let j = 0; j < row; j++) {
    for (let i = 0; i < row; i++) {
      const w = (j + 1) * wide + (i + 1);
      const n = j * row + i;
      positions[n * 3] = ground[w * 3]! - origin.x;
      positions[n * 3 + 1] = ground[w * 3 + 1]! - origin.y;
      positions[n * 3 + 2] = ground[w * 3 + 2]! - origin.z;
      surfaceNormal(ground, w, wide, normals, n);
      const dx = directions[w * 3]!;
      const dy = directions[w * 3 + 1]!;
      const dz = directions[w * 3 + 2]!;
      let longitude = Math.atan2(-dz, dx);
      if (longitude - centreLongitude > Math.PI) longitude -= 2 * Math.PI;
      else if (centreLongitude - longitude > Math.PI) longitude += 2 * Math.PI;
      uvs[n * 2] = 0.5 + longitude / (2 * Math.PI);
      uvs[n * 2 + 1] = 0.5 + Math.asin(Math.max(-1, Math.min(1, dy))) / Math.PI;
      const h = heights[w]!;
      minimumHeight = Math.min(minimumHeight, h);
      maximumHeight = Math.max(maximumHeight, h);
    }
  }
  if (key.level === 0) {
    coarsePositions.set(positions);
    coarseNormals.set(normals);
  } else {
    parentSurface(terrain, key, segments, 2 * resolution, origin, coarsePositions, coarseNormals);
  }
  // Skirts: copies of the edge vertices, lowered toward the centre.
  const drop = skirt * edge;
  for (let side = 0; side < 4; side++) {
    for (let k = 0; k < row; k++) {
      const from = edgeVertex(side, k, segments);
      const to = row * row + side * row + k;
      lower(positions, from, to, origin, drop);
      lower(coarsePositions, from, to, origin, drop);
      normals.copyWithin(to * 3, from * 3, from * 3 + 3);
      coarseNormals.copyWithin(to * 3, from * 3, from * 3 + 3);
      uvs.copyWithin(to * 2, from * 2, from * 2 + 2);
    }
  }
  return {
    key,
    origin,
    positions,
    normals,
    coarsePositions,
    coarseNormals,
    uvs,
    minimumHeight,
    maximumHeight,
  };
}

/**
 * Ground points on a `size` × `size` grid of face coordinates starting `from`
 * steps before (s0, t0), `step` apart, sampled at `resolution`.
 */
function sampleGround(
  terrain: Terrain,
  face: number,
  s0: number,
  t0: number,
  step: number,
  from: number,
  size: number,
  resolution: number,
  ground: Float64Array,
  heights?: Float64Array,
  directions?: Float64Array,
): void {
  const R = terrain.radius;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const d = faceDirection(face, s0 + step * (i + from), t0 + step * (j + from));
      const h = terrainHeight(terrain, d, resolution);
      const n = j * size + i;
      if (heights) heights[n] = h;
      if (directions) {
        directions[n * 3] = d.x;
        directions[n * 3 + 1] = d.y;
        directions[n * 3 + 2] = d.z;
      }
      ground[n * 3] = d.x * (R + h);
      ground[n * 3 + 1] = d.y * (R + h);
      ground[n * 3 + 2] = d.z * (R + h);
    }
  }
}

/**
 * The drawn surface's unit normal at grid point `w` of a `size`-wide grid, from
 * central differences along x and y, crossed (x then y is counter-clockwise from
 * outside, so it points out); written at vertex `n` of `out`.
 */
function surfaceNormal(
  ground: Float64Array,
  w: number,
  size: number,
  out: Float32Array,
  n: number,
): void {
  const east = w + 1;
  const west = w - 1;
  const north = w + size;
  const south = w - size;
  const ax = ground[east * 3]! - ground[west * 3]!;
  const ay = ground[east * 3 + 1]! - ground[west * 3 + 1]!;
  const az = ground[east * 3 + 2]! - ground[west * 3 + 2]!;
  const bx = ground[north * 3]! - ground[south * 3]!;
  const by = ground[north * 3 + 1]! - ground[south * 3 + 1]!;
  const bz = ground[north * 3 + 2]! - ground[south * 3 + 2]!;
  const nx = ay * bz - az * by;
  const ny = az * bx - ax * bz;
  const nz = ax * by - ay * bx;
  const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
  out[n * 3] = nx / length;
  out[n * 3 + 1] = ny / length;
  out[n * 3 + 2] = nz / length;
}

/**
 * The parent tile's surface under each of this tile's surface vertices, as the
 * parent draws it: its vertices fall on every other one of ours; between them, on
 * the midpoint of a parent edge or (both odd) of the diagonal its quads are split
 * along, so drawn at these our triangles lie flat in the parent's.
 */
function parentSurface(
  terrain: Terrain,
  key: TileKey,
  segments: number,
  resolution: number,
  origin: Vector3,
  positions: Float32Array,
  normals: Float32Array,
): void {
  const { s0, t0, s1 } = tileSpan(key);
  const half = segments / 2;
  // The parent's vertices over this tile, one more on every side for normals.
  const wide = half + 3;
  const ground = new Float64Array(wide * wide * 3);
  sampleGround(terrain, key.face, s0, t0, (2 * (s1 - s0)) / segments, -1, wide, resolution, ground);
  const parentNormals = new Float32Array(wide * wide * 3);
  for (let b = 1; b < wide - 1; b++) {
    for (let a = 1; a < wide - 1; a++)
      surfaceNormal(ground, b * wide + a, wide, parentNormals, b * wide + a);
  }
  const row = segments + 1;
  // Average the parent points at (i0, j0) and (i1, j1), in this tile's indices (even).
  const average = (n: number, i0: number, j0: number, i1: number, j1: number) => {
    const p = (j0 / 2 + 1) * wide + (i0 / 2 + 1);
    const q = (j1 / 2 + 1) * wide + (i1 / 2 + 1);
    positions[n * 3] = (ground[p * 3]! + ground[q * 3]!) / 2 - origin.x;
    positions[n * 3 + 1] = (ground[p * 3 + 1]! + ground[q * 3 + 1]!) / 2 - origin.y;
    positions[n * 3 + 2] = (ground[p * 3 + 2]! + ground[q * 3 + 2]!) / 2 - origin.z;
    const nx = parentNormals[p * 3]! + parentNormals[q * 3]!;
    const ny = parentNormals[p * 3 + 1]! + parentNormals[q * 3 + 1]!;
    const nz = parentNormals[p * 3 + 2]! + parentNormals[q * 3 + 2]!;
    const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
    normals[n * 3] = nx / length;
    normals[n * 3 + 1] = ny / length;
    normals[n * 3 + 2] = nz / length;
  };
  for (let j = 0; j < row; j++) {
    for (let i = 0; i < row; i++) {
      const n = j * row + i;
      const oddI = i % 2;
      const oddJ = j % 2;
      if (oddI && oddJ) average(n, i - 1, j - 1, i + 1, j + 1);
      else if (oddI) average(n, i - 1, j, i + 1, j);
      else if (oddJ) average(n, i, j - 1, i, j + 1);
      else average(n, i, j, i, j);
    }
  }
}

/** Copies surface vertex `from` to skirt vertex `to`, `drop` metres nearer the centre. */
function lower(
  positions: Float32Array,
  from: number,
  to: number,
  origin: Vector3,
  drop: number,
): void {
  const x = positions[from * 3]! + origin.x;
  const y = positions[from * 3 + 1]! + origin.y;
  const z = positions[from * 3 + 2]! + origin.z;
  const r = Math.sqrt(x * x + y * y + z * z);
  const lowered = (r - drop) / r;
  positions[to * 3] = x * lowered - origin.x;
  positions[to * 3 + 1] = y * lowered - origin.y;
  positions[to * 3 + 2] = z * lowered - origin.z;
}
