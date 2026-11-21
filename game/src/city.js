// city.js — Bahía Perla: a sun-soaked coastal grid city.
// Streets run on a regular pitch; blocks hold pastel low-poly buildings,
// palms line the avenues, and the south edge is sand, sea, a pier, a ferris
// wheel and a casino. All placement is seeded, so replays match.

import * as THREE from 'three';
import { randRange, randInt, randPick, clamp } from './random.js';

export const PITCH = 58; // block + street
export const BLOCK = 44;
export const STREET = 14;
export const GRID_N = 5; // blocks from -5..4 on each axis
export const CITY_HALF = GRID_N * PITCH + STREET / 2; // ~297
export const BEACH_Z = 4 * PITCH; // blocks with bz >= 4 are sand
export const SEA_Z = BEACH_Z + 70;

const BUILDING_COLORS = [
  0xf2c9a0, 0xf7d774, 0xf4a988, 0xa8d8c8, 0x9ec8e8,
  0xe8a0b4, 0xd8c8f0, 0xf0e0c0, 0xc8e0a0, 0xe8b48c,
];
const ROOF_COLORS = [0x8a5a3c, 0x6a4a3a, 0x9a7a5a, 0x7a6a8a, 0x5a7a6a];

function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color })
  );
  m.position.set(x, y, z);
  return m;
}

export function streetCenter(k) {
  return k * PITCH;
}

export function isOnStreet(x, z) {
  const half = STREET / 2 + 1;
  const nearX = Math.abs(((x + PITCH / 2) % PITCH + PITCH) % PITCH - PITCH / 2) <= half;
  const nearZ = Math.abs(((z + PITCH / 2) % PITCH + PITCH) % PITCH - PITCH / 2) <= half;
  return (nearX || nearZ) && Math.abs(x) <= CITY_HALF && Math.abs(z) <= CITY_HALF;
}

// Circle (x, z, r) vs building AABBs. Returns the first hit or null.
export function hitBuilding(city, x, z, r) {
  for (const c of city.colliders) {
    const dx = Math.max(Math.abs(x - c.x) - c.hw, 0);
    const dz = Math.max(Math.abs(z - c.z) - c.hd, 0);
    if (dx * dx + dz * dz < r * r) return c;
  }
  return null;
}

// Push a circle out of a building AABB; returns corrected {x, z}.
export function resolveBuilding(city, x, z, r) {
  const c = hitBuilding(city, x, z, r);
  if (!c) return { x, z, hit: false };
  const dx = x - c.x;
  const dz = z - c.z;
  const px = c.hw + r - Math.abs(dx);
  const pz = c.hd + r - Math.abs(dz);
  if (px < pz) {
    x = c.x + (dx >= 0 ? c.hw + r : -(c.hw + r));
  } else {
    z = c.z + (dz >= 0 ? c.hd + r : -(c.hd + r));
  }
  return { x, z, hit: true };
}

