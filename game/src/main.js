// main.js — Perla Bay: game state, loop, player and the whole wiring.
// Static files only, no network at runtime. The game runs from game/;
// main.ts copies it to /output for the grader.

import * as THREE from 'three';
import { makeRng, hashSeed } from './random.js';
import { loadSave, storeSave } from './save.js';
import { createInput } from './input.js';
import { CITY, buildCity } from './city.js';
import { CAR_MODELS, createTraffic, updateTraffic, createParkedCars, nearestParked } from './cars.js';
import { createPolice, setWanted, addHeat, updatePolice, getDispatch } from './police.js';
import { MISSIONS, createMissionState, getCurrentMission, missionDistance, checkMissionComplete, completeMission, startMission, missionLabel, freeRoamText } from './missions.js';
import { createHud } from './hud.js';
import { createAudio, STATIONS } from './audio.js';
import { createRenderer, createScene, createCamera, createCameraRig, aerialView } from './render.js';
import { getShotParams, stageShot, tickShot } from './shots.js';

// Scratch vector for the camera facing (reused, never allocated per frame).
const _camDir = new THREE.Vector3();

const WEAPONS = [
  { name: 'FISTS', ammo: Infinity },
  { name: 'PISTOL', ammo: 42 },
  { name: 'SMG', ammo: 120 },
  { name: 'SHOTGUN', ammo: 18 },
];

const RESPECT_LABELS = [
  [0, 'ROOKIE'], [100, 'STREET'], [300, 'HUSTLER'], [600, 'KING'],
];

function respectLabel(xp) {
  let label = 'ROOKIE';
  for (const [min, name] of RESPECT_LABELS) if (xp >= min) label = name;
  return label;
}

// A simple on-foot character: body, head, cap.
function makePersonMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 1.0, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x2a6a8a, roughness: 0.8 }),
  );
  body.position.y = 0.9;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xd8a878, roughness: 0.8 }),
  );
  head.position.y = 1.65;
  g.add(head);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.36, 0.16, 12),
    new THREE.MeshStandardMaterial({ color: 0xc22a2a, roughness: 0.7 }),
  );
  cap.position.y = 1.88;
  g.add(cap);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.5, 0.35),
    new THREE.MeshStandardMaterial({ color: 0x2a2a3a, roughness: 0.9 }),
  );
  legs.position.y = 0.25;
  g.add(legs);
  return g;
}

const game = {
  mode: 'menu',
  frozen: false,
  shotMode: null,
  shotTimer: 0,
  onFreeze: null,
  aerial: false,
  player: {
    x: 12, z: 14, heading: Math.PI, speed: 0,
    onFoot: true, car: null, carHeading: 0, condition: 100,
  },
  money: 250,
  health: 100,
  armour: 60,
  respect: 0,
  weaponIndex: 1,
  missionsDone: [],
  timeMin: 18 * 60,
  saveTimer: 0,
  crewCooldown: 0,
  missions: null,
  police: null,
  traffic: [],
  parked: [],
  colliders: [],
  city: null,
  hud: null,
  audio: null,
  input: null,
  camera: null,
  cameraRig: null,
  renderer: null,
  scene: null,
  personMesh: null,
  trafficRng: makeRng(1234567),
  renderFns: { aerialView },
};

// ---- setup ---------------------------------------------------------------

