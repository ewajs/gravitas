/** Pure flight dynamics with surface contact, body-rate assistance, and orientation helpers. @module */
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
export { bodyToWorld, headingAngle } from './orientation';
export {
  contactFacts,
  FRICTION_SLIP_SCALE,
  type ContactFact,
  type ContactMotion,
  type ContactPoint,
  type FlatSurface,
  type Surface,
} from './contact';
