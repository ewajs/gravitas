# Mission picker verification

Step 5.5b was verified locally on 2026-11-09. The game opens on a mission
picker with two missions, Quick landing and Landing from orbit (a preview until
5.5c), and switches mission, vehicle, scene, and instruments at runtime.

## Environment and results

- MacBook Pro, Apple M1 Pro, macOS 15; Node 24.21.0; pinned Playwright 1.64.1.
- `npm run check`: format, lint, types, and 286 unit tests passed.
- `npm run test:e2e` (WebGL 2): 103 passed. `npm run test:e2e:webgpu`: 95 passed,
  8 skipped by design. The first run caught the results card's three buttons
  (Reintentar, Misiones, Manual) overflowing their row by 6 px on the iPhone in
  Safari in Spanish; their side padding is now 12 px, and the rerun passed.
- The opening, flown through the Quick landing mission by the four scripted
  pilots, plus the orbit sandbox's burn and warp: 10,617 ticks hash the same as on
  `main`.

## Browser tests (`tests/browser/missions.spec.ts`)

- Without a shortcut, the game opens on "Choose a mission" with both missions,
  their vehicle and start, and Landing from orbit marked Preview; Quick landing
  has focus. There is no Start, no instruments, and P does nothing behind it.
- Spanish by default: "Elegí una misión", "Aterrizaje rápido", "Aterrizaje desde
  órbita", "Vista previa".
- Quick landing flies the opening (pad distance, no warp). Missions returns to the
  picker with Quick landing focused and no flight controls; Landing from orbit
  then starts the descent vehicle in orbit (apoapsis 100 km, warp and map, a full
  tank); back again, Quick landing restores the flat site, the pad, and no warp.
- Keyboard: the down arrow moves to Landing from orbit and Enter chooses it.
- The results card's Missions button returns to the picker after a crash.
- A gamepad: D-pad right moves to Landing from orbit; A chooses it.
- Emulated iPhone 15 Pro (Safari, landscape and upright) and Galaxy A70 (Chrome):
  both missions lie within the screen, nothing overflows, and a tap chooses.

Every other browser test now opens the game with `?scenario=quick-landing`, the
developer shortcut that skips the picker, as the sandboxes' shortcuts do.

## Look

Screenshots of the picker on desktop and the phones, and of Landing from orbit
starting, were checked by eye: the picker sits over the dimmed scene, and the
descent vehicle flies in orbit with the warp, map, and Missions buttons in the
header.

## Known limits

- Landing from orbit uses the opening's start card ("How to fly", whose goal
  mentions the pad) the first time, and the general landing limits; 5.5c gives it
  its own.
- The first choice of Landing from orbit downloads the Moon's terrain (about
  2 MB); the loading message shows meanwhile.
