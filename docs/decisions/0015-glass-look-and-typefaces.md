# 0015. The Glass look: self-hosted typefaces, translucent panels, and motion rules

- Status: Implemented in 4.2b; owner chose the direction on 2026-11-07.
- Date: 2026-11-07

## Decision

The house theme becomes **Glass**, chosen by the owner from a design canvas of
three directions: frosted translucent panels over the scene, a deep cyan accent
(`#4CC3E0`), and dark ink on accent fills.

- **Typefaces, self-hosted.** Space Grotesk (labels, headings, the wordmark) and
  Inter with tabular numerals (values) come from the `@fontsource-variable/*`
  packages (SIL Open Font License 1.1), bundled by Vite with the game. There is no
  request to Google Fonts or any other host at runtime, and no third monospace
  face. The theme names the families; the host loads them, because `@font-face`
  rules inside a shadow root do not apply.
- **Translucent panels with a solid fallback.** Panels use `backdrop-filter:
blur(16px) saturate(140%)` over `rgba(12, 20, 32, 0.55)`. A player setting,
  "Reduce transparency" (in Help, saved with the other settings), and the system's
  `prefers-reduced-transparency` both swap them for solid `#0C1420` without blur,
  through three custom properties. Whether phones default to it is decided in 4.4.
- **Motion rules.** Controls respond in 130 ms with a small press; gauges ease to
  new values in 200 ms on `cubic-bezier(.2,.8,.2,1)`; the results card fades its
  scrim in 240 ms and rises 10 px in 280 ms, rows 50 ms apart; numbers never
  animate; the only loop is the phase dot, while flying. `prefers-reduced-motion`
  turns all of it off.
- **A safe-sink hint, owned by the game.** From the design's "Instrument"
  direction: a 0–10 m/s scale under vertical speed shades the sink rate the game
  advises at this altitude, `max(2 m/s, altitude / 8)`. The game passes it in
  telemetry (`safeSink`); the HUD only draws it, and hides it when absent.
  Landing limits are unchanged.
- **Status pairs colour with an icon or word**: verdict badges (check, caution,
  cross), check rows, and the vertical-speed caution icon.

## Font dependency

|               |                                                                                                                                                                                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Work saved    | Subsetting, `unicode-range` splitting, variable-font CSS, and licence files for two families, maintained upstream.                                                                                                                                                    |
| Alternatives  | Google Fonts at runtime (a third-party request and privacy cost, rejected by the owner); copying `.woff2` files into the repo (manual updates, no provenance); system fonts only (no identity).                                                                       |
| Licence       | SIL Open Font License 1.1, declared by both packages; the licence text ships in each package. The OFL allows bundling and redistribution with software.                                                                                                               |
| Runtime cost  | A Spanish or English player downloads only the Latin subsets: Inter about 48 kB and Space Grotesk about 22 kB (`woff2`, cached). Other subsets are built but fetched only for characters outside Latin. `font-display: swap` shows text at once in the fallback face. |
| Reviewability | Two CSS imports in `main.ts`; versions pinned exactly.                                                                                                                                                                                                                |

## Alternatives

- **Opaque panels only:** simpler and cheaper to draw, but not the chosen look.
  They remain one setting away.
- **JavaScript-driven animation:** CSS transitions on custom properties do the
  easing; the HUD's 10 Hz snapshots set target values only.
- **The HUD computing safe sink itself:** it would encode a game rule in a
  presentation library.

## Consequences

- Backdrop blur costs GPU time on every frame the panels cover; the setting and
  4.4's phone default are the escape hatches.
- The HUD's DOM changed: icon buttons with accessible names and tooltips, two
  instrument panels, a results scrim, labelled fuel and time tiles. Test ids,
  live regions, and event contracts are unchanged.
- The landscape-phone layout still overlaps; 4.4 redesigns it.

## Revisit when

- Measurements on the test phones (4.4) show the blur costs frames.
- A theme needs a different face; the theme names families, the host loads them.
