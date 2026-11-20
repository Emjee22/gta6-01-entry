// police.js — wanted level, patrol cars, helicopter and roadblocks.
// Dispatch units carry bird/fish callsigns and a tactic; the HUD lists them
// with their distance to the player. Heat rises when the player is seen
// breaking the law and cools when the patrol loses sight of them.

import * as THREE from 'three';
import { makeCarMesh, CAR_MODELS } from './cars.js';

export const CALLSIGNS = [
  'AIR-1', 'GULL-1', 'MARLIN-5', 'IBIS-9', 'BLOCK-9',
  'HERON-2', 'TUNA-7', 'PELICAN-3', 'RAY-4', 'CRANE-6',
];

const TACTICS = ['PURSUIT', 'CORDON', 'ROADBLOCK', 'AIR WATCH', 'INTERCEPT'];
const POLICE_MODEL = CAR_MODELS[3]; // Brisa Sedan body, repainted by makeCarMesh

export function createPolice(scene, rng) {
  return {
    wanted: 0,
    heat: 0,
    units: [],
    heli: null,
    roadblock: [],
    scene,
    rng,
    seenTimer: 0,
    unseenTimer: 0,
    sirenPhase: 0,
  };
}

export function setWanted(police, n) {
  police.wanted = Math.max(0, Math.min(5, Math.round(n)));
  police.heat = police.wanted * 20;
}

export function addHeat(police, amount) {
  police.heat = Math.min(110, police.heat + amount);
  const level = Math.floor(police.heat / 22);
  if (level > police.wanted) police.wanted = Math.min(5, level);
}

function spawnUnit(police, x, z, callsign, tactic) {
  const mesh = makeCarMesh(POLICE_MODEL, { police: true });
  mesh.position.set(x, 0, z);
  police.scene.add(mesh);
  const unit = {
    mesh, x, z, heading: 0, speed: 0,
    callsign, tactic,
    wobble: police.rng.range(0, Math.PI * 2),
  };
  police.units.push(unit);
  return unit;
}

function spawnHeli(police, x, z) {
  if (police.heli) return police.heli;
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 1.4, 5.2),
    new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.5 }),
  );
  body.position.y = 0;
  g.add(body);
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, 0.4, 5.3),
    new THREE.MeshStandardMaterial({ color: 0xc22a2a, roughness: 0.5 }),
  );
  stripe.position.y = 0.2;
  g.add(stripe);
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 4.5),
    new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.5 }),
  );
  tail.position.set(0, 0.2, 4.2);
  g.add(tail);
  const rotor = new THREE.Mesh(
    new THREE.BoxGeometry(9, 0.12, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 }),
  );
  rotor.position.y = 1.0;
  g.add(rotor);
  // Searchlight: a translucent cone pointing down.
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(5, 16, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.16, side: THREE.DoubleSide }),
  );
  cone.position.y = -8;
  cone.rotation.x = Math.PI;
  g.add(cone);
  g.position.set(x, 24, z);
  police.scene.add(g);
  police.heli = { mesh: g, rotor, x, z, y: 24, angle: 0 };
  return police.heli;
}

