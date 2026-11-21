// missions.js — 8 story missions in Bahía Perla.
// Each mission has stages; a stage completes by reaching a marker, entering
// a car, or losing the police. Dialogue is shown in the HUD dialogue box.
// Characters: Celia Mar (fixer), Tomas (driver), Nadia Sol (crew / hacker),
// Duarte Ferrer (the rival who owns the bay).

export const MISSIONS = [
  {
    id: 1, title: 'First Keys', giver: 'Celia Mar',
    intro: 'Celia Mar: "Welcome to Perla Bay, rookie. Every legend here started with one stolen car. Take the Faro Sport on the plaza — keys are in it."',
    reward: 150, xp: 60,
    stages: [
      { objective: 'Steal the Faro Sport on Plaza Perla', type: 'enterCar', car: 'Faro Sport', dialogue: 'Celia Mar: "Good. Now drive it to the Muelle Perla and don\'t scratch my paint."', target: null },
      { objective: 'Drive to Muelle Perla (the pier)', type: 'reach', target: { x: 0, z: 300 }, radius: 14, dialogue: 'Celia Mar: "You made it. Tomas is waiting — he teaches the fast ones."', targetName: 'Muelle Perla' },
    ],
  },
  {
    id: 2, title: 'Tomas Teaches Speed', giver: 'Tomas',
    intro: 'Tomas: "Celia says you can drive. Prove it. Rueda del Sol, three laps of the beach road — and don\'t brake for the view."',
    reward: 220, xp: 90,
    stages: [
      { objective: 'Reach the Rueda del Sol ferris wheel', type: 'reach', target: { x: 58, z: 266 }, radius: 16, dialogue: 'Tomas: "First checkpoint. Now push it down the beach road to the Casino Perla."', targetName: 'Rueda del Sol' },
      { objective: 'Reach Casino Perla', type: 'reach', target: { x: -116, z: 174 }, radius: 16, dialogue: 'Tomas: "Not bad, rookie. Nadia wants a word — she runs the eyes in the sky."', targetName: 'Casino Perla' },
    ],
  },
  {
    id: 3, title: 'Ferris Deal', giver: 'Nadia Sol',
    intro: 'Nadia Sol: "Duarte Ferrer thinks he owns this bay. His courier parks a Cometa GT by the wheel every sunset. Take it — and make it look like traffic."',
    reward: 300, xp: 120,
    stages: [
      { objective: 'Steal the Cometa GT near Rueda del Sol', type: 'enterCar', car: 'Cometa GT', dialogue: 'Nadia Sol: "Got it. Now bring it to my garage on the north avenue. Quietly."', target: null },
      { objective: 'Deliver the Cometa GT to the north garage', type: 'reach', target: { x: -58, z: -232 }, radius: 14, dialogue: 'Nadia Sol: "Clean. Duarte won\'t even know which car is missing yet."', targetName: 'North Garage' },
    ],
  },
  {
    id: 4, title: 'Heat on the Avenue', giver: 'Celia Mar',
    intro: 'Celia Mar: "The PD is crawling the avenues after that Cometa. Get in a car, draw them out — and then lose them. That\'s the job."',
    reward: 350, xp: 140,
    stages: [
      { objective: 'Get wanted — the police must chase you', type: 'wanted', minWanted: 2, dialogue: 'Celia Mar: "There they are. Now run — shake every unit off your tail."', target: null },
      { objective: 'Lose the police (wanted back to 0)', type: 'loseCops', dialogue: 'Celia Mar: "Ghost. That\'s how you survive in Perla Bay."', target: null },
    ],
  },
  {
    id: 5, title: 'The Pier Drop', giver: 'Tomas',
    intro: 'Tomas: "A package is waiting at the end of the pier. Cops watch the deck — drive fast, grab it, and be gone before the spotlight finds you."',
    reward: 420, xp: 170,
    stages: [
      { objective: 'Reach the end of Muelle Perla', type: 'reach', target: { x: 0, z: 330 }, radius: 10, dialogue: 'Tomas: "Package secured. Now the casino — Duarte\'s boys will be on the road."', targetName: 'Pier End' },
      { objective: 'Reach Casino Perla with the package', type: 'reach', target: { x: -116, z: 174 }, radius: 16, dialogue: 'Tomas: "Delivered. Celia is impressed — and she\'s not easy to impress."', targetName: 'Casino Perla' },
    ],
  },
  {
    id: 6, title: 'Nadia Runs Interference', giver: 'Nadia Sol',
    intro: 'Nadia Sol: "I can jam their radios for thirty seconds — once. Press E when the heat is on you and watch the stars fall. Use it on the run to the plaza."',
    reward: 480, xp: 200,
    stages: [
      { objective: 'Use the crew ability (E) while wanted', type: 'ability', dialogue: 'Nadia Sol: "Jammed. Their dispatch is blind — now get to Plaza Perla."', target: null },
      { objective: 'Reach Plaza Perla', type: 'reach', target: { x: 12, z: 14 }, radius: 14, dialogue: 'Nadia Sol: "You\'re learning. One more job and Duarte will know your name."', targetName: 'Plaza Perla' },
    ],
  },
  {
    id: 7, title: 'Duarte Ferrer', giver: 'Duarte Ferrer',
    intro: 'Duarte Ferrer: "So you\'re the rookie stealing my cars. Come to the casino, face to face. Bring the fastest car you own — you\'ll need it to leave."',
    reward: 600, xp: 260,
    stages: [
      { objective: 'Face Duarte at Casino Perla', type: 'reach', target: { x: -116, z: 174 }, radius: 16, dialogue: 'Duarte Ferrer: "You have nerve. The bay is mine — but I respect nerve. One last run, winner takes the night."', targetName: 'Casino Perla' },
      { objective: 'Escape to the pier with the police on you', type: 'reach', target: { x: 0, z: 330 }, radius: 12, dialogue: 'Duarte Ferrer: "Four stars and they still can\'t catch us! The bay is yours tonight, rookie."', targetName: 'Pier End' },
    ],
  },
  {
    id: 8, title: 'Queen of the Bay', giver: 'Celia Mar',
    intro: 'Celia Mar: "Last job. The whole PD will be out. Drive the bay end to end, lose every unit, and park on the plaza like you own it. Because after tonight — you do."',
    reward: 900, xp: 400,
    stages: [
      { objective: 'Reach the north garage at full heat', type: 'reach', target: { x: -58, z: -232 }, radius: 14, dialogue: 'Celia Mar: "Halfway. The plaza is waiting — bring it home."', targetName: 'North Garage' },
      { objective: 'Park on Plaza Perla and finish the run', type: 'reach', target: { x: 12, z: 14 }, radius: 12, dialogue: 'Celia Mar: "Queen of the Bay. Perla is yours now — spend it well."', targetName: 'Plaza Perla' },
    ],
  },
];

