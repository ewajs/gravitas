import type { RadarVector } from './types';

/** Radar disc radius in SVG units; the view box adds a small margin. */
export const RADAR_RADIUS = 64;

/** Values drawn at the rim. Lean is sin(tilt): 0.5 is a 30° tilt. */
export const RADAR_SCALE = { lean: 0.5, drift: 10, pad: 60 } as const;

/** SVG point for a heading-frame vector: +y forward is drawn up; clamped to the rim. */
export function radarPoint(
  v: RadarVector,
  fullScale: number,
): { readonly x: number; readonly y: number; readonly clamped: boolean } {
  const scale = RADAR_RADIUS / fullScale;
  let x = v.x * scale;
  let y = -v.y * scale;
  const length = Math.hypot(x, y);
  const clamped = length > RADAR_RADIUS;
  if (clamped) {
    x *= RADAR_RADIUS / length;
    y *= RADAR_RADIUS / length;
  }
  return { x, y, clamped };
}
