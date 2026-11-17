// rng.js — deterministic seeded random numbers for Glimmerdeep.
// Every roll in the game comes from here, so a fixed seed replays the same
// dungeon, the same enemy moves and the same combat, byte for byte.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Small helper object wrapping one stream so callers read intent, not math.
export class Rng {
  constructor(seed) {
    this.next = mulberry32(seed);
  }
  // Float in [0, 1).
  float() {
    return this.next();
  }
  // Integer in [min, max] inclusive.
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  // Pick one element of a non-empty array.
  pick(array) {
    return array[Math.floor(this.next() * array.length)];
  }
  // True with probability p (0..1).
  chance(p) {
    return this.next() < p;
  }
  // Fisher-Yates shuffle, in place, deterministic for a given stream.
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}
