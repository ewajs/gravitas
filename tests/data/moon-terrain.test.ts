import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sampleTerrain, terrainHeight, type Vector3 } from '@gravitas/engine';
import { decodeHeightGrid, moonTerrain } from '../../apps/game/src/terrain';

// The shipped Moon (5.4a): NASA's LDEM_4 as written by `npm run moon-data`.

const bytes = readFileSync(new URL('../../apps/game/public/moon/ldem-4.bin', import.meta.url));
const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const grid = decodeHeightGrid(buffer);
const moon = moonTerrain(buffer);

function direction(latitude: number, longitude: number): Vector3 {
  const φ = (latitude * Math.PI) / 180;
  const λ = (longitude * Math.PI) / 180;
  return { x: Math.cos(φ) * Math.cos(λ), y: Math.sin(φ), z: -Math.cos(φ) * Math.sin(λ) };
}

describe('the shipped elevation grid', () => {
  it('is NASA’s LDEM_4, unchanged', () => {
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      'c04632eba6449af49e3108ed7c25b3b1c450600abd3690df4fc815853a1af476',
    );
  });

  it('spans the label’s extremes: +10.5 km on the far-side highlands, −8.9 km near the south pole', () => {
    let highest = 0;
    let lowest = 0;
    for (let n = 1; n < grid.samples.length; n++) {
      if (grid.samples[n]! > grid.samples[highest]!) highest = n;
      if (grid.samples[n]! < grid.samples[lowest]!) lowest = n;
    }
    expect(grid.samples[highest]! * 0.5).toBe(10504);
    expect(grid.samples[lowest]! * 0.5).toBe(-8878.5);
    const where = (n: number) => ({
      latitude: 90 - (Math.floor(n / 1440) + 0.5) / 4,
      longitude: ((n % 1440) + 0.5) / 4,
    });
    // The highest ground is just north of the equator on the far side.
    expect(where(highest).latitude).toBeGreaterThan(0);
    expect(where(highest).latitude).toBeLessThan(10);
    expect(where(highest).longitude).toBeGreaterThan(180);
    expect(where(highest).longitude).toBeLessThan(225);
    // The lowest is in the South Pole–Aitken basin.
    expect(where(lowest).latitude).toBeLessThan(-60);
    expect(where(lowest).longitude).toBeGreaterThan(150);
    expect(where(lowest).longitude).toBeLessThan(210);
  });

  it('samples the grid itself at cell centres', () => {
    const smooth = (n: number) => {
      const row = Math.floor(n / 1440);
      const column = n % 1440;
      return terrainHeight(moon, direction(90 - (row + 0.5) / 4, (column + 0.5) / 4), Infinity);
    };
    for (let n = 0; n < grid.samples.length; n += 9973) {
      expect(smooth(n)).toBeCloseTo(grid.samples[n]! * 0.5, 6);
    }
  });

  it('puts Tranquility Base on the low, smooth mare, about 1.9 km below the reference', () => {
    // Apollo 11's landing site, 0.674°N 23.473°E.
    const site = direction(0.674, 23.473);
    expect(terrainHeight(moon, site, Infinity)).toBeGreaterThan(-2100);
    expect(terrainHeight(moon, site, Infinity)).toBeLessThan(-1800);
    expect(sampleTerrain(moon, site, Infinity).slope).toBeLessThan((1 * Math.PI) / 180);
  });

  it('keeps every sampled height within the terrain’s declared bounds', () => {
    for (let n = 0; n < 5000; n++) {
      const y = 1 - (2 * (n + 0.5)) / 5000;
      const ring = Math.sqrt(1 - y * y);
      const angle = n * Math.PI * (3 - Math.sqrt(5));
      const h = terrainHeight(moon, { x: ring * Math.cos(angle), y, z: ring * Math.sin(angle) });
      expect(h).toBeLessThan(moon.maximumHeight);
      expect(h).toBeGreaterThan(moon.minimumHeight);
    }
  });
});
