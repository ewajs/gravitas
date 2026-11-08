// Seeded integer hashing and gradient noise for procedural detail. Integer
// arithmetic only (Math.imul and shifts), so a seed gives the same lattice in
// every JavaScript engine; the noise itself uses only + − × and floor.

/** Final avalanche of MurmurHash3: spreads every input bit over the 32-bit result. */
function mix(value: number): number {
  let h = value | 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** A well-mixed unsigned 32-bit hash of three integer coordinates and a seed. */
export function hash3(x: number, y: number, z: number, seed: number): number {
  return mix(
    Math.imul(x | 0, 0x8da6b343) ^
      Math.imul(y | 0, 0xd8163841) ^
      Math.imul(z | 0, 0xcb1ab31f) ^
      Math.imul(seed | 0, 0x27d4eb2f),
  );
}

/** The next hash in a sequence drawn from one cell: hash, then rehash(hash, 1), (hash, 2)… */
export function rehash(hash: number, index: number): number {
  return mix(hash + Math.imul(index, 0x9e3779b9));
}

/** A hash mapped to [0, 1). */
export function unitInterval(hash: number): number {
  return hash / 4294967296;
}

/** A value and its gradient; the noise functions write into one to avoid allocating. */
export interface NoiseSample {
  value: number;
  gx: number;
  gy: number;
  gz: number;
}

/** A fresh, zeroed sample to reuse across calls. */
export function noiseSample(): NoiseSample {
  return { value: 0, gx: 0, gy: 0, gz: 0 };
}

// Ken Perlin's twelve edge directions of a cube, padded to sixteen by repeating
// four (as in his improved noise) so a corner picks one with its hash's top bits.
const GX = Float64Array.of(1, -1, 1, -1, 1, -1, 1, -1, 0, 0, 0, 0, 1, -1, 0, 0);
const GY = Float64Array.of(1, 1, -1, -1, 0, 0, 0, 0, 1, -1, 1, -1, 1, 1, -1, -1);
const GZ = Float64Array.of(0, 0, 0, 0, 1, 1, -1, -1, 1, 1, -1, -1, 0, 0, 1, -1);

/**
 * Perlin gradient noise at (x, y, z), in roughly [−1, 1], with its exact gradient
 * per unit of x, y, z. The quintic fade makes it twice continuously
 * differentiable, so surfaces built from it have smooth normals.
 */
export function gradientNoise(
  x: number,
  y: number,
  z: number,
  seed: number,
  out: NoiseSample,
): NoiseSample {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ga = hash3(ix, iy, iz, seed) >>> 28;
  const gb = hash3(ix + 1, iy, iz, seed) >>> 28;
  const gc = hash3(ix, iy + 1, iz, seed) >>> 28;
  const gd = hash3(ix + 1, iy + 1, iz, seed) >>> 28;
  const ge = hash3(ix, iy, iz + 1, seed) >>> 28;
  const gf = hash3(ix + 1, iy, iz + 1, seed) >>> 28;
  const gg = hash3(ix, iy + 1, iz + 1, seed) >>> 28;
  const gh = hash3(ix + 1, iy + 1, iz + 1, seed) >>> 28;
  // Each corner's gradient, and its dot product with the offset from that corner.
  const ax = GX[ga]!,
    ay = GY[ga]!,
    az = GZ[ga]!;
  const bx = GX[gb]!,
    by = GY[gb]!,
    bz = GZ[gb]!;
  const cx = GX[gc]!,
    cy = GY[gc]!,
    cz = GZ[gc]!;
  const dx = GX[gd]!,
    dy = GY[gd]!,
    dz = GZ[gd]!;
  const ex = GX[ge]!,
    ey = GY[ge]!,
    ez = GZ[ge]!;
  const gfx = GX[gf]!,
    gfy = GY[gf]!,
    gfz = GZ[gf]!;
  const ggx = GX[gg]!,
    ggy = GY[gg]!,
    ggz = GZ[gg]!;
  const hx = GX[gh]!,
    hy = GY[gh]!,
    hz = GZ[gh]!;
  const va = ax * fx + ay * fy + az * fz;
  const vb = bx * (fx - 1) + by * fy + bz * fz;
  const vc = cx * fx + cy * (fy - 1) + cz * fz;
  const vd = dx * (fx - 1) + dy * (fy - 1) + dz * fz;
  const ve = ex * fx + ey * fy + ez * (fz - 1);
  const vf = gfx * (fx - 1) + gfy * fy + gfz * (fz - 1);
  const vg = ggx * fx + ggy * (fy - 1) + ggz * (fz - 1);
  const vh = hx * (fx - 1) + hy * (fy - 1) + hz * (fz - 1);
  const u = fade(fx);
  const v = fade(fy);
  const w = fade(fz);
  const du = fadeSlope(fx);
  const dv = fadeSlope(fy);
  const dw = fadeSlope(fz);
  const k1 = vb - va;
  const k2 = vc - va;
  const k3 = ve - va;
  const k4 = va - vb - vc + vd;
  const k5 = va - vb - ve + vf;
  const k6 = va - vc - ve + vg;
  const k7 = -va + vb + vc - vd + ve - vf - vg + vh;
  out.value = va + u * k1 + v * k2 + w * k3 + u * v * k4 + u * w * k5 + v * w * k6 + u * v * w * k7;
  // Gradient: the corners' gradients blended by the same weights, plus the fades' slopes.
  const uv = u * v;
  const uw = u * w;
  const vw = v * w;
  const uvw = uv * w;
  out.gx =
    ax +
    u * (bx - ax) +
    v * (cx - ax) +
    w * (ex - ax) +
    uv * (ax - bx - cx + dx) +
    uw * (ax - bx - ex + gfx) +
    vw * (ax - cx - ex + ggx) +
    uvw * (-ax + bx + cx - dx + ex - gfx - ggx + hx) +
    du * (k1 + v * k4 + w * k5 + vw * k7);
  out.gy =
    ay +
    u * (by - ay) +
    v * (cy - ay) +
    w * (ey - ay) +
    uv * (ay - by - cy + dy) +
    uw * (ay - by - ey + gfy) +
    vw * (ay - cy - ey + ggy) +
    uvw * (-ay + by + cy - dy + ey - gfy - ggy + hy) +
    dv * (k2 + u * k4 + w * k6 + uw * k7);
  out.gz =
    az +
    u * (bz - az) +
    v * (cz - az) +
    w * (ez - az) +
    uv * (az - bz - cz + dz) +
    uw * (az - bz - ez + gfz) +
    vw * (az - cz - ez + ggz) +
    uvw * (-az + bz + cz - dz + ez - gfz - ggz + hz) +
    dw * (k3 + u * k5 + v * k6 + uv * k7);
  return out;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function fadeSlope(t: number): number {
  const s = t * (t - 1);
  return 30 * s * s;
}
