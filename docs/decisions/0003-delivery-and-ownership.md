# 0003. Reviewable delivery and cognitive ownership

- Status: Accepted direction; implementation pending.
- Date: 2026-11-05

## Decision

Small agreed steps, one branch/review PR each; owner reviews and merges. Shared
AGENTS.md, CLAUDE.md pointer. Explain unfamiliar concepts and trace cross-layer
changes so the owner understands the code regardless of which agent writes it.

Dependencies are deliberate, not forbidden. Recommend mature, tested tools that
save substantial non-core work. Explain alternatives, maintenance, licensing,
size, and reviewability; no trivial utilities or home-grown replacement frameworks.

Professional, readable, responsive UI with restrained motion. Lit/tokens first;
a useful component library remains an option. Separate documentation per library,
app integration walkthroughs, separate bilingual player help.

Fast checks per PR; costly checks when relevant and at milestones. Label future
design; claim commands and deployments only once they exist.

## Reasons and consequences

The owner values ambitious output and cognitive ownership. Opaque changes and
excessive approval interruptions both work against that. An agreed step authorizes
routine implementation/verification; consequential changes get concrete discussion.
Revisit process rules when they obstruct useful delivery.
