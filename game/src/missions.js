// The story of Perla Bay: eight missions, from a first stolen car to a
// five-star escape.
//
// Each mission is a list of stages. A stage has a type the manager knows
// how to check (goto, steal, deliver, escape, collect), a place on the map,
// a line of dialogue, and optionally a time limit. Rewards are paid in cash
// and respect XP when the last stage clears.
export const MISSIONS = [
  {
    id: 1,
    title: 'First Keys',
    brief: 'Celia needs a car. Any car. Take one off the street and bring it to the garage.',
    reward: { money: 400, xp: 100 },
    dialogue: [
      { who: 'Celia Mar', text: 'You want in? Then get me a car. Parked ones are free — just don\u2019t let the PD see you.' },
      { who: 'Celia Mar', text: 'Press F near a parked car to get in. Drive it to the garage on Coral Street.' },
    ],
    stages: [
      { type: 'steal', text: 'Steal a parked car (press F near one)' },
      { type: 'deliver', x: 48, z: 96, text: 'Drive the car to the garage' },
    ],
  },
  {
    id: 2,
    title: 'Pearl Run',
    brief: 'A package is waiting at the pier. Pick it up and deliver it to the north gate before the clock runs out.',
    reward: { money: 700, xp: 150 },
    dialogue: [
      { who: 'Celia Mar', text: 'A package at the pier, a buyer at the north gate. Ninety seconds. Don\u2019t scratch the paint.' },
    ],
    stages: [
      { type: 'goto', x: 120, z: 210, text: 'Pick up the package at the pier' },
      { type: 'deliver', x: 0, z: -192, timeLimit: 90, text: 'Deliver to the north gate (90s)' },
    ],
  },
  {
    id: 3,
    title: 'The Faro Job',
    brief: 'Tomas spotted a Coral Cruiser in the lot by the casino. Repo it and bring it home.',
    reward: { money: 900, xp: 200 },
    dialogue: [
      { who: 'Tomas Ibarra', text: 'There\u2019s a Coral Cruiser sitting in the lot by the casino. Keys in the visor. It\u2019s ours now.' },
    ],
    stages: [
      { type: 'steal', special: 'repo', x: 144, z: 144, text: 'Take the Coral Cruiser from the casino lot' },
      { type: 'deliver', x: 48, z: 96, text: 'Bring it back to the garage' },
    ],
  },
  {
    id: 4,
    title: 'Static on the Air',
    brief: 'Nadia needs a radio part from the market. The PD is already watching — lose them after the pickup.',
    reward: { money: 1100, xp: 250 },
    dialogue: [
      { who: 'Nadia Solis', text: 'I need a tuner from the market stall. Grab it, and if the PD shows up, shake them off. Then come back clean.' },
    ],
    stages: [
      { type: 'goto', x: -96, z: -48, text: 'Pick up the tuner at the market' },
      { type: 'escape', text: 'Lose the cops — get your wanted level to zero', heat: 45 },
      { type: 'goto', x: 48, z: 96, text: 'Return to the garage, clean' },
    ],
  },
  {
    id: 5,
    title: 'The Casino Drop',
    brief: 'Cash to the casino, fast. The PD will be on you halfway there — keep driving.',
    reward: { money: 1400, xp: 300 },
    dialogue: [
      { who: 'Celia Mar', text: 'A bag of cash for the casino. Two minutes. The PD will try to stop you — don\u2019t let them.' },
    ],
    stages: [
      { type: 'deliver', x: 150, z: 168, timeLimit: 120, text: 'Deliver the cash to Casino Perla (120s)', heat: 30 },
    ],
  },
  {
    id: 6,
    title: 'Hot Pursuit',
    brief: 'Four stars and nowhere to hide. Survive the dragnet and lose every unit.',
    reward: { money: 1800, xp: 400 },
    dialogue: [
      { who: 'Captain Ferrer', text: 'All units, the driver is ours. Box them in. Do not let them reach the bridge.' },
      { who: 'Tomas Ibarra', text: 'Four stars! Cut through the alleys, use the nitro, and don\u2019t stop until the stars are gone.' },
    ],
    stages: [
      { type: 'escape', text: 'Lose the 4-star wanted level', heat: 85 },
    ],
  },
  {
    id: 7,
    title: 'The Duarte Debt',
    brief: 'Ramon Duarte owes the crew. Collect from three of his spots around the city.',
    reward: { money: 2200, xp: 450 },
    dialogue: [
      { who: 'Celia Mar', text: 'Duarte owes us. Three spots: the cafe, the marina office, and the north market. Collect them all.' },
    ],
    stages: [
      { type: 'collect', x: -48, z: 48, text: 'Collect at the cafe (1/3)' },
      { type: 'collect', x: 96, z: 192, text: 'Collect at the marina office (2/3)' },
      { type: 'collect', x: -144, z: -144, text: 'Collect at the north market (3/3)' },
    ],
  },
  {
    id: 8,
    title: 'Perla Rising',
    brief: 'The finale. Steal Duarte\u2019s Arena Roadster, pick up Tomas and Nadia, and escape a five-star dragnet to the pier.',
    reward: { money: 5000, xp: 1000 },
    dialogue: [
      { who: 'Celia Mar', text: 'Tonight we take everything. Duarte\u2019s Roadster is at the pier lot. Get Tomas and Nadia, then run.' },
      { who: 'Ramon Duarte', text: 'You touch my car and the whole PD will be on you. Five stars. Let\u2019s see you drive, kid.' },
    ],
    stages: [
      { type: 'steal', special: 'finale', x: 120, z: 210, text: 'Steal Duarte\u2019s Arena Roadster at the pier' },
      { type: 'goto', x: -48, z: -96, text: 'Pick up Tomas (1/2)', inCar: true },
      { type: 'goto', x: 96, z: -48, text: 'Pick up Nadia (2/2)', inCar: true },
      { type: 'escape', text: 'Escape the 5-star dragnet — lose every unit', heat: 100 },
      { type: 'deliver', x: 120, z: 226, text: 'Deliver the Roadster to the end of the pier' },
    ],
  },
];

