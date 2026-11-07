---
title: Application integration
---

# From a keypress to a drawn frame

This walkthrough follows `apps/game/src/main.ts`, which connects engine, viewport,
and UI into a landing challenge: fly, touch down physically, and get an explained verdict.

## Ownership

| Owner    | Data and work                                                                                              |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| Engine   | `stepFlight` dynamics and `rateControlTorque` assistance over plain `FlightState`                          |
| App      | Session, fixed-step clock, input sources, lander/scenario values, telemetry, frame loop, locale, lifecycle |
| Viewport | Canvas, Three.js scene, pose interpolation, chase camera, resize observer, GPU resources                   |
| UI       | Presentation snapshots, number formatting, localized text, buttons, and the help dialog                    |

The app passes data down to both presentation layers. The HUD sends semantic
requests up (`flight-request`, `locale-request`); it never calls viewport. Meshes
and Lit properties are never authoritative simulation state.

## 1. Build a session from app data

`FlightSession` (`apps/game/src/session.ts`) is plain TypeScript with no clock or
DOM. It receives everything it needs as one `FlightScenario`, which
`scenario.ts` assembles for the first descent:

```ts
export const FIRST_DESCENT: FlightScenario = {
  start: START_STATE, // 80 m up, facing the pad, sinking and drifting toward it
  vehicle: LANDER, // lander.ts: masses, thrust, inertia, torque, thrusters, contact points
  attitude: ATTITUDE, // lander.ts: rate-assist tuning
  environment: ENVIRONMENT, // lunar gravity and flat ground at y = 0
  limits: LANDING_LIMITS, // rules.ts: what counts as a landing
};

const session = new FlightSession(FIRST_DESCENT); // main.ts
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
const inputs = new PilotInputs([
  new KeyboardControls(window, inputCommand),
  new GamepadControls(navigator, window, inputCommand, gamepadConnection),
  new TouchControlsSource(document.querySelector('gravitas-touch-controls')!),
]);
hud.addEventListener('flight-request', flightRequested);
window.addEventListener('blur', () => inputs.clear());
```

Branding belongs to the app, so `index.html` puts the mark inside the element,
and the HUD shows it through slots: the small cut beside the name, a larger one
on the start card.

```html
<gravitas-flight-hud>
  <img slot="mark" src="/mark-small.svg" alt="" width="22" height="22" />
  <img slot="mark-large" src="/mark.svg" alt="" width="34" height="34" />
</gravitas-flight-hud>
```

The mark's two SVG cuts live in `apps/game/public/`. `npm run icons`
(`scripts/icons.ts`) renders them with the pinned Playwright Chromium into the
favicons, the Apple touch icon, the install icons, the 1200 × 630 link preview,
and the manual's logos. Its output is committed and reproducible byte for byte.

Each input device is an `InputSource` (`input.ts`): `sample()` returns this
frame's `PilotInput` and consumes any one-shot setting, `clear()` releases held
input, and discrete commands (`toggle-pause`, `restart`, `toggle-mute`) go to one
app callback. `PilotInputs` samples every source once per frame and merges them:
each rotation axis takes the strongest request (an idle source adds nothing, and
two sources never add up), and the throttle follows the source that most
recently began moving the lever. A `PilotInput` asks for body rates in [-1, 1], a
lever speed in [-1, 1] as a fraction of `THROTTLE_RATE` (0.5 per second), and an
optional one-shot lever position in [0, 1].

`KeyboardControls` (`controls.ts`) is the keyboard source. It tracks physical
keys: held rotation keys request full rates, a held R or F moves the lever at full
speed, and Z/X queue a one-shot lever setting. P and Enter call back immediately
as `toggle-pause` or `restart`. Keys from the language selector, the help dialog,
or with Ctrl/Meta/Alt are ignored, so menus and browser shortcuts keep working.
HUD buttons emit `flight-request`. Both paths call the same `flightAction`.
Pausing and restarting also release held input, because a keyup may never arrive
after focus moves.

`GamepadControls` (`gamepad.ts`) is the gamepad source. Browsers expose gamepads
only by polling, so the frame loop calls `inputs.poll()` first: it reads the first
connected pad with the standard mapping and turns fresh presses of A and Start
into `confirm` and `toggle-pause`, before the frame's timing, so a start begins
timing at once. `gamepadInput()` is the pure mapping (right stick through the
shared `stickResponse` dead zone and curve, bumpers, trigger pressure). Each
source reports whether its latest sample was deliberate input; the app sets the
HUD's `inputDevice` when that device changes, never per frame. While Help is open
(`hud.helpOpen`) the pad's buttons are ignored, and a lost pad pauses the flight.

