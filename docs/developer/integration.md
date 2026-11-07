---
title: Application integration
---

# From a keypress to a drawn frame

This walkthrough follows `apps/game/src/main.ts`, which connects engine, viewport,
and UI into a landing challenge: fly, touch down physically, and get an explained verdict.

## Ownership

| Owner    | Data and work                                                                                         |
| -------- | ----------------------------------------------------------------------------------------------------- |
| Engine   | `stepFlight` dynamics and `rateControlTorque` assistance over plain `FlightState`                     |
| App      | Session, fixed-step clock, keyboard, lander/scenario values, telemetry, frame loop, locale, lifecycle |
| Viewport | Canvas, Three.js scene, pose interpolation, chase camera, resize observer, GPU resources              |
| UI       | Presentation snapshots, number formatting, localized text, buttons, and the help dialog               |

The app passes data down to both presentation layers. The HUD sends semantic
requests up (`flight-request`, `locale-request`); it never calls viewport. Meshes
and Lit properties are never authoritative simulation state.

## 1. Build a session from app data

`FlightSession` (`apps/game/src/session.ts`) is plain TypeScript with no clock or
DOM. It receives everything it needs:

```ts
const session = new FlightSession({
  start: START_STATE, // scenario.ts: 80 m up, facing the pad, sinking and drifting toward it
  vehicle: LANDER, // lander.ts: masses, thrust, inertia, torque, thrusters, contact points
  attitude: ATTITUDE, // rate-assist tuning
  environment: ENVIRONMENT, // scenario.ts: lunar gravity and flat ground at y = 0
  limits: LANDING_LIMITS, // rules.ts: what counts as a landing
});
```

It starts in `ready`. `start`, `pause`, `resume`, and `restart` change the phase.
`flying` advances time and judges each tick with engine's touchdown reducer.
On a final verdict the session enters `complete`: the engine is cut and input is
ignored while physics continues, so a crash plays out. Each completed tick keeps the previous state for
interpolation.

## 2. Attach input and the HUD

```ts
registerUi();
const hud = document.querySelector('gravitas-flight-hud')!;
const keyboard = new KeyboardControls(window, keyCommand);
hud.addEventListener('flight-request', flightRequested);
window.addEventListener('blur', () => keyboard.clear());
```

`KeyboardControls` (`controls.ts`) tracks physical keys. Held rotation and
throttle keys are sampled once per frame. Z/X queue a one-shot lever setting. P
and Enter call back immediately as `toggle-pause` or `restart`. Keys from the
language selector, the help dialog, or with Ctrl/Meta/Alt are ignored, so menus
and browser shortcuts keep working. HUD buttons emit `flight-request`. Both
paths call the same `flightAction`. Pausing and restarting also release held
keys, because a keyup may never arrive after focus moves.

## 3. Load the locale, then the renderer

The app chooses `es-AR` by default or `en` from `?lang=en` and awaits `setLocale()`
before reading localized canvas text. Viewport is dynamically imported after the
HUD's loading status can render:

```ts
const { Viewport } = await import('@gravitas/viewport');
const viewport = new Viewport({
  container: host,
  centerOfMassHeight: CENTER_OF_MASS_HEIGHT,
  label: viewportMessages().scene,
  backend: parameters.get('backend') === 'webgl2' ? 'webgl2' : 'auto',
});
viewport.setVehiclePose(session.state);
await viewport.init();
```

`init()` places the chase camera behind the opening heading, then awaits renderer
initialization and shader compilation before attaching the canvas. The `backend` getter reports the initialized backend. After success,
the app sets the HUD status to `ready` and starts scheduling frames.

## 4. One frame

```ts
function draw(timestamp: number) {
  const elapsed = lastFrame === undefined ? 0 : (timestamp - lastFrame) / 1000;
  lastFrame = timestamp;
  session.advance(elapsed, keyboard.sample()); // Whole 60 Hz ticks, at most 5
  viewport.setVehiclePose(session.state, session.previous);
  viewport.setLegCompression(legCompression()); // contactFacts penetration per foot
  viewport.render(session.alpha); // Blend by the accumulator remainder
  // Publish telemetry at 10 Hz while flying, and at once on phase changes.
  frame = requestAnimationFrame(draw);
}
```

