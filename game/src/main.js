// Perla Bay — the game itself.
//
// An open-world crime game in a sunset coastal city. Walk the streets, steal
// a car, outrun the Perla PD, and run eight story missions with your crew.
// Everything is built from the modules in src/: city, cars, police,
// missions, hud, audio, save, input, render, random and shots.
import * as THREE from 'three';
import { createRandom, seedFromString } from './random.js';
import { createInput, moveVector } from './input.js';
import { buildCity, CITY_HALF, BEACH_Z } from './city.js';
import { createRenderer, createSkyAndLights, createCamera, followCamera, createCameraState, handleResize } from './render.js';
import { CAR_DEFS, createCar, drivePlayerCar, createTraffic, createPedestrians } from './cars.js';
import { createPolice, nearestUnitDistance } from './police.js';
import { MISSIONS, createMissions } from './missions.js';
import { createHud, updateHud, respectFor } from './hud.js';
import { createAudio, createRadio } from './audio.js';
import { loadSave, writeSave, clearSave, hasSave } from './save.js';
import { parseShot, SHOT_DEFS, createShotRunner, isKnownShot } from './shots.js';

const WORLD_SEED = 20261120;
const GARAGE = { x: 48, z: 96 };

function buildPlayerMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.36, 0.9, 3, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a7bd8, roughness: 0.85 }),
  );
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8a080, roughness: 0.9 }),
  );
  head.position.y = 1.98;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(0.32, 0.3, 10),
    new THREE.MeshStandardMaterial({ color: 0xd84a4a, roughness: 0.8 }),
  );
  cap.position.y = 2.2;
  group.add(cap);
  return group;
}

