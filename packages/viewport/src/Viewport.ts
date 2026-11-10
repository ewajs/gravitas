import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Vector3, VehiclePose } from '@gravitas/engine';
import { CHASE, ChaseRig } from './chase';
import { NO_ACTUATORS, type Actuators } from './effects';
import { createPlanet, type OrbitPath, type PlanetPose, type PlanetView } from './planet';
import type { TerrainStats } from './terrain';
import { assertPose, blendPose, copyPose, poseBuffer } from './pose';
import { createScene, DEFAULT_SUN, type SceneAccents } from './scene';
import { validateVehicleModel, type VehicleModel } from './vehicle-model';

/** Backend request. Auto permits Three.js's built-in WebGL 2 fallback. */
export type BackendRequest = 'auto' | 'webgl2';
/** Backend actually initialized, rather than the requested preference. */
export type RenderBackend = 'webgpu' | 'webgl2';
/** `chase` follows the vehicle; `map` shows the whole body and the orbit (planet shown only). */
export type CameraMode = 'chase' | 'map';
/** Host element, accessible canvas description, and optional backend override. */
export interface ViewportOptions {
  /** Sized host element that receives the canvas after initialization. */
  readonly container: HTMLElement;
  /** Localized canvas description for assistive technology. */
  readonly label: string;
  /** The vehicle drawn first; setVehicle replaces it. */
  readonly vehicle: VehicleModel;
  /** Defaults to auto, allowing WebGPU with Three.js's WebGL 2 fallback. */
  readonly backend?: BackendRequest;
}

const MAX_PIXEL_RATIO = 2;
// Lens shift: draw the vehicle above centre so more of the surface ahead is visible.
const VIEW_SHIFT = 0.12;
// The flat site needs 1.5 km of view; a planet needs its far horizon and orbit.
const LOCAL_FAR = 1500;
const PLANET_FAR = 2e7;
// Map camera distance limits and default, in body radii from the centre.
const MAP_DISTANCE = { min: 1.15, max: 12, start: 3.2 } as const;
// How far entering the map raises the view toward the orbit's normal (1 would be 45°).
const MAP_TILT = 0.8;
// Ambient light: generous over the flat site, dim around a planet so its night side reads.
const LOCAL_AMBIENT = 0.4;
const PLANET_AMBIENT = 0.06;
// Distance of the chase scene's sun from the vehicle; it only aims the light and shadows.
const SUN_DISTANCE = 20;
/** The chase camera stays at least this high above a planet's ground, in metres. */
const CAMERA_CLEARANCE = 1.5;
const ORIGIN = new THREE.Vector3();

/** Owns rendering resources; the host owns poses and frame scheduling. */
export class Viewport {
  readonly #options: ViewportOptions;
  readonly #art: ReturnType<typeof createScene>;
  #model: VehicleModel;
  // Near plane well inside the 6 m minimum zoom; it sets depth precision for surface decals.
  readonly #camera = new THREE.PerspectiveCamera(42, 1, 0.5, LOCAL_FAR);
  readonly #planet: ReturnType<typeof createPlanet>;
  readonly #scratch = new THREE.Vector3();
  readonly #mapCamera = new THREE.PerspectiveCamera(45, 1, 1e4, 1e8);
  readonly #sunDirection = DEFAULT_SUN.clone().normalize();
  #mapControls: OrbitControls | undefined;
  #cameraMode: CameraMode = 'chase';
  #sunAimed = false;
  readonly #previous = poseBuffer();
  readonly #current = poseBuffer();
  #rig: ChaseRig | undefined;
  #actuators: Actuators = NO_ACTUATORS;
  #reducedMotion: MediaQueryList | undefined;
  #lastRender: number | undefined;
  #renderer: THREE.WebGPURenderer | undefined;
  #controls: OrbitControls | undefined;
  #observer: ResizeObserver | undefined;
  #initializing: Promise<void> | undefined;
  #disposing: Promise<void> | undefined;
  #releasing: Promise<void> | undefined;
  #disposed = false;
  #ready = false;
  #width = 0;
  #height = 0;
  #pixelRatio = 0;
  #deviceFailure: Error | undefined;
  #label: string;

