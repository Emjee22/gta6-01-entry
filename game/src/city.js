// city.js — Bahía Perla: street grid, buildings, beach, sea, pier,
// ferris wheel, casino, canal, palms and streetlights.
// Colliders are circles clamped inside their own block, so no collider ever
// spills onto a street (a car can always drive the full grid).

import * as THREE from 'three';

export const CITY = {
  half: 340,
  streetStep: 46,
  roadWidth: 10,
  // Street centre-lines, 14 each way.
  streets: [-300, -254, -208, -162, -116, -70, -24, 22, 68, 114, 160, 206, 252, 298],
  beachZ: 300,
  seaZ: 340,
};

const BUILDING_COLORS = [
  0x8a6f5c, 0x6f7d8a, 0x9c8a6f, 0x7a6a8a, 0xa08a7a,
  0x5c7a6f, 0x8a7a5c, 0x6a5c7a, 0x94a08a, 0x7d8a94,
];

const ROOF_COLORS = [0x5a3a2a, 0x3a4a5a, 0x6a5a3a, 0x4a3a4a, 0x2a3a2a];

// A small canvas-texture label (our own words only) for landmark signs.
export function makeLabel(text, w, h, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = fg;
  g.font = 'bold 34px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: false }),
  );
  return mesh;
}

function groundPlane(w, d, color, x, z, y = 0) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = false;
  return m;
}

