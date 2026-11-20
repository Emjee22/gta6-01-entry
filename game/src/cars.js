// Cars for Perla Bay: low-poly models, arcade driving, traffic and
// pedestrians.
//
// Every car is built from boxes and cylinders in code, so there is no
// model file to load. The player car uses simple arcade physics: throttle,
// steering that scales with speed, a handbrake drift, and nitro. Traffic
// follows the road graph, and parked cars are the ones the player steals.
import * as THREE from 'three';
import { createRandom } from './random.js';

export const CAR_DEFS = [
  { name: 'Cometa GT', color: 0xd84a4a, topSpeed: 42, accel: 26, grip: 1.0 },
  { name: 'Onda Coupe', color: 0x3a7bd8, topSpeed: 40, accel: 24, grip: 1.05 },
  { name: 'Coral Cruiser', color: 0xe8a34a, topSpeed: 34, accel: 20, grip: 0.9 },
  { name: 'Arena Roadster', color: 0x9a5ac9, topSpeed: 44, accel: 27, grip: 1.1 },
  { name: 'Solano Sedan', color: 0x5a8a6a, topSpeed: 36, accel: 21, grip: 0.95 },
  { name: 'Cielo Hatchback', color: 0xe8e8e8, topSpeed: 35, accel: 22, grip: 1.0 },
];

// Build a low-poly car: body, cabin, glass, four wheels, lights. The wheels
// are kept in userData so the driving code can spin them.
export function buildCarMesh(def) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.35, metalness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2438, roughness: 0.15, metalness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.9 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glass);
  cabin.position.set(0, 1.1, -0.25);
  cabin.castShadow = true;
  group.add(cabin);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.1, 2.0), paint);
  roof.position.set(0, 1.4, -0.25);
  group.add(roof);

  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }

  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdf80, emissiveIntensity: 0.8 });
  for (const dx of [-0.6, 0.6]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.1), lightMat);
    head.position.set(dx, 0.62, 2.21);
    group.add(head);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.16, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xd83030, emissive: 0x881111, emissiveIntensity: 0.6 }),
    );
    tail.position.set(dx, 0.62, -2.21);
    group.add(tail);
  }

  group.userData.wheels = wheels;
  return group;
}

// A live car: mesh plus driving state. `heading` is radians, 0 = facing +z.
export function createCar(scene, def, x, z, heading) {
  const mesh = buildCarMesh(def);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    mesh,
    def,
    pos: new THREE.Vector3(x, 0, z),
    heading,
    speed: 0,
    condition: 100,
    nitro: 100,
    drifting: false,
    // Spin the wheels to match the speed.
    syncMesh() {
      this.mesh.position.set(this.pos.x, 0, this.pos.z);
      this.mesh.rotation.y = this.heading;
      const spin = (this.speed * 0.016) / 0.36;
      for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
    },
  };
}