The display rate never changes the physics. The session runs fixed 1/60 s ticks
from accumulated time, and viewport draws between the last two of them. Under
overload, whole steps beyond five per frame are dropped and counted in
`session.discardedSeconds`, not fast-forwarded.

The loop stops for a hidden document or a zero-size host. Whenever it restarts,
`lastFrame` is cleared, so time spent not drawing is never simulated. A hidden
document also pauses the session; the player resumes with P or Resume.

The HUD receives a `FlightTelemetry` snapshot from `flightTelemetry(state, throttle)`:
altitude above the lowest foot, signed vertical speed, horizontal speed, pad
distance, tilt, fuel fraction, throttle, and upright hover throttle. It also gets
three radar vectors in the **heading frame** (x right, y forward): thrust lean,
drift, and the pad's offset. The app computes them with engine's `headingAngle`,
the same heading viewport's chase camera follows, so radar-up is screen-up and W
always leans toward it.

On a verdict, `landingReport(session)` (`report.ts`) turns the outcome into a
`LandingReport` for the HUD: verdict, crash cause, each limit with its value, pad
distance, fuel, and flight time. P does nothing after a verdict; Enter or Try
again restarts.

Restart is a teleport. The app sets the opening pose and calls
`viewport.resetCamera()`, so the camera snaps behind it instead of easing 80 m. The snapshot is a new object at 10 Hz;
per-tick state never enters Lit.

## 5. Switch language without touching the flight

The native selector emits `CustomEvent<LocaleRequest>` named `locale-request`.
The app validates it, serializes requests while translations load, then:

1. Commits `hud.locale` and `document.documentElement.lang`.
2. Calls `viewport.setLabel()` with the localized scene description.
3. Updates only the `lang` query parameter with `history.replaceState`.

The session, renderer, and camera are untouched; readouts re-render in the new
locale's number format. If translations fail, the previous locale stays and a
localized reload hint appears.

## 6. Distinguish graphics failure from application disposal

An initialization or render error stops frames, pauses the session, releases the
keyboard, disconnects the resize observer, and disposes viewport. The HUD shows a
localized failure; locale selection and help remain usable.

Leaving the page normally or disposing the module during development also removes
the app's HUD, blur, and page lifecycle listeners. A back-forward-cache visit keeps
the instance. Disposal during asynchronous initialization cannot attach a late
canvas: viewport rejects initialization with `AbortError` and completes cleanup.

## Find the implementation

- [Application loop and lifecycle](https://github.com/ewajs/gravitas/blob/main/apps/game/src/main.ts)
- [Flight session and fixed-step clock](https://github.com/ewajs/gravitas/blob/main/apps/game/src/session.ts)
- [Keyboard controls](https://github.com/ewajs/gravitas/blob/main/apps/game/src/controls.ts)
- [Telemetry and foot clearance](https://github.com/ewajs/gravitas/blob/main/apps/game/src/telemetry.ts)
- [Landing rules](https://github.com/ewajs/gravitas/blob/main/apps/game/src/rules.ts) and [report](https://github.com/ewajs/gravitas/blob/main/apps/game/src/report.ts)
- [Lander parameters](https://github.com/ewajs/gravitas/blob/main/apps/game/src/lander.ts) and [opening scenario](https://github.com/ewajs/gravitas/blob/main/apps/game/src/scenario.ts)
- [Viewport lifecycle and interpolation](https://github.com/ewajs/gravitas/blob/main/packages/viewport/src/Viewport.ts)
- [Flight HUD](https://github.com/ewajs/gravitas/blob/main/packages/ui/src/flight-hud.ts)
- [Runtime verification](https://github.com/ewajs/gravitas/blob/main/docs/verification/runtime.md)
