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

The owner approved combining the specification and engine implementation in 1.1.

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
      software-renderer frame rate recorded. Local checks passed on 2026-11-06; owner
      visual review closes M1. See [instrument verification](verification/instruments.md).

**Acceptance:** fly one vehicle with readable instruments. Pause/resume and render
rate changes preserve intended physics. Unit references and browser controls cover
focus and tab changes as well as ordinary flight.

## M2 — A complete landing challenge

- [ ] Define contact geometry, thresholds, start conditions, and boundary cases;
      implement contact/outcomes in reviewable slices.
- [ ] Add retry, understandable outcome feedback, bilingual control help.
- [ ] Introduce the bilingual player manual and its build/deployment checks.

**Acceptance:** start, fly, land/crash, understand the result, retry. No orbit,
construction, staging, or progression required.

## M3 — Feel and evidence

Plan after the first playable: tune camera/controls through playtesting, polish
instruments and restrained effects/audio, measure simulation/rendering budgets.
Developer diagnostics use an explicit switch, without per-frame logging.

## Later decisions

Workers based on profiling; PWA install/offline/update flow; touch flight controls
and supported devices; orbits/reference frames; curved terrain; multiple vehicles;
construction/staging; replay/save formats; library publication. No implied order.

MIT is selected for code/documentation. Track third-party asset licenses and
provenance when assets arrive.

## Releases

No tagged software releases yet. Step 0.1 established the charter; step 0.2 adds
workspaces, a title shell, import-boundary checks, CI, and MIT licensing.
