import * as THREE from 'three/webgpu';
import { headingAngle } from '@gravitas/engine';

/** Tunable chase-camera values; presentation only. Angles in radians, times in seconds. */
export const CHASE = {
  /** Default distance from the look-at point, in metres. */
  distance: 16,
  minDistance: 6,
  maxDistance: 40,
  /** Polar angle from straight up: steep when high (pad below in view), flatter near the ground. */
  highPolar: THREE.MathUtils.degToRad(35),
  lowPolar: THREE.MathUtils.degToRad(66),
  highAltitude: 60,
  lowAltitude: 5,
  /** Exponential easing time constants toward the chase position. */
  azimuthTime: 0.6,
  polarTime: 0.8,
  /** After the player orbits, wait this long before easing back. */
  returnDelay: 1.5,
  /** Largest frame interval used for easing, so a stall never snaps the camera. */
  maxFrameTime: 0.1,
} as const;

/** Desired polar angle for an altitude above the surface, in metres. */
export function chasePolar(altitude: number): number {
  const t = THREE.MathUtils.clamp(
    (altitude - CHASE.lowAltitude) / (CHASE.highAltitude - CHASE.lowAltitude),
    0,
    1,
  );
  return THREE.MathUtils.lerp(CHASE.lowPolar, CHASE.highPolar, t);
}

/** Exponential approach toward a target angle along the shorter way round the circle. */
export function easeAngle(current: number, target: number, dt: number, time: number): number {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + difference * (1 - Math.exp(-dt / time));
}

/**
 * Keeps a camera behind the vehicle's heading and level with the horizon.
 * Translation follows exactly; azimuth and elevation ease, so yaw and altitude
 * changes are smooth. While the player orbits (and briefly after), only
 * translation applies. Zoom distance is the player's and is never reset.
 */
export class ChaseRig {
  readonly #camera: THREE.PerspectiveCamera;
  readonly #target: THREE.Vector3;
  readonly #offset = new THREE.Vector3();
  readonly #spherical = new THREE.Spherical();
  #heading = 0;
  #sinceUser = Infinity;
  #userActive = false;

  /** `target` is the orbit target shared with pointer controls; the rig moves it. */
  constructor(camera: THREE.PerspectiveCamera, target: THREE.Vector3) {
    this.#camera = camera;
    this.#target = target;
  }

  /** Call when the player starts or stops orbiting. */
  setUserActive(active: boolean): void {
    this.#userActive = active;
    this.#sinceUser = 0;
  }

  /** Places the camera at the chase position immediately, with the default distance. */
  snap(vehicle: THREE.Object3D, altitude: number): void {
    this.#updateHeading(vehicle.quaternion);
    this.#target.copy(vehicle.position);
    this.#spherical.set(CHASE.distance, chasePolar(altitude), this.#heading);
    this.#camera.position.setFromSpherical(this.#spherical).add(this.#target);
    this.#camera.lookAt(this.#target);
  }

  /** Advances the rig by `dt` seconds of presentation time for the drawn vehicle. */
  update(vehicle: THREE.Object3D, altitude: number, dt: number): void {
    const step = THREE.MathUtils.clamp(dt, 0, CHASE.maxFrameTime);
    this.#updateHeading(vehicle.quaternion);
    // Translate camera and target together: the vehicle never slides off screen.
    this.#offset.subVectors(vehicle.position, this.#target);
    this.#camera.position.add(this.#offset);
    this.#target.copy(vehicle.position);
    if (this.#userActive) return;
    this.#sinceUser += step;
    if (this.#sinceUser < CHASE.returnDelay) return;
    this.#offset.subVectors(this.#camera.position, this.#target);
    this.#spherical.setFromVector3(this.#offset);
    // Spherical theta is measured from +Z toward +X; behind the vehicle is theta = heading.
    this.#spherical.theta = easeAngle(
      this.#spherical.theta,
      this.#heading,
      step,
      CHASE.azimuthTime,
    );
    this.#spherical.phi +=
      (chasePolar(altitude) - this.#spherical.phi) * (1 - Math.exp(-step / CHASE.polarTime));
    this.#camera.position.setFromSpherical(this.#spherical).add(this.#target);
  }

  // Inverted exactly, heading is undefined; hold the last value instead of snapping to 0.
  #updateHeading(q: THREE.Quaternion): void {
    if (Math.hypot(q.y, q.w) > 1e-3) this.#heading = headingAngle(q);
  }
}
