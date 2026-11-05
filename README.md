# Gravitas

A spaceflight game for the web, built alongside reusable simulation, Three.js
viewport, and Lit UI libraries. Ambitious in direction; small, reviewable steps
in delivery.

**Status:** first procedural 3D inspection scene with a stationary lander and pad.
No flight simulation or gameplay yet. The first playable target is a short lunar
landing challenge; orbital flight and construction are later possibilities.

## Workspaces

| Workspace           | Responsibility                                                    |
| ------------------- | ----------------------------------------------------------------- |
| `packages/engine`   | Framework-independent simulation and flight dynamics              |
| `packages/viewport` | Three.js scene, cameras, interpolation, and visual effects        |
| `packages/ui`       | Optional Lit web components: instruments, menus, and settings     |
| `apps/game`         | Missions, input, assets, scheduling, persistence, and integration |

TypeScript strict, npm workspaces, Vite, Node 24 LTS. The viewport uses Three.js
WebGPURenderer with WebGL 2 fallback; its lifecycle/pose API is independent of
dynamics. Engine remains empty. Lit/localize supplies initial es-AR/English copy;
the full HUD arrives in 0.4. CI checks the built app in Chromium with WebGL 2;
the Pages workflow is prepared, with the first deployment pending owner merge.
See [delivery verification](docs/verification/delivery.md) for its current status.

## Development

```sh
nvm use
npm ci
npm run dev
```

Open the URL Vite prints. Drag to orbit, scroll to zoom, or focus the canvas and
use arrow keys to pan. Add `?lang=en` for English or `?backend=webgl2` to explicitly
request WebGL 2. With no backend override, Three.js selects the available backend.
`npm run check` runs format/lint/type checks and the test runner; `npm run build`
writes the production shell to `apps/game/dist`. Use `npm run preview` to serve it.
See [Contributing](CONTRIBUTING.md) for individual commands and boundaries.

```sh
npx playwright install chromium
npm run test:e2e          # Forced WebGL 2, production app + lifecycle fixture
npm run test:e2e:webgpu   # Requires usable WebGPU; asserts actual backend/image content
```

## Read next

- [Game direction](docs/GAME.md): intended experience and first playable scope.
- [Architecture](docs/ARCHITECTURE.md): boundaries, ownership, time, and units.
- [Plan](docs/PLAN.md): reviewable increments and acceptance criteria.
- [Decisions](docs/decisions/README.md): choices and their tradeoffs.
- [Contributing](CONTRIBUTING.md): workflow, dependencies, and verification.
- [Agent instructions](AGENTS.md): shared rules for Claude and Codex.
- [Viewport library](packages/viewport/README.md): pose/lifecycle contract and ownership.
- [UI/localization](packages/ui/README.md): initial bilingual messages.

Separate package references, a player manual, and a live link arrive with their
implementations. Names under `@gravitas/*` are internal workspace identifiers;
npm publication is deferred.

## License

Code and documentation: [MIT](LICENSE). Record third-party asset licenses and
provenance separately when assets are introduced.
