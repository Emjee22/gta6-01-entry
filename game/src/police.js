// Police for Perla Bay: wanted stars, patrol cars that chase and ram,
// a helicopter with a searchlight at 3+ stars, and roadblocks at 4+ stars.
// Dispatch callsigns are birds and fish — the flavour of the HUD list.
import * as THREE from '../vendor/three.module.min.js';
import { makeRng, clamp } from './random.js';
import { buildCarMesh } from './cars.js';

export const CALLSIGNS = [
  'AIR-1', 'MARLIN-5', 'IBIS-9', 'GULL-1', 'HERON-2', 'BLOCK-9',
  'TUNA-3', 'OSPREY-7', 'RAY-4', 'FALCON-2',
];
const TACTICS = ['PURSUIT', 'INTERCEPT', 'CORDON', 'AIR WATCH', 'ROADBLOCK'];

export function createPolice(scene, city) {
  const rng = makeRng(4242);
  return {
    scene, city, rng,
    wanted: 0,
    heat: 0,              // 0..100, decays; stars = floor(heat/20)
    units: [],            // police cars {mesh, x, z, heading, speed, callsign, tactic}
    heli: null,           // {group, x, y, z, angle}
    roadblocks: [],       // {mesh, x, z}
    sirenOn: false,
    spawnCooldown: 0,
  };
}

function spawnUnit(pol, x, z) {
  const mesh = buildCarMesh({ name: 'Patrol', color: 0x1c1e24, top: 110, accel: 24, len: 4.6, w: 1.95 }, true);
  mesh.position.set(x, 0, z);
  pol.scene.add(mesh);
  const unit = {
    mesh, x, z, heading: 0, speed: 0,
    callsign: pol.rng.pick(CALLSIGNS),
    tactic: pol.rng.pick(TACTICS),
    wobble: pol.rng.range(0, Math.PI * 2),
  };
  pol.units.push(unit);
  return unit;
}

function spawnHeli(pol, x, z) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 1.5, 6.4),
    new THREE.MeshLambertMaterial({ color: 0xe8e8e8 })
  );
  body.castShadow = true;
  g.add(body);
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, 0.5, 6.5),
    new THREE.MeshLambertMaterial({ color: 0xc23b2e })
  );
  stripe.position.y = -0.4;
  g.add(stripe);
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.7, 5),
    new THREE.MeshLambertMaterial({ color: 0xe8e8e8 })
  );
  tail.position.set(0, 0.2, -5.2);
  g.add(tail);
  const rotor = new THREE.Mesh(
    new THREE.BoxGeometry(11, 0.12, 0.9),
    new THREE.MeshLambertMaterial({ color: 0x222222 })
  );
  rotor.position.y = 1.1;
  rotor.name = 'rotor';
  g.add(rotor);
  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 1.1, 1.6, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
  );
  lamp.position.set(0, -2.2, 2.2);
  lamp.rotation.x = 0.5;
  lamp.name = 'searchlight';
  g.add(lamp);
  const spot = new THREE.SpotLight(0xfff2b0, 600, 90, 0.32, 0.5, 1.2);
  spot.position.set(0, -1, 2);
  spot.target.position.set(0, -20, 8);
  g.add(spot); g.add(spot.target);
  g.position.set(x, 26, z);
  g.scale.setScalar(1.6);
  pol.scene.add(g);
  pol.heli = { group: g, x, y: 26, z, angle: 0, rotor };
}

function spawnRoadblock(pol, x, z, heading) {
  const g = new THREE.Group();
  for (let i = -1; i <= 1; i++) {
    const car = buildCarMesh({ name: 'Patrol', color: 0x1c1e24, top: 0, accel: 0, len: 4.6, w: 1.95 }, true);
    car.position.set(i * 4.4, 0, 0);
    car.rotation.y = heading + Math.PI / 2;
    g.add(car);
  }
  const barrier = new THREE.Mesh(
    new THREE.BoxGeometry(12, 1.1, 0.4),
    new THREE.MeshLambertMaterial({ color: 0xd9a03d })
  );
  barrier.position.set(0, 0.9, 2.6);
  g.add(barrier);
  g.position.set(x, 0, z);
  pol.scene.add(g);
  pol.roadblocks.push({ mesh: g, x, z });
}
export function ensureHeli(pol, x, z) {
  if (!pol.heli) spawnHeli(pol, x, z);
  return pol.heli;
}

export function addHeat(pol, amount) {
  pol.heat = clamp(pol.heat + amount, 0, 100);
  const stars = Math.floor(pol.heat / 20);
  if (stars !== pol.wanted) {
    pol.wanted = stars;
    return true; // wanted level changed
  }
  return false;
}

