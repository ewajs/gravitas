# Game direction

**Status:** M1 released (v0.1.0). M2 in progress: physical touchdown (2.1) and
landing verdicts with explanations (2.2), and the bilingual player manual (2.3). This
document distinguishes shipped behavior from future direction.

## Current build: two missions

The game opens on a mission picker (5.5b): **Quick landing**, the first descent
below, and **Landing from orbit**, a preview until 5.5c finishes it. Click, tap,
or press Enter on one (arrows move between them; a gamepad's D-pad moves and A
chooses). During a flight the Missions button beside Restart (in the ⋯ menu on
phones), and Missions on the results card, return to the picker; the flight is
left where it was. Landing from orbit starts the descent vehicle (2 km/s of
velocity change, ADR 0023) on the orbit sandbox's 15 × 100 km orbit over the
Moon's real terrain, with time warp and the map; with no pad, a safe touchdown
is "Landed!". Its own limits, instruments for choosing a spot, and manual pages
arrive in 5.5c.

### Quick landing: the first descent

The lander starts 80 m up, facing the pad 30 m ahead, sinking and drifting toward
it. It waits until the player presses P or Start. Then the player flies with the
keyboard: W/S pitch, A/D roll, Q/E yaw, R/F raise or lower the throttle lever,
Z/X set full or cut, P pauses, Enter restarts. A standard-layout gamepad also
flies: the right stick pitches and rolls in proportion to how far it is pushed
(gently near centre), LB/RB yaw, RT/LT raise and lower the lever faster the
harder they are pressed, A starts, resumes, or tries again, and Start pauses.
While a gamepad is in use, the start card, Help, and hints show its buttons;
losing it mid-flight pauses. On a touch screen, on-screen controls appear during
a flight: a left-thumb throttle lever that moves relative to where it is grabbed,
stays put, shows the actual throttle, and catches in a detent at the current
hover throttle (with a short vibration on Android); a right-thumb stick that
appears where the thumb lands; and two yaw buttons. They show on the first touch
and hide after keyboard or gamepad use; Help's Display section has "Touch
controls: Automatic / Always / Never". Rotation controls request a turn rate;
releasing them stops rotation but does not level the lander. Rotation burns
fuel from the same tank as the engine.

The chase camera stays behind the lander's heading and level with the horizon,
so W always tilts toward the top of the screen and A toward the left. It looks
steeply down at altitude, keeping the pad ahead in view, and flattens near the
ground. Drag to look around (it eases back) and scroll to zoom. A light ring and
line mark the ground straight below, and the pad's ring is the accent cyan; rocks and craters show height and motion.
The engine plume grows with the throttle and lights the ground; attitude
thrusters puff where they fire; near the surface, the exhaust raises dust. Flicker
and dust motion stop when the system asks for reduced motion.

Synthesized sound follows the flight: an engine rumble with throttle, thruster
hiss, a touchdown thud, and short verdict tones. M or the speaker button silences
it. The browser remembers language, mute, the "Reduce transparency" and "Touch controls" display
settings, and that the start card was read (`?lang=` still wins).

The instruments sit on frosted glass panels and put altitude and vertical speed
first. Under vertical speed, a safe-sink scale shades how fast it is wise to sink at
this altitude: at most an eighth of the altitude per second, and no more than 2 m/s
in the last 16 m. It is a hint; the landing limits do not change. Sinking faster
turns it amber with a caution icon. A heading-up landing radar shows where thrust
is leaning (dot), horizontal drift (arrow), and the pad (cyan diamond, hollow
beyond 60 m). To stop drifting, lean against the arrow. Fuel and
throttle are bars with percentages, and a mark on the throttle bar shows the
hover setting. Tilt, horizontal speed, and distance to the pad are also shown as
numbers. Help/Ayuda lists the controls, explains the radar, and pauses the flight. Leaving the tab pauses too. The ES/EN selector switches language
mid-flight without changing the flight (`?lang=en` selects English on load).

The ground is physical. Legs compress like shock absorbers, so a gentle
touchdown settles onto four feet; a hard one bottoms the legs out or strikes the
structure; a sideways or tilted one can slide or tip. A "How to fly" card shows
the essential keys and the goal before the start. Every flight ends with a
verdict and a results card explaining it (see Landing rules). Help links to the
player manual in the current language. Try again (or
Enter) restarts.

On phones, flight is landscape-only. Turning the phone upright during a flight
shows a "Turn your phone sideways" prompt and pauses; turning back leaves it
paused until the player resumes. Menus, Help, the start card, and the results
card work in both orientations. On a phone held sideways with the touch controls
in use, the HUD keeps to the corners so the centre, from the lander down to the
pad, stays clear: one readout card top left (altitude and vertical speed large,
the safe-sink bar, then horizontal speed, tilt, and fuel on one short line), pause
and a ⋯ menu top right (language, sound, restart, Help; opening it pauses), the
radar card with the pad distance under them, the yaw buttons in a column beside
it, the lever on the left edge, and the stick bottom right. The same layout holds
before the start and behind the results card. Upright before a flight, the start
screen shows only "How to fly", a hint to turn the phone, and Start. Tablets keep
the 4.4a layout: a readout strip along the top and the radar between the thumbs.
The page never zooms (pinch or double tap); a pinch on the scene
zooms the camera. The game installs to a phone's home screen (a web app manifest
with the theme's colours and the Kepler icons) and opens full screen on Android,
standalone on iOS, in landscape; it still needs a connection. The layout respects the notch and the home indicator. On short
landscape screens the start card shows without the instruments behind it, and
the results card has two columns.

