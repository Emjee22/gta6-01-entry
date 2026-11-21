// shots.js — deterministic screenshot staging for PERLA BAY.
// ?shot=chase|drive|foot|city&seed=N plays the real game forward with an
// autopilot (never a hand-posed frame), using a seeded RNG, then sets
// window.__shotReady = true so the screenshot script knows when to shoot.

import { mulberry32, hashStr } from './random.js';

// Parse location.search into {shot, seed}.
export function parseShot() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot') || '';
  const seedRaw = q.get('seed') || 'perla-1';
  const seed = /^\d+$/.test(seedRaw) ? parseInt(seedRaw, 10) : hashStr(seedRaw);
  return { shot, seed };
}

// Configure the world for a shot. Returns {duration, autopilot} where the
// autopilot drives input each frame until duration elapses.
export function setupShot(world, name, seed) {
  const rng = mulberry32(seed);
  const S = world.state;
  const P = world.player;
  if (name === 'chase') {
    // Player in the Faro Sport mid-chase: 4 stars, 4 units + heli, sunset.
    world.enterCar(world.faro);
    P.car.speed = 32; // ~115 km/h
    P.car.heading = Math.PI; // north up avenue x=58, buildings both sides
    P.car.x = 58;
    P.car.z = 150;
    world.setWanted(4);
    world.police.heat = 0.6;
    // Units are framed around the car by main.js after the first police
    // update spawns them (they do not exist yet when this runs).
    world.missionState.dialogue = 'Duarte Ferrer: "Four stars and they still can\'t catch us!"';
    world.missionState.dialogueUntil = 9999;
    return { duration: 1.8, autopilot: chasePilot };
  }
  if (name === 'drive') {
    world.enterCar(world.cometa);
    P.car.speed = 29; // ~104 km/h
    P.car.heading = Math.PI; // north up avenue x=0 toward the plaza
    P.car.x = 0;
    P.car.z = 200;
    world.setWanted(1);
    world.missionState.dialogue = 'Celia Mar: "Keep it on the beach road — the whole bay is watching."';
    world.missionState.dialogueUntil = 9999;
    return { duration: 1.6, autopilot: drivePilot };
  }
  if (name === 'foot') {
    // On foot near the ferris wheel, looking at the plaza + wheel.
    P.onFoot = true;
    P.x = 0;
    P.z = 250;
    P.heading = 1.3;
    P.yaw = 1.3; // facing the Rueda del Sol ferris wheel
    world.setWanted(0);
    world.missionState.dialogue = 'Nadia Sol: "The wheel never stops in Perla Bay. Neither do we."';
    world.missionState.dialogueUntil = 9999;
    return { duration: 1.5, autopilot: footPilot };
  }
  if (name === 'city') {
    // Aerial overview of the whole bay at sunset.
    world.cityMode = true;
    world.setWanted(0);
    return { duration: 1.2, autopilot: cityPilot };
  }
  return null;
}

function chasePilot(world, dt) {
  // Hold the throttle, steer gently toward the street ahead, drift once.
  const P = world.player;
  const steer = Math.sin(world.time * 0.5) * 0.25;
  return { throttle: 1, steer, handbrake: world.time > 1.2 && world.time < 1.6 };
}

function drivePilot(world, dt) {
  return { throttle: 1, steer: 0, handbrake: false };
}

function footPilot(world, dt) {
  // Walk forward slowly, camera panning toward the wheel.
  const P = world.player;
  P.yaw += dt * 0.12;
  return { moveX: 0, moveZ: 1, run: false };
}

function cityPilot(world, dt) {
  return null;
}

// Run one staging frame: advance the autopilot, count down, flag ready.
export function tickShot(world, shot, dt) {
  if (!shot) return;
  shot.elapsed = (shot.elapsed || 0) + dt;
  if (shot.elapsed >= shot.duration) {
    window.__shotReady = true;
    shot.done = true;
  }
}
