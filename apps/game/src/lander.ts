import type { AttitudeSettings, FlightEnvironment, VehicleParameters } from '@gravitas/engine';

/** Fictional first-flight vehicle; these tunable values are not historical Apollo specifications. */
export const LANDER: VehicleParameters = {
  dryMass: 1200,
  fuelCapacity: 300,
  maxThrust: 4500,
  exhaustVelocity: 3000,
  inertia: { x: 1800, y: 1200, z: 1800 },
  maxTorque: { x: 900, y: 600, z: 900 },
  // Thruster quads near the ascent-stage rim; storable-propellant performance.
  attitudeLeverArm: { x: 0.9, y: 0.9, z: 0.9 },
  attitudeExhaustVelocity: 2800,
};

/** Body-axis rate assist, independent of camera position and keyboard bindings. */
export const ATTITUDE: AttitudeSettings = {
  maxRate: { x: Math.PI / 6, y: Math.PI / 6, z: Math.PI / 6 },
  responseTime: 0.3,
};

/** Rounded constant lunar surface gravity for this local flight model. */
export const ENVIRONMENT: FlightEnvironment = { gravity: { x: 0, y: -1.62, z: 0 } };

/** Body centre of mass above the level foot-contact plane, in metres. */
export const CENTER_OF_MASS_HEIGHT = 1.5;
