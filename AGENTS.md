# Working on Gravitas

Shared instructions for Claude, Codex, and other coding agents. CLAUDE.md points
here so working rules have one source of truth.

## Read by task

- Always read [CONTRIBUTING.md](CONTRIBUTING.md) and the active step in
  [docs/PLAN.md](docs/PLAN.md).
- Read [ARCHITECTURE.md](docs/ARCHITECTURE.md) before changing package boundaries,
  state ownership, scheduling, or public APIs.
- Read [GAME.md](docs/GAME.md) before changing gameplay or player-facing behavior.
  [ADRs](docs/decisions/README.md) explain significant choices.

## Invariants

- Engine has no Three.js, Lit, DOM, browser clock, storage, or network imports.
- Time and controls are explicit simulation inputs. Rendering and UI never own
  authoritative flight state or decide mission outcomes.
- Viewport and UI are siblings; neither imports the other or the application.
- Missions and branding stay in the app. Libraries receive the data they need;
  do not invent a provider framework ahead of a real requirement.
- Use SI units and ARCHITECTURE.md's reference-frame conventions.
- Keep Spanish (es-AR, with voseo) and English complete. Use localization for
  player text; physics state contains numbers and identifiers.
- Keep per-frame flight state outside component reactivity. No per-frame logs
  or storage writes.

## Scope and autonomy

Work one agreed PLAN step per branch/PR unless the owner expands the scope.
Within that step, implement, fix related bugs, test, and synchronize docs without
repeated permission requests. Explain material choices in the PR.

Bring consequential changes forward with a recommendation and tradeoffs: package
boundaries, new public abstractions, major gameplay direction, or dependencies
that change the agreed stack. Routine implementation choices need no approval gate.

Recommend mature dependencies when they remove substantial work outside the
project's central goals. Lean does not mean rebuilding established tools.

Open a review PR; the owner reviews and merges. Do not merge, start the next step,
publish packages, or change repository settings unless authorized.

## Before reporting completion

- Run relevant checks and inspect exit codes. Check UI changes in a real browser;
  exercise both backends when rendering changes could affect them.
- Update affected docs in the same PR. Distinguish planned from implemented behavior.
- Report changes, verification, and unverified behavior. Never claim an unavailable
  command, suite, deployment, or feature exists.
