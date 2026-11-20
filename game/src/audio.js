// Sound for Perla Bay, synthesized live with WebAudio.
//
// Nothing is loaded from a file: every sound is an oscillator or a burst of
// filtered noise built in code. The context is created lazily on the first
// user gesture (browsers block audio before one), and every call is a no-op
// when there is no context yet, so headless screenshots never touch audio.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOscA = null;
  let engineOscB = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch (err) {
      ctx = null;
      return false;
    }
    return true;
  }

  function noiseBuffer(seconds) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // A short click for menus and pickups.
  function click() {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.07);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  // A gunshot: a burst of noise through a lowpass, fast decay.
  function shot() {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.18);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, t);
    filter.frequency.exponentialRampToValueAtTime(300, t + 0.16);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
    src.stop(t + 0.2);
  }

  // A soft thud for bumps and landings.
  function thud(strength) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.12);
    gain.gain.setValueAtTime(0.25 * Math.min(1, strength), t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  // A two-note chime for mission progress and rewards.
  function chime() {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    [660, 990].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = t + i * 0.09;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  }

  return {
    ensure,
    click,
    shot,
    thud,
    chime,
    get muted() {
      return muted;
    },
    setMuted(value) {
      muted = !!value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    // The engine hum follows the car's speed (0..1). Call every frame.
    engine(speed01, on) {
      if (!ensure() || muted) return;
      if (!engineOscA) {
        engineOscA = ctx.createOscillator();
        engineOscB = ctx.createOscillator();
        engineFilter = ctx.createBiquadFilter();
        engineGain = ctx.createGain();
        engineOscA.type = 'sawtooth';
        engineOscB.type = 'square';
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = 900;
        engineGain.gain.value = 0;
        engineOscA.connect(engineFilter);
        engineOscB.connect(engineFilter);
        engineFilter.connect(engineGain);
        engineGain.connect(master);
        engineOscA.start();
        engineOscB.start();
      }
      const target = on ? 0.05 + 0.06 * speed01 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      const base = 55 + 130 * speed01;
      engineOscA.frequency.setTargetAtTime(base, ctx.currentTime, 0.08);
      engineOscB.frequency.setTargetAtTime(base * 1.5, ctx.currentTime, 0.08);
      engineFilter.frequency.setTargetAtTime(500 + 1600 * speed01, ctx.currentTime, 0.1);
    },
    // The police siren: two alternating tones while any unit is near.
    siren(on, dt) {
      if (!ensure() || muted) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenGain = ctx.createGain();
        sirenOsc.type = 'triangle';
        sirenOsc.frequency.value = 700;
        sirenGain.gain.value = 0.045;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        sirenTimer = 0;
        sirenHigh = false;
      }
      if (!on && sirenOsc) {
        try { sirenOsc.stop(); } catch (err) { /* already stopped */ }
        sirenOsc = null;
        sirenGain = null;
        return;
      }
      if (sirenOsc) {
        sirenTimer += dt;
        if (sirenTimer > 0.42) {
          sirenTimer = 0;
          sirenHigh = !sirenHigh;
          sirenOsc.frequency.setTargetAtTime(sirenHigh ? 950 : 700, ctx.currentTime, 0.05);
        }
      }
    },
    // One soft plucked note for the radio sequencer.
    note(freq, dur, vol) {
      if (!ensure() || muted) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    },
    // Called every frame; keeps the context alive after a gesture.
    update() {
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
  };
}

// Radio stations: name, frequency label, and a tiny melody loop played by
// the sequencer in update(). Each station has its own scale and tempo, so
// switching stations changes the mood without loading any audio file.
const STATIONS = [
  { name: 'PERLA FM 98.4', song: 'Golden Hour Drive — The Sunsets', scale: [0, 3, 5, 7, 10], tempo: 0.22 },
  { name: 'ONDA 101.2', song: 'Tide Line — Marina Blue', scale: [0, 2, 4, 7, 9], tempo: 0.18 },
  { name: 'SOL 104.7', song: 'Neon Palms — Coral Nights', scale: [0, 3, 5, 8, 10], tempo: 0.26 },
];

// The radio sequencer: a quiet bass + pluck melody. Called from update().
// Kept deliberately soft so it sits under the engine and the siren.
export function createRadio(audio) {
  let playing = false;
  let step = 0;
  let timer = 0;
  let stationIndex = 0;

  return {
    get station() {
      return STATIONS[stationIndex];
    },
    get stationIndex() {
      return stationIndex;
    },
    nextStation() {
      stationIndex = (stationIndex + 1) % STATIONS.length;
      step = 0;
      timer = 0;
      return STATIONS[stationIndex];
    },
    setStation(i) {
      stationIndex = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
      step = 0;
      timer = 0;
    },
    start() {
      playing = true;
    },
    stop() {
      playing = false;
    },
    get playing() {
      return playing;
    },
    // Advance the sequencer; plays one soft note per step.
    tick(dt) {
      if (!playing) return;
      timer += dt;
      const st = STATIONS[stationIndex];
      if (timer < st.tempo) return;
      timer = 0;
      const scale = st.scale;
      const degree = scale[step % scale.length] + 12 * (Math.floor(step / scale.length) % 2);
      const freq = 220 * Math.pow(2, degree / 12);
      audio.note(freq, st.tempo * 0.9, 0.05);
      step += 1;
    },
  };
}
