import { expect, it } from 'vitest';
import { Box3 } from 'three/webgpu';
import { createScene } from './scene';

it('places level feet on the pad while transforms use the supplied centre of mass', () => {
  const art = createScene(1.5);
  // Precise bounds use vertices; transformed local boxes overstate the angled struts.
  const bounds = () => new Box3().setFromObject(art.vehicle, true);
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
