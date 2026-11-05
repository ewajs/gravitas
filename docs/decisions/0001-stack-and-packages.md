# 0001. Stack and reusable packages

- Status: Accepted direction; implementation pending.
- Date: 2026-11-05

## Decision

TypeScript strict, Node 24 LTS, npm workspaces, Vite. Separate engine, viewport,
UI, and game; public entry points, consumed from source initially. Engine has no
framework dependencies. Three.js WebGPURenderer with WebGL 2 fallback. Lit and
@lit/localize, es-AR/en. Vitest, Playwright, ESLint, Prettier, GitHub Actions/Pages.
TypeDoc for developer docs and VitePress for the player manual when introduced.

## Reasons and alternatives

Reusable libraries are an explicit project goal. Independent dependencies,
testing, documentation, and potential consumers justify package boundaries now.
A single app would be simpler initially but postpone boundaries the owner wants.

Lit builds on the owner's web-component knowledge. React/Svelte are viable;
no identified need outweighs that familiarity. Start with custom components and
tokens as in Lux; recommend a component library if actual controls justify it.

Lux demonstrates the renderer workflow. One scene/material approach spans the
supported GPU backends without a custom abstraction. Compared with WebGLRenderer,
accept asynchronous initialization, a newer API, and legacy shader/plugin limits.
Pin Three.js and upgrade deliberately.

## Consequences and revisit conditions

Fallback needs real testing. WebGPU-only compute/features need explicit alternatives
or reduced-capability policy; renderer fallback does not supply those. Measure
performance rather than assuming gains.

Internal @gravitas/* identifiers do not establish npm namespace availability.
Revisit distribution and API stability with an actual consumer/publication need.
