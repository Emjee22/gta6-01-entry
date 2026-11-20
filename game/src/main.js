// Perla Bay — main game loop. Third-person open-world crime game in Bahía
// Perla: on-foot and driving, police wanted system, 8 story missions, dense
// HUD, synth radio, save/load. Static files only, no network at runtime.
import * as THREE from '../vendor/three.module.min.js';
import { makeRng, clamp, wrapAngle, dist2 } from './random.js';
import { loadSave, writeSave } from './save.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildCity, collideCircle, CITY } from './city.js';
import { createTraffic, updateTraffic, nearestParked, buildCarMesh, MODELS } from './cars.js';
import { createPolice, updatePolice, addHeat, dispatchList, ensureHeli } from './police.js';
import { MISSIONS, missionById, nextMission, createMissionState, currentStage, advanceStage, missionToast } from './missions.js';
import { createHud, updateHud, showToast, showDialogue, respectRank } from './hud.js';
import { createRenderer, createScene, createCamera, updateCamera, createCamState, createMarker } from './render.js';
import { shotParams, stageShot, runAutopilot, shotCamera } from './shots.js';

const params = shotParams();
const save = loadSave();

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const scene = createScene();
const camera = createCamera();
const city = buildCity(scene, 20261120);
const traffic = createTraffic(scene, city, 777);
const police = createPolice(scene, city);
const input = createInput(canvas);
const audio = createAudio();
const hud = createHud(document.getElementById('hud-root'));
const marker = createMarker(scene);
const camState = createCamState();

const game = {
  started: false,
  paused: false,
  frozen: false,
  time: 0,
  seed: params.seed,
  player: {
    x: -120, z: -80, heading: 0, speed: 0, vx: 0, vz: 0,
    onFoot: true, car: null, health: 100, armour: 50,
    money: save.money, respectXp: save.respect, weaponIndex: 1,
    condition: 100,
  },
  missionState: null,
  missionsDone: [...save.missionsDone],
  bestSpeed: save.bestSpeed || 0,
  totalDriven: save.totalDriven || 0,
  aerial: false,
  collectibles: [],
};

function startMission(m) {
  game.missionState = createMissionState(m);
  showToast(hud, missionToast(m, 'start'));
  if (m.dialogue[0]) showDialogue(hud, m.dialogue[0]);
  audio.beep(660, 0.15);
}

function completeMission() {
  const st = game.missionState;
  const m = st.mission;
  game.player.money += m.pay;
  game.player.respectXp += 150 + m.id * 50;
  game.missionsDone.push(m.id);
  writeSave({
    money: game.player.money, respect: game.player.respectXp,
    missionsDone: game.missionsDone, bestSpeed: game.bestSpeed,
    totalDriven: game.totalDriven, createdAt: save.createdAt,
  });
  showToast(hud, missionToast(m, 'done'));
  if (m.dialogue[1]) showDialogue(hud, m.dialogue[1]);
  audio.coin();
  game.missionState = null;
  const next = nextMission(game.missionsDone);
  if (next) setTimeout(() => startMission(next), 2500);
  else showToast(hud, 'ALL MISSIONS COMPLETE — Bahía Perla is yours. +$5000', 8000);
}

// --- collectible crates for the "collect" stages ---
function spawnCollectible(x, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.6, 1.6),
    new THREE.MeshLambertMaterial({ color: 0xd9a03d, emissive: 0x5a3a00 })
  );
  mesh.position.set(x, 1.2, z);
  mesh.castShadow = true;
  scene.add(mesh);
  const c = { mesh, x, z };
  game.collectibles.push(c);
  return c;
}
spawnCollectible(60, 185);   // mission 2 crate
spawnCollectible(150, 116);  // mission 8 float

function ensurePlayerMesh() {
  if (game.playerMesh) return game.playerMesh;
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.5, 10), new THREE.MeshLambertMaterial({ color: 0x2e6f8e }));
  body.position.y = 1.05; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), new THREE.MeshLambertMaterial({ color: 0xd9a583 }));
  head.position.y = 2.1; head.castShadow = true; g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.18, 12), new THREE.MeshLambertMaterial({ color: 0xc23b2e }));
  cap.position.y = 2.34; g.add(cap);
  scene.add(g);
  game.playerMesh = g;
  return g;
}
ensurePlayerMesh();

