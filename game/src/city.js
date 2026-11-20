// Perla Bay: the city itself.
//
// A sun-soaked coastal city at golden hour, built from low-poly boxes and
// instanced props. The layout is a road grid with a beach and an ocean on
// the south edge, a pier, a ferris wheel, a casino and a canal bridge. All
// textures are painted on offscreen canvases at runtime, so the game loads
// no image file and makes no network request.
//
// Coordinates: x east, z south. The city spans -240..240 on both axes.
// Roads run every 48 units. The beach is z 200..240, the ocean z > 240.
import * as THREE from 'three';
import { createRandom } from './random.js';

export const CITY_HALF = 240;
export const ROAD_STEP = 48;
export const ROAD_WIDTH = 10;
export const ROAD_COORDS = [-192, -144, -96, -48, 0, 48, 96, 144, 192];
export const BEACH_Z = 200;
export const OCEAN_Z = 240;

const PASTEL = [
  0xf2a65a, 0xe87e7e, 0x7fb8a8, 0xf5d98a, 0xc9a7d8, 0x8fb8dd,
  0xf0b8c8, 0x9ac98f, 0xe8c39a, 0x7fa8c9, 0xd98a7a, 0xb8c98a,
];

// Paint a small canvas and return it as a texture. Windows are lit at
// random so the facades feel lived-in at dusk.
function windowTexture(rng, baseColor, litRatio) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = baseColor;
  g.fillRect(0, 0, 128, 256);
  const cols = 4;
  const rows = 8;
  const w = 128 / cols;
  const h = 256 / rows;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lit = rng.next() < litRatio;
      g.fillStyle = lit ? '#ffd98a' : '#2c3550';
      g.fillRect(c * w + 5, r * h + 7, w - 10, h - 14);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function colorHex(num) {
  return `#${num.toString(16).padStart(6, '0')}`;
}

function makeGround(scene) {
  // The city base: warm asphalt-grey, big enough to reach the fog.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  // Sidewalk slabs: a lighter ring around every block, drawn as one plane
  // per road band so the count stays low.
  const walkMat = new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 1 });
  for (const c of ROAD_COORDS) {
    const stripX = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH + 8, CITY_HALF * 2), walkMat);
    stripX.rotation.x = -Math.PI / 2;
    stripX.position.set(c, 0.02, 0);
    stripX.receiveShadow = true;
    scene.add(stripX);
    const stripZ = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2, ROAD_WIDTH + 8), walkMat);
    stripZ.rotation.x = -Math.PI / 2;
    stripZ.position.set(0, 0.02, c);
    stripZ.receiveShadow = true;
    scene.add(stripZ);
  }
}

function makeRoads(scene) {
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2e2e36, roughness: 0.95 });
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xd8c86a, roughness: 0.8 });
  for (const c of ROAD_COORDS) {
    const roadX = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, CITY_HALF * 2), roadMat);
    roadX.rotation.x = -Math.PI / 2;
    roadX.position.set(c, 0.05, 0);
    roadX.receiveShadow = true;
    scene.add(roadX);
    const roadZ = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2, ROAD_WIDTH), roadMat);
    roadZ.rotation.x = -Math.PI / 2;
    roadZ.position.set(0, 0.05, c);
    roadZ.receiveShadow = true;
    scene.add(roadZ);
  }

  // Center dashes, instanced: one draw call for the whole grid.
  const dashGeo = new THREE.BoxGeometry(0.5, 0.06, 3);
  const positions = [];
  for (const c of ROAD_COORDS) {
    for (let v = -CITY_HALF + 12; v < CITY_HALF - 6; v += 12) {
      positions.push({ x: c, z: v, rotY: 0 });
      positions.push({ x: v, z: c, rotY: Math.PI / 2 });
    }
  }
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, positions.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();
  positions.forEach((d, i) => {
    e.set(0, d.rotY, 0);
    q.setFromEuler(e);
    p.set(d.x, 0.08, d.z);
    m.compose(p, q, s);
    dashes.setMatrixAt(i, m);
  });
  dashes.instanceMatrix.needsUpdate = true;
  dashes.receiveShadow = true;
  scene.add(dashes);
}

