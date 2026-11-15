# Releases

One short note per tagged release, newest first. The steps named in each note
are in [PLAN.md](PLAN.md) (the milestone in hand) or
[PLAN-ARCHIVE.md](PLAN-ARCHIVE.md) (finished milestones).

## v0.4.0-preview.2 — Terrain and missions (2026-11-10)

A second midpoint of M5, for trying the real Moon and the new vehicle on phones.
The opening is unchanged: its scripted flights are bit-identical to
v0.4.0-preview. The level's own limits and instruments (5.5c) and the polish step
arrive before v0.4.0.

- **The Moon's terrain (5.4a):** one height function for the whole Moon, from
  NASA's LOLA elevation grid (about 7.6 km per sample, 2 MB) plus seeded craters,
  boulders, and roughness; the legs touch it. See ADR 0021.
- **Terrain rendering (5.4b):** the ground drawn as a cube-sphere quadtree of
  tiles meshed in a worker, finer near the camera, down to 16 cm between
  vertices under the legs, and a `?scenario=terrain` sandbox low over
  Tranquility Base. Detail fades in with size and new tiles grow out of their
  parents, so craters neither pop in nor alias on their rims. See ADR 0022.
- **Landing anywhere (5.4c):** touchdowns judged against the local vertical; with
  no pad, a safe landing is "Landed!". See the ADR 0012 amendment.
- **Vehicles as data (5.5a):** each vehicle is one validated definition of its
  physics, rate assist, and model. The first lander is unchanged; the new descent
  vehicle carries 2.0 km/s on a 15 kN engine. See ADR 0023.
- **Mission picker (5.5b):** the game opens on two missions, Quick landing (the
  opening) and Landing from orbit (the descent vehicle in a 15 × 100 km orbit
  over the real terrain, a preview), chosen by click, tap, keys, or gamepad; a
  Missions button returns to the picker.

Known limits: Landing from orbit still uses the opening's start card and landing
limits; a lander resting on a slope creeps downhill (about 3 cm/s on 10°; fixed
after this release by static friction); the
planet drawing budget awaits the Galaxy A70 measurement.

## v0.4.0-preview — Into orbit (2026-11-08)

A midpoint of M5 for trying orbits on real devices. The opening hop is
unchanged: its scripted flights are bit-identical and its frames pixel-identical
to v0.3.1. The descent level and terrain arrive before v0.4.0.

- **Gravity and frames (5.1):** central gravity, the Moon's measured mass and
  rotation, and Moon-fixed, inertial, and local surface frames with conversions.
  See ADR 0018.
- **Orbits and time warp (5.2):** orbital elements, Kepler propagation, and
  session time warp: 2× and 4× with full physics, 10× to 1000× on Kepler rails
  once the throttle is closed and rotation has stopped. See ADR 0019.
- **Planetary view (5.3a):** the Moon drawn with NASA's LROC colour map, stars,
  sunlight with a day–night line, a chase camera that turns to the horizon in
  orbit, and a map of the whole Moon with the orbit and its high and low points.
  See ADR 0020 and the new asset register.
- **Orbit sandbox (5.3b):** `?scenario=orbit`, a developer preview not on the
  start card: the first lander in a 15 × 100 km orbit, with apoapsis,
  periapsis, time to each, and orbital speed; warp controls on keyboard (`,` and
  `.`), gamepad (D-pad), and screen; and the map on V, Back, or the ⋯ menu.

Known limits: there is no ground to land on around the Moon yet (reaching the
mean radius pauses the flight), and the sandbox's draw cost on phones is
unmeasured. On-device checks on the owner's iPhone 15 Pro and Galaxy A70 follow
this release.

## v0.3.1 — Clear view on phones (2026-11-07)

A phone HUD redesign after the first try on a real iPhone: the centre of the
screen, between the lander and the pad, now stays clear in every phase.

- **Phone HUD (4.4c):** on landscape phones, one compact readout card top left
  (altitude, vertical speed, safe-sink bar, and a single line with horizontal
  speed, tilt and fuel), pause and a ⋯ menu top right with the radar under them
  and the yaw buttons beside it, a slim lever on the left and the stick zone
  bottom right. The layout holds before the flight and behind the results card.
  Language, sound, restart and Help move into the ⋯ menu, which pauses the
  flight while open. See the ADR 0017 amendment.
- **Upright start screen:** a slim header, a "How to fly" card whose text
  wraps, a "turn your phone to fly" hint, and Start; no instruments.
- **Layout tests:** browser tests at the iPhone and Galaxy A70 sizes (browser
  toolbars, installed with insets, and upright) fail if anything enters the
  centre corridor or if any text or panel overflows, in both languages.
- Tablets and desktop are unchanged, apart from one Spanish line on the tablet
  start card that now wraps instead of running into the padding.

Known limits: phone sizes are emulated in Chromium; the ⋯ menu uses the native
popover (iOS 17+, Chrome 114+). On-device acceptance on the owner's iPhone 15 Pro
and Galaxy A70 follows this release.

## v0.3.0 — Phones and pads (2026-11-07)

Gravitas leaves the keyboard: one input layer feeds keyboard, gamepad, and touch,
and phones get a landscape layout and can install the game to the home screen.
This completes M4's steps; on-device acceptance on the owner's iPhone 15 Pro and
Galaxy A70 follows this release.

- **Input layer (4.3a):** a generalized `PilotInput` (any lever speed and
  position) and an `InputSource` merge rule: strongest rotation request per axis,
  throttle to the source that last began moving it. Keyboard and scripted flights
  bit-identical. See ADR 0016.