export function createGame() {
  const canvas = document.getElementById('game-canvas');
  const renderer = createRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = createCamera();
  const camState = createCameraState(camera);
  createSkyAndLights(scene);
  const city = buildCity(scene, WORLD_SEED);
  const rng = createRandom(WORLD_SEED);
  const input = createInput(canvas);
  const audio = createAudio();
  const radio = createRadio(audio);
  const hud = createHud(document);
  const traffic = createTraffic(scene, city, rng, 14);
  const pedestrians = createPedestrians(scene, city, rng, 22);
  const police = createPolice(scene, city, rng);
  const missions = createMissions(scene, city, police);

  // The player: on foot until they get in a car.
  const playerMesh = buildPlayerMesh();
  scene.add(playerMesh);
  const player = {
    mesh: playerMesh,
    pos: new THREE.Vector3(0, 0, 60),
    heading: Math.PI,
    camYaw: Math.PI,
    camPitch: 0.32,
    speed: 0,
    vy: 0,
    onGround: true,
    inCar: false,
    car: null,
    health: 100,
    armour: 50,
    money: 250,
    respectXp: 0,
    missionsDone: [],
    currentMission: 0,
    weapons: [
      { name: 'Fists', ammo: Infinity },
      { name: 'Pistol', ammo: 24 },
      { name: 'SMG', ammo: 0 },
      { name: 'Shotgun', ammo: 0 },
    ],
    weaponIndex: 1,
    crewCooldownQ: 0,
    crewCooldownE: 0,
    driftMoney: 0,
  };

  let state = 'start';
  let time = 0;
  let cameraMode = 'follow';
  let shotRunner = null;
  let shotFrozen = false;
  let autosaveTimer = 0;
  const tracers = [];
  const pickups = [];
  let lastNearMissAt = -10;

  // Health and armour pickups scattered around the city.
  const pickupDefs = [
    { kind: 'health', x: -48, z: 48, color: 0xe84a4a },
    { kind: 'health', x: 96, z: -144, color: 0xe84a4a },
    { kind: 'armour', x: -144, z: 144, color: 0x4a8ad8 },
    { kind: 'armour', x: 144, z: -96, color: 0x4a8ad8 },
  ];
  for (const def of pickupDefs) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.4, 1.4),
      new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 0.5 }),
    );
    mesh.position.set(def.x, 1.2, def.z);
    scene.add(mesh);
    pickups.push({ ...def, mesh, taken: false, respawnAt: 0 });
  }

  function saveGame() {
    writeSave({
      money: player.money,
      respectXp: player.respectXp,
      missionsDone: player.missionsDone,
      currentMission: player.currentMission,
      settings: { muted: audio.muted, radioStation: radio.stationIndex },
    });
  }

  function applySave(save) {
    player.money = save.money;
    player.respectXp = save.respectXp;
    player.missionsDone = save.missionsDone.slice();
    player.currentMission = save.currentMission;
    audio.setMuted(save.settings.muted);
    radio.setStation(save.settings.radioStation);
  }

  function enterCar(car, stolen) {
    player.inCar = true;
    player.car = car;
    player.mesh.visible = false;
    car.owned = true;
    traffic.takeParked(car);
    radio.start();
    audio.click();
    if (stolen) {
      police.addHeat(25, time);
      hud.toast('Car stolen — the PD has been called!');
    }
  }

  function exitCar() {
    if (!player.car) return;
    const car = player.car;
    player.inCar = false;
    player.car = null;
    player.mesh.visible = true;
    const side = new THREE.Vector3(Math.cos(car.heading), 0, -Math.sin(car.heading));
    player.pos.set(car.pos.x + side.x * 2.2, 0, car.pos.z + side.z * 2.2);
    player.heading = car.heading;
    player.camYaw = car.heading;
    traffic.returnParked(car);
    radio.stop();
  }

  function teleportPlayer(x, z, heading) {
    player.pos.set(x, 0, z);
    player.heading = heading;
    player.camYaw = heading;
    player.mesh.position.set(x, 0, z);
    player.mesh.rotation.y = heading;
  }

  function enterCarByDef(name, x, z, heading) {
    const def = CAR_DEFS.find((d) => d.name === name) || CAR_DEFS[0];
    const car = createCar(scene, def, x, z, heading);
    enterCar(car, false);
    return car;
  }

  function setWanted(level) {
    police.addHeat(level * 20 - police.heat, time);
  }

  function startMission(index) {
    if (missions.start(index, time)) {
      player.currentMission = index;
    }
  }

  function respawnAfterBusted(reason) {
    const lost = Math.min(player.money, Math.max(50, Math.floor(player.money * 0.1)));
    player.money -= lost;
    player.health = 100;
    player.armour = 50;
    if (player.inCar) {
      const car = player.car;
      player.inCar = false;
      player.car = null;
      player.mesh.visible = true;
      traffic.returnParked(car);
    }
    police.clearAll();
    radio.stop();
    teleportPlayer(GARAGE.x, GARAGE.z + 8, Math.PI);
    missions.onBusted();
    saveGame();
    state = 'busted';
    hud.showBusted(`${reason} You lost $${lost}. The crew picked you up at the garage.`);
  }

  // Wire the mission callbacks to the HUD and the save.
  missions.hooks.onDialogue = (lines) => {
    let i = 0;
    const showNext = () => {
      if (i >= lines.length) {
        hud.hideDialogue();
        return;
      }
      const line = lines[i];
      i += 1;
      const color = line.who === 'Celia Mar' ? '#c96a5a' : line.who === 'Tomas Ibarra' ? '#3a7bd8' : line.who === 'Nadia Solis' ? '#7a5ac9' : '#5a5a6a';
      hud.showDialogue(line.who, line.text, color);
      setTimeout(showNext, 5200);
    };
    showNext();
  };
  missions.hooks.onStage = (title, stage, stages, text, timeLimit) => {
    hud.toast(`Mission: ${title} — ${text}`);
  };
  missions.hooks.onComplete = (mission) => {
    player.money += mission.reward.money;
    player.respectXp += mission.reward.xp;
    player.weapons[1].ammo += 12;
    player.weapons[2].ammo += 30;
    player.weapons[3].ammo += 6;
    if (!player.missionsDone.includes(mission.id)) player.missionsDone.push(mission.id);
    audio.chime();
    hud.toast(`Mission complete: ${mission.title}! +$${mission.reward.money}, +${mission.reward.xp} XP`);
    saveGame();
    const next = mission.id;
    if (next < MISSIONS.length) {
      setTimeout(() => {
        if (state === 'playing') startMission(next);
      }, 4000);
    } else {
      hud.toast('You finished the story of Perla Bay. Free roam — the city is yours.');
    }
  };
  missions.hooks.onFail = (mission, reason) => {
    hud.toast(`Mission failed: ${mission.title} — ${reason} Talk to Celia at the garage to retry.`);
    saveGame();
  };

  return {
    scene, camera, renderer, canvas, city, rng, input, audio, radio, hud,
    traffic, pedestrians, police, missions, player, pickups, tracers,
    get state() { return state; },
    set state(v) { state = v; },
    get time() { return time; },
    set time(v) { time = v; },
    get cameraMode() { return cameraMode; },
    set cameraMode(v) { cameraMode = v; },
    get shotRunner() { return shotRunner; },
    set shotRunner(v) { shotRunner = v; },
    get shotFrozen() { return shotFrozen; },
    set shotFrozen(v) { shotFrozen = v; },
    get autosaveTimer() { return autosaveTimer; },
    set autosaveTimer(v) { autosaveTimer = v; },
    get lastNearMissAt() { return lastNearMissAt; },
    set lastNearMissAt(v) { lastNearMissAt = v; },
    camState,
    saveGame, applySave, enterCar, exitCar, teleportPlayer, enterCarByDef,
    setWanted, startMission, respawnAfterBusted,
  };
}

