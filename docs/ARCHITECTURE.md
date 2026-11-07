# Architecture

**Status:** workspace boundaries, viewport, hosted delivery, engine flight
dynamics, a flyable keyboard runtime, a heading-following chase camera, and a
bilingual flight HUD with landing radar implemented (M1, v0.1.0). Engine surface
contact, touchdown judging, and the bilingual player manual implemented (M2).
Actuator effects, sound and settings, diagnostics, and the manual's Learn section
implemented (M3). See [the flight model](FLIGHT.md),
[ADR 0001](decisions/0001-stack-and-packages.md) and
[ADR 0002](decisions/0002-simulation-and-runtime.md) for tradeoffs.

## Package boundaries

| Workspace            | Owns                                                               | Allowed project dependencies    |
| -------------------- | ------------------------------------------------------------------ | ------------------------------- |
| `@gravitas/engine`   | Plain simulation state, dynamics, simulation stepping              | None                            |
| `@gravitas/viewport` | Three.js scene, camera, interpolation, effects, GPU lifecycle      | Engine public API/types         |
| `@gravitas/ui`       | Optional Lit instruments, menus, settings, localization, themes    | Engine types; engine math entry |
| `apps/game`          | Missions, outcomes, input, browser scheduling, assets, persistence | All libraries                   |

Engine provides generic contact facts; the game turns them into mission outcomes.
A reusable landing classifier can belong in engine with explicit parameters,
without hard-coding a particular mission's thresholds.

Libraries never import app code. Viewport and UI never import each other. Imports
use package public entry points, not private files. Engine has no browser, Three.js,
or Lit dependency. Enforce boundaries in lint, including reverse type-only imports.
Consume packages from TypeScript source initially; publication and stable API
compatibility promises are deferred.

A library's public API is exactly the entry points its `package.json` `exports`
lists; nothing else is importable. Each library has `src/index.ts`, and a further
entry point is added only when a consumer needs a narrower boundary, not for
convenience. Engine has one: `@gravitas/engine/math`, pure arithmetic that UI may
call at runtime (UI otherwise imports engine types only, so it displays state and
never simulates). UI has one: `@gravitas/ui/themes`, typed themes as plain data
with no Lit import, so build tooling and the manual can use the tokens without the
HUD ([ADR 0014](decisions/0014-theme-system.md)). Engine defines the shared `VehiclePose`
type (centre of mass in world metres and a body-to-world quaternion), imported
directly by every consumer. Engine also exports pure `stepFlight` dynamics and
`rateControlTorque` assistance; `FlightState` extends `VehiclePose`. Its
`headingAngle` and `bodyToWorld` helpers give viewport's camera and the app's radar
one heading definition. Its shared math (`math.ts`: vector and quaternion operations,
`clamp`, `toRadians`/`toDegrees`, `rotationAbout`) serves the dynamics, the app, and
the manual's Learn models, so none keeps its own copy. Viewport uses Three.js math and
converts only at its pose boundary; UI takes `clamp` and `toDegrees` from the math
entry point. `contactFacts` and the `Surface` seam report surface contact
([ADR 0011](decisions/0011-contact-model.md)). The pure
`updateTouchdown`/`classifyTouchdown` reducer judges touchdowns from those facts
with host-supplied limits ([ADR 0012](decisions/0012-landing-outcomes.md)). Viewport exposes lifecycle, pose, interpolated-render,
camera-reset, leg-compression, and actuator-effect operations. UI exposes
`FlightHud`, `TouchControls` (on-screen lever, stick, and yaw buttons that emit
plain values, never pilot input), explicit registration, telemetry/request/input
types, and localized messages;
its themes entry exposes the theme type, the house theme, and CSS generation.
Viewport's `setAccents` takes a theme's scene accents; the game passes them across.
ESLint resolves npm workspace symlinks to their actual package paths and checks
static imports, re-exports, dynamic imports, and type-only dependencies. Cross-package
imports use `@gravitas/*`, never relative paths or private subpaths. Engine's
TypeScript config includes neither DOM libraries nor ambient Node types. See
[ADR 0004](decisions/0004-workspace-tooling.md) for tooling details.

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

Pause on document hide. Paused or hidden wall time never becomes simulation time;
the sub-step remainder from before a pause is kept so the picture does not jump.
Consume discrete actions once; held controls are sampled per frame and applied to
each tick in it (input events cannot arrive between ticks of one frame). Every
input device is a source behind one merge rule
([ADR 0016](decisions/0016-input-layer.md)): the strongest rotation request per
axis, the throttle to whichever source last began moving it, and commands from any
source. Restart resets input, tick history, and interpolation.
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
  document force and control frames explicitly. Main thrust acts along body +Y;
  torque and angular velocity use body axes; poses locate the centre of mass. See
  [FLIGHT.md](FLIGHT.md).
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

Lit and `@lit/localize`, native platform behavior, CSS custom properties generated
from a typed theme (`@gravitas/ui/themes`); the page gets the same properties at
build time, and the scene's non-physical marks take the theme's accents. The game
self-hosts the theme's typefaces (Space Grotesk and Inter, `@fontsource-variable`)
on the page, where shadow-root text can use them
([ADR 0015](decisions/0015-glass-look-and-typefaces.md)). The safe-sink hint is a
game rule passed in telemetry; the HUD only draws it. es-AR default,
English complete; locale switches preserve flight state. UI's TypeScript config
uses legacy decorators (`experimentalDecorators: true`, `useDefineForClassFields:
false`), matching Lux's familiar Lit convention. App and browser-test TypeScript
configs use the same settings because they consume UI source directly.
`FlightHud` receives immutable telemetry snapshots and the session phase; only
presentation properties are reactive. Native select/button/dialog elements
provide language selection and help. No component kit is needed yet.

