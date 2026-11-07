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

  it('rejects actuator values outside their ranges', () => {
    const viewport = new Viewport(options);
    const attitude = { x: 0, y: 0, z: 0 };
    for (const throttle of [-0.1, 1.1, NaN]) {
      expect(() => viewport.setActuators({ throttle, attitude })).toThrow(RangeError);
    }
    expect(() =>
      viewport.setActuators({ throttle: 0.5, attitude: { ...attitude, y: 1.5 } }),
    ).toThrow(RangeError);
    expect(() =>
      viewport.setActuators({ throttle: 1, attitude: { x: -1, y: 1, z: 0 } }),
    ).not.toThrow();
    void viewport.dispose();
  });

  it('rejects a render blend outside [0, 1] before drawing', () => {
    const viewport = new Viewport(options);
    for (const alpha of [-0.1, 1.1, NaN]) expect(() => viewport.render(alpha)).toThrow(RangeError);
    expect(viewport.render(0.5)).toBe(false); // Not initialized.
    void viewport.dispose();
  });
});
