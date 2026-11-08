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

## Moon elevation grid

- **Shipped as:** `apps/game/public/moon/ldem-4.bin`, unchanged from the source:
  1440 × 720 little-endian 16-bit integers, heights in half metres above a
  1,737.4 km sphere, row 0 at the north pole, column 0 at longitude 0°,
  pixel-registered, 4 samples per degree (about 7.6 km at the equator).
- **Source:** LRO LOLA Gridded Data Record `LDEM_4` (data set
  `LRO-L-LOLA-4-GDR-V1.0`, product version 3.0, created 2017-09-15 by the LOLA
  team at NASA Goddard Space Flight Center), from the NASA PDS Geosciences Node,
  <https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/>,
  files `ldem_4.img` (SHA-256
  `c04632eba6449af49e3108ed7c25b3b1c450600abd3690df4fc815853a1af476`) and its
  label `ldem_4.lbl`. Downloaded 2026-11-08.
- **Reproduce:** `npm run moon-data` downloads both, checks the image's checksum
  and the label's layout fields, and writes the shipped file
  ([ADR 0021](decisions/0021-terrain.md)).
- **Terms:** NASA Planetary Data System archives are public; NASA data is
  generally not subject to copyright in the United States. Credit: "NASA/GSFC
  LOLA team, via the NASA Planetary Data System". NASA's name and logos are not
  used to imply endorsement.
- **Credited in:** this file and the Credits section of the manual's home page.
