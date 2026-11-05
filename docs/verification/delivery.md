# Browser CI and Pages verification

Step 0.3b delivers the existing inspection scene. The workflow was merged in
[PR #4](https://github.com/ewajs/gravitas/pull/4); first deployment and live
verification passed on 2026-11-05.
No npm dependencies or renderer behavior change.

## First main run

- Revision: `fc8b03bd152ae59ef8e04cf2e5afca86a642ed26` (PR #4 merge).
- [Workflow run](https://github.com/ewajs/gravitas/actions/runs/42127165625).
- Attempt 1 passed check/build but reached the browser job's ten-minute timeout
  while apt downloaded fonts from the Ubuntu mirror. Browser tests never started;
  deployment was skipped as required by the gate.
- Retrying the unsuccessful jobs installed Chromium successfully. No workflow or
  dependency change was needed to get past installation.
- Attempt 2 passed all nine WebGL browser tests using `app-dist` artifact
  `13462225809`. Deployment downloaded the same artifact, but the Pages API
  returned HTTP 502 when creating the deployment. Only the failed deployment was
  retried; successful build and browser results were retained.
- Attempt 3 deployed successfully using the same `app-dist` artifact. The
  deployment environment confirmed [the live URL](https://ewajs.github.io/gravitas/).

## Live verification — 2026-11-05

Checked in the Codex in-app browser on the owner's macOS host. These are live
browser smoke checks, not a new full WebGPU suite or a mobile-device performance claim.

| Page                      | Actual backend | Viewports             | Result                                                                               |
| ------------------------- | -------------- | --------------------- | ------------------------------------------------------------------------------------ |
| Default Spanish (`es-AR`) | `webgpu`       | 1000 × 750; 375 × 667 | Visible lander/pad, readable title and controls, no horizontal overflow              |
| `?lang=en&backend=webgl2` | `webgl2`       | 1000 × 750; 375 × 667 | English title, controls and canvas label; visible lander/pad; no horizontal overflow |

Dragging visibly changed the camera in both backends. Loading messages cleared,
and the browser reported no warnings or errors. Document scroll width matched
viewport width at both sizes. Narrow checks establish layout only; touch flight
controls remain outside this step.

Separate HTTP checks returned 200 and the expected JavaScript/CSS MIME types for
all four assets below `/gravitas/assets/`, including the deferred renderer and
English locale. Response bodies matched the local production build of the deployed
revision byte for byte:

- `index-CFGxLqfC.js`
- `src-aZFzf8aw.js`
- `en-D5C_l1Hc.js`
- `index-Dz0SuX32.css`

Local Node 24 verification also passed `npm run check` (including six unit tests),
`npm run build`, local Markdown link checks, and `git diff --check`. The build
retains Vite's advisory about the renderer chunk exceeding 500 kB.

## Delivery acceptance checklist

- Clean Node 24 install, format/lint/types, six unit tests, and production build.
- Nine forced-WebGL checks against the existing production build mounted under
  `/gravitas/`, including both locales, lazy JavaScript/CSS asset responses, and
  narrow layout. Software rendering does not establish device performance.
- PR CI must show successful check/build and browser jobs, with deploy skipped.
  The browser and deploy jobs reference the check job's artifact ID; no rebuild.

Record actual outcomes in the PR. Browser failures retain traces and an HTML
report for seven days. The separate lifecycle fixture is not deployed.

## Hosting setup and first live check

In [repository Pages settings](https://github.com/ewajs/gravitas/settings/pages),
the build source is **GitHub Actions** (`build_type: workflow`), confirmed through
the Pages API on 2026-11-05. No privileged token is added to CI. The earlier
integration permission limitation no longer blocks deployment; hosting is configured.
The confirmed URL is [Gravitas](https://ewajs.github.io/gravitas/).
The workflow's deployment environment supplies the authoritative URL.

For subsequent delivery checks after owner merge:

1. Confirm main's check/build and browser jobs pass, then the Pages job deploys.
2. Open the deployment URL on desktop and at 375 × 667. Confirm a visible lander,
   readable controls, camera interaction, and no horizontal overflow.
3. Repeat with `?lang=en&backend=webgl2`. Check language, actual backend, and
   JavaScript/CSS responses beneath `/gravitas/assets/` without MIME failures.
4. Record the run URL, deployed revision, browser/device, and results here.
