// cars.js — the six original cars of Perla Bay, traffic and parked cars.
// Every model is built from boxes and cylinders here; no model is loaded
// from anywhere. Top speed is in m/s (displayed as km/h = speed * 3.6).

import * as THREE from 'three';

export const CAR_MODELS = [
  { name: 'Cometa GT', color: 0xd23b2e, topSpeed: 58, accel: 24, grip: 1.0, length: 4.4, width: 2.0 },
  { name: 'Onda Coupe', color: 0x2e6fd2, topSpeed: 52, accel: 21, grip: 1.0, length: 4.2, width: 1.9 },
  { name: 'Toro Pickup', color: 0x8a6b3a, topSpeed: 44, accel: 17, grip: 1.15, length: 4.8, width: 2.1 },
  { name: 'Brisa Sedan', color: 0x3a8a5f, topSpeed: 47, accel: 18, grip: 1.0, length: 4.5, width: 2.0 },
  { name: 'Vela Van', color: 0xd8d8d8, topSpeed: 40, accel: 15, grip: 1.25, length: 5.0, width: 2.2 },
  { name: 'Faro Sport', color: 0xe87e1e, topSpeed: 55, accel: 22, grip: 1.0, length: 4.3, width: 2.0 },
];

const WHEEL_GEO = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
const WHEEL_MAT = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
const GLASS_MAT = new THREE.MeshStandardMaterial({ color: 0x18242e, roughness: 0.2, metalness: 0.5 });
const LIGHT_MAT = new THREE.MeshBasicMaterial({ color: 0xfff2c8 });
const TAIL_MAT = new THREE.MeshBasicMaterial({ color: 0xd21e1e });

// A car mesh: body, cabin, four wheels, lights. `police` swaps the paint
// for a black-and-white patrol car with a light bar.
export function makeCarMesh(model, opts = {}) {
  const g = new THREE.Group();
  const paint = opts.police
    ? new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.45, metalness: 0.35 })
    : new THREE.MeshStandardMaterial({ color: model.color, roughness: 0.4, metalness: 0.35 });
  const L = model.length;
  const W = model.width;
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, 0.62, L), paint);
  body.position.y = 0.55;
  g.add(body);
  if (opts.police) {
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(W + 0.04, 0.5, L * 0.45),
      new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.5, metalness: 0.3 }),
    );
    door.position.y = 0.55;
    g.add(door);
  }
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(W * 0.82, 0.55, L * 0.46), GLASS_MAT);
  cabin.position.set(0, 1.1, -L * 0.06);
  g.add(cabin);
  if (model.name === 'Toro Pickup') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, 0.3, L * 0.34),
      new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 1 }));
    bed.position.set(0, 0.95, L * 0.28);
    g.add(bed);
  }
  if (model.name === 'Vela Van') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(W * 0.95, 1.1, L * 0.55), paint);
    box.position.set(0, 1.3, L * 0.14);
    g.add(box);
  }
  for (const [wx, wz] of [[-W / 2, L * 0.32], [W / 2, L * 0.32], [-W / 2, -L * 0.32], [W / 2, -L * 0.32]]) {
    const wheel = new THREE.Mesh(WHEEL_GEO, WHEEL_MAT);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    g.add(wheel);
  }
  for (const lx of [-W * 0.32, W * 0.32]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), LIGHT_MAT);
    head.position.set(lx, 0.62, -L / 2 - 0.02);
    g.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), TAIL_MAT);
    tail.position.set(lx, 0.62, L / 2 + 0.02);
    g.add(tail);
  }
  if (opts.police) {
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.x = -0.28;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3),
      new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.x = 0.28;
    bar.add(red);
    bar.add(blue);
    bar.position.set(0, 1.45, -L * 0.06);
    g.add(bar);
    g.userData.lightBar = bar;
  }
  return g;
}

// Traffic: cars that cruise the street grid. Each one owns one street axis
// (a fixed x on a north-south street, or a fixed z on an east-west street)
// and a direction; at an intersection it sometimes turns onto the crossing
// street. Positions wrap at the city edge so traffic never runs out.
export function createTraffic(scene, city, rng, count = 16) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const model = rng.pick(CAR_MODELS);
    const mesh = makeCarMesh(model);
    scene.add(mesh);
    const alongX = rng.chance(0.5);
    const street = rng.pick(city.streets);
    const dir = rng.chance(0.5) ? 1 : -1;
    const car = {
      mesh, model,
      alongX, coord: street, dir,
      pos: rng.range(-320, 320),
      speed: rng.range(7, 13),
      turnCooldown: rng.range(2, 8),
    };
    cars.push(car);
  }
  return cars;
}

export function updateTraffic(dt, cars, city, rng) {
  for (const c of cars) {
    c.turnCooldown -= dt;
    c.pos += c.dir * c.speed * dt;
    if (c.pos > 330) c.pos = -330;
    if (c.pos < -330) c.pos = 330;
    // At an intersection, sometimes turn onto the crossing street.
    if (c.turnCooldown <= 0) {
      const near = city.streets.find((s) => Math.abs(c.pos - s) < 6);
      if (near !== undefined && rng.chance(0.3)) {
        const oldCoord = c.coord;
        c.coord = near;
        c.pos = oldCoord;
        c.alongX = !c.alongX;
        c.dir = rng.chance(0.5) ? 1 : -1;
      }
      c.turnCooldown = rng.range(3, 9);
    }
    const x = c.alongX ? c.coord : c.pos;
    const z = c.alongX ? c.pos : c.coord;
    c.mesh.position.set(x, 0, z);
    // Heading: along +z when dir is +1 on a north-south street, etc.
    let heading = 0;
    if (c.alongX) heading = c.dir > 0 ? 0 : Math.PI;
    else heading = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    c.mesh.rotation.y = heading;
  }
}

// Parked cars on the spots the city laid out. A taken car is hidden from the
// parked list (the player is driving it) and restored on exit.
export function createParkedCars(scene, spots, rng) {
  const cars = [];
  for (const s of spots) {
    const model = rng.pick(CAR_MODELS);
    const mesh = makeCarMesh(model);
    mesh.position.set(s.x, 0, s.z);
    mesh.rotation.y = s.heading;
    scene.add(mesh);
    cars.push({ mesh, model, x: s.x, z: s.z, heading: s.heading, taken: false });
  }
  return cars;
}

export function nearestParked(cars, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const c of cars) {
    if (c.taken) continue;
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
