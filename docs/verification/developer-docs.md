# Developer documentation verification

Step 0.5 adds TypeDoc references for the three libraries, their guides, and the
application integration walkthrough. The combined production build puts the site
in `apps/game/dist/docs`; the existing Pages workflow publishes the same checked
artifact as the game. Live publication is pending owner merge and deployment.

## Local verification — 2026-11-06

- Node 24 dependency installation and the combined game/docs build passed.
- `npm run check` passed formatting, lint, workspace/tool/browser-fixture types,
  and all eight unit tests. `git diff --check` passed.
- TypeDoc generated references from all three public entry points without warnings.
  Deliberately missing Markdown paths and unresolved symbol links were each rejected
  with a nonzero exit. The temporary defects were removed and docs rebuilt.
- An HTML link audit checked local targets, asset paths, HTML anchors, and SVG
  fragments throughout the generated site, including the link back to the game.
- In the Codex in-app browser on macOS, the production preview mounted at
  `/gravitas/` served the docs landing page, all three library guides, the integration
  walkthrough, and the `VehiclePose`, `Viewport`, and `InspectionHud` references.
  Search for `setVehiclePose` opened the method's anchor and linked back to the
  engine pose contract. The Game link returned to `/gravitas/`.
- Desktop and 375 × 667 checks confirmed readable pages. Narrow-screen checks of
  the landing page, integration walkthrough, viewport/UI guides, and API detail
  pages found no document overflow after shortening a table and a long inline
  expression. Docs navigation/search produced no browser warnings or errors.

This is documentation/browser smoke coverage. Renderer behavior is unchanged;
full WebGL/WebGPU suites were not rerun for this step. Vite retains its existing
advisory about the renderer chunk exceeding 500 kB. No browser installation or
heavy suite was added to CI.

## Reproduce and verify publication

```sh
npm ci
npm run check
npm run build
npm run preview -- --base /gravitas/
```

Open `/gravitas/docs/`, follow each guide into its API reference, and search for
`setVehiclePose`. Check narrow layout and the Game link. `npm run docs` rebuilds
only the documentation; running `build:game` or a browser suite clears it, so run
the combined build again before previewing both outputs.

After owner merge, confirm main's check/build and Pages deployment succeed, then
repeat the docs navigation/search checks on the deployment URL. The artifact must
contain both `index.html` and `docs/index.html`. Record the main run and live result
before describing the documentation as published.
