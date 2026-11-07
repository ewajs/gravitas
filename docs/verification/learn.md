# Learn section verification

Step 3.4 was verified locally on 2026-11-07 during the owner-approved overnight
run. It adds the Learn section: seven chapters per language, six interactive
explorers, and build-time equations.

## Model references (`manual/.vitepress/learn/models.test.ts`)

- **Free fall:** the opening (80 m, −4 m/s, lunar g) reaches the ground at 7.77 s
  and 16.59 m/s. Every engine sample lies on h(t) = h₀ + v₀t − ½gt² to 1e-6 m.
- **Rocket:**
  - hover throttle at 60 kg is 1260 × 1.62 / 4500;
  - burn time and Δv match their formulas;
  - the engine's final vertical speed matches the rocket equation with gravity
    to 1e-6, upright and at a 30° tilt;
  - sideways acceleration is F sin θ / m.
- **Rate assist:** the acceleration limit is 900/1800 rad/s² (28.6°/s²). The rate
  reaches 29–30°/s by release, decays below 0.5°/s, and burns attitude fuel.
- **Integration** (1 Hz spring):
  - RK4 beats Euler by at least 100× at a 0.05 s step;
  - convergence slopes are about 1 (Euler) and 4 (RK4);
  - error is measured in phase space, √(Δx² + (Δv/ω)²). Position alone hid
    Euler's amplitude error at a zero crossing (slope 2) and RK4's phase error at
    a peak (slope 5).
- **Legs** (the real lander and contact model):
  - 1 m/s settles without bell strike and bounces under 5 cm;
  - 8 m/s strikes the bell;
  - removing rebound damping increases the bounce;
  - ζ matches 4c / (2√(4km)).
- **Newton's cannon:**
  - μ/R² gives 1.62 m/s²;
  - circular speed stays within 0.1% of a circle, with the period from Kepler's
    third law;
  - 800 m/s crashes, and 2% over escape speed escapes.
- **Axis ticks** are round values.

## Browser (`tests/browser/learn.spec.ts`, production build under `/gravitas/manual/`)

- Every chapter, in Spanish and English, renders its heading. Each content chapter
  renders MathJax SVG equations and exactly one explorer.
- The free-fall explorer opens at 7.77 s and 16.6 m/s, and changes readout and
  plot path when the height slider moves. Arrow keys on the focused plot show the
  crosshair tooltip with the engine series, the table view is present, and
  switching to Earth gravity changes the impact speed.
- The cannon orbits at 1.70 km/s, crashes at 0.80 km/s, and escapes at 2.40 km/s.
- No console warnings: an earlier build logged Vue hydration mismatches on the
  integration chapter. The cause was `Math.log10` differing in the last bit
  between Node (page build) and Chromium, and a random clip-path id. Coordinates
  now round to 0.1 px, log data rounds at the source, and ids come from Vue's
  `useId`.

## Review notes

Full-page screenshots of all fourteen pages were reviewed. That review led to:

- the integration plot's fixed range with clipping, and a 0.02 s default step,
  so Euler's growth doesn't flatten the exact curve;
- superscript scientific notation;
- end labels at the rightmost point;
- tick decimals that follow the step (0.025 m);
- a visible Moon with a thicker path, and an orbiting default shot;
- thinned dots on dense series.

The plot palette was run through the dataviz validator on both manual surfaces:
it passes. The light-mode aqua sits below 3:1 contrast, which legends, end
labels, and the table view relieve.

## Not covered

- Owner review of the teaching content and tone.
- Phone layout of explorers beyond VitePress's responsive theme.
- Screen-reader walkthrough beyond accessible names, labelled sliders, and table views.
