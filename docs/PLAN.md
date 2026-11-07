# Implementation plan

One step is one reviewable PR. `[ ]` planned, `[~]` in progress, `[x]` implemented.
Resolve implementation details when a step starts. Owner review precedes moving
to the next step unless the owner authorizes otherwise.

## M0 — Foundation

- [x] **0.1 Charter and decisions:** scope, stack, boundaries, runtime principles,
      dependency policy, shared agent workflow. **Verify:** local links and whitespace;
      consistent design, planned behavior labeled. Owner reviews before scaffolding.
- [x] **0.2 Workspaces and checks:** Node 24/npm workspaces, TS strict, four manifests,
      Vite, ESLint boundary rules, Prettier, Vitest, lockfile, fast PR CI. No invented
      public APIs. **Verify:** clean install/check/build; demonstrate a temporary
      forbidden import fails lint, then remove it.
- [x] **0.3a Viewport integration:** procedural vehicle/ground, inspection camera,
      asynchronous lifecycle, resize, forced-WebGL mode, focused Playwright tests,
      and minimal bilingual loading/failure messages. **Verify:** actual backend
      identity, visible scene, camera interaction, resize, and disposal/remount,
      including disposal while initialization is pending. Report backend/device limits.
      Accepted with cloud WebGL checks and the owner's nine passing WebGPU checks on
      a MacBook Pro M1 with 32 GB RAM; see [verification](verification/viewport.md).
- [x] **0.3b Browser verification and delivery:** local browser suites and Pages
      workflow. **Verify:** checks gate main deployment, assets work under `/gravitas/`,
      deployed desktop/narrow layout. Pages deployment and live checks passed on
      2026-11-05 in Spanish/WebGPU and English/WebGL 2. Both layouts and prefixed
      assets verified. Browser checks moved out of routine CI at the owner's request
      after installation delays; fast checks/build gate deployment. See
      [delivery verification](verification/delivery.md).
- [x] **0.4 Bilingual UI shell:** Lit HUD/menu, locale switch, design tokens, number
      formatting, keyboard focus, minimal real engine data contract. **Verify:** es-AR/en
      switch without state reset; desktop/narrow readability; owner reviews visuals.
      Local WebGL/WebGPU checks passed on 2026-11-06; screenshots await owner review.
      See [UI verification](verification/ui.md).
- [x] **0.5 Developer docs:** separate library/API guides and integration walkthrough;
      build checks and deployment. **Verify:** real exports documented, links/build pass.
      TypeDoc and local prefixed browser checks passed; the existing Pages artifact
      includes game and docs. Live docs publication awaits owner merge/deployment.
      See [developer-docs verification](verification/developer-docs.md).

## M1 — First flight

**Accepted by the owner on 2026-11-06; released as v0.1.0.** The owner approved
combining the specification and engine implementation in 1.1.

- [x] **1.1 Flight model and engine:** define vehicle/controls, torque-driven rate
      assistance, physical assumptions, and independent reference cases; implement
      gravity, thrust, fuel/mass, and attitude dynamics. Refactor all pose consumers
      to a centre-of-mass origin in the same PR. **Verify:** independent analytical
      references, conservation and convergence checks; both browser suites after the
      viewport origin change. Attitude control draws from the shared tank at the
      owner's request. Local checks passed on 2026-11-06; see the
      [flight model](FLIGHT.md) and [verification](verification/flight.md).
- [x] **1.2 Flight runtime:** fixed-step runtime with bounded catch-up, keyboard
      input, interpolation, pause/resume/restart, a fixed opening, a placeholder
      ground halt until M2 contact, a following orbit camera, and plain flight
      readouts. **Verify:** identical physics at 30/144 Hz frame rates, overload
      accounting, landability; browser flight, focus loss, hidden tab, form/help
      scoping, both locales mid-flight, both backends. Owner approved splitting the
      former 1.2 into 1.2 and 1.3. Local checks passed on 2026-11-06; see
      [runtime verification](verification/runtime.md).
- [x] **1.3 Chase camera and instruments:** heading-following chase camera with
      shared engine heading, landing radar (lean/drift/pad), designed instrument
      cluster with fuel/throttle gauges and hover mark, deterministic surface depth
      cues, opening facing the pad. **Verify:** chase rig and radar geometry unit
      tests; browser radar/heading, narrow layouts in both locales, both backends;
      software-renderer frame rate recorded. Local checks passed on 2026-11-06; the owner
      accepted the visuals, closing M1. See [instrument verification](verification/instruments.md).

