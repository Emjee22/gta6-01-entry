// shots.js — screenshot staging for Perla Bay.
// ?shot=chase|drive|foot|city&seed=N teleports the player into a composed
// scene, runs the simulation for a short beat, then freezes it and sets
// window.__shotReady so the render script knows the frame is stable.
// The freeze is shot-only; normal play never touches it.

import { makeRng } from './random.js';
import { forceSpawnAhead, setWanted } from './police.js';

export function getShotParams() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  if (!shot || !['chase', 'drive', 'foot', 'city'].includes(shot)) return null;
  const seed = parseInt(q.get('seed') || '7', 10) || 7;
  return { shot, seed };
}

// Place the player in a car on the beach road, heading south toward the sea.
function stageInCar(game, modelName) {
  const p = game.player;
  const car = game.parked.find((c) => c.model.name === modelName && !c.taken)
    || game.parked.find((c) => !c.taken);
  if (!car) return false;
  car.taken = true;
  p.car = car;
  p.onFoot = false;
  p.x = car.x;
  p.z = car.z;
  p.heading = 0; // south, toward the sea (+z)
  p.speed = 31; // ~112 km/h
  p.carHeading = 0;
  return true;
}

// Stage one shot, then freeze after `settle` seconds of simulation.
// Returns true when a shot was staged.
export function stageShot(game, params) {
  const rng = makeRng(params.seed * 7919 + 13);
  const p = game.player;
  const hud = game.hud;
  game.shotMode = params.shot;
  game.shotTimer = 1.5;

  if (params.shot === 'chase') {
    // Along the beach: Faro Sport, four stars, patrol closing in.
    // Heading PI/2 = east (+x), driving down the sand with the sea on
    // the right and the city on the left.
    p.x = -200;
    p.z = 320;
    stageInCar(game, 'Faro Sport');
    p.x = -200;
    p.z = 320;
    p.heading = Math.PI / 2;
    setWanted(game.police, 4);
    forceSpawnAhead(game.police, p, 4);
    if (game.police.heli) {
      game.police.heli.x = p.x + 10;
      game.police.heli.z = p.z - 10;
      game.police.heli.y = 18;
    }
    game.cameraRig.snapCamera(game.camera, p);
    hud.toast('WANTED 4★ — lose the patrol or outrun them');
    hud.dialogue('Duarte Ferrer', 'Four stars and they still can\'t catch us!');
  } else if (params.shot === 'drive') {
    // Open sand, Faro Sport, cruising east along the beach.
    p.x = -100;
    p.z = 320;
    stageInCar(game, 'Faro Sport');
    p.x = -100;
    p.z = 320;
    p.heading = Math.PI / 2;
    setWanted(game.police, 1);
    game.cameraRig.snapCamera(game.camera, p);
    hud.toast('CRUISING — Faro Sport on the sand');
    hud.dialogue('Celia Mar', 'Beach road, windows down, nobody chasing. This is the life.');
  } else if (params.shot === 'foot') {
    // On foot on the beach south of the ferris wheel, facing north at it.
    // Wheel is at (-140, 318); heading PI faces north (-z).
    p.onFoot = true;
    p.car = null;
    p.x = -140;
    p.z = 336;
    p.heading = Math.PI;
    p.speed = 0;
    game.missions.current = 3;
    game.missions.stage = 1;
    setWanted(game.police, 0);
    game.cameraRig.snapCamera(game.camera, p);
    hud.toast('ON FOOT — the boardwalk at dusk');
    hud.dialogue('Nadia Sol', 'Meet me by the wheel when the lights come on.');
  } else if (params.shot === 'city') {
    // Aerial: the whole bay at sunset.
    p.onFoot = true;
    p.car = null;
    p.x = 0;
    p.z = 0;
    p.heading = Math.PI;
    p.speed = 0;
    setWanted(game.police, 0);
    hud.toast('BAHÍA PERLA — the whole bay at sunset');
    hud.clearDialogue();
    game.aerial = true;
  }
  // Re-show the staged toast/dialogue at freeze time so they survive the
  // settle beat even if the HUD redraws them away.
  game.onFreeze = () => {
    if (params.shot === 'chase') {
      hud.toast('WANTED 4★ — lose the patrol or outrun them');
      hud.dialogue('Duarte Ferrer', 'Four stars and they still can\'t catch us!');
    } else if (params.shot === 'drive') {
      hud.toast('CRUISING — Faro Sport on the sand');
      hud.dialogue('Celia Mar', 'Beach road, windows down, nobody chasing. This is the life.');
    } else if (params.shot === 'foot') {
      hud.toast('ON FOOT — the boardwalk at dusk');
      hud.dialogue('Nadia Sol', 'Meet me by the wheel when the lights come on.');
    } else if (params.shot === 'city') {
      hud.toast('BAHÍA PERLA — the whole bay at sunset');
    }
    if (params.shot === 'city') {
      const { aerialView } = game.renderFns;
      aerialView(game.camera);
    } else if (params.shot === 'foot') {
      // Pull the camera back over the sea and tilt it up so the whole
      // ferris wheel (40 tall) fits with the player in the foreground.
      game.camera.position.set(p.x, 5, p.z + 24);
      game.camera.lookAt(-140, 15, 318);
    } else {
      game.cameraRig.snapCamera(game.camera, p);
    }
  };
  return true;
}

// Tick the shot timer; when it runs out, freeze the sim and flag readiness.
export function tickShot(game, dt) {
  if (!game.shotMode) return;
  game.shotTimer -= dt;
  if (game.shotTimer <= 0) {
    game.shotMode = null;
    if (game.onFreeze) game.onFreeze();
    game.frozen = true;
    window.__shotReady = true;
  }
}