TypeDoc generates each library's API/guide and the application integration
walkthrough from public exports, TSDoc comments, and Markdown. `npm run build`
combines the game and docs in one Pages artifact, with docs under `/gravitas/docs/`.
See [the developer guides](developer/README.md). The bilingual VitePress player
manual (`manual/`) builds into `/gravitas/manual/` (Spanish) and
`/gravitas/manual/en/` in the same artifact; Help links to it in the current
language. Its Learn section imports `@gravitas/engine` and the game's lander values
so explorers run the real simulation ([ADR 0013](decisions/0013-learn-section.md)).
Its config imports `@gravitas/ui/themes` for brand colours (with darker accent
steps on light pages, contrast-tested) and loads the game's typefaces and logo.
Main deployments publish all three.

## Current integration: one flight

1. `apps/game/src/main.ts` registers the HUD, creates a `FlightSession` from the
   lander and opening scenario, and attaches its input sources (`KeyboardControls`
   on the window, `GamepadControls` over `navigator.getGamepads`, and
   `TouchControlsSource` listening to UI's `<gravitas-touch-controls>`) through
   `PilotInputs` (`input.ts`), which merges them. The touch element draws the
   controls and reports lever, stick, and yaw values; the game maps them (dead
   zone, response curve, signs) and shows the element during a flight when the
   setting and the device in use call for it.
   It selects the initial locale. The page's colours come from the theme, written
   into `index.html` at build time. `index.html` slots the app's mark into the
   HUD and carries the favicons and link-preview tags; `npm run icons` renders the
   mark into them.
2. The HUD displays loading text, then the app dynamically imports viewport so the
   larger 3D download does not block the initial status presentation.
3. Viewport is constructed with the centre-of-mass height, receives the theme's
   scene accents and the opening pose, initializes Three.js, places its chase camera behind the heading, compiles
   materials, and attaches its own canvas. The session waits in `ready`.
4. Each animation frame, the app polls gamepads (their commands act first), then
   passes elapsed time and the merged input to the session, which runs whole 60 Hz ticks (at most 5). The app then hands viewport
   the current and previous tick poses and the remainder fraction. Viewport blends
   them, draws each leg compressed by its contact penetration (from `contactFacts`),
   shows the actuators the session actually applied (plume, thruster puffs, dust),
   advances the chase camera on its own presentation clock, and draws.
5. While flying, the app publishes a telemetry snapshot to the HUD at 10 Hz, and
   at once on any phase change. It includes heading-frame radar vectors (lean,
   drift, pad). HUD buttons emit `flight-request`; P and Enter reach the app through
   `KeyboardControls`, A and Start through `GamepadControls`, like every input
   source's commands. All call the same session operations. The HUD's
   `inputDevice` names the device last used, so its start card, Help, and hints
   describe that device's controls. Restart also calls
   `viewport.resetCamera()`, so the camera does not ease across the teleport.
   After each tick the session updates its touchdown record. On a final verdict it
   enters `complete` (engine cut, input ignored, physics continuing), and the app
   publishes a `LandingReport` built by `report.ts`.
6. Window blur releases held input. A hidden document stops frames and pauses the
   flight. Resuming drawing resets the frame timestamp, so hidden time is never
   simulated.
7. Audio (`audio.ts`) is synthesized with Web Audio, created on the first key or
   click as autoplay rules require, suspended unless flying or playing out a crash,
   and muted on request. Settings (`settings.ts`: language, mute, start card seen, reduce transparency)
   load once, validated as external data, and are saved only when they change.
8. A HUD `locale-request` loads translations and updates the HUD locale, document
   language, canvas label, and URL. The renderer, camera, and session remain intact.
9. `?debug` adds a developer overlay (`diagnostics.ts`). It summarizes frame
   interval, main-thread work, dropped time, and viewport's `renderStats` at 4 Hz,
   plus the screen size and pixel ratio, orientation, input device, touch
   controls, and whether panels are glass or solid, with no logging and no cost
   without the switch.
10. On a phone or tablet (a coarse primary pointer), a flight in portrait
    sets the HUD's `rotatePrompt` and pauses; the HUD only draws the prompt. The
    page blocks its own zoom (viewport meta, `touch-action`, and `zoom.ts` for iOS
    Safari's gesture events and double tap) and draws under the notch
    (`viewport-fit=cover`) with safe-area insets in every layer's CSS. When the
    game shows the touch controls it sets the HUD's `touchControls`, and the HUD
    moves its panels out of the thumb zones.
11. Device loss becomes a render error; the app stops, disposes, pauses the session,
    releases the input sources, and presents a localized failure. Language and help
    remain usable.

The session owns flight state; viewport and HUD receive copies. See
[viewport's API](../packages/viewport/README.md), [UI/localization](../packages/ui/README.md),
[ADR 0009](decisions/0009-flight-runtime.md), [ADR 0010](decisions/0010-chase-camera-and-instruments.md),
and the [flight model](FLIGHT.md).
