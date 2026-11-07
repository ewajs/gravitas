# Game direction

**Status:** M1 released (v0.1.0). M2 in progress: physical touchdown (2.1) and
landing verdicts with explanations (2.2); the player manual (2.3) is next. This
document distinguishes shipped behavior from future direction.

## Current build: first descent

The lander starts 80 m up, facing the pad 30 m ahead, sinking and drifting toward
it. It waits until the player presses P or Start. Then the player flies with the
keyboard: W/S pitch, A/D roll, Q/E yaw, R/F raise or lower the throttle lever,
Z/X set full or cut, P pauses, Enter restarts. Rotation keys request a turn rate;
releasing them stops rotation but does not level the lander. Rotation burns
fuel from the same tank as the engine.

The chase camera stays behind the lander's heading and level with the horizon,
so W always tilts toward the top of the screen and A toward the left. It looks
steeply down at altitude, keeping the pad ahead in view, and flattens near the
ground. Drag to look around (it eases back) and scroll to zoom. A blue ring and
line mark the ground straight below; rocks and craters show height and motion.

The instruments put altitude and vertical speed first. A heading-up landing
radar shows where thrust is leaning (dot), horizontal drift (arrow), and the pad
(diamond, hollow beyond 60 m). To stop drifting, lean against the arrow. Fuel and
throttle are bars with percentages, and a mark on the throttle bar shows the
hover setting. Tilt, horizontal speed, and distance to the pad are also shown as
numbers. Help/Ayuda lists the controls, explains the radar, and pauses the flight. Leaving the tab pauses too. The ES/EN selector switches language
mid-flight without changing the flight (`?lang=en` selects English on load).

The ground is physical. Legs compress like shock absorbers, so a gentle
touchdown settles onto four feet; a hard one bottoms the legs out or strikes the
structure; a sideways or tilted one can slide or tip. A "How to fly" card shows
the essential keys and the goal before the start. Every flight ends with a
verdict and a results card explaining it (see Landing rules). Try again (or
Enter) restarts. Desktop keyboard only; narrow layouts stay readable but have no
touch controls.

## Landing rules

Defined in `apps/game/src/rules.ts` and judged by engine's touchdown reducer:

| Verdict            | When                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Landed on the pad  | First leg contact at ≤ 2 m/s down, ≤ 1 m/s sideways, ≤ 10° tilt; then still on all legs for 1 s; centre over the pad (≤ 3.8 m) |
| Landed off the pad | The same, but the centre of mass ends more than 3.8 m from the pad centre: safe, but off target                                |
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

Desktop keyboard-first, with responsive UI. Touch flight controls and a mobile
performance envelope need later design/device checks; layout alone does not make
a phone playable. Menus retain ordinary keyboard and pointer interaction.

## Later possibilities

Orbital dynamics, curved terrain, staging, construction, time warp, multiple
vehicles, progression, workers, and PWA support are future work. Each requires
scope and decisions when planned; they are not hidden first-lander requirements.
