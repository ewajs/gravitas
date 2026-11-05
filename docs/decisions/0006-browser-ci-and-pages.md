# 0006. Local browser verification and Pages delivery

- Status: Amended at the owner's request; browser suites run locally.
- Date: 2026-11-05

## Decision

Keep routine CI to format, lint, types, unit tests, and a production build, followed
by a main-only Pages job. Build once, upload `apps/game/dist`, and pass the resulting
artifact ID to deployment without rebuilding. The Pages action repackages that
directory into its required archive. The fixture server remains separate from
production output.

Run pinned Playwright Chromium locally when a change warrants browser coverage,
and record results in the PR. SwiftShader WebGL 2 remains available for software
runners. WebGPU stays an explicit usable-device check: exposing an adapter in a
software runner does not establish canvas presentation. Preserve the strict
backend/image assertions. Heavy suites and benchmarks stay out of routine CI.

Keep Vite's relative asset base. Mount preview at `/gravitas/` during browser tests
to catch project-site asset errors, including deferred renderer and locale chunks.
Local npm browser scripts build first; direct Playwright consumes an existing build.

Use maintained official actions, pinned to the versions checked for this step:
upload-artifact 7.0.2, download-artifact 8.0.2, configure-pages 6.0.0,
upload-pages-artifact 5.0.0, and deploy-pages 5.0.1. These support Node 24.
No npm dependencies change. Keep the CI build artifact for seven days; browser
failure reports and traces stay local.

Only the deploy job receives Pages/id-token write permissions. It requires the
check/build job to succeed and main's push/manual event; PRs cannot deploy.
Cancel superseded PR runs, but serialize main runs to prevent overlapping
deployments. GitHub concurrency may replace pending runs; it is not a FIFO queue.
Artifact IDs and attempt-specific Pages artifact names avoid ambiguous selection
when jobs are rerun.

## Tradeoffs and revisit conditions

The original decision put forced-WebGL tests between build and deployment so
both jobs consumed the same artifact. The first main run exhausted its ten-minute
browser-job timeout downloading Ubuntu fonts; on retry the tests took 47 seconds.
On 2026-11-05 the owner requested that heavy tests run locally rather than making
deployments consume lengthy Actions runs. This amendment removes the browser job
and its installation overhead, while retaining fast checks and artifact-based delivery.

Browser regressions now depend on relevant local verification and review rather
than an automatic deployment gate. Record that evidence for affected changes.
Device performance and WebGPU compatibility still need named-device evidence.

The repository must have Pages enabled with GitHub Actions as its source. Do not
add a privileged secret to enable Pages from CI. The first deployment and live
checks are recorded in [delivery verification](../verification/delivery.md). Revisit delivery
when routing, PWA/offline behavior, or another hosting target creates a real need.
