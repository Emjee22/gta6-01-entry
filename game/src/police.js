// The Perla PD: wanted levels, pursuit units, the helicopter and roadblocks.
//
// Wanted runs 0-5 stars and is driven by a heat value: crimes add heat,
// staying clean and unseen lets it cool. Units spawn in proportion to the
// wanted level, chase the player, and call out their tactics and distance
// for the dispatch list in the HUD. The helicopter joins at 3 stars, and
// roadblocks appear at 4.
import * as THREE from 'three';
import { createRandom } from './random.js';
import { createCar, CAR_DEFS } from './cars.js';

export const CALLSIGNS = [
  'ALBATROS-12', 'CORVINA-07', 'GARZA-23', 'DELFIN-31', 'GAVIOTA-18',
  'HALCON-44', 'TIBURON-09', 'ANCLA-52', 'FARO-66', 'SIRENA-21',
];

const TACTICS = {
  pursue: 'PURSUIT',
  ram: 'RAMMING',
  flank: 'FLANKING',
  spotlight: 'SPOTLIGHT',
  roadblock: 'ROADBLOCK',
  box: 'BOXING IN',
  close: 'CLOSING IN',
  respond: 'RESPONDING',
};

const POLICE_DEF = { name: 'Perla PD Interceptor', color: 0xe8e8e8, topSpeed: 40, accel: 24, grip: 1.05 };

// A police car: a white interceptor with a red/blue light bar on the roof.
function buildPoliceMesh() {
  const group = new THREE.Group();
  const base = new THREE.Group();
  // Reuse the standard car body by building it through a white def.
  const paint = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.35, metalness: 0.4 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.42), black);
  stripe.position.y = 0.72;
  group.add(stripe);
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2438, roughness: 0.15, metalness: 0.6 });
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glass);
  cabin.position.set(0, 1.1, -0.25);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, black);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  const redBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.18, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xd83030, emissive: 0xff2020, emissiveIntensity: 1.4 }),
  );
  redBar.position.set(-0.35, 1.5, -0.25);
  group.add(redBar);
  const blueBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.18, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x3050d8, emissive: 0x2040ff, emissiveIntensity: 1.4 }),
  );
  blueBar.position.set(0.35, 1.5, -0.25);
  group.add(blueBar);
  group.userData.wheels = wheels;
  group.userData.lightBars = [redBar, blueBar];
  return group;
}

function createPoliceCar(scene, x, z, heading) {
  const mesh = buildPoliceMesh();
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    mesh,
    pos: new THREE.Vector3(x, 0, z),
    heading,
    speed: 0,
    condition: 100,
    syncMesh() {
      this.mesh.position.set(this.pos.x, 0, this.pos.z);
      this.mesh.rotation.y = this.heading;
      const spin = (this.speed * 0.016) / 0.36;
      for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
    },
  };
}

