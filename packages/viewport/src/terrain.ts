import * as THREE from 'three/webgpu';
import {
  attribute,
  Fn,
  mix,
  normalGeometry,
  normalLocal,
  positionGeometry,
  uniform,
} from 'three/tsl';
import type { Terrain, Vector3 } from '@gravitas/engine';
import {
  faceDirection,
  meshTile,
  tileChildren,
  tileEdge,
  tileId,
  tileIndices,
  tileSpan,
  type TileKey,
  type TileMesh,
} from './terrain-tiles';
import type { TerrainWorkerRequest } from './terrain-worker';

// The drawn terrain (ADR 0022): a quadtree of tiles per cube face, split near the
// camera and culled beyond the horizon, meshed in a worker from the engine's
// height function. Tiles sit in the body-fixed frame inside one group; the planet
// places that group in the vehicle-centred world.

/** Split a tile while the camera is closer than this many tile edges. */
const SPLIT_DISTANCE = 2.5;
/**
 * Finest level: edges about 5 m, vertices about 16 cm apart on the Moon, so the
 * smallest craters and boulders (1.4 m) are drawn whole where the legs can touch.
 */
const MAXIMUM_LEVEL = 19;
/** Meshes kept, drawn or not, before the least recently used are released. */
const CAPACITY = 600;
/** Tiles being meshed at once; more wait their turn, nearest first. */
const IN_FLIGHT = 4;
/** A tile replacing its parent on screen grows from the parent's surface over this long. */
const GROW_SECONDS = 0.4;

interface Node {
  readonly key: TileKey;
  readonly id: string;
  /** Unit direction of the tile's centre. */
  readonly centre: Vector3;
  /** Largest angle from the centre to a corner, in radians. */
  readonly spread: number;
  readonly edge: number;
  children?: readonly Node[];
  mesh?: THREE.Mesh | undefined;
  requested: boolean;
  minimumHeight: number;
  maximumHeight: number;
  /** Frame number when last visited by selection. */
  used: number;
  /** When it last replaced its parent on screen, in seconds; it grows in from there. */
  grown: number;
}

/** What the terrain did on the last update, for diagnostics and tests. */
export interface TerrainStats {
  readonly drawn: number;
  readonly cached: number;
  readonly pending: number;
  readonly deepest: number;
}

/** Meshes tiles somewhere: a worker in browsers, or inline as a fallback. */
interface TileMesher {
  request(key: TileKey): void;
  dispose(): void;
}