// Arcade driving for the player's car. Returns the distance driven, which
// the game uses for drift and near-miss bonuses.
export function drivePlayerCar(car, input, dt, city) {
  const forward = input.isDown('KeyW') || input.isDown('ArrowUp');
  const back = input.isDown('KeyS') || input.isDown('ArrowDown');
  const left = input.isDown('KeyA') || input.isDown('ArrowLeft');
  const right = input.isDown('KeyD') || input.isDown('ArrowRight');
  const handbrake = input.isDown('Space');
  const nitro = input.isDown('ShiftLeft') || input.isDown('ShiftRight');

  const top = car.def.topSpeed * (nitro && car.nitro > 0 ? 1.35 : 1);
  if (forward) car.speed += car.def.accel * dt * (nitro && car.nitro > 0 ? 1.25 : 1);
  if (back) {
    car.speed -= car.speed > 0.5 ? 34 * dt : 12 * dt;
    if (car.speed < -12) car.speed = -12;
  }
  if (!forward && !back) {
    car.speed -= car.speed * 0.9 * dt;
    if (Math.abs(car.speed) < 0.05) car.speed = 0;
  }
  if (car.speed > top) car.speed = top;
  if (nitro && forward && car.nitro > 0) car.nitro = Math.max(0, car.nitro - 22 * dt);
  else car.nitro = Math.min(100, car.nitro + 6 * dt);

  // Steering scales with speed and sharpens with the handbrake.
  const steer = (left ? 1 : 0) - (right ? 1 : 0);
  const speedFactor = Math.min(1, Math.abs(car.speed) / 12);
  const turnRate = steer * 1.9 * speedFactor * car.def.grip * (handbrake ? 1.7 : 1);
  car.drifting = handbrake && Math.abs(car.speed) > 8 && steer !== 0;
  if (car.speed < 0) car.heading -= turnRate * dt * 0.8;
  else car.heading += turnRate * dt;
  if (car.drifting) car.speed *= 1 - 0.35 * dt;

  const dx = Math.sin(car.heading) * car.speed * dt;
  const dz = Math.cos(car.heading) * car.speed * dt;
  const nx = car.pos.x + dx;
  const nz = car.pos.z + dz;

  // Collision: a circle against building boxes. On a hit, stop and slide.
  if (!circleBlocked(nx, car.pos.z, 1.6, city)) car.pos.x = nx;
  else {
    car.speed *= 0.45;
    car.condition = Math.max(0, car.condition - Math.abs(car.speed) * 0.06);
  }
  if (!circleBlocked(car.pos.x, nz, 1.6, city)) car.pos.z = nz;
  else {
    car.speed *= 0.45;
    car.condition = Math.max(0, car.condition - Math.abs(car.speed) * 0.06);
  }
  // The beach is drivable, the ocean is not.
  if (car.pos.z > 238) {
    car.pos.z = 238;
    car.speed *= 0.5;
  }
  car.pos.x = Math.max(-238, Math.min(238, car.pos.x));
  car.pos.z = Math.max(-238, Math.min(238, car.pos.z));
  car.syncMesh();
  return Math.abs(car.speed) * dt;
}

