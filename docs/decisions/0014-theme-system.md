# 0014. Typed themes that generate CSS variables and scene accents

- Status: Implemented in 4.2a (current colours, no visible change); the Glass values,
  added roles, and fonts arrived in 4.2b ([ADR 0015](0015-glass-look-and-typefaces.md)).
- Date: 2026-11-07

## Decision

Colours, type, and shape live in one typed **theme** object, plain data in
`@gravitas/ui/themes`. Everything that draws the Gravitas look reads it:

- **Roles, not colours.** A theme names what a colour is for: `surface` (the
  page), `panel` (may be translucent), `panelSolid` (dialogs), `line`, `text`,
  `muted`, `accent` and `accentInk` (text on accent), `focus`, `good`/`warn`/`bad`,
  `well` (recessed instrument backgrounds), and `backdrop` (behind a modal). Plus
  `fonts.body`, a panel `radius`, and `colorScheme`.
- **CSS custom properties are generated.** `themeProperties`, `themeDeclarations`,
  and `themeCss` turn a theme into `--gravitas-*` properties. The HUD's Lit tokens
  embed them in `:host`, so hosts can still override any property on the element.
  The game writes the same properties into `index.html` at build time with a small
  Vite plugin, so the page's first paint already has the theme.
- **Scene accents are separate.** `scene.sky`, `scene.pad`, and `scene.marker`
  colour the non-physical marks in the 3D view. Viewport has its own structurally
  identical `SceneAccents` type and a validated `setAccents()` method; the game
  passes `theme.scene` across, since viewport and UI never import each other.
  Physical materials (regolith, rock, foil, flame, dust, sunlight) are not themed:
  they describe the Moon and the vehicle, not the interface.
- **A narrower entry point.** `@gravitas/ui/themes` is pure TypeScript with no Lit,
  DOM, or engine import, enforced by an ESLint element of its own that may import
  nothing. Build tooling (the game's Vite config, running in Node) and the manual
  can use the tokens without loading HUD components. The main `@gravitas/ui` entry
  does not re-export it; TypeDoc documents both entry points.
- **Contrast is tested, not trusted.** A unit test checks every theme: text and
  muted text at 4.5:1 or more on the page and on every panel composited over it;
  accent, focus, and status colours at 3:1 or more; accent ink on accent at 4.5:1;
  instrument marks visible in wells.
- **Contrast helpers ship with the themes.** `contrastRatio` and `composite` are
  exported so every consumer checks its colours the same way; the manual's brand
  test uses them for its light-page accent steps (4.2c).
- **One theme for now.** `themes` lists `gravitasTheme` only, and nothing offers a
  switcher. A second theme is a new object in that list; switching at runtime
  would set the generated properties on the HUD host and call `setAccents()`.

## Alternatives

- **Keep `tokens.ts` as hand-written CSS:** the manual and the page would copy the
  values (4.1 found four such duplicates), and nothing could test contrast.
- **Export themes from the main `@gravitas/ui` entry only:** importing it loads Lit
  and registers nothing useful for a static page; Node tooling cannot import it.
- **A shared design-token package:** a fifth workspace for one file. Themes are
  part of the UI library's job; a separate package is worth it if a second UI
  consumer appears.
- **Theme physical materials too:** a theme switch would change what the Moon looks
  like. Rejected; only marks that exist for the player are themed.
- **CSS-in-JS or a token build tool (Style Dictionary):** a dependency and a build
  step to generate a dozen properties.

## Consequences

- Adding a role means a field in `ThemeColors` (TypeScript then requires it in
  every theme), a line in the property list, and its use in CSS.
- `--gravitas-*` names are the HUD's public styling contract, listed in UI's README.
- The game's `index.html` no longer carries the `theme-color` meta tag literally;
  the Vite plugin adds it from the theme.
- The debug overlay keeps its own background, a developer tool outside the player's
  look; its text uses the theme's `good` colour.

## Revisit when

- A second theme or a player-facing switcher arrives (4.4 decides whether phones
  default to reduced transparency).
- Another UI package or app needs the tokens without depending on `@gravitas/ui`.
