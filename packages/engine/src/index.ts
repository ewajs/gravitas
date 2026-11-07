/** Pure flight dynamics under uniform or central-body gravity, in fixed or rotating frames, with surface contact, touchdown judging, body-rate assistance, orientation helpers, and shared vector and angle math. @module */
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
export { rateControlTorque, type AttitudeSettings } from './attitude';
export { bodyToWorld, headingAngle, tiltAngle } from './orientation';
export {
  add,
  addScaled,
  clamp,
  conjugate,
  cross,
  dot,
  magnitude,
  multiplyQuaternions,
  normalizeQuaternion,
  rotationAbout,
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
