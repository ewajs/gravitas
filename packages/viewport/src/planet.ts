import * as THREE from 'three/webgpu';
import { float, smoothstep, uv, vec2 } from 'three/tsl';
import { terrainHeight, type Quaternion, type Terrain, type Vector3 } from '@gravitas/engine';
import { createTerrainTiles, type TerrainStats, type TerrainTiles } from './terrain';

// The planetary half of the scene (ADR 0020): a body with a colour map, stars,
// and a map view with the orbit. The chase scene draws the body in the host's
// vehicle-centred world; the map scene is its own world, the body-fixed frame,
// so the map never turns as the vehicle moves.

/** A spherical body to draw. */
export interface PlanetView {
  /** Reference-sphere radius in metres. */
  readonly radius: number;
  /**
   * URL of an equirectangular colour map: longitude −180° at the left edge, 0° in
   * the middle, north at the top. Drawn grey until it loads.
   */
  readonly surfaceMap?: string;
  /**
   * The body's ground (from the engine's createTerrain). With it, the chase view
   * draws tiles meshed from the same height function the vehicle touches, finer
   * near the camera (ADR 0022); the map keeps a smooth sphere.
   */
  readonly terrain?: Terrain;
}

/** Where the body is in the host's world: its centre, and its body-fixed axes. */
export interface PlanetPose {
  /** Body centre in world metres. */
  readonly centre: Vector3;
  /** Unit quaternion rotating body-fixed coordinates into world coordinates. */
  readonly orientation: Quaternion;
}

/** An orbit to draw in the map view, in body-fixed metres. */
export interface OrbitPath {
  /** Points along the orbit, in order. */
  readonly points: readonly Vector3[];
  /** True for a closed ellipse; false for an arc that ends (escape, or into the ground). */
  readonly closed: boolean;
  /** Lowest point, marked when given. */
  readonly periapsis?: Vector3;
  /** Highest point, marked when given (bound orbits). */
  readonly apoapsis?: Vector3;
}

/** Colours for the map's marks, as CSS `#rrggbb`. */
export interface MapAccents {
  readonly orbit: string;
  readonly vehicle: string;
}

// Sphere tessellation: 256 × 128 keeps the silhouette within about 130 m of the
// true sphere at lunar size, invisible from orbit. With terrain, tiles replace it
// in the chase view once the coarsest are meshed; the map keeps it.
const SEGMENTS = [256, 128] as const;
const STAR_COUNT = 2400;
// Stars sit on a shell around each camera, inside its far plane.
const CHASE_STAR_SHELL = 1e7;
const MAP_STAR_SHELL = 4e7;
/** Map-view marker size as a fraction of the viewport height. */
const MARKER_SIZE = 0.028;

// Small deterministic PRNG (mulberry32), so the sky is the same on every run.
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

