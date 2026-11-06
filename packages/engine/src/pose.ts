/** Metres in a right-handed Y-up world and a normalized body-to-world quaternion. */
export interface VehiclePose {
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly orientation: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly w: number;
  };
}