// --- player movement ---
function updateOnFoot(dt) {
  const p = game.player;
  const look = input.consumeLook();
  if (input.locked) p.heading -= look.dx * 0.003;
  const ax = input.axis();
  const run = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  const speed = run ? 7.5 : 4.2;
  let mx = 0, mz = 0;
  if (ax.z !== 0 || ax.x !== 0) {
    const s = Math.sin(p.heading), c = Math.cos(p.heading);
    mx = (s * ax.z + c * ax.x) * speed;
    mz = (c * ax.z - s * ax.x) * speed;
  }
  let nx = p.x + mx * dt, nz = p.z + mz * dt;
  nx = clamp(nx, -CITY.half + 6, CITY.half - 6);
  nz = clamp(nz, -CITY.half + 6, CITY.seaZ + 30);
  if (!collideCircle(city.colliders, nx, nz, 1.1)) { p.x = nx; p.z = nz; }
  else if (!collideCircle(city.colliders, p.x, nz, 1.1)) p.z = nz;
  else if (!collideCircle(city.colliders, nx, p.z, 1.1)) p.x = nx;
  p.speed = Math.hypot(mx, mz);
  // Player mesh: simple capsule person.
  ensurePlayerMesh();
  game.playerMesh.visible = true;
  game.playerMesh.position.set(p.x, 0, p.z);
  game.playerMesh.rotation.y = p.heading;
  // Walk bob.
  game.playerMesh.position.y = Math.abs(Math.sin(game.time * 9)) * 0.08 * (p.speed > 0.5 ? 1 : 0);
}

function updateDriving(dt) {
  const p = game.player;
  const car = p.car;
  if (!car) return;
  const ax = input.axis();
  const handbrake = input.isDown('Space');
  const accel = ax.z * car.model.accel;
  p.speed += accel * dt;
  if (ax.z === 0) p.speed -= Math.sign(p.speed) * Math.min(Math.abs(p.speed), 14 * dt);
  if (handbrake) p.speed -= Math.sign(p.speed) * Math.min(Math.abs(p.speed), 40 * dt);
  const topMs = car.model.top / 3.6;
  p.speed = clamp(p.speed, -topMs * 0.35, topMs);
  const steer = ax.x * (p.speed >= 0 ? 1 : -1) * clamp(Math.abs(p.speed) / 8, 0, 1);
  p.heading += steer * 1.9 * dt * (handbrake ? 1.5 : 1);
  let nx = p.x + Math.sin(p.heading) * p.speed * dt;
  let nz = p.z + Math.cos(p.heading) * p.speed * dt;
  // Collision: buildings slow the car hard; world bounds stop it.
  const hit = collideCircle(city.colliders, nx, nz, 2.2);
  if (hit) {
    p.speed *= -0.25;
    p.condition = Math.max(20, p.condition - 2);
    nx = p.x; nz = p.z;
    if (Math.abs(p.speed) > 6) audio.thud();
  }
  nx = clamp(nx, -CITY.half + 4, CITY.half - 4);
  nz = clamp(nz, -CITY.half + 4, CITY.seaZ + 26);
  p.x = nx; p.z = nz;
  car.mesh.position.set(p.x, 0, p.z);
  car.mesh.rotation.y = p.heading;
  game.totalDriven += Math.abs(p.speed) * dt;
  const kmh = Math.abs(p.speed) * 3.6;
  if (kmh > game.bestSpeed) game.bestSpeed = kmh;
  audio.setEngine(true, Math.abs(p.speed) / topMs);
}
// --- enter / exit car ---
function enterCar(parked) {
  const p = game.player;
  if (!parked || !p.onFoot) return false;
  parked.taken = true;
  const mesh = parked.mesh;
  const car = { model: parked.model, mesh, parked };
  p.car = car;
  p.onFoot = false;
  p.speed = 0;
  p.heading = mesh.rotation.y;
  p.x = parked.x; p.z = parked.z;
  if (game.playerMesh) game.playerMesh.visible = false;
  showToast(hud, car.model.name + ' — W/S drive, A/D steer, SPACE handbrake, F exit, Q radio');
  audio.beep(520, 0.1);
  // Entering a car in the open is a little heat.
  addHeat(police, 4);
  return true;
}

function exitCar() {
  const p = game.player;
  if (p.onFoot || !p.car) return;
  const car = p.car;
  p.car = null;
  p.onFoot = true;
  p.speed = 0;
  p.x += Math.sin(p.heading + Math.PI / 2) * 2.6;
  p.z += Math.cos(p.heading + Math.PI / 2) * 2.6;
  audio.setEngine(false, 0);
}

