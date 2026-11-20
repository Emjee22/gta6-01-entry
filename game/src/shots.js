// Screenshot staging for Perla Bay.
// ?shot=chase|drive|foot|city&seed=N starts the game in a staged scene,
// runs a short autopilot, then freezes the simulation and sets
// window.__shotReady = true so the CDP renderer can capture a stable frame.
// Toast + dialogue are re-shown at freeze time because headless timers
// would otherwise have expired before the capture.
import { showToast, showDialogue } from './hud.js';
import { dispatchList } from './police.js';

export function shotParams() {
  const q = new URLSearchParams(location.search);
  return { shot: q.get('shot') || null, seed: parseInt(q.get('seed') || '7', 10) || 7 };
}

// Stage one shot. `api` is the object main.js exposes: it carries the live
// game state and the helpers the autopilot needs.
export function stageShot(name, api, hud) {
  const g = api.game;
  const t0 = performance.now();
  const cfg = {
    chase: { wanted: 4, speed: 32, heli: true, dialogue: 'Duarte Ferrer: "Four stars and they still can’t catch us!"', toast: 'WANTED 4★ — lose the patrol or outrun them' },
    drive: { wanted: 1, speed: 38, heli: false, dialogue: 'Celia Mar: "Beach road, windows down, nobody chasing. This is the life."', toast: null },
    foot: { wanted: 0, speed: 0, heli: false, dialogue: 'Nadia Sol: "Meet me by the wheel when the lights come on."', toast: 'ON FOOT — the boardwalk at dusk' },
    city: { wanted: 0, speed: 0, heli: false, dialogue: '', toast: 'BAHÍA PERLA — the whole bay at sunset' },
  }[name] || {};
  return { name, cfg, t0, staged: false };
}

export function runAutopilot(stage, api, hud, dt) {
  const g = api.game;
  const p = g.player;
  if (!stage) return false;
  const elapsed = (performance.now() - stage.t0) / 1000;

  if (stage.name === 'chase') {
    // Player in a car, speeding EAST along the open beach road; police converge.
    if (!stage.staged) {
      api.teleportPlayer(-87, 165, Math.PI / 2);
      api.enterCar(api.nearestCarTo(-87, 165));
      // enterCar copies the parked car's random heading; restore the staged one.
      p.heading = Math.PI / 2;
      p.speed = 32;
      api.setWanted(4);
      api.placePoliceAhead(22, 42, 10);
      api.pinHeli(24, 5, 9);
      api.snapCamera();
      stage.staged = true;
    }
    p.speed = Math.max(p.speed, 30);
    api.driveForward(dt, 1);
    api.snapCamera();
  } else if (stage.name === 'drive') {
    if (!stage.staged) {
      api.teleportPlayer(22, 138, 0);
      api.enterCar(api.nearestCarTo(22, 138));
      // enterCar copies the parked car's random heading; restore due south.
      p.heading = 0;
      p.speed = 38;
      api.setWanted(1);
      api.snapCamera();
      stage.staged = true;
    }
    api.driveForward(dt, 0.7);
    api.snapCamera();
  } else if (stage.name === 'foot') {
    if (!stage.staged) {
      api.teleportPlayer(225, 162, Math.PI / 2);
      api.setMission(3);
      api.showDialogue('Nadia Sol: "Meet me by the wheel when the lights come on."');
      stage.staged = true;
    }
    api.walkToward(dt, 250, 152, 3.2);
  } else if (stage.name === 'city') {
    if (!stage.staged) {
      api.setAerialView();
      stage.staged = true;
    }
  }

  // Freeze after the scene has settled (2.5s chase/drive, 1.8s foot, 1.2s city).
  const wait = stage.name === 'city' ? 1.2 : stage.name === 'foot' ? 1.8 : 2.5;
  if (elapsed >= wait) {
    if (stage.cfg.dialogue) showDialogue(hud, stage.cfg.dialogue, 30000);
    // Drive toast names the actual car the autopilot took.
    let toast = stage.cfg.toast;
    if (stage.name === 'drive') {
      const carName = g.player.car ? g.player.car.model.name : 'Onda Coupe';
      toast = 'CRUISING — ' + carName + ' on the sand';
    }
    if (toast) showToast(hud, toast, 30000);
    api.refreshHud();
    g.frozen = true;
    window.__shotReady = true;
    return true;
  }
  return false;
}
// The shot name also picks the camera preset main.js applies at boot.
export function shotCamera(name) {
  if (name === 'city') return { mode: 'aerial', height: 210, dist: 190 };
  if (name === 'chase') return { mode: 'chase', height: 5.2, dist: 13 };
  if (name === 'drive') return { mode: 'chase', height: 4.6, dist: 11 };
  return { mode: 'follow', height: 3.4, dist: 7.5 };
}
