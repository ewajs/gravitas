import { Viewport, type BackendRequest } from '@gravitas/viewport';
import type { VehiclePose } from '@gravitas/engine';
import { WebGPURenderer } from 'three/webgpu';
import { FIRST_LANDER } from '../../../apps/game/src/lander';

const host = document.querySelector<HTMLDivElement>('#host')!;
const rendererInit = WebGPURenderer.prototype.init;
let viewport: Viewport | undefined;
let frame: number | undefined;
let pendingInit: Promise<void> | undefined;
let pendingDisposal: Promise<void> | undefined;
let releaseGate: (() => void) | undefined;
let outcome = '';

function draw() {
  viewport?.render();
  frame = requestAnimationFrame(draw);
}

async function unmount() {
  if (frame !== undefined) cancelAnimationFrame(frame);
  frame = undefined;
  await viewport?.dispose();
}

const fixture = {
  async mount(backend: BackendRequest) {
    await unmount();
    viewport = new Viewport({
      container: host,
      label: 'Test lander',
      backend,
      vehicle: FIRST_LANDER.model,
    });
    await viewport.init();
    draw();
    return viewport.backend;
  },
  unmount,
  render: () => viewport?.render() ?? false,
  backend: () => viewport?.backend,
  setPose(pose: VehiclePose) {
    Object.freeze(pose.position);
    Object.freeze(pose.orientation);
    Object.freeze(pose);
    const before = JSON.stringify(pose);
    viewport!.setVehiclePose(pose);
    return before === JSON.stringify(pose);
  },
  setActuators(throttle: number, attitude = { x: 0, y: 0, z: 0 }) {
    viewport!.setActuators({ throttle, attitude });
  },
  setLegCompression(compressions: number[]) {
    viewport!.setLegCompression(compressions);
  },
  sample() {
    // Capture in the same task as render: presented WebGL buffers may be cleared.
    viewport!.render();
    const canvas = host.querySelector('canvas')!;
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    const context = copy.getContext('2d')!;
    context.drawImage(canvas, 0, 0);
    const { data } = context.getImageData(0, 0, copy.width, copy.height);
    let gold = 0,
      flame = 0,
      white = 0,
      sumX = 0,
      sumY = 0;
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i]!,
        g = data[i + 1]!,
        b = data[i + 2]!;
      if (r > 65 && r > g * 1.15 && g > b * 1.3) {
        gold++;
        sumX += (i / 4) % copy.width;
        sumY += Math.floor(i / 4 / copy.width);
      }
      if (Math.min(r, g, b) > 140 && Math.max(r, g, b) - Math.min(r, g, b) < 80) white++;
      // Brighter than anything lit by the sun alone: the additive flame core.
      if (r + g + b > 600 && r >= b) flame++;
    }
    return { gold, flame, white, x: sumX / gold, y: sumY / gold };
  },
  /**
   * Shows the Moon 100 km below the vehicle at latitude 0, longitude 0, lit from
   * the side so the terminator crosses the view; optionally with a test orbit.
   */
  showPlanet(withOrbit = false) {
    const radius = 1_737_400;
    viewport!.setPlanet({ radius, surfaceMap: '/moon/lroc-color-2k.jpg' });
    // Body-fixed +X (longitude 0) is world up: a quarter turn about +Z.
    const s = Math.SQRT1_2;
    viewport!.setPlanetPose({
      centre: { x: 0, y: -(radius + 100_000), z: 0 },
      orientation: { x: 0, y: 0, z: s, w: s },
    });
    viewport!.setSunDirection({ x: 1, y: 0.25, z: 0.2 });
    viewport!.setVehiclePose({
      position: { x: 0, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
    });
    if (withOrbit) {
      const r = radius + 100_000;
      const points = Array.from({ length: 128 }, (_, i) => {
        const angle = (i / 128) * Math.PI * 2;
        return { x: r * Math.cos(angle), y: r * Math.sin(angle) * 0.3, z: -r * Math.sin(angle) };
      });
      viewport!.setOrbitPath({
        points,
        closed: true,
        periapsis: points[0]!,
        apoapsis: points[64]!,
      });
    }
  },
  hidePlanet() {
    viewport!.setPlanet(null);
  },
  setCameraMode(mode: 'chase' | 'map') {
    return viewport!.setCameraMode(mode);
  },
  /** Counts grey regolith-like and cyan orbit-like pixels in the drawn frame. */
  samplePlanet() {
    viewport!.render();
    const canvas = host.querySelector('canvas')!;
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    const context = copy.getContext('2d')!;
    context.drawImage(canvas, 0, 0);
    const { data } = context.getImageData(0, 0, copy.width, copy.height);
    let grey = 0,
      cyan = 0,
      samples = 0;
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i]!,
        g = data[i + 1]!,
        b = data[i + 2]!;
      samples++;
      if (Math.min(r, g, b) > 40 && Math.max(r, g, b) - Math.min(r, g, b) < 30) grey++;
      if (b > 120 && g > 100 && r < g * 0.7) cyan++;
    }
    return { grey: grey / samples, cyan: cyan / samples };
  },
  holdInitialization(backend: BackendRequest) {
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    WebGPURenderer.prototype.init = async function () {
      await gate;
      return rendererInit.call(this);
    };
    viewport = new Viewport({
      container: host,
      label: 'Pending test',
      backend,
      vehicle: FIRST_LANDER.model,
    });
    outcome = 'pending';
    pendingInit = viewport.init().then(
      () => {
        outcome = 'ready';
      },
      (error: unknown) => {
        outcome = error instanceof DOMException ? error.name : String(error);
      },
    );
  },
  startDisposal() {
    pendingDisposal = viewport!.dispose();
  },
  async releaseInitialization() {
    releaseGate!();
    await Promise.all([pendingInit, pendingDisposal]);
    WebGPURenderer.prototype.init = rendererInit;
    return outcome;
  },
  async failInitialization() {
    await unmount();
    WebGPURenderer.prototype.init = async function () {
      throw new Error('Controlled initialization failure');
    };
    viewport = new Viewport({
      container: host,
      label: 'Failed test',
      backend: 'webgl2',
      vehicle: FIRST_LANDER.model,
    });
    try {
      await viewport.init();
    } catch (error) {
      outcome = String(error);
    } finally {
      await viewport.dispose();
      WebGPURenderer.prototype.init = rendererInit;
    }
    return outcome;
  },
};

/** Public-API test driver; served separately and never included in the game build. */
export type Fixture = typeof fixture;
declare global {
  interface Window {
    fixture: Fixture;
  }
}
window.fixture = fixture;
