# First viewport verification

Step 0.3a's implementation is complete, with WebGPU presentation verification
pending on a capable device. The PLAN entry stays in progress until that check.

## Verified in the cloud workspace

- Node 24: clean `npm ci`, formatting, lint, strict type checks, production build.
- Six Node tests: finite pose values, normalized orientation, and caller ownership.
- Nine Playwright checks using pinned Chromium 156.0.8078.4 / Playwright 1.64.1
  and SwiftShader WebGL 2: production scene in es-AR/en, actual backend selection,
  visible artwork, pose changes, camera dragging, resize/zero-size/remount, repeated
  disposal, cancellation during pending init, failed init, automatic fallback,
  missing graphics, high DPR, and context loss. Representative screenshots inspected.
- The browser test fixture is served separately; no fixture/test entry point is
  included in the production app.

Software rendering does not establish physical-device performance or coverage.
The 3D dependency chunk is about 228 KiB gzipped in the initial build and loads
after localized status text. Vite's default 500 KiB uncompressed chunk warning
remains visible; no arbitrary budget or warning suppression was introduced.

## WebGPU: not counted as a pass

This workspace has no physical GPU. Its software stack can expose a WebGPU adapter
and allocate buffers, but fails canvas presentation. Diagnostics reproduced the
failure with a minimal Three.js cube and a raw WebGPU canvas clear, independently
of the lander. Chromium reported disabled compositor/interoperability support;
attempts to initialize a software Vulkan path did not establish usable presentation.

Backend selection alone passed in some runs while the canvas remained blank. The
image-content check correctly failed, so these runs are not a WebGPU acceptance.
No errors were ignored or production workarounds added to make that test green.

## Remaining device check

On a machine/browser with working WebGPU:

```sh
npm ci
npx playwright install chromium
npm run test:e2e:webgpu
npm run dev
```

Inspect the scene at the printed URL, then with `?backend=webgl2` for comparison.
The default route should report `webgpu` in the viewport element's `data-backend`;
the forced route should report `webgl2`. The strict WebGPU suite must pass actual
backend and image-content checks, not automatic fallback. Record browser/device
and the outcome before marking 0.3a accepted. If a device exposes a genuine issue,
fix it and rerun affected checks before acceptance.

Browser CI and Pages delivery are the separate 0.3b step; neither is included here.
