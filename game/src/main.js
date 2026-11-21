// main.js — PERLA BAY: game loop, player, cars, police, missions, HUD, save.
// Third-person open-world crime game in Bahía Perla. Walk with WASD, drive
// with F to enter cars, E for the crew ability, outrun the Perla Bay PD.

import * as THREE from 'three';
import { mulberry32, hashStr, clamp } from './random.js';
import { buildCity, buildLandmarks, resolveBuilding, isOnStreet, CITY_HALF, BEACH_Z, SEA_Z } from './city.js';
import { CAR_DEFS, makeCarMesh, createPlayerCar, driveCar, createTraffic, updateTraffic, createParked } from './cars.js';
import { createPolice, setWanted, addHeat, updatePolice, dispatchList } from './police.js';
import { MISSIONS, createMissionState, currentMission, currentStage, updateMissions, missionTarget, formatTimer } from './missions.js';
import { buildHUD, updateHUD, showDialogue, toast, updateToast, drawMinimap } from './hud.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { loadSave, saveGame, respectRankFor } from './save.js';
import { createRenderer, updateCamera, orbitCamera, faceSun } from './render.js';
import { parseShot, setupShot, tickShot } from './shots.js';

const container = document.getElementById('game');
const shotParams = parseShot();
const SEED = shotParams.shot ? shotParams.seed : hashStr('perla-bay');
const rng = mulberry32(SEED);

const save = loadSave();
const state = {
  money: save.money,
  respect: save.respect,
  xp: save.xp,
  health: save.health,
  armour: save.armour,
  missionIndex: save.missionIndex,
  missionStage: save.missionStage,
  carsStolen: save.carsStolen,
  chasesEscaped: save.chasesEscaped,
  playSeconds: save.playSeconds,
  weapon: 2,
  clockMinutes: 18 * 60 + 42, // sunset 18:42
  crewCooldown: 0,
  abilityUsed: false,
  muted: false,
  bustedTimer: 0,
};

const player = {
  x: 12, z: 14, y: 0, vy: 0, onGround: true,
  heading: 0, yaw: 0.6, onFoot: true, car: null,
  walkSpeed: 0, stepTimer: 0,
};

const { renderer, scene, camera } = createRenderer(container);
const built = buildCity(scene, rng);
const city = built.city;
scene.add(built.group); // ground, streets, buildings — without this the city is void
buildLandmarks(scene, city, rng);

// ---- Vehicles ----
const faro = createPlayerCar(scene, CAR_DEFS[0], 12, -4, 0.3);
faro.taken = false;
const cometa = createPlayerCar(scene, CAR_DEFS[1], 40, 248, -0.4);
cometa.taken = false;
const traffic = createTraffic(scene, city, rng, 14);
const parked = createParked(scene, city, rng, 11);

// ---- Player mesh (low-poly person) ----
const playerMesh = new THREE.Group();
{
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2a8a7a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.4), jacket);
  body.position.y = 1.05;
  playerMesh.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), skin);
  head.position.y = 1.75;
  playerMesh.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5), new THREE.MeshLambertMaterial({ color: 0xc03030 }));
  cap.position.y = 2.0;
  playerMesh.add(cap);
  for (const sx of [-0.18, 0.18]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.6, 0.3), pants);
    leg.position.set(sx, 0.32, 0);
    playerMesh.add(leg);
  }
}
playerMesh.position.set(player.x, 0, player.z);
scene.add(playerMesh);

// ---- Pedestrians wandering the sidewalks ----
const peds = [];
{
  const colors = [0xe8e8e8, 0x3a6a9a, 0xc86a8a, 0x6a8a3a, 0x9a6a3a];
  for (let i = 0; i < 12; i++) {
    const g = new THREE.Group();
    const c = colors[i % colors.length];
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.35), new THREE.MeshLambertMaterial({ color: c }));
    body.position.y = 1.0;
    g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshLambertMaterial({ color: 0xe8b88a }));
    head.position.y = 1.65;
    g.add(head);
    const alongX = rng() < 0.5;
    const k = Math.floor(rng() * 11) - 5;
    const line = k * 58;
    const side = rng() < 0.5 ? -1 : 1;
    const t = (rng() * 2 - 1) * (CITY_HALF - 30);
    const x = alongX ? t : line + side * 10;
    const z = alongX ? line + side * 10 : t;
    g.position.set(x, 0, z);
    scene.add(g);
    peds.push({ mesh: g, x, z, heading: alongX ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : 0, speed: 1 + rng() * 0.8, alongX, line, side });
  }
}

