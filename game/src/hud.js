// DOM HUD for Perla Bay: mission panel, wanted stars, money, dispatch list,
// weapon slots, minimap, speed, health/armour, respect, dialogue, radio, toast.
export function createHud(root) {
  const el = document.createElement('div');
  el.id = 'hud';
  el.innerHTML = `
  <div id="hud-top">
    <div id="hud-mission"><div id="hud-mission-name">—</div><div id="hud-mission-stage">—</div><div id="hud-mission-timer"></div></div>
    <div id="hud-stars" aria-label="wanted level"></div>
    <div id="hud-money">$0</div>
  </div>
  <div id="hud-left">
    <div id="hud-dispatch"><div class="hud-title">DISPATCH</div><div id="hud-dispatch-list"></div></div>
    <div id="hud-weapons"><div class="hud-title">WEAPONS</div><div id="hud-weapon-list"></div></div>
  </div>
  <div id="hud-right">
    <canvas id="hud-minimap" width="150" height="150"></canvas>
    <div id="hud-speed"><span id="hud-speed-num">0</span><span id="hud-speed-unit">km/h</span><div id="hud-car-name">ON FOOT</div><div id="hud-car-cond">COND 100%</div></div>
  </div>
  <div id="hud-bottom">
    <div id="hud-vitals"><div id="hud-health">HEALTH <span class="bar"><i id="hud-health-bar"></i></span></div><div id="hud-armour">ARMOUR <span class="bar"><i id="hud-armour-bar"></i></span></div><div id="hud-respect">RESPECT <span id="hud-respect-rank">ROOKIE</span> <span id="hud-respect-xp"></span></div></div>
    <div id="hud-dialogue"></div>
    <div id="hud-radio"><span id="hud-radio-station">—</span><span id="hud-radio-song">—</span></div>
  </div>
  <div id="hud-toast"></div>
  <div id="hud-hint"></div>`;
  root.appendChild(el);
  return {
    el,
    missionName: el.querySelector('#hud-mission-name'),
    missionStage: el.querySelector('#hud-mission-stage'),
    missionTimer: el.querySelector('#hud-mission-timer'),
    stars: el.querySelector('#hud-stars'),
    money: el.querySelector('#hud-money'),
    dispatchList: el.querySelector('#hud-dispatch-list'),
    weaponList: el.querySelector('#hud-weapon-list'),
    minimap: el.querySelector('#hud-minimap'),
    speedNum: el.querySelector('#hud-speed-num'),
    carName: el.querySelector('#hud-car-name'),
    carCond: el.querySelector('#hud-car-cond'),
    healthBar: el.querySelector('#hud-health-bar'),
    armourBar: el.querySelector('#hud-armour-bar'),
    respectRank: el.querySelector('#hud-respect-rank'),
    respectXp: el.querySelector('#hud-respect-xp'),
    dialogue: el.querySelector('#hud-dialogue'),
    radioStation: el.querySelector('#hud-radio-station'),
    radioSong: el.querySelector('#hud-radio-song'),
    toast: el.querySelector('#hud-toast'),
    hint: el.querySelector('#hud-hint'),
  };
}

const WEAPONS = [
  { name: 'FISTS', ammo: '∞' },
  { name: 'PISTOL', ammo: '42' },
  { name: 'SMG', ammo: '120' },
  { name: 'SHOTGUN', ammo: '18' },
];

const RANKS = ['ROOKIE', 'HUSTLER', 'RUNNER', 'FIXER', 'KINGPIN'];
export function respectRank(xp) {
  if (xp >= 4000) return 'KINGPIN';
  if (xp >= 2000) return 'FIXER';
  if (xp >= 900) return 'RUNNER';
  if (xp >= 300) return 'HUSTLER';
  return 'ROOKIE';
}
export function rankIndex(xp) { return RANKS.indexOf(respectRank(xp)); }

let toastTimer = 0;
export function showToast(hud, text, ms = 4200) {
  hud.toast.textContent = text;
  hud.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => hud.toast.classList.remove('show'), ms);
}

