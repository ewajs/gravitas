Gravitas currently runs a flyable first descent: engine dynamics on a fixed-step
app session, keyboard input, an interpolated Three.js view, and a bilingual Lit
flight HUD. These guides cover the code that exists today.

## Start here

1. Read the library guide for the layer you are working on.
2. Follow the [integration walkthrough](integration.md) to see how the application
   connects those layers, owns scheduling, and handles locale changes and failure.
3. Use the generated API pages for exact types, methods, and source locations.

| Library guide                                 | Current responsibility                                 |
| --------------------------------------------- | ------------------------------------------------------ |
| [Engine](../../packages/engine/README.md)     | Shared pose, pure flight dynamics, and rate assistance |
| [Viewport](../../packages/viewport/README.md) | Three.js scene, interpolation, chase camera, lifecycle |
| [UI](../../packages/ui/README.md)             | Optional Lit flight HUD, help dialog, and localization |

The application in `apps/game` owns branding, the lander and scenario, the flight
session and keyboard, locale loading, and browser scheduling. Libraries never import app code; viewport and UI are
siblings. They share plain engine data and are connected by the app.

## Work locally

Use Node 24 and install from the repository root:

```sh
nvm use
npm ci
npm run dev
```

The four npm workspaces consume TypeScript source directly. No package publishing
or separate library build is required. These private 0.0.0 APIs can be refactored
with all callers; there is no compatibility promise for hypothetical consumers.

```sh
npm run check       # Format, lint, types, and unit tests
npm run build       # Game plus developer docs, ready for Pages
npm run docs        # Rebuild only developer docs
npm run preview -- --base /gravitas/
```

Open `/gravitas/docs/` on the preview server for this site and `/gravitas/` for the
game. The docs command writes only `apps/game/dist/docs`; a full build writes the
game first and regenerates docs afterward. The separate bilingual player manual
is planned for M2 and has no build command yet.

## Verification and delivery

TypeDoc reads each library's public `src/index.ts` using that package's TypeScript
configuration. Guides and API comments are built together; unresolved symbol
links and missing local file targets fail the docs build. CI runs fast checks and
the combined build, uploads one artifact, and deploys that artifact on main without
rebuilding. It does not install browsers or run heavy suites.

Run browser suites locally when the change needs them:

```sh
npx playwright install chromium
npm run test:e2e
npm run test:e2e:webgpu
```

WebGL tests explicitly request the fallback backend. The WebGPU suite requires
usable WebGPU presentation and checks the actual backend and image content.
Report the browser/device and any unavailable coverage in the PR. See the
[contribution guide](https://github.com/ewajs/gravitas/blob/main/CONTRIBUTING.md)
for software-runner options, review workflow, and verification rules.

## Design references

- [Architecture and units](https://github.com/ewajs/gravitas/blob/main/docs/ARCHITECTURE.md)
- [Implementation plan](https://github.com/ewajs/gravitas/blob/main/docs/PLAN.md)
- [Architectural decisions](https://github.com/ewajs/gravitas/blob/main/docs/decisions/README.md)
- [Game direction](https://github.com/ewajs/gravitas/blob/main/docs/GAME.md)
- [Flight model](https://github.com/ewajs/gravitas/blob/main/docs/FLIGHT.md)