// The world simulation step: everything that advances without player input.
// The real game loop calls updatePlayer first, then this; the screenshot
// staging calls this directly with an autopilot driving the player.
export function updateWorld(g, dt) {
  g.time += dt;
  const p = g.player;
  g.traffic.update(dt, p.inCar ? p.car : null);
  g.pedestrians.update(dt);
  for (const ped of g.pedestrians.peds) {
    if (ped.down && g.time > ped.downUntil) {
      ped.down = false;
      ped.group.visible = true;
    }
  }
  const policePlayer = {
    pos: p.pos,
    inCar: p.inCar,
    car: p.car,
    heading: p.inCar && p.car ? p.car.heading : p.heading,
    onBusted: () => g.respawnAfterBusted('Busted by the Perla PD.'),
  };
  g.police.update(dt, policePlayer, g.time);
  g.missions.update(dt, {
    playerPos: p.pos,
    inCar: p.inCar,
    car: p.car,
    police: g.police,
    time: g.time,
  });
  // The ferris wheel turns, the clouds drift.
  if (g.city.ferrisWheel && g.city.ferrisWheel.wheel) g.city.ferrisWheel.wheel.rotation.z += dt * 0.05;
  for (const cloud of g.city.clouds) {
    cloud.position.x += dt * 1.2;
    if (cloud.position.x > 340) cloud.position.x = -340;
  }
  // Tracers fade out fast.
  for (let i = g.tracers.length - 1; i >= 0; i -= 1) {
    const t = g.tracers[i];
    t.life -= dt;
    if (t.life <= 0) {
      g.scene.remove(t.line);
      g.tracers.splice(i, 1);
    }
  }
  // Pickups: collect on touch, respawn after a minute.
  for (const pk of g.pickups) {
    if (pk.taken) {
      if (g.time > pk.respawnAt) {
        pk.taken = false;
        pk.mesh.visible = true;
      }
      continue;
    }
    pk.mesh.rotation.y += dt * 1.5;
    pk.mesh.position.y = 1.2 + Math.sin(g.time * 2 + pk.x) * 0.15;
    if (Math.hypot(p.pos.x - pk.x, p.pos.z - pk.z) < 2.2) {
      pk.taken = true;
      pk.mesh.visible = false;
      pk.respawnAt = g.time + 60;
      if (pk.kind === 'health') {
        p.health = Math.min(100, p.health + 50);
        g.hud.toast('Health +50');
      } else {
        p.armour = Math.min(100, p.armour + 50);
        g.hud.toast('Armour +50');
      }
      g.audio.chime();
    }
  }
  // Audio follows the car and the chase.
  const speed01 = p.inCar && p.car ? Math.min(1, Math.abs(p.car.speed) / 40) : 0;
  g.audio.engine(speed01, p.inCar);
  const nearest = nearestUnitDistance(g.police, p.pos);
  g.audio.siren(g.police.wanted > 0 && nearest < 70, dt);
  if (g.radio.playing) g.radio.tick(dt);
  g.audio.update(dt);
  // Autosave every 30 seconds of play.
  g.autosaveTimer += dt;
  if (g.autosaveTimer > 30) {
    g.autosaveTimer = 0;
    g.saveGame();
  }
  // Crew cooldowns tick down.
  p.crewCooldownQ = Math.max(0, p.crewCooldownQ - dt);
  p.crewCooldownE = Math.max(0, p.crewCooldownE - dt);
}

