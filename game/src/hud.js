// The HUD for Perla Bay.
//
// A dense DOM overlay, updated every frame from the game state: mission
// panel, wanted stars, money, the police dispatch list, weapon slots, a
// circular minimap, speed and car condition, health and armour, respect,
// dialogue with portraits, and the radio. Text is only rewritten when its
// value changes, so the overlay costs almost nothing per frame.
export function createHud(doc) {
  const $ = (id) => doc.getElementById(id);
  const els = {
    missionPanel: $('mission-panel'),
    missionTitle: $('mission-title'),
    missionStage: $('mission-stage'),
    missionText: $('mission-text'),
    missionTimer: $('mission-timer'),
    missionNext: $('mission-next'),
    wantedStars: $('wanted-stars'),
    money: $('money'),
    dispatchList: $('dispatch-list'),
    weaponSlots: [$('weapon-0'), $('weapon-1'), $('weapon-2'), $('weapon-3')],
    minimap: $('minimap'),
    speed: $('speed'),
    carName: $('car-name'),
    carConditionFill: $('car-condition-fill'),
    carConditionText: $('car-condition-text'),
    healthFill: $('health-fill'),
    armourFill: $('armour-fill'),
    respectRank: $('respect-rank'),
    respectXpFill: $('respect-xp-fill'),
    dialogue: $('dialogue'),
    dialogueWho: $('dialogue-who'),
    dialogueText: $('dialogue-text'),
    dialoguePortrait: $('dialogue-portrait'),
    radioStation: $('radio-station'),
    radioSong: $('radio-song'),
    prompt: $('prompt'),
    toast: $('toast'),
    startScreen: $('start-screen'),
    pauseScreen: $('pause-screen'),
    bustedScreen: $('busted-screen'),
    bustedText: $('busted-text'),
    speedWrap: $('speed-wrap'),
    carPanel: $('car-panel'),
  };
  const minimapCtx = els.minimap ? els.minimap.getContext('2d') : null;
  const last = {};
  let toastTimer = null;

  function setText(el, key, value) {
    if (!el) return;
    if (last[key] !== value) {
      last[key] = value;
      el.textContent = value;
    }
  }

  function setStars(count) {
    if (!els.wantedStars || last.stars === count) return;
    last.stars = count;
    const stars = els.wantedStars.querySelectorAll('.star');
    stars.forEach((s, i) => s.classList.toggle('lit', i < count));
  }

  // The circular minimap: roads, beach, ocean, buildings, the player, the
  // police, traffic and the mission beacon, all drawn from live positions.
  function drawMinimap(state) {
    if (!minimapCtx) return;
    const size = els.minimap.width;
    const R = size / 2;
    const scale = size / 560;
    const toMap = (x, z) => [R + x * scale, R + z * scale];
    const ctx = minimapCtx;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(R, R, R - 1, 0, Math.PI * 2);
    ctx.clip();
    // Ocean and beach.
    ctx.fillStyle = '#2a6f9e';
    ctx.fillRect(0, 0, size, size);
    const [, beachY] = toMap(0, 200);
    ctx.fillStyle = '#e8c98f';
    ctx.fillRect(0, beachY, size, size - beachY);
    // City ground.
    ctx.fillStyle = '#4a4a52';
    const [gx, gz] = toMap(-240, -240);
    ctx.fillRect(gx, gz, 480 * scale, 440 * scale);
    // Roads.
    ctx.strokeStyle = '#2e2e36';
    ctx.lineWidth = 5;
    for (const c of [-192, -144, -96, -48, 0, 48, 96, 144, 192]) {
      const [x1, y1] = toMap(c, -240);
      const [x2, y2] = toMap(c, 200);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      const [hx1, hy1] = toMap(-240, c);
      const [hx2, hy2] = toMap(240, c);
      ctx.beginPath();
      ctx.moveTo(hx1, hy1);
      ctx.lineTo(hx2, hy2);
      ctx.stroke();
    }
    // Buildings as small blocks.
    if (state.buildings) {
      ctx.fillStyle = '#6a6a78';
      for (const b of state.buildings) {
        const [bx, by] = toMap(b.x, b.z);
        ctx.fillRect(bx - 2, by - 2, 4, 4);
      }
    }
    // Mission beacon.
    if (state.marker) {
      const [mx, my] = toMap(state.marker.x, state.marker.z);
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath();
      ctx.moveTo(mx, my - 5);
      ctx.lineTo(mx + 5, my);
      ctx.lineTo(mx, my + 5);
      ctx.lineTo(mx - 5, my);
      ctx.closePath();
      ctx.fill();
    }
    // Traffic as white dots, police as red dots.
    if (state.traffic) {
      ctx.fillStyle = '#ffffff';
      for (const t of state.traffic) {
        const [tx, ty] = toMap(t.x, t.z);
        ctx.fillRect(tx - 1, ty - 1, 2, 2);
      }
    }
    if (state.police) {
      ctx.fillStyle = '#ff4040';
      for (const p of state.police) {
        const [px, py] = toMap(p.x, p.z);
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // The player: a yellow arrow pointing along the heading.
    const [px, py] = toMap(state.playerX, state.playerZ);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(state.heading);
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(0, 2);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    // The ring around the minimap.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(R, R, R - 1, 0, Math.PI * 2);
    ctx.stroke();
  }

  return {
    els,
    setText,
    setStars,
    drawMinimap,
    // A short message that fades after a few seconds.
    toast(text, ms) {
      if (!els.toast) return;
      els.toast.textContent = text;
      els.toast.classList.add('show');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => els.toast.classList.remove('show'), ms || 3200);
    },
    // Show a line of dialogue with the speaker's portrait.
    showDialogue(who, text, color) {
      if (!els.dialogue) return;
      setText(els.dialogueWho, 'dlgWho', who);
      setText(els.dialogueText, 'dlgText', text);
      if (els.dialoguePortrait) {
        els.dialoguePortrait.textContent = who.split(' ').map((w) => w[0]).join('').slice(0, 2);
        els.dialoguePortrait.style.background = color || '#c96a5a';
      }
      els.dialogue.classList.add('show');
    },
    hideDialogue() {
      if (els.dialogue) els.dialogue.classList.remove('show');
    },
    setPrompt(text) {
      setText(els.prompt, 'prompt', text || '');
      if (els.prompt) els.prompt.classList.toggle('show', !!text);
    },
    showStart() {
      if (els.startScreen) els.startScreen.classList.add('show');
      if (els.pauseScreen) els.pauseScreen.classList.remove('show');
      if (els.bustedScreen) els.bustedScreen.classList.remove('show');
    },
    hideStart() {
      if (els.startScreen) els.startScreen.classList.remove('show');
    },
    showPause() {
      if (els.pauseScreen) els.pauseScreen.classList.add('show');
    },
    hidePause() {
      if (els.pauseScreen) els.pauseScreen.classList.remove('show');
    },
    showBusted(text) {
      if (els.bustedText) els.bustedText.textContent = text;
      if (els.bustedScreen) els.bustedScreen.classList.add('show');
    },
    hideBusted() {
      if (els.bustedScreen) els.bustedScreen.classList.remove('show');
    },
  };
}

// The per-frame HUD update. `state` carries everything the game knows:
// mission, wanted, money, dispatch, weapons, speed, health, respect, radio.
// The minimap is redrawn from live positions every frame.
export function updateHud(hud, state) {
  const { els, setText, setStars, drawMinimap } = hud;
  if (state.mission) {
    els.missionPanel.classList.add('show');
    setText(els.missionTitle, 'mTitle', state.mission.title);
    setText(els.missionStage, 'mStage', `Stage ${state.mission.stage} / ${state.mission.stages}`);
    setText(els.missionText, 'mText', state.mission.text);
    if (state.mission.timeLeft > 0) {
      els.missionTimer.classList.add('show');
      setText(els.missionTimer, 'mTimer', `${Math.ceil(state.mission.timeLeft)}s`);
      els.missionTimer.classList.toggle('urgent', state.mission.timeLeft < 15);
    } else {
      els.missionTimer.classList.remove('show');
    }
    setText(els.missionNext, 'mNext', state.mission.next || '');
  } else {
    els.missionPanel.classList.remove('show');
  }
  setStars(state.wanted);
  setText(els.money, 'money', `$${Math.floor(state.money).toLocaleString('en-US')}`);
  if (els.dispatchList) {
    const key = state.dispatch.map((d) => `${d.callsign}:${d.tactic}:${d.dist}`).join('|');
    if (hud._dispatchKey !== key) {
      hud._dispatchKey = key;
      els.dispatchList.innerHTML = state.dispatch
        .map((d) => `<div class="dispatch-row"><span class="callsign">${d.callsign}</span><span class="tactic">${d.tactic}</span><span class="dist">${d.dist} m</span></div>`)
        .join('') || '<div class="dispatch-row quiet">No units responding.</div>';
    }
  }
  els.weaponSlots.forEach((slot, i) => {
    if (!slot) return;
    slot.classList.toggle('active', state.weaponIndex === i);
    const w = state.weapons[i];
    setText(slot.querySelector('.weapon-name'), `wname${i}`, w.name);
    setText(slot.querySelector('.weapon-ammo'), `wammo${i}`, w.ammo === Infinity ? '∞' : String(w.ammo));
  });
  if (state.inCar) {
    els.speedWrap.classList.add('show');
    els.carPanel.classList.add('show');
    setText(els.speed, 'speed', String(Math.round(Math.abs(state.speed) * 2.6)));
    setText(els.carName, 'carName', state.carName || '');
    const cond = Math.max(0, Math.round(state.carCondition));
    if (hud._cond !== cond) {
      hud._cond = cond;
      els.carConditionFill.style.width = `${cond}%`;
      els.carConditionFill.classList.toggle('low', cond < 30);
    }
    setText(els.carConditionText, 'condText', `${cond}%`);
  } else {
    els.speedWrap.classList.remove('show');
    els.carPanel.classList.remove('show');
  }
  const hp = Math.max(0, Math.round(state.health));
  if (hud._hp !== hp) {
    hud._hp = hp;
    els.healthFill.style.width = `${hp}%`;
    els.healthFill.classList.toggle('low', hp < 30);
  }
  const ar = Math.max(0, Math.round(state.armour));
  if (hud._ar !== ar) {
    hud._ar = ar;
    els.armourFill.style.width = `${ar}%`;
  }
  setText(els.respectRank, 'rank', state.respectRank);
  const xpPct = Math.round((state.respectXp / state.respectXpNext) * 100);
  if (hud._xp !== xpPct) {
    hud._xp = xpPct;
    els.respectXpFill.style.width = `${Math.min(100, xpPct)}%`;
  }
  setText(els.radioStation, 'radio', state.radioStation);
  setText(els.radioSong, 'song', state.radioSong);
  drawMinimap(state);
}

// Respect ranks: the ladder the player climbs with mission XP.
export const RESPECT_RANKS = [
  { name: 'Newcomer', xp: 0 },
  { name: 'Street Runner', xp: 150 },
  { name: 'Wheelman', xp: 400 },
  { name: 'Fixer', xp: 800 },
  { name: 'Perla Legend', xp: 1500 },
];

export function respectFor(xp) {
  let rank = RESPECT_RANKS[0];
  let next = RESPECT_RANKS[1] || { name: '', xp: Infinity };
  for (let i = 0; i < RESPECT_RANKS.length; i += 1) {
    if (xp >= RESPECT_RANKS[i].xp) {
      rank = RESPECT_RANKS[i];
      next = RESPECT_RANKS[i + 1] || { name: '', xp: Infinity };
    }
  }
  return { rank: rank.name, xpNext: next.xp === Infinity ? rank.xp + 500 : next.xp };
}
