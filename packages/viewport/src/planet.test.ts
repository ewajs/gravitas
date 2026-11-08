import { describe, expect, it } from 'vitest';
import { Color, SphereGeometry, Vector3 } from 'three/webgpu';
import { createPlanet, starGeometry } from './planet';

describe('the planet', () => {
  it("matches Three's sphere UVs to the engine's body-fixed longitudes, so the map needs no turn", () => {
    // An equirectangular map has longitude −180° at u = 0, 0° at u = 0.5, +90° east at
    // u = 0.75, and north at v = 1. Engine body-fixed: longitude 0 at +X, 90° east at
    // −Z, north at +Y. Find the sphere's vertices at those UVs and compare.
    const sphere = new SphereGeometry(1, 64, 32);
    const uv = sphere.getAttribute('uv');
    const position = sphere.getAttribute('position');
    const at = (u: number, v: number) => {
      for (let i = 0; i < uv.count; i++) {
        if (Math.abs(uv.getX(i) - u) < 1e-6 && Math.abs(uv.getY(i) - v) < 1e-6) {
          return new Vector3().fromBufferAttribute(position, i);
        }
      }
      throw new Error(`no vertex at uv (${u}, ${v})`);
    };
    const near = (actual: Vector3, x: number, y: number, z: number) =>
      expect(actual.distanceTo(new Vector3(x, y, z))).toBeLessThan(1e-6);
    near(at(0.5, 0.5), 1, 0, 0); // longitude 0
    near(at(0.75, 0.5), 0, 0, -1); // 90° east
    near(at(0.25, 0.5), 0, 0, 1); // 90° west
    near(at(0.5, 0.75), Math.SQRT1_2, Math.SQRT1_2, 0); // 45° north on longitude 0
    sphere.dispose();
  });

  it('scatters the same stars on the unit sphere every time', () => {
    const a = starGeometry(200);
    const b = starGeometry(200);
    const positions = a.getAttribute('position');
    expect(Array.from(positions.array)).toEqual(Array.from(b.getAttribute('position').array));
    for (let i = 0; i < positions.count; i++) {
      expect(new Vector3().fromBufferAttribute(positions, i).length()).toBeCloseTo(1, 6);
    }
    a.dispose();
    b.dispose();
  });

  it('shows and hides, and puts the vehicle on the map in body-fixed coordinates', () => {
    const planet = createPlanet(new Color('#000000'));
    try {
      expect(planet.visible).toBe(false);
      planet.show({ radius: 1000 });
      expect(planet.visible).toBe(true);
      // Body centre 1,100 m below the vehicle, body turned 90° about +Y (body +X → world −Z).
      const s = Math.SQRT1_2;
      planet.setPose({ centre: { x: 0, y: -1100, z: 0 }, orientation: { x: 0, y: s, z: 0, w: s } });
      planet.setVehicle(new Vector3(0, 0, -50));
      // World offset from the centre (0, 1100, −50); body-fixed: −Z world is +X body.
      const onMap = planet.vehicleOnMap();
      expect(onMap.x).toBeCloseTo(50, 9);
      expect(onMap.y).toBeCloseTo(1100, 9);
      expect(onMap.z).toBeCloseTo(0, 9);
      planet.show(null);
      expect(planet.visible).toBe(false);
    } finally {
      planet.dispose();
    }
  });

  it('closes a closed orbit by repeating its first point, leaves arcs open, and removes them', () => {
    const planet = createPlanet(new Color('#000000'));
    try {
      const points = [
        { x: 2, y: 0, z: 0 },
        { x: 0, y: 0, z: -2 },
        { x: -2, y: 0, z: 0 },
      ];
      planet.setOrbit({ points, closed: true, periapsis: points[0]! });
      const drawn = () => planet.orbitLine!.geometry.getAttribute('position');
      expect(drawn().count).toBe(4);
      expect(drawn().getX(3)).toBe(2);
      planet.setOrbit({ points, closed: false });
      expect(drawn().count).toBe(3);
      planet.setOrbit(null);
      expect(planet.orbitLine).toBeUndefined();
    } finally {
      planet.dispose();
    }
  });
});