// --- mission stage progression ---
function updateMission(dt) {
  const st = game.missionState;
  if (!st) return;
  const stage = currentStage(st);
  if (!stage) return;
  st.stageTime += dt;
  const p = game.player;
  let done = false;
  if (stage.type === 'goto') {
    const d = Math.hypot(stage.x - p.x, stage.z - p.z);
    marker.set(stage.x, stage.z, true);
    marker.pulse(game.time);
    if (d < 7) done = true;
  } else if (stage.type === 'enter') {
    marker.set(p.x, p.z, false);
    if (!p.onFoot) done = true;
  } else if (stage.type === 'collect') {
    marker.set(p.x, p.z, false);
    if (input.wasPressed('KeyE')) {
      for (const c of game.collectibles) {
        if (Math.hypot(c.x - p.x, c.z - p.z) < 4) {
          scene.remove(c.mesh);
          game.collectibles.splice(game.collectibles.indexOf(c), 1);
          audio.coin();
          done = true;
          break;
        }
      }
      if (!done) showToast(hud, 'Nothing to grab here — stand by the gold crate.', 2000);
    }
  } else if (stage.type === 'hold') {
    marker.set(stage.x, stage.z, true);
    const d = Math.hypot(stage.x - p.x, stage.z - p.z);
    if (d < 10) {
      st.holdTime += dt;
      if (st.holdTime >= stage.seconds) done = true;
    } else st.holdTime = 0;
  } else if (stage.type === 'race') {
    marker.set(stage.x, stage.z, true);
    if (!st.raceStart) st.raceStart = game.time;
    const d = Math.hypot(stage.x - p.x, stage.z - p.z);
    if (d < 8 && game.time - st.raceStart > 5) done = true;
    if (game.time - st.raceStart > stage.seconds) {
      showToast(hud, 'Too slow — Duarte is laughing. Try again from the start.', 4000);
      const m = st.mission;
      game.missionState = createMissionState(m);
      return;
    }
  } else if (stage.type === 'escape') {
    marker.set(stage.x, stage.z, true);
    const d = Math.hypot(stage.x - p.x, stage.z - p.z);
    if (police.wanted === 0 && d < 8) done = true;
  }
  if (done) {
    if (advanceStage(st)) completeMission();
    else audio.beep(880, 0.12);
  }
}

// --- HUD refresh ---
function refreshHud() {
  const p = game.player;
  const st = game.missionState;
  const stage = st ? currentStage(st) : null;
  let timer = '';
  if (st && stage) {
    if (stage.type === 'hold') timer = 'HOLD ' + Math.max(0, Math.ceil(stage.seconds - st.holdTime)) + 's';
    if (stage.type === 'race' && st.raceStart) timer = Math.max(0, Math.ceil(stage.seconds - (game.time - st.raceStart))) + 's LEFT';
  }
  updateHud(hud, {
    missionName: st ? (st.mission.id + '. ' + st.mission.name + ' — ' + st.mission.giver) : 'FREE ROAM — pick a job',
    missionStage: stage ? stage.text : (game.missionsDone.length >= MISSIONS.length ? 'All missions complete' : 'Talk to the crew: start a mission from the pause menu'),
    missionTimer: timer,
    wanted: police.wanted,
    money: p.money,
    dispatch: dispatchList(police, p),
    weaponIndex: p.weaponIndex,
    speedKmh: Math.abs(p.speed) * 3.6,
    carName: p.onFoot ? 'ON FOOT' : p.car.model.name.toUpperCase(),
    condition: p.onFoot ? 100 : p.condition,
    health: p.health,
    armour: p.armour,
    respectXp: p.respectXp,
    radioStation: audio.station.name,
    radioSong: audio.station.song,
    hint: hintText(),
    player: p,
    marker: stage && (stage.type === 'goto' || stage.type === 'hold' || stage.type === 'race' || stage.type === 'escape') ? { x: stage.x, z: stage.z } : null,
    policeDots: police.units.map((u) => ({ x: u.x, z: u.z })),
  });
}

function hintText() {
  const p = game.player;
  if (!game.started) return '';
  if (p.onFoot) {
    const near = nearestParked(traffic, p.x, p.z, 4.5);
    if (near) return 'Press F — take the ' + near.model.name;
    const st = game.missionState;
    if (st && currentStage(st) && currentStage(st).type === 'collect') return 'Press E — grab it';
    return 'WASD move · SHIFT run · F enter car · Q radio · P pause';
  }
  return 'WASD drive · SPACE handbrake · F exit · Q radio · 1-4 weapons';
}

