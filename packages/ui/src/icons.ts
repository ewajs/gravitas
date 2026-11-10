import { svg, type SVGTemplateResult } from 'lit';

// Inline line icons on a 24-unit grid, drawn in currentColor. Always decorative:
// the control or text beside each one carries its accessible name.
const icon = (paths: SVGTemplateResult, size = 20) =>
  svg`<svg class="icon" width=${size} height=${size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true" focusable="false">${paths}</svg>`;

/** The HUD's icon set. */
export const icons = {
  pause: (size = 20) => icon(svg`<path d="M9 5v14M15 5v14"></path>`, size),
  play: () => icon(svg`<path d="M8 5.5v13l10-6.5z"></path>`),
  restart: () =>
    icon(svg`<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9"></path><path d="M4.5 4.5V9H9"></path>`),
  sound: () =>
    icon(svg`<path d="M4 9h4l5-4v14l-5-4H4z"></path><path d="M16.5 9a4 4 0 0 1 0 6"></path>`),
  muted: () =>
    icon(svg`<path d="M4 9h4l5-4v14l-5-4H4z"></path><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"></path>`),
  help: () =>
    icon(
      svg`<circle cx="12" cy="12" r="9"></circle><path d="M9.6 9.2a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .9-1 1.6"></path><path d="M12 16.8v.2"></path>`,
    ),
  /** Turning left: an arc over the top ending in a left arrow (↶), for the yaw button. */
  yawLeft: (size = 22) =>
    icon(
      svg`<path d="M19 15a7 7 0 0 0-14 0"></path><path d="M2.5 12.5 5 15l2.5-2.5"></path>`,
      size,
    ),
  /** Turning right (↷). */
  yawRight: (size = 22) =>
    icon(
      svg`<path d="M5 15a7 7 0 0 1 14 0"></path><path d="M16.5 12.5 19 15l2.5-2.5"></path>`,
      size,
    ),
  /** A phone turning sideways, for the rotate prompt. */
  rotate: (size = 48) =>
    icon(
      svg`<rect x="7" y="3" width="10" height="18" rx="2"></rect><path d="M11 18h2"></path><path d="M20 8a8 8 0 0 1 0 8"></path><path d="M20 16l-2.2.2.2-2.2"></path>`,
      size,
    ),
  close: () => icon(svg`<path d="M6 6l12 12M18 6L6 18"></path>`),
  /** Three dots (⋯), for the phone menu. */
  more: () =>
    icon(
      svg`<circle cx="5" cy="12" r="1.2"></circle><circle cx="12" cy="12" r="1.2"></circle><circle cx="19" cy="12" r="1.2"></circle>`,
    ),
  /** Two chevrons pointing right: faster time warp. */
  faster: (size = 18) => icon(svg`<path d="M5 6l6 6-6 6M13 6l6 6-6 6"></path>`, size),
  /** Two chevrons pointing left: slower time warp. */
  slower: (size = 18) => icon(svg`<path d="M19 6l-6 6 6 6M11 6l-6 6 6 6"></path>`, size),
  /** A globe with an orbit around it, for the map view. */
  // Three stacked cards: the mission list.
  missions: (size = 20) =>
    icon(
      svg`<rect x="4" y="4" width="16" height="4.5" rx="1.5"></rect><rect x="4" y="10" width="16" height="4.5" rx="1.5"></rect><path d="M4 18.5h10"></path>`,
      size,
    ),
  map: (size = 20) =>
    icon(
      svg`<circle cx="12" cy="12" r="5"></circle><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-20 12 12)"></ellipse>`,
      size,
    ),
  /** A small lander shape, for returning to the chase view. */
  chase: (size = 20) =>
    icon(svg`<path d="M8 6h8l1 7H7z"></path><path d="M9 13l-3 6M15 13l3 6M12 13v3"></path>`, size),
  check: (size = 18) => icon(svg`<path d="M5 12.5l4.5 4.5L19 7.5"></path>`, size),
  cross: (size = 16) => icon(svg`<path d="M6 6l12 12M18 6L6 18"></path>`, size),
  caution: (size = 18) =>
    icon(svg`<path d="M12 4.5 3 19.5h18z"></path><path d="M12 10v4.2M12 17v.2"></path>`, size),
};