// ---- Police, missions, HUD, audio, input ----
const police = createPolice(scene);
const missionState = createMissionState(save);
missionState.dialogue = currentMission(missionState).intro;
missionState.dialogueUntil = 7;
const hud = buildHUD();
const audio = createAudio();
const input = createInput(renderer.domElement);
hud.refs.startSave.textContent = save.missionIndex > 0
  ? 'Save ditemukan: misi ' + (save.missionIndex + 1) + ' — $' + Math.round(save.money)
  : 'Save baru — selamat datang di Bahía Perla';

const world = {
  state, player, police, city, traffic, parked, faro, cometa,
  missionState, time: 0, cityMode: false,
  enterCar, setWanted: (n) => setWanted(police, n),
};

// ---- Car enter / exit ----
function nearestCar(maxDist) {
  let best = null;
  let bestD = maxDist;
  const all = [faro, cometa, ...parked];
  for (const c of all) {
    if (c.taken && c !== faro && c !== cometa) continue;
    if (c === player.car) continue;
    const d = Math.hypot(c.x - player.x, c.z - player.z);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

function enterCar(car) {
  player.onFoot = false;
  player.car = car;
  playerMesh.visible = false;
  if (!car.taken) {
    car.taken = true;
    state.carsStolen++;
    // Stealing a car draws the law — unless it is the mission Faro, whose
    // keys Celia left in the ignition on purpose.
    if (car !== faro) {
      setWanted(police, police.wanted + 1);
      addHeat(police, 0.3);
      if (!world.shotMode) toast(hud, 'VEHICLE STOLEN: ' + car.def.name);
      audio.sfx('wanted');
    } else {
      if (!world.shotMode) toast(hud, 'Faro Sport — Celia left the keys in it');
    }
  }
  audio.sfx('enter');
}

function exitCar() {
  const car = player.car;
  if (!car) return;
  player.onFoot = true;
  player.car = null;
  player.x = car.x + Math.sin(car.heading + Math.PI / 2) * 2.6;
  player.z = car.z + Math.cos(car.heading + Math.PI / 2) * 2.6;
  player.y = 0;
  player.heading = car.heading;
  player.yaw = car.heading;
  playerMesh.visible = true;
  playerMesh.position.set(player.x, 0, player.z);
  audio.sfx('enter');
}

// ---- Crew ability: Nadia jams the police radio, dropping one star. ----
function useAbility() {
  if (state.crewCooldown > 0) {
    toast(hud, 'Nadia is recharging the jammer (' + Math.ceil(state.crewCooldown) + 's)');
    return;
  }
  if (police.wanted <= 0) {
    toast(hud, 'No heat right now — save Nadia for the chase');
    return;
  }
  setWanted(police, police.wanted - 1);
  state.crewCooldown = 30;
  state.abilityUsed = true;
  missionState.abilityUsed = true;
  toast(hud, 'Nadia runs interference — dispatch is blind');
  audio.sfx('ability');
}

// ---- Police ram: damages the car (or the player on foot). ----
let ramCooldown = 0;
function onPoliceRam(unit, dist) {
  if (ramCooldown > 0) return;
  ramCooldown = 0.8;
  if (player.car) {
    player.car.condition = Math.max(0, player.car.condition - 4);
    player.car.speed *= 0.85;
    audio.sfx('crash');
    if (player.car.condition <= 0) {
      toast(hud, 'Car wrecked — get out and run!');
      exitCar();
    }
  } else {
    state.health = Math.max(0, state.health - 8);
    audio.sfx('crash');
    if (state.health <= 0) busted();
  }
}

// Busted: wake up at the plaza, lighter wallet, clean slate.
function busted() {
  state.health = 100;
  state.armour = 0;
  state.money = Math.max(0, state.money - 100);
  setWanted(police, 0);
  player.x = 12;
  player.z = 14;
  player.y = 0;
  if (player.car) {
    player.car = null;
    player.onFoot = true;
    playerMesh.visible = true;
  }
  playerMesh.position.set(player.x, 0, player.z);
  toast(hud, 'BUSTED — the PD dropped you at Plaza Perla, $100 lighter');
  audio.sfx('wanted');
}

// ---- On-foot movement (camera-relative, mouse or arrows turn). ----
function updateFoot(dt) {
  const mouse = input.takeMouse();
  player.yaw -= mouse.dx * 0.0032;
  player.yaw -= input.axis('arrowleft', 'arrowright') * 1.9 * dt;
  const fwd = input.axis('s', 'w');
  const strafe = input.axis('a', 'd');
  const run = input.isDown('shift');
  const speed = run ? 9 : 4.2;
  const sin = Math.sin(player.yaw);
  const cos = Math.cos(player.yaw);
  let mx = sin * fwd + cos * strafe;
  let mz = cos * fwd - sin * strafe;
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    mx /= len;
    mz /= len;
    player.walkSpeed = speed;
    player.heading = Math.atan2(mx, mz);
  } else {
    player.walkSpeed = 0;
  }
  const nx = player.x + mx * player.walkSpeed * dt;
  const nz = player.z + mz * player.walkSpeed * dt;
  const res = resolveBuilding(city, nx, nz, 0.6);
  player.x = clamp(res.x, -CITY_HALF, CITY_HALF);
  player.z = clamp(res.z, -CITY_HALF, BEACH_Z + 55);
  // Jump.
  if (input.wasPressed(' ') && player.onGround) {
    player.vy = 7;
    player.onGround = false;
  }
  if (!player.onGround) {
    player.vy -= 22 * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) { player.y = 0; player.vy = 0; player.onGround = true; }
  }
  playerMesh.position.set(player.x, player.y, player.z);
  playerMesh.rotation.y = player.heading;
  // Footstep ticks.
  if (player.walkSpeed > 0) {
    player.stepTimer -= dt * player.walkSpeed;
    if (player.stepTimer <= 0) {
      player.stepTimer = 2.2;
      audio.sfx('click');
    }
  }
  return speed;
}

