// police.js — the Perla Bay PD: wanted levels, pursuit units, helicopter,
// roadblocks and the dispatch list the HUD shows. Unit callsigns are birds
// and fish of the bay, with a tactic and a live distance in metres.

import * as THREE from 'three';
import { randPick, clamp, wrapAngle, angleDiff } from './random.js';
import { resolveBuilding, CITY_HALF, BEACH_Z } from './city.js';

export const CALLSIGNS = [
  'ALBATROS-1', 'CORVINA-2', 'GARZA-3', 'PELICANO-4', 'TIBURON-5',
  'MARLIN-6', 'IBIS-7', 'BARRACUDA-8', 'GULL-9', 'TUNA-10',
  'HERON-11', 'OSPREY-12', 'EGRET-13', 'FALCON-14', 'DORADO-15',
];
export const TACTICS = ['PURSUE', 'RAMMING', 'FLANKING', 'ROADBLOCK', 'CLOSING IN', 'SPOTLIGHT', 'BOXING IN'];
export const AIR_CALLSIGNS = ['AIR-1', 'AIR-2', 'HELI-1'];

export function createPolice(scene) {
  const group = new THREE.Group();
  group.name = 'police';
  scene.add(group);
  return {
    group, scene,
    wanted: 0,
    units: [],
    heli: null,
    heliAngle: 0,
    roadblocks: [],
    heat: 0, // 0..1, builds while seen, decays while hidden
    hiddenTimer: 0,
    nextCallsign: 0,
    lostTimer: 0,
  };
}

function makePoliceMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.7, 4.4),
    new THREE.MeshLambertMaterial({ color: 0x1a1a22 })
  );
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.6, 2.0),
    new THREE.MeshLambertMaterial({ color: 0x223344 })
  );
  cabin.position.set(0, 1.15, -0.2);
  g.add(cabin);
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(2.02, 0.18, 4.42),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  stripe.position.y = 0.72;
  g.add(stripe);
  const light = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.22, 0.5),
    new THREE.MeshBasicMaterial({ color: 0xff3030 })
  );
  light.position.set(0, 1.55, -0.2);
  g.add(light);
  g.userData.light = light;
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x181818 });
  for (const [x, y, z] of [[-0.95, 0.38, 1.45], [0.95, 0.38, 1.45], [-0.95, 0.38, -1.45], [0.95, 0.38, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, y, z);
    g.add(w);
  }
  return g;
}

function makeHeliMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.2, 4.6),
    new THREE.MeshLambertMaterial({ color: 0x222226 })
  );
  body.position.y = 0;
  g.add(body);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.8, 1.4),
    new THREE.MeshLambertMaterial({ color: 0x3a5a7a })
  );
  glass.position.set(0, 0.1, 1.8);
  g.add(glass);
  const rotor = new THREE.Mesh(
    new THREE.BoxGeometry(9, 0.12, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x111111 })
  );
  rotor.position.y = 1.0;
  g.add(rotor);
  g.userData.rotor = rotor;
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(3.2, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff8c0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.y = -13;
  beam.rotation.x = Math.PI;
  g.add(beam);
  return g;
}

export function setWanted(police, level) {
  police.wanted = clamp(Math.round(level), 0, 4);
  if (police.wanted === 0) {
    police.heat = 0;
    police.lostTimer = 0;
  }
}

export function addHeat(police, amount) {
  police.heat = clamp(police.heat + amount, 0, 1);
  if (police.heat > 0.55 && police.wanted < 4) {
    setWanted(police, police.wanted + 1);
    police.heat = 0.25;
  }
}

