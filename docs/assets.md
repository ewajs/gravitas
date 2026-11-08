# Third-party assets

Assets made outside this repository, where they came from, and the terms they
ship under. Code and documentation are MIT ([ADR 0004](decisions/0004-workspace-tooling.md));
anything listed here keeps its own terms. Fonts come from npm packages and are
listed in their licences there.

## Moon colour map

- **Shipped as:** `apps/game/public/moon/lroc-color-2k.jpg`, 2048 × 1024
  equirectangular, longitude −180° at the left edge, north at the top.
- **Source:** NASA Scientific Visualization Studio, _CGI Moon Kit_ (ID 4720,
  released 2019-09-06), file `lroc_color_poles_2k.tif`, downloaded 2026-11-07 from
  <https://svs.gsfc.nasa.gov/4720> (SHA-256
  `13b797422e8c4b8607ff2b2623ac3a046a6da0132d567c2d272d92fad7052c4a`). Built from
  the Lunar Reconnaissance Orbiter Camera (LROC) Wide Angle Camera mosaic, with the
  poles filled in.
- **Conversion:** `sips -s format jpeg -s formatOptions 82` on macOS; shipped
  SHA-256 `63ba34b72d630c4d48beb7ad863119f537e3be7118386da048f2f6f43382d256`.
- **Terms:** NASA imagery is generally not subject to copyright in the United
  States (NASA media usage guidelines). Credit: "NASA's Scientific Visualization
  Studio", as the SVS page asks. NASA's name and logos are not used to imply
  endorsement.
- **Credited in:** this file and the Credits section of the manual's home page
  (`manual/index.md`, `manual/en/index.md`).
