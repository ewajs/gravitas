import { describe, expect, it } from 'vitest';
import { gradientNoise, hash3, noiseSample, rehash, unitInterval } from './noise';

describe('hashing', () => {
  it('is pinned: the same coordinates and seed always give the same value', () => {
    // Changing these changes every procedural Moon; do so only on purpose.
    expect([hash3(0, 0, 0, 0), hash3(1, -2, 3, 0x6c756e61), rehash(12345, 1)]).toMatchSnapshot();
  });

  it('spreads neighbouring cells evenly over [0, 1)', () => {
    const buckets = new Array<number>(10).fill(0);
    for (let x = -50; x < 50; x++) {
      for (let y = -50; y < 50; y++) {
        const u = unitInterval(hash3(x, y, 7, 99));
        expect(u).toBeGreaterThanOrEqual(0);
        expect(u).toBeLessThan(1);
        buckets[Math.floor(u * 10)]!++;
      }
    }
    for (const count of buckets) expect(count).toBeGreaterThan(900);
    for (const count of buckets) expect(count).toBeLessThan(1100);
  });
});

describe('gradient noise', () => {
  it('is zero on the lattice, bounded, and its gradient matches finite differences', () => {
    const sample = noiseSample();
    expect(gradientNoise(3, -4, 5, 1, sample).value).toBe(0);
    const step = 1e-6;
    for (let n = 0; n < 500; n++) {
      const x = n * 0.731 - 100;
      const y = n * 0.377 + 3;
      const z = -n * 0.513;
      const { value, gx, gy, gz } = gradientNoise(x, y, z, 42, noiseSample());
      expect(Math.abs(value)).toBeLessThan(1.04);
      const at = (dx: number, dy: number, dz: number) =>
        gradientNoise(x + dx, y + dy, z + dz, 42, sample).value;
      expect(gx).toBeCloseTo((at(step, 0, 0) - at(-step, 0, 0)) / (2 * step), 6);
      expect(gy).toBeCloseTo((at(0, step, 0) - at(0, -step, 0)) / (2 * step), 6);
      expect(gz).toBeCloseTo((at(0, 0, step) - at(0, 0, -step)) / (2 * step), 6);
    }
  });
});
