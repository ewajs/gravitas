import type { CDPSession, Page } from '@playwright/test';
import { expect } from './test';

/** Safe-area insets in CSS pixels, as a phone reports them. */
export interface Insets {
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
}

/** One emulated phone screen: the page's CSS size, pixel ratio, and any insets. */
export interface Phone {
  readonly width: number;
  readonly height: number;
  readonly deviceScaleFactor: number;
  readonly insets?: Insets;
}

// Phone emulation in landscape: the page sizes the two test devices actually give
// it. iPhone 15 Pro (393 × 852 CSS px, DPR 3): in Safari with its toolbar the page
// gets 734 × 331 and Safari itself keeps clear of the notch; installed to the home
// screen it gets the whole 852 × 393 and reports the notch and home indicator as
// insets. Samsung Galaxy A70 (411 × 914, DPR 2.625): Chrome's toolbar leaves
// about 914 × 355; installed (full screen) 914 × 411.
export const PHONES: Record<string, Phone> = {
  'iPhone 15 Pro in Safari': { width: 734, height: 331, deviceScaleFactor: 3 },
  'iPhone 15 Pro installed': {
    width: 852,
    height: 393,
    deviceScaleFactor: 3,
    insets: { left: 59, right: 59, bottom: 21 },
  },
  'Galaxy A70 in Chrome': { width: 914, height: 355, deviceScaleFactor: 2.625 },
  'Galaxy A70 installed': { width: 914, height: 411, deviceScaleFactor: 2.625 },
};

/**
 * Upright in the browser, each with its landscape counterpart. Safari's toolbars
 * leave the iPhone 393 × 652; Chrome's top bar, the status bar, and the
 * three-button navigation bar leave the A70 about 411 × 786.
 */
export const PORTRAIT: Record<string, Phone & { readonly landscape: string }> = {
  'iPhone 15 Pro in Safari': {
    width: 393,
    height: 652,
    deviceScaleFactor: 3,
    landscape: 'iPhone 15 Pro in Safari',
  },
  'Galaxy A70 in Chrome': {
    width: 411,
    height: 786,
    deviceScaleFactor: 2.625,
    landscape: 'Galaxy A70 in Chrome',
  },
};

/**
 * Emulates the phone's safe-area insets (the notch and home indicator) through
 * CDP. Returns false where this Chromium cannot.
 */
export async function emulateInsets(page: Page, insets: Insets | undefined): Promise<boolean> {
  if (!insets) return true;
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send(
      'Emulation.setSafeAreaInsetsOverride' as never,
      { insets: { top: 0, ...insets } } as never,
    );
    return true;
  } catch {
    return false;
  }
}

/** Real multi-touch through the Chrome DevTools Protocol: several fingers at once. */
export class Fingers {
  readonly #points = new Map<number, { x: number; y: number }>();
  constructor(private readonly cdp: CDPSession) {}
  static async on(page: Page) {
    return new Fingers(await page.context().newCDPSession(page));
  }
  // CDP semantics (checked in Chromium): touchStart and touchMove list every finger
  // still down; touchEnd lists only the fingers that lift; touchCancel lists none.
  #send(
    type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel',
    points: Map<number, { x: number; y: number }> = this.#points,
  ) {
    const touchPoints = [...points].map(([id, { x, y }]) => ({ id, x, y, radiusX: 8, radiusY: 8 }));
    return this.cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  }
  async down(id: number, x: number, y: number) {
    this.#points.set(id, { x, y });
    await this.#send('touchStart');
  }
  /** Moves one finger in a few steps, as a thumb slides. */
  async move(id: number, x: number, y: number, steps = 4) {
    const from = this.#points.get(id)!;
    for (let step = 1; step <= steps; step++) {
      this.#points.set(id, {
        x: from.x + ((x - from.x) * step) / steps,
        y: from.y + ((y - from.y) * step) / steps,
      });
      await this.#send('touchMove');
    }
  }
  /** Lifts one finger; the others stay down. */
  async up(id: number) {
    const point = this.#points.get(id)!;
    this.#points.delete(id);
    await this.#send('touchEnd', new Map([[id, point]]));
  }
  /** The system cancels every touch (an incoming call, a gesture it claims). */
  async cancel() {
    this.#points.clear();
    await this.#send('touchCancel', new Map());
  }
  async tap(x: number, y: number) {
    await this.down(99, x, y);
    await this.up(99);
  }
}

export async function openPhone(page: Page, project: string, lang = 'en') {
  const backend = project === 'webgl2' ? 'webgl2' : 'auto';
  await page.goto(`http://127.0.0.1:4173/gravitas/?backend=${backend}&lang=${lang}`);
  await expect(page.locator('#viewport')).toHaveAttribute('data-backend', project);
}

export async function reading(page: Page, id: string): Promise<number> {
  const text = (await page.getByTestId(id).textContent()) ?? '';
  return Number(text.replace(/[^0-9.-]/g, ''));
}

export async function centre(page: Page, testId: string) {
  const box = (await page.getByTestId(testId).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}
