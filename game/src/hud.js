// hud.js — the dense DOM overlay for PERLA BAY.
// Mission panel, wanted stars, money, dispatch list, weapon slots, circular
// minimap, speed + car + condition, health/armour, respect rank, dialogue
// box, radio and toasts. All DOM; the 3D canvas stays clean underneath.

const WEAPONS = [
  { slot: 1, name: 'FISTS', ammo: '—' },
  { slot: 2, name: 'PISTOL', ammo: '24/96' },
  { slot: 3, name: 'SMG', ammo: '32/128' },
  { slot: 4, name: 'SHOTGUN', ammo: '8/32' },
];

function el(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

export function buildHUD() {
  const root = document.getElementById('hud');
  root.innerHTML = '';

  const mission = el('div', 'hud-panel hud-mission', root);
  el('div', 'hud-mission-title', mission, '1. First Keys — Celia Mar');
  el('div', 'hud-mission-stage', mission, 'STAGE 1/2');
  el('div', 'hud-mission-timer', mission, '0:00');
  el('div', 'hud-mission-objective', mission, 'Steal the Faro Sport on Plaza Perla');

  const wanted = el('div', 'hud-wanted', root);
  for (let i = 0; i < 4; i++) el('span', 'hud-star', wanted, '★');

  const topRight = el('div', 'hud-panel hud-top-right', root);
  el('div', 'hud-money', topRight, '$250');
  el('div', 'hud-clock', topRight, 'SUNSET 18:42');
  el('div', 'hud-radio', topRight, 'PERLA FM 88.4 — Sunset Drive');

  const dispatch = el('div', 'hud-panel hud-dispatch', root);
  el('div', 'hud-dispatch-title', dispatch, 'PERLA BAY PD — DISPATCH');
  const dispatchList = el('div', 'hud-dispatch-list', dispatch);

  const weapons = el('div', 'hud-weapons', root);
  for (const w of WEAPONS) {
    const slot = el('div', 'hud-weapon', weapons);
    el('span', 'hud-weapon-key', slot, String(w.slot));
    el('span', 'hud-weapon-name', slot, w.name);
    el('span', 'hud-weapon-ammo', slot, w.ammo);
  }

  const mapWrap = el('div', 'hud-map-wrap', root);
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = 180;
  mapCanvas.height = 180;
  mapCanvas.className = 'hud-minimap';
  mapWrap.appendChild(mapCanvas);
  el('div', 'hud-map-label', mapWrap, 'BAHÍA PERLA');

  const vehicle = el('div', 'hud-panel hud-vehicle', root);
  el('div', 'hud-speed', vehicle, '0');
  el('div', 'hud-speed-unit', vehicle, 'km/h');
  el('div', 'hud-car', vehicle, 'ON FOOT');
  el('div', 'hud-condition', vehicle, 'CONDITION —');
  const bars = el('div', 'hud-bars', vehicle);
  const hpBar = el('div', 'hud-bar hud-bar-hp', bars);
  el('div', 'hud-bar-label', hpBar, 'HEALTH');
  const hpFill = el('div', 'hud-bar-fill', hpBar);
  const arBar = el('div', 'hud-bar hud-bar-ar', bars);
  el('div', 'hud-bar-label', arBar, 'ARMOUR');
  const arFill = el('div', 'hud-bar-fill', arBar);
  const respect = el('div', 'hud-respect', vehicle, 'ROOKIE — 0 XP');

  const dialogue = el('div', 'hud-dialogue', root);
  el('div', 'hud-dialogue-name', dialogue, 'Celia Mar');
  el('div', 'hud-dialogue-text', dialogue, '');
  dialogue.style.display = 'none';

  const toast = el('div', 'hud-toast', root);
  toast.style.display = 'none';

  const start = el('div', 'hud-start', root);
  el('div', 'hud-start-title', start, 'PERLA BAY');
  el('div', 'hud-start-sub', start, 'Bahía Perla — the whole bay at sunset');
  el('div', 'hud-start-desc', start, 'Steal cars, outrun the Perla Bay PD, run 8 story missions with Celia, Tomas and Nadia — and take the bay from Duarte Ferrer.');
  const startBtn = el('button', 'hud-start-btn', start, '▶  START ENGINE');
  el('div', 'hud-start-hints', start, 'WASD jalan / nyetir · F masuk-keluar mobil · E ability crew · Shift lari / drift · M mute · P pause');
  el('div', 'hud-start-save', start, '');

  const pause = el('div', 'hud-pause', root);
  el('div', 'hud-pause-title', pause, 'PAUSED');
  el('div', 'hud-pause-text', pause, 'Tekan P untuk lanjut. Progress tersimpan otomatis.');
  pause.style.display = 'none';

  return {
    root, mission, wanted, topRight, dispatch, dispatchList, weapons,
    mapCanvas, vehicle, dialogue, toast, start, pause, startBtn,
    refs: {
      missionTitle: mission.querySelector('.hud-mission-title'),
      missionStage: mission.querySelector('.hud-mission-stage'),
      missionTimer: mission.querySelector('.hud-mission-timer'),
      missionObjective: mission.querySelector('.hud-mission-objective'),
      stars: wanted.querySelectorAll('.hud-star'),
      money: topRight.querySelector('.hud-money'),
      clock: topRight.querySelector('.hud-clock'),
      radio: topRight.querySelector('.hud-radio'),
      speed: vehicle.querySelector('.hud-speed'),
      car: vehicle.querySelector('.hud-car'),
      condition: vehicle.querySelector('.hud-condition'),
      hpFill, arFill, respect: vehicle.querySelector('.hud-respect'),
      dialogueName: dialogue.querySelector('.hud-dialogue-name'),
      dialogueText: dialogue.querySelector('.hud-dialogue-text'),
      startSave: start.querySelector('.hud-start-save'),
    },
  };
}

// ---- HUD updates: called every frame with live game data. ----

export function updateHUD(hud, d) {
  const r = hud.refs;
  r.missionTitle.textContent = d.missionTitle;
  r.missionStage.textContent = 'STAGE ' + d.missionStage + '/' + d.missionStages + '  ·  MISSION ' + d.missionIndex + '/' + d.missionTotal;
  r.missionTimer.textContent = d.timer;
  r.missionObjective.textContent = d.objective;
  r.stars.forEach((s, i) => {
    s.classList.toggle('lit', i < d.wanted);
  });
  hud.wanted.classList.toggle('hot', d.wanted >= 3);
  r.money.textContent = '$' + Math.round(d.money).toLocaleString('en-US');
  r.clock.textContent = d.clock;
  r.radio.textContent = d.radio;
  r.speed.textContent = String(Math.round(d.speedKmh));
  r.car.textContent = d.carName;
  r.condition.textContent = d.inCar ? 'CONDITION ' + Math.round(d.condition) + '%' : 'ON FOOT';
  r.hpFill.style.width = Math.max(0, Math.min(100, d.health)) + '%';
  r.arFill.style.width = Math.max(0, Math.min(100, d.armour)) + '%';
  r.respect.textContent = d.respectRank + ' — ' + Math.round(d.xp) + ' XP';
  // Dispatch list: callsign + tactic + distance.
  const rows = d.dispatch.map((u) => u.callsign + '  ' + u.tactic + '  ' + u.dist + 'm');
  hud.dispatchList.innerHTML = rows.length
    ? rows.map((t) => '<div class="hud-dispatch-row">' + t + '</div>').join('')
    : '<div class="hud-dispatch-row hud-dispatch-quiet">NO UNITS ON SCENE</div>';
  // Weapon slots: highlight the selected one.
  const slots = hud.weapons.querySelectorAll('.hud-weapon');
  slots.forEach((s, i) => s.classList.toggle('active', i === d.weapon - 1));
}

export function showDialogue(hud, text) {
  if (!text) {
    hud.dialogue.style.display = 'none';
    return;
  }
  const m = text.match(/^([^:]+):\s*(.*)$/);
  hud.refs.dialogueName.textContent = m ? m[1] : '';
  hud.refs.dialogueText.textContent = m ? m[2] : text;
  hud.dialogue.style.display = 'block';
}

let toastTimer = 0;
export function toast(hud, text, ms) {
  hud.toast.textContent = text;
  hud.toast.style.display = 'block';
  toastTimer = ms || 2600;
  return toastTimer;
}

export function updateToast(hud, dt) {
  if (toastTimer > 0) {
    toastTimer -= dt * 1000;
    if (toastTimer <= 0) hud.toast.style.display = 'none';
  }
}

// Circular minimap: streets, sea, player arrow, police dots, mission marker.
export function drawMinimap(hud, d) {
  const cv = hud.mapCanvas;
  const ctx = cv.getContext('2d');
  const W = cv.width;
  const H = cv.height;
  const cx = W / 2;
  const cy = H / 2;
  const R = W / 2 - 4;
  const half = d.half;
  function toMap(x, z) {
    return [cx + (x / half) * R, cy + (z / half) * R];
  }
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#2a2a30';
  ctx.fillRect(0, 0, W, H);
  // Sea (south).
  ctx.fillStyle = '#2a6a8a';
  const [, seaY] = toMap(0, d.seaZ);
  ctx.fillRect(0, seaY, W, H - seaY);
  // Streets.
  ctx.strokeStyle = '#55555e';
  ctx.lineWidth = 3;
  for (let k = -5; k <= 5; k++) {
    const [x] = toMap(k * 58, 0);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    const [, z] = toMap(0, k * 58);
    ctx.beginPath(); ctx.moveTo(0, z); ctx.lineTo(W, z); ctx.stroke();
  }
  // Mission marker (gold diamond).
  if (d.target) {
    const [tx, tz] = toMap(d.target.x, d.target.z);
    ctx.fillStyle = '#ffd880';
    ctx.beginPath();
    ctx.moveTo(tx, tz - 7); ctx.lineTo(tx + 6, tz); ctx.lineTo(tx, tz + 7); ctx.lineTo(tx - 6, tz);
    ctx.closePath(); ctx.fill();
  }
  // Police dots (red).
  ctx.fillStyle = '#ff4040';
  for (const p of d.policeDots) {
    const [px, pz] = toMap(p.x, p.z);
    ctx.beginPath(); ctx.arc(px, pz, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow (white, rotated by heading).
  const [px, pz] = toMap(d.playerX, d.playerZ);
  ctx.save();
  ctx.translate(px, pz);
  ctx.rotate(Math.atan2(Math.sin(d.heading), Math.cos(d.heading)) + Math.PI / 2);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(-5, 6);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  // Rim.
  ctx.strokeStyle = '#ffd880';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
}
