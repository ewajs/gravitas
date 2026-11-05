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
- [ ] **0.4 Bilingual UI shell:** Lit HUD/menu, locale switch, design tokens, number
      formatting, keyboard focus, minimal real engine data contract. **Verify:** es-AR/en
      switch without state reset; desktop/narrow readability; owner reviews visuals.
- [ ] **0.5 Developer docs:** separate library/API guides and integration walkthrough;
      build checks and deployment. **Verify:** real exports documented, links/build pass.

## M1 — First flight

Split into small PRs when planned:

- [ ] Define vehicle/controls, attitude assistance, physical assumptions, and
      independent reference cases.
- [ ] Implement gravity, thrust, fuel/mass, and attitude dynamics in engine.
- [ ] Wire fixed-step runtime, input, interpolation, pause, restart.

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
