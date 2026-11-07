# Gravity and frames verification

Step 5.1 was verified locally on 2026-11-07. It adds central-body gravity, the
Moon-fixed rotating frame, and frame conversions to the engine
([ADR 0018](../decisions/0018-gravity-and-frames.md)). The game still flies the
opening under uniform gravity.

## Environment and results

- MacBook Pro, Apple M1 Pro, macOS 15; Node 24.21.0.
- `npm run check`: format, lint, types, and unit tests passed.
- `npm run build`: game, TypeDoc developer docs, and the manual built.
- No browser suite: nothing rendered or interactive changed, and the opening's
  flights are bit-identical (below).

## The opening is unchanged

Before and after the change, every tick of the four scripted pilots (to the pad,
throttle only, no input, hovering dry; 9,717 ticks with their outcomes) and the
Learn leg-drop model were serialized and hashed with SHA-256. All hashes match. The
Learn cannon changed on purpose: it now uses the engine's GRAIL μ.

## Independent references (`packages/engine/src/gravity.test.ts`, `frames.test.ts`)

Values measured at the game's 60 Hz step, against the expected values:

| Case                                           | Measured                         | Expected                             |
| ---------------------------------------------- | -------------------------------- | ------------------------------------ |
| Circular orbit 100 km up, after one period     | closes to 3.7 µm                 | returns to start (Kepler: 117.8 min) |
| Same orbit, relative energy error              | 3 × 10⁻¹³                        | 0                                    |
| 15 × 100 km orbit: lowest altitude             | 15,000.0000004 m                 | 15,000 m (vis-viva at apoapsis)      |
| Same orbit: periapsis time minus half period   | −0.0028 s                        | 0, within one 0.0167 s step          |
| Same orbit: worst energy / angular momentum    | 2.5 × 10⁻¹³ / 1.3 × 10⁻¹³        | conserved                            |
| Radial escape at 2,310.1 m/s, after 600 s      | radius off by 2 × 10⁻¹⁴ relative | parabola r(t) = (r₀^{3/2} + …)^{2/3} |
| Jacobi constant over 20 min, Moon-fixed        | 2.3 × 10⁻¹⁴ relative             | conserved                            |
| Coasting tumble, Moon-fixed vs inertial, 300 s | 1.7 × 10⁻⁹ m, 1.8 × 10⁻¹⁴ rad    | identical after conversion           |
| Thrusting tumble, same comparison              | 1.7 × 10⁻⁴ m → 1.1 × 10⁻⁵ m      | shrinks ~16× per halved step (RK4)   |
| Surface frame vs body-fixed, 60 s hop          | 1.0 × 10⁻⁸ m                     | identical after conversion           |
| Equator speed seen from inertial space         | 4.624 m/s                        | ΩR                                   |

Under thrust the two frames differ only by integration error: halving the step
cut the position, velocity, and attitude gaps by 16.1, 16.0, and 15.9 times.
`frames.test.ts` checks the body-fixed axes, surface frames against analytic east,
north, and up at five sites including near a pole, and round trips between all
three frames forward and backward in time.

## Cost

One `stepFlight` in free flight took about 1.4 µs in Node on this machine (a full
orbit of 424,047 steps in 0.6 s). Real time is cheap; long time warp is 5.2's
decision.

## Not verified

- Nothing in the game uses central gravity yet, so no browser or device check
  applies. The manual's cannon explorer was checked by its unit test only.
- Libration, axial tilt, mascons, and third bodies are not modelled (ADR 0018).
