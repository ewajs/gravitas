import { Viewport, type BackendRequest } from '@gravitas/viewport';
import type { VehiclePose } from '@gravitas/engine';
import { WebGPURenderer } from 'three/webgpu';

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
    viewport = new Viewport({ container: host, label: 'Test lander', backend });
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
    }
    return { gold, white, x: sumX / gold, y: sumY / gold };
  },
  holdInitialization(backend: BackendRequest) {
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    WebGPURenderer.prototype.init = async function () {
      await gate;
      return rendererInit.call(this);
    };
    viewport = new Viewport({ container: host, label: 'Pending test', backend });
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
    viewport = new Viewport({ container: host, label: 'Failed test', backend: 'webgl2' });
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