export function buildCity(scene, rng) {
  const city = {
    colliders: [],
    palms: [],
    spawn: { x: 12, z: 14 },
    plaza: { x: 0, z: 0 },
    pier: { x: 0, z: SEA_Z + 20 },
    wheel: { x: 58, z: BEACH_Z + 34 },
    casino: { x: -116, z: 174 },
    landmarks: [],
  };
  const group = new THREE.Group();
  group.name = 'city';

  // Ground: big grass-concrete slab, then asphalt street strips.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 260, CITY_HALF * 2 + 260),
    new THREE.MeshLambertMaterial({ color: 0x9a9a7a })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 40);
  group.add(ground);

  // Sand band + sea.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 260, 90),
    new THREE.MeshLambertMaterial({ color: 0xe8d8a8 })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.05, BEACH_Z + 45);
  group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 400, 400),
    new THREE.MeshLambertMaterial({ color: 0x2a7a9a })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.02, SEA_Z + 180);
  group.add(sea);

  // Street strips (asphalt) + sidewalk strips, both axes.
  const asphalt = new THREE.MeshLambertMaterial({ color: 0x3a3a40 });
  const walk = new THREE.MeshLambertMaterial({ color: 0xb8b0a0 });
  for (let k = -GRID_N; k <= GRID_N; k++) {
    const c = streetCenter(k);
    const len = CITY_HALF * 2 + 40;
    const sx = new THREE.Mesh(new THREE.PlaneGeometry(len, STREET), asphalt);
    sx.rotation.x = -Math.PI / 2;
    sx.position.set(0, 0.08, c);
    group.add(sx);
    const sz = new THREE.Mesh(new THREE.PlaneGeometry(STREET, len), asphalt);
    sz.rotation.x = -Math.PI / 2;
    sz.position.set(c, 0.08, 0);
    group.add(sz);
    const wx = new THREE.Mesh(new THREE.PlaneGeometry(len, 4), walk);
    wx.rotation.x = -Math.PI / 2;
    wx.position.set(0, 0.06, c - STREET / 2 - 2);
    group.add(wx);
    const wx2 = wx.clone();
    wx2.position.z = c + STREET / 2 + 2;
    group.add(wx2);
  }

  // Buildings, one or two per block (never on the plaza block or the beach).
  for (let bx = -GRID_N; bx < GRID_N; bx++) {
    for (let bz = -GRID_N; bz < GRID_N; bz++) {
      if (bx === 0 && bz === 0) continue; // central plaza
      if (bz >= 4) continue; // beach blocks stay open
      const cx = bx * PITCH + PITCH / 2;
      const cz = bz * PITCH + PITCH / 2;
      const n = randInt(rng, 1, 2);
      for (let i = 0; i < n; i++) {
        const w = randRange(rng, 12, 22);
        const d = randRange(rng, 12, 22);
        const h = randRange(rng, 8, 38);
        const ox = (i === 0 ? -1 : 1) * randRange(rng, 2, 9);
        const oz = (i === 0 ? -1 : 1) * randRange(rng, 2, 9);
        const x = cx + ox;
        const z = cz + oz;
        const color = randPick(rng, BUILDING_COLORS);
        const b = box(w, h, d, color, x, h / 2, z);
        group.add(b);
        const roof = box(w + 1, 1.2, d + 1, randPick(rng, ROOF_COLORS), x, h + 0.6, z);
        group.add(roof);
        // Lit windows: a few small bright boxes on the sunset side.
        const winCount = Math.floor(h / 6);
        for (let wi = 0; wi < winCount; wi++) {
          const wy = 3 + wi * 6 + randRange(rng, 0, 2);
          if (wy > h - 2) break;
          const win = box(1.6, 1.6, 0.3, 0xffd880, x + w / 2 + 0.1, wy, z + randRange(rng, -d / 3, d / 3));
          group.add(win);
        }
        city.colliders.push({ x, z, hw: w / 2 + 0.4, hd: d / 2 + 0.4 });
      }
    }
  }
  return { city, group };
}