/** Seeded star directions on the unit sphere with brightness as grey vertex colour. */
export function starGeometry(count = STAR_COUNT): THREE.BufferGeometry {
  const random = seeded(0x57a25);
  const positions = new Float32Array(count * 3);
  const colours = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Uniform on the sphere: z uniform in [−1, 1], angle uniform.
    const z = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const ring = Math.sqrt(1 - z * z);
    positions.set([ring * Math.cos(angle), z, ring * Math.sin(angle)], i * 3);
    // Most stars faint, a few bright; a slight warm or cool tint.
    const brightness = 0.25 + 0.75 * random() ** 4;
    const tint = random() - 0.5;
    colours.set(
      [brightness * (1 + tint * 0.15), brightness, brightness * (1 - tint * 0.15)],
      i * 3,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return geometry;
}

// A round dot or ring drawn by a screen-sized sprite.
function markerMaterial(colour: string, ring: boolean): THREE.SpriteNodeMaterial {
  const material = new THREE.SpriteNodeMaterial({
    color: colour,
    transparent: true,
    depthTest: false,
    sizeAttenuation: false,
  });
  const distance = uv().distance(vec2(0.5));
  const outer = float(1).sub(smoothstep(0.42, 0.5, distance));
  material.opacityNode = ring ? outer.mul(smoothstep(0.26, 0.34, distance)) : outer;
  return material;
}

/**
 * Builds the body, stars, and map; hidden until the host shows a planet. `sky` is
 * the chase scene's background colour, shared so both views match.
 */
export function createPlanet(sky: THREE.Color) {
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const track = <T extends THREE.Material>(material: T) => {
    materials.push(material);
    return material;
  };

  // One unit sphere scaled to the radius. Three's UVs put u = 0.5 at +X and
  // u = 0.75 at −Z, which is longitude 0 and 90° east in the engine's body-fixed
  // frame, with v = 1 at +Y (north): the colour map needs no extra rotation.
  const sphere = new THREE.SphereGeometry(1, SEGMENTS[0], SEGMENTS[1]);
  geometries.push(sphere);
  const surface = track(
    new THREE.MeshStandardNodeMaterial({ color: 0x8a8a8a, roughness: 1, metalness: 0 }),
  );
  let texture: THREE.Texture | undefined;
  let textureUrl: string | undefined;

  const chaseBody = new THREE.Mesh(sphere, surface);
  chaseBody.receiveShadow = false;
  chaseBody.castShadow = false;
  const chaseGroup = new THREE.Group();
  chaseGroup.add(chaseBody);
  chaseGroup.visible = false;

  const stars = starGeometry();
  geometries.push(stars);
  const starMaterial = track(
    new THREE.PointsNodeMaterial({ vertexColors: true, depthWrite: false, sizeAttenuation: false }),
  );
  const chaseStars = new THREE.Points(stars, starMaterial);
  chaseStars.scale.setScalar(CHASE_STAR_SHELL);
  chaseStars.frustumCulled = false;
  chaseStars.renderOrder = -1;
  chaseGroup.add(chaseStars);

  // The map: its own world, the body-fixed frame (north up, the body at the origin).
  const map = new THREE.Scene();
  map.background = sky;
  const mapBody = new THREE.Mesh(sphere, surface);
  map.add(mapBody);
  const mapStars = new THREE.Points(stars, starMaterial);
  mapStars.scale.setScalar(MAP_STAR_SHELL);
  mapStars.frustumCulled = false;
  map.add(mapStars);
  const mapSun = new THREE.DirectionalLight(0xfff1d8, 4);
  map.add(mapSun, mapSun.target, new THREE.AmbientLight(0xc9d8f0, 0.06));
  const orbitMaterial = track(
    new THREE.LineBasicNodeMaterial({ color: '#4cc3e0', transparent: true, opacity: 0.9 }),
  );
  let orbitLine: THREE.Line | undefined;
  const vehicleMarker = new THREE.Sprite(track(markerMaterial('#9fd4ff', false)));
  const periapsisMarker = new THREE.Sprite(track(markerMaterial('#4cc3e0', true)));
  const apoapsisMarker = new THREE.Sprite(track(markerMaterial('#4cc3e0', true)));
  for (const marker of [vehicleMarker, periapsisMarker, apoapsisMarker]) {
    marker.scale.setScalar(MARKER_SIZE);
    marker.renderOrder = 2;
    marker.visible = false;
    map.add(marker);
  }

  let tiles: TerrainTiles | undefined;
  const frustum = new THREE.Frustum();
  const projection = new THREE.Matrix4();
  const bounds = new THREE.Sphere();
  let terrainStats: TerrainStats | null = null;

  // Unit normal of the drawn orbit's plane, or zero without one; aims the map camera.
  const orbitNormal = new THREE.Vector3();
  const inverse = new THREE.Quaternion();
  const scratch = new THREE.Vector3();
  let radius = 0;

  return {
    /** Added to the chase scene: the body and its stars. */
    chaseGroup,
    /** The map view's scene, in body-fixed metres. */
    map,
    get radius() {
      return radius;
    },
    get visible() {
      return chaseGroup.visible;
    },

    /** Shows a body (or hides it with null). Loading the colour map is asynchronous. */
    show(view: PlanetView | null) {
      chaseGroup.visible = view !== null;
      if (!view) return;
      radius = view.radius;
      chaseBody.scale.setScalar(radius);
      mapBody.scale.setScalar(radius);
      if (view.terrain !== tiles?.terrain) {
        tiles?.dispose();
        tiles?.group.removeFromParent();
        tiles = view.terrain ? createTerrainTiles(view.terrain, surface) : undefined;
        terrainStats = null;
        chaseBody.visible = true;
        if (tiles) {
          tiles.group.position.copy(chaseBody.position);
          tiles.group.quaternion.copy(chaseBody.quaternion);
          chaseGroup.add(tiles.group);
        }
      }
      if (view.surfaceMap && view.surfaceMap !== textureUrl) {
        textureUrl = view.surfaceMap;
        new THREE.TextureLoader().load(view.surfaceMap, (loaded) => {
          if (textureUrl !== view.surfaceMap) return loaded.dispose();
          loaded.colorSpace = THREE.SRGBColorSpace;
          loaded.anisotropy = 4;
          texture?.dispose();
          texture = loaded;
          surface.map = loaded;
          surface.color.set(0xffffff);
          surface.needsUpdate = true;
        });
      }
    },

    /** Places the body in the chase world. */
    setPose(pose: PlanetPose) {
      chaseBody.position.set(pose.centre.x, pose.centre.y, pose.centre.z);
      chaseBody.quaternion.set(
        pose.orientation.x,
        pose.orientation.y,
        pose.orientation.z,
        pose.orientation.w,
      );
      inverse.copy(chaseBody.quaternion).invert();
      tiles?.group.position.copy(chaseBody.position);
      tiles?.group.quaternion.copy(chaseBody.quaternion);
    },

    /**
     * Chooses and requests terrain tiles for the chase camera at `cameraWorld`. The
     * smooth sphere stands in until the coarsest tiles are ready.
     */
    updateTerrain(camera: THREE.Camera) {
      if (!tiles) return;
      camera.updateMatrixWorld();
      frustum.setFromProjectionMatrix(
        projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
      );
      tiles.group.updateMatrixWorld();
      const inView = (centre: Vector3, bound: number) => {
        bounds.center.set(centre.x, centre.y, centre.z).applyMatrix4(tiles!.group.matrixWorld);
        bounds.radius = bound;
        return frustum.intersectsSphere(bounds);
      };
      scratch.copy(camera.position).sub(chaseBody.position).applyQuaternion(inverse);
      terrainStats = tiles.update(scratch, inView);
      chaseBody.visible = !tiles.ready;
    },

    /** The last terrain update's counts, or null without terrain. */
    get terrainStats(): TerrainStats | null {
      return terrainStats;
    },

    /**
     * Height of a chase-world point above the ground straight below it: the
     * terrain when shown, else the reference sphere.
     */
    heightAboveGround(worldPosition: THREE.Vector3): number {
      scratch.copy(worldPosition).sub(chaseBody.position).applyQuaternion(inverse);
      const distance = scratch.length();
      const ground = tiles ? terrainHeight(tiles.terrain, scratch) : 0;
      return distance - radius - ground;
    },

    /** Unit vector from the body's centre through a chase-world point (local up). */
    upAt(worldPosition: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
      return out.copy(worldPosition).sub(chaseBody.position).normalize();
    },

    /** Keeps each star shell centred on its camera, so stars are infinitely far. */
    followCameras(chase: THREE.Camera, mapCamera: THREE.Camera) {
      chaseStars.position.copy(chase.position).sub(chaseGroup.position);
      mapStars.position.copy(mapCamera.position);
    },

    /** Points the map's sunlight; `worldDirection` is toward the Sun in the chase world. */
    setSun(worldDirection: THREE.Vector3) {
      scratch.copy(worldDirection).applyQuaternion(inverse);
      mapSun.position.copy(scratch).multiplyScalar(radius * 4);
    },

    /** Marks the vehicle on the map from its chase-world position. */
    setVehicle(worldPosition: THREE.Vector3) {
      scratch.copy(worldPosition).sub(chaseBody.position).applyQuaternion(inverse);
      vehicleMarker.position.copy(scratch);
      vehicleMarker.visible = true;
    },

    /** The vehicle's map position, for aiming the map camera. */
    vehicleOnMap(): THREE.Vector3 {
      return vehicleMarker.position;
    },

    /** Unit normal of the drawn orbit, or a zero vector without an orbit. */
    orbitNormal(): THREE.Vector3 {
      return orbitNormal;
    },

    /** Draws an orbit on the map, or removes it with null. */
    setOrbit(path: OrbitPath | null) {
      if (orbitLine) {
        map.remove(orbitLine);
        orbitLine.geometry.dispose();
        orbitLine = undefined;
      }
      periapsisMarker.visible = !!path?.periapsis;
      apoapsisMarker.visible = !!path?.apoapsis;
      orbitNormal.set(0, 0, 0);
      if (!path) return;
      if (path.periapsis) periapsisMarker.position.copy(path.periapsis);
      if (path.apoapsis) apoapsisMarker.position.copy(path.apoapsis);
      // WebGPU has no line loops: a closed orbit repeats its first point at the end.
      const points = path.points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
      if (path.closed) points.push(points[0]!.clone());
      // The plane's normal from two points a quarter of the path apart (body centre at 0).
      const quarter = points[Math.floor(path.points.length / 4)]!;
      orbitNormal.crossVectors(points[0]!, quarter);
      if (orbitNormal.lengthSq() > 0) orbitNormal.normalize();
      orbitLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), orbitMaterial);
      orbitLine.frustumCulled = false;
      orbitLine.renderOrder = 1;
      map.add(orbitLine);
    },

    /** Recolours the orbit and markers. */
    setAccents(accents: MapAccents) {
      orbitMaterial.color.set(accents.orbit);
      for (const marker of [periapsisMarker, apoapsisMarker]) {
        (marker.material as THREE.SpriteNodeMaterial).color.set(accents.orbit);
      }
      (vehicleMarker.material as THREE.SpriteNodeMaterial).color.set(accents.vehicle);
    },

    /** The current orbit line, for tests. */
    get orbitLine() {
      return orbitLine;
    },

    dispose() {
      tiles?.dispose();
      tiles = undefined;
      orbitLine?.geometry.dispose();
      texture?.dispose();
      textureUrl = undefined;
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      map.clear();
      chaseGroup.clear();
    },
  };
}