export function updatePolice(pol, player, dt, time) {
  // Heat decays slowly; stars follow.
  pol.heat = clamp(pol.heat - dt * 1.1, 0, 100);
  pol.wanted = Math.floor(pol.heat / 20);
  pol.sirenOn = pol.wanted > 0;

  const wantUnits = pol.wanted >= 1 ? Math.min(2 + pol.wanted, 7) : 0;
  pol.spawnCooldown -= dt;
  if (pol.units.length < wantUnits && pol.spawnCooldown <= 0) {
    const a = pol.rng.range(0, Math.PI * 2);
    const d = 55 + pol.rng.range(0, 25);
    spawnUnit(pol, player.x + Math.cos(a) * d, player.z + Math.sin(a) * d);
    pol.spawnCooldown = 1.4;
  }
  // Too many units: remove the farthest.
  while (pol.units.length > wantUnits) {
    const far = pol.units.reduce((a, b) => {
      const da = (a.x - player.x) ** 2 + (a.z - player.z) ** 2;
      const db = (b.x - player.x) ** 2 + (b.z - player.z) ** 2;
      return db > da ? b : a;
    });
    pol.scene.remove(far.mesh);
    pol.units.splice(pol.units.indexOf(far), 1);
  }

  // Chase: steer toward the player, ram on contact.
  for (const u of pol.units) {
    const dx = player.x - u.x, dz = player.z - u.z;
    const dist = Math.hypot(dx, dz) || 1;
    const targetHeading = Math.atan2(dx, dz);
    let dh = targetHeading - u.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    u.heading += clamp(dh, -2.4 * dt, 2.4 * dt);
    const top = 15 + pol.wanted * 2.4;
    u.speed += ((dist > 14 ? top : top * 0.55) - u.speed) * Math.min(1, dt * 1.8);
    u.x += Math.sin(u.heading) * u.speed * dt;
    u.z += Math.cos(u.heading) * u.speed * dt;
    u.mesh.position.set(u.x, 0, u.z);
    u.mesh.rotation.y = u.heading;
    // Flashing beacons.
    const on = Math.sin(time * 9 + u.wobble) > 0;
    const r = u.mesh.getObjectByName('beaconR');
    const b = u.mesh.getObjectByName('beaconB');
    if (r) r.material.color.setHex(on ? 0xff2222 : 0x551111);
    if (b) b.material.color.setHex(on ? 0x111155 : 0x2244ff);
    if (dist < 3.4 && player.onFoot === false) {
      // Ram: shove the player's car and add a little heat.
      player.vx = (player.vx || 0) + (dx / dist) * 6;
      player.vz = (player.vz || 0) + (dz / dist) * 6;
    }
  }

  // Helicopter at 3+ stars.
  if (pol.wanted >= 3 && !pol.heli) spawnHeli(pol, player.x + 30, player.z - 30);
  if (pol.wanted < 3 && pol.heli) {
    pol.scene.remove(pol.heli.group);
    pol.heli = null;
  }
  if (pol.heli) {
    const h = pol.heli;
    h.angle += dt * 0.35;
    const tx = player.x + Math.cos(h.angle) * 26;
    const tz = player.z + Math.sin(h.angle) * 26;
    h.x += (tx - h.x) * Math.min(1, dt * 0.8);
    h.z += (tz - h.z) * Math.min(1, dt * 0.8);
    h.y = 24 + Math.sin(time * 0.7) * 1.5;
    h.group.position.set(h.x, h.y, h.z);
    h.group.rotation.y = Math.atan2(player.x - h.x, player.z - h.z);
    if (h.rotor) h.rotor.rotation.y += dt * 22;
  }

  // Roadblocks at 4+ stars, ahead of the player.
  if (pol.wanted >= 4 && pol.roadblocks.length === 0) {
    const fx = Math.sin(player.heading || 0), fz = Math.cos(player.heading || 0);
    spawnRoadblock(pol, player.x + fx * 42, player.z + fz * 42, player.heading || 0);
  }
  if (pol.wanted < 4) {
    for (const rb of pol.roadblocks) pol.scene.remove(rb.mesh);
    pol.roadblocks = [];
  }
}

// Dispatch list for the HUD: callsign, tactic, distance in metres.
export function dispatchList(pol, player) {
  const list = [];
  for (const u of pol.units) {
    const d = Math.round(Math.hypot(u.x - player.x, u.z - player.z));
    list.push({ callsign: u.callsign, tactic: u.tactic, dist: d });
  }
  if (pol.heli) {
    const d = Math.round(Math.hypot(pol.heli.x - player.x, pol.heli.z - player.z));
    list.push({ callsign: 'AIR-1', tactic: 'AIR WATCH', dist: d });
  }
  for (const rb of pol.roadblocks) {
    const d = Math.round(Math.hypot(rb.x - player.x, rb.z - player.z));
    list.push({ callsign: 'BLOCK-9', tactic: 'ROADBLOCK', dist: d });
  }
  list.sort((a, b) => a.dist - b.dist);
  return list.slice(0, 5);
}
