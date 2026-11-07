# Player manual verification

Step 2.3 was verified locally on 2026-11-07 during the owner-approved overnight
run. It adds the bilingual VitePress player manual.

## Results

- `npm run manual`: VitePress 1.6.4 built all ten pages (five per locale) in
  about 1.5 s into `apps/game/dist/manual`.
- **Dead links fail the build.** A temporary `[roto](./no-existe)` link in
  `lander.md` made `npm run manual` exit 1 with "Found dead link". The link was
  removed afterwards.
- `npm run build` now runs game, then docs, then manual. CI already runs it on
  every PR and main, so the manual's build and link check gate deployment.
- `npm run check`, both browser suites, and TypeDoc: see the PR for this run's
  counts.
- Browser (`manual.spec.ts`, production build under `/gravitas/`):
  - Help links resolve to `/gravitas/manual/` in Spanish and
    `/gravitas/manual/en/` in English, opening in a new tab.
  - The Spanish home and landing pages render, the sidebar navigates, and the
    English landing page has `lang="en"`.
  - The manual's Play link returns to the game in English, where the game
    initializes. The run declares the expected WebGPU-fallback messages, since
    the link uses automatic backend selection.
- Screenshot of the Spanish landing page reviewed: dark theme, readable rules
  table, Spanish UI labels including search.

## Notes

- VitePress bundles its own Vite 5 alongside the project's Vite 8; they do not
  interact. npm did not run esbuild 0.21's install script, but its optional
  platform binary is installed and the build works.
- The manual's Play link is base-relative (`/gravitas/manual/../`), so it works
  locally and on Pages. The game's link to the manual is relative (`./manual/`)
  because the game builds with a relative base.
- Not covered: manual layout at phone widths beyond VitePress's own responsive
  theme, and no human review of the wording yet.
