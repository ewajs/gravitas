/** Metres in a right-handed Y-up world and a normalized body-to-world quaternion. */
export interface VehiclePose {
  /** Vehicle origin in world metres; +Y is up and the ground plane is XZ. */
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  /** Unit quaternion rotating vehicle-local coordinates into world coordinates. */
  readonly orientation: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly w: number;
  };
}
