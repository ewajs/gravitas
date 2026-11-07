# 0002. Explicit simulation and staged runtime complexity

- Status: Accepted direction. Flight model and integrator chosen in [ADR 0008](0008-flight-model.md);
  runtime scheduling implemented in [ADR 0009](0009-flight-runtime.md).
- Date: 2026-11-05

## Decision

Begin with a local lunar lander and explicit flight model. Plain simulation data,
explicit controls/time; no browser, UI, rendering, network, or storage in engine.
App owns the session, scheduling, and mission policy. UI/viewport present results.

60 Hz fixed steps, bounded catch-up, interpolation, pause on hidden tabs; SI,
right-handed Y-up local coordinates, quaternion orientation. Publish small HUD
snapshots, not a reactive world. Choose integrator, physical constants, controls,
assistance, and contact algorithm with reference tests in M1/M2.

## Reasons and alternatives

Variable render timesteps couple flight to browser performance. Fixed steps aid
reproduction but do not prove accuracy, stability, or cross-platform bit equality.

A worker adds startup, messages, transfers, ordering, and debugging without a
measured benefit yet. Preserve compatibility; add an adapter when useful, not a
generic transport framework now.

No general physics library initially for one vehicle, explicit forces, simple
contact. Evaluate mature tools such as Rapier if complex contact, articulation,
or interacting bodies otherwise require substantial work. Spaceflight is the
purpose; rebuilding every supporting subsystem is not.

## Consequences and revisit conditions

Local coordinates/constant gravity serve the first mission. Orbital integration,
planetary precision, time warp, and complex contact need design and validation.
Workers need measured workloads and explicit buffer ownership. PWA install,
caching, updates are deferred; responsive resize and lifecycle ownership start now.
