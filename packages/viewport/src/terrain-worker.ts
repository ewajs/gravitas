import { createTerrain, type Terrain, type TerrainOptions } from '@gravitas/engine';
import { meshTile, type TileKey } from './terrain-tiles';

// Meshes terrain tiles off the main thread (ADR 0022). The host's terrain arrives
// once as its options (the grid's samples are copied); each request returns one
// tile with its arrays transferred, not copied.

/** Messages the viewport sends. */
export type TerrainWorkerRequest =
  | { readonly type: 'terrain'; readonly options: TerrainOptions }
  | { readonly type: 'tile'; readonly key: TileKey };

interface WorkerScope {
  onmessage: ((event: MessageEvent<TerrainWorkerRequest>) => void) | null;
  postMessage(message: unknown, transfer: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;
let terrain: Terrain | undefined;

scope.onmessage = ({ data }) => {
  if (data.type === 'terrain') {
    terrain = createTerrain(data.options);
    return;
  }
  if (!terrain) return;
  const mesh = meshTile(terrain, data.key);
  scope.postMessage(mesh, [mesh.positions.buffer, mesh.normals.buffer, mesh.uvs.buffer]);
};
