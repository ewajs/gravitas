# Gravitas

A spaceflight game for the web, built alongside reusable simulation, Three.js
viewport, and Lit UI libraries. Ambitious in direction; small, reviewable steps
in delivery.

**Status:** a flyable first descent: keyboard flight with a bilingual HUD,
fixed-step physics, pause and restart. Touchdown stops the flight without a landing
verdict until M2. The first playable target is a short lunar landing challenge; orbital flight and
construction are later possibilities.

[Open the live build](https://ewajs.github.io/gravitas/).

## Workspaces

| Workspace           | Responsibility                                                    |
| ------------------- | ----------------------------------------------------------------- |
| `packages/engine`   | Framework-independent simulation and flight dynamics              |
| `packages/viewport` | Three.js scene, cameras, interpolation, and visual effects        |
| `packages/ui`       | Optional Lit web components: instruments, menus, and settings     |
| `apps/game`         | Missions, input, assets, scheduling, persistence, and integration |

TypeScript strict, npm workspaces, Vite, Node 24 LTS. The viewport uses Three.js
WebGPURenderer with WebGL 2 fallback; its lifecycle/pose API is independent of
dynamics. Engine defines the shared pose contract and flight dynamics. The Lit
flight HUD shows altitude, speeds, tilt, fuel, and throttle, with live
es-AR/English switching and keyboard-accessible help.
CI runs fast checks and builds the app and developer docs; browser suites
run locally when relevant. GitHub Pages serves that build after successful main checks.
See [delivery verification](docs/verification/delivery.md) for its current status.

## Development

```sh
nvm use
npm ci
npm run dev
```

Open the URL Vite prints and press P to start the descent. W/S/A/D/Q/E rotate,
R/F move the throttle lever, Z/X set full or cut, P pauses, and Enter restarts.
Drag to orbit and scroll to zoom. Use the ES/EN selector to change language
mid-flight, and open Help/Ayuda for all controls. Add
`?lang=en` for English or `?backend=webgl2` to explicitly
request WebGL 2. With no backend override, Three.js selects the available backend.
`npm run check` runs format/lint/type checks and the test runner; `npm run build`
writes the game and developer docs to `apps/game/dist`. Use
`npm run preview -- --base /gravitas/` to serve the game at `/gravitas/` and
the API site at `/gravitas/docs/`. `npm run docs` rebuilds only the documentation.
See [Contributing](CONTRIBUTING.md) for individual commands and boundaries.

```sh
npx playwright install chromium
npm run test:e2e          # Forced WebGL 2, production app + lifecycle fixture
npm run test:e2e:webgpu   # Requires usable WebGPU; asserts actual backend/image content
```

## Read next

- [Game direction](docs/GAME.md): intended experience and first playable scope.
- [Architecture](docs/ARCHITECTURE.md): boundaries, ownership, time, and units.
- [Flight model](docs/FLIGHT.md): dynamics, controls, first lander, and worked examples.
- [Plan](docs/PLAN.md): reviewable increments and acceptance criteria.
- [Decisions](docs/decisions/README.md): choices and their tradeoffs.
- [Contributing](CONTRIBUTING.md): workflow, dependencies, and verification.
- [Agent instructions](AGENTS.md): shared rules for Claude and Codex.
- [Developer docs](docs/developer/README.md): library guides, API build, and integration walkthrough.
- [Engine library](packages/engine/README.md): pose/state contract and flight dynamics.
- [Viewport library](packages/viewport/README.md): pose, interpolation, camera, and lifecycle.
- [UI/localization](packages/ui/README.md): flight HUD, help, and live language switching.

The generated package references deploy alongside the game at `/gravitas/docs/`
from the same main artifact. The separate bilingual player
manual is planned for M2. Names under `@gravitas/*` are internal workspace
identifiers; npm publication is deferred.

## License

Code and documentation: [MIT](LICENSE). Record third-party asset licenses and
provenance separately when assets are introduced.
