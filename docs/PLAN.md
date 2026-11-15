# Implementation plan

One step is one reviewable PR. `[ ]` planned, `[~]` in progress, `[x]` implemented.
Resolve implementation details when a step starts. Owner review precedes moving
to the next step unless the owner authorizes otherwise.

## Completed milestones

Their steps, with what was built and how it was verified, are in
[PLAN-ARCHIVE.md](PLAN-ARCHIVE.md); release notes are in [RELEASES.md](RELEASES.md).

- [x] **M0 — Foundation:** charter and decisions, workspaces and checks, the
      viewport, browser verification, delivery to Pages, the bilingual UI shell,
      and developer docs.
- [x] **M1 — First flight:** the flight model, the fixed-step runtime, the chase
      camera, and instruments (v0.1.0).
- [x] **M2 — A complete landing challenge:** the contact model, landing outcomes,
      and the player manual.
- [x] **M3 — Feel and evidence:** effects, audio and settings, diagnostics, and
      Learn (v0.2.0, with M2).
- [x] **M4 — Polish and reach:** housekeeping, themes and identity, the input
      layer with touch and gamepad, the mobile layout, and the PWA (v0.3.0,
      v0.3.1).

## M5 — From orbit to surface

The engine grows from a flat local hop to a whole moon: gravity from a spherical
body, frames and precision fit for planetary distances, orbits and time warp, a
cratered surface built from real elevation data, and a second vehicle, ending in a
level where the pilot lands anywhere on the Moon from orbit. Owner decisions on
2026-11-07: about 80% of the effort goes to engine features and about 20% to small
polish woven in between; engine throttle realism (response lag, minimum thrust,
restart limits) is tabled until the vehicles and missions work, where vehicle tuning
belongs. The opening hop stays available and its regression flights stay
bit-identical unless a step says otherwise.

- [x] **5.1 Central-body gravity and frames:** a gravity field the environment
      selects: today's uniform field, or an inverse-square point mass. The Moon
      (`MOON`: mean radius 1,737.4 km, GM 4,902.800 km³/s² from GRAIL and DE440,
      sidereal day 27.321661 days) as engine data. Flight in the Moon-fixed
      rotating frame, where the ground stands still, with Coriolis and
      centrifugal terms; body-fixed, inertial, and surface frames (+Y up, +X east,
      −Z north) with pure conversions for positions and whole flight states; body
      rates documented as inertial. The Learn cannon uses the engine's constants
      and gravity. **Verify:** Kepler period and closure of a circular orbit,
      energy and angular momentum on a 15 × 100 km orbit, the radial escape
      parabola, the Jacobi constant, Moon-fixed against inertial flight converging
      at fourth order, surface-frame against body-fixed flight, frame axes and
      round trips; the opening's scripted flights and leg-drop model bit-identical
      (9,717 hashed ticks). Local checks passed on 2026-11-07; see
      [ADR 0018](decisions/0018-gravity-and-frames.md) and
      [frames verification](verification/frames.md).
- [x] **5.2 Orbits and time warp:** pure engine orbit functions: the six
      classical elements from state and back (circular and equatorial cases
      included) with apoapsis, periapsis, period, and the times to each; Kepler
      propagation in universal variables for every conic; the next descent
      through an altitude; and `coastOnRails` for whole flight states, with
      torque-free rotation, in either frame. Session time warp, from owner
      decisions on 2026-11-07: physics warp at 2× and 4× (the same ticks, faster),
      rails at 10×, 100×, and 1000× (one exact Kepler jump per frame); rails need
      the lever closed, rotation under 0.1°/s (a slow spin continues, not
      frozen), and height above the scenario's rails floor; any input, the floor
      (solved exactly), ground contact, pause, and restart return to 1×. No
      player-visible change yet. **Verify:** elements against vis-viva and
      Kepler's third law and in round trips; Kepler against RK4 on an ellipse, a
      hyperbola, the escape parabola, and many revolutions; predicted arrival at
      periapsis, apoapsis, and an altitude; rails against RK4 coasting in both
      frames; physics warp tick-identical to real time with the same verdict;
      rails matching physics coasting in the session; the floor stop; the
      opening's flights bit-identical. Local checks passed on 2026-11-07; see
      [ADR 0019](decisions/0019-orbits-and-time-warp.md) and
      [orbits verification](verification/orbits.md).
