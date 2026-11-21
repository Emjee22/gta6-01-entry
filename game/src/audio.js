// audio.js — all sound in PERLA BAY is synthesized with WebAudio.
// No audio files are shipped: engine hum, police siren, radio jingle and
// one-shot effects are built from oscillators and noise buffers at runtime.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let radioTimer = 0;
  let radioStep = 0;
  let muted = false;
  let started = false;

  // A short sunset-synth loop in A minor, played as quiet plucks.
  const RADIO_NOTES = [220, 261.63, 329.63, 392, 329.63, 261.63, 196, 246.94];
  const RADIO_TITLES = [
    'PERLA FM 88.4 — Sunset Drive',
    'PERLA FM 88.4 — Golden Hour',
    'PERLA FM 88.4 — Palms & Neon',
    'PERLA FM 88.4 — Tide & Chrome',
  ];
  let radioTitle = RADIO_TITLES[0];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch (e) {
      return false;
    }
  }

  function start() {
    if (started) return;
    if (!ensure()) return;
    started = true;
    if (ctx.state === 'suspended') ctx.resume();
    // Engine: sawtooth through a lowpass, pitch follows speed.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    // Siren: triangle that alternates between two tones.
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 780;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0.0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
  }

  function blip(freq, dur, type, vol, when) {
    if (!ctx || !started) return;
    const t0 = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function noiseBurst(dur, vol, freq) {
    if (!ctx || !started) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq || 900;
    const g = ctx.createGain();
    g.gain.value = vol || 0.25;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start();
  }

  const api = {
    start,
    isStarted() { return started; },
    setMuted(m) {
      muted = !!m;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() { return muted; },
    radioTitle() { return radioTitle; },

    // speed01: 0..1 of top speed. inCar false silences the engine.
    engine(speed01, inCar) {
      if (!ctx || !started) return;
      const target = inCar ? 0.05 + speed01 * 0.11 : 0.0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, ctx.currentTime, 0.1);
      engineFilter.frequency.setTargetAtTime(380 + speed01 * 1400, ctx.currentTime, 0.1);
    },

    siren(on, dt) {
      if (!ctx || !started) return;
      sirenGain.gain.setTargetAtTime(on ? 0.045 : 0.0, ctx.currentTime, 0.2);
      if (on) {
        sirenTimer += dt;
        if (sirenTimer > 0.42) {
          sirenTimer = 0;
          sirenHigh = !sirenHigh;
          sirenOsc.frequency.setTargetAtTime(sirenHigh ? 780 : 620, ctx.currentTime, 0.05);
        }
      }
    },

    // Quiet radio pluck loop; call every frame with dt.
    radio(dt) {
      if (!ctx || !started) return;
      radioTimer += dt;
      if (radioTimer >= 0.34) {
        radioTimer = 0;
        const n = RADIO_NOTES[radioStep % RADIO_NOTES.length];
        radioStep++;
        if (radioStep % 32 === 0) {
          radioTitle = RADIO_TITLES[(radioStep / 32) % RADIO_TITLES.length | 0];
        }
        blip(n, 0.3, 'triangle', 0.05);
        blip(n * 2, 0.18, 'sine', 0.02);
      }
    },

    sfx(name) {
      if (!ctx || !started) return;
      if (name === 'pickup') { blip(660, 0.12, 'sine', 0.25); blip(990, 0.16, 'sine', 0.2, 0.08); }
      else if (name === 'crash') { noiseBurst(0.25, 0.3, 700); blip(90, 0.2, 'sawtooth', 0.2); }
      else if (name === 'mission') { blip(523, 0.14, 'sine', 0.22); blip(659, 0.14, 'sine', 0.22, 0.12); blip(784, 0.26, 'sine', 0.25, 0.24); }
      else if (name === 'enter') { blip(300, 0.1, 'square', 0.12); blip(420, 0.12, 'square', 0.1, 0.07); }
      else if (name === 'ability') { blip(880, 0.1, 'sine', 0.2); blip(1174, 0.2, 'sine', 0.18, 0.09); }
      else if (name === 'wanted') { blip(440, 0.15, 'square', 0.14); blip(440, 0.15, 'square', 0.14, 0.2); }
      else if (name === 'click') { blip(1200, 0.05, 'sine', 0.12); }
    },
  };
  return api;
}

// Footstep tick for walking — soft filtered noise, rate follows run speed.
export function footstepTick(audio, running) {
  if (!audio || !audio.isStarted()) return;
  audio.sfx('click');
}
