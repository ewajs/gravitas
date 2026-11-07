# Game direction

**Status:** design target; no gameplay is implemented. This document will
distinguish shipped rules from future direction as the game develops.

## Current build: inspection scene

The current build shows an illustrative stationary lunar lander and landing pad.
Drag to orbit, scroll to zoom, or focus the canvas and use arrow keys to pan.
The ES/EN selector switches language without resetting the scene or camera
(`?lang=en` also selects English on load). The HUD shows horizontal offset from
the pad and tilt from upright, calculated from the stationary artwork pose.
Help/Ayuda explains the camera controls and readouts, with keyboard focus and Escape
to close. Loading and failure messages also follow the selected language.
There is no flight, fuel, scoring, or landing outcome yet. Rendering/backend verification is reported
separately from future physical correctness.

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
