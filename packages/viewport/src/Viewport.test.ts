import { describe, expect, it } from 'vitest';
import { Viewport } from './Viewport';
import { TEST_MODEL } from './test-model';

// Construction and argument validation need no DOM or GPU; rendering is browser-tested.
const options = { container: {} as HTMLElement, label: 'Test', vehicle: TEST_MODEL };

describe('viewport arguments', () => {
  it('rejects a vehicle model that does not validate', () => {
    for (const centerOfMassHeight of [0, -1, NaN]) {
      const vehicle = { ...TEST_MODEL, centerOfMassHeight };
      expect(() => new Viewport({ ...options, vehicle })).toThrow(RangeError);
    }
    const viewport = new Viewport(options);
    expect(() => viewport.setVehicle({ ...TEST_MODEL, strutFinish: 'chrome' })).toThrow(RangeError);
    void viewport.dispose();
  });

  it('takes one leg compression per leg of the current vehicle', () => {
    const viewport = new Viewport(options);
    expect(() => viewport.setLegCompression([0, 0, 0, 0])).not.toThrow();
    expect(() => viewport.setLegCompression([0, 0, 0])).toThrow(RangeError);
    const tripod = { ...TEST_MODEL, legs: TEST_MODEL.legs.slice(0, 3) };
    viewport.setVehicle(tripod);
    expect(() => viewport.setLegCompression([0, 0.1, 0])).not.toThrow();
    expect(() => viewport.setLegCompression([0, 0, 0, 0])).toThrow(RangeError);
    void viewport.dispose();
  });

  it('rejects actuator values outside their ranges', () => {
    const viewport = new Viewport(options);
    const attitude = { x: 0, y: 0, z: 0 };
    for (const throttle of [-0.1, 1.1, NaN]) {
      expect(() => viewport.setActuators({ throttle, attitude })).toThrow(RangeError);
    }
    expect(() =>
      viewport.setActuators({ throttle: 0.5, attitude: { ...attitude, y: 1.5 } }),
    ).toThrow(RangeError);
    expect(() =>
      viewport.setActuators({ throttle: 1, attitude: { x: -1, y: 1, z: 0 } }),
    ).not.toThrow();
    void viewport.dispose();
  });

  it('accepts only #rrggbb scene accents', () => {
    const viewport = new Viewport(options);
    const accents = { sky: '#04060b', pad: '#4CC3E0', marker: '#eaf2fa', orbit: '#4CC3E0' };
    expect(() => viewport.setAccents(accents)).not.toThrow();
    for (const bad of ['red', '#fff', '#04060b80', 'rgb(0, 0, 0)', '']) {
      expect(() => viewport.setAccents({ ...accents, pad: bad })).toThrow(RangeError);
    }
    void viewport.dispose();
  });

  it('rejects a render blend outside [0, 1] before drawing', () => {
    const viewport = new Viewport(options);
    for (const alpha of [-0.1, 1.1, NaN]) expect(() => viewport.render(alpha)).toThrow(RangeError);
    expect(viewport.render(0.5)).toBe(false); // Not initialized.
    void viewport.dispose();
  });

  it('shows a planet in place of the flat site, and offers the map only then', () => {
    const viewport = new Viewport(options);
    expect(viewport.setCameraMode('map')).toBe(false);
    expect(viewport.cameraMode).toBe('chase');
    for (const radius of [0, -1, NaN, Infinity]) {
      expect(() => viewport.setPlanet({ radius })).toThrow(RangeError);
    }
    viewport.setPlanet({ radius: 1_737_400 });
    expect(viewport.setCameraMode('map')).toBe(true);
    expect(viewport.cameraMode).toBe('map');
    viewport.setPlanet(null);
    expect(viewport.cameraMode).toBe('chase');
    void viewport.dispose();
  });

  it('validates planet poses, sun directions, and orbit paths', () => {
    const viewport = new Viewport(options);
    viewport.setPlanet({ radius: 1000 });
    const pose = { centre: { x: 0, y: -1100, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } };
    expect(() => viewport.setPlanetPose(pose)).not.toThrow();
    expect(() =>
      viewport.setPlanetPose({ ...pose, orientation: { x: 0, y: 0, z: 0, w: 2 } }),
    ).toThrow(RangeError);
    expect(() => viewport.setPlanetPose({ ...pose, centre: { x: NaN, y: 0, z: 0 } })).toThrow(
      RangeError,
    );
    expect(() => viewport.setSunDirection({ x: 0, y: 0, z: 0 })).toThrow(RangeError);
    expect(() => viewport.setSunDirection({ x: 1, y: 2, z: 3 })).not.toThrow();
    const points = [
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
    ];
    expect(() => viewport.setOrbitPath({ points, closed: false })).not.toThrow();
    expect(() => viewport.setOrbitPath({ points: points.slice(1), closed: false })).toThrow(
      RangeError,
    );
    expect(() =>
      viewport.setOrbitPath({ points, closed: true, periapsis: { x: Infinity, y: 0, z: 0 } }),
    ).toThrow(RangeError);
    expect(() => viewport.setOrbitPath(null)).not.toThrow();
    void viewport.dispose();
  });
});
