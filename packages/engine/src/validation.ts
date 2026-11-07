import type { Quaternion, Vector3 } from './pose';

export function finite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

export function positive(value: number, name: string): void {
  finite(value, name);
  if (value <= 0) throw new RangeError(`${name} must be positive`);
}

export function vector(value: Vector3, name: string): void {
  finite(value.x, name);
  finite(value.y, name);
  finite(value.z, name);
}

export function unitQuaternion(q: Quaternion): void {
  vector(q, 'orientation');
  finite(q.w, 'orientation');
  if (Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) > 1e-6) {
    throw new RangeError('orientation must be a normalized quaternion');
  }
}

export function bounded(value: number, min: number, max: number, name: string): void {
  finite(value, name);
  if (value < min || value > max) throw new RangeError(`${name} is outside [${min}, ${max}]`);
}
