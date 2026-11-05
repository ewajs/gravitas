# Gravitas

A spaceflight game for the web, built alongside reusable simulation, Three.js
viewport, and Lit UI libraries. Ambitious in direction; small, reviewable steps
in delivery.

**Status:** workspace/tooling foundation with a runnable title shell. No flight
simulation or gameplay yet. The first playable target is a short lunar landing
challenge; orbital flight and vehicle construction are later possibilities.

## Workspaces

| Workspace           | Responsibility                                                    |
| ------------------- | ----------------------------------------------------------------- |
| `packages/engine`   | Framework-independent simulation and flight dynamics              |
| `packages/viewport` | Three.js scene, cameras, interpolation, and visual effects        |
| `packages/ui`       | Optional Lit web components: instruments, menus, and settings     |
| `apps/game`         | Missions, input, assets, scheduling, persistence, and integration |

TypeScript strict, npm workspaces, Vite, Node 24 LTS. Libraries currently contain
empty public entry points. Three.js rendering (WebGPU with WebGL 2 fallback)
arrives in step 0.3; Lit and Spanish/English localization arrive in step 0.4.

## Development

```sh
nvm use
npm ci
npm run dev
```

Open the URL Vite prints. The shell currently displays only the Gravitas name.
`npm run check` runs format/lint/type checks and the test runner; `npm run build`
writes the production shell to `apps/game/dist`. Use `npm run preview` to serve it.
See [Contributing](CONTRIBUTING.md) for individual commands and boundaries.

## Read next

- [Game direction](docs/GAME.md): intended experience and first playable scope.
- [Architecture](docs/ARCHITECTURE.md): boundaries, ownership, time, and units.
- [Plan](docs/PLAN.md): reviewable increments and acceptance criteria.
- [Decisions](docs/decisions/README.md): choices and their tradeoffs.
- [Contributing](CONTRIBUTING.md): workflow, dependencies, and verification.
- [Agent instructions](AGENTS.md): shared rules for Claude and Codex.

Separate package references, a player manual, and a live link arrive with their
implementations. Names under `@gravitas/*` are internal workspace identifiers;
npm publication is deferred.

## License

Code and documentation: [MIT](LICENSE). Record third-party asset licenses and
provenance separately when assets are introduced.
