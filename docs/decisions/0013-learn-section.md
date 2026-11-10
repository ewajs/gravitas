# 0013. A Learn section that runs the real engine

- Status: Implemented in 3.4; content awaits owner review.
- Date: 2026-11-07

## Decision

The player manual gains a bilingual **Learn** section: how Gravitas works and the
math behind it, with rendered equations, plots, and interactive explorers. The
owner asked for it as a learning resource that will grow into spaceflight and
orbital mechanics.

- **Explorers run the game's own code.** `manual/.vitepress/learn/models.ts`
  imports `@gravitas/engine` and the game's lander values (`apps/game/src/lander.ts`, the first lander's definition
  since ADR 0023).
  What a reader plays with is what flies in the game, and plotting engine samples
  beside closed-form formulas shows the simulation is right.
- **Models are pure TypeScript, unit-tested.** Vitest checks them against
  independent results:
  - the opening's 7.77 s and 16.6 m/s;
  - the rocket equation;
  - Euler at first order and RK4 at fourth;
  - leg drops;
  - circular, crash, and escape shots, plus μ/R² = 1.62 m/s².

  Vue components (`manual/.vitepress/theme/`) only bind sliders, readouts, and plots.

- **Equations render at build time** with MathJax (`markdown-it-mathjax3`, the plugin
  VitePress 1.6 supports) to SVG: no runtime math JavaScript.
- **One small plot component, no chart library.** `LinePlot.vue` follows the dataviz
  method:
  - 2px lines with engine samples as dots;
  - a legend for two or more series, plus sparse end labels;
  - a crosshair tooltip on pointer and arrow keys;
  - a table view;
  - one y-axis per chart;
  - a categorical palette (blue, orange, aqua) validated for both themes, with
    the light-mode aqua contrast covered by labels and tables.
- **Server rendering stays deterministic.** VitePress pre-renders explorers in Node
  and hydrates them in the browser. `Math.log10` differed in the last bit between
  the two, which broke hydration, so plot coordinates round to 0.1 px and derived
  log data rounds at the source.

## Alternatives

- **Chart library (Chart.js, ECharts, Observable Plot):** more features, more
  weight, and their own styling and accessibility to override. The charts here are
  simple line plots.
- **Client-only explorers (`<ClientOnly>`):** avoids hydration entirely, but leaves
  no server-rendered content, and hid a real determinism issue rather than fixing it.
- **KaTeX:** faster, but needs runtime CSS and fonts; MathJax SVG is self-contained
  and is VitePress's built-in path.
- **Separate learning site:** splits the manual. One manual keeps the "how to play"
  and "how it works" links one click apart.

## Consequences

- The manual now depends on the engine and game source. Engine API changes must keep
  the models compiling and their tests passing (they run in `npm test`).
- Two documentation dependencies (VitePress, MathJax plugin), both dev-only.
- Chapters cite game numbers (fuel, limits, leg tuning) as prose. When tuning
  changes, update the chapters; the explorers update themselves.
