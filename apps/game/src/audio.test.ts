import { expect, it } from 'vitest';
import { audioLevels } from './audio';

const still = { x: 0, y: 0, z: 0 };

it('is silent at idle and grows with throttle without exceeding its ceiling', () => {
  expect(audioLevels({ throttle: 0, attitude: still })).toEqual({
    engine: 0,
    engineCutoff: 180,
    thrusters: 0,
  });
  const quarter = audioLevels({ throttle: 0.25, attitude: still });
  const full = audioLevels({ throttle: 1, attitude: still });
  expect(quarter.engine).toBeCloseTo(0.2, 12); // √0.25 × 0.4: low throttle stays audible.
  expect(full.engine).toBeCloseTo(0.4, 12);
  expect(full.engineCutoff).toBeGreaterThan(quarter.engineCutoff);
});

it('hisses for attitude commands on any axis, ignoring tiny residual torque', () => {
  expect(audioLevels({ throttle: 0, attitude: { x: 0.03, y: 0, z: 0 } }).thrusters).toBe(0);
  expect(audioLevels({ throttle: 0, attitude: { x: 0, y: -1, z: 0 } }).thrusters).toBeCloseTo(
    0.24,
    12,
  );
  expect(audioLevels({ throttle: 0, attitude: { x: 0.5, y: 0, z: -0.2 } }).thrusters).toBeCloseTo(
    0.18,
    12,
  );
});
