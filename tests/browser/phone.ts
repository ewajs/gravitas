import type { CDPSession, Page } from '@playwright/test';
import { expect } from './test';

// Phone emulation in landscape. Sizes are CSS pixels of the two test devices:
// iPhone 15 Pro (393 × 852, DPR 3) and Samsung Galaxy A70 (411 × 914, DPR 2.625).
export const PHONES = {
  'iPhone 15 Pro': { width: 852, height: 393, deviceScaleFactor: 3 },
  'Galaxy A70': { width: 914, height: 411, deviceScaleFactor: 2.625 },
} as const;

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
