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