// Keep the right number of units for the wanted level, chase the player,
// fly the helicopter above them and hold a roadblock ahead of them.
export function updatePolice(dt, police, player) {
  const rng = police.rng;
  const want = police.wanted;
  const targetUnits = want === 0 ? 0 : Math.min(2 + want, 7);
  // Spawn units at a distance, spread around the player.
  while (police.units.length < targetUnits) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(55, 90);
    const callsign = CALLSIGNS[police.units.length % CALLSIGNS.length];
    const tactic = TACTICS[police.units.length % TACTICS.length];
    spawnUnit(police, player.x + Math.cos(a) * d, player.z + Math.sin(a) * d, callsign, tactic);
  }
  while (police.units.length > targetUnits) {
    const u = police.units.pop();
    police.scene.remove(u.mesh);
  }
  // Helicopter from wanted 3 up.
  if (want >= 3) {
    spawnHeli(police, player.x + 12, player.z - 12);
  } else if (police.heli) {
    police.scene.remove(police.heli.mesh);
    police.heli = null;
  }
  // Roadblock: two patrol cars across the road ahead of the player.
  if (want >= 2 && police.roadblock.length === 0) {
    const fx = Math.sin(player.heading);
    const fz = Math.cos(player.heading);
    const bx = player.x + fx * 42;
    const bz = player.z + fz * 42;
    for (const side of [-6, 6]) {
      const px = bx + Math.cos(player.heading) * side;
      const pz = bz - Math.sin(player.heading) * side;
      const m = makeCarMesh(POLICE_MODEL, { police: true });
      m.position.set(px, 0, pz);
      m.rotation.y = player.heading + Math.PI / 2;
      police.scene.add(m);
      police.roadblock.push({ mesh: m, x: px, z: pz });
    }
  }
  if (want < 2 && police.roadblock.length > 0) {
    for (const b of police.roadblock) police.scene.remove(b.mesh);
    police.roadblock = [];
  }

  // Chase: steer toward the player, accelerate, ram gently.
  for (const u of police.units) {
    const dx = player.x - u.x;
    const dz = player.z - u.z;
    const dist = Math.hypot(dx, dz) || 1;
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - u.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    u.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
    const top = 16 + want * 4;
    u.speed = Math.min(top, u.speed + 14 * dt);
    // Ease off when right on top of the player so they ram instead of orbit.
    if (dist < 6) u.speed = Math.max(6, u.speed - 20 * dt);
    u.x += Math.sin(u.heading) * u.speed * dt;
    u.z += Math.cos(u.heading) * u.speed * dt;
    u.mesh.position.set(u.x, 0, u.z);
    u.mesh.rotation.y = u.heading;
    // Flash the light bar.
    if (u.mesh.userData.lightBar) {
      u.mesh.userData.lightBar.visible = Math.floor(performance.now() / 280) % 2 === 0;
    }
  }

  // Helicopter: circle above the player, rotor spinning.
  if (police.heli) {
    const h = police.heli;
    h.angle += dt * 0.5;
    h.x = player.x + Math.cos(h.angle) * 14;
    h.z = player.z + Math.sin(h.angle) * 14;
    h.mesh.position.set(h.x, h.y, h.z);
    h.mesh.rotation.y = Math.atan2(player.x - h.x, player.z - h.z);
    h.rotor.rotation.y += dt * 22;
  }

  // Heat: cools when the player is out of every unit's sight.
  const nearest = police.units.reduce((m, u) => {
    const d = Math.hypot(u.x - player.x, u.z - player.z);
    return Math.min(m, d);
  }, Infinity);
  if (want > 0) {
    if (nearest < 70) {
      police.unseenTimer = 0;
      police.seenTimer += dt;
    } else {
      police.unseenTimer += dt;
      if (police.unseenTimer > 9) {
        police.wanted = Math.max(0, police.wanted - 1);
        police.heat = police.wanted * 20;
        police.unseenTimer = 0;
      }
    }
  }
  police.sirenPhase += dt;
}

// The dispatch list for the HUD: callsign, tactic, distance in metres.
export function getDispatch(police, player) {
  const rows = police.units.map((u) => ({
    callsign: u.callsign,
    tactic: u.tactic,
    dist: Math.round(Math.hypot(u.x - player.x, u.z - player.z)),
  }));
  rows.sort((a, b) => a.dist - b.dist);
  if (police.heli) rows.unshift({ callsign: 'AIR-1', tactic: 'AIR WATCH', dist: 24 });
  return rows.slice(0, 5);
}

// Force-spawn units ahead of the player (used by screenshot staging).
export function forceSpawnAhead(police, player, count) {
  const rng = police.rng;
  for (let i = 0; i < count; i++) {
    const ahead = 35 + i * 9;
    const side = (i % 2 === 0 ? 1 : -1) * (6 + rng.range(0, 8));
    const fx = Math.sin(player.heading);
    const fz = Math.cos(player.heading);
    const x = player.x + fx * ahead + Math.cos(player.heading) * side;
    const z = player.z + fz * ahead - Math.sin(player.heading) * side;
    const callsign = CALLSIGNS[(police.units.length + i) % CALLSIGNS.length];
    spawnUnit(police, x, z, callsign, 'PURSUIT');
  }
}
