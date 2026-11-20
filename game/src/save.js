// Saving and loading Perla Bay's progress in localStorage.
//
// One key holds one JSON object: money, respect, which missions are done,
// which mission is current, settings and a few lifetime stats. Everything
// is validated on load so a corrupt or foreign value can never break the
// game: a bad save is ignored and the game starts fresh.
const SAVE_KEY = 'perlabay.save.v1';
const SAVE_VERSION = 1;

export function blankSave() {
  return {
    version: SAVE_VERSION,
    money: 250,
    respectXp: 0,
    missionsDone: [],
    currentMission: 0,
    bestDrift: 0,
    carsStolen: 0,
    nearMisses: 0,
    settings: { muted: false, radioStation: 0 },
  };
}

function isSaveShape(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.money === 'number' &&
    Number.isFinite(value.money) &&
    typeof value.respectXp === 'number' &&
    Number.isFinite(value.respectXp) &&
    Array.isArray(value.missionsDone) &&
    typeof value.currentMission === 'number'
  );
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isSaveShape(parsed)) return null;
    const save = blankSave();
    save.money = Math.max(0, Math.floor(parsed.money));
    save.respectXp = Math.max(0, Math.floor(parsed.respectXp));
    save.missionsDone = parsed.missionsDone.filter((id) => typeof id === 'number');
    save.currentMission = Math.max(0, Math.floor(parsed.currentMission));
    if (typeof parsed.bestDrift === 'number') save.bestDrift = Math.max(0, parsed.bestDrift);
    if (typeof parsed.carsStolen === 'number') save.carsStolen = Math.max(0, Math.floor(parsed.carsStolen));
    if (typeof parsed.nearMisses === 'number') save.nearMisses = Math.max(0, Math.floor(parsed.nearMisses));
    if (parsed.settings && typeof parsed.settings === 'object') {
      save.settings.muted = !!parsed.settings.muted;
      if (typeof parsed.settings.radioStation === 'number') {
        save.settings.radioStation = Math.max(0, Math.floor(parsed.settings.radioStation));
      }
    }
    return save;
  } catch (err) {
    return null;
  }
}

export function writeSave(state) {
  try {
    const save = blankSave();
    save.money = Math.max(0, Math.floor(state.money || 0));
    save.respectXp = Math.max(0, Math.floor(state.respectXp || 0));
    save.missionsDone = Array.isArray(state.missionsDone) ? state.missionsDone.slice() : [];
    save.currentMission = Math.max(0, Math.floor(state.currentMission || 0));
    save.bestDrift = Math.max(0, state.bestDrift || 0);
    save.carsStolen = Math.max(0, Math.floor(state.carsStolen || 0));
    save.nearMisses = Math.max(0, Math.floor(state.nearMisses || 0));
    save.settings = {
      muted: !!(state.settings && state.settings.muted),
      radioStation: (state.settings && state.settings.radioStation) || 0,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch (err) {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    // Storage may be unavailable; the game still runs.
  }
}

// True when a save exists and parses, without loading it.
export function hasSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    return isSaveShape(JSON.parse(raw));
  } catch (err) {
    return false;
  }
}
