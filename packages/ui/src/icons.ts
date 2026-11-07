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
  /** Turning left (counter-clockwise seen from above), for the yaw button. */
  yawLeft: (size = 22) =>
    icon(
      svg`<path d="M16.5 6.2A8 8 0 1 0 20 12"></path><path d="M16.8 2.5l-.3 3.8 3.8.3"></path>`,
      size,
    ),
  /** Turning right (clockwise seen from above). */
  yawRight: (size = 22) =>
    icon(
      svg`<path d="M7.5 6.2A8 8 0 1 1 4 12"></path><path d="M7.2 2.5l.3 3.8-3.8.3"></path>`,
      size,
    ),
  close: () => icon(svg`<path d="M6 6l12 12M18 6L6 18"></path>`),
  check: (size = 18) => icon(svg`<path d="M5 12.5l4.5 4.5L19 7.5"></path>`, size),
  cross: (size = 16) => icon(svg`<path d="M6 6l12 12M18 6L6 18"></path>`, size),
  caution: (size = 18) =>
    icon(svg`<path d="M12 4.5 3 19.5h18z"></path><path d="M12 10v4.2M12 17v.2"></path>`, size),
};
