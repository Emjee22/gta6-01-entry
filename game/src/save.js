// Save / load for Perla Bay. localStorage only; nothing leaves the browser.
const KEY = 'perla-bay-save-v1';

export function defaultSave() {
  return {
    money: 250,
    respect: 0,
    missionsDone: [],
    bestSpeed: 0,
    totalDriven: 0,
    createdAt: Date.now(),
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return defaultSave();
    const base = defaultSave();
    const out = {
      money: typeof data.money === 'number' ? data.money : base.money,
      respect: typeof data.respect === 'number' ? data.respect : base.respect,
      missionsDone: Array.isArray(data.missionsDone)
        ? data.missionsDone.filter((id) => typeof id === 'number')
        : [],
      bestSpeed: typeof data.bestSpeed === 'number' ? data.bestSpeed : 0,
      totalDriven: typeof data.totalDriven === 'number' ? data.totalDriven : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : base.createdAt,
    };
    return out;
  } catch (e) {
    return defaultSave();
  }
}

export function writeSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
    return true;
  } catch (e) {
    return false;
  }
}
// Clear the stored save (used by the "New Game" button on the start screen).
export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* storage unavailable */ }
  return defaultSave();
}

// Merge a partial update into the current save and persist it.
export function updateSave(patch) {
  const cur = loadSave();
  const next = Object.assign({}, cur, patch);
  writeSave(next);
  return next;
}