// Walking: WASD relative to the camera, Shift to run, Space to jump.
export function updateOnFoot(g, dt) {
  const p = g.player;
  const input = g.input;
  const mouse = input.takeMouse();
  if (input.locked || input.mouseDown) {
    p.camYaw -= mouse.dx * 0.0032;
    p.camPitch = Math.max(0.05, Math.min(1.1, p.camPitch + mouse.dy * 0.0022));
  }
  const mv = moveVector(input);
  const run = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  const speed = run ? 10 : 6;
  const fx = Math.sin(p.camYaw);
  const fz = Math.cos(p.camYaw);
  const rx = Math.cos(p.camYaw);
  const rz = -Math.sin(p.camYaw);
  const mx = fx * mv.y + rx * mv.x;
  const mz = fz * mv.y + rz * mv.x;
  const moving = Math.hypot(mx, mz) > 0.01;
  if (moving) {
    const targetHeading = Math.atan2(mx, mz);
    let diff = targetHeading - p.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    p.heading += Math.max(-8 * dt, Math.min(8 * dt, diff));
    const nx = p.pos.x + mx * speed * dt;
    const nz = p.pos.z + mz * speed * dt;
    if (!g.city.blocked(nx, p.pos.z)) p.pos.x = nx;
    if (!g.city.blocked(p.pos.x, nz)) p.pos.z = nz;
    const clamped = g.city.clampToCity(p.pos.x, p.pos.z);
    p.pos.x = clamped.x;
    p.pos.z = Math.min(clamped.z, 235);
    p.speed = speed;
  } else {
    p.speed = 0;
  }
  if (input.pressed('Space') && p.onGround) {
    p.vy = 8;
    p.onGround = false;
  }
  if (!p.onGround) {
    p.vy -= 22 * dt;
    p.pos.y += p.vy * dt;
    if (p.pos.y <= 0) {
      p.pos.y = 0;
      p.vy = 0;
      p.onGround = true;
    }
  }
  // A police car ramming the player on foot hurts.
  for (const unit of g.police.units) {
    const d = Math.hypot(unit.car.pos.x - p.pos.x, unit.car.pos.z - p.pos.z);
    if (d < 2.6 && Math.abs(unit.car.speed) > 4) {
      const absorbed = Math.min(p.armour, 12 * dt * 10);
      p.armour -= absorbed;
      p.health -= (12 * dt * 10 - absorbed) * 0.5;
      p.pos.x += (p.pos.x - unit.car.pos.x) * dt * 2;
      p.pos.z += (p.pos.z - unit.car.pos.z) * dt * 2;
      if (p.health <= 0) {
        g.respawnAfterBusted('Wasted by the Perla PD.');
        return;
      }
    }
  }
  p.mesh.position.set(p.pos.x, p.pos.y, p.pos.z);
  p.mesh.rotation.y = p.heading;
  // Walk bob.
  p.mesh.position.y = p.pos.y + (moving ? Math.abs(Math.sin(g.time * 9)) * 0.06 : 0);
}

// Driving: the car physics live in cars.js; here are the bonuses.
export function updateDriving(g, dt) {
  const p = g.player;
  const car = p.car;
  const before = car.speed;
  drivePlayerCar(car, g.input, dt, g.city);
  // Drift bonus: bank it while drifting, pay it when the drift ends.
  if (car.drifting) {
    p.driftMoney += 10 * dt;
  } else if (p.driftMoney > 5) {
    const bonus = Math.floor(p.driftMoney);
    p.money += bonus;
    p.respectXp += Math.floor(bonus / 10);
    if (bonus >= 25) g.hud.toast(`Drift bonus +$${bonus}`);
    p.driftMoney = 0;
  }
  // Near-miss bonus: fast, close, no contact.
  if (Math.abs(car.speed) > 20 && g.time - g.lastNearMissAt > 2) {
    for (const t of g.traffic.cars) {
      const d = Math.hypot(t.pos.x - car.pos.x, t.pos.z - car.pos.z);
      if (d < 3.6 && d > 2.2) {
        g.lastNearMissAt = g.time;
        p.money += 25;
        p.respectXp += 10;
        g.hud.toast('Near miss +$25');
        break;
      }
    }
  }
  if (car.condition <= 0) {
    g.hud.toast('Your car is wrecked — get out and find another.');
  }
  // The car is the camera's anchor.
  p.pos.copy(car.pos);
  p.heading = car.heading;
}

