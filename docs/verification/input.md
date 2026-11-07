# Input verification

Step 4.3 builds one input layer ([ADR 0016](../decisions/0016-input-layer.md)) and
adds input devices to it, in three stacked PRs. This records how each was checked.

## Environment

- MacBook Pro (`MacBookPro18,1`), Apple M1 Pro, 32 GiB RAM, macOS 15.7.9.
- Node 24.21.0; pinned Playwright 1.64.1 (Chromium).

## 4.3a Input layer (no behaviour change)

Verified locally on 2026-11-07.

- `npm run check`: format, lint, types, and 147 unit tests in 25 files passed.
  New: the merge rule (strongest rotation per axis, cancelling opposites, the
  throttle following the latest source to move it, one-shot settings, clearing)
  and the session's fractional lever speed and arbitrary one-shot position,
  clamped, with non-finite values ignored.
- `npm run build`: game, TypeDoc developer docs, and the manual (dead links fail).
- `npm run test:e2e` (forced WebGL 2) and `npm run test:e2e:webgpu` (hardware
  WebGPU): unchanged tests, all passing; counts are in the PR.

### Bit for bit

A throwaway harness (not committed) ran the real sources under Vitest before the
first change and again after the last, hashing exact float64 bytes:

- **Scripted pilots** (pad, throttle-only, no input, hover until dry) through
  `FlightSession`, one tick per frame, continuing 10 s past each verdict. Per
  tick: the pilot's input, then the state, previous state, lever, ticks, dropped
  time, actuation, outcome, verdict state, flight time, render blend, telemetry,
  and landing report.
- **`fly()`** as the regression tests call it, for the same four pilots.
- **Keyboard flights:** 24 flights from 6 seeds, each at 60 Hz, 30 Hz, 144 Hz,
  and irregular frames with overload spikes. Random key downs and ups (including
  repeats) on W/S/A/D/Q/E/R/F, Z/X one-shot settings, P toggling pause, and
  random clears, through the real `KeyboardControls` on a stand-in window; before
  the change the session sampled the keyboard directly, after it `PilotInputs`
  with the keyboard as its only source. Per frame: the sampled input object
  (including whether `throttleSet` is present) and the whole session.
- **`pilotInput`** for all 256 held-key subsets with no, 0, or 1 one-shot setting.

All 33 scenarios (34,619 ticks over 45,171 frames) match. As a sensitivity check, a
deliberately altered merge (returning `throttleSet: undefined` instead of omitting
it, and a sign-dependent zero for cancelled axes) changed all 24 keyboard
scenarios.

## 4.3b Gamepad

Verified locally on 2026-11-07, without a physical controller (the owner has
none): every check uses a simulated pad.

- `npm run check`: 159 unit tests in 26 files passed. New: `gamepadInput` (rest
  and dead zone, keyboard signs for the right stick, proportional and gentle near
  centre, left stick ignored, bumpers, trigger pressure with its dead zone,
  opposing triggers), the source (A and Start fire once per press, polling before
  sampling, deliberate input reported as active, non-standard mappings ignored,
  connection changes by polling and by event, a throwing `getGamepads`), the
  shared `stickResponse`, and the device the merge reports.
- Browser (`tests/browser/gamepad.spec.ts`), with `navigator.getGamepads`
  replaced before the app loads and `gamepadconnected`/`gamepaddisconnected`
  dispatched: any button makes the gamepad the device in use (start card, phase
  message, and Start keycap change); A starts; a 40% trigger ramps the lever
  slowly and release holds it; the right stick leans the radar forward; Start
  pauses; Help lists the pad's controls and ignores A while open; A resumes; a
  lost pad pauses and returns the hints to the keyboard; after a crash, A tries
  again; a pad without the standard mapping is ignored.
- Keyboard flights stay bit-identical with the gamepad source present and no pad
  connected: the 4.3a harness, rerun with `PilotInputs([keyboard, gamepad])`,
  matches all 33 scenarios.
- Not verified: real controllers. Chrome, Edge, Firefox, and Safari expose
  common Xbox and PlayStation pads with the standard mapping, but button labels,
  trigger ranges, and stick drift vary by pad and browser. Browsers reveal a pad
  only after one of its buttons is pressed while the page is visible.

## 4.3c Touch controls

Verified locally on 2026-11-07 in Chromium's phone emulation (`isMobile`,
`hasTouch`, landscape 852 × 393 at DPR 3 for the iPhone 15 Pro and 914 × 411 at
DPR 2.625 for the Galaxy A70), not on the phones themselves: the owner tests on
the deployed site after merging.

- `npm run check`: 167 unit tests in 27 files passed. New: the touch mapping
  (dead zone, keyboard signs, gentle and proportional), the touch source (a lever
  move as one one-shot setting, held stick and yaw, activity, malformed event
  details ignored, clamping, clearing, disposal), and settings saved before the
  touch-controls setting still load (as Automatic).
- Browser, with real multi-touch dispatched through the Chrome DevTools Protocol
  (`Input.dispatchTouchEvent`; pointer events alone cannot hold two fingers), on
  both emulated phones and both backends:
  - touching the lever changes nothing; sliding it moves it relative to the
    grab; with the lever held, a second finger holds a yaw button (the radar's pad
    swings) and a third, the stick, which appears where it lands and leans thrust
    forward; lifting each releases only it; the lever stays where it was left;
  - the lever snaps exactly to the hover throttle inside the detent and lights
    the mark;
  - `touchcancel`, window blur, and a hidden page each release a held stick, and
    the lander stops rotating;
  - a phone starts with touch help in Spanish; a key hides the controls, a touch
    brings them back; Help pauses them (inert) and lists them; "Never" hides them
    and persists across a reload;
  - on a desktop, "Always" shows them during a flight; a mouse drags the lever;
    the keyboard still works beside them and the lever shows its change; buttons
    and the stick zone have accessible names; transitions are 200 ms and stop for
    reduced motion.
- Not verified without the phones: real thumbs and palm contact, iOS Safari's
  own gestures at the screen edges, Android vibration strength, and comfort of
  the zone sizes. The layout that keeps the thumb zones clear of the instruments
  is 4.4a.