- **Gamepad (4.3b):** standard-mapping controllers with proportional pitch and
  roll, bumper yaw, pressure-scaled trigger throttle, A to confirm, and Start to
  pause; help and the start card follow the device in use.
- **Touch (4.3c):** a themed `<gravitas-touch-controls>` element: a left-thumb
  lever with a hover detent (and a vibration tick where supported), a right-thumb
  floating stick, and yaw buttons; a "Touch controls" setting (automatic, always,
  never).
- **Phone layout (4.4a):** a compact landscape HUD that keeps both thumb zones
  clear, a rotate prompt that pauses in portrait, pinch and double-tap zoom
  blocked, safe-area insets for the notch, and a device line in `?debug`. See
  ADR 0017.
- **Installable app (4.4b):** a web app manifest generated from the theme
  (landscape, full screen with a standalone fallback, the install icons), iOS
  home-screen tags, and install instructions in the manual. No offline mode.

Known limits: not yet tried on a real phone or a physical gamepad; WebKit's
gesture handling was emulated in Chromium only. On phones the HUD returns from the
compact strip to the desktop panels behind the results card. Glass blur stays on
by default on phones until it is measured there. Measured on an Apple M1 Pro:
60 fps on WebGPU, main-thread work 0.8 ms p95, 45 draw calls; see the
[performance](verification/performance.md) record.

## v0.2.0 — A complete landing (2026-11-07)

Every descent now ends in a verdict you can understand and retry, with physical
ground contact, effects and sound, a player manual with a Learn section, and the
Glass look with the Kepler mark.

- **Contact (2.1):** spring-damper legs and hull points with friction, so the
  lander can bounce, slide, or tip over; drawn leg compression. See ADR 0011.
- **Outcomes (2.2):** verdicts (on the pad, off the pad, too rough, crash) from
  engine contact facts and game-owned limits; an explanatory results card, Try
  again, a "How to fly" card, and a 60 kg opening. See ADR 0012.
- **Manual (2.3):** a bilingual player manual at `/gravitas/manual/`, linked from
  Help.
- **Effects (3.1):** engine plume and light, attitude-thruster puffs, and ground
  dust, held still under reduced motion.
- **Audio and settings (3.2):** synthesized engine, thruster, and touchdown sound;
  Mute (M); language, mute, and start card remembered.
- **Diagnostics (3.3):** a `?debug` overlay and `npm run measure`, with proposed
  performance budgets.
- **Learn (3.4):** seven chapters per language with rendered equations and six
  explorers running the real engine, up to Newton's cannon on the Moon. See
  ADR 0013.
- **Housekeeping (4.1):** shared engine math, also exposed to UI as the pure
  `@gravitas/engine/math` entry point; the HUD split into focused modules; no
  behaviour change (scripted flights bit-identical).
- **Theme and identity (4.2):** typed themes in `@gravitas/ui/themes` driving the
  HUD, scene accents, and manual (ADR 0014); the Glass look in a deeper cyan with
  self-hosted Space Grotesk and Inter (ADR 0015), the motion rules, a safe-sink
  hint under vertical speed, and a "Reduce transparency" setting; the Kepler mark,
  favicons, install icons, and a link preview.

Known limits: keyboard only, with touch and gamepad in 4.3. Phone layouts are 4.4:
on a landscape phone the start card overlaps the instruments, and the glass blur's
cost on the test phones is unmeasured. Install icons exist, but the web app
manifest arrives in 4.4. Measured on an Apple M1 Pro with the Glass UI: 60 fps on
WebGPU, main-thread work 0.7 ms p50 and 0.8 ms p95, 45 draw calls; the
software-rendered test project runs at about 15 fps. See the
[performance](verification/performance.md), [theme](verification/themes.md), and
[housekeeping](verification/housekeeping.md) records.

## v0.1.0 — First flight (2026-11-06)

The first playable build: one lander flown with the keyboard from 80 m above the
pad, with no landing verdict yet.

- **Flight model (1.1):** pure RK4 rigid-body dynamics with gravity, body-axis
  thrust, and fuel/mass loss. Rate-command attitude assistance draws from the same
  tank as the main engine. Poses locate the centre of mass. See
  [the flight model](FLIGHT.md) and ADR 0008.
- **Runtime (1.2):** app-owned 60 Hz fixed-step session with bounded catch-up and
  discarded-time accounting, keyboard controls scoped away from menus,
  pause/resume/restart, a hidden-tab pause, interpolated rendering, and a
  placeholder ground halt. See ADR 0009.
- **Camera and instruments (1.3):** a heading-following chase camera and a
  heading-up landing radar sharing engine's `headingAngle`. Altitude and vertical
  speed are prominent; fuel/throttle gauges carry a hover mark; surface depth cues
  added. See ADR 0010.
- Bilingual es-AR/English throughout, switchable mid-flight. WebGPU with WebGL 2
  fallback. Developer API docs are published with the game.

Known limits: touchdown stops the flight without a verdict, bounce, or tip-over
(M2 contact). Keyboard only, with no touch controls. No human-measured performance
budgets (M3); the software-rendered test project runs at about 15 fps. Verified
locally on an Apple M1 Pro: see the [runtime](verification/runtime.md) and
[instrument](verification/instruments.md) records.

Before v0.1.0: step 0.1 established the charter; 0.2 added workspaces, checks, CI,
and MIT licensing; 0.3–0.5 added the viewport, Pages delivery, the bilingual UI
shell, and developer docs. None of these were tagged.