Touch is split across the boundary. UI's `<gravitas-touch-controls>` (in
`index.html`, after the HUD) draws the lever, stick, and yaw buttons in the theme,
owns their pointers (several at once, with pointer capture), and emits
`lever-input`, `stick-input`, and `yaw-input` with plain values. It releases
everything on lift, `pointercancel`, window blur, a hidden page, or `disabled`.
`TouchControlsSource` (`touch.ts`) listens to those events, validates them, and
maps them: the stick through `stickResponse` with an 8% dead zone, the lever as a
one-shot `throttleSet`. The app passes the element `session.throttle` and the
hover throttle at the telemetry rate, so the lever shows the throttle actually
applied, and `syncTouchControls()` shows it while flying or paused when the
setting is Always, or Automatic and touch is the device in use (the first touch
anywhere switches to it; keys or a pad switch away).

## Sound and settings

`settings.ts` loads language, mute, "start card seen", "reduce transparency", and "touch controls"
from `localStorage`,
validating each field as external data. It never throws, and saves only when a
setting changes. An explicit `?lang=` still wins over the saved language.
`FlightAudio` (`audio.ts`) synthesizes engine, thruster, touchdown, and verdict
sounds with Web Audio. Its context is created on the first key or click,
because browsers block audio before a gesture. It is suspended unless the
session is flying or playing out a crash. `audioLevels` is the pure mapping
from actuation to sound levels.

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
viewport.setAccents(gravitasTheme.scene); // Sky, pad ring, and marker match the HUD.
viewport.setVehiclePose(session.state);
await viewport.init();
```

The theme comes from `@gravitas/ui/themes`, plain data without Lit. The HUD's
tokens are generated from the same object, and the game's Vite config writes its
custom properties and `theme-color` into `index.html`, so the page, the HUD, and
the scene agree from the first paint.

`init()` places the chase camera behind the opening heading, then awaits renderer
initialization and shader compilation before attaching the canvas. The `backend` getter reports the initialized backend. After success,
the app sets the HUD status to `ready` and starts scheduling frames.

## 4. One frame

```ts
function draw(timestamp: number) {
  inputs.poll(); // Gamepads: their commands act before this frame's timing
  const elapsed = lastFrame === undefined ? 0 : (timestamp - lastFrame) / 1000;
  lastFrame = timestamp;
  session.advance(elapsed, inputs.sample()); // Whole 60 Hz ticks, at most 5
  if (inputs.activeDevice) useDevice(inputs.activeDevice); // Help follows the device
  viewport.setVehiclePose(session.state, session.previous);
  viewport.setLegCompression(legCompression()); // contactFacts penetration per foot
  viewport.setActuators(session.actuation); // What the last tick applied: plume, puffs, dust
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
distance, tilt, fuel fraction, throttle, upright hover throttle, and the safe-sink
hint (`safeSinkRate` in `rules.ts`: the larger of 2 m/s and an eighth of the
altitude per second). It also gets
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
input sources, disconnects the resize observer, and disposes viewport. The HUD shows a
localized failure; locale selection and help remain usable.

Leaving the page normally or disposing the module during development also removes
the app's HUD, blur, and page lifecycle listeners. A back-forward-cache visit keeps
the instance. Disposal during asynchronous initialization cannot attach a late
canvas: viewport rejects initialization with `AbortError` and completes cleanup.

## Find the implementation

- [Application loop and lifecycle](https://github.com/ewajs/gravitas/blob/main/apps/game/src/main.ts)
- [Flight session and fixed-step clock](https://github.com/ewajs/gravitas/blob/main/apps/game/src/session.ts)
- [Input sources and merging](https://github.com/ewajs/gravitas/blob/main/apps/game/src/input.ts) and [keyboard controls](https://github.com/ewajs/gravitas/blob/main/apps/game/src/controls.ts)
- [Telemetry and foot clearance](https://github.com/ewajs/gravitas/blob/main/apps/game/src/telemetry.ts)
- [Landing rules](https://github.com/ewajs/gravitas/blob/main/apps/game/src/rules.ts) and [report](https://github.com/ewajs/gravitas/blob/main/apps/game/src/report.ts)
- [Lander parameters](https://github.com/ewajs/gravitas/blob/main/apps/game/src/lander.ts) and [opening scenario](https://github.com/ewajs/gravitas/blob/main/apps/game/src/scenario.ts)
- [Viewport lifecycle and interpolation](https://github.com/ewajs/gravitas/blob/main/packages/viewport/src/Viewport.ts)
- [Flight HUD](https://github.com/ewajs/gravitas/blob/main/packages/ui/src/flight-hud.ts)
- [Runtime verification](https://github.com/ewajs/gravitas/blob/main/docs/verification/runtime.md)
