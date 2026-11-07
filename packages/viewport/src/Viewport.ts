import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Vector3, VehiclePose } from '@gravitas/engine';
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
  /** Initial camera position relative to the vehicle's centre of mass, in metres. */
  readonly cameraOffset?: Vector3;
}

const MAX_PIXEL_RATIO = 2;
const DEFAULT_CAMERA_OFFSET: Vector3 = { x: 8, y: 4, z: -9 };
const MIN_CAMERA_DISTANCE = 4;
const MAX_CAMERA_DISTANCE = 30;

/** Owns rendering resources; the host owns poses and frame scheduling. */
export class Viewport {
  readonly #options: ViewportOptions;
  readonly #art: ReturnType<typeof createScene>;
  readonly #camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1500);
  readonly #previous = poseBuffer();
  readonly #current = poseBuffer();
  readonly #followShift = new THREE.Vector3();
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
    const offset = options.cameraOffset ?? DEFAULT_CAMERA_OFFSET;
    const distance = Math.hypot(offset.x, offset.y, offset.z);
    if (!(distance >= MIN_CAMERA_DISTANCE && distance <= MAX_CAMERA_DISTANCE)) {
      throw new RangeError('cameraOffset length must be within the orbit distance limits');
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

  /** Updates the accessible canvas description without resetting camera or GPU resources. */
  setLabel(label: string): void {
    if (this.#disposed) throw new Error('Viewport has been disposed');
    this.#label = label;
    this.#renderer?.domElement.setAttribute('aria-label', label);
  }

  /**
   * Draws one frame at `alpha` in [0, 1] between the previous and current poses
   * (the host's fixed-step remainder). The camera follows the drawn centre of mass.
   * Returns false before init, after disposal, or for a zero-size host.
   */
  render(alpha = 1): boolean {
    if (!(alpha >= 0 && alpha <= 1)) throw new RangeError('alpha must be within [0, 1]');
    if (!this.#ready || this.#disposed || !this.#renderer) return false;
    if (this.#deviceFailure) throw this.#deviceFailure;
    if (this.#pixelRatio !== this.#devicePixelRatio()) this.#resize();
    if (!this.#width || !this.#height) return false;
    blendPose(this.#previous, this.#current, alpha, this.#art.vehicle);
    this.#follow(this.#art.vehicle.position);
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
      this.#controls = new OrbitControls(this.#camera, canvas);
      this.#controls.target.copy(this.#current.position);
      const offset = this.#options.cameraOffset ?? DEFAULT_CAMERA_OFFSET;
      this.#camera.position.set(offset.x, offset.y, offset.z).add(this.#current.position);
      this.#controls.minDistance = MIN_CAMERA_DISTANCE;
      this.#controls.maxDistance = MAX_CAMERA_DISTANCE;
      this.#controls.maxPolarAngle = Math.PI * 0.48;
      // The target follows the vehicle each frame, so panning away would be undone.
      this.#controls.enablePan = false;
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

  // Translate camera and target together, preserving the player's orbit and zoom.
  #follow(target: THREE.Vector3): void {
    if (!this.#controls) return;
    this.#followShift.subVectors(target, this.#controls.target);
    this.#camera.position.add(this.#followShift);
    this.#controls.target.copy(target);
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
    this.#camera.updateProjectionMatrix();
    this.#renderer.setPixelRatio(ratio);
    this.#renderer.setSize(width, height, false);
  }

  #detach(): void {
    this.#ready = false;
    this.#observer?.disconnect();
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
