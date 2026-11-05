# Implementation plan

One step is one reviewable PR. `[ ]` planned, `[~]` in progress, `[x]` implemented.
Resolve implementation details when a step starts. Owner review precedes moving
to the next step unless the owner authorizes otherwise.

## M0 — Foundation

- [x] **0.1 Charter and decisions:** scope, stack, boundaries, runtime principles,
  dependency policy, shared agent workflow. **Verify:** local links and whitespace;
  consistent design, planned behavior labeled. Owner reviews before scaffolding.
- [ ] **0.2 Workspaces and checks:** Node 24/npm workspaces, TS strict, four manifests,
  Vite, ESLint boundary rules, Prettier, Vitest, lockfile, fast PR CI. No invented
  public APIs. **Verify:** clean install/check/build; demonstrate a temporary
  forbidden import fails lint, then remove it.
- [ ] **0.3 Viewport integration:** procedural vehicle/ground, camera, asynchronous
  renderer lifecycle, resize, forced-WebGL mode, Playwright smoke, Pages workflow.
  **Verify:** both backends locally on capable hardware; forced-WebGL smoke in CI;
  resize/remount cleanup. Hosting settings depend on available owner authorization.
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

Select the repository license before substantial implementation/external assets;
track asset provenance when assets arrive. This PR selects no license.

## Releases

No software releases yet. Foundation step 0.1 is documentation only.
