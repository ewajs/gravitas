import { expect, it } from 'vitest';
import { frameStats, percentile } from './diagnostics';

it('takes nearest-rank percentiles', () => {
  const values = [5, 1, 4, 2, 3, 10, 6, 7, 8, 9];
  expect(percentile(values, 0.5)).toBe(5);
  expect(percentile(values, 0.95)).toBe(10);
  expect(percentile([], 0.5)).toBe(0);
});

it('summarizes frame rate from intervals and work from percentiles', () => {
  const samples = Array.from({ length: 20 }, (_, i) => ({
    interval: 1000 / 60,
    work: i < 19 ? 2 : 9,
  }));
  const stats = frameStats(samples);
  expect(stats.fps).toBeCloseTo(60, 9);
  expect(stats.workP50Ms).toBe(2);
  expect(stats.workP95Ms).toBe(2); // One slow frame in twenty sits above the 95th percentile.
  expect(frameStats([...samples, { interval: 1000 / 60, work: 9 }]).workP95Ms).toBe(9);
});
