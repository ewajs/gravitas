import type { Locator, Page } from '@playwright/test';
import { expect } from './test';

/** A box in CSS pixels, as Playwright's `boundingBox` reports it. */
export type Box = { x: number; y: number; width: number; height: number };

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export async function box(locator: Locator): Promise<Box> {
  const found = await locator.boundingBox();
  expect(found, 'element is laid out').not.toBeNull();
  return found!;
}

export function inside(b: Box, width: number, height: number, label: string) {
  expect(b.x, `${label} left`).toBeGreaterThanOrEqual(-0.5);
  expect(b.y, `${label} top`).toBeGreaterThanOrEqual(-0.5);
  expect(b.x + b.width, `${label} right`).toBeLessThanOrEqual(width + 0.5);
  expect(b.y + b.height, `${label} bottom`).toBeLessThanOrEqual(height + 0.5);
}

/**
 * Every rendered element and text run in the HUD and the touch controls that
 * leaves the viewport or its container. Inside a vertically scrolling container
 * (Help, the results card) content may lie below the fold, so only its
 * horizontal extent counts there; visually hidden text (clipped for screen
 * readers) is skipped. A HUD element whose content is wider than its box
 * (`scrollWidth > clientWidth`) counts too. The touch controls' drawn parts
 * (the detent mark is deliberately wider than the lever track) are checked
 * against the viewport only.
 */
export async function overflowing(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = innerWidth;
    const height = innerHeight;
    const problems: string[] = [];
    const tolerance = 1;
    const name = (element: Element) =>
      `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${
        element.classList.length ? `.${[...element.classList].join('.')}` : ''
      }`;
    // Ancestors inside the shadow root, nearest first.
    const ancestors = (element: Element) => {
      const list: Element[] = [];
      for (let at = element.parentElement; at; at = at.parentElement) list.push(at);
      return list;
    };
    const clipped = (element: Element) =>
      [element, ...ancestors(element)].some((at) => getComputedStyle(at).clipPath !== 'none');
    const scrolled = (element: Element) =>
      ancestors(element).some((at) => {
        const overflow = getComputedStyle(at).overflowY;
        return (overflow === 'auto' || overflow === 'scroll') && at.scrollHeight > at.clientHeight;
      });
    const outside = (rect: DOMRect, vertical: boolean) =>
      rect.left < -tolerance ||
      rect.right > width + tolerance ||
      (vertical && (rect.top < -tolerance || rect.bottom > height + tolerance));

    for (const host of document.querySelectorAll('gravitas-flight-hud, gravitas-touch-controls')) {
      const root = host.shadowRoot;
      if (!root || (host as HTMLElement).hidden) continue;
      const hud = host.tagName === 'GRAVITAS-FLIGHT-HUD';
      for (const element of root.querySelectorAll('*')) {
        if (element instanceof SVGElement && element.tagName !== 'svg') continue;
        if (!element.checkVisibility({ visibilityProperty: true })) continue;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 1 || rect.height <= 1 || clipped(element)) continue;
        if (outside(rect, !scrolled(element))) problems.push(`${name(element)} leaves the screen`);
        const style = getComputedStyle(element);
        if (
          hud &&
          !(element instanceof SVGElement) &&
          !style.display.startsWith('inline') &&
          style.overflowX !== 'auto' &&
          style.overflowX !== 'scroll' &&
          element.scrollWidth > element.clientWidth + tolerance
        )
          problems.push(
            `${name(element)} content is wider than its box (${element.scrollWidth} > ${element.clientWidth})`,
          );
      }
      // Text runs: inside the screen and inside their nearest block container.
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (!node.textContent?.trim() || !parent || !parent.checkVisibility()) continue;
        if (parent.closest('svg') || clipped(parent)) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (rect.width === 0) continue;
          if (outside(rect, !scrolled(parent)))
            problems.push(`"${node.textContent.trim()}" leaves the screen`);
          const block = [parent, ...ancestors(parent)].find(
            (at) => !getComputedStyle(at).display.startsWith('inline'),
          );
          const container = block?.getBoundingClientRect();
          if (
            container &&
            (rect.left < container.left - tolerance || rect.right > container.right + tolerance)
          )
            problems.push(`"${node.textContent.trim()}" leaves ${name(block!)}`);
        }
      }
    }
    return problems;
  });
}

/**
 * The visible HUD parts and drawn touch controls, by name: panels, buttons,
 * cards, the phase line, the lever, yaw buttons, and the stick (its resting hint
 * or the stick under the thumb). The touch zones themselves are transparent and
 * not listed.
 */
export async function hudParts(page: Page): Promise<Record<string, Box>> {
  return page.evaluate(() => {
    const parts: Record<string, { x: number; y: number; width: number; height: number }> = {};
    const add = (root: ShadowRoot | null | undefined, selectors: string) => {
      if (!root) return;
      root.querySelectorAll(selectors).forEach((element, index) => {
        if (!element.checkVisibility({ visibilityProperty: true })) return;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 1 || rect.height <= 1) return;
        const label = `${element.tagName.toLowerCase()}.${[...element.classList].join('.')}#${index}`;
        parts[label] = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      });
    };
    add(
      document.querySelector('gravitas-flight-hud')?.shadowRoot,
      '.panel, header button, .identity, .mission, #phase, .overlay .actions button, .card, .turn-hint, .menu',
    );
    const controls = document.querySelector('gravitas-touch-controls');
    if (controls && !controls.hidden)
      add(controls.shadowRoot, '.lever, .yaw button, .stick-hint, .base');
    return parts;
  });
}

/**
 * The corridor from the lander down to the pad: the middle third of the screen's
 * width, from the bottom of the top corner chips (the readout card or the top
 * buttons, whichever reaches lower) to the bottom edge. The chase camera keeps
 * the lander centred and the opening faces the pad, so both lie inside it.
 */
export async function centreCorridor(page: Page): Promise<Box> {
  const parts = await hudParts(page);
  const { width, height } = page.viewportSize()!;
  const top = Math.max(
    0,
    ...Object.entries(parts)
      .filter(([label]) => /flight-panel|^button\.icon/.test(label))
      .map(([, b]) => b.y + b.height),
  );
  return { x: width / 3, y: top, width: width / 3, height: height - top };
}

/** Fails if any HUD part or drawn touch control lies in the centre corridor. */
export async function expectClearCentre(page: Page, state: string) {
  const corridor = await centreCorridor(page);
  const parts = await hudParts(page);
  const inCorridor = Object.entries(parts)
    .filter(([, b]) => overlaps(b, corridor))
    .map(([label]) => label);
  expect(inCorridor, `nothing in the centre corridor while ${state}`).toEqual([]);
}
