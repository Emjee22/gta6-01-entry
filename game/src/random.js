// random.js — seeded RNG for PERLA BAY (deterministic replays & screenshots).
// mulberry32: small, fast, good enough for world gen and traffic jitter.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stable 32-bit hash of a string, so a named seed always maps to one world.
export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function randRange(rng, a, b) {
  return a + rng() * (b - a);
}

export function randInt(rng, a, b) {
  return Math.floor(randRange(rng, a, b + 1));
}

export function randPick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Fisher-Yates shuffle that returns a new array, driven by the seeded rng.
export function shuffled(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}

// Approximate normal-ish value in [-1, 1] from three uniform draws.
export function randBell(rng) {
  return (rng() + rng() + rng() - 1.5) / 1.5;
}

// Pick a pastel-ish hex color from a palette using the seeded rng.
export function randPastel(rng, palette) {
  return randPick(rng, palette);
}

// Clamp helper shared by world gen and gameplay code.
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Wrap an angle to [-PI, PI].
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Shortest signed turn from angle a toward angle b.
export function angleDiff(a, b) {
  return wrapAngle(b - a);
}
