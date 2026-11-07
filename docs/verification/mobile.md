# Mobile verification

Step 4.4 takes the game to phones: a landscape layout around the touch controls,
a rotate prompt, no page zoom, safe areas ([ADR 0017](../decisions/0017-phone-play.md)),
and an installable app. The owner tests on an iPhone 15 Pro and a Samsung Galaxy
A70 on the deployed site after merging; everything below is emulation.

## Environment

- MacBook Pro (`MacBookPro18,1`), Apple M1 Pro, 32 GiB RAM, macOS 15.7.9.
- Node 24.21.0; pinned Playwright 1.64.1 (Chromium), phone emulation with
  `isMobile` and `hasTouch`:
  - iPhone 15 Pro: 852 × 393 CSS px landscape (393 × 852 portrait), DPR 3;
  - Galaxy A70: 914 × 411 landscape (411 × 914 portrait), DPR 2.625.

## 4.4a Mobile layout

Verified locally on 2026-11-07 (`tests/browser/mobile.spec.ts`), on both
emulated phones and on both Playwright projects (forced WebGL 2 and automatic
WebGPU):

- **Thumb zones clear**, in Spanish and English: before the start, the start card
  and Start fit the screen with the instruments hidden behind them; while flying,
  the readout strip, the radar panel, and both header button groups lie inside the
  screen and overlap neither the lever, the lever zone, the stick zone, nor the yaw
  buttons. Paused, with a fast sink and the caution icon, the strip still does not
  overflow.
- **Help** fits, and a real touch scroll (CDP `Input.synthesizeScrollGesture`)
  scrolls it inside itself without panning the page.
- **Results** fit with Try again on screen; on short screens the checks sit in a
  second column and nothing scrolls.
- **Portrait:** no prompt before a flight; the start card fits upright; starting
  shows "Turn your phone sideways" and pauses; Resume upright pauses again at once
  and the altitude holds; Help and the language selector work; turning sideways
  hides the prompt and leaves the flight paused; Resume flies with the touch
  controls; after a crash, turning upright shows the results without a prompt.
- **No page zoom:** the viewport meta tag (`user-scalable=no`, `maximum-scale=1`,
  `viewport-fit=cover`); `touch-action` `none` on the game surface and
  `manipulation` on the page; a cancelable `gesturestart` and the second of two
  quick `touchend`s outside controls are cancelled, a `touchend` on a button is
  not; a real two-finger pinch through CDP (`Input.synthesizePinchGesture`) leaves
  `visualViewport.scale` at 1, without console warnings.
- **Safe areas:** with insets emulated through CDP
  (`Emulation.setSafeAreaInsetsOverride`: 59 px left and right, 21 px bottom, as
  an iPhone 15 Pro in landscape), the readouts and the lever start right of the
  left inset, the header ends left of the right inset, and the radar and lever end
  above the home indicator, in Spanish (the longer labels).
- **WebGL 2 fallback:** with `navigator.gpu` removed, automatic selection on an
  emulated phone initializes WebGL 2, shows the touch controls, and flies.
- **Short window without touch (800 × 420):** the start card no longer overlaps
  the instruments (the known 4.2 issue), and flying keeps both panels on screen.

`npm run check`, `npm run build`, and both browser suites passed; counts are in
the PR.

### What emulation cannot show

- Real Safari and Chrome toolbars: Safari in landscape shows a smaller viewport
  until its bars collapse; installed (4.4b) it is full screen.
- iOS Safari's handling of `gesturestart`, `touch-action`, and double tap is
  emulated here only through Chromium's equivalents.
- Edge gestures (iOS home indicator, Android back), palm contact, and comfort of
  the zone sizes.
- Frame rate and the cost of the glass blur on the phones. Measure with `?debug`:
  its third line names the screen and pixel ratio, orientation, input device,
  touch controls, and whether panels are glass or solid. Help → Display →
  "Reduce transparency" switches to solid panels to compare.

## 4.4b Installable app

Verified locally on 2026-11-07 (`tests/browser/pwa.spec.ts`, production build
under `/gravitas/`):

