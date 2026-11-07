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