// ---- Pedestrians ----
function updatePeds(dt) {
  for (const p of peds) {
    const step = p.speed * dt;
    if (p.alongX) {
      p.x += Math.sin(p.heading) * step;
      if (Math.abs(p.x) > CITY_HALF - 20) p.heading += Math.PI;
    } else {
      p.z += Math.cos(p.heading) * step;
      if (Math.abs(p.z) > CITY_HALF - 20) p.heading += Math.PI;
    }
    p.mesh.position.set(p.x, Math.abs(Math.sin(world.time * 6 + p.z)) * 0.04, p.z);
    p.mesh.rotation.y = p.heading;
  }
}

// ---- Traffic collision with the player car ----
let crashCooldown = 0;
function checkTrafficHits() {
  if (!player.car) return;
  for (const t of traffic) {
    const d = Math.hypot(t.x - player.car.x, t.z - player.car.z);
    if (d < 3.4) {
      if (crashCooldown <= 0) {
        crashCooldown = 0.7;
        player.car.speed *= 0.55;
        player.car.condition = Math.max(0, player.car.condition - 2);
        t.speed *= 0.4;
        audio.sfx('crash');
        addHeat(police, 0.08);
      }
      // Push the traffic car aside so they don't stick together.
      const push = 3.4 - d;
      const a = Math.atan2(t.x - player.car.x, t.z - player.car.z);
      t.x += Math.sin(a) * push;
      t.z += Math.cos(a) * push;
    }
  }
}

// ---- Mode, shots, start / pause ----
let mode = shotParams.shot ? 'playing' : 'menu';
let shot = null;
if (shotParams.shot) {
  world.shotMode = true;
  shot = setupShot(world, shotParams.shot, shotParams.seed);
  hud.start.style.display = 'none';
  if (shotParams.shot === 'chase') {
    // Force-spawn the pursuit units now, then frame them around the player.
    updatePolice(0.001, police, { x: player.x, z: player.z }, city, onPoliceRam);
    // Frame the pursuit in an arc ahead of the car (inside the camera
    // frustum), one unit trailing behind; heli ahead and high.
    const bearings = [-0.55, -0.2, 0.15, 0.5, 2.9];
    const dists = [26, 30, 24, 28, 22];
    police.units.forEach((u, i) => {
      const b = player.car.heading + bearings[i % bearings.length];
      const d = dists[i % dists.length];
      u.x = clamp(player.x + Math.sin(b) * d, -CITY_HALF, CITY_HALF);
      u.z = clamp(player.z + Math.cos(b) * d, -CITY_HALF, BEACH_Z + 40);
      u.heading = Math.atan2(player.x - u.x, player.z - u.z);
      u.mesh.position.set(u.x, 0, u.z);
    });
    if (police.heli) {
      const h = player.car.heading;
      police.heli.mesh.position.set(player.x + Math.sin(h) * 28 - 6, 34, player.z + Math.cos(h) * 28);
    }
  }
}

