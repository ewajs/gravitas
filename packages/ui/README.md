# @gravitas/ui

Optional Lit flight HUD: localized readouts, phase messages, start/pause/restart
buttons, language selection, loading/failure messages, and a native-dialog control
reference. It imports engine types only and has no dependency on viewport or the app.

```ts
import { registerUi, setLocale } from '@gravitas/ui';

registerUi(); // Safe to call more than once.
await setLocale('en');
const hud = document.createElement('gravitas-flight-hud');
hud.heading = 'My lander'; // Branding belongs to the host.
hud.locale = 'en';
hud.phase = 'ready'; // 'ready' | 'flying' | 'paused' | 'contact', owned by the host.
hud.telemetry = {
  altitude: 80, // m, lowest contact point above the surface
  verticalSpeed: -4, // m/s, negative descending
  horizontalSpeed: 2, // m/s
  padDistance: 30, // m, horizontal
  tilt: 0, // rad from upright
  fuel: 1, // fraction of capacity
  throttle: 0, // lever fraction
};
hud.status = 'ready'; // Or 'loading' / 'failed'.
hud.addEventListener('flight-request', (event) => {
  // event.detail.action: 'start' | 'pause' | 'resume' | 'restart'
});
container.append(hud); // Overlay host: position: relative with an explicit height.
```

`FlightHud` is also exported for TypeScript consumers, along with `FlightTelemetry`,
`FlightPhase`, `FlightRequest`, and `LocaleRequest`. Telemetry is a **presentation
snapshot** in SI units; the host computes it from its own flight state and contact
geometry. Pass a new immutable object when it changes, at a deliberate rate (the
game uses 10 Hz). HUD reactivity never owns or advances flight state.

Readouts use `Intl.NumberFormat` with the committed locale: one decimal for
distances and speeds (vertical speed is signed), whole degrees for tilt, and the
locale's percent pattern for fuel and throttle.

## Requests

The HUD decides nothing about the flight. Its buttons emit
`CustomEvent<FlightRequest>` named `flight-request`, which bubbles across the
shadow root. The primary button follows the phase (Start, Pause, Resume; none
after contact), and Restart appears once a flight has begun. Opening Help while
`phase` is `flying` emits a `pause` request first. The host applies requests to its
session and sets `phase`. Keyboard flight controls belong to the host.

The language selector emits `CustomEvent<LocaleRequest>` named `locale-request`,
with `detail.locale` equal to `es-AR` or `en`. The host handles the asynchronous
request: set `localePending`, await `setLocale`, then commit `hud.locale` and
update document language, accessible scene labels, and any URL/settings state.
Clear `localePending` in `finally`; set `localeError` on failure while preserving
the previous locale. The selector stays focusable but ignores additional requests
while pending. See the complete lifecycle in
[the app](https://github.com/ewajs/gravitas/blob/main/apps/game/src/main.ts).

## Localization

This uses `@lit/localize` runtime mode. Source strings use es-AR with voseo and
explicit message IDs; `src/locales/en.ts` contains the matching English translations.
`updateWhenLocaleChanges` subscribes while the component is connected and requests
a render when a locale becomes ready. `viewportMessages()` provides loading,
failure, scene-label, subtitle, and key-hint text to hosts after awaiting `setLocale()`.

## Styling and accessibility

Override `--gravitas-panel`, `--gravitas-text`, `--gravitas-muted`, `--gravitas-line`,
`--gravitas-accent`, `--gravitas-focus`, and `--gravitas-radius` on the HUD element.
Defaults live in `src/tokens.ts`. HUD panels do not intercept scene gestures;
interactive controls do. The phase message is a polite live region below the
header. The help dialog makes the background inert and supports Escape and focus
return. Controls have 44px minimum height and visible focus. Narrow layouts stack
readouts in three columns and hide the key-hint line, which Help repeats. No
animation is introduced.

App and browser-test typechecking use UI's legacy decorator/class-field settings
because these workspaces consume TypeScript source directly. No package build or
publishing step is required.
