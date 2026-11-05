# Gravitas

A spaceflight game for the web, built alongside reusable simulation, Three.js
viewport, and Lit UI libraries. Ambitious in direction; small, reviewable steps
in delivery.

**Status:** project foundations. No runnable application yet. The first playable
target is a short lunar landing challenge; orbital flight and vehicle construction
are later possibilities.

## Planned workspaces

| Workspace | Responsibility |
| --- | --- |
| `packages/engine` | Framework-independent simulation and flight dynamics |
| `packages/viewport` | Three.js scene, cameras, interpolation, and visual effects |
| `packages/ui` | Optional Lit web components: instruments, menus, and settings |
| `apps/game` | Missions, input, assets, scheduling, persistence, and integration |

TypeScript strict, npm workspaces, Vite, Node 24 LTS. Rendering uses
`WebGPURenderer` with its WebGL 2 fallback. Player-facing content supports
Spanish (Argentina) and English.

## Read next

- [Game direction](docs/GAME.md): intended experience and first playable scope.
- [Architecture](docs/ARCHITECTURE.md): boundaries, ownership, time, and units.
- [Plan](docs/PLAN.md): reviewable increments and acceptance criteria.
- [Decisions](docs/decisions/README.md): choices and their tradeoffs.
- [Contributing](CONTRIBUTING.md): workflow, dependencies, and verification.
- [Agent instructions](AGENTS.md): shared rules for Claude and Codex.

Setup commands, separate package references, a player manual, and a live link
will arrive with their implementations. Names under `@gravitas/*` are internal
workspace identifiers; npm publication is deferred.