function makeBeachAndOcean(scene, rng) {
  // Sand: a warm strip along the south edge.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 80, OCEAN_Z - BEACH_Z + 4),
    new THREE.MeshStandardMaterial({ color: 0xe8c98f, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.06, BEACH_Z + (OCEAN_Z - BEACH_Z) / 2);
  sand.receiveShadow = true;
  scene.add(sand);

  // Ocean: a big plane with a painted wave texture, slightly glossy.
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = '#2a6f9e';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,0.25)';
  g.lineWidth = 2;
  for (let i = 0; i < 40; i += 1) {
    const y = rng.range(0, 256);
    const x = rng.range(0, 256);
    const len = rng.range(14, 42);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + len, y);
    g.stroke();
  }
  const waveTex = new THREE.CanvasTexture(canvas);
  waveTex.wrapS = THREE.RepeatWrapping;
  waveTex.wrapT = THREE.RepeatWrapping;
  waveTex.repeat.set(10, 6);
  waveTex.colorSpace = THREE.SRGBColorSpace;
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 700),
    new THREE.MeshStandardMaterial({ map: waveTex, color: 0x9ec8e8, roughness: 0.35, metalness: 0.1 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.0, OCEAN_Z + 350);
  scene.add(ocean);
}

function makeBuildings(scene, rng, colliders) {
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x5a5468, roughness: 1 });
  const texCache = new Map();
  function facadeMat(colorNum) {
    if (!texCache.has(colorNum)) {
      const tex = windowTexture(rng, colorHex(colorNum), 0.35);
      texCache.set(colorNum, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    }
    return texCache.get(colorNum);
  }

  // One building per block corner, kept off the roads and off the beach.
  for (let ix = 0; ix < ROAD_COORDS.length - 1; ix += 1) {
    for (let iz = 0; iz < ROAD_COORDS.length - 1; iz += 1) {
      const x0 = ROAD_COORDS[ix] + ROAD_WIDTH / 2 + 4;
      const x1 = ROAD_COORDS[ix + 1] - ROAD_WIDTH / 2 - 4;
      const z0 = ROAD_COORDS[iz] + ROAD_WIDTH / 2 + 4;
      const z1 = ROAD_COORDS[iz + 1] - ROAD_WIDTH / 2 - 4;
      if (z0 > BEACH_Z - 8) continue;
      if (!rng.chance(0.85)) continue;
      const count = rng.int(1, 2);
      for (let b = 0; b < count; b += 1) {
        const w = rng.range(12, Math.max(13, (x1 - x0) / count - 2));
        const d = rng.range(12, Math.max(13, z1 - z0 - 2));
        const cx = x0 + ((x1 - x0) / count) * (b + 0.5) + rng.range(-2, 2);
        const cz = (z0 + z1) / 2 + rng.range(-3, 3);
        const distCenter = Math.hypot(cx, cz);
        const h = rng.range(8, distCenter < 90 ? 42 : 22);
        const color = rng.pick(PASTEL);
        const side = facadeMat(color);
        const mesh = new THREE.Mesh(boxGeo, [side, side, roofMat, roofMat, side, side]);
        mesh.scale.set(w, h, d);
        mesh.position.set(cx, h / 2, cz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
        // A rooftop box on taller buildings, for a skyline that is not flat.
        if (h > 20 && rng.chance(0.6)) {
          const roof = new THREE.Mesh(boxGeo, roofMat);
          roof.scale.set(rng.range(3, 6), rng.range(2, 4), rng.range(3, 6));
          roof.position.set(cx + rng.range(-3, 3), h + roof.scale.y / 2, cz + rng.range(-3, 3));
          roof.castShadow = true;
          scene.add(roof);
        }
      }
    }
  }
}

function makePalmsAndLamps(scene, rng) {
  // Palms: instanced trunks and crowns, scattered along sidewalks and sand.
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 7, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1 });
  const crownGeo = new THREE.ConeGeometry(3.2, 4.5, 7);
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x3f8f4f, roughness: 1 });
  const spots = [];
  for (let i = 0; i < 110; i += 1) {
    let x;
    let z;
    if (rng.chance(0.45)) {
      // Along the beach.
      x = rng.range(-CITY_HALF + 10, CITY_HALF - 10);
      z = rng.range(BEACH_Z + 2, OCEAN_Z - 4);
    } else {
      // Beside a road.
      const c = rng.pick(ROAD_COORDS);
      x = c + (rng.chance(0.5) ? 1 : -1) * (ROAD_WIDTH / 2 + 3);
      z = rng.range(-CITY_HALF + 10, BEACH_Z - 6);
      if (rng.chance(0.5)) {
        const tmp = x;
        x = z;
        z = tmp;
      }
    }
    spots.push({ x, z, lean: rng.range(-0.12, 0.12), rot: rng.range(0, Math.PI * 2), s: rng.range(0.8, 1.3) });
  }
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  spots.forEach((pt, i) => {
    e.set(pt.lean, pt.rot, 0);
    q.setFromEuler(e);
    s.set(pt.s, pt.s, pt.s);
    p.set(pt.x, 3.5 * pt.s, pt.z);
    m.compose(p, q, s);
    trunks.setMatrixAt(i, m);
    p.set(pt.x, 7.6 * pt.s, pt.z);
    m.compose(p, q, s);
    crowns.setMatrixAt(i, m);
  });
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  trunks.castShadow = true;
  crowns.castShadow = true;
  scene.add(trunks);
  scene.add(crowns);

  // Street lamps: instanced poles with warm glowing heads.
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.18, 6, 5);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3a44, roughness: 0.7, metalness: 0.4 });
  const headGeo = new THREE.SphereGeometry(0.35, 8, 6);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb050, emissiveIntensity: 0.9 });
  const lampSpots = [];
  for (const c of ROAD_COORDS) {
    for (let v = -CITY_HALF + 24; v < CITY_HALF; v += 48) {
      lampSpots.push({ x: c + ROAD_WIDTH / 2 + 2, z: v });
      lampSpots.push({ x: v, z: c + ROAD_WIDTH / 2 + 2 });
    }
  }
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampSpots.length);
  const heads = new THREE.InstancedMesh(headGeo, headMat, lampSpots.length);
  lampSpots.forEach((pt, i) => {
    e.set(0, 0, 0);
    q.setFromEuler(e);
    s.set(1, 1, 1);
    p.set(pt.x, 3, pt.z);
    m.compose(p, q, s);
    poles.setMatrixAt(i, m);
    p.set(pt.x, 6.1, pt.z);
    m.compose(p, q, s);
    heads.setMatrixAt(i, m);
  });
  poles.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  scene.add(poles);
  scene.add(heads);
}

