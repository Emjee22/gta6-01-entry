// Bahía Perla — the city itself. All geometry is generated from a seed so the
// layout is stable: a street grid on the north half, beach + sea on the south,
// a canal cutting east-west with two bridges, a pier and lighthouse on the
// west point, a ferris wheel and casino on the east boardwalk.
import * as THREE from '../vendor/three.module.min.js';
import { makeRng, clamp } from './random.js';

export const CITY = {
  half: 340,          // city extends -340..340 on x and z
  beachZ: 150,        // z > beachZ is sand, then sea
  seaZ: 215,          // z > seaZ is water
  canalZ: -40,        // canal centre line
  canalHalf: 9,
  roadGap: 46,        // street spacing
};

const BUILDING_COLORS = [0x8a7f72, 0xa89a86, 0x6f7d8c, 0xb5a284, 0x7d6a5f, 0x9c8f7a, 0x5f6e7a, 0xc0b49a];
const ROOF_COLORS = [0x4a3f35, 0x6b4a3a, 0x3d4a55, 0x54423a];
const PALETTE = {
  asphalt: 0x3a3d42, sidewalk: 0x9a938a, sand: 0xd9c193, sea: 0x1d6f8e,
  canal: 0x2a7d9e, grass: 0x5d8a4a, pier: 0x7a5c40, white: 0xf2ede2,
};

function box(w, h, d, color, x, y, z, opts = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color, emissive: opts.emissive || 0x000000 })
  );
  m.position.set(x, y, z);
  if (opts.ry) m.rotation.y = opts.ry;
  m.castShadow = !!opts.shadow;
  m.receiveShadow = true;
  return m;
}

