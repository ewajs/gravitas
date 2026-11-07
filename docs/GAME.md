# Game direction

**Status:** first flight playable (M1 step 1.2); no landing outcome yet. This
document distinguishes shipped behavior from future direction.

## Current build: first descent

The lander starts 80 m up, 30 m from the pad, sinking and drifting toward it. It
waits until the player presses P or Start. Then the player flies with the
keyboard: W/S pitch, A/D roll, Q/E yaw, R/F raise or lower the throttle lever,
Z/X set full or cut, P pauses, Enter restarts. Rotation keys request a turn rate;
releasing them stops rotation but does not level the lander. Rotation burns
fuel from the same tank as the engine.

Readouts show altitude above the lowest foot, vertical and horizontal speed,
distance to the pad, tilt, fuel, and throttle. The camera follows the lander;
drag to orbit and scroll to zoom. Help/Ayuda lists the controls and pauses the
flight. Leaving the tab pauses too. The ES/EN selector switches language
mid-flight without changing the flight (`?lang=en` selects English on load).

When a foot reaches the surface, the flight stops and shows the touchdown
speeds. This is a placeholder: there is no landing verdict, crash, bounce, or
tip-over until M2's contact model. Desktop keyboard only; narrow layouts stay
readable but have no touch controls.

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
