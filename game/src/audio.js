// audio.js — WebAudio synth radio for Perla Bay.
// Three stations, each a looped note pattern played by oscillators, plus an
// engine hum tied to speed and a two-tone siren while wanted. Nothing is
// loaded from anywhere; every sound is synthesised. The context is created
// on the first user gesture (the Start click), so autoplay rules never bite.

export const STATIONS = [
  { name: 'PERLA FM 88.4', song: 'Marina Lights — Los Faros', wave: 'sine', bpm: 92, root: 220 },
  { name: 'BOCA FM 101.2', song: 'Sunset Drive — The Palms', wave: 'triangle', bpm: 122, root: 262 },
  { name: 'ONDA FM 94.7', song: 'Night Tide — Deep Canal', wave: 'sawtooth', bpm: 76, root: 165 },
];

const SCALES = [
  [0, 3, 5, 7, 10, 12, 15],
  [0, 2, 4, 7, 9, 12, 14],
  [0, 3, 5, 6, 10, 12, 15],
];

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let station = 0;
  let muted = false;
  let step = 0;
  let nextNoteTime = 0;
  let timer = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function noteFreq(semitones, root) {
    return root * Math.pow(2, semitones / 12);
  }

  function scheduleStep() {
    if (!ctx) return;
    const st = STATIONS[station];
    const scale = SCALES[station];
    const beat = 60 / st.bpm / 2;
    while (nextNoteTime < ctx.currentTime + 0.25) {
      const degree = scale[step % scale.length] + (step % 16 >= 8 ? 12 : 0);
      const f = noteFreq(degree, st.root);
      const o = ctx.createOscillator();
      o.type = st.wave;
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, nextNoteTime);
      g.gain.exponentialRampToValueAtTime(0.001, nextNoteTime + beat * 0.9);
      o.connect(g);
      g.connect(musicGain);
      o.start(nextNoteTime);
      o.stop(nextNoteTime + beat);
      // A soft bass note every fourth step.
      if (step % 4 === 0) {
        const b = ctx.createOscillator();
        b.type = 'sine';
        b.frequency.value = st.root / 2;
        const bg = ctx.createGain();
        bg.gain.setValueAtTime(0.4, nextNoteTime);
        bg.gain.exponentialRampToValueAtTime(0.001, nextNoteTime + beat * 1.8);
        b.connect(bg);
        bg.connect(musicGain);
        b.start(nextNoteTime);
        b.stop(nextNoteTime + beat * 2);
      }
      nextNoteTime += beat;
      step += 1;
    }
  }

  return {
    init() {
      if (!ensure()) return false;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (!timer) {
        nextNoteTime = ctx.currentTime + 0.1;
        timer = setInterval(scheduleStep, 90);
      }
      return true;
    },
    get station() { return station; },
    setStation(i) {
      station = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
      step = 0;
    },
    nextStation() {
      this.setStation(station + 1);
    },
    stationText() {
      const st = STATIONS[station];
      return `${st.name}\n${st.song}`;
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    get muted() { return muted; },
    // Called every frame: engine pitch follows speed, siren wails with heat.
    update(speedKmh, wanted) {
      if (!ctx) return;
      const t = ctx.currentTime;
      if (engineOsc) {
        engineOsc.frequency.setTargetAtTime(55 + speedKmh * 1.1, t, 0.08);
        engineGain.gain.setTargetAtTime(speedKmh > 1 ? 0.05 : 0.02, t, 0.1);
      }
      if (sirenOsc) {
        if (wanted > 0) {
          const f = Math.floor(t * 1.6) % 2 === 0 ? 720 : 960;
          sirenOsc.frequency.setTargetAtTime(f, t, 0.05);
          sirenGain.gain.setTargetAtTime(0.02 + wanted * 0.008, t, 0.1);
        } else {
          sirenGain.gain.setTargetAtTime(0, t, 0.1);
        }
      }
    },
    // A short UI blip (mission complete, button press).
    blip(freq = 880) {
      if (!ctx) return;
      try {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.25, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        o.connect(g);
        g.connect(master);
        o.start();
        o.stop(ctx.currentTime + 0.2);
      } catch {
        /* audio unavailable */
      }
    },
  };
}
