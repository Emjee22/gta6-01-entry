// Story missions for Perla Bay. Eight chapters, original characters,
// each with stages, a payout and dialogue shown in the HUD box.
export const MISSIONS = [
  {
    id: 1, name: 'First Keys', giver: 'Celia Mar',
    brief: 'Celia needs wheels. Borrow the Cometa GT parked by the marina and bring it to her.',
    pay: 400,
    stages: [
      { text: 'Get to the marina car park', hint: 'Follow the gold marker — the Cometa GT is waiting.', type: 'goto', x: -138, z: -92 },
      { text: 'Take the Cometa GT', hint: 'Press F near the car to get in.', type: 'enter' },
      { text: 'Drive it to Celia at the pier', hint: 'Stay on the roads. The city is watching.', type: 'goto', x: -280, z: 170 },
    ],
    dialogue: [
      'Celia Mar: "You made it. I knew the new kid had nerve."',
      'Celia Mar: "Keep the keys warm — Bahía Perla pays those who move fast."',
    ],
  },
  {
    id: 2, name: 'Salt in the Wound', giver: 'Tomas Rey',
    brief: 'Tomas lost a shipment on the beach road. Recover the crate before the tide takes it.',
    pay: 550,
    stages: [
      { text: 'Reach the beached crate', hint: 'South beach, past the palms.', type: 'goto', x: 60, z: 185 },
      { text: 'Pick up the crate', hint: 'Walk over it and press E.', type: 'collect' },
      { text: 'Deliver it to Tomas at the canal bridge', hint: 'East bridge, don’t dawdle.', type: 'goto', x: 92, z: -40 },
    ],
    dialogue: [
      'Tomas Rey: "Salt water ruins everything except a good reputation."',
      'Tomas Rey: "You carry crates like you were born to it."',
    ],
  },
  {
    id: 3, name: 'Ferris Deal', giver: 'Nadia Sol',
    brief: 'Nadia is selling tickets under the wheel. Cover her while she counts the take.',
    pay: 700,
    stages: [
      { text: 'Meet Nadia at the ferris wheel', hint: 'East boardwalk, you can’t miss the lights.', type: 'goto', x: 280, z: 144 },
      { text: 'Hold the spot for 20 seconds', hint: 'Stay inside the gold circle.', type: 'hold', seconds: 20 },
      { text: 'Escort Nadia to the casino', hint: 'Walk her to the Casino Perla doors.', type: 'goto', x: 150, z: 116 },
    ],
    dialogue: [
      'Nadia Sol: "If anyone asks, we were never here."',
      'Nadia Sol: "You’ve got steady hands. I like steady."',
    ],
  },
  {
    id: 4, name: 'Hot Laps', giver: 'Duarte Ferrer',
    brief: 'Duarte bets the Faro Sport can lap the marina in under 90 seconds. Prove him right.',
    pay: 800,
    stages: [
      { text: 'Find the Faro Sport', hint: 'Parked by the hotel, gold paint.', type: 'goto', x: 230, z: 92 },
      { text: 'Take the Faro Sport', hint: 'Press F to get in.', type: 'enter' },
      { text: 'Lap the marina and return', hint: 'Beat 90 seconds. The clock is running.', type: 'race', seconds: 90, x: 230, z: 92 },
    ],
    dialogue: [
      'Duarte Ferrer: "Fast is a language. You speak it fluently."',
      'Duarte Ferrer: "Next time we race for real money."',
    ],
  },
  {
    id: 5, name: 'Night Ferry', giver: 'Celia Mar',
    brief: 'Move a passenger from the pier to the lighthouse without the patrol noticing.',
    pay: 900,
    stages: [
      { text: 'Pick up the passenger at the pier', hint: 'West pier, end of the boards.', type: 'goto', x: -266, z: 300 },
      { text: 'Reach the lighthouse quietly', hint: 'Wanted stars make this much harder.', type: 'goto', x: -306, z: 176 },
    ],
    dialogue: [
      'Celia Mar: "Quiet feet, loud heart. That’s the job."',
      'Celia Mar: "The lighthouse keeper owes me one now."',
    ],
  },
  {
    id: 6, name: 'Canal Run', giver: 'Tomas Rey',
    brief: 'Three drops along the canal, two bridges, one very impatient buyer.',
    pay: 1100,
    stages: [
      { text: 'Drop 1 — west bridge', hint: 'Gold marker on the west canal bridge.', type: 'goto', x: -92, z: -40 },
      { text: 'Drop 2 — east bridge', hint: 'Cross the city to the east bridge.', type: 'goto', x: 92, z: -40 },
      { text: 'Drop 3 — the casino steps', hint: 'Finish at Casino Perla.', type: 'goto', x: 150, z: 116 },
    ],
    dialogue: [
      'Tomas Rey: "Three drops, no questions, no names."',
      'Tomas Rey: "You run this canal like you built it."',
    ],
  },
  {
    id: 7, name: 'High Tide', giver: 'Nadia Sol',
    brief: 'The tide is coming in over the beach road. Get the Vela Van and its cargo to high ground.',
    pay: 1300,
    stages: [
      { text: 'Reach the Vela Van on the sand', hint: 'It’s stuck near the waterline.', type: 'goto', x: 120, z: 190 },
      { text: 'Take the Vela Van', hint: 'Press F to get in.', type: 'enter' },
      { text: 'Drive it to the hotel car park', hint: 'High ground, before the tide turns.', type: 'goto', x: 210, z: 116 },
    ],
    dialogue: [
      'Nadia Sol: "The sea takes what it wants. Today it gets nothing."',
      'Nadia Sol: "You drive a van like it’s a speedboat."',
    ],
  },
  {
    id: 8, name: 'The Perla Job', giver: 'Duarte Ferrer',
    brief: 'One last job: lift the casino’s charity float and vanish before the patrol locks the bridges.',
    pay: 2000,
    stages: [
      { text: 'Reach the Casino Perla vault door', hint: 'Back of the casino, after dark.', type: 'goto', x: 150, z: 116 },
      { text: 'Grab the float', hint: 'Press E at the door.', type: 'collect' },
      { text: 'Lose the heat and reach the lighthouse', hint: 'Get wanted to zero, then run for the point.', type: 'escape', x: -306, z: 176 },
    ],
    dialogue: [
      'Duarte Ferrer: "Tonight Bahía Perla learns your name."',
      'Duarte Ferrer: "Whatever happens — you were never here."',
    ],
  },
];

export function missionById(id) { return MISSIONS.find((m) => m.id === id) || null; }
export function nextMission(doneIds) {
  for (const m of MISSIONS) if (!doneIds.includes(m.id)) return m;
  return null; // all done
}
// Runtime state machine for one mission: stage index, timers, completion.
export function createMissionState(mission) {
  return {
    mission,
    stageIndex: 0,
    stageTime: 0,
    holdTime: 0,
    raceStart: 0,
    done: false,
  };
}

export function currentStage(state) {
  return state.mission.stages[state.stageIndex] || null;
}

export function advanceStage(state) {
  state.stageIndex += 1;
  state.stageTime = 0;
  state.holdTime = 0;
  if (state.stageIndex >= state.mission.stages.length) state.done = true;
  return state.done;
}

// Toast queue text for mission events.
export function missionToast(mission, kind) {
  if (kind === 'start') return 'MISSION: ' + mission.name + ' — ' + mission.giver;
  if (kind === 'done') return 'MISSION COMPLETE: ' + mission.name + '  +$' + mission.pay;
  return mission.name;
}
