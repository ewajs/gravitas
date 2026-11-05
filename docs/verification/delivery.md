# Browser CI and Pages verification

Step 0.3b prepares delivery of the existing inspection scene. First deployment
and live verification remain pending owner merge; a green PR is not a live-site
acceptance. No npm dependencies or renderer behavior change.

## Before merge

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
the build source must be **GitHub Actions**. No privileged token is added to CI.
The available GitHub integration rejected Pages enablement with HTTP 403
(`Resource not accessible by integration`), so the owner must select this source
in Settings → Pages before the first main deployment.
The expected URL is `https://ewajs.github.io/gravitas/`; it is not yet a confirmed
live link. The workflow's deployment environment supplies the authoritative URL.

After owner merge:

1. Confirm main's check/build and browser jobs pass, then the Pages job deploys.
2. Open the deployment URL on desktop and at 375 × 667. Confirm a visible lander,
   readable controls, camera interaction, and no horizontal overflow.
3. Repeat with `?lang=en&backend=webgl2`. Check language, actual backend, and
   JavaScript/CSS responses beneath `/gravitas/assets/` without MIME failures.
4. Record the run URL, deployed revision, browser/device, and results here. Add the
   confirmed live URL to README and mark 0.3b complete only after that check.
