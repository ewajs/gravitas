import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { assertPose, type VehiclePose } from './pose';
import { createScene } from './scene';

/** Backend request. Auto permits Three.js's built-in WebGL 2 fallback. */
export type BackendRequest = 'auto' | 'webgl2';
/** Backend actually initialized, rather than the requested preference. */
export type RenderBackend = 'webgpu' | 'webgl2';
/** Host element, accessible canvas description, and optional backend override. */
export interface ViewportOptions {
  readonly container: HTMLElement;
  readonly label: string;
  readonly backend?: BackendRequest;
}

const MAX_PIXEL_RATIO = 2;

/** Owns rendering resources; the host owns poses and frame scheduling. */
export class Viewport {
  readonly #options: ViewportOptions;
  readonly #art = createScene();
  readonly #camera = new THREE.PerspectiveCamera(42, 1, 0.1, 160);
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

  constructor(options: ViewportOptions) {
    if (options.backend && !['auto', 'webgl2'].includes(options.backend)) {
      throw new RangeError('Unknown viewport backend');
    }
    this.#options = options;
    this.#camera.position.set(8, 5, -9);
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

  /** Copies a validated pose into the artwork without changing the caller's data. */
  setVehiclePose(pose: VehiclePose): void {
    if (this.#disposed) throw new Error('Viewport has been disposed');
    assertPose(pose);
    const p = pose.position;
    const q = pose.orientation;
    this.#art.vehicle.position.set(p.x, p.y, p.z);
    this.#art.vehicle.quaternion.set(q.x, q.y, q.z, q.w);
  }

  /** Draws one frame; returns false before init, after disposal, or for a zero-size host. */
  render(): boolean {
    if (!this.#ready || this.#disposed || !this.#renderer) return false;
    if (this.#deviceFailure) throw this.#deviceFailure;
    if (this.#pixelRatio !== this.#devicePixelRatio()) this.#resize();
    if (!this.#width || !this.#height) return false;
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
      canvas.setAttribute('aria-label', this.#options.label);
      this.#controls = new OrbitControls(this.#camera, canvas);
      this.#controls.target.set(0, 1, 0);
      this.#controls.minDistance = 4;
      this.#controls.maxDistance = 30;
      this.#controls.maxPolarAngle = Math.PI * 0.48;
      this.#controls.maxTargetRadius = 4;
      this.#controls.listenToKeyEvents(canvas);
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
