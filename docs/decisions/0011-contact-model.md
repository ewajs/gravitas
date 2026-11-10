# 0011. Own penalty contact model behind a surface seam; no Rapier yet

- Status: Implemented in 2.1. Amended on 2026-11-10: static friction.
- Date: 2026-11-07

## Decision

Keep the engine's own integrator and add **surface contact** to it, instead of
adopting Rapier.

- **Contact points** (`VehicleParameters.contacts`) are body points with one-sided
  spring-damper normals and regularized Coulomb friction. `kind: 'leg'` points are
  meant to touch; `kind: 'hull'` points (engine bell, stage corners, roof, antenna)
  mean structure hit the ground.
- **Compression and rebound damping are separate**, like shock-absorber valving.
  Strong rebound damping keeps a hard hit from springing the vehicle back up,
  with no per-leg state. The ground pushes but never pulls.
- **Forces act at each point**, so bounce, slide, tip-over, and settling come from
  the rigid-body equations. With a surface present, each step is split into RK4
  substeps of at most 1/240 s, because contact springs are stiff.
- **A surface seam.** `FlightEnvironment.surface` is plain data, a flat plane for
  now. One internal function, `surfaceBelow`, is all the engine asks of the
  ground: height and normal below a point. A terrain kind, or a collision
  library's queries, plug in there.
- **Facts, not verdicts.** `contactFacts(state, contacts, surface)` reports each
  point's depth, push, approach speed, and slip. Landing outcomes are 2.2's job,
  from these facts.
- **Flat ground.** Ground is y = 0 with the pad flush; viewport draws the same.

## Why not Rapier now

Rapier would replace integration and contact, not the rocket model. We would
still compute thrust, mass flow, and attitude assistance, then feed them in as
forces each step. It is mature and attractive for later work, but for this
project now:

- **Precision.** Its JavaScript builds use 32-bit floats. At lunar-orbit
  distances that is about 0.1 m of position resolution. Gravitas aims at orbital
  flight, so a 64-bit integrator of our own stays regardless; Rapier could never
  be _the_ engine.
- **State model.** It keeps mutable WASM world state. Our engine is pure functions
  over plain, serializable data, which makes restart, determinism tests,
  workers, and replays simple.
- **Accuracy.** Its integration is first-order with a constraint solver. Our
  rocket-equation and burnout references hold to 1e-9 with RK4.
- **Cost.** Roughly 1.5–2 MB more download and asynchronous initialization,
  for one vehicle on flat ground. That needs a few hundred lines of contact code,
  tested here against analytic references.

## Alternatives

- **Rapier dynamics now:** see above.
- **Impulse/velocity-level contact:** sharper contacts and no substeps, but
  impulses do not fit a force-based RK4 step without splitting it at every
  impact. Penalty springs are also the physical model for real legs.
- **A hard ground clamp** (project points out of the ground): simple, but no
  physics: no compression, no tip-over torque, and energy errors.

## Consequences and revisit conditions

- Penalty contact allows small penetration by design: about 3 cm of leg
  compression at rest, and more on impact. Presentation draws it as leg
  compression.
- Contact stiffness sets the substep size. Much stiffer points, or much smaller
  effective masses, need smaller substeps; tests pin current values.
- Regularized friction creeps imperceptibly under sideways load (slip scale
  0.1 m/s). On flat ground with no sideways force it rests exactly. (Replaced by
  static friction; see the amendment.)
- **Revisit Rapier** for terrain heightfields or meshes, as a _collision-query_
  backend behind `surfaceBelow` with our dynamics kept. Revisit it fully for
  many interacting bodies, joints, or construction, inside a local recentred
  coordinate region, with our 64-bit integrator still handling orbits.

## Amendment (2026-11-10): static friction

Terrain showed the creep: a lander resting on a 10° slope slid downhill at about
3 cm/s, because regularized friction only pushes back in proportion to slip.
Owner decision on 2026-11-10: fix it before the level that lands on slopes.

- **Anchors.** Each touching contact point grips the ground at an anchor, a
  world point. Friction is a spring-damper from the point to its anchor along the
  surface, with the point's own stiffness and compression damping, capped at μN.
  Under the cap the point holds, so a vehicle at rest stays at rest on any slope
  below the friction angle (31° for μ = 0.6). At the cap the anchor is dragged to
  μN / k from the point, so the point slides against exactly μN: Coulomb friction.
- **State.** Anchors are the contact model's memory, so they live in the state:
  `FlightState.contactAnchors`, one entry per contact point, null for a clear
  point, absent when nothing touches. `stepFlight` holds them through a step and
  returns the next ones; hosts pass the state back as they already do. A point
  touching for the first time has no anchor until its step ends and gets the old
  regularized friction for that step.
- **What changed in flight.** Nothing before first contact: the opening's four
  scripted flights are bit-identical while airborne, and their verdicts and
  touchdown values are the same. After contact, slides end a few centimetres
  differently (the off-pad vertical descent stops 4 cm shorter and settles four
  ticks sooner). A resting step costs 21 µs instead of 16 µs.
- **A stable stance.** Held feet no longer creep into the ground's hollows, so on
  uneven terrain a stiff-legged lander stands on three legs, as a real one does.
  Settling now needs three loaded legs, not all of them (ADR 0012).

Alternatives: a smaller slip scale (creep shrinks but never stops, and the
equations stiffen); anchors kept by the host beside the state (the state would no
longer determine the next step).
