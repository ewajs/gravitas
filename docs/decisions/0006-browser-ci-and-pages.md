# 0006. Browser CI and Pages delivery

- Status: Implemented in 0.3b; first deployment and live checks verified.
- Date: 2026-11-05

## Decision

Extend the existing CI workflow with a dependent browser job and a main-only
Pages job. Build once, upload `apps/game/dist`, and pass the resulting artifact ID
to both consumers. Browser verification and deployment must use the same output;
neither job rebuilds the game. The Pages action repackages that directory into its
required archive. The fixture server remains separate from production output.

Run pinned Playwright Chromium with SwiftShader WebGL 2 in CI. WebGPU stays an
explicit usable-device check: exposing an adapter in a software runner does not
establish canvas presentation. Preserve the strict backend/image assertions.

Keep Vite's relative asset base. Mount preview at `/gravitas/` during browser tests
to catch project-site asset errors, including deferred renderer and locale chunks.
Local npm browser scripts build first; direct Playwright consumes an existing build.

Use maintained official actions, pinned to the versions checked for this step:
upload-artifact 7.0.2, download-artifact 8.0.2, configure-pages 6.0.0,
upload-pages-artifact 5.0.0, and deploy-pages 5.0.1. These support Node 24.
No npm dependencies change. Keep build and failure evidence for seven days.

Only the deploy job receives Pages/id-token write permissions. It requires both
upstream jobs to succeed and main's push/manual event; PRs cannot deploy.
Cancel superseded PR runs, but serialize main runs to prevent overlapping
deployments. GitHub concurrency may replace pending runs; it is not a FIFO queue.
Artifact IDs and attempt-specific Pages artifact names avoid ambiguous selection
when jobs are rerun.

## Tradeoffs and revisit conditions

Installing Chromium adds CI time, but keeps browser verification reproducible
without a custom runner or cache invalidation scheme. CI uses software WebGL;
device performance and WebGPU compatibility still need named-device evidence.

The repository must have Pages enabled with GitHub Actions as its source. Do not
add a privileged secret to enable Pages from CI. The first deployment and live
checks are recorded in [delivery verification](../verification/delivery.md). Revisit delivery
when routing, PWA/offline behavior, or another hosting target creates a real need.