import * as THREE from 'three';
import { createCar, CAR_DEFS } from './cars.js';

// The mission manager: runs one mission at a time, shows a glowing beacon
// at the current objective, counts timers, and pays rewards. The game wires
// its callbacks (onStage, onComplete, onFail, onDialogue) to the HUD.
export function createMissions(scene, city, police) {
  // The beacon: a vertical beam of light plus a ring on the ground, marking
  // the current objective from anywhere in the city.
  const marker = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  marker.add(beam);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 3.4, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  marker.add(ring);
  marker.visible = false;
  scene.add(marker);

  let currentIndex = -1;
  let stageIndex = 0;
  let stageTimer = 0;
  let stageTimeLimit = 0;
  let specialCar = null;
  let active = false;
  let completedCount = 0;

  const hooks = {
    onStage: () => {},
    onComplete: () => {},
    onFail: () => {},
    onDialogue: () => {},
  };

  function setMarker(x, z) {
    marker.position.set(x, 0, z);
    marker.visible = true;
  }

  function hideMarker() {
    marker.visible = false;
  }

  function stage() {
    if (currentIndex < 0) return null;
    return MISSIONS[currentIndex].stages[stageIndex];
  }

  function startStage(now) {
    const s = stage();
    if (!s) return;
    stageTimeLimit = s.timeLimit || 0;
    stageTimer = stageTimeLimit;
    if (s.x !== undefined) setMarker(s.x, s.z);
    else hideMarker();
    // Special cars: the repo target and Duarte's Roadster are spawned by
    // the mission and parked at their stage location.
    if (s.special === 'repo') {
      const def = CAR_DEFS.find((d) => d.name === 'Coral Cruiser');
      specialCar = createCar(scene, def, s.x, s.z, Math.PI / 2);
      specialCar.condition = 90;
    } else if (s.special === 'finale') {
      const def = CAR_DEFS.find((d) => d.name === 'Arena Roadster');
      specialCar = createCar(scene, def, s.x, s.z, -Math.PI / 2);
      specialCar.condition = 100;
    }
    if (s.heat) police.addHeat(s.heat, now || 0);
    hooks.onStage(MISSIONS[currentIndex].title, stageIndex + 1, MISSIONS[currentIndex].stages.length, s.text, stageTimeLimit);
  }

  function start(index, now) {
    if (index < 0 || index >= MISSIONS.length) return false;
    // A restart cleans up the previous attempt's special car first.
    if (specialCar) {
      scene.remove(specialCar.mesh);
      specialCar = null;
    }
    hideMarker();
    currentIndex = index;
    stageIndex = 0;
    active = true;
    const mission = MISSIONS[index];
    hooks.onDialogue(mission.dialogue);
    startStage(now);
    return true;
  }

  function advance(now) {
    stageIndex += 1;
    const mission = MISSIONS[currentIndex];
    if (stageIndex >= mission.stages.length) {
      active = false;
      hideMarker();
      completedCount += 1;
      if (specialCar) {
        scene.remove(specialCar.mesh);
        specialCar = null;
      }
      hooks.onComplete(mission);
      return;
    }
    startStage(now);
  }

  function fail(reason) {
    active = false;
    hideMarker();
    if (specialCar) {
      scene.remove(specialCar.mesh);
      specialCar = null;
    }
    hooks.onFail(MISSIONS[currentIndex], reason);
  }

  function update(dt, ctx) {
    if (!active) return;
    const s = stage();
    if (!s) return;
    if (stageTimeLimit > 0) {
      stageTimer -= dt;
      if (stageTimer <= 0) {
        fail('Time ran out.');
        return;
      }
    }
    const p = ctx.playerPos;
    const dist = s.x !== undefined ? Math.hypot(p.x - s.x, p.z - s.z) : Infinity;
    switch (s.type) {
      case 'goto': {
        const needCar = !!s.inCar;
        if (dist < 6 && (!needCar || ctx.inCar)) advance(ctx.time);
        break;
      }
      case 'steal': {
        if (s.special) {
          if (ctx.inCar && ctx.car === specialCar) advance(ctx.time);
        } else if (ctx.inCar) {
          advance(ctx.time);
        }
        break;
      }
      case 'deliver': {
        if (ctx.inCar && dist < 7) advance(ctx.time);
        break;
      }
      case 'collect': {
        if (dist < 5) advance(ctx.time);
        break;
      }
      case 'escape': {
        if (police.wanted === 0) advance(ctx.time);
        break;
      }
      default:
        break;
    }
    // The beacon pulses so it is easy to spot.
    if (marker.visible) {
      const pulse = 0.6 + Math.sin(performance.now() / 240) * 0.25;
      beam.material.opacity = 0.28 * pulse;
      ring.scale.setScalar(1 + Math.sin(performance.now() / 240) * 0.08);
    }
  }

  return {
    hooks,
    marker,
    get active() {
      return active;
    },
    get currentIndex() {
      return currentIndex;
    },
    get completedCount() {
      return completedCount;
    },
    get specialCar() {
      return specialCar;
    },
    get stageTimer() {
      return stageTimer;
    },
    get stageIndex() {
      return stageIndex;
    },
    get stageTimeLimit() {
      return stageTimeLimit;
    },
    current() {
      return currentIndex >= 0 ? MISSIONS[currentIndex] : null;
    },
    currentStage() {
      return stage();
    },
    start,
    update,
    fail,
    // The player was busted: the active mission fails.
    onBusted() {
      if (active) fail('Busted by the Perla PD.');
    },
  };
}