function makePier(scene) {
  // A wooden pier reaching south into the ocean, with a hut at its end.
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(8, 0.8, 90), wood);
  deck.position.set(120, 1.2, OCEAN_Z + 45);
  deck.castShadow = true;
  deck.receiveShadow = true;
  scene.add(deck);
  const postGeo = new THREE.CylinderGeometry(0.4, 0.4, 3, 6);
  for (let z = OCEAN_Z + 4; z < OCEAN_Z + 90; z += 12) {
    for (const dx of [-3.4, 3.4]) {
      const post = new THREE.Mesh(postGeo, wood);
      post.position.set(120 + dx, 0.4, z);
      scene.add(post);
    }
  }
  const hut = new THREE.Mesh(
    new THREE.BoxGeometry(7, 5, 6),
    new THREE.MeshStandardMaterial({ color: 0xe8b8a0, roughness: 0.9 }),
  );
  hut.position.set(120, 4.5, OCEAN_Z + 82);
  hut.castShadow = true;
  scene.add(hut);
  const hutRoof = new THREE.Mesh(
    new THREE.ConeGeometry(5.5, 3, 4),
    new THREE.MeshStandardMaterial({ color: 0xc96a5a, roughness: 0.9 }),
  );
  hutRoof.position.set(120, 8.4, OCEAN_Z + 82);
  hutRoof.rotation.y = Math.PI / 4;
  hutRoof.castShadow = true;
  scene.add(hutRoof);
}

