/** Three.js rendering, independent of flight dynamics and UI components. @module */
export {
  Viewport,
  type ViewportOptions,
  type BackendRequest,
  type CameraMode,
  type RenderBackend,
} from './Viewport';
export type { MapAccents, OrbitPath, PlanetPose, PlanetView } from './planet';
export type { Actuators } from './effects';
export type { SceneAccents } from './scene';
export type { TerrainStats } from './terrain';
export {
  validateVehicleModel,
  type ModelFinish,
  type ModelLeg,
  type ModelPart,
  type ModelShape,
  type ModelStrut,
  type VehicleModel,
} from './vehicle-model';
