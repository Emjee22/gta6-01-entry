// Seeded random numbers for Perla Bay.
//
// Mulberry32: a tiny, fast generator whose sequence is fixed by its seed.
// The same seed always gives the same numbers, which is what makes the
// screenshot scenes repeatable: a staged shot plays the same way every time.
export function createRandom(seed) {
  let a = seed >>> 0;

  function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // A float in [min, max).
  function range(min, max) {
    return min + next() * (max - min);
  }

  // An integer in [min, max], both ends included.
  function int(min, max) {
    return Math.floor(range(min, max + 1));
  }

  // One element of a list, chosen uniformly.
  function pick(list) {
    return list[Math.floor(next() * list.length)];
  }

  // True with probability p (0..1).
  function chance(p) {
    return next() < p;
  }

  return { next, range, int, pick, chance };
}

// Shuffle a copy of a list in place order (Fisher-Yates, seeded).
export function shuffleList(rng, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

// Turn any short string into a 32-bit seed, so a named scene can be
// reproduced from its name alone.
export function seedFromString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
