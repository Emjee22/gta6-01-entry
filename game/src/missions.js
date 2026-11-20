// missions.js — the eight story missions of Perla Bay.
// Each mission names its giver, its target on the map and its reward.
// Dialogue is original writing for this game; the crew are Celia Mar,
// Tomas Rey, Nadia Sol and Duarte Ferrer, all invented for Bahía Perla.

export const MISSIONS = [
  {
    id: 1,
    title: 'First Keys',
    giver: 'Celia Mar',
    brief: 'Meet Celia at the pier and take the keys.',
    dialogue: [
      'Celia Mar: "You made it. The orange one is yours — don\'t scratch it."',
      'Celia Mar: "Drive it down the beach road. Get a feel for her."',
    ],
    target: { x: 0, z: 330, label: 'the pier' },
    reward: 150,
    wanted: 0,
  },
  {
    id: 2,
    title: 'Beach Run',
    giver: 'Tomas Rey',
    brief: 'Drive the beach road to the south point.',
    dialogue: [
      'Tomas Rey: "Sand, sea, no patrols before noon. Perfect road."',
      'Tomas Rey: "Keep it under the limit and nobody looks twice."',
    ],
    target: { x: -298, z: 310, label: 'the south point' },
    reward: 200,
    wanted: 0,
  },
  {
    id: 3,
    title: 'Ferris Deal',
    giver: 'Nadia Sol',
    brief: 'Meet Nadia at the ferris wheel.',
    dialogue: [
      'Nadia Sol: "Meet me by the wheel when the lights come on."',
      'Nadia Sol: "Bring the van. The cargo does not like small cars."',
    ],
    target: { x: -140, z: 300, label: 'the ferris wheel' },
    reward: 250,
    wanted: 1,
  },
  {
    id: 4,
    title: 'Casino Run',
    giver: 'Duarte Ferrer',
    brief: 'Drive to the Casino Perla and park out front.',
    dialogue: [
      'Duarte Ferrer: "Four stars and they still can\'t catch us!"',
      'Duarte Ferrer: "Park where the cameras can see you. Style matters."',
    ],
    target: { x: 150, z: -112, label: 'the casino' },
    reward: 300,
    wanted: 1,
  },
  {
    id: 5,
    title: 'Canal Crossing',
    giver: 'Celia Mar',
    brief: 'Cross the canal bridge at the north end.',
    dialogue: [
      'Celia Mar: "The bridge at the north end. No stopping halfway."',
      'Celia Mar: "If the patrol follows, lose them on the far side."',
    ],
    target: { x: 262, z: 150, label: 'the north bridge' },
    reward: 350,
    wanted: 2,
  },
  {
    id: 6,
    title: 'Night Patrol',
    giver: 'Tomas Rey',
    brief: 'Lose a two-star wanted level.',
    dialogue: [
      'Tomas Rey: "Two stars means they know your car, not your face."',
      'Tomas Rey: "Break line of sight and stay quiet for a while."',
    ],
    target: { x: 0, z: 0, label: 'the plaza' },
    reward: 400,
    wanted: 2,
  },
  {
    id: 7,
    title: 'The Big Score',
    giver: 'Nadia Sol',
    brief: 'Reach the plaza with three stars on you.',
    dialogue: [
      'Nadia Sol: "Three stars and the whole bay is watching."',
      'Nadia Sol: "Get to the plaza. We finish this where everyone can see."',
    ],
    target: { x: 0, z: 0, label: 'the plaza' },
    reward: 600,
    wanted: 3,
  },
  {
    id: 8,
    title: 'King of Perla',
    giver: 'Duarte Ferrer',
    brief: 'Reach the north gate with four stars on you.',
    dialogue: [
      'Duarte Ferrer: "Four stars, one gate, the whole city behind you."',
      'Duarte Ferrer: "Drive like the bay is yours. Because tonight it is."',
    ],
    target: { x: 0, z: -298, label: 'the north gate' },
    reward: 900,
    wanted: 4,
  },
];

export function createMissionState(doneIds) {
  const next = MISSIONS.find((m) => !doneIds.includes(m.id));
  return {
    current: next ? next.id : null,
    stage: 0, // 0 = briefing shown, 1 = en route, 2 = done
    done: doneIds.slice(),
  };
}

export function getCurrentMission(ms) {
  if (ms.current == null) return null;
  return MISSIONS.find((m) => m.id === ms.current) || null;
}

// Distance from the player to the current mission target, in metres.
export function missionDistance(ms, player) {
  const m = getCurrentMission(ms);
  if (!m) return null;
  return Math.hypot(m.target.x - player.x, m.target.z - player.z);
}

// True when the player stands on the target. Mission 6 is special: it
// completes when the wanted level drops back to zero.
export function checkMissionComplete(ms, player, wanted) {
  const m = getCurrentMission(ms);
  if (!m) return false;
  if (m.id === 6) return wanted === 0 && ms.stage === 1;
  return missionDistance(ms, player) < 10;
}

export function completeMission(ms) {
  const m = getCurrentMission(ms);
  if (!m) return null;
  ms.done.push(m.id);
  const next = MISSIONS.find((x) => !ms.done.includes(x.id));
  ms.current = next ? next.id : null;
  ms.stage = 0;
  return m;
}

export function startMission(ms) {
  if (ms.current != null) ms.stage = 1;
}

// The mission list line for the HUD: "3. Ferris Deal — Nadia Sol".
export function missionLabel(m) {
  return `${m.id}. ${m.title} — ${m.giver}`;
}

// Free-roam text once every mission is done.
export function freeRoamText() {
  return 'FREE ROAM — pick a job';
}