let dialogueTimer = 0;
export function showDialogue(hud, text, ms = 6000) {
  hud.dialogue.textContent = text;
  hud.dialogue.classList.add('show');
  clearTimeout(dialogueTimer);
  dialogueTimer = setTimeout(() => hud.dialogue.classList.remove('show'), ms);
}
export function updateHud(hud, s) {
  // s: {missionName, missionStage, missionTimer, wanted, money, dispatch[],
  //     weaponIndex, speedKmh, carName, condition, health, armour, respectXp,
  //     radioStation, radioSong, hint, player, city}
  hud.missionName.textContent = s.missionName || '—';
  hud.missionStage.textContent = s.missionStage || '—';
  hud.missionTimer.textContent = s.missionTimer || '';
  hud.stars.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const star = document.createElement('span');
    star.textContent = '★';
    star.className = i < s.wanted ? 'star on' : 'star';
    hud.stars.appendChild(star);
  }
  hud.money.textContent = '$' + Math.round(s.money).toLocaleString('en-US');
  hud.dispatchList.innerHTML = s.dispatch.length
    ? s.dispatch.map((d) => `<div class="dispatch-row"><b>${d.callsign}</b><span>${d.tactic}</span><i>${d.dist}m</i></div>`).join('')
    : '<div class="dispatch-row"><span>All quiet on the bay.</span></div>';
  hud.weaponList.innerHTML = WEAPONS.map((w, i) =>
    `<div class="weapon-row${i === s.weaponIndex ? ' active' : ''}"><b>${w.name}</b><i>${w.ammo}</i></div>`).join('');
  hud.speedNum.textContent = String(Math.round(s.speedKmh));
  hud.carName.textContent = s.carName || 'ON FOOT';
  hud.carCond.textContent = 'COND ' + Math.round(s.condition) + '%';
  hud.healthBar.style.width = Math.max(0, Math.min(100, s.health)) + '%';
  hud.armourBar.style.width = Math.max(0, Math.min(100, s.armour)) + '%';
  hud.respectRank.textContent = respectRank(s.respectXp);
  hud.respectXp.textContent = s.respectXp + ' XP';
  hud.radioStation.textContent = s.radioStation || '—';
  hud.radioSong.textContent = s.radioSong || '—';
  hud.hint.textContent = s.hint || '';
  drawMinimap(hud, s);
}

function drawMinimap(hud, s) {
  const c = hud.minimap;
  const ctx = c.getContext('2d');
  const W = c.width, H = c.height;
  const half = 340;
  const px = (x) => ((x + half) / (half * 2)) * W;
  const py = (z) => ((z + half) / (half * 2)) * H;
  ctx.clearRect(0, 0, W, H);
  ctx.beginPath(); ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
  ctx.fillStyle = '#0e1a24'; ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2); ctx.clip();
  // sea + beach
  ctx.fillStyle = '#1d6f8e'; ctx.fillRect(0, py(150), W, H - py(150));
  ctx.fillStyle = '#d9c193'; ctx.fillRect(0, py(150), W, py(215) - py(150));
  // canal
  ctx.fillStyle = '#2a7d9e'; ctx.fillRect(0, py(-49), W, py(-31) - py(-49));
  // roads (grid hint)
  ctx.strokeStyle = '#3a3d42'; ctx.lineWidth = 2;
  for (let x = -300; x <= 300; x += 46) { ctx.beginPath(); ctx.moveTo(px(x), 0); ctx.lineTo(px(x), H); ctx.stroke(); }
  for (let z = -300; z <= 140; z += 46) { ctx.beginPath(); ctx.moveTo(0, py(z)); ctx.lineTo(W, py(z)); ctx.stroke(); }
  // mission marker
  if (s.marker) {
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath(); ctx.arc(px(s.marker.x), py(s.marker.z), 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd94a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(px(s.marker.x), py(s.marker.z), 8, 0, Math.PI * 2); ctx.stroke();
  }
  // police dots
  ctx.fillStyle = '#ff4444';
  for (const u of s.policeDots || []) { ctx.beginPath(); ctx.arc(px(u.x), py(u.z), 2.5, 0, Math.PI * 2); ctx.fill(); }
  // player arrow
  const pxx = px(s.player.x), pzz = py(s.player.z);
  ctx.save();
  ctx.translate(pxx, pzz);
  ctx.rotate(Math.atan2(Math.sin(s.player.heading), Math.cos(s.player.heading)) + Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.beginPath(); ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
  ctx.strokeStyle = '#e8e2d2'; ctx.lineWidth = 2; ctx.stroke();
}