## Orbit and terrain sandboxes (developer previews)

Developer shortcuts skip the picker: `?scenario=quick-landing` and
`?scenario=orbit-landing` open those missions, and two sandboxes are reached only
this way. `?scenario=orbit` opens a sandbox that is not on the picker: the first lander
with a full tank in a 15 × 100 km lunar orbit inclined 20°, starting at apoapsis
over the Moon's daylight side. It is for trying orbits, time warp, and the map on
real devices before the descent level (5.5). The readouts show apoapsis,
periapsis, the time to each, and the orbital speed; time warp goes from 2× to
1000×; V (Back on a gamepad, the ⋯ menu on phones) shows the map. Altitude is the
height above the Moon's real ground straight below (NASA's elevation grid with
seeded detail, about 2 MB, loaded with the sandbox), while apoapsis and periapsis
are measured from the mean radius. The lander carries about 670 m/s of velocity
change, enough to lower its orbit but not to land. The chase view draws the
Moon's real ground, finer near the camera; the map keeps a smooth sphere.

`?scenario=terrain` opens a second developer sandbox: the same lander hovering
300 m above Tranquility Base (Apollo 11's site) with a full tank, in a low
morning Sun, with physics time warp up to 4×. In both sandboxes the legs touch the
real ground, and touchdowns are judged by the landing rules below against the
local vertical; with no pad, a safe landing is "Landed!". The descent level and
its own limits arrive in 5.5.

## Landing rules

Defined in `apps/game/src/rules.ts` and judged by engine's touchdown reducer:

| Verdict            | When                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Landed on the pad  | First leg contact at ≤ 2 m/s down, ≤ 1 m/s sideways, ≤ 10° tilt; then still on all legs for 1 s; centre over the pad (≤ 3.8 m) |
| Landed off the pad | The same, but the centre of mass ends more than 3.8 m from the pad centre: safe, but off target                                |
| Landed!            | The same where there is no pad (the sandboxes)                                                                                 |
| Too rough          | Settled and intact, but the first contact broke a speed or tilt limit                                                          |
| Crash              | Any hull point touches, a leg strikes faster than 5 m/s, or the lander tilts past 60° on the ground                            |

Speeds and tilt are read just before the first leg touches. Values exactly at a
limit pass. A touch-and-go that stays clear of the ground for a second starts
over. The opening carries 60 kg of fuel: a direct approach uses about 24 kg, so
hovering indefinitely ends in a crash.

## Purpose

Gravitas is about understanding and controlling motion in space. The ambition
includes deeper flight mechanics and potentially orbital missions and construction.
A playable challenge arrives early; reusable libraries grow from working needs.

## First playable target

A short lunar descent: one predefined lander, one landing area, limited fuel,
and a clear outcome. Control thrust and attitude, manage momentum, land, and retry.
The scene is 3D from the beginning.

- Local flat surface, constant lunar gravity, no atmosphere.
- One vehicle with thrust, fuel consumption, and changing mass.
- Assisted attitude control; define its model and inputs before first flight.
  Distinguish assistance from physical forces.
- Chase camera; readable altitude, velocity, fuel, and attitude instruments.
- Safe landing/crash outcomes, pause, restart, and a short control explanation.
- Spanish (Argentina)/English, switchable without resetting flight state.

The first lander's physical numbers, control model, and rate-command assistance are
defined in [the flight model](FLIGHT.md): one shared propellant tank feeds both
main engine and attitude thrusters, so rotation costs fuel. Landing thresholds,
keyboard bindings, contact behavior, and start conditions remain unselected. Define them with worked examples and acceptance cases
in the relevant step. Altitude/contact refer to actual vehicle contact geometry,
not just its origin.

## Experience and initial devices

Players should understand why a flight succeeded or failed. Instruments and
feedback teach momentum/thrust/descent without exposing developer diagnostics.
Polish supports legibility: stable camera, restrained motion, clear units,
responsive controls.

Keyboard, gamepad, and touch, with a landscape phone layout (M4). The test phones
are an iPhone 15 Pro and a Samsung Galaxy A70; their performance envelope is
measured on device after deployment. Menus retain ordinary keyboard and pointer
interaction.

## Later possibilities

Orbital dynamics, curved terrain, staging, construction, time warp, multiple
vehicles, progression, workers, and PWA support are future work. Each requires
scope and decisions when planned; they are not hidden first-lander requirements.
