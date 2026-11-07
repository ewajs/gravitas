# Contributing

Gravitas is a game and a set of reusable libraries. The owner must be able to
follow all of it. Prefer explicit code, familiar platform mechanisms, and small
changes over cleverness.

## Working cycle

1. Choose one agreed step from [PLAN.md](docs/PLAN.md); state its outcome and
   verification. Mark it in progress on the branch.
2. Branch from current `main`: `docs/`, `feat/`, `fix/`, or `chore/`.
3. Implement the smallest complete result. Split a growing step before expanding
   scope; a reviewer should be able to assess the PR in one sitting.
4. Run relevant checks, try changed player flows, and update affected docs.
5. Open a PR using the template; record completed work as done.
6. The owner reviews and merges. Verify deployed behavior when deployment exists.

Use conventional commit subjects. Tag milestone releases as `v0.N.0`, with a
short release note in PLAN.md; patch releases cover intervening fixes. The first
documentation PR does not declare a software release.

## Code and cognitive ownership

- TypeScript strict; avoid `any`. Validate external data at boundaries.
- Plain data and pure functions for physics/rules. Stateful lifecycle owners may
  use ordinary classes with private fields. Side effects stay at the edges.
- Comments explain reasons; exported APIs have concise TSDoc documentation.
- Use domain vocabulary, explicit units where ambiguous, and named physical
  assumptions and tunable values.
- No speculative ECS, plugin system, generic message bus, or compatibility layer.
  Abstractions need actual consumers.
- Explain unfamiliar Lit/platform concepts briefly, tied to changed code. Trace
  an action through the layers when a change crosses several boundaries.
- Code, technical docs, commits, and PRs are English. Player content is es-AR/en.

## Dependencies

Prefer a small set, but suggest established open-source tools when they remove
substantial non-core complexity. No trivial utility dependencies or home-grown
replacement frameworks merely to avoid an established solution.

For meaningful additions, describe work saved, alternatives, maintenance/test
quality, license, runtime/bundle cost, and reviewability. Runtime stack changes
get an ADR and owner agreement. Routine dev tools within an agreed step can be
justified in the PR. Commit the lockfile.

## Verification

Use Node 24 (`nvm use`), then `npm ci` at the repository root. npm links the four
workspaces locally; there is no package publishing or separate library build.

| Command                                   | Does                                                        |
| ----------------------------------------- | ----------------------------------------------------------- |
| `npm run dev`                             | Vite development server; append `-- --host` for LAN testing |
| `npm run check`                           | Format, lint, types, and the test runner; every PR          |
| `npm run lint`                            | ESLint, including workspace boundaries; warnings fail       |
| `npm run typecheck`                       | Strict TypeScript in each workspace and build/test config   |
| `npm test` / `npm run test:watch`         | Vitest in Node; tests live beside source as `*.test.ts`     |
| `npm run format` / `npm run format:check` | Write/check formatting                                      |
| `npm run build` / `npm run preview`       | Build/serve game, developer docs, and manual in `dist`      |
| `npm run build:game`                      | Build only the game (also used by local browser suites)     |
| `npm run docs`                            | Generate library API references and developer guides        |
| `npm run manual` / `npm run manual:dev`   | Build (with dead-link check) / serve the bilingual manual   |
| `npm run measure`                         | Fly a workload on both browsers; report fps/work/draw calls |
| `npm run icons`                           | Render the mark into favicons, app icons, and social image  |

Vitest covers flight dynamics against independent references, the fixed-step session
(frame-rate independence, overload, pause, impact and settling), surface contact
against analytic references, touchdown judging boundaries, scripted whole-flight
regression pilots, key mapping and input merging, heading and
telemetry/radar geometry, the chase rig, effect and audio-level mapping, settings validation, shared math conventions, HUD number formats, theme contrast (WCAG ratios for every theme), pose and scene-accent validation/blending, and artwork
placement; empty suites are not allowed. Browser flight tests poll for outcomes
rather than assuming real time, because software renderers run below 60 fps.
Engine source has no DOM/ambient Node types; browser workspaces and build tooling
opt into their own environments.

Boundary rules check public entry points and dependency direction, including
type-only imports, re-exports, and dynamic imports. UI can import engine types
with `import type` and call the pure helpers in `@gravitas/engine/math`; engine cannot depend on other workspaces or runtime packages.
UI's theme data (`packages/ui/src/themes/`, published as `@gravitas/ui/themes`) is
its own lint element that may import nothing, so it stays free of Lit.
See [ADR 0004](docs/decisions/0004-workspace-tooling.md) for tooling decisions.

