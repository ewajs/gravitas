---
title: Application integration
---

# From a pose to the inspection scene

This walkthrough follows `apps/game/src/main.ts`. It describes the current static
inspection scene. The fixed-step flight runtime, input sampling, and interpolation
are planned for M1; they do not run here yet.

## Ownership

| Owner    | Data and work                                                                                        |
| -------- | ---------------------------------------------------------------------------------------------------- |
| Engine   | The `VehiclePose` type: world metres and a body-to-world quaternion                                  |
| App      | Stationary pose, pad reference, branding, locale requests, animation-frame loop, visibility handling |
| Viewport | Canvas, Three.js scene, inspection camera, controls, resize observer, GPU resources                  |
| UI       | Presentation snapshots, number formatting, localized text, and the help dialog                       |

The app passes data down to both presentation layers. The HUD sends a semantic
request up to the app when a user chooses a language. It never calls viewport.
Meshes and Lit properties are not authoritative simulation state.

## 1. Attach the optional HUD

The page contains sibling viewport and HUD hosts inside a positioned, explicitly
sized `main` element. `registerUi()` defines `gravitas-inspection-hud` once; it is
safe to call again. Lit upgrades the element already in the document.

```ts
import { registerUi } from '@gravitas/ui';
import { INITIAL_POSE, PAD_POSITION } from './fixture';

registerUi();
const hud = document.querySelector('gravitas-inspection-hud')!;
hud.heading = 'Gravitas';
hud.pose = INITIAL_POSE;
hud.padPosition = PAD_POSITION;
```

These are Lit properties: assigning a new value schedules a component render.
The pose and pad reference use property bindings, not serialized HTML attributes.
The current pose is supplied once. The per-frame draw loop does not update Lit.

The two readouts are presentation measurements: horizontal XZ distance from the
pad reference, and tilt between body +Y and world +Y. They are not altitude,
contact detection, or a landing classifier. Numbers are formatted for the active
locale; the underlying pose remains SI/quaternion data.

## 2. Load the locale, then the renderer

The app chooses `es-AR` by default or `en` from `?lang=en`. It awaits `setLocale()`
before reading localized canvas text. The HUD initially shows loading status.
English translations load as a small deferred module; a failed download leaves
Spanish usable and displays a reload hint.

Viewport is dynamically imported after that initial status can render. The app
constructs it with the host, localized label, and backend preference, then supplies
the same pose used by the HUD:

```ts
const { Viewport } = await import('@gravitas/viewport');
const viewport = new Viewport({
  container: host,
  label: viewportMessages().scene,
  backend: parameters.get('backend') === 'webgl2' ? 'webgl2' : 'auto',
});
viewport.setVehiclePose(INITIAL_POSE);
await viewport.init();
```

`setVehiclePose()` validates and copies the pose into the artwork. `init()` awaits
renderer initialization and shader compilation before attaching the canvas.
The `backend` getter reports the initialized backend, not the requested preference.
After success, the app sets the HUD status to `ready` and starts scheduling frames.

## 3. Schedule rendering at the app boundary

One app-owned `requestAnimationFrame` loop calls `viewport.render()`. Viewport
updates camera controls and draws; it never schedules its own next frame.
The app stops requesting frames while the document is hidden or the viewport host
has zero width/height. Visibility and a host resize observer resume drawing when
appropriate. Viewport separately owns canvas size/DPR updates and camera aspect.

This loop has no simulation clock or physics step. Its future flight counterpart
will advance an explicit fixed-step engine state before rendering interpolated
results; animation-frame frequency must not become the physics timestep.

## 4. Switch language without remounting

The native selector emits `CustomEvent<LocaleRequest>` named `locale-request`,
with `detail.locale`. It bubbles across the component's shadow boundary. The app
validates the requested locale and serializes requests while translations load.
The selector remains focusable and indicates that it is busy.

After a successful load, the app:

1. Commits `hud.locale` and `document.documentElement.lang`.
2. Calls `viewport.setLabel()` with the localized scene description if graphics
   are still active.
3. Updates only the `lang` query parameter with `history.replaceState`, preserving
   the backend parameter and URL fragment.

Lit/localize's `updateWhenLocaleChanges` controller requests a UI render when
translations are ready and removes its subscription when the element disconnects.
`Intl.NumberFormat` uses the committed HUD locale. No viewport constructor,
`setVehiclePose()`, or camera reset runs during this flow.

If translations fail, the app keeps the previous committed locale and scene,
clears the pending flag, and asks the user to reload before retrying. Browser
module loading may cache a failed import. Help remains usable.

## 5. Distinguish graphics failure from application disposal

An initialization or render error stops graphics, cancels scheduled frames,
disconnects the app resize observer, and disposes viewport. The HUD shows a
localized failure message. Locale selection and help remain available so the
failure can still be read in either language.

Leaving the page normally or disposing the module during development also removes
the app's locale and page lifecycle listeners. A back-forward-cache visit keeps
the instance. Disposal during asynchronous initialization cannot attach a late
canvas: viewport rejects initialization with `AbortError` and completes cleanup.
Its `dispose()` operation is awaitable and safe to repeat; a disposed instance is
not reusable. Mount a fresh instance for a new scene.

## Find the implementation

- [Application lifecycle and locale flow](https://github.com/ewajs/gravitas/blob/main/apps/game/src/main.ts)
- [Stationary fixture and pad reference](https://github.com/ewajs/gravitas/blob/main/apps/game/src/fixture.ts)
- [Viewport lifecycle](https://github.com/ewajs/gravitas/blob/main/packages/viewport/src/Viewport.ts)
- [HUD and semantic event](https://github.com/ewajs/gravitas/blob/main/packages/ui/src/inspection-hud.ts)
- [Local browser verification](https://github.com/ewajs/gravitas/blob/main/docs/verification/ui.md)
