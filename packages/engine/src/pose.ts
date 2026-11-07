/** Three components, with units and reference frame specified by the consuming field. */
export interface Vector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Unit quaternion rotating body coordinates into the right-handed Y-up world. */
export interface Quaternion extends Vector3 {
  readonly w: number;
}

/** Centre-of-mass position and body-to-world orientation; never a mesh transform owner. */
export interface VehiclePose {
  /** Centre of mass in world metres; +Y is up and the ground plane is XZ. */
  readonly position: Vector3;
  /** Unit quaternion rotating vehicle-local coordinates into world coordinates. */
  readonly orientation: Quaternion;
}