// Build the whole city into the scene. Returns colliders, parked spots and
// the animated landmarks (ferris wheel spins in the main loop).
export function buildCity(scene, rng) {
  const colliders = [];
  const parkedSpots = [];
  const group = new THREE.Group();
  scene.add(group);

  // Ground, roads, beach, sea.
  group.add(groundPlane(720, 720, 0x4a5240, 0, 0, -0.05));
  for (const s of CITY.streets) {
    group.add(groundPlane(700, CITY.roadWidth, 0x2e2e36, s, 0, 0));
    group.add(groundPlane(CITY.roadWidth, 700, 0x2e2e36, 0, s, 0));
  }
  // Beach sand south of the last street, sea beyond it.
  group.add(groundPlane(720, 44, 0xc2a878, 0, 320, 0.02));
  const sea = groundPlane(720, 380, 0x1e5a7a, 0, 530, 0.03);
  sea.material = new THREE.MeshStandardMaterial({ color: 0x1e5a7a, roughness: 0.35, metalness: 0.25 });
  group.add(sea);

  // Buildings: one or two per block, kept inside the block.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < CITY.streets.length - 1; i++) {
    for (let j = 0; j < CITY.streets.length - 1; j++) {
      const cx = (CITY.streets[i] + CITY.streets[i + 1]) / 2;
      const cz = (CITY.streets[j] + CITY.streets[j + 1]) / 2;
      // Skip the plaza block, the casino block and the canal strip.
      if (Math.abs(cx) < 30 && Math.abs(cz) < 30) continue;
      if (cx > 120 && cx < 180 && cz > -170 && cz < -110) continue;
      if (cx > 240) continue;
      if (cz > 285) continue;
      const n = rng.chance(0.55) ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const w = rng.range(14, 26);
        const d = rng.range(14, 26);
        const h = rng.range(8, 42);
        const ox = k === 0 ? rng.range(-6, -1) : rng.range(1, 6);
        const oz = k === 0 ? rng.range(-6, 0) : rng.range(0, 6);
        const mat = new THREE.MeshStandardMaterial({
          color: rng.pick(BUILDING_COLORS), roughness: 0.9, metalness: 0,
        });
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, d);
        b.position.set(cx + ox, h / 2, cz + oz);
        group.add(b);
        // Roof cap, slightly wider, darker.
        const roof = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({
          color: rng.pick(ROOF_COLORS), roughness: 1, metalness: 0,
        }));
        roof.scale.set(w + 0.6, 0.8, d + 0.6);
        roof.position.set(cx + ox, h + 0.4, cz + oz);
        group.add(roof);
        // Lit windows: a few small emissive planes on the street faces.
        if (rng.chance(0.6)) {
          const win = new THREE.Mesh(
            new THREE.PlaneGeometry(Math.min(8, w * 0.5), Math.min(4, h * 0.4)),
            new THREE.MeshBasicMaterial({ color: 0xffd27a }),
          );
          win.position.set(cx + ox, h * 0.55, cz + oz + d / 2 + 0.06);
          group.add(win);
        }
        // Collider radius stays inside the block (block half-width is 18).
        const r = Math.min(Math.max(w, d) * 0.55, 16);
        colliders.push({ x: cx + ox, z: cz + oz, r });
      }
    }
  }

  // Central plaza: fountain + benches at (0, 0).
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 8, 1.2, 20),
    new THREE.MeshStandardMaterial({ color: 0x7a8a9a, roughness: 0.6 }),
  );
  fountain.position.set(0, 0.6, 0);
  group.add(fountain);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6, 0.4, 20),
    new THREE.MeshStandardMaterial({ color: 0x2a7a9a, roughness: 0.2, metalness: 0.4 }),
  );
  water.position.set(0, 1.1, 0);
  group.add(water);
  colliders.push({ x: 0, z: 0, r: 8.5 });

  // Casino Perla: big block at (150, -140) with a glowing sign.
  const casino = new THREE.Mesh(
    boxGeo,
    new THREE.MeshStandardMaterial({ color: 0x8a2a4a, roughness: 0.7 }),
  );
  casino.scale.set(44, 26, 34);
  casino.position.set(150, 13, -140);
  group.add(casino);
  const sign = makeLabel('CASINO PERLA', 30, 7, '#3a0a1a', '#ffd27a');
  sign.position.set(150, 24, -122.4);
  group.add(sign);
  colliders.push({ x: 150, z: -140, r: 24 });

  // Pier: planks from the beach into the sea at x = 0.
  const plankMat = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 1 });
  for (let z = 342; z <= 428; z += 6) {
    const p = new THREE.Mesh(boxGeo, plankMat);
    p.scale.set(10, 0.6, 5.4);
    p.position.set(0, 0.8, z);
    group.add(p);
  }
  for (const px of [-5, 5]) {
    for (let z = 344; z <= 428; z += 12) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 2.4, 8),
        plankMat,
      );
      post.position.set(px, 0.4, z);
      group.add(post);
    }
  }

  // Ferris wheel on the beach at (-140, 318): rim, spokes, cabins.
  const wheel = new THREE.Group();
  wheel.position.set(-140, 26, 318);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xc23a3a, roughness: 0.6 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(20, 1.1, 10, 40), rimMat);
  wheel.add(rim);
  const rim2 = new THREE.Mesh(new THREE.TorusGeometry(14, 0.8, 8, 32), rimMat);
  wheel.add(rim2);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 20, 6),
      new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.5 }),
    );
    spoke.rotation.z = a + Math.PI / 2;
    spoke.position.set(Math.cos(a) * 10, Math.sin(a) * 10, 0);
    wheel.add(spoke);
    const cabin = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({
      color: [0xe8a13a, 0x3a8ae8, 0x3ae87a, 0xe83a8a][k % 4], roughness: 0.6,
    }));
    cabin.scale.set(3.4, 3, 3);
    cabin.position.set(Math.cos(a) * 20, Math.sin(a) * 20, 0);
    wheel.add(cabin);
  }
  group.add(wheel);
  for (const lx of [-146, -134]) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.2, 26, 8),
      new THREE.MeshStandardMaterial({ color: 0x6a6a6a, roughness: 0.8 }),
    );
    leg.position.set(lx, 13, 318);
    group.add(leg);
  }
  colliders.push({ x: -140, z: 318, r: 12 });

  // Canal: water strip x in [248, 276], with two bridges.
  const canal = groundPlane(28, 700, 0x1e5a7a, 262, 0, 0.04);
  canal.material = new THREE.MeshStandardMaterial({ color: 0x1e5a7a, roughness: 0.3, metalness: 0.3 });
  group.add(canal);
  for (const bz of [-100, 150]) {
    const bridge = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.9 }));
    bridge.scale.set(34, 1.2, 14);
    bridge.position.set(262, 0.9, bz);
    group.add(bridge);
  }

  // Palms along the beach and around the plaza.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2a7a3a, roughness: 1 });
  const palmSpots = [];
  for (let x = -320; x <= 320; x += 46) palmSpots.push([x + rng.range(-8, 8), 306 + rng.range(-2, 6)]);
  for (let k = 0; k < 8; k++) palmSpots.push([rng.range(-90, 90), rng.range(-90, 90)]);
  for (const [px, pz] of palmSpots) {
    if (Math.abs(px) < 14 && Math.abs(pz) < 14) continue;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 7, 7), trunkMat);
    trunk.position.set(px, 3.5, pz);
    trunk.rotation.z = rng.range(-0.08, 0.08);
    group.add(trunk);
    for (let l = 0; l < 5; l++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.5, 5), leafMat);
      const a = (l / 5) * Math.PI * 2 + rng.range(-0.3, 0.3);
      leaf.position.set(px + Math.cos(a) * 1.8, 7.6, pz + Math.sin(a) * 1.8);
      leaf.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
      group.add(leaf);
    }
  }

  // Streetlights along every third street.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.8 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = 0; i < CITY.streets.length; i += 3) {
    for (let j = 0; j < CITY.streets.length; j += 3) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 7, 6), poleMat);
      pole.position.set(CITY.streets[i] + 6, 3.5, CITY.streets[j] + 6);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), lampMat);
      lamp.position.set(CITY.streets[i] + 6, 7.2, CITY.streets[j] + 6);
      group.add(lamp);
    }
  }

  // Parked spots: 13, all on real street centre-lines, heading along the street.
  // The first is on the street north of the plaza, straight ahead of the
  // spawn, so a new player finds a car without a long walk.
  const spotDefs = [
    [12, -24, Math.PI / 2],
    [-70, -208, 0], [22, -116, 0], [114, -24, 0], [206, 68, 0],
    [-162, 160, 0], [-254, 22, 0], [68, 252, 0], [160, -208, 0],
    [-208, -70, Math.PI / 2], [-116, 114, Math.PI / 2], [22, 206, Math.PI / 2],
    [252, -162, Math.PI / 2],
  ];
  for (const [sx, sz, h] of spotDefs) parkedSpots.push({ x: sx, z: sz, heading: h });

  return { colliders, parkedSpots, wheel, group };
}
