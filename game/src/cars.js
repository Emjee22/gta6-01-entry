// Cars for Perla Bay: six original models, traffic that follows the road
// grid, and parked cars the player can steal with F.
import * as THREE from '../vendor/three.module.min.js';
import { makeRng } from './random.js';
import { collideCircle, onRoad } from './city.js';

export const MODELS = [
  { name: 'Cometa GT', color: 0xc23b2e, top: 118, accel: 26, len: 4.4, w: 1.9 },
  { name: 'Onda Coupe', color: 0x2e6fc2, top: 112, accel: 24, len: 4.2, w: 1.85 },
  { name: 'Toro Pickup', color: 0x8a6d2f, top: 96, accel: 20, len: 4.9, w: 2.0 },
  { name: 'Brisa Sedan', color: 0x3d7a52, top: 104, accel: 22, len: 4.5, w: 1.9 },
  { name: 'Vela Van', color: 0xd8d2c2, top: 88, accel: 17, len: 5.2, w: 2.1 },
  { name: 'Faro Sport', color: 0xe8a13d, top: 124, accel: 28, len: 4.3, w: 1.9 },
];

export function buildCarMesh(model, isPolice = false) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: isPolice ? 0x1c1e24 : model.color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(model.w, 0.75, model.len), paint);
  body.position.y = 0.62;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(model.w * 0.82, 0.62, model.len * 0.48),
    new THREE.MeshLambertMaterial({ color: isPolice ? 0xe8e8e8 : 0x1a2027 })
  );
  cabin.position.set(0, 1.28, -model.len * 0.06);
  cabin.castShadow = true;
  g.add(cabin);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.1), lightMat);
    hl.position.set(sx * (model.w / 2 - 0.3), 0.66, model.len / 2 + 0.02);
    g.add(hl);
    const tl = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.18, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xc22e2e })
    );
    tl.position.set(sx * (model.w / 2 - 0.3), 0.66, -model.len / 2 - 0.02);
    g.add(tl);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  for (const [wx, wz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx * (model.w / 2 - 0.05), 0.36, wz * (model.len / 2 - 0.8));
    g.add(w);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.22, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    bar.position.set(0, 1.68, -0.2);
    g.add(bar);
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.2, 0.42),
      new THREE.MeshBasicMaterial({ color: 0xff2222 })
    );
    red.position.set(-0.3, 1.82, -0.2);
    red.name = 'beaconR';
    g.add(red);
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.2, 0.42),
      new THREE.MeshBasicMaterial({ color: 0x2244ff })
    );
    blue.position.set(0.3, 1.82, -0.2);
    blue.name = 'beaconB';
    g.add(blue);
  }
  return g;
}

export function createTraffic(scene, city, seed = 777) {
  const rng = makeRng(seed);
  const cars = [];
  const parked = [];
  const roads = city.roads;

  function randomRoadPoint() {
    const r = rng.pick(roads);
    if (r.axis === 'x') {
      return { x: r.at + rng.range(-2.5, 2.5), z: rng.range(-300, 140), heading: rng.chance(0.5) ? 0 : Math.PI };
    }
    return { x: rng.range(-300, 300), z: r.at + rng.range(-2.5, 2.5), heading: rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2 };
  }

  for (let i = 0; i < 26; i++) {
    const model = rng.pick(MODELS);
    const mesh = buildCarMesh(model);
    const p = randomRoadPoint();
    mesh.position.set(p.x, 0, p.z);
    mesh.rotation.y = p.heading;
    scene.add(mesh);
    cars.push({
      model, mesh, x: p.x, z: p.z, heading: p.heading,
      speed: rng.range(7, 13), targetSpeed: rng.range(7, 13),
      axis: p.heading === 0 || p.heading === Math.PI ? 'z' : 'x',
      dir: p.heading === 0 ? 1 : p.heading === Math.PI ? -1 : p.heading === Math.PI / 2 ? 1 : -1,
      wait: 0,
    });
  }

  // Parked cars ON real street centre-lines (x-streets: -300,-254,-208,-162,
  // -116,-70,-24,22,68,114,160,206,252,298) or open beach, headings along the
  // street, so a stolen car can always drive away immediately.
  const parkSpots = [
    { x: -24, z: -100, heading: 0 }, { x: 22, z: 138, heading: 0 },
    { x: -87, z: 165, heading: Math.PI / 2 }, { x: -46, z: 138, heading: Math.PI / 2 },
    { x: -70, z: 46, heading: 0 }, { x: 68, z: -70, heading: Math.PI },
    { x: 114, z: 92, heading: 0 }, { x: -162, z: -138, heading: Math.PI },
    { x: 160, z: 0, heading: 0 }, { x: 206, z: -92, heading: Math.PI },
    { x: -116, z: -162, heading: 0 }, { x: 252, z: 68, heading: Math.PI },
  ];
  for (const s of parkSpots) {
    const model = rng.pick(MODELS);
    const mesh = buildCarMesh(model);
    mesh.position.set(s.x, 0, s.z);
    mesh.rotation.y = s.heading;
    scene.add(mesh);
    parked.push({ model, mesh, x: s.x, z: s.z, taken: false });
  }

  return { cars, parked };
}
export function updateTraffic(traffic, city, dt, playerPos) {
  const { cars } = traffic;
  for (const c of cars) {
    // Slow down if something is right ahead (simple bumper logic).
    let ahead = false;
    for (const o of cars) {
      if (o === c) continue;
      const dx = o.x - c.x, dz = o.z - c.z;
      const fwd = c.axis === 'z' ? dz * c.dir : dx * c.dir;
      const side = c.axis === 'z' ? Math.abs(dx) : Math.abs(dz);
      if (fwd > 0 && fwd < 11 && side < 3.4) { ahead = true; break; }
    }
    if (playerPos) {
      const dx = playerPos.x - c.x, dz = playerPos.z - c.z;
      const fwd = c.axis === 'z' ? dz * c.dir : dx * c.dir;
      const side = c.axis === 'z' ? Math.abs(dx) : Math.abs(dz);
      if (fwd > 0 && fwd < 9 && side < 3.2) ahead = true;
    }
    const target = ahead ? 0 : c.targetSpeed;
    c.speed += (target - c.speed) * Math.min(1, dt * 1.6);
    if (c.speed > 0.4) {
      if (c.axis === 'z') c.z += c.dir * c.speed * dt;
      else c.x += c.dir * c.speed * dt;
      // Wrap around the city edge instead of despawning.
      if (c.z > 160) c.z = -320;
      if (c.z < -320) c.z = 160;
      if (c.x > 320) c.x = -320;
      if (c.x < -320) c.x = 320;
      c.mesh.position.set(c.x, 0, c.z);
    }
  }
}

// Nearest parked car within `range` metres of (x, z), or null.
export function nearestParked(traffic, x, z, range = 4.5) {
  let best = null, bestD = range * range;
  for (const p of traffic.parked) {
    if (p.taken) continue;
    const dx = p.x - x, dz = p.z - z;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}
