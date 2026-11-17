// audio.js — tiny synthesised sound effects for Glimmerdeep.
// No audio files: every blip is an oscillator through the Web Audio API,
// started lazily on the first user gesture so browsers allow it.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  unlock() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  tone(freq, dur, type, gain, slideTo) {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp);
    amp.connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  step() {
    this.tone(180, 0.06, 'sine', 0.05);
  }
  hit() {
    this.tone(220, 0.09, 'square', 0.08, 110);
  }
  hurt() {
    this.tone(140, 0.18, 'sawtooth', 0.09, 70);
  }
  coin() {
    this.tone(880, 0.08, 'sine', 0.07);
    setTimeout(() => this.tone(1320, 0.1, 'sine', 0.06), 60);
  }
  heal() {
    this.tone(520, 0.12, 'sine', 0.07, 780);
  }
  stairs() {
    this.tone(330, 0.14, 'triangle', 0.08, 660);
  }
  levelup() {
    [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.14, 'triangle', 0.08), i * 90));
  }
  win() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.09), i * 130));
  }
  lose() {
    [392, 330, 262, 196].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 'sawtooth', 0.06), i * 160));
  }
}
