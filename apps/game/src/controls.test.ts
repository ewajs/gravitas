import { expect, it } from 'vitest';
import { pilotInput } from './controls';

it('maps held physical keys to body-rate requests with documented signs', () => {
  const rates = (...codes: string[]) => pilotInput(new Set(codes)).rates;
  expect(rates('KeyW')).toEqual({ x: -1, y: 0, z: 0 }); // Thrust axis tilts forward.
  expect(rates('KeyS')).toEqual({ x: 1, y: 0, z: 0 });
  expect(rates('KeyA')).toEqual({ x: 0, y: 0, z: 1 }); // Thrust axis tilts left.
  expect(rates('KeyD')).toEqual({ x: 0, y: 0, z: -1 });
  expect(rates('KeyQ')).toEqual({ x: 0, y: 1, z: 0 }); // Nose turns left.
  expect(rates('KeyE')).toEqual({ x: 0, y: -1, z: 0 });
  expect(rates('KeyW', 'KeyS', 'KeyA', 'KeyE')).toEqual({ x: 0, y: -1, z: 1 });
});

it('maps held throttle keys to a lever direction and passes one-shot settings through', () => {
  expect(pilotInput(new Set(['KeyR'])).throttleChange).toBe(1);
  expect(pilotInput(new Set(['KeyF'])).throttleChange).toBe(-1);
  expect(pilotInput(new Set(['KeyR', 'KeyF'])).throttleChange).toBe(0);
  expect(pilotInput(new Set(), 1)).toEqual({
    rates: { x: 0, y: 0, z: 0 },
    throttleChange: 0,
    throttleSet: 1,
  });
  expect(pilotInput(new Set())).not.toHaveProperty('throttleSet');
});
