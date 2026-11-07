import { describe, expect, it } from 'vitest';
import { Viewport } from './Viewport';

// Construction and argument validation need no DOM or GPU; rendering is browser-tested.
const options = { container: {} as HTMLElement, label: 'Test', centerOfMassHeight: 1.5 };

describe('viewport arguments', () => {
  it('rejects a non-positive or non-finite centre-of-mass height', () => {
    for (const centerOfMassHeight of [0, -1, NaN]) {
      expect(() => new Viewport({ ...options, centerOfMassHeight })).toThrow(RangeError);
    }
  });

  it('rejects a render blend outside [0, 1] before drawing', () => {
    const viewport = new Viewport(options);
    for (const alpha of [-0.1, 1.1, NaN]) expect(() => viewport.render(alpha)).toThrow(RangeError);
    expect(viewport.render(0.5)).toBe(false); // Not initialized.
    void viewport.dispose();
  });
});