  /** Creates an unloaded viewport; call init() before drawing. */
  constructor(options: ViewportOptions) {
    if (options.backend && !['auto', 'webgl2'].includes(options.backend)) {
      throw new RangeError('Unknown viewport backend');
    }
    validateVehicleModel(options.vehicle);
    this.#model = options.vehicle;
    this.#art = createScene(options.vehicle);
    this.#planet = createPlanet(this.#art.scene.background as THREE.Color);
    this.#art.scene.add(this.#planet.chaseGroup);
    this.#current.position.copy(this.#art.vehicle.position);
    this.#previous.position.copy(this.#art.vehicle.position);
    this.#options = options;
    this.#label = options.label;
  }

  /** Initializes once. Disposing during initialization rejects with AbortError. */
  init(): Promise<void> {
    if (this.#disposed) return Promise.reject(new Error('Viewport has been disposed'));
    return (this.#initializing ??= this.#initialize());
  }

  /** The actual backend after successful initialization; null otherwise. */
  get backend(): RenderBackend | null {
    if (!this.#ready || !this.#renderer) return null;
    const backend = this.#renderer.backend;
    return 'isWebGPUBackend' in backend && backend.isWebGPUBackend ? 'webgpu' : 'webgl2';
  }

  /**
   * Terrain tiles drawn, cached, and waiting on the last frame, and the deepest
   * level drawn; null without a planet's terrain.
   */
  get terrainStats(): TerrainStats | null {
    return this.#planet.visible ? this.#planet.terrainStats : null;
  }

  /** Draw calls and triangles of the last rendered frame; null before initialization. */
  get renderStats(): { readonly drawCalls: number; readonly triangles: number } | null {
    if (!this.#ready || !this.#renderer) return null;
    const { drawCalls, triangles } = this.#renderer.info.render;
    return { drawCalls, triangles };
  }

  /**
   * Copies validated poses without changing the caller's data. Pass the last two
   * completed simulation ticks; render(alpha) blends between them. A single pose
   * is displayed as-is.
   */
  setVehiclePose(current: VehiclePose, previous: VehiclePose = current): void {
    this.#assertNotDisposed();
    assertPose(current);
    if (previous !== current) assertPose(previous);
    copyPose(current, this.#current);
    copyPose(previous, this.#previous);
  }

  /**
   * Shows what the actuators are doing: engine plume and light scaled by
   * `throttle` in [0, 1], attitude-thruster puffs from `attitude` (torque per body
   * axis as a fraction of its limit, each in [−1, 1]), and ground dust near the
   * surface. Presentation only; pass what the simulation actually applied.
   */
  setActuators(actuators: Actuators): void {
    this.#assertNotDisposed();
    const { throttle, attitude } = actuators;
    const values = [throttle, attitude.x, attitude.y, attitude.z];
    if (!values.every(Number.isFinite) || throttle < 0 || throttle > 1) {
      throw new RangeError('Throttle must be in [0, 1] and attitude values finite');
    }
    if ([attitude.x, attitude.y, attitude.z].some((value) => Math.abs(value) > 1)) {
      throw new RangeError('Attitude values must be within [−1, 1]');
    }
    this.#actuators = {
      throttle,
      attitude: { x: attitude.x, y: attitude.y, z: attitude.z },
    };
  }

  /**
   * Draws each landing leg compressed by the given amount, in metres, in the
   * model's leg order. Presentation only; pass the host's contact penetration for
   * each foot.
   */
  setLegCompression(compressions: readonly number[]): void {
    this.#assertNotDisposed();
    if (
      compressions.length !== this.#art.legCount ||
      !compressions.every((c) => Number.isFinite(c) && c >= 0)
    ) {
      throw new RangeError('Leg compression needs one finite, non-negative value per leg');
    }
    this.#art.setLegCompression(compressions);
  }

  /**
   * Draws another vehicle (a validated model) in place of the current one, at the
   * current pose; pass the new vehicle's pose next. Its legs start uncompressed.
   */
  setVehicle(model: VehicleModel): void {
    this.#assertNotDisposed();
    validateVehicleModel(model);
    this.#model = model;
    this.#art.setVehicle(model);
  }

  /**
   * Places the chase camera directly behind the current pose at the default
   * distance, without easing. Call after a discontinuity such as a restart.
   */
  resetCamera(): void {
    this.#assertNotDisposed();
    if (!this.#rig) return;
    blendPose(this.#current, this.#current, 1, this.#art.vehicle);
    this.#rig.snap(this.#art.vehicle, this.#altitude());
  }

  /**
   * Colours the scene's non-physical marks (sky, pad ring, below-vehicle marker),
   * for example from the host's interface theme. Each is a CSS hex colour,
   * `#rrggbb`. Physical materials such as regolith and foil keep their colours.
   * Takes effect on the next frame; callable before init().
   */
  setAccents(accents: SceneAccents): void {
    this.#assertNotDisposed();
    const values = [accents.sky, accents.pad, accents.marker, accents.orbit];
    if (!values.every((value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value))) {
      throw new RangeError('Scene accents must be #rrggbb colours');
    }
    this.#art.setAccents({ ...accents });
    this.#planet.setAccents({ orbit: accents.orbit, vehicle: accents.marker });
  }

  /**
   * Shows a spherical body instead of the flat landing site, or the site again with
   * null, in its default sunlight. With a planet, the host's world should centre on the vehicle with +Y up
   * (away from the body's centre), so float32 rendering stays steady (ADR 0020).
   * Callable before init(); the colour map loads asynchronously.
   */
  setPlanet(view: PlanetView | null): void {
    this.#assertNotDisposed();
    if (view) {
      if (!(Number.isFinite(view.radius) && view.radius > 0)) {
        throw new RangeError('Planet radius must be finite and positive');
      }
      if (view.surfaceMap !== undefined && typeof view.surfaceMap !== 'string') {
        throw new RangeError('surfaceMap must be a URL string');
      }
    }
    this.#planet.show(view ? { ...view } : null);
    this.#art.site.visible = !view;
    this.#art.ambient.intensity = view ? PLANET_AMBIENT : LOCAL_AMBIENT;
    this.#camera.far = view ? PLANET_FAR : LOCAL_FAR;
    this.#camera.updateProjectionMatrix();
    if (!view) {
      this.#planet.setOrbit(null);
      this.#cameraMode = 'chase';
      this.#syncControls();
      // Back over the site, light it as it is lit before any planet.
      this.#sunDirection.copy(DEFAULT_SUN).normalize();
    }
  }

  /**
   * Places the shown body in the host's world: its centre in metres and the
   * rotation from its body-fixed axes to the world. Call whenever the host's
   * world moves, typically every frame.
   */
  setPlanetPose(pose: PlanetPose): void {
    this.#assertNotDisposed();
    const { centre, orientation: q } = pose;
    if (![centre.x, centre.y, centre.z, q.x, q.y, q.z, q.w].every(Number.isFinite)) {
      throw new RangeError('Planet pose must be finite');
    }
    if (Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) > 1e-6) {
      throw new RangeError('Planet orientation must be a unit quaternion');
    }
    this.#planet.setPose({ centre: { ...centre }, orientation: { ...q } });
  }

  /**
   * Aims sunlight: a direction toward the Sun in world coordinates, any length.
   * The flat site has a fixed default; a planet's terminator follows this.
   */
  setSunDirection(direction: Vector3): void {
    this.#assertNotDisposed();
    const length = Math.hypot(direction.x, direction.y, direction.z);
    if (!(Number.isFinite(length) && length > 0)) {
      throw new RangeError('Sun direction must be finite and non-zero');
    }
    this.#sunDirection.set(direction.x, direction.y, direction.z).divideScalar(length);
    this.#sunAimed = true;
  }

  /**
   * Draws an orbit in the map view, in the body's body-fixed metres, with optional
   * periapsis and apoapsis marks; null removes it.
   */
  setOrbitPath(path: OrbitPath | null): void {
    this.#assertNotDisposed();
    if (path) {
      const points = [...path.points, path.periapsis, path.apoapsis].filter(
        (point): point is Vector3 => point !== undefined,
      );
      if (path.points.length < 2) throw new RangeError('An orbit path needs at least two points');
      if (!points.every((p) => [p.x, p.y, p.z].every(Number.isFinite))) {
        throw new RangeError('Orbit path points must be finite');
      }
    }
    this.#planet.setOrbit(path);
  }

  /** Current camera; see {@link CameraMode}. */
  get cameraMode(): CameraMode {
    return this.#cameraMode;
  }

  /**
   * Switches between the chase camera and the map. The map needs a planet shown;
   * returns whether the requested mode applies. Entering the map looks down on the
   * vehicle from a few body radii.
   */
  setCameraMode(mode: CameraMode): boolean {
    this.#assertNotDisposed();
    if (mode !== 'chase' && mode !== 'map') throw new RangeError('Unknown camera mode');
    if (mode === 'map' && !this.#planet.visible) return false;
    if (mode === 'map' && this.#cameraMode !== 'map') this.#aimMap();
    this.#cameraMode = mode;
    this.#syncControls();
    return true;
  }

  /** Updates the accessible canvas description without resetting camera or GPU resources. */
  setLabel(label: string): void {
    this.#assertNotDisposed();
    this.#label = label;
    this.#renderer?.domElement.setAttribute('aria-label', label);
  }

  /**
   * Draws one frame at `alpha` in [0, 1] between the previous and current poses
   * (the host's fixed-step remainder). The chase camera follows the drawn vehicle.
   * Returns false before init, after disposal, or for a zero-size host.
   */
  render(alpha = 1): boolean {
    if (!(alpha >= 0 && alpha <= 1)) throw new RangeError('alpha must be within [0, 1]');
    if (!this.#ready || this.#disposed || !this.#renderer) return false;
    if (this.#deviceFailure) throw this.#deviceFailure;
    if (this.#pixelRatio !== this.#devicePixelRatio()) this.#resize();
    if (!this.#width || !this.#height) return false;
    blendPose(this.#previous, this.#current, alpha, this.#art.vehicle);
    // Presentation-only clock for camera easing; physics time belongs to the host.
    const now = performance.now();
    const dt = this.#lastRender === undefined ? 0 : (now - this.#lastRender) / 1000;
    this.#lastRender = now;
    const altitude = this.#altitude();
    this.#rig?.update(this.#art.vehicle, altitude, dt);
    this.#art.updateMarker(this.#art.vehicle.position, altitude);
    // Around a planet, dust needs terrain: it spreads on the ground below the vehicle
    // (+Y is up there); over a smooth sphere there is no ground to raise it from.
    const terrain = this.#planet.visible && this.#planet.hasTerrain;
    this.#art.effects.update(
      this.#actuators,
      this.#art.vehicle.position,
      this.#planet.visible && !terrain ? Infinity : altitude,
      Math.min(dt, CHASE.maxFrameTime),
      this.#reducedMotion?.matches ?? false,
      ...(terrain
        ? [this.#art.vehicle.position.y - altitude - this.#model.centerOfMassHeight]
        : []),
    );
    this.#aimSun();
    this.#controls?.update();
    if (this.#planet.visible) this.#keepCameraAboveGround();
    if (this.#planet.visible) {
      this.#planet.updateTerrain(this.#camera);
      this.#planet.setVehicle(this.#art.vehicle.position);
      this.#mapControls?.update();
      this.#planet.followCameras(this.#camera, this.#mapCamera);
    }
    if (this.#cameraMode === 'map') this.#renderer.render(this.#planet.map, this.#mapCamera);
    else this.#renderer.render(this.#art.scene, this.#camera);
    return true;
  }

  /** Immediately detaches listeners/canvas, then awaits initialization and GPU cleanup. Safe twice. */
  dispose(): Promise<void> {
    this.#disposed = true;
    this.#detach();
    return (this.#disposing ??= this.#finishDisposal());
  }

  async #initialize(): Promise<void> {
    try {
      const renderer = new THREE.WebGPURenderer({
        antialias: true,
        forceWebGL: this.#options.backend === 'webgl2',
      });
      this.#renderer = renderer;
      renderer.onDeviceLost = (info) => {
        if (!this.#disposed) this.#deviceFailure = new Error(`GPU device lost: ${info.message}`);
      };
      renderer.onError = (info: unknown) => {
        if (!this.#disposed)
          this.#deviceFailure = new Error('GPU rendering failed', { cause: info });
      };
      renderer.toneMapping = THREE.AgXToneMapping;
      renderer.shadowMap.enabled = true;
      await renderer.init();
      if (this.#disposed)
        throw new DOMException('Viewport disposed during initialization', 'AbortError');
      const canvas = renderer.domElement;
      canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
      canvas.tabIndex = 0;
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', this.#label);
      blendPose(this.#current, this.#current, 1, this.#art.vehicle);
      this.#controls = new OrbitControls(this.#camera, canvas);
      this.#rig = new ChaseRig(this.#camera, this.#controls.target);
      this.#rig.snap(this.#art.vehicle, this.#altitude());
      this.#controls.minDistance = CHASE.minDistance;
      this.#controls.maxDistance = CHASE.maxDistance;
      this.#controls.maxPolarAngle = Math.PI * 0.48;
      // The rig moves the target every frame, so panning away would be undone.
      this.#controls.enablePan = false;
      // Flicker and dust motion stop when the player asks for reduced motion.
      this.#reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
      this.#controls.addEventListener('start', this.#orbitStarted);
      this.#controls.addEventListener('end', this.#orbitEnded);
      this.#controls.update();
      // The map's own controls orbit the body; only one set listens at a time.
      this.#mapControls = new OrbitControls(this.#mapCamera, canvas);
      this.#mapControls.enablePan = false;
      this.#syncControls();
      this.#resize();
      await renderer.compileAsync(this.#art.scene, this.#camera);
      await renderer.compileAsync(this.#planet.map, this.#mapCamera);
      if (this.#disposed)
        throw new DOMException('Viewport disposed during initialization', 'AbortError');
      if (this.#deviceFailure) throw this.#deviceFailure;
      this.#options.container.append(canvas);
      this.#observer = new ResizeObserver(() => this.#resize());
      this.#observer.observe(this.#options.container);
      this.#ready = true;
      this.#resize();
    } catch (error) {
      this.#disposed = true;
      this.#detach();
      await this.#releaseResources();
      throw error;
    }
  }

  // Calls after dispose() throw, so a stale host reference fails loudly.
  #assertNotDisposed(): void {
    if (this.#disposed) throw new Error('Viewport has been disposed');
  }

  readonly #orbitStarted = () => this.#rig?.setUserActive(true);
  readonly #orbitEnded = () => this.#rig?.setUserActive(false);

  // Upright foot clearance over the flat y = 0 surface, or over a shown planet's
  // ground (its terrain, else its reference sphere); framing only, not contact.
  #altitude(): number {
    const position = this.#art.vehicle.position;
    if (!this.#planet.visible) return position.y - this.#model.centerOfMassHeight;
    return this.#planet.heightAboveGround(position) - this.#model.centerOfMassHeight;
  }

  // Around a planet, lift the chase camera out of rising ground (a hill behind the
  // vehicle, a crater rim) so it never looks from inside the terrain.
  #keepCameraAboveGround(): void {
    const clearance = this.#planet.heightAboveGround(this.#camera.position);
    if (clearance >= CAMERA_CLEARANCE) return;
    const up = this.#planet.upAt(this.#camera.position, this.#scratch);
    this.#camera.position.addScaledVector(up, CAMERA_CLEARANCE - clearance);
  }

  // The chase scene's sun sits along the sun direction from the vehicle, so the
  // vehicle's shadow camera stays around it; the map's sun follows the same
  // direction. Until a host aims it, the flat site keeps its default light.
  #aimSun(): void {
    if (!this.#sunAimed && !this.#planet.visible) return;
    const sun = this.#art.sun;
    const around = this.#planet.visible ? this.#art.vehicle.position : ORIGIN;
    const distance = this.#planet.visible ? SUN_DISTANCE : DEFAULT_SUN.length();
    sun.target.position.copy(around);
    sun.position.copy(this.#sunDirection).multiplyScalar(distance).add(around);
    sun.target.updateMatrixWorld();
    this.#planet.setSun(this.#sunDirection);
  }

  // Looks at the vehicle from MAP_DISTANCE.start radii, raised toward the orbit's
  // normal so the orbit reads as an ellipse rather than edge-on.
  #aimMap(): void {
    const radius = this.#planet.radius;
    const vehicle = this.#planet.vehicleOnMap();
    const direction =
      vehicle.lengthSq() > 0 ? vehicle.clone().normalize() : new THREE.Vector3(1, 0, 0);
    direction.addScaledVector(this.#planet.orbitNormal(), MAP_TILT).normalize();
    this.#mapCamera.position.copy(direction).multiplyScalar(radius * MAP_DISTANCE.start);
    this.#mapCamera.up.set(0, 1, 0);
    this.#mapCamera.lookAt(0, 0, 0);
    if (this.#mapControls) {
      this.#mapControls.target.set(0, 0, 0);
      this.#mapControls.minDistance = radius * MAP_DISTANCE.min;
      this.#mapControls.maxDistance = radius * MAP_DISTANCE.max;
      this.#mapControls.update();
    }
  }

  // Only the active camera's pointer controls respond.
  #syncControls(): void {
    if (this.#controls) this.#controls.enabled = this.#cameraMode === 'chase';
    if (this.#mapControls) this.#mapControls.enabled = this.#cameraMode === 'map';
  }

  #devicePixelRatio(): number {
    return Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  }

  #resize(): void {
    if (this.#disposed || !this.#renderer) return;
    const { clientWidth: width, clientHeight: height } = this.#options.container;
    const ratio = this.#devicePixelRatio();
    if (width === this.#width && height === this.#height && ratio === this.#pixelRatio) return;
    this.#width = width;
    this.#height = height;
    this.#pixelRatio = ratio;
    if (!width || !height) return;
    this.#camera.aspect = width / height;
    this.#camera.setViewOffset(width, height, 0, height * VIEW_SHIFT, width, height);
    this.#camera.updateProjectionMatrix();
    this.#mapCamera.aspect = width / height;
    this.#mapCamera.updateProjectionMatrix();
    this.#renderer.setPixelRatio(ratio);
    this.#renderer.setSize(width, height, false);
  }

  #detach(): void {
    this.#ready = false;
    this.#observer?.disconnect();
    this.#controls?.removeEventListener('start', this.#orbitStarted);
    this.#controls?.removeEventListener('end', this.#orbitEnded);
    this.#controls?.dispose();
    this.#mapControls?.dispose();
    this.#renderer?.domElement.remove();
  }

  async #finishDisposal(): Promise<void> {
    try {
      await this.#initializing;
    } catch {
      // The init caller receives its error; disposal must still release resources.
    }
    await this.#releaseResources();
  }

  #releaseResources(): Promise<void> {
    return (this.#releasing ??= (async () => {
      this.#art.dispose();
      this.#planet.dispose();
      // Three's dispose() re-awaits init(), so a rejected init cannot be disposed that way.
      if (this.#renderer?.initialized) await this.#renderer.dispose();
    })());
  }
}
