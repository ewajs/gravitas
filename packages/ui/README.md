# @gravitas/ui

Optional Lit inspection HUD with localized readouts, language selection, loading/
failure messages, and native-dialog camera help. It imports engine types only and
has no dependency on viewport or the app.

```ts
import { registerUi, setLocale } from '@gravitas/ui';

registerUi(); // Safe to call more than once.
await setLocale('en');
const hud = document.createElement('gravitas-inspection-hud');
hud.heading = 'My lander'; // Branding belongs to the host.
hud.locale = 'en';
hud.pose = {
  position: { x: 0, y: 0, z: 0 },
  orientation: { x: 0, y: 0, z: 0, w: 1 },
};
hud.padPosition = { x: 0, y: 0, z: 0 };
hud.status = 'ready'; // Or 'loading' / 'failed'.
container.append(hud); // Overlay host: position: relative with an explicit height.
```

`InspectionHud` is also exported for TypeScript consumers. Its pose must follow
engine's `VehiclePose` contract: finite world metres and a normalized quaternion.
Pass a new immutable snapshot when presentation data changes. HUD reactivity does
not own or advance flight state. Offset is horizontal distance from the supplied
pad reference; tilt is the angle from upright, displayed in degrees. The static
inspection label is intentional; a future flight HUD will need actual flight data.

## Locale requests and ownership

The language selector emits `CustomEvent<LocaleRequest>` named `locale-request`,
with `detail.locale` equal to `es-AR` or `en`. It bubbles across the shadow root.
The host handles the asynchronous request: set `localePending`, await `setLocale`,
then commit `hud.locale` and update document language, accessible scene labels,
and any URL/settings state. Clear `localePending` in `finally`; set `localeError`
on failure while preserving the previous locale. The selector stays focusable
but ignores additional requests while pending. See the complete lifecycle and
error handling in [the app](https://github.com/ewajs/gravitas/blob/main/apps/game/src/main.ts).

Lit properties pass values down; the custom event requests an action up. UI never
imports viewport. The app connects the event to `viewport.setLabel()` without
recreating the scene or resetting its camera. Per-frame rendering stays outside
Lit's reactive lifecycle.

This uses `@lit/localize` runtime mode. Source strings use es-AR with voseo and
explicit message IDs; `src/locales/en.ts` contains the matching English translations.
`updateWhenLocaleChanges` subscribes while the component is connected and requests
a render when a locale becomes ready. `Intl.NumberFormat` uses the committed
locale for readouts. `viewportMessages()` remains available to hosts after
awaiting `setLocale()`.

## Styling and accessibility

Override `--gravitas-panel`, `--gravitas-text`, `--gravitas-muted`, `--gravitas-line`,
`--gravitas-accent`, `--gravitas-focus`, and `--gravitas-radius` on the HUD element.
Defaults live in `src/tokens.ts`. HUD panels do not intercept scene gestures;
interactive controls do. The help dialog makes the background inert and supports
Escape and focus return. Controls have 44px minimum height and visible focus;
safe-area spacing and stacked readouts support narrow layouts. No animation is
introduced, including when reduced motion is requested.

App and browser-test typechecking use UI's legacy decorator/class-field settings
because these workspaces consume TypeScript source directly. No package build or
publishing step is required.