export function createPolice(scene, city, rng) {
  let heat = 0;
  let wanted = 0;
  let bustedTimer = 0;
  let unseenTimer = 0;
  let lastCrimeAt = -100;
  let time = 0;
  const units = [];
  const usedCallsigns = new Set();
  let heli = null;
  let heliRotor = null;
  let heliSpot = null;
  let roadblocks = [];
  let flash = 0;

  function nextCallsign() {
    const free = CALLSIGNS.filter((c) => !usedCallsigns.has(c));
    if (!free.length) return rng.pick(CALLSIGNS);
    const pick = rng.pick(free);
    usedCallsigns.add(pick);
    return pick;
  }

  function addHeat(amount, now) {
    heat = Math.max(0, Math.min(100, heat + amount));
    lastCrimeAt = now;
    const level = Math.min(5, Math.floor(heat / 20));
    if (level > wanted) wanted = level;
  }

  function removeUnit(unit) {
    scene.remove(unit.mesh);
    usedCallsigns.delete(unit.callsign);
    const i = units.indexOf(unit);
    if (i >= 0) units.splice(i, 1);
  }

  function spawnUnit(playerPos) {
    const angle = rng.range(0, Math.PI * 2);
    const dist = rng.range(45, 70);
    let x = playerPos.x + Math.cos(angle) * dist;
    let z = playerPos.z + Math.sin(angle) * dist;
    const clamped = city.clampToCity(x, z);
    x = clamped.x;
    z = clamped.z;
    const car = createPoliceCar(scene, x, z, rng.range(0, Math.PI * 2));
    const unit = {
      car,
      callsign: nextCallsign(),
      tactic: TACTICS.respond,
      state: 'respond',
      stuckTimer: 0,
      flankSide: rng.chance(0.5) ? 1 : -1,
    };
    units.push(unit);
    return unit;
  }

  return {
    get wanted() {
      return wanted;
    },
    get heat() {
      return heat;
    },
    get units() {
      return units;
    },
    get heliActive() {
      return !!heli;
    },
    addHeat,
    // Damage a unit's car (the player shot it). Returns true when the unit
    // is disabled and pulled out of the chase.
    damageUnit(unit, amount) {
      unit.car.condition -= amount;
      if (unit.car.condition <= 0) {
        removeUnit(unit);
        return true;
      }
      return false;
    },
    // The dispatch list the HUD renders: callsign, tactic, distance.
    dispatchList(playerPos) {
      const list = units.map((u) => {
        const d = Math.hypot(u.car.pos.x - playerPos.x, u.car.pos.z - playerPos.z);
        return { callsign: u.callsign, tactic: u.tactic, dist: Math.round(d) };
      });
      if (heli) list.push({ callsign: 'HELI-01', tactic: TACTICS.spotlight, dist: Math.round(Math.hypot(heli.position.x - playerPos.x, heli.position.z - playerPos.z)) });
      return list;
    },
    update,
    // Remove every unit (used when the player is busted or the wanted
    // level is cleared).
    clearAll() {
      while (units.length) removeUnit(units[0]);
      if (heli) {
        scene.remove(heli);
        heli = null;
        heliRotor = null;
        heliSpot = null;
      }
      for (const rb of roadblocks) scene.remove(rb.mesh);
      roadblocks = [];
      heat = 0;
      wanted = 0;
      bustedTimer = 0;
    },
  };

  function update(dt, player, now) {
    time = now;
    const playerPos = player.pos;
    // Target unit count grows with the wanted level.
    const targetUnits = wanted === 0 ? 0 : wanted <= 1 ? 1 : wanted <= 2 ? 2 : wanted <= 3 ? 3 : wanted <= 4 ? 4 : 5;
    while (units.length < targetUnits) spawnUnit(playerPos);
    while (units.length > targetUnits) removeUnit(units[units.length - 1]);

    // Helicopter from 3 stars.
    if (wanted >= 3 && !heli) {
      heli = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 1.6, 6),
        new THREE.MeshStandardMaterial({ color: 0x2a2a34, roughness: 0.6, metalness: 0.4 }),
      );
      body.castShadow = true;
      heli.add(body);
      const tail = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.8, 5),
        new THREE.MeshStandardMaterial({ color: 0x2a2a34, roughness: 0.6, metalness: 0.4 }),
      );
      tail.position.set(0, 0.3, -5);
      heli.add(tail);
      heliRotor = new THREE.Mesh(
        new THREE.BoxGeometry(12, 0.12, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.5, metalness: 0.5 }),
      );
      heliRotor.position.y = 1.1;
      heli.add(heliRotor);
      heliSpot = new THREE.SpotLight(0xfff2c0, 900, 160, 0.32, 0.5, 1.2);
      heli.add(heliSpot);
      heli.add(heliSpot.target);
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(9, 42, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }),
      );
      cone.position.y = -21;
      cone.rotation.x = Math.PI;
      heli.add(cone);
      heli.position.set(playerPos.x + 20, 46, playerPos.z - 20);
      scene.add(heli);
    } else if (wanted < 3 && heli) {
      scene.remove(heli);
      heli = null;
      heliRotor = null;
      heliSpot = null;
    }
    if (heli) {
      heli.position.x += (playerPos.x - heli.position.x) * Math.min(1, dt * 0.9);
      heli.position.z += (playerPos.z - heli.position.z) * Math.min(1, dt * 0.9);
      heli.position.y = 46 + Math.sin(now * 0.7) * 1.5;
      heli.rotation.y = Math.atan2(playerPos.x - heli.position.x, playerPos.z - heli.position.z);
      heliRotor.rotation.y += dt * 22;
      heliSpot.target.position.set(playerPos.x - heli.position.x, -46, playerPos.z - heli.position.z);
    }

    // Roadblocks from 4 stars: two parked interceptors across the road
    // ahead of the player, repositioned every few seconds.
    if (wanted >= 4 && roadblocks.length === 0) {
      for (const side of [-1, 1]) {
        const car = createPoliceCar(scene, playerPos.x + side * 3, playerPos.z + 30, Math.PI / 2);
        roadblocks.push({ mesh: car.mesh, car, side, retargetAt: now + 4 });
      }
    } else if (wanted < 4 && roadblocks.length) {
      for (const rb of roadblocks) scene.remove(rb.mesh);
      roadblocks = [];
    }
    for (const rb of roadblocks) {
      if (now > rb.retargetAt) {
        rb.retargetAt = now + 4;
        const ahead = player.inCar ? 34 : 22;
        const fx = Math.sin(player.heading) * ahead;
        const fz = Math.cos(player.heading) * ahead;
        const px = playerPos.x + fx + rb.side * 3;
        const pz = playerPos.z + fz;
        const clamped = city.clampToCity(px, pz);
        rb.car.pos.set(clamped.x, 0, clamped.z);
        rb.car.heading = player.heading + Math.PI / 2;
        rb.car.syncMesh();
      }
    }

    // Chase each unit.
    let nearestDist = Infinity;
    for (const unit of units) {
      const car = unit.car;
      const dx = playerPos.x - car.pos.x;
      const dz = playerPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      nearestDist = Math.min(nearestDist, dist);
      const desired = Math.atan2(dx, dz);
      let diff = desired - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      // If the way ahead is blocked, slide along the wall instead.
      const aheadX = car.pos.x + Math.sin(car.heading) * 6;
      const aheadZ = car.pos.z + Math.cos(car.heading) * 6;
      const blocked = city.blocked(aheadX, aheadZ);
      if (blocked) {
        unit.stuckTimer += dt;
        diff += unit.flankSide * 1.1;
      } else {
        unit.stuckTimer = 0;
      }
      const topSpeed = 30 + wanted * 2.2;
      car.speed = Math.min(topSpeed, car.speed + 26 * dt);
      if (dist < 6) car.speed = Math.min(car.speed, 12);
      car.heading += Math.max(-2.4, Math.min(2.4, diff * 2.2)) * dt;
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      const clamped = city.clampToCity(car.pos.x, car.pos.z);
      car.pos.x = clamped.x;
      car.pos.z = clamped.z;
      // Ramming: touching the player's car damages it and slows it.
      if (dist < 3.4 && player.inCar && player.car) {
        player.car.speed *= 1 - 1.6 * dt;
        player.car.condition = Math.max(0, player.car.condition - 9 * dt);
        unit.tactic = TACTICS.ram;
        unit.state = 'ram';
      } else if (dist < 14) {
        unit.tactic = TACTICS.close;
        unit.state = 'close';
      } else if (unit.flankSide > 0 && dist < 40) {
        unit.tactic = TACTICS.flank;
        unit.state = 'flank';
      } else {
        unit.tactic = TACTICS.pursue;
        unit.state = 'pursue';
      }
      car.syncMesh();
    }
    // Flash the light bars alternately.
    flash += dt;
    if (flash > 0.35) {
      flash = 0;
      for (const unit of units) {
        const [red, blue] = unit.car.mesh.userData.lightBars;
        const swap = red.material.emissiveIntensity > 0.5;
        red.material.emissiveIntensity = swap ? 0.15 : 1.6;
        blue.material.emissiveIntensity = swap ? 1.6 : 0.15;
      }
    }

    // Busted: a unit holds the player on foot, or the car is boxed in.
    if (wanted > 0) {
      const onFootClose = !player.inCar && nearestDist < 3.2;
      const boxed = player.inCar && player.car && Math.abs(player.car.speed) < 1 && nearestDist < 5 && units.length >= 2;
      if (onFootClose || boxed) bustedTimer += dt;
      else bustedTimer = 0;
      if (bustedTimer > 3) {
        bustedTimer = 0;
        if (player.onBusted) player.onBusted();
      }
    } else {
      bustedTimer = 0;
    }

    // Heat cools when the player is unseen and has not offended lately.
    if (nearestDist > 60 && now - lastCrimeAt > 8) {
      unseenTimer += dt;
      if (unseenTimer > 4) {
        heat = Math.max(0, heat - 6 * dt);
        const level = Math.min(5, Math.floor(heat / 20));
        if (level < wanted) wanted = level;
      }
    } else {
      unseenTimer = 0;
    }
  }
}

// Distance to the nearest pursuing unit, in meters. The HUD and the siren
// use it to know how hot the chase is.
export function nearestUnitDistance(police, playerPos) {
  let best = Infinity;
  for (const u of police.units) {
    const d = Math.hypot(u.car.pos.x - playerPos.x, u.car.pos.z - playerPos.z);
    if (d < best) best = d;
  }
  return best;
}

// A one-line summary of the chase, for the pause screen and the HUD.
export function chaseSummary(police, playerPos) {
  if (police.wanted === 0) return 'No heat. The streets are calm.';
  const d = nearestUnitDistance(police, playerPos);
  const near = Number.isFinite(d) ? `${Math.round(d)} m` : '—';
  return `Wanted ${police.wanted}★ — ${police.units.length} unit${police.units.length === 1 ? '' : 's'} on you, nearest ${near}${police.heliActive ? ', heli overhead' : ''}.`;
}
