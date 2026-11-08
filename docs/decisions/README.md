# Decisions

Record consequential choices, reasons, and revisit conditions. Amend/supersede
records when decisions change; preserve earlier reasoning. Accepted direction
does not imply implemented code.

| ADR                                          | Decision                                                        | Status                                |
| -------------------------------------------- | --------------------------------------------------------------- | ------------------------------------- |
| [0001](0001-stack-and-packages.md)           | Stack, reusable packages, renderer                              | Accepted direction                    |
| [0002](0002-simulation-and-runtime.md)       | Simulation boundaries and runtime complexity                    | Accepted direction                    |
| [0003](0003-delivery-and-ownership.md)       | Delivery, dependencies, cognitive ownership                     | Accepted direction                    |
| [0004](0004-workspace-tooling.md)            | Workspace tooling and MIT licensing                             | Implemented                           |
| [0005](0005-viewport-lifecycle.md)           | Viewport lifecycle, first scene, and localization prerequisite  | Implemented                           |
| [0006](0006-browser-ci-and-pages.md)         | Local browser verification and artifact-based Pages delivery    | Amended; browser suites run locally   |
| [0007](0007-inspection-ui.md)                | Inspection HUD, shared pose, and live language switching        | Superseded in part by 0009 (HUD)      |
| [0008](0008-flight-model.md)                 | Rigid-body flight model, RK4, and rate-command assistance       | Implemented                           |
| [0009](0009-flight-runtime.md)               | Fixed-step flight runtime, input, and interpolation ownership   | Implemented; camera amended by 0010   |
| [0010](0010-chase-camera-and-instruments.md) | Heading-following chase camera and landing radar                | Implemented; accepted with M1         |
| [0011](0011-contact-model.md)                | Own penalty contact behind a surface seam; no Rapier yet        | Implemented                           |
| [0012](0012-landing-outcomes.md)             | Touchdown judging as a pure reducer with game-owned limits      | Implemented                           |
| [0013](0013-learn-section.md)                | A Learn section that runs the real engine                       | Implemented; content awaits review    |
| [0014](0014-theme-system.md)                 | Typed themes that generate CSS variables and scene accents      | Implemented                           |
| [0015](0015-glass-look-and-typefaces.md)     | The Glass look: self-hosted typefaces, translucent panels       | Implemented                           |
| [0016](0016-input-layer.md)                  | One input layer: sources merged into one pilot input per frame  | Implemented                           |
| [0017](0017-phone-play.md)                   | Phone play: landscape flight, no page zoom, clear thumb zones   | Implemented; on-device checks pending |
| [0018](0018-gravity-and-frames.md)           | Central-body gravity, a Moon-fixed rotating frame, conversions  | Implemented; not used by the game yet |
| [0019](0019-orbits-and-time-warp.md)         | Orbits and time warp: physics warp, then Kepler rails           | Implemented; controls arrive in 5.3   |
| [0020](0020-planetary-view.md)               | Planetary view: vehicle-centred world, separate map, colour map | Implemented; game uses it from 5.3b   |