The player manual lives in `manual/` (Spanish at the root, English in `en/`, same
page names). Its Learn section's explorers run the real engine through
`manual/.vitepress/learn/models.ts`, unit-tested with the rest (`npm test`); keep
their numbers and the chapter prose in step with game tuning. VitePress fails the build on dead links, so CI's build checks them.
Keep landing limits in the manual, Help text, and `apps/game/src/rules.ts` in step.
Browser suites run locally
when UI, rendering, lifecycle, or delivery changes need them; record the results
and backend/device limits in the PR. Do not run heavy browser suites, simulation
matrices, or benchmarks in routine CI. For local browser checks:

```sh
npx playwright install chromium
npm run test:e2e
npm run test:e2e:webgpu
```

The first test script runs the forced-WebGL project. The second runs full Chromium
with automatic backend selection and requires actual WebGPU/image-content checks
to pass; automatic fallback is not success. Both suites test production app assets
and a separate public-API fixture, which is never included in `apps/game/dist`.
Both npm scripts build the game before testing. Playwright itself serves the existing build
under `/gravitas/`, exercising the Pages asset prefix and both locales. When running
`npx playwright test` directly, build first or supply the CI artifact.

On a headless software runner, use `GRAVITAS_SOFTWARE_GPU=1 npm run test:e2e` for
SwiftShader WebGL. `GRAVITAS_CHROMIUM=/absolute/path/to/chromium` optionally selects
an installed browser for diagnostics; normal verification uses the pinned
Playwright browser. Do not claim software runs establish physical-device coverage.
Some software runners expose WebGPU allocation but cannot present canvas textures;
report WebGPU as unverified on those hosts, preserving the strict hardware test.

### CI and delivery

The CI workflow runs format, lint, types, unit tests, and the combined game/docs build,
then uploads `apps/game/dist`. It does not install browsers or run Playwright.
Browser reports and retained failure traces stay local; use
`npx playwright show-report`. Lifecycle fixtures run on a separate development
server and are never part of the deployed artifact.

Only successful main runs can deploy, after the check/build job passes. The deploy
job downloads that artifact by ID without rebuilding and publishes it with the
official Pages actions. Only that job has Pages/id-token write permissions.
PR runs can be superseded; main runs
are serialized. A manual workflow run can deploy only when targeting main.

Pages must use **GitHub Actions** as its source in repository Settings → Pages.
The first deployment and live desktop/narrow checks are recorded in
[delivery verification](docs/verification/delivery.md) and
[ADR 0006](docs/decisions/0006-browser-ci-and-pages.md).

Browser tests reject unexpected warnings/errors. They permit the exact Chromium
GPU-stall-due-to-ReadPixels diagnostic caused by screenshots/traces/image assertions,
and explicitly declared fallback/failure messages in their targeted tests. No shader,
device-loss, or initialization error is generally ignored.

Physics tests use independently calculated expectations, invariants, and timestep
convergence where relevant. Browser tests cover integration, controls, lifecycle,
and presentation. Screenshots do not establish physical correctness. Use numerical
tolerances, not cross-platform bit equality. Browser tests fail on unexpected
page/console errors; explicitly declare expected errors.

Keep heavy matrices, long simulation runs, and benchmarks targeted to changes
they inform, with broader checks at milestones. Add `?debug` to the game URL for
the developer overlay (frame rate, main-thread work, draw calls, dropped time),
and run `npm run measure` for a repeatable frame-rate report. Record results and
the device in [performance measurements](docs/verification/performance.md). Establish performance budgets
from measured scenes and named devices. Do not test implementation trivia.

Docs-only changes also check local links, consistency, and diff whitespace.
Report unavailable checks plainly.

## Presentation and documentation

Aim for professional, readable instruments, clear hierarchy, responsive input,
and restrained motion. Use design tokens. Respect reduced motion, keyboard focus,
contrast, safe areas, and adequate targets. Custom Lit components come first;
evaluate a component library when concrete controls justify it.

Document engine, viewport, and UI separately, then explain the game integration.
Keep player help separate from technical docs. Commands and current-behavior docs
must stay accurate; label roadmap material as planned.

TypeDoc reads the three libraries' public entry points and package READMEs.
Edit [the developer landing page](docs/developer/README.md),
[integration walkthrough](docs/developer/integration.md), package guides, and
exported TSDoc comments alongside code changes. `typedoc.json` controls the site;
missing local paths, unresolved symbol links, and undocumented public API kinds
listed there fail the build. Inherited Lit/DOM members are hidden by default;
implementation hooks marked `@internal` are omitted.

`npm run build` builds the game first, then writes docs into `apps/game/dist/docs`.
`npm run docs` regenerates just that subdirectory. `npm run build:game` clears the
combined output, so run the full build again before previewing or shipping docs.
Use `npm run preview -- --base /gravitas/` to check both `/gravitas/` and
`/gravitas/docs/` with the Pages prefix. The existing main deployment publishes
both from the same artifact; there is no separate docs job or deployment build.
See [developer-docs verification](docs/verification/developer-docs.md).
