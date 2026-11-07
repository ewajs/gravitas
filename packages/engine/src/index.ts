/** Pure flight dynamics with surface contact, touchdown judging, body-rate assistance, orientation helpers, and shared vector and angle math. @module */
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