- [x] **5.3 Planetary-scale view and orbital instruments:** the Moon seen from
      orbit, a map of the whole Moon and the orbit, orbital readouts, and warp
      controls; a debug-only orbit sandbox (owner decision on 2026-11-07) so all of
      it can be tried on phones before 5.5. Owner decisions on 2026-11-07: NASA's
      LROC colour map now rather than in 5.4; V switches to the map (gamepad
      Select/Back, a ⋯ menu entry on phones), M stays mute. Two stacked PRs:
  - [x] **5.3a Planetary view:** `Viewport.setPlanet` shows a sphere with the
        LROC colour map instead of the flat site; the host's world centres on the
        vehicle (+Y away from the centre) so float32 stays steady; a seeded
        starfield; sunlight from a direction; the chase camera turning toward the
        horizon above 2 km; a separate body-fixed map scene with its own camera,
        the orbit line, and vehicle, periapsis, and apoapsis markers; an `orbit`
        scene accent; the asset register and manual credits. **Verify:** sphere
        UVs against body-fixed longitudes; star, orbit, and pose unit tests; a
        browser test of the Moon from orbit, the map with its orbit, and the return
        to the flat site on both backends; the opening pixel-identical to the
        previous build with the camera settled, on both backends. Local checks
        passed on 2026-11-07; see [ADR 0020](decisions/0020-planetary-view.md) and
        [orbital view verification](verification/orbital-view.md).
  - [x] **5.3b Orbital instruments, warp controls, and the sandbox:**
        `?scenario=orbit` puts the first lander, tank full, at apoapsis of a
        15 × 100 km orbit inclined 20°, in daylight; not on the start card. Each
        frame the game re-expresses the flight in a vehicle-centred frame for the
        viewport. The HUD reads apoapsis, periapsis, the time to each, orbital
        speed, and altitude in kilometres from 10 km, with lean and drift (no pad)
        on the radar. Time warp: a header stepper, `,` and `.`, and the D-pad, with
        a short notice when rails are refused (open lever, rotation, too low). The
        map: V, Back, a header button, and the ⋯ menu on phones. Help lists both.
        Reaching the mean radius pauses until a restart, as there is no surface
        yet. **Verify:** sandbox, readout, path, and scene unit tests against
        vis-viva and Kepler; gamepad command tests; browser tests of readouts,
        physics and rails warp, a refusal, the map, Help, Spanish, the opening
        without warp or map, and the phone layout on the iPhone and A70 sizes
        (clear centre, no overflow); both full browser suites. Local checks passed
        on 2026-11-07; see [orbit sandbox verification](verification/orbit-sandbox.md).
- [x] **5.4 Moon terrain:** the real Moon's large-scale shape from one small
      public NASA elevation grid, with everything finer generated from a fixed
      seed, so any spot can be landed on. Owner decision on 2026-11-07: LDEM_4
      only, no streamed higher-resolution tiles. Owner decisions on 2026-11-08:
      altitude reads height above the ground below while apoapsis and periapsis
      stay above the mean radius; boulders are bumps in the height function; the
      opening hop keeps its flat pad; generated ground is deterministic per
      browser, not bit-identical across browsers. Two stacked PRs:
  - [x] **5.4a Height model and contact:** a pure engine height function over the
        sphere: the LRO LOLA LDEM_4 grid (about 7.6 km per sample, the whole Moon
        in roughly 2 MB) sampled smoothly, plus procedural detail below its
        resolution (craters following the lunar size–frequency distribution,
        boulders, and fractal roughness) from one static seed, so the same spot
        always looks and feels the same. The app loads the grid once and hands the
        engine a plain typed array. Contact, local surface normals, and altitude
        above the ground come from this one function. `npm run moon-data`
        downloads the source product, checks its checksum, and writes the shipped
        asset with a provenance and licence note. **Verify:** sampling against the
        source grid; continuity at the poles and the date line; procedural detail
        identical across runs; contact reference cases on slopes; flat-ground
        contact unchanged where the curvature is negligible. Local checks passed on
        2026-11-08; see [ADR 0021](decisions/0021-terrain.md) and
        [terrain verification](verification/terrain.md).
  - [x] **5.4b Terrain rendering:** a level-of-detail sphere built on a cube with
        a quadtree of tiles (detail grows near the camera), meshed from the same
        height function so what is drawn matches what the legs touch near the
        ground; tiles generated and released on demand, in a worker if profiling
        asks for one; lighting with a low Sun so relief reads, over the colour map
        that 5.3a brought. Terrain contact in the orbit sandbox, and a debug-only
        `?scenario=terrain` start (owner decision on 2026-11-08): the first lander
        a few hundred metres above Tranquility Base with a full tank, to try the
        ground on phones before 5.5. A performance budget set from the 3.3 measurements and held on the
        Galaxy A70 class: a first download of a few megabytes and fixed triangle
        and memory ceilings. **Verify:** `npm run measure` against the budget on
        both browsers; no gaps or cracks between tiles; drawn height against the
        engine height under the legs; both backends. Local checks passed on 2026-11-08; see
        [ADR 0022](decisions/0022-terrain-rendering.md) and
        [terrain view verification](verification/terrain-view.md). The planet
        budget awaits the owner and the A70.
  - [x] **5.4c Terrain contact and touchdowns anywhere:** split from 5.4b on
        2026-11-08. Both sandboxes gain contact with the terrain; the touchdown
        judge measures vertical speed and tilt against the local vertical
        instead of world +Y; the results card works without a pad; dust spreads
        on the terrain. **Verify:** scripted
        landings on level mare and on a slope in the terrain sandbox; the opening
        bit-identical; both browser suites. Local checks passed on 2026-11-08;
        see the [ADR 0012 amendment](decisions/0012-landing-outcomes.md) and
        [terrain contact verification](verification/terrain-contact.md).
  - [x] **5.4 follow-up, terrain detail:** from the owner's review on
        2026-11-08, flying low in orbit on desktop and iPhone: craters popped in
        as tiles split, and crater rims zigzagged. Tiles now draw band-limited
        detail (features fade in with size, rims round off to what the grid can
        follow) and grow out of their parent's surface over 0.4 s; the finest
        tiles go one level deeper so the ground under the legs keeps every
        feature. Contact is unchanged, bit for bit. **Verify:** height changes
        smoothly with resolution; a tile's morph targets lie on its parent's
        drawn surface; screenshots before and after; both browser suites. Local
        checks passed on 2026-11-08; see the ADR
        [0021](decisions/0021-terrain.md) and
        [0022](decisions/0022-terrain-rendering.md) amendments and
        [terrain detail verification](verification/terrain-detail.md).
