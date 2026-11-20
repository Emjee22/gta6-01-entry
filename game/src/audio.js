// WebAudio synth for Perla Bay — no audio files, everything is generated.
// Three radio stations (each a small step sequencer), engine hum and sirens.
export const STATIONS = [
  { id: 0, name: 'PERLA FM 88.4', song: 'Marina Lights — Los Faros', bpm: 96, wave: 'triangle', root: 220.00 },
  { id: 1, name: 'ONDAS 101.7', song: 'Calle Ocho Nights — The Palms', bpm: 118, wave: 'sawtooth', root: 196.00 },
  { id: 2, name: 'FARO ROCK 94.2', song: 'Breakwater — Salt & Static', bpm: 132, wave: 'square', root: 164.81 },
];

const SCALES = [
  [0, 3, 5, 7, 10],   // minor pentatonic
  [0, 2, 4, 7, 9],    // major pentatonic
  [0, 2, 3, 7, 8],    // dorian-ish
];

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;
  let station = 0;
  let playing = false;
  let stepTimer = null;
  let step = 0;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.5; sfxGain.connect(master);
      return true;
    } catch (e) { return false; }
  }

  function noteFreq(root, scale, degree) {
    const oct = Math.floor(degree / scale.length);
    const idx = ((degree % scale.length) + scale.length) % scale.length;
    return root * Math.pow(2, oct + scale[idx] / 12);
  }

  function playStep() {
    if (!playing || !ctx) return;
    const st = STATIONS[station];
    const scale = SCALES[station];
    const bar = Math.floor(step / 16) % 4;
    // Bass on beats, sparkle melody on off-beats, hats implied by short blips.
    if (step % 4 === 0) {
      blip(noteFreq(st.root / 2, scale, [0, 0, 3, 4][bar]), 0.22, st.wave, 0.5, musicGain);
    }
    if (step % 8 === 6) {
      blip(noteFreq(st.root, scale, [4, 6, 7, 9][bar]), 0.14, 'sine', 0.35, musicGain);
    }
    if (step % 2 === 1 && (step * 7 + bar) % 5 === 0) {
      blip(noteFreq(st.root * 2, scale, [7, 9, 11, 12][bar]), 0.09, 'sine', 0.18, musicGain);
    }
    step += 1;
  }

  function blip(freq, dur, wave, vol, dest) {
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave; o.frequency.value = freq;
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(); o.stop(ctx.currentTime + dur + 0.05);
  }

  return {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    startMusic() {
      if (!ensure()) return;
      if (playing) return;
      playing = true; step = 0;
      const st = STATIONS[station];
      stepTimer = setInterval(playStep, 60000 / st.bpm / 2);
    },
    stopMusic() { playing = false; if (stepTimer) { clearInterval(stepTimer); stepTimer = null; } },
    setStation(i) {
      station = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
      if (playing && stepTimer) {
        clearInterval(stepTimer);
        const st = STATIONS[station];
        stepTimer = setInterval(playStep, 60000 / st.bpm / 2);
      }
      return STATIONS[station];
    },
    get station() { return STATIONS[station]; },
    get playing() { return playing; },
    beep(freq = 880, dur = 0.12) { if (ensure()) blip(freq, dur, 'sine', 0.4, sfxGain); },
    thud() { if (ensure()) blip(70, 0.25, 'sine', 0.6, sfxGain); },
    coin() {
      if (!ensure()) return;
      blip(987.77, 0.1, 'sine', 0.35, sfxGain);
      setTimeout(() => blip(1318.5, 0.18, 'sine', 0.35, sfxGain), 90);
    },
    setEngine(on, speed01) {
      if (!ensure()) return;
      if (on && !engineOsc) {
        engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain(); engineGain.gain.value = 0.0;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
        engineOsc.connect(lp); lp.connect(engineGain); engineGain.connect(sfxGain);
        engineOsc.start();
      }
      if (!on && engineOsc) {
        try { engineOsc.stop(); } catch (e) {}
        engineOsc = null; engineGain = null;
        return;
      }
      if (engineOsc) {
        engineOsc.frequency.value = 55 + speed01 * 130;
        engineGain.gain.value = 0.05 + speed01 * 0.06;
      }
    },
    setSiren(on) {
      if (!ensure()) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator(); sirenOsc.type = 'sine';
        sirenGain = ctx.createGain(); sirenGain.gain.value = 0.0;
        sirenLfo = ctx.createOscillator(); sirenLfo.frequency.value = 0.55;
        const lfoGain = ctx.createGain(); lfoGain.gain.value = 260;
        sirenLfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
        sirenOsc.frequency.value = 720;
        sirenOsc.connect(sirenGain); sirenGain.connect(sfxGain);
        sirenOsc.start(); sirenLfo.start();
        sirenGain.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 0.4);
      }
      if (!on && sirenOsc) {
        try { sirenOsc.stop(); sirenLfo.stop(); } catch (e) {}
        sirenOsc = null; sirenLfo = null; sirenGain = null;
      }
    },
  };
}
// Station helpers shared by the HUD (station name / song line).
export function stationLabel(i) { return STATIONS[i].name + ' — ' + STATIONS[i].song; }
export function nextStation(i) { return (i + 1) % STATIONS.length; }
