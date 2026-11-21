// save.js — localStorage persistence for PERLA BAY.
// Only plain progress numbers are stored: money, respect, XP, mission index,
// health and armour. No positions or world state — every session starts fresh
// on the plaza, which keeps screenshots deterministic.

const KEY = 'perla-bay-save-v1';

export function defaultSave() {
  return {
    money: 250,
    respect: 0,
    xp: 0,
    missionIndex: 0,
    missionStage: 0,
    health: 100,
    armour: 0,
    carsStolen: 0,
    chasesEscaped: 0,
    playSeconds: 0,
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw);
    const base = defaultSave();
    for (const k of Object.keys(base)) {
      if (typeof data[k] === 'number' && Number.isFinite(data[k])) base[k] = data[k];
    }
    return base;
  } catch (e) {
    return defaultSave();
  }
}

export function saveGame(state) {
  try {
    const data = {
      money: Math.round(state.money),
      respect: Math.round(state.respect),
      xp: Math.round(state.xp),
      missionIndex: state.missionIndex,
      missionStage: state.missionStage,
      health: Math.round(state.health),
      armour: Math.round(state.armour),
      carsStolen: state.carsStolen,
      chasesEscaped: state.chasesEscaped,
      playSeconds: Math.round(state.playSeconds),
    };
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch (e) {
    // storage unavailable — the game simply starts fresh.
  }
}

// Respect ranks, in order. xp thresholds are cumulative.
export const RESPECT_RANKS = [
  { name: 'ROOKIE', minXp: 0 },
  { name: 'WHEELMAN', minXp: 150 },
  { name: 'FIXER', minXp: 450 },
  { name: 'BAY HUSTLER', minXp: 1000 },
  { name: 'SHOT CALLER', minXp: 2000 },
  { name: 'PERLA LEGEND', minXp: 4000 },
];

export function respectRankFor(xp) {
  let rank = RESPECT_RANKS[0];
  for (const r of RESPECT_RANKS) {
    if (xp >= r.minXp) rank = r;
  }
  const idx = RESPECT_RANKS.indexOf(rank);
  const next = RESPECT_RANKS[idx + 1] || null;
  const into = next ? xp - rank.minXp : 0;
  const need = next ? next.minXp - rank.minXp : 1;
  return { rank: rank.name, idx, next: next ? next.name : null, progress: Math.min(1, into / need), xp, nextAt: next ? next.minXp : null };
}
