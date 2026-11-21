// cars.js — vehicles for PERLA BAY: player cars, traffic AI, parked cars.
// Arcade physics: accel/brake/steer with drift on handbrake, building
// collision via city colliders, clamped to the city + beach bounds.

import * as THREE from 'three';
import { randRange, randInt, randPick, clamp, wrapAngle, angleDiff } from './random.js';
import { PITCH, STREET, CITY_HALF, BEACH_Z, resolveBuilding, isOnStreet } from './city.js';

export const CAR_DEFS = [
  { name: 'Faro Sport', color: 0xe84a30, top: 58, accel: 26, grip: 2.6 },
  { name: 'Cometa GT', color: 0x2a7ae8, top: 55, accel: 24, grip: 2.4 },
  { name: 'Toro Pickup', color: 0xe8a020, top: 46, accel: 20, grip: 2.2 },
  { name: 'Vela Sedan', color: 0x8a8a92, top: 44, accel: 19, grip: 2.3 },
  { name: 'Brisa Coupe', color: 0x3ac8a8, top: 50, accel: 22, grip: 2.5 },
];

const TRAFFIC_COLORS = [0xcccccc, 0x444444, 0x7a2020, 0x20507a, 0x8a7a20, 0x4a7a3a, 0x9a9aa8];

export function makeCarMesh(def, withLights) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: def.color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x223344 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 4.4), bodyMat);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), glassMat);
  cabin.position.set(0, 1.15, -0.2);
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x181818 });
  const wheelPos = [[-0.95, 0.38, 1.45], [0.95, 0.38, 1.45], [-0.95, 0.38, -1.45], [0.95, 0.38, -1.45]];
  for (const [x, y, z] of wheelPos) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, y, z);
    g.add(w);
  }
  if (withLights) {
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
    for (const sx of [-0.6, 0.6]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), headMat);
      h.position.set(sx, 0.6, 2.25);
      g.add(h);
    }
  }
  g.userData.def = def;
  return g;
}

export function createPlayerCar(scene, def, x, z, heading) {
  const mesh = makeCarMesh(def, true);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    mesh, def,
    x, z, heading,
    speed: 0, // m/s, signed (forward positive)
    steer: 0,
    condition: 100,
    drift: 0,
  };
}

// Drive one arcade step. input: {throttle -1..1, steer -1..1, handbrake bool}.
export function driveCar(car, input, dt, city) {
  const def = car.def;
  const target = input.throttle * def.top;
  const accelRate = input.throttle !== 0 ? def.accel : 14;
  if (car.speed < target) car.speed = Math.min(target, car.speed + accelRate * dt);
  else car.speed = Math.max(target, car.speed - accelRate * 1.4 * dt);
  const grip = input.handbrake ? def.grip * 0.45 : def.grip;
  const steerTarget = input.steer * (0.55 + 0.45 * Math.min(1, Math.abs(car.speed) / 20));
  car.steer += (steerTarget - car.steer) * Math.min(1, 8 * dt);
  const turnRate = car.steer * grip * clamp(Math.abs(car.speed) / 12, 0, 1) * Math.sign(car.speed || 1);
  car.heading += turnRate * dt;
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const res = resolveBuilding(city, nx, nz, 1.6);
  if (res.hit) {
    car.speed *= 0.45;
    car.condition = Math.max(0, car.condition - Math.abs(car.speed) * 0.02);
  }
  car.x = clamp(res.x, -CITY_HALF, CITY_HALF);
  car.z = clamp(res.z, -CITY_HALF, BEACH_Z + 55);
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  car.drift = input.handbrake && Math.abs(car.speed) > 8 ? Math.abs(car.steer) : 0;
  return res.hit;
}

// ---- Traffic: cars that follow the street grid, turn at intersections, ----
// ---- and slow down when something is ahead. Seeded and deterministic. ----

export function createTraffic(scene, city, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const def = { name: 'Traffic', color: randPick(rng, TRAFFIC_COLORS), top: 14, accel: 10, grip: 2 };
    const mesh = makeCarMesh(def, false);
    const alongX = rng() < 0.5;
    const k = randInt(rng, -5, 5);
    const line = k * PITCH;
    const lane = randPick(rng, [-3.2, 3.2]);
    const t = randRange(rng, -CITY_HALF + 20, CITY_HALF - 20);
    const heading = alongX ? (lane > 0 ? Math.PI / 2 : -Math.PI / 2) : (lane > 0 ? Math.PI : 0);
    const x = alongX ? t : line + lane;
    const z = alongX ? line + lane : t;
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    cars.push({ mesh, def, x, z, heading, speed: randRange(rng, 8, 13), alongX, line, lane, stopped: 0 });
  }
  return cars;
}

export function updateTraffic(dt, cars, city, playerCar, rng) {
  for (const c of cars) {
    // Simple look-ahead: slow if a car (or the player car) is close ahead.
    let ahead = false;
    const fx = Math.sin(c.heading);
    const fz = Math.cos(c.heading);
    for (const o of cars) {
      if (o === c) continue;
      const dx = o.x - c.x;
      const dz = o.z - c.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along < 9 && side < 2.4) { ahead = true; break; }
    }
    if (playerCar) {
      const dx = playerCar.x - c.x;
      const dz = playerCar.z - c.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along < 9 && side < 2.6) ahead = true;
    }
    const target = ahead ? 0 : c.def.top;
    c.speed += (target - c.speed) * Math.min(1, 2.2 * dt);
    let nx = c.x + Math.sin(c.heading) * c.speed * dt;
    let nz = c.z + Math.cos(c.heading) * c.speed * dt;
    // At the city edge, turn around; at intersections, sometimes turn.
    const pastEdge = c.alongX ? Math.abs(nx) > CITY_HALF - 8 : Math.abs(nz) > CITY_HALF - 8;
    if (pastEdge) {
      c.heading += Math.PI;
      nx = c.x;
      nz = c.z;
    } else if (rng() < 0.0015) {
      // Random turn at an intersection: snap to a cross street.
      const turn = randPick(rng, [-Math.PI / 2, Math.PI / 2]);
      c.heading = wrapAngle(c.heading + turn);
      c.alongX = !c.alongX;
    }
    c.x = nx;
    c.z = nz;
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.heading;
  }
}

// Parked cars sit in bays beside streets; the player can steal one with F.
export function createParked(scene, city, rng, count) {
  const spots = [];
  for (let i = 0; i < count; i++) {
    const def = CAR_DEFS[i % CAR_DEFS.length];
    const mesh = makeCarMesh(def, false);
    const alongX = rng() < 0.5;
    const k = randInt(rng, -5, 5);
    const line = k * PITCH;
    const side = randPick(rng, [-1, 1]);
    const t = randRange(rng, -CITY_HALF + 30, CITY_HALF - 30);
    const x = alongX ? t : line + side * (STREET / 2 + 2.2);
    const z = alongX ? line + side * (STREET / 2 + 2.2) : t;
    if (!isOnStreet(x, z) && Math.abs(x) < CITY_HALF && Math.abs(z) < CITY_HALF) {
      // Spot is inside a block — nudge it onto the street edge instead.
      continue;
    }
    mesh.position.set(x, 0, z);
    mesh.rotation.y = alongX ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? Math.PI : 0);
    scene.add(mesh);
    spots.push({ mesh, def, x, z, heading: mesh.rotation.y, taken: false });
  }
  return spots;
}