// Palms, pier, ferris wheel, casino and plaza — appended after the grid.
export function buildLandmarks(scene, city, rng) {
  const group = new THREE.Group();
  group.name = 'landmarks';

  function palm(x, z, s) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35 * s, 0.55 * s, 7 * s, 6),
      new THREE.MeshLambertMaterial({ color: 0x8a6a4a })
    );
    trunk.position.y = 3.5 * s;
    trunk.rotation.z = 0.08;
    g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.9 * s, 3.4 * s, 4),
        new THREE.MeshLambertMaterial({ color: 0x3a9a4a })
      );
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.4 * s, 7 * s, Math.sin(a) * 1.4 * s);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    group.add(g);
    city.palms.push({ x, z });
    return g;
  }

  // Palms along every avenue, both sides, plus a beach row.
  for (let k = -GRID_N; k <= GRID_N; k++) {
    for (let b = -GRID_N; b < GRID_N; b++) {
      const c = streetCenter(k);
      const along = b * PITCH + PITCH / 2;
      if (rng() < 0.55) palm(c + STREET / 2 + 4.5, along, randRange(rng, 0.9, 1.3));
      if (rng() < 0.55) palm(along, c + STREET / 2 + 4.5, randRange(rng, 0.9, 1.3));
    }
  }
  for (let i = 0; i < 14; i++) {
    palm(-CITY_HALF + 20 + i * 44 + randRange(rng, -6, 6), BEACH_Z + 18 + randRange(rng, -4, 8), randRange(rng, 1.0, 1.4));
  }

  // Central plaza: fountain + low wall ring, spawn sits on its edge.
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 8, 1.4, 12),
    new THREE.MeshLambertMaterial({ color: 0x7a9ab0 })
  );
  fountain.position.set(0, 0.7, 0);
  group.add(fountain);
  const jet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 1.2, 3.4, 8),
    new THREE.MeshLambertMaterial({ color: 0xc8e8f8 })
  );
  jet.position.set(0, 2.4, 0);
  group.add(jet);
  city.colliders.push({ x: 0, z: 0, hw: 8.4, hd: 8.4 });
  city.landmarks.push({ name: 'Plaza Perla', x: 0, z: 0 });

  // Pier: wooden deck out into the sea with lamp posts.
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(12, 1, 90),
    new THREE.MeshLambertMaterial({ color: 0x8a6a42 })
  );
  deck.position.set(city.pier.x, 1.2, city.pier.z);
  group.add(deck);
  for (let i = 0; i < 6; i++) {
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 4.4, 6),
      new THREE.MeshLambertMaterial({ color: 0x3a3a3a })
    );
    lamp.position.set(city.pier.x + 5, 3.4, city.pier.z - 36 + i * 15);
    group.add(lamp);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe8a0 })
    );
    bulb.position.set(city.pier.x + 5, 5.8, city.pier.z - 36 + i * 15);
    group.add(bulb);
  }
  city.landmarks.push({ name: 'Muelle Perla', x: city.pier.x, z: city.pier.z });

  // Ferris wheel: two rims, spokes, cabins; spins slowly in render.
  const wheel = new THREE.Group();
  wheel.position.set(city.wheel.x, 26, city.wheel.z);
  const rimMat = new THREE.MeshLambertMaterial({ color: 0xe85a7a });
  const rim1 = new THREE.Mesh(new THREE.TorusGeometry(16, 0.7, 8, 28), rimMat);
  wheel.add(rim1);
  const rim2 = rim1.clone();
  rim2.position.z = 3;
  wheel.add(rim2);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 32, 6), rimMat);
    spoke.rotation.z = a;
    wheel.add(spoke);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 2.4, 2.4),
      new THREE.MeshLambertMaterial({ color: [0xffd880, 0x7ac8e8, 0xe88ab0, 0xa8e8a0][i % 4] })
    );
    cabin.position.set(Math.cos(a) * 16, Math.sin(a) * 16, 1.5);
    wheel.add(cabin);
  }
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 26, 6), new THREE.MeshLambertMaterial({ color: 0x666666 }));
  legL.position.set(-8, 13, 1.5);
  legL.rotation.z = 0.32;
  wheel.add(legL);
  const legR = legL.clone();
  legR.position.x = 8;
  legR.rotation.z = -0.32;
  wheel.add(legR);
  wheel.userData.spin = true;
  group.add(wheel);
  city.wheelMesh = wheel;
  city.colliders.push({ x: city.wheel.x, z: city.wheel.z, hw: 4, hd: 4 });
  city.landmarks.push({ name: 'Rueda del Sol', x: city.wheel.x, z: city.wheel.z });

  // Casino Perla: tall slab with a glowing sign box.
  const casino = new THREE.Mesh(
    new THREE.BoxGeometry(30, 46, 24),
    new THREE.MeshLambertMaterial({ color: 0xc8a0e8 })
  );
  casino.position.set(city.casino.x, 23, city.casino.z);
  group.add(casino);
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(20, 4, 1),
    new THREE.MeshBasicMaterial({ color: 0xffd880 })
  );
  sign.position.set(city.casino.x, 42, city.casino.z + 12.6);
  group.add(sign);
  city.colliders.push({ x: city.casino.x, z: city.casino.z, hw: 15.4, hd: 12.4 });
  city.landmarks.push({ name: 'Casino Perla', x: city.casino.x, z: city.casino.z });

  scene.add(group);
  return group;
}

export function addCityToScene(scene, built) {
  scene.add(built.group);
}
