import { describe, expect, it } from 'vitest';
import { Viewport } from './Viewport';

// Construction and argument validation need no DOM or GPU; rendering is browser-tested.
const options = { container: {} as HTMLElement, label: 'Test', centerOfMassHeight: 1.5 };

describe('viewport arguments', () => {
  it('rejects camera offsets outside the orbit distance limits', () => {
    expect(() => new Viewport({ ...options, cameraOffset: { x: 0, y: 2, z: 0 } })).toThrow(
      RangeError,
    );
    expect(() => new Viewport({ ...options, cameraOffset: { x: 0, y: 40, z: 0 } })).toThrow(
      RangeError,
    );
    expect(() => new Viewport({ ...options, cameraOffset: { x: NaN, y: 9, z: 0 } })).toThrow(
      RangeError,
    );
    void new Viewport({ ...options, cameraOffset: { x: -6, y: 12, z: 3 } }).dispose();
  });

  it('rejects a render blend outside [0, 1] before drawing', () => {
    const viewport = new Viewport(options);
    for (const alpha of [-0.1, 1.1, NaN]) expect(() => viewport.render(alpha)).toThrow(RangeError);
    expect(viewport.render(0.5)).toBe(false); // Not initialized.
    void viewport.dispose();
  });
});