function init() {
  const canvas = document.getElementById('game');
  game.renderer = createRenderer(canvas);
  game.scene = createScene();
  game.camera = createCamera();
  game.cameraRig = createCameraRig();
  game.hud = createHud();
  game.audio = createAudio();
  game.input = createInput();

  const rng = makeRng(hashSeed('perla-bay-2026'));
  const city = buildCity(game.scene, rng);
  game.city = city;
  game.colliders = city.colliders;
  game.traffic = createTraffic(game.scene, CITY, rng, 16);
  game.parked = createParkedCars(game.scene, city.parkedSpots, rng);
  game.police = createPolice(game.scene, rng);

  game.personMesh = makePersonMesh();
  game.scene.add(game.personMesh);

  // Restore a save, if one exists.
  const save = loadSave();
  if (save) {
    game.money = save.money;
    game.missionsDone = save.missionsDone;
    game.respect = save.respect;
    game.audio.setStation(save.radioStation);
    if (save.muted) game.audio.setMuted(true);
    const cont = document.getElementById('continue-button');
    if (cont) cont.style.display = 'inline-block';
  }
  game.missions = createMissionState(game.missionsDone);

  const startBtn = document.getElementById('start-button');
  if (startBtn) startBtn.addEventListener('click', () => startGame(false));
  const contBtn = document.getElementById('continue-button');
  if (contBtn) contBtn.addEventListener('click', () => startGame(true));
  const resumeBtn = document.getElementById('resume-button');
  if (resumeBtn) resumeBtn.addEventListener('click', () => togglePause(false));

  window.addEventListener('resize', () => {
    game.camera.aspect = window.innerWidth / window.innerHeight;
    game.camera.updateProjectionMatrix();
    game.renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Screenshot staging: auto-start and stage the requested shot.
  const shot = getShotParams();
  if (shot) {
    document.getElementById('start-screen').style.display = 'none';
    game.mode = 'playing';
    const m = getCurrentMission(game.missions);
    if (m) startMission(game.missions);
    stageShot(game, shot);
  } else {
    // Normal play: put the chase camera behind the player before the first
    // frame, so the opening view (and the walk direction) is correct.
    game.cameraRig.snapCamera(game.camera, game.player);
  }
  game.hud.update(hudState());
  requestAnimationFrame(loop);
}

function startGame(continued) {
  game.audio.init();
  game.input.lockPointer();
  document.getElementById('start-screen').style.display = 'none';
  game.mode = 'playing';
  // Put the chase camera straight behind the player now. Without this the
  // camera lerps in from its spawn point (on the wrong side), and the
  // camera-relative walk direction curves while it swings around.
  game.cameraRig.snapCamera(game.camera, game.player);
  const m = getCurrentMission(game.missions);
  if (m && game.missions.stage === 0) {
    startMission(game.missions);
    game.hud.dialogue(m.giver, m.dialogue[0]);
    game.hud.toast(`${missionLabel(m)} — ${m.brief}`);
    game.audio.blip(660);
  } else if (continued) {
    game.hud.toast('Welcome back to Bahía Perla.');
  }
  game.hud.update(hudState());
}

// Push a circle (player or car) out of every building collider it overlaps.
function collide(x, z, radius) {
  for (const c of game.colliders) {
    const dx = x - c.x;
    const dz = z - c.z;
    const d = Math.hypot(dx, dz);
    const min = c.r + radius;
    if (d < min && d > 0.001) {
      const push = min - d;
      x += (dx / d) * push;
      z += (dz / d) * push;
    }
  }
  x = Math.max(-338, Math.min(338, x));
  z = Math.max(-338, Math.min(338, z));
  return [x, z];
}

function togglePause(paused) {
  if (paused === undefined) paused = game.mode === 'playing';
  if (paused && game.mode === 'playing') {
    game.mode = 'paused';
    game.input.clearKeys();
    storeSave(saveState());
    const menu = document.getElementById('pause-menu');
    if (menu) menu.style.display = 'flex';
  } else if (!paused && game.mode === 'paused') {
    game.mode = 'playing';
    const menu = document.getElementById('pause-menu');
    if (menu) menu.style.display = 'none';
  }
}

function saveState() {
  return {
    money: game.money,
    missionsDone: game.missions.done,
    respect: game.respect,
    radioStation: game.audio.station,
    muted: game.audio.muted,
  };
}

// ---- player --------------------------------------------------------------

function updateFoot(dt) {
  const p = game.player;
  const inp = game.input;
  const run = inp.isDown('ShiftLeft') || inp.isDown('ShiftRight');
  const top = run ? 7 : 4;
  let mx = 0;
  let mz = 0;
  if (inp.isDown('KeyW') || inp.isDown('ArrowUp')) mz += 1;
  if (inp.isDown('KeyS') || inp.isDown('ArrowDown')) mz -= 1;
  if (inp.isDown('KeyA') || inp.isDown('ArrowLeft')) mx -= 1;
  if (inp.isDown('KeyD') || inp.isDown('ArrowRight')) mx += 1;
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    mx /= len;
    mz /= len;
    // Move relative to where the camera LOOKS (its true facing), not where
    // the camera sits: the chase camera lags behind the player, so deriving
    // forward from the camera's position makes the player curve.
    const camDir = game.camera.getWorldDirection(_camDir);
    let fx = camDir.x;
    let fz = camDir.z;
    const fl = Math.hypot(fx, fz) || 1;
    fx /= fl;
    fz /= fl;
    // Right is forward turned a quarter-turn clockwise: (-fz, fx).
    const rx = -fz;
    const rz = fx;
    const vx = fx * mz + rx * mx;
    const vz = fz * mz + rz * mx;
    p.x += vx * top * dt;
    p.z += vz * top * dt;
    p.heading = Math.atan2(vx, vz);
    p.speed = top;
  } else {
    p.speed = 0;
  }
  const [nx, nz] = collide(p.x, p.z, 0.6);
  p.x = nx;
  p.z = nz;
  game.personMesh.position.set(p.x, 0, p.z);
  game.personMesh.rotation.y = p.heading;
  game.personMesh.visible = true;
}

function updateCar(dt) {
  const p = game.player;
  const inp = game.input;
  const car = p.car;
  if (!car) { p.onFoot = true; return; }
  const model = car.model;
  const accel = inp.isDown('KeyW') || inp.isDown('ArrowUp');
  const brake = inp.isDown('KeyS') || inp.isDown('ArrowDown');
  const hand = inp.isDown('Space');
  let steer = 0;
  if (inp.isDown('KeyA') || inp.isDown('ArrowLeft')) steer += 1;
  if (inp.isDown('KeyD') || inp.isDown('ArrowRight')) steer -= 1;
  if (accel) p.speed += model.accel * dt;
  if (brake) p.speed -= model.accel * 1.4 * dt;
  if (!accel && !brake) p.speed -= Math.sign(p.speed) * 6 * dt;
  if (hand) p.speed -= Math.sign(p.speed) * 26 * dt;
  p.speed = Math.max(-12, Math.min(model.topSpeed, p.speed));
  if (Math.abs(p.speed) < 0.15 && !accel && !brake) p.speed = 0;
  const steerAngle = steer * 0.55 * model.grip * Math.min(1, Math.abs(p.speed) / 8 + 0.25);
  p.heading += steerAngle * Math.sign(p.speed) * dt * 2.2;
  p.x += Math.sin(p.heading) * p.speed * dt;
  p.z += Math.cos(p.heading) * p.speed * dt;
  const [nx, nz] = collide(p.x, p.z, 1.7);
  if (nx !== p.x || nz !== p.z) p.speed *= 0.55;
  p.x = nx;
  p.z = nz;
  // Bump traffic cars and patrol cars.
  for (const t of game.traffic) {
    const tx = t.alongX ? t.coord : t.pos;
    const tz = t.alongX ? t.pos : t.coord;
    if (Math.hypot(tx - p.x, tz - p.z) < 3.4) {
      p.speed *= 0.55;
      addHeat(game.police, 6);
      game.hud.toast('You clipped a driver — the patrol noticed.');
    }
  }
  for (const u of game.police.units) {
    if (Math.hypot(u.x - p.x, u.z - p.z) < 3.4) {
      p.speed *= 0.5;
      addHeat(game.police, 4);
    }
  }
  // Speeding past a patrol adds heat.
  if (Math.abs(p.speed) > 25) {
    const near = game.police.units.some((u) => Math.hypot(u.x - p.x, u.z - p.z) < 60);
    if (near) addHeat(game.police, 2 * dt);
  }
  car.mesh.position.set(p.x, 0, p.z);
  car.mesh.rotation.y = p.heading;
  car.x = p.x;
  car.z = p.z;
  car.heading = p.heading;
  game.personMesh.visible = false;
}

function tryEnterCar() {
  const p = game.player;
  if (!p.onFoot) return;
  const car = nearestParked(game.parked, p.x, p.z, 4.5);
  if (!car) return;
  car.taken = true;
  p.car = car;
  p.onFoot = false;
  p.x = car.x;
  p.z = car.z;
  p.heading = car.heading;
  p.carHeading = car.heading;
  p.speed = 0;
  p.condition = 100;
  game.hud.toast(`You took the ${car.model.name}.`);
  game.audio.blip(520);
}

function exitCar() {
  const p = game.player;
  if (p.onFoot || !p.car) return;
  const car = p.car;
  car.taken = false;
  car.x = p.x;
  car.z = p.z;
  car.heading = p.heading;
  p.car = null;
  p.onFoot = true;
  p.x += Math.cos(p.heading) * 2.5;
  p.z -= Math.sin(p.heading) * 2.5;
  p.speed = 0;
  game.hud.toast('On foot.');
}

// ---- loop ----------------------------------------------------------------

const clock = new THREE.Clock();
let hudTick = 0;

function hudState() {
  const p = game.player;
  const m = getCurrentMission(game.missions);
  const dist = m ? missionDistance(game.missions, p) : null;
  return {
    money: game.money,
    missionLabel: m ? missionLabel(m) : freeRoamText(),
    missionStage: m
      ? (game.missions.stage === 0 ? 'Talk to the crew' : `Stage 1 / 2 — ${dist != null ? Math.round(dist) + 'm to ' + m.target.label : ''}`)
      : 'Talk to the crew: start a mission from the pause menu',
    wanted: game.police ? game.police.wanted : 0,
    dispatch: game.police ? getDispatch(game.police, p) : [],
    weapons: WEAPONS.map((w, i) => ({ ...w, active: i === game.weaponIndex })),
    speedKmh: Math.abs(p.speed) * 3.6,
    carName: p.onFoot ? 'ON FOOT' : (p.car ? p.car.model.name : 'ON FOOT'),
    condition: p.onFoot ? 100 : p.condition,
    health: game.health,
    armour: game.armour,
    respectLabel: respectLabel(game.respect),
    respect: game.respect,
    radio: game.audio ? game.audio.stationText() : '',
    time: `${String(Math.floor(game.timeMin / 60) % 24).padStart(2, '0')}:${String(Math.floor(game.timeMin % 60)).padStart(2, '0')}`,
    streets: CITY.streets,
    target: m ? m.target : null,
    policeUnits: game.police ? game.police.units : [],
    player: p,
  };
}

function loop() {
  requestAnimationFrame(loop);
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.05);
  if (game.mode === 'playing' && !game.frozen) {
    const inp = game.input;
    // Pause, radio, weapons, crew ability.
    if (inp.wasPressed('KeyP') || inp.wasPressed('Escape')) togglePause(true);
    if (inp.wasPressed('KeyQ')) {
      game.audio.nextStation();
      game.hud.toast(game.audio.stationText().replace('\n', ' — '));
    }
    if (inp.wasPressed('KeyM')) {
      game.audio.setMuted(!game.audio.muted);
      game.hud.toast(game.audio.muted ? 'Radio muted.' : 'Radio on.');
    }
    for (let i = 1; i <= 4; i++) {
      if (inp.wasPressed('Digit' + i)) game.weaponIndex = i - 1;
    }
    if (inp.wasPressed('KeyE')) {
      if (game.crewCooldown <= 0 && game.police.wanted > 0) {
        setWanted(game.police, game.police.wanted - 1);
        game.crewCooldown = 30;
        game.respect += 25;
        game.hud.toast('Nadia runs interference — heat drops a star.');
        game.audio.blip(740);
      } else if (game.crewCooldown > 0) {
        game.hud.toast(`Crew ability recharges in ${Math.ceil(game.crewCooldown)}s.`);
      }
    }
    if (inp.wasPressed('KeyF')) {
      if (game.player.onFoot) tryEnterCar();
      else exitCar();
    }
    game.crewCooldown = Math.max(0, game.crewCooldown - dt);

    // Drive or walk.
    if (game.player.onFoot) updateFoot(dt);
    else updateCar(dt);
    updateTraffic(dt, game.traffic, CITY, game.trafficRng);
    updatePolice(dt, game.police, game.player);

    // Missions.
    const m = getCurrentMission(game.missions);
    if (m && game.missions.stage === 1) {
      if (checkMissionComplete(game.missions, game.player, game.police.wanted)) {
        const done = completeMission(game.missions);
        game.money += done.reward;
        game.respect += 50;
        game.hud.toast(`Mission complete: ${done.title} — +$${done.reward}`);
        game.hud.dialogue(done.giver, done.dialogue[1] || done.dialogue[0]);
        game.audio.blip(880);
        setWanted(game.police, Math.max(0, game.police.wanted - 1));
        storeSave(saveState());
        const next = getCurrentMission(game.missions);
        if (next) {
          startMission(game.missions);
          setWanted(game.police, next.wanted);
        }
      }
    }
    // Mission 6 arms itself when the player first picks it up.
    if (m && m.id === 6 && game.missions.stage === 0) {
      startMission(game.missions);
      setWanted(game.police, 2);
    }

    // Clock, autosave, audio, wheel.
    game.timeMin += dt / 10;
    game.saveTimer += dt;
    if (game.saveTimer > 30) {
      game.saveTimer = 0;
      storeSave(saveState());
    }
    game.audio.update(Math.abs(game.player.speed) * 3.6, game.police.wanted);
    if (game.city.wheel) game.city.wheel.rotation.z += dt * 0.12;

    // Screenshot staging timer (real time, so a slow software renderer
    // cannot stretch the settle beat).
    if (game.shotMode) tickShot(game, rawDt);

    // Camera (aerial for the city shot, chase otherwise).
    if (game.aerial) {
      aerialView(game.camera);
    } else {
      game.cameraRig.update(game.camera, game.player, dt, false);
    }
    inp.endFrame();
  }
  hudTick += 1;
  if (hudTick % 3 === 0) game.hud.update(hudState());
  game.renderer.render(game.scene, game.camera);
}

init();
