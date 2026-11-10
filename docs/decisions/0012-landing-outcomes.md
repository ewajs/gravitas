# 0012. Touchdown judging as a pure engine reducer with game-owned limits

- Status: Implemented in 2.2.
- Date: 2026-11-07

## Decision

**Engine judges from contact facts; the game owns the numbers.** A verdict needs
history: the speed at first contact, whether the hull ever touched, how long the
vehicle has been still. So engine provides a pure reducer over plain data:

- `updateTouchdown(record, tick, dt, limits)` adds one tick. The tick holds the
  states and contact facts at its start and end.
- `classifyTouchdown(record, limits)` returns `airborne`, `touching`, `landed`,
  `rough` (settled, but a touchdown limit was exceeded), or `crashed` (hull
  contact, then leg impact, then tipping, in that priority).

`TouchdownLimits` are parameters; the game's live in `apps/game/src/rules.ts`.
"On the pad" is a game question, answered in the app's report.

**Measure before contact.** Touchdown speed and tilt come from the state at the
start of the tick in which the first leg loaded. Leg impact speed is the larger
of each loaded leg's approach speed before and after the tick. Contact forces,
especially damping, brake hard within one tick, so end-of-tick values
understated a 16.6 m/s crash as 14.2 m/s. The session caches each tick's facts
as the next tick's "before" facts.

**Verdicts are final; physics continues.** On a final verdict the session enters
`complete`, decided per tick so a verdict landing mid-frame takes effect at once.
From then on the main engine and attitude thrusters are off and input is ignored,
while the vehicle keeps simulating so a crash plays out on screen. The report
judges from the state at the verdict tick, so its figures don't drift as a crash
slides. Restart starts over. A touch-and-go that stays clear of the ground for
`airborneReset` (1 s) starts a fresh record.

**Report, not score.** The HUD shows a results card: the verdict, the cause or
summary, each judged quantity against its limit (✓/✗ with screen-reader text),
fuel left, and flight time. There are no points. A failing value gains decimals
until it reads above its limit, so the card never shows "✗ 2.0" against a 2.0
limit. The persistent live region announces the verdict title.

**Opening tuned to make fuel matter.** The opening now loads 60 kg of the 300 kg
tank. A scripted pilot flying to the pad uses about 24 kg in 31 s, so a careful
human has about 2.5 times that, and hovering indefinitely runs dry. Regression
flights pin this.

## Alternatives

- **Stateless per-tick classification:** cannot know the first-contact speed or
  the settle time.
- **Stateful classifier object in engine:** works, but breaks the engine's
  pure-functions-over-plain-data style. A record value is serializable for
  replays and easy to test with synthetic data.
- **Judge on contact timing in the app only:** puts reusable physics knowledge
  (what counts as an impact) in one game and makes boundary tests harder.
- **Points or star ratings:** deferred. They need progression design first.

## Consequences and revisit conditions

- Limits (2 m/s, 1 m/s, 10°, 5 m/s, 60°, 1 s still) are first-pass values for
  owner playtesting. Help text states them literally; change both together.
- "Rough" is a distinct failure: the lander survives but the touchdown broke a
  limit. If playtesting finds it confusing, it could fold into crash or success.
- The crash cause reports the first decisive fact. A leg strike usually comes
  one tick before the bell lip touches.

## Amendment (2026-11-08, step 5.4c): anywhere on a body

- **The local vertical.** `TouchdownTick` takes an optional `up`, the local
  vertical as a world unit vector. Vertical speed is the velocity against it,
  horizontal speed the rest, and tilt (`tiltFrom`) the angle from it, both at
  first contact and for tipping. The game's session passes the direction away
  from the body's centre whenever gravity is central, so a touchdown on the Moon's
  terrain is judged as it would be on the flat site. Without `up`, world +Y is
  used exactly as before: the opening's flights are bit-identical.
- **No pad, plain success.** Where there is no pad (the sandboxes now; the free
  landing level in 5.5), a safe landing is `landed-no-pad`, shown as "Landed!"
  ("¡Aterrizaje!"), and the results card lists the three touchdown checks without
  a distance to a pad. The limits are unchanged; 5.5 sets the level's own.
- **Tilt is from the vertical, not the ground.** Landing upright on a 10° slope
  reads about 10° of tilt and is at the limit; the vehicle's legs must take the
  slope. The descent level may relax the tilt limit.

## Amendment (2026-11-10): a stable stance

With static friction (the ADR 0011 amendment), feet hold where they touch, and
on uneven terrain a stiff-legged lander rests on three of its four legs.
Settling now needs at least three loaded legs (all of them for a vehicle with
fewer), at rest for the settle time, instead of every leg. On the flat pad all
four legs load as before.