function workerMesher(terrain: Terrain, deliver: (mesh: TileMesh) => void): TileMesher {
  const worker = new Worker(new URL('./terrain-worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<TileMesh>) => deliver(event.data);
  const options = {
    radius: terrain.radius,
    grid: {
      columns: terrain.grid.columns,
      rows: terrain.grid.rows,
      samples: terrain.grid.samples,
      scale: terrain.grid.scale,
    },
    seed: terrain.seed,
    detail: terrain.detail,
  };
  worker.postMessage({ type: 'terrain', options } satisfies TerrainWorkerRequest);
  return {
    request: (key) => worker.postMessage({ type: 'tile', key } satisfies TerrainWorkerRequest),
    dispose: () => worker.terminate(),
  };
}

// Without workers (tests, locked-down pages): one tile per request, on the next task.
function inlineMesher(terrain: Terrain, deliver: (mesh: TileMesh) => void): TileMesher {
  let live = true;
  return {
    request: (key) =>
      setTimeout(() => {
        if (live) deliver(meshTile(terrain, key));
      }, 0),
    dispose: () => {
      live = false;
    },
  };
}

/**
 * Builds the tile quadtree for `terrain`, drawn with `material`, which becomes
 * the tiles' own: its position node is set to grow each new tile out of its
 * parent's surface (ADR 0022).
 */
export function createTerrainTiles(terrain: Terrain, material: THREE.NodeMaterial) {
  material.positionNode = morph();
  const group = new THREE.Group();
  const index = new THREE.BufferAttribute(tileIndices(), 1);
  const nodes = new Map<string, Node>();
  let mesher: TileMesher;
  try {
    mesher = workerMesher(terrain, receive);
  } catch {
    mesher = inlineMesher(terrain, receive);
  }
  const queue: Node[] = [];
  let inFlight = 0;
  let frame = 0;
  let drawn: Node[] = [];
  let cached = 0;
  let deepest = 0;
  let disposed = false;

  function node(key: TileKey): Node {
    const id = tileId(key);
    const existing = nodes.get(id);
    if (existing) return existing;
    const { s0, s1, t0, t1 } = tileSpan(key);
    const centre = faceDirection(key.face, (s0 + s1) / 2, (t0 + t1) / 2);
    let spread = 0;
    for (const [s, t] of [
      [s0, t0],
      [s1, t0],
      [s0, t1],
      [s1, t1],
    ] as const) {
      const corner = faceDirection(key.face, s, t);
      const cos = centre.x * corner.x + centre.y * corner.y + centre.z * corner.z;
      spread = Math.max(spread, Math.acos(Math.min(1, cos)));
    }
    const created: Node = {
      key,
      id,
      centre,
      spread,
      edge: tileEdge(terrain.radius, key.level),
      requested: false,
      minimumHeight: terrain.minimumHeight,
      maximumHeight: terrain.maximumHeight,
      used: 0,
      grown: -Infinity,
    };
    nodes.set(id, created);
    return created;
  }

  const roots = Array.from({ length: 6 }, (_, face) => node({ face, level: 0, x: 0, y: 0 }));

  function receive(tile: TileMesh): void {
    inFlight--;
    if (disposed) return;
    const target = nodes.get(tileId(tile.key));
    if (!target || target.mesh) return pump();
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(index);
    geometry.setAttribute('position', new THREE.BufferAttribute(tile.positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(tile.normals, 3));
    geometry.setAttribute('coarsePosition', new THREE.BufferAttribute(tile.coarsePositions, 3));
    geometry.setAttribute('coarseNormal', new THREE.BufferAttribute(tile.coarseNormals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(tile.uvs, 2));
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(tile.origin.x, tile.origin.y, tile.origin.z);
    mesh.receiveShadow = true;
    mesh.visible = false;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    mesh.name = target.id;
    mesh.userData.parent = 0;
    group.add(mesh);
    target.mesh = mesh;
    target.minimumHeight = tile.minimumHeight;
    target.maximumHeight = tile.maximumHeight;
    cached++;
    pump();
  }

  // Every tile shares one index buffer: detach it so disposing a tile keeps it.
  function release(geometry: THREE.BufferGeometry): void {
    geometry.setIndex(null);
    geometry.dispose();
  }

  function want(target: Node): void {
    if (target.requested) return;
    target.requested = true;
    queue.push(target);
  }

  // Sends queued requests, coarsest and most recently wanted first.
  function pump(): void {
    if (disposed) return;
    queue.sort((a, b) => a.key.level - b.key.level || b.used - a.used);
    while (inFlight < IN_FLIGHT && queue.length) {
      const next = queue.shift()!;
      // Wanted long ago and not since: let it go; it is requested again if needed.
      if (frame - next.used > 30 && next.key.level > 0) {
        next.requested = false;
        continue;
      }
      inFlight++;
      mesher.request(next.key);
    }
  }

  // Release the least recently used meshes that are not drawn or on a drawn path.
  function evict(): void {
    if (cached <= CAPACITY) return;
    const candidates = [...nodes.values()]
      .filter((n) => n.mesh && n.used < frame && n.key.level > 0)
      .sort((a, b) => a.used - b.used);
    for (const victim of candidates.slice(0, cached - CAPACITY)) {
      group.remove(victim.mesh!);
      release(victim.mesh!.geometry);
      victim.mesh = undefined;
      victim.requested = false;
      cached--;
    }
  }

  return {
    /** Tiles in the body-fixed frame; the planet poses this group. */
    group,
    terrain,

    /** True once the six face roots are meshed, so the whole body can be drawn. */
    get ready(): boolean {
      return roots.every((root) => root.mesh);
    },

    /**
     * Chooses the tiles to draw for a camera at `camera` (body-fixed metres) and
     * requests any missing ones. `inView` says whether a body-fixed sphere (centre,
     * radius) can be seen; tiles outside it are neither drawn nor refined.
     */
    update(
      camera: Vector3,
      inView: (centre: Vector3, radius: number) => boolean = () => true,
    ): TerrainStats {
      frame++;
      const now = performance.now() / 1000;
      const previous = new Set(drawn);
      const R = terrain.radius;
      const distance = Math.sqrt(camera.x ** 2 + camera.y ** 2 + camera.z ** 2);
      const up = { x: camera.x / distance, y: camera.y / distance, z: camera.z / distance };
      const lowest = R + terrain.minimumHeight;
      // Beyond this angle from the camera's nadir, ground at a given height is below the horizon.
      const horizon = distance > lowest ? Math.acos(lowest / distance) : Math.PI;
      for (const n of drawn) n.mesh!.visible = false;
      drawn = [];
      deepest = 0;

      const visit = (n: Node) => {
        n.used = frame;
        const cos = up.x * n.centre.x + up.y * n.centre.y + up.z * n.centre.z;
        const gap = Math.max(0, Math.acos(Math.max(-1, Math.min(1, cos))) - n.spread);
        const top = R + n.maximumHeight;
        if (gap > horizon + Math.acos(Math.min(1, lowest / top))) return;
        const middle = R + (n.minimumHeight + n.maximumHeight) / 2;
        const bound = n.spread * top + (n.maximumHeight - n.minimumHeight) / 2;
        const at = { x: n.centre.x * middle, y: n.centre.y * middle, z: n.centre.z * middle };
        if (!inView(at, bound)) return;
        const near = Math.max(
          0,
          Math.sqrt(distance ** 2 + middle ** 2 - 2 * distance * middle * Math.cos(gap)) -
            (n.maximumHeight - n.minimumHeight) / 2,
        );
        if (n.key.level < MAXIMUM_LEVEL && near < SPLIT_DISTANCE * n.edge) {
          n.children ??= tileChildren(n.key).map(node);
          let ready = true;
          for (const child of n.children) {
            child.used = frame;
            if (!child.mesh) {
              ready = false;
              want(child);
            }
          }
          if (ready) {
            // Replacing the parent on screen: grow in from it.
            if (previous.has(n)) for (const child of n.children) child.grown = now;
            for (const child of n.children) visit(child);
            return;
          }
        }
        n.mesh!.visible = true;
        n.mesh!.userData.parent = Math.max(0, 1 - (now - n.grown) / GROW_SECONDS);
        drawn.push(n);
        deepest = Math.max(deepest, n.key.level);
      };

      for (const root of roots) {
        if (root.mesh) visit(root);
        else {
          root.used = frame;
          want(root);
        }
      }
      pump();
      evict();
      return { drawn: drawn.length, cached, pending: queue.length + inFlight, deepest };
    },

    /** The tiles drawn by the last update. */
    drawnKeys(): TileKey[] {
      return drawn.map((n) => n.key);
    },

    dispose(): void {
      disposed = true;
      mesher.dispose();
      for (const n of nodes.values()) if (n.mesh) release(n.mesh.geometry);
      nodes.clear();
      group.clear();
    },
  };
}

export type TerrainTiles = ReturnType<typeof createTerrainTiles>;

/**
 * Each vertex between its own place and normal and the parent's surface under it
 * (a tile's coarse attributes), by the mesh's `parent` share: 1 as the tile
 * replaces its parent, so nothing pops, falling to 0 over GROW_SECONDS.
 */
function morph() {
  const parent = uniform(0).onObjectUpdate(({ object }) => object?.userData.parent ?? 0);
  return Fn(() => {
    normalLocal.assign(mix(normalGeometry, attribute('coarseNormal', 'vec3'), parent).normalize());
    return mix(positionGeometry, attribute('coarsePosition', 'vec3'), parent);
  })();
}
