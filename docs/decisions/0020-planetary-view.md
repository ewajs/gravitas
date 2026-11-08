# 0020. The planetary view: a vehicle-centred world, a separate map, a real colour map

- Status: Implemented in 5.3a (viewport). The game uses it from 5.3b.
- Date: 2026-11-07

## Decision

The viewport can show a spherical body instead of the flat landing site, with a
second camera for a map of the whole body and the orbit.

- **The host's world centres on the vehicle.** With a planet shown, the host
  hands the viewport poses in a frame centred on the vehicle, +Y up (away from
  the body's centre); `setPlanetPose` places the body's centre and body-fixed axes
  in that world each frame. Three.js renders in float32, which at the Moon's
  radius resolves only about 0.1 m; near the origin it resolves micrometres. So
  the vehicle and camera never jitter, and the chase camera, heading, radar, and
  tilt keep their flat-world meaning. The Moon's own vertices carry the 0.1 m
  error, which is invisible from orbit and replaced by terrain tiles with local
  origins in 5.4.
- **The map is its own scene, in body-fixed coordinates.** North is up and the
  body sits at the origin, so the map does not turn as the vehicle moves along
  its orbit. It has its own camera (`setCameraMode('chase' | 'map')`), its own
  orbit controls (only the active camera's controls listen), and screen-sized
  markers for the vehicle, periapsis, and apoapsis. `setOrbitPath` takes the orbit
  in body-fixed metres; closed orbits repeat their first point because WebGPU has
  no line loops. Entering the map looks at the vehicle from 3.2 radii, raised
  toward the orbit's normal so the orbit reads as an ellipse.
- **One sphere, the real colour map.** Owner decision on 2026-11-07: NASA's LROC
  colour map arrives now rather than with terrain in 5.4. The 2k pole-filled map
  from NASA SVS's CGI Moon Kit, converted to an 82%-quality JPEG (683 KB), is
  drawn on a 256 × 128 sphere. Three.js's sphere UVs already match the engine's
  body-fixed longitudes (0° at +X, 90° east at −Z, north at +Y), so no rotation is
  needed; a unit test checks it. Provenance is in [docs/assets.md](../assets.md).
- **Sunlight from a direction.** `setSunDirection` aims the light. Around a planet
  the chase sun sits along that direction from the vehicle, so its shadow camera
  still covers the lander; the map's sun follows the same direction in body-fixed
  axes. Ambient light drops from 0.4 to 0.06 so the night side reads as night.
- **Stars around a planet only.** 2,400 seeded one-pixel points on a shell around
  each camera (WebGPU draws only one-pixel points, so both backends match). The
  flat site keeps its plain sky.
- **The chase camera looks out from orbit.** Between 2 km and 10 km the chase
  polar angle turns from the landing framing (35° from vertical) toward 76°, so
  the horizon and the sky come into view. The flat site never goes this high.
- **The flat site is untouched.** Its ground, pad, scatter, and marker moved into
  one group that hides while a planet is shown. With the camera settled, frames of
  the opening are pixel-identical to the previous build on both backends.
- **One new accent.** `SceneAccents.orbit` (the house cyan) colours the orbit and
  its markers; the vehicle marker uses `marker`.

## Alternatives

- **Logarithmic depth or relative-to-eye shaders:** solve precision for huge
  worlds, but change every material and the flat site's pixels. Moving the world
  to the vehicle does the same job for what we draw now.
- **Map in the same scene as the chase view:** the world turns with the vehicle's
  local frame, so the map would spin as the vehicle orbits; orbit controls also
  assume a fixed up direction.
- **Plain grey sphere until 5.4:** no download, but the sandbox would not look
  like the Moon; the owner preferred the real map now.
- **Larger point sprites for stars:** WebGPU needs instanced sprites for that; the
  one-pixel points are enough on both backends.

## Consequences and revisit conditions

- The colour map adds a 683 KB download, but only when a planet is shown. The
  opening never requests it.
- The sphere's silhouette is within about 130 m of a true sphere; terrain in 5.4
  replaces the sphere near the ground with tiles and local origins.
- Map markers draw over the body even when behind it, so they are never lost.
  Revisit if that confuses players.