// Shooting: a tracer, a sound, and a hit check in a narrow cone ahead.
// Fists are a short melee; guns spend ammo. Hitting a pedestrian or a unit
// brings heat, as it should.
export function shoot(g) {
  const p = g.player;
  const weapon = p.weapons[p.weaponIndex];
  const heading = p.inCar && p.car ? p.car.heading : p.heading;
  const origin = new THREE.Vector3(p.pos.x, 1.4, p.pos.z);
  const dir = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
  if (weapon.name === 'Fists') {
    g.audio.thud(0.7);
    const range = 2.6;
    let best = null;
    let bestD = range;
    for (const ped of g.pedestrians.peds) {
      if (ped.down) continue;
      const d = Math.hypot(ped.x - p.pos.x, ped.z - p.pos.z);
      if (d >= bestD) continue;
      const ang = Math.abs(angleDiff(Math.atan2(ped.x - p.pos.x, ped.z - p.pos.z), heading));
      if (ang < 0.5) {
        best = { kind: 'ped', ped };
        bestD = d;
      }
    }
    if (best) {
      best.ped.down = true;
      best.ped.downUntil = g.time + 20;
      best.ped.group.visible = false;
      g.police.addHeat(20, g.time);
      g.hud.toast('You knocked someone down — the PD was called!');
    }
    return;
  }
  if (weapon.ammo <= 0) {
    g.hud.toast('Out of ammo — finish a mission to restock.');
    return;
  }
  weapon.ammo -= 1;
  g.audio.shot();
  const range = 32;
  let best = null;
  let bestD = range;
  for (const ped of g.pedestrians.peds) {
    if (ped.down) continue;
    const d = Math.hypot(ped.x - p.pos.x, ped.z - p.pos.z);
    if (d >= bestD) continue;
    const ang = Math.abs(angleDiff(Math.atan2(ped.x - p.pos.x, ped.z - p.pos.z), heading));
    if (ang < 0.26) {
      best = { kind: 'ped', ped };
      bestD = d;
    }
  }
  for (const unit of g.police.units) {
    const d = Math.hypot(unit.car.pos.x - p.pos.x, unit.car.pos.z - p.pos.z);
    if (d >= bestD) continue;
    const ang = Math.abs(angleDiff(Math.atan2(unit.car.pos.x - p.pos.x, unit.car.pos.z - p.pos.z), heading));
    if (ang < 0.26) {
      best = { kind: 'unit', unit };
      bestD = d;
    }
  }
  const end = origin.clone().addScaledVector(dir, best ? bestD : range);
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([origin, end]),
    new THREE.LineBasicMaterial({ color: 0xffe8a0, transparent: true, opacity: 0.9 }),
  );
  g.scene.add(line);
  g.tracers.push({ line, life: 0.09 });
  if (!best) return;
  if (best.kind === 'ped') {
    best.ped.down = true;
    best.ped.downUntil = g.time + 20;
    best.ped.group.visible = false;
    g.police.addHeat(30, g.time);
    g.hud.toast('You hit a pedestrian — the PD was called!');
  } else {
    const disabled = g.police.damageUnit(best.unit, 25);
    g.police.addHeat(10, g.time);
    g.hud.toast(disabled ? 'Police unit disabled!' : 'Hit! That unit is smoking.');
  }
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Crew abilities. Q calls Tomas with a getaway car; E has Nadia scramble
// the PD dispatch and cool the heat. Both have real cooldowns.
export function useCrewAbility(g, key) {
  const p = g.player;
  if (key === 'KeyQ') {
    if (p.crewCooldownQ > 0) {
      g.hud.toast(`Tomas is busy — ${Math.ceil(p.crewCooldownQ)}s left.`);
      return;
    }
    p.crewCooldownQ = 60;
    const def = CAR_DEFS.find((d) => d.name === 'Arena Roadster');
    const ahead = p.inCar && p.car ? p.car.heading : p.heading;
    const x = p.pos.x + Math.sin(ahead) * 12;
    const z = p.pos.z + Math.cos(ahead) * 12;
    const clamped = g.city.clampToCity(x, z);
    const car = createCar(g.scene, def, clamped.x, clamped.z, ahead);
    car.owned = true;
    g.traffic.returnParked(car);
    g.audio.chime();
    g.hud.toast('Tomas dropped off a getaway car nearby.');
  } else if (key === 'KeyE') {
    if (p.crewCooldownE > 0) {
      g.hud.toast(`Nadia is busy — ${Math.ceil(p.crewCooldownE)}s left.`);
      return;
    }
    p.crewCooldownE = 45;
    g.police.addHeat(-25, g.time);
    g.audio.chime();
    g.hud.toast('Nadia scrambled the PD dispatch — heat is dropping.');
  }
}