// --- the api object shots.js and the playtest use ---
const api = {
  game,
  enterCar,
  nearestCarTo(x, z) { return nearestParked(traffic, x, z, 60); },
  setWanted(n) { police.heat = n * 20 + 5; police.wanted = n; },
  placePoliceAhead(minD, maxD, side) {
    const p = game.player;
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    const rng = makeRng(99);
    for (let i = 0; i < 4; i++) {
      const d = rng.range(minD, maxD);
      const s = (i % 2 === 0 ? 1 : -1) * rng.range(4, side);
      const x = p.x + fx * d - fz * s;
      const z = p.z + fz * d + fx * s;
      const mesh = buildCarMesh({ name: 'Patrol', color: 0x1c1e24, top: 110, accel: 24, len: 4.6, w: 1.95 }, true);
      mesh.position.set(x, 0, z);
      mesh.rotation.y = p.heading + Math.PI;
      scene.add(mesh);
      police.units.push({ mesh, x, z, heading: p.heading + Math.PI, speed: 12, callsign: ['MARLIN-5', 'IBIS-9', 'GULL-1', 'BLOCK-9'][i], tactic: ['PURSUIT', 'INTERCEPT', 'CORDON', 'ROADBLOCK'][i], wobble: i });
    }
  },
  pinHeli(ahead, side, y) {
    const p = game.player;
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    // Spawn immediately so the heli is in frame from the first staged second.
    ensureHeli(police, p.x + fx * ahead - fz * side, p.z + fz * ahead + fx * side);
    police.wanted = Math.max(police.wanted, 3);
    police.heat = Math.max(police.heat, 65);
    // The heli update loop will chase the player; pin it by nudging its target:
    // we store a pin offset the update loop honours through police.heliPin.
    police.heliPin = { ahead, side, y };
  },
  teleportPlayer(x, z, heading) {
    const p = game.player;
    p.x = x; p.z = z; p.heading = heading;
    if (p.car) { p.car.mesh.position.set(x, 0, z); p.car.mesh.rotation.y = heading; }
  },
  setMission(id) {
    const m = missionById(id);
    if (m && !game.missionsDone.includes(id)) startMission(m);
  },
  showDialogue(text) { showDialogue(hud, text, 30000); },
  setAerialView() { game.aerial = true; },
  driveForward(dt, throttle) {
    const p = game.player;
    if (p.onFoot) return;
    p.speed = Math.min(p.speed + 20 * dt * throttle, 40);
    p.heading += 0;
    const nx = p.x + Math.sin(p.heading) * p.speed * dt;
    const nz = p.z + Math.cos(p.heading) * p.speed * dt;
    p.x = clamp(nx, -CITY.half + 4, CITY.half - 4);
    p.z = clamp(nz, -CITY.half + 4, CITY.seaZ + 26);
    p.car.mesh.position.set(p.x, 0, p.z);
    p.car.mesh.rotation.y = p.heading;
  },
  walkToward(dt, x, z, speed) {
    const p = game.player;
    const dx = x - p.x, dz = z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.5) return;
    p.heading = Math.atan2(dx, dz);
    p.x += (dx / d) * speed * dt;
    p.z += (dz / d) * speed * dt;
    if (game.playerMesh) {
      game.playerMesh.position.set(p.x, Math.abs(Math.sin(game.time * 9)) * 0.08, p.z);
      game.playerMesh.rotation.y = p.heading;
    }
  },
  refreshHud,
  // Snap the chase camera directly behind the player. The normal camera eases
  // its yaw at 3.2/s, which is far too slow for a staged shot: at freeze time
  // (2.5s, few headless frames) it still points along the pre-teleport
  // heading and the police/heli fall out of frame. Staged shots snap it.
  snapCamera() {
    camState.yaw = game.player.heading + Math.PI;
    camState.pitch = 0.12;
  },
};

// Heli pin: the police update moves the heli toward the player; when a pin
// is set (screenshot staging) we override its target each frame instead.

// --- start screen / pause ---
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-button');
const newGameBtn = document.getElementById('new-game-button');
const pauseScreen = document.getElementById('pause-screen');
const resumeBtn = document.getElementById('resume-button');

function beginGame() {
  audio.unlock();
  audio.startMusic();
  startScreen.classList.add('hidden');
  game.started = true;
  input.requestLock();
  const next = nextMission(game.missionsDone);
  if (next) startMission(next);
  else showToast(hud, 'All missions complete — free roam. Bahía Perla is yours.');
}
startBtn.addEventListener('click', beginGame);
if (newGameBtn) newGameBtn.addEventListener('click', () => {
  import('./save.js').then((s) => {
    s.clearSave();
    location.reload();
  });
});
if (resumeBtn) resumeBtn.addEventListener('click', () => {
  game.paused = false;
  pauseScreen.classList.add('hidden');
  input.requestLock();
});