export function createMissionState(save) {
  return {
    index: Math.min(save.missionIndex || 0, MISSIONS.length - 1),
    stage: save.missionStage || 0,
    timer: 0,
    done: false,
    dialogue: null,
    dialogueUntil: 0,
    abilityUsed: false,
  };
}

export function currentMission(state) {
  return MISSIONS[state.index] || MISSIONS[MISSIONS.length - 1];
}

export function currentStage(state) {
  const m = currentMission(state);
  return m.stages[Math.min(state.stage, m.stages.length - 1)];
}

export function missionProgress(state) {
  const m = currentMission(state);
  return { mission: state.index + 1, total: MISSIONS.length, stage: state.stage + 1, stages: m.stages.length };
}

// Advance the mission state. ctx: {x, z, inCar, carName, wanted, abilityUsed,
// onStage(fn), onComplete(fn)}. Returns true when a stage completed.
export function updateMissions(dt, ms, ctx) {
  ms.timer += dt;
  if (ms.done) return false;
  const stage = currentStage(ms);
  let complete = false;
  if (stage.type === 'reach') {
    const dx = ctx.x - stage.target.x;
    const dz = ctx.z - stage.target.z;
    if (Math.hypot(dx, dz) <= stage.radius) complete = true;
  } else if (stage.type === 'enterCar') {
    if (ctx.inCar && ctx.carName === stage.car) complete = true;
  } else if (stage.type === 'wanted') {
    if (ctx.wanted >= (stage.minWanted || 1)) complete = true;
  } else if (stage.type === 'loseCops') {
    if (ctx.wanted === 0 && ms.timer > 5) complete = true;
  } else if (stage.type === 'ability') {
    if (ctx.abilityUsed) complete = true;
  }
  if (!complete) return false;
  if (stage.dialogue) {
    ms.dialogue = stage.dialogue;
    ms.dialogueUntil = ms.timer + 6;
  }
  const m = currentMission(ms);
  if (ms.stage + 1 >= m.stages.length) {
    // Mission complete: reward + advance.
    if (ctx.onComplete) ctx.onComplete(m);
    if (ms.index + 1 < MISSIONS.length) {
      ms.index++;
      ms.stage = 0;
      ms.timer = 0;
      ms.abilityUsed = false;
      const next = currentMission(ms);
      ms.dialogue = next.intro;
      ms.dialogueUntil = ms.timer + 7;
    } else {
      ms.done = true;
      ms.dialogue = 'Celia Mar: "Every mission done. Perla Bay is yours — free roam, chase the sun."';
      ms.dialogueUntil = ms.timer + 8;
    }
  } else {
    ms.stage++;
    if (ctx.onStage) ctx.onStage(m, ms.stage);
  }
  return true;
}

export function missionTarget(ms) {
  const stage = currentStage(ms);
  if (stage.type === 'reach') return { x: stage.target.x, z: stage.target.z, name: stage.targetName || 'Target' };
  return null;
}

// Seconds formatted as M:SS for the HUD timer.
export function formatTimer(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