// The camera: behind the player on foot, behind the car while driving, and
// a fixed high view for the city shot.
export function updateCamera(g, dt) {
  const p = g.player;
  if (g.cameraMode === 'city') {
    const target = new THREE.Vector3(150, 130, 430);
    g.camera.position.lerp(target, 1 - Math.pow(0.01, dt));
    g.camera.lookAt(-60, 15, 180);
    return;
  }
  if (p.inCar && p.car) {
    followCamera(g.camera, p.car.pos, p.car.heading, 11, 4.6, dt, g.camState);
  } else {
    followCamera(g.camera, p.pos, p.camYaw, 7, 3.1, dt, g.camState);
  }
}

// Everything the HUD needs, assembled once a frame.
export function buildHudState(g) {
  const p = g.player;
  const m = g.missions;
  let mission = null;
  if (m.active) {
    const cur = m.current();
    const st = m.currentStage();
    const nextStage = cur.stages[m.stageIndex + 1];
    mission = {
      title: cur.title,
      stage: m.stageIndex + 1,
      stages: cur.stages.length,
      text: st ? st.text : '',
      timeLeft: m.stageTimer,
      next: nextStage ? `Next: ${nextStage.text}` : 'Finish the mission',
    };
  }
  const respect = respectFor(p.respectXp);
  return {
    mission,
    wanted: g.police.wanted,
    money: p.money,
    dispatch: g.police.dispatchList(p.pos),
    weapons: p.weapons,
    weaponIndex: p.weaponIndex,
    inCar: p.inCar,
    speed: p.inCar && p.car ? p.car.speed : 0,
    carName: p.inCar && p.car ? p.car.def.name : '',
    carCondition: p.inCar && p.car ? p.car.condition : 100,
    health: p.health,
    armour: p.armour,
    respectRank: respect.rank,
    respectXp: p.respectXp,
    respectXpNext: respect.xpNext,
    radioStation: g.radio.station.name,
    radioSong: g.radio.station.song,
    playerX: p.pos.x,
    playerZ: p.pos.z,
    heading: p.inCar && p.car ? p.car.heading : p.heading,
    marker: g.missions.marker.visible ? { x: g.missions.marker.position.x, z: g.missions.marker.position.z } : null,
    buildings: g.city.colliders.map((c) => ({ x: (c.minX + c.maxX) / 2, z: (c.minZ + c.maxZ) / 2 })),
    traffic: g.traffic.cars.map((c) => ({ x: c.pos.x, z: c.pos.z })),
    police: g.police.units.map((u) => ({ x: u.car.pos.x, z: u.car.pos.z })),
  };
}

// Autopilot driving for the screenshot staging: a fake input that steers
// the car toward a point ahead, then the real driving physics run.
export function autopilotDrive(g, dirX, dirZ, weave, dt) {
  const p = g.player;
  if (!p.inCar || !p.car) return;
  const car = p.car;
  const tx = car.pos.x + dirX * 50 + -dirZ * weave * 25;
  const tz = car.pos.z + dirZ * 50 + dirX * weave * 25;
  const desired = Math.atan2(tx - car.pos.x, tz - car.pos.z);
  const err = angleDiff(desired, car.heading);
  const fakeInput = {
    isDown(code) {
      if (code === 'KeyW' || code === 'ArrowUp') return true;
      if (code === 'KeyA' || code === 'ArrowLeft') return err > 0.12;
      if (code === 'KeyD' || code === 'ArrowRight') return err < -0.12;
      return false;
    },
  };
  drivePlayerCar(car, fakeInput, dt, g.city);
  p.pos.copy(car.pos);
  p.heading = car.heading;
}

// Autopilot walking for the foot shot: stroll in a world direction.
export function autopilotWalk(g, dirX, dirZ, dt) {
  const p = g.player;
  const speed = 5;
  const nx = p.pos.x + dirX * speed * dt;
  const nz = p.pos.z + dirZ * speed * dt;
  if (!g.city.blocked(nx, p.pos.z)) p.pos.x = nx;
  if (!g.city.blocked(p.pos.x, nz)) p.pos.z = nz;
  p.heading = Math.atan2(dirX, dirZ);
  p.camYaw = p.heading;
  p.mesh.position.set(p.pos.x, p.pos.y, p.pos.z);
  p.mesh.rotation.y = p.heading;
}