// Spawn / despawn ground units to match the wanted level, steer chasers.
export function updatePolice(dt, police, player, city, onRam) {
  const wantUnits = police.wanted === 0 ? 0 : police.wanted + 1;
  // Spawn missing units ahead of the player, on the street grid.
  while (police.units.length < wantUnits) {
    const mesh = makePoliceMesh();
    const a = Math.random() * Math.PI * 2;
    const dist = 55 + Math.random() * 45;
    const x = clamp(player.x + Math.cos(a) * dist, -CITY_HALF, CITY_HALF);
    const z = clamp(player.z + Math.sin(a) * dist, -CITY_HALF, BEACH_Z + 40);
    mesh.position.set(x, 0, z);
    police.group.add(mesh);
    const callsign = CALLSIGNS[police.nextCallsign % CALLSIGNS.length];
    police.nextCallsign++;
    police.units.push({
      mesh, callsign, x, z, heading: Math.atan2(player.x - x, player.z - z),
      speed: 0, tactic: randPick(Math.random, TACTICS), blink: Math.random(),
    });
  }
  while (police.units.length > wantUnits) {
    const u = police.units.pop();
    police.group.remove(u.mesh);
  }
  // Helicopter appears at wanted 2+.
  if (police.wanted >= 2 && !police.heli) {
    const mesh = makeHeliMesh();
    police.group.add(mesh);
    police.heli = { mesh, angle: 0 };
  } else if (police.wanted < 2 && police.heli) {
    police.group.remove(police.heli.mesh);
    police.heli = null;
  }
  if (police.heli) {
    police.heli.angle += dt * 0.35;
    const hx = player.x + Math.cos(police.heli.angle) * 26;
    const hz = player.z + Math.sin(police.heli.angle) * 26;
    police.heli.mesh.position.set(hx, 34, hz);
    police.heli.mesh.rotation.y = Math.atan2(player.x - hx, player.z - hz);
    police.heli.mesh.userData.rotor.rotation.y += dt * 22;
    police.heat = clamp(police.heat + dt * 0.02, 0, 1);
  }
  // Chase: steer toward the player, ram on contact, top speed scales with stars.
  const top = 34 + police.wanted * 5;
  for (const u of police.units) {
    const dx = player.x - u.x;
    const dz = player.z - u.z;
    const dist = Math.hypot(dx, dz);
    const wantHeading = Math.atan2(dx, dz);
    const diff = angleDiff(u.heading, wantHeading);
    u.heading += clamp(diff, -2.4 * dt, 2.4 * dt);
    u.speed += ((dist > 14 ? top : top * 0.55) - u.speed) * Math.min(1, 1.6 * dt);
    const nx = u.x + Math.sin(u.heading) * u.speed * dt;
    const nz = u.z + Math.cos(u.heading) * u.speed * dt;
    const res = resolveBuilding(city, nx, nz, 1.6);
    if (res.hit) u.speed *= 0.5;
    u.x = clamp(res.x, -CITY_HALF, CITY_HALF);
    u.z = clamp(res.z, -CITY_HALF, BEACH_Z + 55);
    u.mesh.position.set(u.x, 0, u.z);
    u.mesh.rotation.y = u.heading;
    u.blink += dt * 6;
    u.mesh.userData.light.material.color.setHex(Math.sin(u.blink) > 0 ? 0xff3030 : 0x3050ff);
    if (dist < 3.4) {
      u.speed *= 0.4;
      if (onRam) onRam(u, dist);
    }
    u.tactic = dist > 60 ? 'PURSUE' : dist > 25 ? 'CLOSING IN' : 'RAMMING';
  }
  // Lose the heat: far away + slow for a while drops a star.
  const nearest = police.units.reduce((m, u) => Math.min(m, Math.hypot(u.x - player.x, u.z - player.z)), Infinity);
  if (police.wanted > 0 && nearest > 90) {
    police.lostTimer += dt;
    if (police.lostTimer > 9) {
      setWanted(police, police.wanted - 1);
      police.lostTimer = 0;
    }
  } else {
    police.lostTimer = 0;
  }
}

export function dispatchList(police, player) {
  const list = police.units.map((u) => {
    const d = Math.round(Math.hypot(u.x - player.x, u.z - player.z));
    return { callsign: u.callsign, tactic: u.tactic, dist: d };
  });
  list.sort((a, b) => a.dist - b.dist);
  if (police.heli) {
    list.unshift({ callsign: AIR_CALLSIGNS[0], tactic: 'SPOTLIGHT', dist: 26 });
  }
  return list.slice(0, 7);
}

export function policeCount(police) {
  return police.units.length + (police.heli ? 1 : 0);
}