**Acceptance:** fly one vehicle with readable instruments. Pause/resume and render
rate changes preserve intended physics. Unit references and browser controls cover
focus and tab changes as well as ordinary flight.

## M2 — A complete landing challenge

On 2026-11-07 the owner approved these steps for an unattended overnight run as
stacked PRs (each targets the previous step's branch), with decisions settled up
front: own contact model (no Rapier yet), verdicts from engine contact facts with
game-owned limits, a landing report without points, one scenario, procedural
assets only.

- [x] **2.1 Contact model:** spring-damper legs (separate compression/rebound
      damping) and hull points with friction; flat ground and flush pad; a surface
      seam; `contactFacts`; drawn leg compression; placeholder halt removed.
      **Verify:** analytic references (rest compression, elastic bounce period,
      sliding μg, 45° tip-over, hard-impact bell strike), no-bounce crash, settling,
      both backends. Local checks passed on 2026-11-07; see
      [ADR 0011](decisions/0011-contact-model.md) and
      [contact verification](verification/contact.md).
- [x] **2.2 Landing outcomes:** pure `updateTouchdown`/`classifyTouchdown` reducer
      in engine; game limits (2 m/s vertical, 1 m/s horizontal, 10° tilt, still 1 s;
      crash on hull contact, leg impact above 5 m/s, or tipping past 60°); verdicts
      (pad, off pad, rough, crash); an explanatory results card; Try again; a "How to
      fly" card; 60 kg opening fuel; scripted whole-flight regression tests.
      **Verify:** boundary and simulated-drop references, regression flights (land,
      rough, crash, run dry, determinism), report tests, browser crash/report/retry in
      both locales, both backends. Local checks passed on 2026-11-07; see
      [ADR 0012](decisions/0012-landing-outcomes.md) and
      [outcome verification](verification/outcomes.md).
- [x] **2.3 Player manual:** bilingual VitePress manual (`manual/`) at
      `/gravitas/manual/` and `/gravitas/manual/en/`: getting started, flying,
      instruments, landing rules and tips, the lander. `npm run manual` (dead links
      fail), included in `npm run build` and CI; Help links to it per locale.
      **Verify:** builds, a dead link fails the build, browser checks of Help links,
      both locales, and the way back to the game. Local checks passed on 2026-11-07;
      see [manual verification](verification/manual.md).

**Acceptance:** start, fly, land/crash, understand the result, retry. No orbit,
construction, staging, or progression required.

## M3 — Feel and evidence

Owner playtesting tunes camera, controls, and limits. Steps that need no human
playtest come first:

- [x] **3.1 Effects:** throttle-scaled engine plume and light, attitude-thruster
      puffs aimed from each quad's torque geometry, soft ground dust; untone-mapped
      flame colours; `viewport.setActuators` fed by what the session actually applied
      (zero when dry). **Verify:** mapping unit tests (plume length, quad directions,
      dust thresholds), actuator validation, browser plume appears/leaves,
      reduced-motion frames identical, both backends. Local checks passed on
      2026-11-07; see [effects verification](verification/effects.md).
- [x] **3.2 Audio and settings:** synthesized Web Audio (engine rumble and tone,
      thruster hiss, touchdown thud, verdict cues) unlocked on the first gesture and
      suspended unless flying; M and a Mute toggle; validated `localStorage` settings
      (language, mute, start card seen) saved only on change. **Verify:** level
      mapping and settings validation unit tests; browser persistence across visits,
      `?lang=` precedence, gesture unlock, pause/mute states, both backends. Local
      checks passed on 2026-11-07; see [audio verification](verification/audio.md).
- [x] **3.3 Diagnostics:** an explicit `?debug` overlay (frame rate, main-thread
      work p50/p95, dropped time, draw calls, triangles, ticks) at 4 Hz without
      logging; `viewport.renderStats`; `npm run measure` flying a workload on both
      browsers; start/resume begin timing at the next frame. **Verify:** stats unit
      tests, overlay only behind `?debug`, measured results and proposed budgets.
      Local checks passed on 2026-11-07; see
      [performance measurements](verification/performance.md).
- [x] **3.4 Learn:** a bilingual Learn section in the manual: how a simulation step
      works, motion and gravity, rockets and leaning, rotation and the assist,
      numerical integration, landing legs, and an orbits preview (Newton's cannon on
      the Moon). Build-time MathJax equations; six explorers running the real engine
      beside closed-form formulas; an accessible plot component. **Verify:**
      model unit tests against independent references, browser checks of
      equations, explorers, tooltip, and table in both languages, hydration
      without warnings. Local checks passed on 2026-11-07; see
      [ADR 0013](decisions/0013-learn-section.md) and
      [Learn verification](verification/learn.md).

## M4 — Polish and reach

A tidier codebase first, then a visual identity, and the input and layout work
that takes the game to phones. Owner decisions on 2026-11-07: flight is
landscape-only; the test devices are an iPhone 15 Pro and a Samsung Galaxy A70;
pinch zoom and double-tap zoom are blocked.

- [x] **4.1 Housekeeping:** a review sweep of all source. Engine `math.ts` (vector
      and quaternion operations, `clamp`, degree conversions, `rotationAbout`) used
      by the dynamics, the game, and the Learn models; the opening scenario, pad
      distance, verdict check, and every scripted pilot named once in the game; the
      1,090-line flight HUD split into element, types, styles, instruments, results
      card, and help modules with cached number formats; one RK4 and shared plot
      notation in the manual. No behaviour change. **Verify:** scripted flights and
      contact integrations bit-identical (69,030 hashed ticks); HUD shadow DOM,
      accessibility tree, CSS, and screenshots identical in 144 states; manual pages
      identical; both browser suites unchanged. Local checks passed on 2026-11-07;
      see [housekeeping verification](verification/housekeeping.md).
- [x] **4.2 Theme system and identity:** selectable, typed themes that generate CSS
      variables for the HUD and the manual, plus scene accent colours; a logo and
      icon set; a self-hosted typeface. A clean, professional look with subtle,
      responsive animation. Owner decisions on 2026-11-07, from a design canvas:
      direction "Glass" (frosted translucent panels) with a deeper cyan accent
      `#4CC3E0`; Space Grotesk and Inter, self-hosted; the "safe sink" scale under
      vertical speed from direction "Instrument", as a hint; a solid-panel fallback
      for reduced transparency; one theme for now, no switcher; the "Kepler" mark.
      Three stacked PRs:
  - [x] **4.2a Theme system:** a typed theme of colour roles, type, shape, and scene
        accents in `@gravitas/ui/themes` (pure TypeScript, no Lit), generating the
        HUD's and the page's CSS custom properties; viewport `setAccents()` for the
        sky, pad ring, and marker; every inventoried interface colour moved into the
        theme at its current value. **Verify:** WCAG contrast unit test for every
        theme; HUD DOM, accessibility tree, computed styles, and screenshots
        identical to the previous build in 144 states, plus the 3D scene, page
        styles, debug overlay, and all 24 manual pages; both browser suites.
        See [theme verification](verification/themes.md).
  - [x] **4.2b Glass restyle:** the chosen look. Frosted glass panels in two
        instrument groups; inline-SVG icon buttons for pause, restart, sound, and
        help; the results card centred over a dimmed scene, with verdict badges and
        fuel and time tiles; motion rules (130 ms controls, 200 ms gauge easing, a
        280 ms card entrance with staggered rows, one breathing phase dot, all off
        for reduced motion); self-hosted Space Grotesk and Inter; the game's
        safe-sink hint under vertical speed; a persisted "Reduce transparency"
        setting that, like the system preference, gives solid panels; the pad ring
        in the accent. **Verify:** contrast over the page and over sunlit regolith;
        settings saved before 4.2b still load; browser tests for the setting, the
        system preference, the safe-sink scale, and motion; both browser suites;
        screenshots of every state in both languages at four sizes.
  - [x] **4.2c Identity:** the Kepler mark as two hand-drawn SVG cuts (full,
        and a heavier small cut for 32 px and below) in the HUD header and on the
        start card with the wordmark; `npm run icons` renders them with the pinned
        Playwright into favicons (SVG, 32 and 16 px), the Apple touch icon, install
        icons (192, 512, maskable; 4.4 writes the manifest), and a 1200 × 630 link
        preview; Open Graph and Twitter tags; the manual branded from the theme
        (accent colours with contrast-tested darker steps for light pages, the
        typefaces, the logo in the nav, and the favicon). **Verify:** icon output
        byte-identical across runs; brand contrast unit test; browser tests for the
        served icons and sizes, preview tags, slotted marks, and the manual's logo
        and brand; both browser suites; screenshots of the game and the manual.
- [x] **4.3 Input layer, touch, and gamepad:** one input abstraction. On touch, a
      left-thumb absolute throttle lever with a hover detent, a right-thumb virtual
      stick for proportional pitch and roll rates, yaw buttons, and pause. Owner
      decisions on 2026-11-07: the touch controls are a themed UI element that
      draws them, handles pointers, and emits plain values, which the game maps to
      pilot input; a gamepad is built and verified with a simulated one, as the
      owner has no controller. Three stacked PRs:
  - [x] **4.3a Input layer:** a generalized `PilotInput` (any lever speed in
        [−1, 1], any one-shot lever position in [0, 1]); `InputSource` and one
        merge rule in `PilotInputs` (strongest rotation per axis, the throttle to
        the source that last began moving it, commands from any source); the
        keyboard as the first source. No behaviour change. **Verify:** merge-rule
        and session unit tests; keyboard flights and every scripted regression
        flight bit-identical (34,619 hashed ticks); both browser suites unchanged.
        See [ADR 0016](decisions/0016-input-layer.md) and
        [input verification](verification/input.md).
  - [x] **4.3b Gamepad:** standard-mapping gamepads polled each frame:
        proportional right-stick pitch and roll with a dead zone and a gentle
        curve, bumpers for yaw, triggers raising and lowering the lever in
        proportion to pressure, A to start, resume, or try again, Start to pause;
        a lost pad pauses; gamepad hints in "How to fly", Help, and the phase
        messages while one is in use. **Verify:** mapping and source unit tests;
        browser tests with a stubbed `navigator.getGamepads`; keyboard flights
        still bit-identical. No physical controller was available; see
        [input verification](verification/input.md).
  - [x] **4.3c Touch controls:** a themed `@gravitas/ui` element
        (`TouchControls`) that draws the controls, owns pointers, and emits plain
        values: a non-centering left-thumb lever moved relative to the grab, showing
        the applied throttle, with a detent at the current hover throttle (a visual
        tick, and a vibration where supported); a floating right-thumb stick (8%
        dead zone, gentle curve in the game); two yaw buttons; multi-touch without
        stuck input. Shown on touch and hidden after keyboard or gamepad use, with
        a persisted Automatic / Always / Never setting; "How to fly" and Help for
        the active device. **Verify:** mapping, source, and settings unit tests;
        browser tests with real multi-touch on emulated phones, both backends. See
        [input verification](verification/input.md).
- [ ] **4.4 Mobile layout and PWA:** landscape-only flight with a rotate prompt;
      pinch and double-tap zoom blocked; a compact HUD; install to the home screen;
      the WebGL 2 fallback. Phone testing happens on the deployed site after
      merging. Two stacked PRs:
  - [x] **4.4a Mobile layout:** with the touch controls showing, the readouts
        become a strip along the top, the radar sits between the thumbs, and the
        throttle gauge gives way to the lever, so both thumb zones stay clear; a
        "Turn your phone sideways" prompt during a flight in portrait (auto-pause;
        menus, Help, and results work upright); page zoom blocked (viewport meta,
        `touch-action`, iOS gesture and double-tap handling); `viewport-fit=cover`
        with safe-area insets; the start card without the instruments behind it
        and a two-column results card on short screens; device facts in `?debug`.
        **Verify:** emulated iPhone 15 Pro and Galaxy A70 layouts in both
        languages and orientations with overlap checks, emulated safe areas, a
        real pinch that never zooms the page, the WebGL 2 fallback, both backends.
        See [ADR 0017](decisions/0017-phone-play.md) and
        [mobile verification](verification/mobile.md).
  - [ ] **4.4b Installable app:** a web app manifest (landscape, fullscreen with a
        standalone fallback, theme colours, the 4.2c icons), iOS home-screen tags,
        and manual notes on installing and on measuring the glass blur; no
        service worker. **Verify:** manifest and icons served under `/gravitas/`.

## Later decisions

Workers based on profiling; PWA offline/update flow; orbits/reference frames;
curved terrain; multiple vehicles; construction/staging; replay/save formats;
library publication. No implied order.

MIT is selected for code/documentation. Track third-party asset licenses and
provenance when assets arrive.

## Releases

### v0.2.0 — A complete landing (2026-11-07)

Every descent now ends in a verdict you can understand and retry, with physical
ground contact, effects and sound, a player manual with a Learn section, and the
Glass look with the Kepler mark.

- **Contact (2.1):** spring-damper legs and hull points with friction, so the
  lander can bounce, slide, or tip over; drawn leg compression. See ADR 0011.
- **Outcomes (2.2):** verdicts (on the pad, off the pad, too rough, crash) from
  engine contact facts and game-owned limits; an explanatory results card, Try
  again, a "How to fly" card, and a 60 kg opening. See ADR 0012.
- **Manual (2.3):** a bilingual player manual at `/gravitas/manual/`, linked from
  Help.
- **Effects (3.1):** engine plume and light, attitude-thruster puffs, and ground
  dust, held still under reduced motion.
- **Audio and settings (3.2):** synthesized engine, thruster, and touchdown sound;
  Mute (M); language, mute, and start card remembered.
- **Diagnostics (3.3):** a `?debug` overlay and `npm run measure`, with proposed
  performance budgets.
- **Learn (3.4):** seven chapters per language with rendered equations and six
  explorers running the real engine, up to Newton's cannon on the Moon. See
  ADR 0013.
- **Housekeeping (4.1):** shared engine math, also exposed to UI as the pure
  `@gravitas/engine/math` entry point; the HUD split into focused modules; no
  behaviour change (scripted flights bit-identical).
- **Theme and identity (4.2):** typed themes in `@gravitas/ui/themes` driving the
  HUD, scene accents, and manual (ADR 0014); the Glass look in a deeper cyan with
  self-hosted Space Grotesk and Inter (ADR 0015), the motion rules, a safe-sink
  hint under vertical speed, and a "Reduce transparency" setting; the Kepler mark,
  favicons, install icons, and a link preview.

Known limits: keyboard only, with touch and gamepad in 4.3. Phone layouts are 4.4:
on a landscape phone the start card overlaps the instruments, and the glass blur's
cost on the test phones is unmeasured. Install icons exist, but the web app
manifest arrives in 4.4. Measured on an Apple M1 Pro with the Glass UI: 60 fps on
WebGPU, main-thread work 0.7 ms p50 and 0.8 ms p95, 45 draw calls; the
software-rendered test project runs at about 15 fps. See the
[performance](verification/performance.md), [theme](verification/themes.md), and
[housekeeping](verification/housekeeping.md) records.

### v0.1.0 — First flight (2026-11-06)

The first playable build: one lander flown with the keyboard from 80 m above the
pad, with no landing verdict yet.

- **Flight model (1.1):** pure RK4 rigid-body dynamics with gravity, body-axis
  thrust, and fuel/mass loss. Rate-command attitude assistance draws from the same
  tank as the main engine. Poses locate the centre of mass. See
  [the flight model](FLIGHT.md) and ADR 0008.
- **Runtime (1.2):** app-owned 60 Hz fixed-step session with bounded catch-up and
  discarded-time accounting, keyboard controls scoped away from menus,
  pause/resume/restart, a hidden-tab pause, interpolated rendering, and a
  placeholder ground halt. See ADR 0009.
- **Camera and instruments (1.3):** a heading-following chase camera and a
  heading-up landing radar sharing engine's `headingAngle`. Altitude and vertical
  speed are prominent; fuel/throttle gauges carry a hover mark; surface depth cues
  added. See ADR 0010.
- Bilingual es-AR/English throughout, switchable mid-flight. WebGPU with WebGL 2
  fallback. Developer API docs are published with the game.

Known limits: touchdown stops the flight without a verdict, bounce, or tip-over
(M2 contact). Keyboard only, with no touch controls. No human-measured performance
budgets (M3); the software-rendered test project runs at about 15 fps. Verified
locally on an Apple M1 Pro: see the [runtime](verification/runtime.md) and
[instrument](verification/instruments.md) records.

Before v0.1.0: step 0.1 established the charter; 0.2 added workspaces, checks, CI,
and MIT licensing; 0.3–0.5 added the viewport, Pages delivery, the bilingual UI
shell, and developer docs. None of these were tagged.