function startGame() {
  audio.start();
  audio.sfx('click');
  mode = 'playing';
  hud.start.style.display = 'none';
  input.requestLock();
}
hud.startBtn.addEventListener('click', startGame);
renderer.domElement.addEventListener('click', () => {
  if (mode === 'playing') input.requestLock();
});

function togglePause() {
  if (mode === 'playing') {
    mode = 'paused';
    hud.pause.style.display = 'block';
    saveGame(Object.assign({}, state, { missionIndex: missionState.index, missionStage: missionState.stage }));
  } else if (mode === 'paused') {
    mode = 'playing';
    hud.pause.style.display = 'none';
  }
}

let saveTimer = 0;
let last = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  world.time += dt;
  if (city.wheelMesh) city.wheelMesh.rotation.z += dt * 0.12;
  updatePeds(dt);

  if (mode === 'menu') {
    orbitCamera(camera, world.time, { x: 0, z: 40 });
    renderer.render(scene, camera);
    return;
  }
  if (mode === 'paused') {
    renderer.render(scene, camera);
    return;
  }

  // ---- Playing ----
  state.playSeconds += dt;
  state.clockMinutes += dt * 0.12;
  ramCooldown = Math.max(0, ramCooldown - dt);
  crashCooldown = Math.max(0, crashCooldown - dt);
  state.crewCooldown = Math.max(0, state.crewCooldown - dt);

  if (input.wasPressed('p') || input.wasPressed('escape')) togglePause();
  if (input.wasPressed('m')) {
    state.muted = !state.muted;
    audio.setMuted(state.muted);
    toast(hud, state.muted ? 'Sound muted' : 'Sound on');
  }
  for (const k of ['1', '2', '3', '4']) {
    if (input.wasPressed(k)) state.weapon = parseInt(k, 10);
  }

  let pilotCmd = null;
  if (shot && !shot.done) pilotCmd = shot.autopilot(world, dt);

  if (player.onFoot) {
    if (pilotCmd && pilotCmd.moveZ !== undefined) {
      // Screenshot autopilot walks the player forward.
      const sp = 4.2;
      player.x = clamp(player.x + Math.sin(player.yaw) * sp * dt * pilotCmd.moveZ, -CITY_HALF, CITY_HALF);
      player.z = clamp(player.z + Math.cos(player.yaw) * sp * dt * pilotCmd.moveZ, -CITY_HALF, BEACH_Z + 55);
      playerMesh.position.set(player.x, 0, player.z);
      playerMesh.rotation.y = player.yaw;
    } else {
      updateFoot(dt);
      if (input.wasPressed('f')) {
        const car = nearestCar(4.5);
        if (car) enterCar(car);
        else toast(hud, 'No car close enough — walk to a parked car');
      }
    }
  } else if (player.car) {
    if (pilotCmd && pilotCmd.throttle !== undefined) {
      driveCar(player.car, pilotCmd, dt, city);
    } else {
      const throttle = input.axis('s', 'w');
      const steer = input.axis('a', 'd');
      const handbrake = input.isDown(' ') || input.isDown('shift');
      const hit = driveCar(player.car, { throttle, steer, handbrake }, dt, city);
      if (hit) audio.sfx('crash');
      if (player.car.drift > 0.3 && Math.abs(player.car.speed) > 10) {
        state.money += dt * 2; // drift bonus trickles in
      }
    }
    if (input.wasPressed('f')) exitCar();
    checkTrafficHits();
  }
  if (input.wasPressed('e')) useAbility();

  updateTraffic(dt, traffic, city, player.car, rng);
  updatePolice(dt, police, { x: player.x, z: player.z }, city, onPoliceRam);

  // Chase-shot formation: hold the pursuit units in a visible arc ahead of
  // the car (and the heli high ahead) so the cover frame shows the chase.
  // Staging only — real play uses the free pursuit above.
  if (world.shotMode && shotParams.shot === 'chase' && player.car) {
    const h = player.car.heading;
    const form = [[-0.45, 26], [0.45, 26], [2.6, 18], [-2.6, 18], [0, 45]];
    police.units.forEach((u, i) => {
      const [b, d] = form[i % form.length];
      const a = h + b;
      u.x = player.car.x + Math.sin(a) * d;
      u.z = player.car.z + Math.cos(a) * d;
      u.heading = Math.atan2(player.car.x - u.x, player.car.z - u.z);
      u.mesh.position.set(u.x, 0, u.z);
      u.mesh.rotation.y = u.heading;
      u.tactic = i < 2 ? 'FLANKING' : (i === 4 ? 'ROADBLOCK' : 'PURSUE');
    });
    if (police.heli) {
      police.heli.mesh.position.set(player.car.x + Math.sin(h) * 55, 34, player.car.z + Math.cos(h) * 55);
      police.heli.mesh.rotation.y = Math.atan2(player.car.x - police.heli.mesh.position.x, player.car.z - police.heli.mesh.position.z);
    }
  }

  // Missions advance only in real play, never during a staged shot.
  if (!shot) {
    updateMissions(dt, missionState, {
      x: player.x, z: player.z,
      inCar: !player.onFoot,
      carName: player.car ? player.car.def.name : '',
      wanted: police.wanted,
      abilityUsed: missionState.abilityUsed,
      onStage(m, stage) { audio.sfx('pickup'); },
      onComplete(m) {
        state.money += m.reward;
        state.xp += m.xp;
        toast(hud, 'MISSION COMPLETE: ' + m.title + '  +$' + m.reward + '  +' + m.xp + ' XP');
        audio.sfx('mission');
        saveGame(Object.assign({}, state, { missionIndex: missionState.index, missionStage: missionState.stage }));
      },
    });
  }

  // HUD + audio + minimap.
  const m = currentMission(missionState);
  const st = currentStage(missionState);
  const hours = Math.floor(state.clockMinutes / 60) % 24;
  const mins = Math.floor(state.clockMinutes % 60);
  const clockStr = 'SUNSET ' + String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0');
  updateHUD(hud, {
    missionTitle: (missionState.index + 1) + '. ' + m.title + ' — ' + m.giver,
    missionStage: missionState.stage + 1,
    missionStages: m.stages.length,
    missionIndex: missionState.index + 1,
    missionTotal: MISSIONS.length,
    timer: formatTimer(missionState.timer),
    objective: st.objective,
    wanted: police.wanted,
    money: state.money,
    clock: clockStr,
    radio: audio.radioTitle(),
    speedKmh: player.car ? Math.abs(player.car.speed) * 3.6 : player.walkSpeed * 3.6,
    carName: player.car ? player.car.def.name.toUpperCase() : 'ON FOOT',
    condition: player.car ? player.car.condition : 100,
    inCar: !player.onFoot,
    health: state.health,
    armour: state.armour,
    respectRank: respectRankFor(state.xp).rank,
    xp: state.xp,
    dispatch: dispatchList(police, { x: player.x, z: player.z }),
    weapon: state.weapon,
  });
  const showText = missionState.timer < missionState.dialogueUntil ? missionState.dialogue : null;
  showDialogue(hud, showText);
  updateToast(hud, dt);
  drawMinimap(hud, {
    half: CITY_HALF, seaZ: SEA_Z,
    target: missionTarget(missionState),
    policeDots: police.units.map((u) => ({ x: u.x, z: u.z })),
    playerX: player.x, playerZ: player.z,
    heading: player.onFoot ? player.yaw : (player.car ? player.car.heading : 0),
  });
  if (audio.isStarted()) {
    audio.engine(player.car ? Math.abs(player.car.speed) / player.car.def.top : 0, !!player.car);
    audio.siren(police.wanted >= 2, dt);
    audio.radio(dt);
  }

  // Camera.
  if (world.cityMode) {
    orbitCamera(camera, world.time, { x: 0, z: 40 });
  } else if (player.car) {
    updateCamera(camera, { x: player.car.x, y: 0, z: player.car.z }, player.car.heading, 'car', dt);
  } else {
    updateCamera(camera, { x: player.x, y: player.y, z: player.z }, player.yaw, 'foot', dt);
  }

  // Autosave every 15 seconds of play.
  saveTimer += dt;
  if (saveTimer > 15) {
    saveTimer = 0;
    saveGame(Object.assign({}, state, { missionIndex: missionState.index, missionStage: missionState.stage }));
  }

  if (shot) tickShot(world, shot, dt);
  renderer.render(scene, camera);
  input.endFrame();
}

requestAnimationFrame(frame);