- [ ] **5.5 Free landing from orbit:** a second level with its own vehicle. Three
      stacked PRs (owner decision on 2026-11-09: a mission picker instead of a URL
      switch for the new vehicle):
  - [x] **5.5a Vehicle definitions and a descent vehicle:** a vehicle becomes
        plain, validated data (mass properties, main engine thrust and specific
        impulse, attitude thrusters, legs and hull contact points, centre of
        mass, and the viewport's model description) that the engine, the
        viewport, and the game read instead of the first lander's constants. The
        first lander becomes the first definition, unchanged; a new descent
        vehicle with propellant for about 2 km/s is the second. Owner decision on
        2026-11-07: this is the seed of a future vehicle library, kept to what two
        vehicles need; no staging, vehicle selector, editor, or tabled throttle
        realism. **Verify:** definition validation unit tests; opening flights
        bit-identical with the first lander as data; the descent vehicle's hover
        throttle, mass flow, and delta-v against the rocket equation. Local checks
        passed on 2026-11-09; see [ADR 0023](decisions/0023-vehicle-definitions.md)
        and [vehicle definitions verification](verification/vehicles.md).
  - [x] **5.5b Mission picker:** owner decision on 2026-11-09. A screen at the
        start offers two missions: the quick landing (the opening hop) and land
        from orbit (the descent vehicle in lunar orbit over the real terrain,
        marked as a preview until 5.5c). The game switches mission, vehicle,
        scene, and instruments at runtime; the results card and the menu return
        to the picker. Keyboard, touch, and gamepad; es-AR and en. The
        `?scenario=` links stay as developer shortcuts that skip the picker.
        **Verify:** both missions start from the picker on both backends and
        return to it; the opening's flights bit-identical; both browser suites.
        Local checks passed on 2026-11-09; see the
        [mission picker verification](verification/missions.md).
  - [x] **5.5 groundwork, static friction:** owner decision on 2026-11-10, before
        the level lands on slopes. Touching contact points grip anchors carried
        in the flight state, so a lander at rest stays at rest below the friction
        angle instead of creeping; settling needs a stable three-leg stance.
        **Verify:** rest on 10° and 25° without moving, sliding at 35° and with
        low friction at the Coulomb rate; the opening bit-identical until first
        contact with the same verdicts; both browser suites. Local checks passed
        on 2026-11-10; see the [ADR 0011](decisions/0011-contact-model.md) and
        [0012](decisions/0012-landing-outcomes.md) amendments and
        [static friction verification](verification/static-friction.md).
  - [ ] **5.5c The level:** land from orbit, finished, from the picker: start in
        lunar orbit in the descent vehicle, deorbit, and land anywhere on the
        Moon. No pad; the verdict uses the existing limits-based classifier
        with level-specific limits on vertical speed, horizontal speed, and tilt
        from the local vertical, and the lander must stay upright once settled, so
        a slope or a boulder field can tip it. Instruments for picking a spot:
        local slope and roughness under the radar, a ground-track marker, and a
        warning when periapsis is below the highest ground under the orbit. Manual
        pages (es/en) and Learn material on orbits and descent.
        **Verify:** a scripted pilot flying from orbit to a landing on flat mare
        and failing on a steep crater wall; fuel use against the rocket equation;
        both browser suites.

Polish (owner decision on 2026-11-08: one polish step at the end of M5, none
inside the feature PRs):

- [ ] **5.p1 Phone fixes:** whatever the owner's on-device check of v0.3.1 on the
      iPhone 15 Pro and the Galaxy A70 turns up.
- [ ] **5.p2 Offline play and updates:** a service worker so an installed game
      opens without a connection, with a quiet notice when a new version is ready.

## Later decisions

Workers based on profiling; multiple vehicles and missions, with engine throttle
realism (response lag, minimum thrust, restart limits) and other vehicle tuning;
construction/staging; replay/save formats; library publication. No implied order.

MIT is selected for code/documentation. Track third-party asset licenses and
provenance when assets arrive.