// The per-frame player input: enter/exit cars, weapons, crew, radio, pause,
// and the contextual prompt. The world itself advances in updateWorld.
export function updatePlayer(g, dt) {
  const p = g.player;
  const input = g.input;

  if (input.pressed('KeyF')) {
    if (p.inCar) {
      g.exitCar();
    } else {
      const parked = g.traffic.nearestParked(p.pos.x, p.pos.z, 4.5);
      const special = g.missions.specialCar;
      let target = parked;
      let targetD = parked ? Math.hypot(parked.pos.x - p.pos.x, parked.pos.z - p.pos.z) : Infinity;
      if (special) {
        const d = Math.hypot(special.pos.x - p.pos.x, special.pos.z - p.pos.z);
        if (d < 4.5 && d < targetD) {
          target = special;
          targetD = d;
        }
      }
      if (target) g.enterCar(target, !target.owned);
    }
  }

  if (p.inCar) updateDriving(g, dt);
  else updateOnFoot(g, dt);

  if (input.pressed('Mouse0')) shoot(g);
  if (input.pressed('Digit1')) { p.weaponIndex = 0; g.wheelOpen = false; }
  if (input.pressed('Digit2')) { p.weaponIndex = 1; g.wheelOpen = false; }
  if (input.pressed('Digit3')) { p.weaponIndex = 2; g.wheelOpen = false; }
  if (input.pressed('Digit4')) { p.weaponIndex = 3; g.wheelOpen = false; }
  if (input.pressed('Tab')) {
    g.wheelOpen = !g.wheelOpen;
    const wheel = document.getElementById('weapon-wheel');
    if (wheel) wheel.classList.toggle('show', !!g.wheelOpen);
  }
  if (input.pressed('KeyQ')) useCrewAbility(g, 'KeyQ');
  if (input.pressed('KeyE')) useCrewAbility(g, 'KeyE');
  if (input.pressed('KeyR')) {
    const st = g.radio.nextStation();
    g.hud.toast(`Radio: ${st.name} — ${st.song}`);
  }
  if (input.pressed('KeyM')) {
    g.audio.setMuted(!g.audio.muted);
    g.hud.toast(g.audio.muted ? 'Sound muted (M to unmute)' : 'Sound on');
  }
  if (input.pressed('KeyP') || input.pressed('Escape')) {
    g.state = 'paused';
    g.hud.showPause();
    g.saveGame();
    g.input.unlockPointer();
  }

  // The contextual prompt: the nearest car, the garage, or driving hints.
  let prompt = '';
  if (!p.inCar) {
    const parked = g.traffic.nearestParked(p.pos.x, p.pos.z, 4.5);
    const special = g.missions.specialCar;
    let target = parked;
    let targetD = parked ? Math.hypot(parked.pos.x - p.pos.x, parked.pos.z - p.pos.z) : Infinity;
    if (special) {
      const d = Math.hypot(special.pos.x - p.pos.x, special.pos.z - p.pos.z);
      if (d < 4.5 && d < targetD) {
        target = special;
        targetD = d;
      }
    }
    if (target) {
      prompt = target.owned ? `Press F — get in the ${target.def.name}` : `Press F — steal the ${target.def.name}`;
    } else if (!g.missions.active && p.missionsDone.length < MISSIONS.length) {
      const dGarage = Math.hypot(p.pos.x - GARAGE.x, p.pos.z - GARAGE.z);
      if (dGarage < 12) {
        const next = nextMissionIndex(p);
        prompt = `Press T — talk to Celia, start "${MISSIONS[next].title}"`;
        if (input.pressed('KeyT')) g.startMission(next);
      }
    }
  } else {
    prompt = 'F exit  •  Space handbrake  •  Shift nitro  •  Q Tomas  •  E Nadia  •  R radio';
  }
  g.hud.setPrompt(prompt);
}

function nextMissionIndex(p) {
  for (let i = 0; i < MISSIONS.length; i += 1) {
    if (!p.missionsDone.includes(i + 1)) return i;
  }
  return MISSIONS.length - 1;
}

