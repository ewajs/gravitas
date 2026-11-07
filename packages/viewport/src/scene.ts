import * as THREE from 'three/webgpu';

/** Flat ground at y = 0, matching the game's physics surface; decals sit just above. */
const SURFACE_Y = 0;
const PAD_RADIUS = 3.8;
/** Largest drawn leg compression, in metres; beyond it the hull is already touching. */
const MAX_DRAWN_COMPRESSION = 0.6;
const UP = new THREE.Vector3(0, 1, 0);

/** A foot pad and its struts, redrawn as the leg compresses. */
interface Leg {
  readonly foot: THREE.Mesh;
  readonly rest: THREE.Vector3;
  readonly struts: readonly { mesh: THREE.Mesh; start: THREE.Vector3; length: number }[];
}

// Small deterministic PRNG (mulberry32) for repeatable scenery.
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Builds illustrative metre-scale artwork, not a physical vehicle specification. */
export function createScene(centerOfMassHeight: number) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080c14);
  const materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const material = (color: number, metalness = 0, roughness = 0.8) => {
    const result = new THREE.MeshStandardNodeMaterial({ color, metalness, roughness });
    materials.push(result);
    return result;
  };
  const mesh = (
    geometry: THREE.BufferGeometry,
    surface: THREE.Material,
    parent: THREE.Object3D,
  ) => {
    geometries.push(geometry);
    const result = new THREE.Mesh(geometry, surface);
    result.castShadow = true;
    result.receiveShadow = true;
    parent.add(result);
    return result;
  };
  const gold = material(0xd2a650, 0.65, 0.42);
  const white = material(0xe5e7e5, 0.3, 0.4);
  const graphite = material(0x242c35, 0.4, 0.5);
  const silver = material(0x9aa6b3, 0.65, 0.3);
  const glass = material(0x102f42, 0.6, 0.2);
  const vehicle = new THREE.Group();
  scene.add(vehicle);
  // Pose transforms act at the centre of mass. The artwork remains authored from its feet.
  const artwork = new THREE.Group();
  artwork.position.y = -centerOfMassHeight;
  vehicle.add(artwork);
  vehicle.position.y = centerOfMassHeight;

  // The artwork's origin is the centre of its contact plane, with its front at -Z.
  mesh(new THREE.CylinderGeometry(0.82, 0.92, 0.75, 8), gold, artwork).position.y = 1.25;
  mesh(new THREE.CylinderGeometry(0.58, 0.74, 0.85, 8), white, artwork).position.y = 2.02;
  mesh(new THREE.CylinderGeometry(0.76, 0.76, 0.09, 8), graphite, artwork).position.y = 1.65;
  mesh(new THREE.CylinderGeometry(0.24, 0.4, 0.44, 12, 1, true), graphite, artwork).position.y =
    0.64;
  mesh(new THREE.BoxGeometry(0.62, 0.25, 0.05), glass, artwork).position.set(0, 2.1, -0.64);
  mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.55, 6), silver, artwork).position.set(
    0.35,
    2.7,
    0,
  );
  mesh(new THREE.SphereGeometry(0.055, 8, 6), white, artwork).position.set(0.35, 3, 0);

  // A strut spans from its body attachment to the foot; compression moves the foot end.
  const placeStrut = (
    strut: THREE.Mesh,
    start: THREE.Vector3,
    end: THREE.Vector3,
    rest: number,
  ) => {
    const direction = end.clone().sub(start);
    strut.position.copy(start).add(end).multiplyScalar(0.5);
    strut.scale.y = direction.length() / rest;
    strut.quaternion.setFromUnitVectors(UP, direction.normalize());
  };
  const legs: Leg[] = [];
  // Foot order: left-front, left-back, right-front, right-back (front is −Z).
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      const rest = new THREE.Vector3(x * 1.5, 0.04, z * 1.5);
      const foot = mesh(new THREE.CylinderGeometry(0.23, 0.3, 0.08, 8), graphite, artwork);
      foot.position.copy(rest);
      const struts = (
        [
          [new THREE.Vector3(x * 0.65, 1.4, z * 0.65), 0.045],
          [new THREE.Vector3(x * 0.72, 0.94, z * 0.72), 0.025],
        ] as const
      ).map(([start, radius]) => {
        const length = rest.distanceTo(start);
        const strut = mesh(new THREE.CylinderGeometry(radius, radius, length, 8), silver, artwork);
        placeStrut(strut, start, rest, length);
        return { mesh: strut, start, length };
      });
      legs.push({ foot, rest, struts });
    }
  }
  const footEnd = new THREE.Vector3();

  // Large enough to stay under the vehicle throughout a local descent.
  const ground = mesh(new THREE.CircleGeometry(600, 96), material(0x50555a), scene);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = SURFACE_Y;
  ground.castShadow = false;
  // The pad is flush with the ground, as in the physics; only its markings are raised.
  const pad = mesh(new THREE.CircleGeometry(PAD_RADIUS, 64), material(0x252d35), scene);
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = SURFACE_Y + 0.008;
  pad.castShadow = false;
  const ring = mesh(new THREE.RingGeometry(2.9, 3.15, 64), white, scene);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = SURFACE_Y + 0.014;
  ring.castShadow = false;
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const mark = mesh(new THREE.BoxGeometry(0.12, 0.006, 0.35), white, scene);
    mark.position.set(Math.sin(angle) * 3.45, SURFACE_Y + 0.014, Math.cos(angle) * 3.45);
    mark.rotation.y = angle;
  }
  // Seeded scatter: identical on every run and backend, dense near the pad for motion cues.
  const random = seeded(0x6a7a1);
  const placement = new THREE.Object3D();
  const scatter = (
    geometry: THREE.BufferGeometry,
    surface: THREE.Material,
    count: number,
    place: (index: number) => void,
  ) => {
    geometries.push(geometry);
    const field = new THREE.InstancedMesh(geometry, surface, count);
    for (let i = 0; i < count; i++) {
      place(i);
      placement.updateMatrix();
      field.setMatrixAt(i, placement.matrix);
    }
    field.receiveShadow = true;
    scene.add(field);
    return field;
  };
  // Inward-biased radius between `min` and `max` metres, at a random bearing.
  const around = (min: number, max: number) => {
    const radius = min + (max - min) * random() ** 2;
    const angle = random() * Math.PI * 2;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius] as const;
  };
  scatter(new THREE.DodecahedronGeometry(1, 0), material(0x6b7076), 360, () => {
    const [x, z] = around(8, 260);
    const size = 0.15 + random() ** 3 * 1.6;
    placement.position.set(x, SURFACE_Y + size * 0.25, z);
    placement.rotation.set(random() * 3, random() * 3, random() * 3);
    placement.scale.set(size * (1 + random() * 0.6), size * 0.6, size);
  });
  // Flat, non-overlapping crater decals, kept clear of the pad and its approach.
  const craters: [number, number, number][] = [];
  for (let attempt = 0; craters.length < 45 && attempt < 2000; attempt++) {
    const radius = 2 + random() ** 2 * 8;
    const distance = 30 + Math.sqrt(random()) * 260;
    const angle = random() * Math.PI * 2;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    if (craters.every(([cx, cz, cr]) => Math.hypot(cx - x, cz - z) > cr + radius + 4)) {
      craters.push([x, z, radius]);
    }
  }
  const flat = (geometry: THREE.BufferGeometry, color: number, lift: number) =>
    scatter(geometry, material(color), craters.length, (i) => {
      const [x, z, radius] = craters[i]!;
      placement.position.set(x, SURFACE_Y + lift, z);
      placement.rotation.set(-Math.PI / 2, 0, 0);
      placement.scale.set(radius, radius, 1);
    });
  flat(new THREE.CircleGeometry(1, 40), 0x474b50, 0.02);
  flat(new THREE.RingGeometry(0.86, 1, 40), 0x6c7177, 0.03);

  // Marker straight below the vehicle: reads height and drift where shadows cannot reach.
  // Blue, so it never reads as the white pad ring.
  const markerMaterial = new THREE.MeshBasicNodeMaterial({
    color: 0x9fd4ff,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  materials.push(markerMaterial);
  const marker = mesh(new THREE.RingGeometry(1.55, 1.8, 48), markerMaterial, scene);
  marker.rotation.x = -Math.PI / 2;
  marker.castShadow = marker.receiveShadow = false;
  const dropMaterial = new THREE.LineBasicNodeMaterial({
    color: 0x9fd4ff,
    transparent: true,
    opacity: 0.3,
  });
  materials.push(dropMaterial);
  const dropGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, -1, 0),
  ]);
  geometries.push(dropGeometry);
  const drop = new THREE.Line(dropGeometry, dropMaterial);
  scene.add(drop);

  const sun = new THREE.DirectionalLight(0xfff1d8, 4);
  sun.position.set(-8, 14, -6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 35 });
  sun.shadow.normalBias = 0.03;
  scene.add(sun, new THREE.AmbientLight(0xc9d8f0, 0.4));

  return {
    scene,
    vehicle,
    /** Moves the below-vehicle marker; `altitude` is the feet's height above y = 0. */
    updateMarker(position: THREE.Vector3, altitude: number) {
      const surface = SURFACE_Y + 0.02;
      marker.position.set(position.x, surface, position.z);
      drop.position.copy(position);
      drop.scale.y = Math.max(0.001, position.y - surface);
      drop.visible = altitude > 1;
    },
    /** Raises each foot by its compression (metres, foot order) and re-aims its struts. */
    setLegCompression(compressions: readonly number[]) {
      legs.forEach((leg, i) => {
        const lift = Math.min(MAX_DRAWN_COMPRESSION, compressions[i] ?? 0);
        footEnd.copy(leg.rest).addScaledVector(UP, lift);
        leg.foot.position.copy(footEnd);
        for (const strut of leg.struts) placeStrut(strut.mesh, strut.start, footEnd, strut.length);
      });
    },
    dispose() {
      sun.shadow.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const surface of materials) surface.dispose();
      scene.clear();
    },
  };
}