function makeFerrisWheel(scene) {
  // The wheel by the beach: a ring, spokes, cabins, and a support frame.
  // Only the wheel itself turns; the legs stay put.
  const group = new THREE.Group();
  group.position.set(-120, 0, BEACH_Z + 6);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xf0e8d8, roughness: 0.6, metalness: 0.3 });
  const wheel = new THREE.Group();
  wheel.position.y = 20;
  group.add(wheel);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(16, 0.7, 8, 40), frameMat);
  ring.castShadow = true;
  wheel.add(ring);
  const spokeGeo = new THREE.CylinderGeometry(0.3, 0.3, 32, 5);
  for (let i = 0; i < 4; i += 1) {
    const spoke = new THREE.Mesh(spokeGeo, frameMat);
    spoke.rotation.z = (i * Math.PI) / 4;
    wheel.add(spoke);
  }
  const cabinColors = [0xe87e7e, 0x7fb8a8, 0xf5d98a, 0x8fb8dd, 0xc9a7d8, 0x9ac98f];
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(3, 2.4, 2.4),
      new THREE.MeshStandardMaterial({ color: cabinColors[i % cabinColors.length], roughness: 0.7 }),
    );
    cabin.position.set(Math.cos(a) * 16, Math.sin(a) * 16, 0);
    cabin.castShadow = true;
    wheel.add(cabin);
  }
  const legGeo = new THREE.CylinderGeometry(0.6, 0.9, 22, 6);
  for (const dx of [-7, 7]) {
    const leg = new THREE.Mesh(legGeo, frameMat);
    leg.position.set(dx, 10, 0);
    leg.rotation.z = dx > 0 ? -0.32 : 0.32;
    leg.castShadow = true;
    group.add(leg);
  }
  scene.add(group);
  return { group, wheel };
}

function makeCasino(scene, colliders) {
  // Casino Perla: a wide low building with a glowing sign, on the corner
  // of the beach road. Its sign is our own text, painted on a canvas.
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(34, 14, 22),
    new THREE.MeshStandardMaterial({ color: 0x5a3a6a, roughness: 0.8 }),
  );
  base.position.set(150, 7, 168);
  base.castShadow = true;
  base.receiveShadow = true;
  scene.add(base);
  colliders.push({ minX: 133, maxX: 167, minZ: 157, maxZ: 179 });
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const g = canvas.getContext('2d');
  g.fillStyle = '#1a0f2a';
  g.fillRect(0, 0, 512, 96);
  g.fillStyle = '#ffb0d8';
  g.font = 'bold 56px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('CASINO PERLA', 256, 50);
  const signTex = new THREE.CanvasTexture(canvas);
  signTex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 5.6),
    new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.9 }),
  );
  sign.position.set(150, 12.5, 156.8);
  scene.add(sign);
  // A row of small glowing windows along the front.
  const winMat = new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffc050, emissiveIntensity: 0.7 });
  for (let i = 0; i < 8; i += 1) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 0.3), winMat);
    win.position.set(138 + i * 3.4, 5, 156.9);
    scene.add(win);
  }
}

