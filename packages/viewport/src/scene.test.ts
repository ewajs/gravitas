import { expect, it } from 'vitest';
import { Box3, Color, type Mesh, type MeshStandardMaterial } from 'three/webgpu';
import { createScene, DEFAULT_ACCENTS } from './scene';

it('places level feet on the pad while transforms use the supplied centre of mass', () => {
  const art = createScene(1.5);
  // Precise bounds use vertices; transformed local boxes overstate the angled struts.
  // Measure the structure only: effects such as the plume hang below the bell.
  const bounds = () => {
    art.vehicle.updateMatrixWorld(true);
    return new Box3().setFromObject(art.artwork, true);
  };
  try {
    expect(art.vehicle.position.y).toBe(1.5);
    expect(bounds().min.y).toBeCloseTo(0, 6);
    art.vehicle.position.y = 11.5;
    expect(bounds().min.y).toBeCloseTo(10, 6);
    // Inverting about the centre of mass moves the foot plane to COM + 1.5 m.
    art.vehicle.rotation.z = Math.PI;
    expect(bounds().max.y).toBeCloseTo(13, 6);
  } finally {
    art.dispose();
  }
});

it('draws compressed legs: feet stay on the surface and struts follow them', () => {
  const art = createScene(1.5);
  const bounds = () => {
    art.vehicle.updateMatrixWorld(true);
    return new Box3().setFromObject(art.artwork, true);
  };
  try {
    art.vehicle.position.y = 1.5 - 0.2; // Centre of mass lowered by a 0.2 m compression.
    art.setLegCompression([0.2, 0.2, 0.2, 0.2]);
    art.vehicle.updateMatrixWorld(true);
    // Feet stay on the surface while the body sinks.
    expect(bounds().min.y).toBeCloseTo(0, 6);
    // Unmoved struts would poke 0.16 m below the surface above. Drawing clamps at
    // 0.6 m: each foot rises by its stroke, up to that limit (rest height 0.04 m).
    art.setLegCompression([2, 0.6, 0.5, 0]);
    expect(art.feet.map((foot) => +foot.position.y.toFixed(9))).toEqual([0.64, 0.64, 0.54, 0.04]);
  } finally {
    art.dispose();
  }
});

it('recolours the sky and pad, not the vehicle that shared the pad paint', () => {
  const art = createScene(1.5);
  try {
    const hull = () =>
      art.artwork.children
        .map((child) => ((child as Mesh).material as MeshStandardMaterial).color.getHexString())
        .join();
    const before = hull();
    expect((art.scene.background as Color).equals(new Color(DEFAULT_ACCENTS.sky))).toBe(true);
    art.setAccents({ sky: '#04060b', pad: '#4cc3e0', marker: '#eaf2fa' });
    expect((art.scene.background as Color).equals(new Color('#04060b'))).toBe(true);
    expect(hull()).toBe(before);
  } finally {
    art.dispose();
  }
});
