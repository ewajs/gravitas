# 0004. Workspace tooling and MIT licensing

- Status: Accepted; implemented in foundation step 0.2.
- Date: 2026-11-05

## Decision

Four private npm workspaces, consumed from source through package exports.
Libraries have empty entry points until real functionality needs public APIs.
Versions begin at 0.0.0; no release is tagged by this scaffolding step.

Use Node 24, TypeScript 6.0.3, Vite, Vitest, ESLint/typescript-eslint, Prettier, and
eslint-plugin-boundaries, with exact direct development versions and a lockfile.
TypeScript 7 is deferred because the chosen typescript-eslint release supports
TypeScript below 6.1. Node type declarations match the Node 24 development target.

ESLint's boundaries plugin enforces the agreed dependency direction, public entry
points, and UI's type-only engine access. It handles resolved relative imports,
re-exports, and dynamic imports without custom architecture-checking code.
Resolve workspace symlinks to real paths; otherwise the Node resolver misclassifies
local packages as external dependencies. Package `main` entries support the
resolver; `exports` remains the public interface used by Vite/TypeScript.

The engine's type environment excludes DOM and automatic ambient Node globals.
Browser libraries/app opt into DOM types; build configuration opts into Node types.
UI opts into Lit's legacy decorator convention, as in Lux Studio, for familiar
review: experimentalDecorators enabled, useDefineForClassFields disabled.

MIT covers our code and documentation, as approved by the owner. External assets
retain their own licenses and provenance records when introduced.

## Verification and staged tooling

CI runs clean install, format/lint/types, Vitest, and the production shell build on
PRs and main. The only visible content is the product name; localization/component
work starts in 0.4. Browser automation/deployment and rendered docs remain separate
steps, not empty scripts that pretend to build those artifacts.

There are no substantive unit tests yet. The root test commands explicitly allow
an empty suite during scaffolding. Remove `--passWithNoTests` when the first actual
tests arrive. No arithmetic/trivial tests are added merely to make a green count.

The boundary plugin is an MIT-licensed, maintained development dependency with an
upstream test suite. It adds no client bundle cost. The alternative was brittle
path patterns or bespoke import checking. Verify both allowed and forbidden paths,
not just that lint exits successfully on empty modules.
