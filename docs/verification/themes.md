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

## 4.2b Glass restyle

Verified locally on 2026-11-07 on the same machine, Node, and Playwright. This step
changes the look on purpose, so verification checks behaviour, accessibility, and
contrast, and the screenshots were reviewed by eye.

### Results

- `npm run check`: 132 unit tests in 23 files passed (128 before: a contrast case
  for focus rings over the scene, settings saved before 4.2b, and two safe-sink
  rule tests; the contrast cases now also composite panels over sunlit regolith).
- `npm run build`: game, TypeDoc, and manual built.
- `npm run test:e2e`: 32 passed on forced WebGL 2 (30 before, plus two new tests).
  `npm run test:e2e:webgpu`: 27 passed on hardware WebGPU; the 5 static manual and
  Learn tests run only on WebGL 2.
- Browser test changes, each because the design changed:
  - The crash report reads fuel left from its labelled tile (`fuel-left`), since
    fuel and flight time are now tiles rather than one sentence.
  - New: Reduce transparency gives solid panels, persists across visits, and the
    system's `prefers-reduced-transparency` gives them too.
  - New: the safe-sink scale is absent without a hint, and present with an
    accessible name, plus the caution icon, when the host passes one.
  - New: the phase dot breathes only while flying; gauges ease in 0.2 s; the
    results card and scrim animate; reduced motion stops all of it.
  - All other specs pass unchanged, including the accessible names of the icon
    buttons (Mute, Help, Close), focus order, narrow-screen bounds in both
    languages, and the unchanged-scene screenshot during a language switch.
- Simulation: no engine, session, scenario, or lander file changed. `rules.ts`
  only adds `safeSinkRate`, and telemetry only adds `safeSink`; neither feeds back
  into the simulation.

### Contrast

Measured (WCAG 2) with the panel composited over sunlit regolith, the median of
the rendered ground (`#666661`), which is the brightest wide area behind the panels:
text 10.3:1, muted 5.3:1, accent 5.7:1, good 7.2:1, warn 7.6:1, bad 4.6:1. Over
the page surface every ratio is higher. The plain accent is only 2.8:1 against bare
ground, so focus rings use a lighter cyan, `#82D5E9` (3.5:1). Accent ink on the
accent is 9.2:1, and 11.4:1 on its hover step. The owner's panel alpha of 0.55
passes, so it is unchanged.

### Screenshots reviewed

The HUD over the live WebGL 2 scene in 13 states (ready with the start card,
flying within and beyond the safe sink, paused, each of the four verdicts, Help,
Reduce transparency while flying and in Help, the system preference, loading) ×
Spanish and English × 1280 × 720, 1000 × 750, 375 × 667, and 800 × 420; plus a
real flight (ready, flying with the plume, paused, crash report) on WebGL 2 and on
WebGPU. Checked for collisions, overflow, clipping, and legibility. The landscape
phone size (800 × 420) still overlaps the start card and the instruments, as it
did before; 4.4 owns that layout. The results card scrolls inside itself there.

### Not covered

- No playtest on the target phones; backdrop blur's frame cost on them is 4.4's
  measurement.
- Font rendering was checked in Chromium on macOS only.

## 4.2c Identity

Verified locally on 2026-11-07 on the same machine, Node, and Playwright.

### Results

- `npm run check`: 138 unit tests in 24 files passed (132 before: colour-arithmetic
  reference values, and the manual's brand contrast).
- `npm run build`: game (now with `public/` icons), TypeDoc, and manual built.
- `npm run test:e2e`: 35 passed on forced WebGL 2 (32 before, plus three).
  `npm run test:e2e:webgpu`: 28 passed on hardware WebGPU; 7 static-page tests run
  only on WebGL 2.
- New `identity.spec.ts`: every icon link resolves, PNG sizes are right (16, 32,
  180, 192, 512, maskable 512, and 1200 × 630), the link-preview tags point at the
  deployment, `theme-color` is the theme's surface, both slotted marks load in the
  HUD (decorative `alt=""`, the heading named "Gravitas"), and the manual's nav
  logo loads, its favicon resolves, and its dark brand colour is the accent.
- `npm run icons` twice: all 13 outputs byte-identical.

### Contrast

The manual keeps VitePress's backgrounds, on which Learn's plot palette was
validated. Brand links on dark pages use the accent (`#4CC3E0`); on light pages,
the accent darkened 45 % (`#2a6b7b`) and, on hover, 55 %. Their contrast on every
VitePress background and of button text on brand fills is at least 4.5:1, by unit
test.

### Screenshots reviewed

The start card with the lockup and the header mark in both languages at 1280 ×
720, 1000 × 750, 375 × 667 (the lockup is hidden on narrow screens, where the
header shows the mark), and 800 × 420; the icons at their sizes on light and dark
backgrounds; the link preview; and the manual (home, a manual page, and a Learn
chapter) in dark and light appearances and at 375 px.

### Not covered

- Link previews were not tested in real social apps; they need the deployed URL.
- The icons on a physical home screen await 4.4's manifest.