- The page links `manifest.webmanifest`, served at `/gravitas/manifest.webmanifest`.
  Its name, short name, `display: standalone` with `display_override`
  (`["fullscreen", "standalone"]`), `orientation: landscape`, and theme and
  background colours (the theme's `#04060B`) are as intended; `start_url`,
  `scope`, and `id` resolve to `/gravitas/`; every icon is served at its declared
  size, with `any` and `maskable` purposes.
- iOS tags: `apple-mobile-web-app-capable`, `mobile-web-app-capable` (so Chrome
  does not warn), title, and a black-translucent status bar.
- No service worker controls the page.
- Not verified: the install flow itself (Chrome's install prompt, Safari's Add to
  Home Screen), full screen on the A70, and the status bar over the notch in the
  installed iPhone app. Try both after deployment.

## 4.4c Phone HUD

The owner's first check of v0.3.0 on the iPhone 15 Pro in Safari showed what
the 4.4a emulation missed: the browser's toolbar leaves the page 734 × 331, not
852 × 393. The emulated sizes now model the browsers:

| Phone         | Browser                 | Landscape                    | Upright   |
| ------------- | ----------------------- | ---------------------------- | --------- |
| iPhone 15 Pro | Safari with its toolbar | 734 × 331 (Safari insets)    | 393 × 652 |
| iPhone 15 Pro | installed               | 852 × 393, insets 59/59/0/21 |           |
| Galaxy A70    | Chrome with its toolbar | 914 × 355                    | 411 × 786 |
| Galaxy A70    | installed (full screen) | 914 × 411                    |           |

The Safari sizes are the owner's report; the A70's upright size assumes Chrome's
top bar, the status bar, and three-button navigation, and may be taller with
gesture navigation. Verified locally on 2026-11-07 on the machine above
(`tests/browser/mobile.spec.ts`, `touch.spec.ts`, `touch-settings.spec.ts`,
helpers in `tests/browser/layout.ts`), on both Playwright projects:

- **Clear centre.** The corridor is the middle third of the width, from the
  bottom of the top corner chips (the readout card or the top buttons) to the
  bottom edge: the chase camera keeps the lander centred and the opening faces the
  pad, so both lie in it. No HUD panel, button, card, phase line, or drawn touch
  control (lever, yaw buttons, the stick's resting hint) intersects it while
  ready, flying, or paused, at every landscape size in both languages. The
  transparent touch zones are not drawn and not checked, and the stick under a
  thumb is the player's own. The first-visit start card is the one deliberate
  exception: it covers the centre until Start, with the readouts hidden behind
  it. Run against the v0.3.0 build, the check flags its radar panel.
- **No overflow.** At every phone size, in both languages and in every phase
  (ready with and without the card, flying, paused with the widest readouts, the
  ⋯ menu, Help, results, upright start, rotate prompt, upright results), no
  rendered element or text run leaves the screen (below the fold of a scrolling
  Help or results card only horizontally), no text run leaves its block
  container, and no HUD element's content is wider than its box. Run against the
  v0.3.0 build upright, it flags the start card, its key list, and the throttle
  text running off the screen, which the owner saw.
- **Corners and thumbs.** Readouts top left, the radar card top right below pause
  and ⋯, the 40 px yaw buttons in a column just left of it; none of them, nor the
  top buttons, overlaps the lever, the lever zone, the stick zone, or a yaw
  button; the readout card keeps its height with three-digit altitude, a fast sink
  with the caution, and a full tank (one detail line); the phase line stays clear
  of it. Installed, everything keeps clear of the 59 px notch insets and the
  21 px home indicator.
- **Every phase, one layout.** Ready and complete keep the corner chips (the
  results card two-column over them, Try again reachable); after a real crash
  the HUD keeps `touch-layout` and no view options in the header.
- **The ⋯ menu.** `aria-expanded` follows it; language, sound, restart, and Help
  are inside; Help from it scrolls by touch and returns focus to ⋯; Escape closes
  the menu and returns focus to ⋯; upright, the language changes from it during
  the rotate prompt. Opening it mid-flight pauses (`touch-settings.spec.ts`).
- **Upright start screen:** the slim header (mark and name, ⋯), "How to fly"
  without horizontal overflow, the turn hint, Start, and no instruments.
- **Tablets and desktops unchanged.** A new test keeps the 4.4a strip and view
  options on an emulated 1180 × 820 touch tablet. A throwaway script captured 112
  screenshots before and after with the scene hidden (desktop 1280 × 720,
  1000 × 750, 375 × 667, 800 × 420; touch tablets 1024 × 768, 768 × 1024,
  1180 × 820; both languages; ready with and without the card, flying, fast sink,
  paused and muted, Help, two verdicts). Compared pixel by pixel (two baseline
  runs agree within 8/255 per channel), 109 are identical. The three that differ
  are the Spanish touch start card on the tablets: its first description used to
  run about 20 px past the card's inner padding and now wraps, the fix for the
  upright overflow.

The screenshots of every phone size and state in both languages were inspected
for overlap, overflow, clipped text, and legibility over the sunlit regolith.

Results: `npm run check` (167 unit tests in 27 files) and `npm run build` passed;
`npm run test:e2e` passed 86 tests on forced WebGL 2; the WebGPU project passed
78 on hardware WebGPU, with the 8 static-page tests run only on WebGL 2 by
design. `git diff --check` passed.

### Still to check on the phones

- The real Safari toolbar (it can collapse while scrolling elsewhere, giving
  more height), Chrome's toolbar on the A70, and the installed apps' insets.
- The native popover in Safari 17 and later (older iOS has no `popover`, so ⋯
  would not open); the native language picker inside it.
- Whether 40 px buttons and the slim lever are comfortable for thumbs.

## Measuring the glass blur on a phone

Open the deployed game with `?debug` (for English, `?lang=en&debug`). The overlay
shows the frame rate, main-thread work, draw calls, the backend, and a third line
with the screen size and pixel ratio, orientation, input device, touch controls,
and `glass blur` or `solid panels`. Fly for half a minute and note the frame rate
and work p95; then open Help → Display → Reduce transparency (panels turn solid)
and fly again. Record both, with the device and browser, in
[performance measurements](performance.md). If the blur costs the A70 its frame
rate, the owner can decide to default phones to solid panels.