// --- shot mode: skip the start screen, stage immediately ---
let shotStage = null;
if (params.shot) {
  game.started = true;
  startScreen.classList.add('hidden');
  audio.unlock();
  // Stage the right car/player placement before the first frame.
  if (params.shot === 'chase' || params.shot === 'drive') {
    const spot = params.shot === 'chase' ? { x: -87, z: 165 } : { x: 22, z: 138 };
    game.player.x = spot.x; game.player.z = spot.z;
    game.player.heading = params.shot === 'chase' ? Math.PI / 2 : 0;
  }
  if (params.shot === 'foot') {
    game.player.x = 225; game.player.z = 162; game.player.heading = Math.PI / 2;
  }
  if (params.shot === 'city') game.aerial = true;
  shotStage = stageShot(params.shot, api, hud);
}

// --- main loop ---
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (game.frozen) {
    renderer.render(scene, camera);
    return;
  }
  if (!game.started || game.paused) {
    // Idle camera orbit on the start screen.
    if (!game.started) {
      const a = now / 1000 * 0.06;
      camera.position.set(Math.sin(a) * 260, 150, Math.cos(a) * 260);
      camera.lookAt(0, 10, 60);
      city.wheel.rotation.z -= dt * 0.25;
      city.beacon.material.color.setHex(Math.sin(now / 300) > 0 ? 0xffe9a8 : 0x8a6a3a);
    }
    renderer.render(scene, camera);
    return;
  }
  game.time += dt;

  // Input: enter/exit car, radio, pause, weapons, crew ability.
  if (input.wasPressed('KeyF')) {
    if (game.player.onFoot) {
      const near = nearestParked(traffic, game.player.x, game.player.z, 4.5);
      if (near) enterCar(near);
    } else exitCar();
  }
  if (input.wasPressed('KeyQ')) {
    const st = audio.setStation(audio.station.id + 1);
    showToast(hud, st.name + ' — ' + st.song, 2600);
  }
  if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
    game.paused = !game.paused;
    pauseScreen.classList.toggle('hidden', !game.paused);
    if (game.paused) input.releaseLock();
    else input.requestLock();
  }
  if (input.wasPressed('Digit1')) game.player.weaponIndex = 0;
  if (input.wasPressed('Digit2')) game.player.weaponIndex = 1;
  if (input.wasPressed('Digit3')) game.player.weaponIndex = 2;
  if (input.wasPressed('Digit4')) game.player.weaponIndex = 3;
  if (input.wasPressed('KeyE')) {
    // Crew ability: Celia's crew clears a little heat when on foot.
    if (game.player.onFoot && police.wanted > 0) {
      addHeat(police, -25);
      showToast(hud, 'Crew ability — Celia’s people wave the patrol off. Heat down.', 2600);
      audio.beep(740, 0.15);
    }
  }

  if (game.player.onFoot) updateOnFoot(dt);
  else updateDriving(dt);
  updateTraffic(traffic, city, dt, game.player);
  updatePolice(police, game.player, dt, game.time);
  // Heli pin override for staged shots.
  if (police.heli && police.heliPin) {
    const pin = police.heliPin;
    const p = game.player;
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    police.heli.x = p.x + fx * pin.ahead - fz * pin.side;
    police.heli.z = p.z + fz * pin.ahead + fx * pin.side;
    police.heli.y = pin.y;
    police.heli.group.position.set(police.heli.x, police.heli.y, police.heli.z);
    if (police.heli.rotor) police.heli.rotor.rotation.y += dt * 22;
  }
  updateMission(dt);
  audio.setSiren(police.wanted > 0);

  // Camera.
  if (game.aerial) {
    const a = game.time * 0.03;
    camera.position.set(Math.sin(a) * 170, 175, 50 + Math.cos(a) * 170);
    camera.lookAt(-20, 0, 30);
  } else if (shotStage && shotStage.name === 'foot') {
    // Staged foot framing: player lower-left, ferris wheel upper-right.
    const p = game.player;
    const bx = Math.sin(p.heading + Math.PI), bz = Math.cos(p.heading + Math.PI);
    camera.position.set(p.x + bx * 12, 7, p.z + bz * 12);
    camera.lookAt((p.x + 280) / 2, 10, (p.z + 144) / 2);
  } else {
    const look = input.consumeLook();
    updateCamera(camera, game.player, look, dt, camState);
  }

  // Ferris wheel + beacon life.
  city.wheel.rotation.z -= dt * 0.25;
  city.beacon.material.color.setHex(Math.sin(game.time * 2.4) > 0 ? 0xffe9a8 : 0x8a6a3a);

  // Shot autopilot.
  if (shotStage) runAutopilot(shotStage, api, hud, dt);

  refreshHud();
  input.endFrame();
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// Expose a tiny handle for the playtest (not a debug hook in the game).