// Boot: create the game, wire the screens and buttons, and run the loop.
// In shot mode (?shot=...) the start screen is skipped, the shot is staged
// and played forward with the autopilot, then the world freezes and
// window.__shotReady is set for the screenshot tool.
function boot() {
  const g = createGame();
  g.wheelOpen = false;
  // Methods the screenshot staging uses.
  g.setCameraMode = (mode) => {
    g.cameraMode = mode;
  };
  g.autopilotDrive = (dirX, dirZ, weave, dt) => autopilotDrive(g, dirX, dirZ, weave, dt);
  g.autopilotWalk = (dirX, dirZ, dt) => autopilotWalk(g, dirX, dirZ, dt);
  g.updateWorld = (dt) => updateWorld(g, dt);

  const $ = (id) => document.getElementById(id);
  const shot = parseShot();
  const shotMode = shot && isKnownShot(shot.shot);

  // The start screen lists the eight missions.
  const missionList = $('mission-list');
  if (missionList) {
    missionList.innerHTML = MISSIONS.map(
      (m) => `<div class="mission-list-row"><span class="mission-list-id">${m.id}</span><span class="mission-list-title">${m.title}</span><span class="mission-list-reward">$${m.reward.money}</span></div>`,
    ).join('');
  }
  const continueBtn = $('continue-button');
  if (continueBtn) continueBtn.classList.toggle('hidden', !hasSave());

  function beginPlaying() {
    g.hud.hideStart();
    g.hud.hidePause();
    g.hud.hideBusted();
    g.state = 'playing';
    g.input.lockPointer();
  }

  const startBtn = $('start-button');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      clearSave();
      g.player.money = 250;
      g.player.respectXp = 0;
      g.player.missionsDone = [];
      g.player.currentMission = 0;
      g.player.health = 100;
      g.player.armour = 50;
      g.teleportPlayer(0, 60, Math.PI);
      g.audio.ensure();
      beginPlaying();
      g.startMission(0);
      g.hud.toast('Welcome to Perla Bay. Steal a car — Celia is waiting.');
    });
  }
  if (continueBtn) {
    continueBtn.addEventListener('click', () => {
      const save = loadSave();
      if (save) g.applySave(save);
      g.teleportPlayer(0, 60, Math.PI);
      g.audio.ensure();
      beginPlaying();
      g.startMission(g.player.currentMission);
      g.hud.toast('Welcome back to Perla Bay.');
    });
  }
  const resumeBtn = $('resume-button');
  if (resumeBtn) {
    resumeBtn.addEventListener('click', () => {
      g.hud.hidePause();
      g.state = 'playing';
      g.input.lockPointer();
    });
  }
  const restartBtn = $('restart-button');
  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
      g.hud.hidePause();
      g.state = 'playing';
      g.police.clearAll();
      g.startMission(g.player.currentMission);
      g.teleportPlayer(GARAGE.x, GARAGE.z + 8, Math.PI);
      g.hud.toast('Mission restarted.');
    });
  }
  const quitBtn = $('quit-button');
  if (quitBtn) {
    quitBtn.addEventListener('click', () => {
      g.saveGame();
      g.state = 'start';
      g.hud.hidePause();
      g.hud.showStart();
      if (continueBtn) continueBtn.classList.remove('hidden');
    });
  }
  const bustedBtn = $('busted-button');
  if (bustedBtn) {
    bustedBtn.addEventListener('click', () => {
      g.hud.hideBusted();
      g.state = 'playing';
    });
  }
  // The weapon wheel: click a quadrant to pick a weapon.
  document.querySelectorAll('#weapon-wheel .wheel-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      g.player.weaponIndex = parseInt(btn.dataset.weapon, 10) || 0;
      g.wheelOpen = false;
      const wheel = $('weapon-wheel');
      if (wheel) wheel.classList.remove('show');
    });
  });
  // Click the canvas to take mouse-look.
  g.canvas.addEventListener('click', () => {
    if (g.state === 'playing') g.input.lockPointer();
  });
  // Losing the pointer lock pauses the game (desktop play).
  let hadLock = false;
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === g.canvas) {
      hadLock = true;
    } else if (hadLock && g.state === 'playing' && !shotMode) {
      hadLock = false;
      g.state = 'paused';
      g.hud.showPause();
      g.saveGame();
    }
  });
  window.addEventListener('resize', () => handleResize(g.renderer, g.camera));

  // Shot mode: stage it, play it forward, freeze it.
  if (shotMode) {
    const def = SHOT_DEFS[shot.shot];
    g.hud.hideStart();
    g.state = 'playing';
    def.setup(g);
    g.shotRunner = createShotRunner(g, def);
  } else {
    g.hud.showStart();
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (g.state === 'playing') {
      if (g.shotRunner) {
        const done = g.shotRunner.tick(dt);
        if (done && !g.shotFrozen) {
          g.shotFrozen = true;
          window.__shotReady = true;
        }
      } else if (!g.wheelOpen) {
        updatePlayer(g, dt);
        updateWorld(g, dt);
      }
    }
    updateCamera(g, dt);
    updateHud(g.hud, buildHudState(g));
    g.renderer.render(g.scene, g.camera);
    g.input.endFrame();
  }
  requestAnimationFrame(frame);
}

boot();
