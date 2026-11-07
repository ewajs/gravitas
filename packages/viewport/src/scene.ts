import * as THREE from 'three/webgpu';

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

  const strut = (start: THREE.Vector3, end: THREE.Vector3, radius: number) => {
    const direction = end.clone().sub(start);
    const leg = mesh(
      new THREE.CylinderGeometry(radius, radius, direction.length(), 8),
      silver,
      artwork,
    );
    leg.position.copy(start).add(end).multiplyScalar(0.5);
    leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  };
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      const foot = new THREE.Vector3(x * 1.5, 0.04, z * 1.5);
      mesh(new THREE.CylinderGeometry(0.23, 0.3, 0.08, 8), graphite, artwork).position.copy(foot);
      strut(new THREE.Vector3(x * 0.65, 1.4, z * 0.65), foot, 0.045);
      strut(new THREE.Vector3(x * 0.72, 0.94, z * 0.72), foot, 0.025);
    }
  }

  // Large enough to stay under the vehicle throughout a local descent.
  const ground = mesh(new THREE.CircleGeometry(600, 96), material(0x50555a), scene);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.17;
  ground.castShadow = false;
  const pad = mesh(new THREE.CylinderGeometry(3.8, 3.9, 0.16, 64), material(0x252d35), scene);
  pad.position.y = -0.08;
  const ring = mesh(new THREE.RingGeometry(3.05, 3.11, 64), white, scene);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.003;
  ring.castShadow = false;
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const mark = mesh(new THREE.BoxGeometry(0.12, 0.006, 0.35), white, scene);
    mark.position.set(Math.sin(angle) * 3.45, 0.004, Math.cos(angle) * 3.45);
    mark.rotation.y = angle;
  }
  // Fixed rocks give depth cues without a terrain generator or randomness.
  for (const [x, z, size] of [
    [-8, 3, 0.7],
    [6, 7, 0.4],
    [-12, -9, 1.1],
    [9, -6, 0.6],
  ] as const) {
    const rock = mesh(new THREE.DodecahedronGeometry(size, 0), ground.material, scene);
    rock.scale.set(1.4, 0.65, 1);
    rock.position.set(x, size * 0.3 - 0.17, z);
    rock.rotation.set(0.2, x, 0.1);
  }

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
    dispose() {
      sun.shadow.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const surface of materials) surface.dispose();
      scene.clear();
    },
  };
}
