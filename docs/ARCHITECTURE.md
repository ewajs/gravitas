# Architecture

**Status:** agreed direction, awaiting implementation. See
[ADR 0001](decisions/0001-stack-and-packages.md) and
[ADR 0002](decisions/0002-simulation-and-runtime.md) for tradeoffs.

## Package boundaries

| Workspace | Owns | Allowed project dependencies |
| --- | --- | --- |
| `@gravitas/engine` | Plain simulation state, dynamics, simulation stepping | None |
| `@gravitas/viewport` | Three.js scene, camera, interpolation, effects, GPU lifecycle | Engine public API/types |
| `@gravitas/ui` | Optional Lit instruments, menus, settings, localization, tokens | Engine public types where useful |
| `apps/game` | Missions, outcomes, input, browser scheduling, assets, persistence | All libraries |

Engine provides generic contact facts; the game turns them into mission outcomes.
A reusable landing classifier can belong in engine with explicit parameters,
without hard-coding a particular mission's thresholds.

Libraries never import app code. Viewport and UI never import each other. Imports
use package public entry points, not private files. Engine has no browser, Three.js,
or Lit dependency. Enforce boundaries in lint, including reverse type-only imports.
Consume packages from TypeScript source initially; publication and stable API
compatibility promises are deferred.

## State ownership and a frame

Engine exposes simulation operations; the app runtime owns a flight session and
its authoritative current state. Meshes never supply physical position or velocity.

1. Map browser input into controls at simulation tick boundaries.
2. Advance the engine with controls, scenario parameters, and a fixed timestep.
   Simulation helpers are pure functions over plain data.
3. Evaluate mission rules from completed state/contact facts in the game.
4. Render interpolated visual state between completed ticks in viewport.
5. Send UI a small presentation snapshot and semantic outcome changes.

This is a conceptual contract, not a frozen method signature. Define the smallest
real API during implementation. Do not clone the world for every consumer or
invent a generalized event/transport framework.

Lit properties pass presentation data down; semantic custom events report actions
up. UI does not mutate flight state. Scope flight input to the active game, avoid
intercepting form typing, and clear held controls on focus loss/pause. Persist
settings/results at meaningful boundaries, not each tick.

## Time and lifecycle

Start at 60 Hz simulation with animation-frame rendering, an accumulator, and a
bounded number of catch-up steps. Account explicitly for discarded wall time
under overload; do not silently fast-forward physics.

Pause on document hide; clear accumulated wall time on resume. Paused wall time
never becomes simulation time. Consume discrete actions once and sample held
controls each tick. Restart resets input, tick history, and interpolation.
HUD quantities update at a deliberate lower rate; outcomes publish promptly.
Keep full simulation state outside Lit's reactive component state.

Mount/unmount explicitly owns subscriptions, listeners, animation frames, and GPU
resources. Handle asynchronous renderer initialization, disposal while initializing,
resize, and initialization failure without leaking resources.

## Data, units, and frames

- Plain serializable simulation data; identifiers instead of meshes/DOM nodes.
- SI: metres, seconds, kilograms, newtons, radians. Display conversion is at the UI edge.
- Right-handed world coordinates, Y up. Initial ground is XZ; gravity is -Y.
- Vehicle-local +Y is up, -Z forward, +X right. Orientation maps body to world;
  document force and control frames explicitly.
- Normalized quaternions for physical orientation; Euler angles only for
  presentation/input conveniences.
- Time/randomness are explicit; physical assumptions and assist parameters are named.

Planetary frames, floating origins, and orbital propagators need new decisions
when planetary distances arrive. A local lander does not solve orbital integration
or high-speed contact.

## Workers, saves, and reproduction

Start on the main thread. Explicit inputs, serializable state, and no browser
dependencies preserve worker compatibility. Moving later changes scheduling and
snapshot delivery, not dynamics. Design buffer ownership, ordering, and backpressure
when profiling warrants a worker adapter.

When saves/replays arrive, version formats, scenarios, and simulation assumptions.
Tick-indexed controls and starting scenarios support reproduction within a version.
Fixed steps alone do not promise bit-identical results across browsers/platforms.

## Rendering, UI, and docs

Three.js `WebGPURenderer`, WebGL 2 fallback, compatible materials, pinned versions.
Keep a force-WebGL development/test path. Test both backends; WebGPU-only features
require an explicit fallback policy before adoption.

Lit and `@lit/localize`, native platform behavior, shared CSS tokens. es-AR default,
English complete; locale switches preserve flight state. Choose/document decorator
and compiler conventions explicitly in tooling. No component library selected yet.

TypeDoc covers each library's API/guides and application integration walkthroughs.
A separate VitePress player manual is bilingual. Introduce each build with its
content, and do not claim published docs before deployment exists.
