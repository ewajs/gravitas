# Orbits and time warp verification

Step 5.2 was verified locally on 2026-11-07. It adds orbital elements, Kepler
propagation, and on-rails coasting to the engine, and physics and rails time warp
to the game's flight session
([ADR 0019](../decisions/0019-orbits-and-time-warp.md)). Nothing player-visible
changes yet; warp controls arrive in 5.3.

## Environment and results

- MacBook Pro, Apple M1 Pro, macOS 15; Node 24.21.0.
- `npm run check`: format, lint, types, and unit tests passed.
- `npm run build`: game, TypeDoc developer docs, and the manual built.
- No browser suite: no rendering, layout, or input handling changed.

## The opening is unchanged

Every tick of the four scripted pilots, their outcomes, and their flight times
were hashed with SHA-256 on `main` and on this branch: all identical. Flight time
is now physics ticks × step plus rails seconds, which is the same number when
there are no rails.

## Independent references (`packages/engine/src/orbits.test.ts`)

| Case                                              | Measured                    | Expected                                            |
| ------------------------------------------------- | --------------------------- | --------------------------------------------------- |
| 15 × 100 km orbit: period                         | 113.7 min                   | Kepler's third law, a = R + 57.5 km                 |
| Same orbit: periapsis reached after half a period | 15,000.0000000002 m up      | 15,000 m                                            |
| Kepler vs RK4 over half an orbit (3,412 s)        | 0.5 µm, 6 × 10⁻¹⁰ m/s       | the same two-body coast                             |
| Next descent through 20 km, then propagate there  | 20 km to 2 nm               | the predicted time is exact                         |
| Radial escape at escape speed, after 600 s        | radius within 10⁻⁹ relative | the parabola (r₀^{3/2} + 3/2 √(2μ) t)^{2/3}         |
| Elements → state → elements, ten cases            | angles to 10⁻⁹ rad          | polar, retrograde, equatorial, circular, hyperbolic |
| Rails vs RK4, slow spin, 20 min (both frames)     | under 1 mm and 10⁻⁸ rad     | the same coast and rotation                         |

## The session (`apps/game/src/warp.test.ts`)

- 4× for one wall second runs the same 240 ticks as 1× for four, to the bit.
- An unpowered fall at 4× drops to 1× at first contact, with the same verdict and
  flight time as real time.
- 100× for one wall second coasts 100 s on rails, within 1 mm of the physics
  flying the same 6,000 ticks; no ticks run, and there is nothing to interpolate.
- Rotation or lever input drops to 1× and is flown in the same frame.
- Rails are refused with the lever open, rotation above 0.1°/s, at or below the
  floor, or before the start. A spin at half the limit keeps turning on rails.
- Coasting down at 1000× stops at the 20 km floor to within a nanometre, then
  refuses rails until the vehicle climbs.

## Cost

In Node on this machine, `propagateKepler` takes about 0.5 µs per call, and a
whole 1000× rails frame for a spinning lander (Kepler, 17 attitude steps, two
frame conversions) about 6 µs. A 60 Hz physics step is about 1.4 µs, so 4× costs
about 0.3 ms per frame.

## Not verified

- No device measurement: there is no way to warp in the game until 5.3.
- Rails are exact for a point-mass Moon only; the model has no perturbations
  (ADR 0018).
