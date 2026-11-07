# @gravitas/ui

Optional Lit flight HUD in the "Glass" look: a heading-up landing radar, localized
readouts with a safe-sink scale, fuel and throttle gauges, phase messages,
start/pause/restart controls, language selection, loading/failure messages, an
explained results card, and a native-dialog control reference with a display
setting. It imports engine types plus the pure helpers in `@gravitas/engine/math`, and has no dependency on viewport or the app.

```ts
import { registerUi, setLocale } from '@gravitas/ui';

registerUi(); // Safe to call more than once.
await setLocale('en');
const hud = document.createElement('gravitas-flight-hud');
hud.heading = 'My lander'; // Branding belongs to the host.
hud.locale = 'en';
hud.phase = 'ready'; // 'ready' | 'flying' | 'paused' | 'complete', owned by the host.
hud.telemetry = {
  altitude: 80, // m, lowest contact point above the surface
  verticalSpeed: -4, // m/s, negative descending
  safeSink: 10, // m/s, optional: the host's advised sink rate here (draws the scale)
  horizontalSpeed: 2, // m/s
  padDistance: 30, // m, horizontal
  tilt: 0, // rad from upright
  fuel: 1, // fraction of capacity
  throttle: 0, // lever fraction
  hoverThrottle: 0.54, // upright hover setting at the current mass
  lean: { x: 0, y: 0 }, // heading frame: x right, y forward; magnitude sin(tilt)
  drift: { x: 0, y: 2 }, // m/s, heading frame
  pad: { x: 0, y: 30 }, // m, pad relative to the vehicle, heading frame
};
hud.status = 'ready'; // Or 'loading' / 'failed'.
hud.addEventListener('flight-request', (event) => {
  // event.detail.action: 'start' | 'pause' | 'resume' | 'restart'
});
container.append(hud); // Overlay host: position: relative with an explicit height.
```

`FlightHud` is also exported for TypeScript consumers, along with `FlightTelemetry`,
`RadarVector`, `FlightPhase`, `FlightRequest`, `LandingReport`, `LandingCheck`,
`LocaleRequest`, `SoundRequest`, and `AppearanceRequest`. Telemetry is a **presentation
snapshot** in SI units; the host computes it from its own flight state and contact
geometry. Pass a new immutable object when it changes, at a deliberate rate (the
game uses 10 Hz). HUD reactivity never owns or advances flight state.

Readouts use `Intl.NumberFormat` with the committed locale: one decimal for
distances and speeds (vertical speed is signed), whole degrees for tilt, and the
locale's percent pattern for fuel and throttle. Altitude and vertical speed are
the prominent numbers. Fuel and throttle bars keep their percentage as text; the
throttle bar marks `hoverThrottle` when it is at most 1. Gauge levels are CSS
custom properties (`--level`, `--hover`), so they ease between snapshots and the
throttle can stand upright beside the radar or lie flat on narrow screens.

