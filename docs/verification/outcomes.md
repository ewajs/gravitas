# Landing outcome verification

Step 2.2 was verified locally on 2026-11-07 during the owner-approved overnight
run. It adds touchdown judging, results, the start card, and the 60 kg opening.

## Environment and results

- MacBook Pro (`MacBookPro18,1`), Apple M1 Pro, 32 GiB RAM, macOS 15.7.9.
- Node 24.21.0; pinned Playwright 1.64.1.
- `npm run check`: format, lint, types, and 93 unit tests passed.
- `npm run build`: game and TypeDoc developer docs built with validation.
- `npm run test:e2e`: all 19 tests passed on forced WebGL 2 (SwiftShader).
- `npm run test:e2e:webgpu`: all 19 tests passed on hardware WebGPU.
- `git diff --check` passed.

## Unit coverage

- **Boundaries** (`touchdown.test.ts`):
  - values exactly at each limit pass; just beyond fails, and every exceeded
    limit is listed;
  - the settle time is respected;
  - crash priority runs hull, then impact, then tipped;
  - airborne before contact and after a hop;
  - a touch-and-go resets after exactly 1 s clear (exact binary tick lengths).
- **Measurement before contact:** the touchdown snapshot uses the state before
  the first leg loads. The first version read end-of-tick values and reported a
  16.6 m/s crash as 14.2 m/s; the report test now pins 16.6.
- **Simulated drops** through `stepFlight` with contact: 1 m/s lands, 3 m/s is
  rough on vertical speed, 7 m/s crashes.
- **Regression flights** (`flights.test.ts`), real session and rules, with
  scripted pilots that use only player inputs:

  | Pilot                     | Verdict                       | Fuel used | Time  |
  | ------------------------- | ----------------------------- | --------- | ----- |
  | None                      | Crash (leg impact ~16.6 m/s)  | 0 kg      | 7.8 s |
  | Throttle only             | Rough (2.0 m/s sideways)      | ~17.5 kg  | 26 s  |
  | Steers to the pad         | Landed, < 1 m from pad centre | ~23.5 kg  | 31 s  |
  | Hovers without descending | Runs dry, then crashes        | 60 kg     | 97 s  |

  The pad flight repeats identically, so verdicts are deterministic.

- **Report** (`report.test.ts`): no report before a verdict; all checks pass on
  the pad landing; the rough landing names horizontal speed; the crash names its
  cause and impact speed.

## Browser coverage

- The start card is visible before the start and gone after it.
- An unpowered descent shows a Crash card with the right cause and failed
  checks, and "Fuel left: 20%". The crash then comes to rest; P does nothing; Try
  again restarts to the ready card.
- In Spanish the report reads "Accidente" with "16,x m/s"; switching to English
  translates the open report. Enter retries.
- Narrow layouts in both locales keep the start card, instruments, and values in
  bounds.
- A camera check that zooms with the wheel moved its pointer off the new start
  card, which takes pointer events.

Screenshots of the start card, crash report, and narrow Spanish layout were
reviewed. On desktop, the card and report sit over the lander; nothing is moving
when they are shown.

## Not covered

- No human playtest of the limits, the 60 kg budget, or the card wording.
- No browser-driven successful landing: keyboard landing timing is not reliable
  under software rendering. Successful verdicts are covered by the regression
  flights and report tests.
