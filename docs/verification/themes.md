# Theme and identity verification

Step 4.2 is delivered in three stacked PRs; each section records one.

## 4.2a Theme system

Verified locally on 2026-11-07. The theme system moves every interface colour into
a typed theme at its current value, so nothing should look different.
Verification compares the new build with the previous one.

### Environment and results

- MacBook Pro (`MacBookPro18,1`), Apple M1 Pro, 32 GiB RAM, macOS 15.7.9.
- Node 24.21.0; pinned Playwright 1.64.1.
- `npm run check`: format, lint, types, and 128 unit tests in 23 files passed
  (119 in 22 before: 7 theme tests, 1 accent-validation test, 1 scene-accent test).
- `npm run build`: game, TypeDoc (warnings are errors; `@gravitas/ui` now lists
  its `index` and `themes` entry points), and the manual (dead links fail) built.
- `npm run test:e2e`: 30 passed on forced WebGL 2. `npm run test:e2e:webgpu`: 25
  passed on hardware WebGPU (the 5 static manual and Learn tests run only on the
  WebGL 2 project). The browser specs were not modified.
- Lint policy, checked by adding imports temporarily: the themes folder importing
  `lit`, `@gravitas/engine/math`, or a HUD module is rejected, and so is the game
  importing UI's private `src/themes/index` path; `@gravitas/ui/themes` passes.

### Contrast

`themes.test.ts` computes WCAG 2 contrast for every theme: `text` and `muted` at
4.5:1 or more on the page `surface` and on `panel` and `panelSolid` composited over
it; `accent`, `focus`, `good`, `warn`, and `bad` at 3:1 or more on the same; accent
ink on accent at 4.5:1; and text, accent, and focus at 3:1 in instrument wells.

### No visible change

The previous production build (main at `57bd21c`) and this branch's build were
served side by side and captured by a throwaway Playwright script (not committed):

- **HUD:** 24 presentation states (every phase, edge telemetry, loading, failure,
  locale error and pending, eight results reports, help open over three of them)
  × both locales × 1000 × 750, 375 × 667, and 800 × 420: 144 states. Normalized
  shadow DOM, ARIA snapshot, text, and the computed style of every element
  (custom properties excluded, since they are inputs and new ones were added),
  including the dialog's `::backdrop`, are identical.
- **Scene and page:** the 3D view in its ready state (pad ring and below-vehicle
  marker in frame) at all three sizes in both locales, the canvas focus ring, the
  page's colour, background, font, and `theme-color`, and the `?debug` overlay's
  styles are identical.
- **Manual:** all 24 pages, full-page screenshots, identical.
- **Screenshots:** 175, all byte-identical. Capturing the previous build twice
  first confirmed that screenshots are deterministic on this machine.

### Not covered

- The capture scripts were throwaway tools; this record describes what they
  checked.
- WebGPU scene pixels were compared only through the browser suites' assertions;
  the pixel comparison used forced WebGL 2.