When `safeSink` is present, a 0–10 m/s scale under vertical speed shades it, with a
tick at the current sink. Sinking faster turns the tick and readout amber and adds
a caution icon with an accessible name. The HUD only draws the hint; the host
decides the rule (the game's is in `apps/game/src/rules.ts`). Omit it to hide the
scale.

## Landing radar

A heading-up SVG disc: up is the vehicle's forward direction. It draws `lean` as a
dot (rim = 0.5, a 30° tilt), `drift` as an arrow (rim = 10 m/s; hidden when tiny),
and `pad` as a diamond in the accent colour (rim = 60 m; clamped to the rim and
hollow beyond). Each
uses its own scale; directions matter more than lengths. The host supplies the
vectors in the same heading frame as its camera. The disc has a static
accessible name, and tilt, horizontal speed, and pad distance are also readouts.

## Sound and the start card

`hud.muted` shows the speaker button (named Mute) as pressed (`aria-pressed`) with
a crossed-out speaker. Clicking it emits
`CustomEvent<SoundRequest>` named `sound-request` with the requested `muted` value;
the host applies, persists, and sets `muted`. `hud.showControls` (default true)
shows the "How to fly" card while ready; hosts can hide it once read.

## Manual link

Set `hud.manualHref` to the player manual for the current locale; Help and the
results card then show an "Open the manual" link in a new tab so the flight is not
lost. Leave it empty to hide the links.

## Start card and results

In `ready`, a "How to fly" card lists the essential keys and the goal, above the
Start button. Set `hud.report` (a `LandingReport`) when `phase` is `complete`. The
scene dims and a results card rises into the middle:

- a verdict badge (check, caution, or cross, in the good, warn, or bad colour), the
  verdict title (landed, off the pad, too rough, crash), and a summary or cause;
- each `LandingCheck` with a check or cross icon and screen-reader text, its value
  and limit (speeds in m/s, tilt in degrees, distance in m);
- fuel left and flight time as labelled tiles;
- Try again (emits `restart`), and the manual when `manualHref` is set.

The host decides every value; the HUD only explains.

## Requests

The HUD decides nothing about the flight. Its buttons emit
`CustomEvent<FlightRequest>` named `flight-request`, which bubbles across the
shadow root. Start appears below the phase message while ready. During a flight,
icon buttons beside the view options pause or resume and restart; after a verdict,
Try again is on the results card. Icon buttons have accessible names, tooltips,
and `aria-keyshortcuts`. Opening Help while
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

## Display setting

`hud.reduceTransparency` (reflected as the `reduce-transparency` attribute) swaps
the translucent, blurred panels for solid ones. Help's Display section has a
"Reduce transparency" checkbox that emits `CustomEvent<AppearanceRequest>` named
`appearance-request`; the host applies, persists, and sets the property. The
system's `prefers-reduced-transparency: reduce` has the same effect regardless.

## Localization

This uses `@lit/localize` runtime mode. Source strings use es-AR with voseo and
explicit message IDs; `src/locales/en.ts` contains the matching English translations.
`updateWhenLocaleChanges` subscribes while the component is connected and requests
a render when a locale becomes ready. `viewportMessages()` provides loading,
failure, scene-label, subtitle, and key-hint text to hosts after awaiting `setLocale()`.

## Themes

`@gravitas/ui/themes` is a second, narrower entry point: typed themes as plain
data, with no Lit or DOM import, so pages and build tools can use the tokens
without loading the HUD.

```ts
import { gravitasTheme, themeCss, themeProperties } from '@gravitas/ui/themes';

themeCss(gravitasTheme, ':root'); // ':root { --gravitas-text: …; … }'
themeProperties(gravitasTheme)['--gravitas-accent']; // One property's value
viewport.setAccents(gravitasTheme.scene); // Sky, pad ring, marker (host code)
```

A `Theme` names colours by role (`surface`, `panel`, `panelStrong`, `panelSolid`,
`line`, `text`, `muted`, `accent`, `accentInk`, `accentHover`, `focus`, `good`,
`warn`, `bad`, `well`, `track`, `backdrop`), plus `fonts` (body and display),
a panel `radius`, a `panelFilter` (backdrop filter), `colorScheme`, and `scene`
accents for a 3D view. `themes` lists every theme (one for now). A unit test checks
each theme's contrast: text and muted text at 4.5:1 on the page and on panels
composited over the page and over sunlit ground; accent, focus, and status colours
at 3:1.

The house theme is **Glass**: frosted panels, a `#4CC3E0` accent, Space Grotesk
labels, and Inter numbers. The theme only names font families. The host loads the
faces on the page (the game imports `@fontsource-variable/inter` and
`@fontsource-variable/space-grotesk`), because `@font-face` rules inside a shadow
root do not apply.

## Styling and accessibility

The HUD's tokens are the house theme's custom properties, generated in
`src/tokens.ts`. Override any of them on the HUD element: `--gravitas-surface`,
`--gravitas-panel`, `--gravitas-panel-strong`, `--gravitas-panel-solid`,
`--gravitas-panel-filter`, `--gravitas-line`, `--gravitas-text`, `--gravitas-muted`,
`--gravitas-accent`, `--gravitas-accent-ink`, `--gravitas-accent-hover`,
`--gravitas-focus`, `--gravitas-good`, `--gravitas-warn`, `--gravitas-bad`,
`--gravitas-well`, `--gravitas-track`, `--gravitas-backdrop`,
`--gravitas-font-body`, `--gravitas-font-display`, and `--gravitas-radius`.
HUD panels do not intercept scene gestures; interactive controls do. The phase
message is a polite live region below the header, visually hidden while empty.
The help dialog makes the background inert and supports Escape and focus return.
Controls have 44px minimum size and visible focus. Status pairs colour with an
icon or word. Narrow layouts merge the instruments into one panel, lay the
throttle flat, hide the identity during a flight, and hide the key-hint line,
which Help repeats; the key hints show only where the screen is wide enough.

Motion is subtle and never carries information alone: controls respond in 130 ms
with a small press, gauges and radar marks ease in 200 ms, the results card rises
in 280 ms with rows 50 ms apart, numbers never animate, and the phase dot breathes
only while flying. `prefers-reduced-motion` turns all of it off.

App and browser-test typechecking use UI's legacy decorator/class-field settings
because these workspaces consume TypeScript source directly. No package build or
publishing step is required.