function circleBlocked(x, z, r, city) {
  for (const c of city.colliders) {
    const cx = Math.max(c.minX, Math.min(x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

// Traffic: cars that drive the road graph. Each one picks a random edge,
// drives to its end node, then picks a new edge. They keep right, so two
// cars on the same road pass each other instead of colliding head-on.
export function createTraffic(scene, city, rng, count) {
  const { nodes, edges } = city.graph;
  const adjacency = new Map();
  for (let i = 0; i < nodes.length; i += 1) adjacency.set(i, []);
  edges.forEach(([a, b], ei) => {
    adjacency.get(a).push({ to: b, edge: ei });
    adjacency.get(b).push({ to: a, edge: ei });
  });

  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const edgeIdx = rng.int(0, edges.length - 1);
    const [a, b] = edges[edgeIdx];
    const from = rng.chance(0.5) ? a : b;
    const to = from === a ? b : a;
    const def = rng.pick(CAR_DEFS);
    const car = createCar(scene, def, nodes[from].x, nodes[from].z, 0);
    car.speed = rng.range(8, 14);
    car.edgeFrom = from;
    car.edgeTo = to;
    car.t = rng.next();
    cars.push(car);
  }

  // Parked cars: the ones the player can steal. They sit in side streets
  // and beach-front bays, engines off.
  const parked = [];
  const parkSpots = [];
  for (let i = 0; i < 14; i += 1) {
    const c = rng.pick([-144, -96, -48, 0, 48, 96, 144]);
    const along = rng.range(-180, 180);
    const side = rng.chance(0.5) ? 1 : -1;
    if (rng.chance(0.3)) parkSpots.push({ x: rng.range(-180, 180), z: 194, heading: rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2 });
    else if (rng.chance(0.5)) parkSpots.push({ x: c + side * 7, z: along, heading: side > 0 ? Math.PI / 2 : -Math.PI / 2 });
    else parkSpots.push({ x: along, z: c + side * 7, heading: side > 0 ? 0 : Math.PI });
  }
  for (const spot of parkSpots) {
    const def = rng.pick(CAR_DEFS);
    const car = createCar(scene, def, spot.x, spot.z, spot.heading);
    car.condition = rng.int(60, 100);
    parked.push(car);
  }

  function update(dt, playerCar) {
    for (const car of cars) {
      const from = nodes[car.edgeFrom];
      const to = nodes[car.edgeTo];
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      const len = Math.hypot(dx, dz) || 1;
      car.t += (car.speed * dt) / len;
      if (car.t >= 1) {
        // Reached the node: pick a new edge, not the one just driven.
        const options = adjacency.get(car.edgeTo).filter((o) => o.to !== car.edgeFrom);
        const next = options.length ? options[rng.int(0, options.length - 1)] : adjacency.get(car.edgeTo)[0];
        car.edgeFrom = car.edgeTo;
        car.edgeTo = next.to;
        car.t = 0;
        car.speed = rng.range(8, 14);
        continue;
      }
      // Keep right: offset the lane by 2.2 units.
      const nx = -dz / len;
      const nz = dx / len;
      car.pos.x = from.x + dx * car.t + nx * 2.2;
      car.pos.z = from.z + dz * car.t + nz * 2.2;
      car.heading = Math.atan2(dx, dz);
      // Slow down if the player's car is right ahead.
      if (playerCar) {
        const d = Math.hypot(playerCar.pos.x - car.pos.x, playerCar.pos.z - car.pos.z);
        if (d < 9 && Math.abs(car.speed) > 3) car.speed = Math.max(3, car.speed - 20 * dt);
      }
      car.syncMesh();
    }
  }

  return {
    cars,
    parked,
    update,
    // The closest parked car within `maxDist`, or null.
    nearestParked(x, z, maxDist) {
      let best = null;
      let bestD = maxDist;
      for (const car of parked) {
        const d = Math.hypot(car.pos.x - x, car.pos.z - z);
        if (d < bestD) {
          bestD = d;
          best = car;
        }
      }
      return best;
    },
    // Take a parked car out of the parked list (the player just stole it).
    takeParked(car) {
      const i = parked.indexOf(car);
      if (i >= 0) parked.splice(i, 1);
    },
    // Return a car to the parked list (the player walked away from it).
    returnParked(car) {
      parked.push(car);
    },
  };
}

// Pedestrians: low-poly walkers on the sidewalks. They stroll along a road,
// turn at the ends, and keep walking. A little life for the streets.
export function createPedestrians(scene, city, rng, count) {
  const bodyGeo = new THREE.CapsuleGeometry(0.35, 0.9, 3, 6);
  const headGeo = new THREE.SphereGeometry(0.3, 8, 6);
  const shirtColors = [0xe87e7e, 0x7fb8a8, 0xf5d98a, 0x8fb8dd, 0xc9a7d8, 0x9ac98f, 0xe8e8e8];
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: rng.pick(shirtColors), roughness: 0.9 }));
    body.position.y = 1.0;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: 0xd8a080, roughness: 0.9 }));
    head.position.y = 1.95;
    head.castShadow = true;
    group.add(head);
    const horizontal = rng.chance(0.5);
    const road = rng.pick([-144, -96, -48, 0, 48, 96, 144]);
    const offset = (rng.chance(0.5) ? 1 : -1) * 7;
    const along = rng.range(-180, 180);
    const x = horizontal ? along : road + offset;
    const z = horizontal ? road + offset : along;
    group.position.set(x, 0, z);
    scene.add(group);
    peds.push({
      group,
      x,
      z,
      heading: horizontal ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI),
      speed: rng.range(1.4, 2.6),
      bob: rng.range(0, Math.PI * 2),
    });
  }

  function update(dt) {
    for (const ped of peds) {
      ped.x += Math.sin(ped.heading) * ped.speed * dt;
      ped.z += Math.cos(ped.heading) * ped.speed * dt;
      ped.bob += dt * 6;
      // Turn around at the city edge or the beach.
      if (ped.x < -225 || ped.x > 225 || ped.z < -225 || ped.z > 195) {
        ped.heading += Math.PI;
      }
      // Bounce off buildings.
      if (city.blocked(ped.x, ped.z)) {
        ped.heading += Math.PI / 2;
        ped.x -= Math.sin(ped.heading) * ped.speed * dt * 2;
        ped.z -= Math.cos(ped.heading) * ped.speed * dt * 2;
      }
      ped.group.position.set(ped.x, Math.abs(Math.sin(ped.bob)) * 0.06, ped.z);
      ped.group.rotation.y = ped.heading;
    }
  }

  return { peds, update };
}
