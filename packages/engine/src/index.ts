/** Pure flight dynamics under uniform or central-body gravity, in fixed or rotating frames, two-body orbits and on-rails coasting, with surface contact, touchdown judging, body-rate assistance, orientation helpers, and shared vector and angle math. @module */
export type { Vector3, Quaternion, VehiclePose } from './pose';
export {
  stepFlight,
  MAX_FLIGHT_STEP,
  CONTACT_SUBSTEP,
  type FlightState,
  type FlightCommand,
  type VehicleParameters,
  type FlightEnvironment,
} from './flight';
export {
  gravityAcceleration,
  rotatingFrameAcceleration,
  type CentralGravity,
  type FrameRotation,
  type GravityField,
  type UniformGravity,
} from './gravity';
export {
  bodyFixedEnvironment,
  bodyFixedToInertial,
  bodyFixedToSurface,
  bodyFixedToSurfaceFrame,
  inertialEnvironment,
  inertialToBodyFixed,
  MOON,
  surfaceEnvironment,
  surfaceFrame,
  surfaceFrameToBodyFixed,
  surfaceToBodyFixed,
  type BodyEnvironment,
  type CelestialBody,
  type SurfaceFrame,
  type SurfacePosition,
} from './frames';
export { coastAttitude } from './rotation';
export {
  coastOnRails,
  orbitFromState,
  orbitOf,
  propagateKepler,
  stateFromOrbit,
  timeToAltitude,
  timeToRadius,
  type Orbit,
  type OrbitalElements,
  type OrbitalState,
  type OrbitFrame,
} from './orbits';
export { rateControlTorque, type AttitudeSettings } from './attitude';
export { bodyToWorld, headingAngle, tiltAngle } from './orientation';
export {
  add,
  addScaled,
  addScaledQuaternion,
  clamp,
  conjugate,
  cross,
  dot,
  magnitude,
  modulo,
  multiplyQuaternions,
  normalizeQuaternion,
  rotationAbout,
  scale,
  signedAngle,
  subtract,
  toDegrees,
  toRadians,
} from './math';
export {
  classifyTouchdown,
  NO_TOUCHDOWN,
  updateTouchdown,
  type TouchdownCheck,
  type TouchdownLimits,
  type TouchdownOutcome,
  type TouchdownRecord,
  type TouchdownSnapshot,
  type TouchdownTick,
} from './touchdown';
export {
  contactFacts,
  FRICTION_SLIP_SCALE,
  type ContactFact,
  type ContactMotion,
  type ContactPoint,
  type FlatSurface,
  type Surface,
} from './contact';
