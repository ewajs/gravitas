import { expect, it } from 'vitest';
import { RADAR_RADIUS, RADAR_SCALE, radarPoint } from './radar';

it('draws forward up and right to the right, in proportion to full scale', () => {
  expect(radarPoint({ x: 0, y: 30 }, RADAR_SCALE.pad)).toEqual({
    x: 0,
    y: -RADAR_RADIUS / 2,
    clamped: false,
  });
  expect(radarPoint({ x: 5, y: 0 }, RADAR_SCALE.drift)).toEqual({
    x: RADAR_RADIUS / 2,
    y: -0,
    clamped: false,
  });
});

it('clamps distant values to the rim without changing direction', () => {
  const point = radarPoint({ x: -300, y: -400 }, RADAR_SCALE.pad);
  expect(point.clamped).toBe(true);
  expect(Math.hypot(point.x, point.y)).toBeCloseTo(RADAR_RADIUS, 12);
  expect(point.x / point.y).toBeCloseTo(-300 / 400, 12);
});