function makeCanalAndBridge(scene, colliders) {
  // A canal along the west edge, with a bridge carrying the road over it.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(18, CITY_HALF * 2),
    new THREE.MeshStandardMaterial({ color: 0x2a6f9e, roughness: 0.3, metalness: 0.2 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(-CITY_HALF - 4, 0.04, 0);
  scene.add(water);
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(26, 1.2, ROAD_WIDTH + 6),
    new THREE.MeshStandardMaterial({ color: 0x9a8a78, roughness: 1 }),
  );
  deck.position.set(-CITY_HALF - 4, 1.4, 0);
  deck.castShadow = true;
  deck.receiveShadow = true;
  scene.add(deck);
  const railMat = new THREE.MeshStandardMaterial({ color: 0x6a6a72, roughness: 0.7, metalness: 0.4 });
  for (const dz of [-(ROAD_WIDTH / 2 + 2), ROAD_WIDTH / 2 + 2]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(26, 1.1, 0.4), railMat);
    rail.position.set(-CITY_HALF - 4, 2.5, dz);
    scene.add(rail);
  }
  colliders.push({ minX: -CITY_HALF - 14, maxX: -CITY_HALF + 6, minZ: -CITY_HALF, maxZ: -ROAD_WIDTH / 2 - 3 });
  colliders.push({ minX: -CITY_HALF - 14, maxX: -CITY_HALF + 6, minZ: ROAD_WIDTH / 2 + 3, maxZ: CITY_HALF });
}

function makeClouds(scene, rng) {
  // A few soft pink clouds drifting over the city.
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffd0d8, roughness: 1, transparent: true, opacity: 0.75,
  });
  const clouds = [];
  for (let i = 0; i < 9; i += 1) {
    const cloud = new THREE.Group();
    const puffs = rng.int(3, 5);
    for (let p = 0; p < puffs; p += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rng.range(6, 12), 8, 6), cloudMat);
      puff.scale.y = 0.45;
      puff.position.set(rng.range(-14, 14), rng.range(-1, 2), rng.range(-5, 5));
      cloud.add(puff);
    }
    cloud.position.set(rng.range(-300, 300), rng.range(90, 150), rng.range(-300, 200));
    scene.add(cloud);
    clouds.push(cloud);
  }
  return clouds;
}

// The road graph: intersections are nodes, road segments are edges.
// Traffic cars drive from node to node along it.
function buildRoadGraph() {
  const nodes = [];
  const indexOf = new Map();
  for (const z of ROAD_COORDS) {
    for (const x of ROAD_COORDS) {
      indexOf.set(`${x},${z}`, nodes.length);
      nodes.push({ x, z });
    }
  }
  const edges = [];
  const n = ROAD_COORDS.length;
  for (let iz = 0; iz < n; iz += 1) {
    for (let ix = 0; ix < n; ix += 1) {
      const id = iz * n + ix;
      if (ix + 1 < n) edges.push([id, id + 1]);
      if (iz + 1 < n) edges.push([id, id + n]);
    }
  }
  return { nodes, edges, indexOf };
}

export function buildCity(scene, seed) {
  const rng = createRandom(seed);
  const colliders = [];
  makeGround(scene);
  makeRoads(scene);
  makeBeachAndOcean(scene, rng);
  makeBuildings(scene, rng, colliders);
  makePalmsAndLamps(scene, rng);
  makePier(scene);
  const ferrisWheel = makeFerrisWheel(scene);
  makeCasino(scene, colliders);
  makeCanalAndBridge(scene, colliders);
  const clouds = makeClouds(scene, rng);
  const graph = buildRoadGraph();
  return {
    colliders,
    graph,
    ferrisWheel,
    clouds,
    // True when (x, z) is inside a building or another solid block.
    blocked(x, z) {
      for (const c of colliders) {
        if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) return true;
      }
      return false;
    },
    // Clamp a point to the drivable city, keeping it out of the ocean.
    clampToCity(x, z) {
      return {
        x: Math.max(-CITY_HALF + 6, Math.min(CITY_HALF - 6, x)),
        z: Math.max(-CITY_HALF + 6, Math.min(BEACH_Z - 2, z)),
      };
    },
  };
}
