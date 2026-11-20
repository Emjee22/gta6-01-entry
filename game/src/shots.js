// Screenshot staging for Perla Bay.
//
// ?shot=chase|drive|foot|city&seed=N plays the real world forward for a few
// seconds with an autopilot (not a hand-posed frame), using a seeded RNG so
// the same shot always looks the same. When the staging run is done the
// game sets window.__shotReady, and the simulation freezes so the frame the
// screenshot tool captures is exactly the staged moment.
export function parseShot() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot) return null;
  const seed = parseInt(params.get('seed') || '7', 10);
  return { shot, seed: Number.isFinite(seed) ? seed : 7 };
}

// Where each shot starts. The staging run then plays the world forward.
export const SHOT_DEFS = {
  chase: {
    label: 'Police chase',
    // Player in a Cometa GT, 4 stars from the Hot Pursuit mission, units
    // and the heli closing in. (The mission itself sets the heat, so no
    // extra setWanted here — it would stack to 5 stars.)
    setup(game) {
      game.teleportPlayer(0, 40, Math.PI);
      game.enterCarByDef('Cometa GT', 0, 40, Math.PI);
      game.startMission(5);
      game.setCameraMode('chase');
    },
    // Drive north up the avenue, weaving a little.
    autopilot(game, dt, t) {
      game.autopilotDrive(0, -1, Math.sin(t * 0.9) * 0.35, dt);
    },
    steps: 260,
  },
  drive: {
    label: 'Sunset drive',
    // An Onda Coupe cruising the beach road, ferris wheel on the left.
    setup(game) {
      game.teleportPlayer(-150, 192, Math.PI / 2);
      game.enterCarByDef('Onda Coupe', -150, 192, Math.PI / 2);
      game.setWanted(0);
      game.setCameraMode('chase');
    },
    autopilot(game, dt, t) {
      game.autopilotDrive(1, 0, Math.sin(t * 0.5) * 0.05, dt);
    },
    steps: 300,
  },
  foot: {
    label: 'On foot at the beach',
    // Walking the sidewalk by the beach, pier and ferris wheel ahead.
    setup(game) {
      game.teleportPlayer(-60, 196, Math.PI / 2);
      game.setWanted(0);
      game.setCameraMode('foot');
    },
    autopilot(game, dt) {
      game.autopilotWalk(1, 0, dt);
    },
    steps: 240,
  },
  city: {
    label: 'City overview',
    // A wide high view of the pier, the wheel and the skyline at sunset.
    setup(game) {
      game.teleportPlayer(60, 190, Math.PI / 2);
      game.enterCarByDef('Coral Cruiser', 60, 190, Math.PI / 2);
      game.setWanted(1);
      game.setCameraMode('city');
    },
    autopilot() {
      // The city shot is a still: the world runs, the camera does not move.
    },
    steps: 200,
  },
};

// The staging run: call this once per frame with the game's real update
// until it returns true, then the game freezes and marks the shot ready.
export function createShotRunner(game, shotDef) {
  let step = 0;
  const total = shotDef.steps;
  return {
    get done() {
      return step >= total;
    },
    get progress() {
      return step / total;
    },
    tick(dt) {
      if (step >= total) return true;
      const t = step / 60;
      shotDef.autopilot(game, dt, t);
      game.updateWorld(dt);
      step += 1;
      return step >= total;
    },
  };
}

// The four screenshots, in order, and which shot each one uses. The render
// script calls the game with these exact query strings.
export const SHOT_FILES = [
  { file: '1-chase.jpg', shot: 'chase', seed: 11 },
  { file: '2-foot.jpg', shot: 'foot', seed: 23 },
  { file: '3-drive.jpg', shot: 'drive', seed: 37 },
  { file: '4-city.jpg', shot: 'city', seed: 41 },
];

export function isKnownShot(name) {
  return Object.prototype.hasOwnProperty.call(SHOT_DEFS, name);
}
