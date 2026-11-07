import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { VehiclePose } from '@gravitas/engine';
import { CHASE, ChaseRig } from './chase';
import { NO_ACTUATORS, type Actuators } from './effects';
import { assertPose, blendPose, copyPose, poseBuffer } from './pose';
import { createScene } from './scene';

/** Backend request. Auto permits Three.js's built-in WebGL 2 fallback. */
export type BackendRequest = 'auto' | 'webgl2';
/** Backend actually initialized, rather than the requested preference. */
export type RenderBackend = 'webgpu' | 'webgl2';
/** Host element, accessible canvas description, and optional backend override. */
export interface ViewportOptions {
  /** Sized host element that receives the canvas after initialization. */
  readonly container: HTMLElement;
  /** Localized canvas description for assistive technology. */
  readonly label: string;
  /** Centre of mass above the artwork's level foot-contact plane, in metres. */
  readonly centerOfMassHeight: number;
  /** Defaults to auto, allowing WebGPU with Three.js's WebGL 2 fallback. */
  readonly backend?: BackendRequest;
}

const MAX_PIXEL_RATIO = 2;
// Lens shift: draw the vehicle above centre so more of the surface ahead is visible.
const VIEW_SHIFT = 0.12;

/** Owns rendering resources; the host owns poses and frame scheduling. */
export class Viewport {
  readonly #options: ViewportOptions;
  readonly #art: ReturnType<typeof createScene>;
  // Near plane well inside the 6 m minimum zoom; it sets depth precision for surface decals.
  readonly #camera = new THREE.PerspectiveCamera(42, 1, 0.5, 1500);
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
    if (!Number.isFinite(options.centerOfMassHeight) || options.centerOfMassHeight <= 0) {
      throw new RangeError('centerOfMassHeight must be finite and positive');
    }
    this.#art = createScene(options.centerOfMassHeight);
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
   * Copies validated poses without changing the caller's data. Pass the last two
   * completed simulation ticks; render(alpha) blends between them. A single pose
   * is displayed as-is.
   */
  setVehiclePose(current: VehiclePose, previous: VehiclePose = current): void {
    if (this.#disposed) throw new Error('Viewport has been disposed');
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
    if (this.#disposed) throw new Error('Viewport has been disposed');
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
   * Draws each landing leg compressed by the given amount, in metres, in foot
   * order: left-front, left-back, right-front, right-back (front is body −Z).
   * Presentation only; pass the host's contact penetration for each foot.
   */
  setLegCompression(compressions: readonly number[]): void {
    if (this.#disposed) throw new Error('Viewport has been disposed');
    if (compressions.length !== 4 || !compressions.every((c) => Number.isFinite(c) && c >= 0)) {
      throw new RangeError('Leg compression needs four finite, non-negative values');
    }
    this.#art.setLegCompression(compressions);
  }

  /**
   * Places the chase camera directly behind the current pose at the default
   * distance, without easing. Call after a discontinuity such as a restart.
   */
  resetCamera(): void {
    if (this.#disposed) throw new Error('Viewport has been disposed');
    if (!this.#rig) return;
    blendPose(this.#current, this.#current, 1, this.#art.vehicle);
    this.#rig.snap(this.#art.vehicle, this.#altitude());
  }

  /** Updates the accessible canvas description without resetting camera or GPU resources. */
  setLabel(label: string): void {
    if (this.#disposed) throw new Error('Viewport has been disposed');
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
    this.#art.effects.update(
      this.#actuators,
      this.#art.vehicle.position,
      altitude,
      Math.min(dt, CHASE.maxFrameTime),
      this.#reducedMotion?.matches ?? false,
    );
    this.#controls?.update();
    this.#renderer.render(this.#art.scene, this.#camera);
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
      this.#resize();
      await renderer.compileAsync(this.#art.scene, this.#camera);
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

  readonly #orbitStarted = () => this.#rig?.setUserActive(true);
  readonly #orbitEnded = () => this.#rig?.setUserActive(false);

  // Upright foot clearance over the flat y = 0 surface; framing only, not contact.
  #altitude(): number {
    return this.#art.vehicle.position.y - this.#options.centerOfMassHeight;
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
    this.#renderer.setPixelRatio(ratio);
    this.#renderer.setSize(width, height, false);
  }

  #detach(): void {
    this.#ready = false;
    this.#observer?.disconnect();
    this.#controls?.removeEventListener('start', this.#orbitStarted);
    this.#controls?.removeEventListener('end', this.#orbitEnded);
    this.#controls?.dispose();
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
      // Three's dispose() re-awaits init(), so a rejected init cannot be disposed that way.
      if (this.#renderer?.initialized) await this.#renderer.dispose();
    })());
  }
}
