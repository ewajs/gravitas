import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { CHASE, ChaseRig, chasePolar, easeAngle } from './chase';

const yaw = (angle: number) =>
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
function rig(altitude = 40) {
  const camera = new THREE.PerspectiveCamera();
  const target = new THREE.Vector3();
  const vehicle = new THREE.Object3D();
  vehicle.position.set(5, altitude + 1.5, -3);
  const chase = new ChaseRig(camera, target);
  chase.snap(vehicle, altitude);
  const offset = () => new THREE.Spherical().setFromVector3(camera.position.clone().sub(target));
  const run = (seconds: number) => {
    for (let t = 0; t < seconds; t += 1 / 60) chase.update(vehicle, altitude, 1 / 60);
  };
  return { camera, target, vehicle, chase, offset, run };
}

describe('chase framing', () => {
  it('is steep high up and flatter near the ground', () => {
    expect(chasePolar(200)).toBeCloseTo(CHASE.highPolar, 12);
    expect(chasePolar(0)).toBeCloseTo(CHASE.lowPolar, 12);
    expect(chasePolar(32.5)).toBeCloseTo((CHASE.highPolar + CHASE.lowPolar) / 2, 12);
  });

  it('eases angles the short way round the circle', () => {
    const next = easeAngle(3, -3, 0.6, 0.6); // 0.28 rad apart across ±π, not 6 rad.
    expect(next).toBeGreaterThan(3);
    expect(next - 3).toBeCloseTo((2 * Math.PI - 6) * (1 - Math.exp(-1)), 12);
  });

  it('starts behind the heading, level, at the default distance', () => {
    const { offset, target, vehicle } = rig();
    const start = offset();
    expect(start.radius).toBeCloseTo(CHASE.distance, 9);
    expect(start.theta).toBeCloseTo(0, 9); // Heading 0 faces −Z, so behind is +Z.
    expect(start.phi).toBeCloseTo(chasePolar(40), 9);
    expect(target.toArray()).toEqual(vehicle.position.toArray()); // Orbits the centre of mass.
  });

  it('turns behind a new heading smoothly and follows translation exactly', () => {
    const { offset, target, vehicle, run, chase } = rig();
    vehicle.quaternion.copy(yaw(Math.PI / 2));
    chase.update(vehicle, 40, 1 / 60);
    expect(offset().theta).toBeLessThan(0.1); // Eased, not snapped.
    run(5);
    expect(offset().theta).toBeCloseTo(Math.PI / 2, 3);
    vehicle.position.x += 7;
    chase.update(vehicle, 40, 0);
    expect(target.x).toBeCloseTo(12, 9);
  });

  it('leaves the player orbit alone, then eases back after a delay, keeping zoom', () => {
    const { camera, target, offset, run, chase } = rig();
    chase.setUserActive(true);
    const orbited = new THREE.Spherical(25, 1.2, 2);
    camera.position.setFromSpherical(orbited).add(target);
    run(3);
    expect(offset().theta).toBeCloseTo(2, 9);
    chase.setUserActive(false);
    run(CHASE.returnDelay - 0.1);
    expect(offset().theta).toBeCloseTo(2, 9);
    run(6);
    expect(offset().theta).toBeCloseTo(0, 2);
    expect(offset().phi).toBeCloseTo(chasePolar(40), 2);
    expect(offset().radius).toBeCloseTo(25, 9);
  });

  it('holds the last heading through an exact inversion', () => {
    const { vehicle, offset, run } = rig();
    vehicle.quaternion.copy(yaw(1));
    run(6);
    vehicle.quaternion.set(1, 0, 0, 0); // 180° about X: heading undefined.
    run(3);
    expect(offset().theta).toBeCloseTo(1, 2);
  });
});
