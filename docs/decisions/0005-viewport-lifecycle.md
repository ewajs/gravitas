# 0005. Viewport lifecycle and first scene

- Status: Implemented in 0.3a; browser/backend evidence is recorded in the PR.
- Date: 2026-11-05

Step 0.4 moves the shared pose type into engine and adds live localization and a
Lit HUD; those amendments are recorded in [ADR 0007](0007-inspection-ui.md).

## Decision

Expose one Viewport class with explicit init, setVehiclePose, render, backend, and
awaitable dispose. The host supplies a localized accessible label and owns its
animation loop. The renderer owns its canvas, camera, controls, and artwork.
Inspection input stays with the viewport; flight input and simulation arrive later.

Keep engine empty: the starting pose is an app fixture, and viewport's presentation
pose contract is independent of dynamics. Accept finite positions and normalized
quaternions, copying them into visuals without changing the caller's objects.

Use pinned Three.js/@types/three 0.187.0, one WebGPURenderer with its built-in
WebGL fallback, supported node materials, and Three's OrbitControls. Geometry is
procedural and illustrative. No external asset pipeline or renderer abstraction.

Initialization precompiles materials before publishing the canvas. Disposal detaches
listeners immediately, waits for pending initialization, then releases GPU resources.
An instance disposed during init must never mount late. A failed init rejects;
remount uses a fresh instance. Three's dispose re-awaits init, so a rejected init
cannot be disposed through that method; GPU disposal is used after initialized is
true, with unuploaded artwork released on all failure paths.

Device loss and uncaptured renderer errors are retained and thrown on the next
host render, so the app stops and shows a localized failure rather than carrying on
with a blank canvas. Shader precompilation and disposal are asynchronous operations,
not a reason to add a generic lifecycle/event framework.

## Localization prerequisite

Bring forward only the loading/failure/inspection copy from 0.4 using the agreed
Lit/localize stack: Lit 3.3.3, @lit/localize 0.12.2. Explicit IDs and a small English
runtime module avoid a temporary second i18n implementation. No Lit components or
visible language picker yet. The app supports `?lang=en`; es-AR is default.

Load the viewport dynamically after localized loading text is ready, so fetching
and compiling the larger 3D bundle does not delay the initial status presentation.
No arbitrary bundle-size promise is introduced for the first scene.

## Tests and staged delivery

Playwright 1.64.1 tests the production app and a separate browser fixture served
by Vite. That fixture drives public lifecycle APIs and controls pending init through
a test-only gate on Three's init; no test methods ship in the game or library API.
Warnings/errors fail tests, except precisely matched diagnostics in intentional
fallback/failure cases. Pose validation has real Node unit tests, so empty-suite
allowances are removed.

Default browser tests force WebGL 2. A separate WebGPU project asserts the actual
backend and image content, never counting automatic fallback as a WebGPU pass.
Software GPU results and physical-device coverage are distinct. Browser CI and
Pages deployment remain in 0.3b, as agreed in the split plan.
