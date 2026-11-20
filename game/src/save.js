// save.js — localStorage save/load for Perla Bay.
// Stores money, finished missions, respect, radio station and mute state.
// A save is plain JSON under one key; a corrupt or foreign value is ignored.

const KEY = 'perla-bay-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d !== 'object') return null;
    return {
      money: typeof d.money === 'number' && Number.isFinite(d.money) ? d.money : 250,
      missionsDone: Array.isArray(d.missionsDone)
        ? d.missionsDone.filter((n) => Number.isInteger(n)) : [],
      respect: typeof d.respect === 'number' && Number.isFinite(d.respect) ? d.respect : 0,
      radioStation: typeof d.radioStation === 'number' ? d.radioStation : 0,
      muted: d.muted === true,
    };
  } catch {
    return null;
  }
}

export function storeSave(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      money: state.money,
      missionsDone: state.missionsDone,
      respect: state.respect,
      radioStation: state.radioStation,
      muted: state.muted,
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}
