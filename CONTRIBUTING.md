# Contributing

Gravitas is a game and a set of reusable libraries. The owner must be able to
follow all of it. Prefer explicit code, familiar platform mechanisms, and small
changes over cleverness.

## Working cycle

1. Choose one agreed step from [PLAN.md](docs/PLAN.md); state its outcome and
   verification. Mark it in progress on the branch.
2. Branch from current `main`: `docs/`, `feat/`, `fix/`, or `chore/`.
3. Implement the smallest complete result. Split a growing step before expanding
   scope; a reviewer should be able to assess the PR in one sitting.
4. Run relevant checks, try changed player flows, and update affected docs.
5. Open a PR using the template; record completed work as done.
6. The owner reviews and merges. Verify deployed behavior when deployment exists.

Use conventional commit subjects. Tag milestone releases as `v0.N.0`, with a
short release note in PLAN.md; patch releases cover intervening fixes. The first
documentation PR does not declare a software release.

## Code and cognitive ownership

- TypeScript strict; avoid `any`. Validate external data at boundaries.
- Plain data and pure functions for physics/rules. Stateful lifecycle owners may
  use ordinary classes with private fields. Side effects stay at the edges.
- Comments explain reasons; exported APIs have concise TSDoc documentation.
- Use domain vocabulary, explicit units where ambiguous, and named physical
  assumptions and tunable values.
- No speculative ECS, plugin system, generic message bus, or compatibility layer.
  Abstractions need actual consumers.
- Explain unfamiliar Lit/platform concepts briefly, tied to changed code. Trace
  an action through the layers when a change crosses several boundaries.
- Code, technical docs, commits, and PRs are English. Player content is es-AR/en.

## Dependencies

Prefer a small set, but suggest established open-source tools when they remove
substantial non-core complexity. No trivial utility dependencies or home-grown
replacement frameworks merely to avoid an established solution.

For meaningful additions, describe work saved, alternatives, maintenance/test
quality, license, runtime/bundle cost, and reviewability. Runtime stack changes
get an ADR and owner agreement. Routine dev tools within an agreed step can be
justified in the PR. Commit the lockfile.

## Verification

These commands are planned, not installed in the documentation foundation:

| Check | Planned use |
| --- | --- |
| `npm run check` | Format, lint, types, fast unit tests; locally and every PR |
| `npm run build` | Production application build; every PR |
| `npm run docs` | Library/API and integration docs; every PR once introduced |
| `npm run manual` | Bilingual player manual; every PR once introduced |
| `npm run test:e2e` | Short browser smoke suite in CI; affected flows locally |

Physics tests use independently calculated expectations, invariants, and timestep
convergence where relevant. Browser tests cover integration, controls, lifecycle,
and presentation. Screenshots do not establish physical correctness. Use numerical
tolerances, not cross-platform bit equality. Browser tests fail on unexpected
page/console errors; explicitly declare expected errors.

Keep heavy matrices, long simulation runs, and benchmarks targeted to changes
they inform, with broader checks at milestones. Establish performance budgets
from measured scenes and named devices. Do not test implementation trivia.

Until tooling exists, docs PRs check local links, consistency, and diff whitespace;
report unavailable checks plainly.

## Presentation and documentation

Aim for professional, readable instruments, clear hierarchy, responsive input,
and restrained motion. Use design tokens. Respect reduced motion, keyboard focus,
contrast, safe areas, and adequate targets. Custom Lit components come first;
evaluate a component library when concrete controls justify it.

Document engine, viewport, and UI separately, then explain the game integration.
Keep player help separate from technical docs. Commands and current-behavior docs
must stay accurate; label roadmap material as planned.
