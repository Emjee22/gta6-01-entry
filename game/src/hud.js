// hud.js — the DOM heads-up display of Perla Bay.
// Everything the player reads lives in index.html; this module only writes
// text and bars into it, and draws the circular minimap on its canvas.

export function createHud() {
  const el = (id) => document.getElementById(id);
  const els = {
    money: el('hud-money'),
    missionName: el('hud-mission-name'),
    missionStage: el('hud-mission-stage'),
    stars: el('hud-stars'),
    dispatch: el('hud-dispatch'),
    weapons: el('hud-weapons'),
    minimap: el('hud-minimap'),
    speed: el('hud-speed-num'),
    car: el('hud-car-name'),
    cond: el('hud-car-cond'),
    health: el('hud-health-fill'),
    armour: el('hud-armour-fill'),
    respect: el('hud-respect'),
    radio: el('hud-radio'),
    dialogue: el('hud-dialogue'),
    dialogueName: el('hud-dialogue-name'),
    dialogueText: el('hud-dialogue-text'),
    toast: el('hud-toast'),
    time: el('hud-time'),
  };
  let toastTimer = 0;

  function drawMinimap(state) {
    const cv = els.minimap;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const S = cv.width;
    const toMap = (x, z) => [((x + 360) / 720) * S, ((z + 360) / 720) * S];
    ctx.clearRect(0, 0, S, S);
    // Sea at the bottom, sand above it, city above that.
    ctx.fillStyle = '#1e5a7a';
    ctx.fillRect(0, S * 0.94, S, S * 0.06);
    ctx.fillStyle = '#c2a878';
    ctx.fillRect(0, S * 0.9, S, S * 0.04);
    ctx.fillStyle = '#2a2a33';
    ctx.fillRect(0, 0, S, S * 0.9);
    // Streets.
    ctx.strokeStyle = '#4a4a55';
    ctx.lineWidth = 1;
    for (const s of state.streets) {
      const [x] = toMap(s, 0);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S * 0.9); ctx.stroke();
      const [, z] = toMap(0, s);
      ctx.beginPath(); ctx.moveTo(0, z); ctx.lineTo(S, z); ctx.stroke();
    }
    // Mission target.
    if (state.target) {
      const [tx, tz] = toMap(state.target.x, state.target.z);
      ctx.fillStyle = '#ffd27a';
      ctx.beginPath(); ctx.arc(tx, tz, 4, 0, Math.PI * 2); ctx.fill();
    }
    // Police dots.
    ctx.fillStyle = '#ff4040';
    for (const u of state.policeUnits || []) {
      const [ux, uz] = toMap(u.x, u.z);
      ctx.beginPath(); ctx.arc(ux, uz, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow, rotated to the heading.
    const [px, pz] = toMap(state.player.x, state.player.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(Math.atan2(Math.sin(state.player.heading), Math.cos(state.player.heading)) + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  return {
    update(state) {
      if (els.money) els.money.textContent = '$' + Math.round(state.money).toLocaleString('en-US');
      if (els.missionName) els.missionName.textContent = state.missionLabel || 'FREE ROAM — pick a job';
      if (els.missionStage) els.missionStage.textContent = state.missionStage || '';
      if (els.stars) {
        const spans = els.stars.children;
        for (let i = 0; i < spans.length; i++) {
          spans[i].textContent = i < state.wanted ? '★' : '☆';
          spans[i].style.color = i < state.wanted ? '#ffd27a' : '#666';
        }
      }
      if (els.dispatch) {
        if (!state.dispatch || state.dispatch.length === 0) {
          els.dispatch.innerHTML = '<div class="dim">All quiet on the bay.</div>';
        } else {
          els.dispatch.innerHTML = state.dispatch.map((d) =>
            `<div class="row"><span>${d.callsign}</span><span>${d.tactic}</span><span class="dim">${d.dist}m</span></div>`
          ).join('');
        }
      }
      if (els.weapons) {
        els.weapons.innerHTML = state.weapons.map((w) =>
          `<div class="row${w.active ? ' active' : ''}"><span>${w.name}</span><span>${w.ammo === Infinity ? '∞' : w.ammo}</span></div>`
        ).join('');
      }
      if (els.speed) els.speed.textContent = String(Math.round(state.speedKmh));
      if (els.car) els.car.textContent = state.carName || 'ON FOOT';
      if (els.cond) els.cond.textContent = 'COND ' + Math.round(state.condition) + '%';
      if (els.health) els.health.style.width = Math.max(0, state.health) + '%';
      if (els.armour) els.armour.style.width = Math.max(0, state.armour) + '%';
      if (els.respect) els.respect.textContent = 'RESPECT ' + state.respectLabel + ' ' + state.respect + ' XP';
      if (els.radio) els.radio.textContent = state.radio || '';
      if (els.time) els.time.textContent = state.time || '';
      drawMinimap(state);
      if (toastTimer > 0) {
        toastTimer -= 1;
        if (toastTimer === 0 && els.toast) els.toast.style.opacity = '0';
      }
    },

    // A centre toast that fades after ~4 seconds (240 frames at 60fps).
    toast(msg) {
      if (!els.toast) return;
      els.toast.textContent = msg;
      els.toast.style.opacity = '1';
      toastTimer = 240;
    },
    dialogue(name, text) {
      if (!els.dialogue) return;
      els.dialogue.style.display = 'block';
      if (els.dialogueName) els.dialogueName.textContent = name;
      if (els.dialogueText) els.dialogueText.textContent = text;
    },
    clearDialogue() {
      if (els.dialogue) els.dialogue.style.display = 'none';
    },
  };
}