function cyl(rt, rb, h, color, x, y, z, seg = 12) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(rt, rb, h, seg),
    new THREE.MeshLambertMaterial({ color })
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function buildCity(scene, seed = 20261120) {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  group.name = 'city';
  const colliders = []; // {x, z, r} circles the player/car cannot pass through
  const roads = [];     // road centre lines for traffic + spawn points

  // --- ground: grass north, sand band, sea plane far south ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2, CITY.half * 2),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2, CITY.seaZ - CITY.beachZ + 40),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.06, (CITY.beachZ + CITY.seaZ + 40) / 2 - 10);
  sand.receiveShadow = true;
  group.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2 + 600, 500),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea, transparent: true, opacity: 0.92 })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.12, CITY.seaZ + 240);
  group.add(sea);

  // Canal: a recessed water strip east-west across the city.
  const canal = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2, CITY.canalHalf * 2),
    new THREE.MeshLambertMaterial({ color: PALETTE.canal })
  );
  canal.rotation.x = -Math.PI / 2;
  canal.position.set(0, 0.05, CITY.canalZ);
  group.add(canal);

  // --- streets: grid of asphalt strips with sidewalk edges ---
  const streetXs = [];
  for (let x = -CITY.half + 40; x <= CITY.half - 40; x += CITY.roadGap) streetXs.push(x);
  const streetZs = [];
  for (let z = -CITY.half + 40; z <= CITY.beachZ - 30; z += CITY.roadGap) {
    if (Math.abs(z - CITY.canalZ) < CITY.canalHalf + 12) continue; // canal gap
    streetZs.push(z);
  }
  for (const x of streetXs) {
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(11, CITY.half * 2),
      new THREE.MeshLambertMaterial({ color: PALETTE.asphalt })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.08, 0);
    road.receiveShadow = true;
    group.add(road);
    roads.push({ axis: 'x', at: x });
    // centre dashes
    for (let z = -CITY.half + 20; z < CITY.half - 20; z += 14) {
      if (Math.abs(z - CITY.canalZ) < 16) continue;
      group.add(box(0.5, 0.05, 4, 0xd8c94a, x, 0.12, z));
    }
  }
  for (const z of streetZs) {
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY.half * 2, 11),
      new THREE.MeshLambertMaterial({ color: PALETTE.asphalt })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.08, z);
    road.receiveShadow = true;
    group.add(road);
    roads.push({ axis: 'z', at: z });
  }

  // --- canal bridges (two, so traffic can cross) ---
  for (const bx of [-92, 92]) {
    const deck = box(26, 1.2, 26, 0x8d8578, bx, 0.7, CITY.canalZ, { shadow: true });
    group.add(deck);
    group.add(box(26, 1.0, 1.2, 0x6b5a44, bx, 1.6, CITY.canalZ - 12));
    group.add(box(26, 1.0, 1.2, 0x6b5a44, bx, 1.6, CITY.canalZ + 12));
  }

  // --- buildings: fill the blocks between streets ---
  const blocks = [];
  for (let i = 0; i < streetXs.length - 1; i++) {
    for (let j = 0; j < streetZs.length - 1; j++) {
      const x0 = streetXs[i] + 8, x1 = streetXs[i + 1] - 8;
      const z0 = streetZs[j] + 8, z1 = streetZs[j + 1] - 8;
      if (x1 - x0 < 12 || z1 - z0 < 12) continue;
      if (Math.abs((z0 + z1) / 2 - CITY.canalZ) < 26) continue;
      blocks.push({ x0, x1, z0, z1 });
    }
  }
  for (const b of blocks) {
    const n = rng.int(1, 3);
    for (let k = 0; k < n; k++) {
      const w = rng.range(10, Math.min(24, (b.x1 - b.x0) * 0.8));
      const d = rng.range(10, Math.min(24, (b.z1 - b.z0) * 0.8));
      const h = rng.range(7, 34);
      const x = rng.range(b.x0 + w / 2, b.x1 - w / 2);
      const z = rng.range(b.z0 + d / 2, b.z1 - d / 2);
      const color = rng.pick(BUILDING_COLORS);
      const bld = box(w, h, d, color, x, h / 2, z, { shadow: true });
      group.add(bld);
      const roof = box(w * 0.92, 0.8, d * 0.92, rng.pick(ROOF_COLORS), x, h + 0.4, z);
      group.add(roof);
      // lit windows: small emissive planes on the two street faces
      const winRows = Math.max(1, Math.floor(h / 6));
      for (let r = 0; r < winRows; r++) {
        for (let c = 0; c < Math.floor(w / 5); c++) {
          if (!rng.chance(0.4)) continue;
          const lit = rng.chance(0.55);
          const win = new THREE.Mesh(
            new THREE.PlaneGeometry(1.4, 1.8),
            new THREE.MeshBasicMaterial({ color: lit ? 0xffd98a : 0x2c3540 })
          );
          win.position.set(x - w / 2 + 2.5 + c * 5, 3 + r * 6, z + d / 2 + 0.06);
          group.add(win);
        }
      }
      // Collider stays inside the block so it never spills onto a street:
      // a car parked or driving on the road must never start inside a collider.
      const clearR = Math.min(x - b.x0, b.x1 - x, z - b.z0, b.z1 - z);
      colliders.push({ x, z, r: Math.min(Math.max(w, d) * 0.62, clearR) });
    }
  }
  // --- landmarks: lighthouse + pier (west), ferris wheel + casino + hotel (east) ---
  // Lighthouse on the western point, striped tower + beacon light.
  const lhX = -CITY.half + 34, lhZ = CITY.beachZ + 26;
  const tower = cyl(4.5, 6, 42, 0xf2ede2, lhX, 21, lhZ, 14);
  group.add(tower);
  group.add(cyl(5.2, 5.2, 3, 0xc23b2e, lhX, 10, lhZ, 14));
  group.add(cyl(5.0, 5.0, 3, 0xc23b2e, lhX, 30, lhZ, 14));
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 })
  );
  beacon.position.set(lhX, 44, lhZ);
  beacon.name = 'beacon';
  group.add(beacon);
  const beaconLight = new THREE.PointLight(0xffd98a, 900, 160, 1.6);
  beaconLight.position.set(lhX, 44, lhZ);
  beaconLight.name = 'beaconLight';
  group.add(beaconLight);
  colliders.push({ x: lhX, z: lhZ, r: 8 });

  // Pier: wooden deck running south into the sea from the lighthouse.
  for (let i = 0; i < 16; i++) {
    group.add(box(10, 0.8, 7, PALETTE.pier, lhX + 40, 1.2, CITY.beachZ + 30 + i * 7));
  }
  for (const px of [lhX + 35.5, lhX + 44.5]) {
    for (let i = 0; i < 16; i += 2) {
      group.add(cyl(0.5, 0.5, 3.4, 0x5d4630, px, 0.4, CITY.beachZ + 30 + i * 7, 6));
    }
  }

  // Ferris wheel on the east boardwalk.
  const fwX = CITY.half - 60, fwZ = CITY.beachZ - 6;
  const wheel = new THREE.Group();
  wheel.position.set(fwX, 26, fwZ);
  wheel.name = 'ferrisWheel';
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(20, 0.9, 8, 28),
    new THREE.MeshLambertMaterial({ color: 0xd94f3d })
  );
  wheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(1, 39, 1),
      new THREE.MeshLambertMaterial({ color: 0xe8e2d2 })
    );
    spoke.position.set(Math.cos(a) * 0, 0, 0);
    spoke.rotation.z = a;
    spoke.position.x = 0;
    wheel.add(spoke);
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(4, 3.4, 3.4),
      new THREE.MeshLambertMaterial({ color: [0x3d7ea6, 0xd9a03d, 0x7aa653, 0xb05a7a][i % 4] })
    );
    cab.position.set(Math.cos(a) * 20, Math.sin(a) * 20, 0);
    wheel.add(cab);
  }
  group.add(wheel);
  group.add(cyl(1.4, 1.8, 26, 0x8d8578, fwX, 13, fwZ - 4, 8));
  group.add(cyl(1.4, 1.8, 26, 0x8d8578, fwX, 13, fwZ + 4, 8));
  colliders.push({ x: fwX, z: fwZ, r: 6 });

  // Casino Perla + Hotel Miramar: big signed blocks on the boardwalk.
  function signedBlock(x, z, w, h, d, color, lines, signColor) {
    const b = box(w, h, d, color, x, h / 2, z, { shadow: true });
    group.add(b);
    const sign = box(w * 0.8, 4.4, 0.7, signColor, x, h + 1.2, z + d / 2 + 0.4, { emissive: signColor });
    sign.name = 'sign:' + lines.join('|');
    group.add(sign);
    const txt = document.createElement('canvas');
    txt.width = 512; txt.height = 64;
    const g2 = txt.getContext('2d');
    g2.fillStyle = '#111111'; g2.fillRect(0, 0, 512, 64);
    g2.fillStyle = '#ffe9a8'; g2.font = 'bold 34px sans-serif';
    g2.textAlign = 'center'; g2.textBaseline = 'middle';
    g2.fillText(lines.join('  •  '), 256, 34);
    const tex = new THREE.CanvasTexture(txt);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.78, 4.1),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    face.position.set(x, h + 1.2, z + d / 2 + 0.8);
    group.add(face);
    colliders.push({ x, z, r: Math.max(w, d) * 0.62 });
    return b;
  }
  signedBlock(150, CITY.beachZ - 34, 52, 22, 26, 0x7a2e4a, ['CASINO PERLA'], 0x2a0a1e);
  signedBlock(210, CITY.beachZ - 34, 40, 30, 24, 0x3d5a7a, ['HOTEL MIRAMAR'], 0x0e2233);

  // Palms on the open sand, well south of the promenade road and foot paths.
  for (let x = -CITY.half + 30; x < CITY.half - 20; x += 26) {
    if (rng.chance(0.25)) continue;
    const px = x + rng.range(-4, 4), pz = CITY.beachZ + 26 + rng.range(-3, 3);
    const trunk = cyl(0.5, 0.8, 9, 0x6b4a2f, px, 4.5, pz, 7);
    trunk.rotation.z = rng.range(-0.08, 0.08);
    group.add(trunk);
    for (let f = 0; f < 5; f++) {
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(1.1, 5.5, 5),
        new THREE.MeshLambertMaterial({ color: 0x3f7a34 })
      );
      const a = (f / 5) * Math.PI * 2;
      leaf.position.set(px + Math.cos(a) * 2.2, 9.4, pz + Math.sin(a) * 2.2);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      group.add(leaf);
    }
  }

  // Street lamps along the main roads.
  for (const x of streetXs) {
    for (let z = -CITY.half + 60; z < CITY.beachZ - 40; z += 92) {
      group.add(cyl(0.18, 0.24, 8, 0x2e3238, x + 6, 4, z, 6));
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffe9a8 })
      );
      lamp.position.set(x + 6, 8.2, z);
      group.add(lamp);
    }
  }

  // Dusk sky: big gradient dome + low sun + warm fog.
  const skyGeo = new THREE.SphereGeometry(900, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      top: { value: new THREE.Color(0x2a3a6e) },
      mid: { value: new THREE.Color(0xe8734a) },
      bot: { value: new THREE.Color(0x3a2a4a) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot;' +
      'void main(){ float h = normalize(vP).y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.65, h)) : mix(bot, mid, smoothstep(-0.08, 0.12, h)); gl_FragColor = vec4(c, 1.0); }',
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.name = 'sky';
  group.add(sky);
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(26, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0 })
  );
  sun.position.set(-260, 66, -560);
  sun.lookAt(0, 20, 0);
  group.add(sun);

  scene.add(group);
  return { group, colliders, roads, beacon, wheel, lighthouse: { x: lhX, z: lhZ } };
}

// Circle-collider test shared by player, cars and police.
export function collideCircle(colliders, x, z, r) {
  for (const c of colliders) {
    const dx = x - c.x, dz = z - c.z;
    const rr = c.r + r;
    if (dx * dx + dz * dz < rr * rr) return c;
  }
  return null;
}

export function onRoad(roads, x, z, tol = 8) {
  for (const r of roads) {
    if (r.axis === 'x' && Math.abs(x - r.at) < tol) return true;
    if (r.axis === 'z' && Math.abs(z - r.at) < tol) return true;
  }
  return false;
}
