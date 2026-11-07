import { describe, expect, it } from 'vitest';
import { inspectionValues } from './inspection-values';

describe('inspection measurements', () => {
  it('uses horizontal separation from the supplied pad, independently of height', () => {
    expect(
      inspectionValues(
        {
          position: { x: 13, y: 900, z: -16 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
        },
        { x: 10, y: -40, z: -20 },
      ),
    ).toEqual({ offsetMetres: 5, tiltRadians: 0 });
  });

  it('measures tilt from upright, allowing yaw and inverted poses', () => {
    const position = { x: 0, y: 0, z: 0 };
    for (const [orientation, angle] of [
      [{ x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 }, 0],
      [{ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }, Math.PI / 2],
      [{ x: 0, y: 0, z: 1, w: 0 }, Math.PI],
    ] as const) {
      expect(inspectionValues({ position, orientation }, position).tiltRadians).toBeCloseTo(angle);
    }
  });
});
