// Synthesised WebAudio — no asset files, so the references gate stays clean.
export class AudioSys {
  constructor() { this.ctx = null; this.master = null; this.muted = false; }
  ensure() {
    if (this.ctx || typeof window === 'undefined') return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch { this.ctx = null; }
  }
  _tone(freq, dur, type = 'sine', vol = 0.5, slideTo = null, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  _noise(dur, vol = 0.5, freq = 1200, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
  }
  shot(kind) {
    if (kind === 'longshot') { this._noise(0.22, 0.9, 900); this._tone(140, 0.18, 'sine', 0.7, 45); }
    else if (kind === 'breacher') { this._noise(0.16, 0.9, 700); this._tone(110, 0.14, 'sine', 0.8, 40); }
    else if (kind === 'hornet') { this._noise(0.08, 0.5, 1600); this._tone(190, 0.07, 'square', 0.25, 90); }
    else { this._noise(0.1, 0.7, 1400); this._tone(170, 0.09, 'square', 0.3, 80); }
  }
  dry() { this._tone(1200, 0.03, 'square', 0.15); }
  reload() { this._tone(700, 0.05, 'square', 0.2); this._tone(500, 0.05, 'square', 0.2, null, 0.18); this._tone(900, 0.05, 'square', 0.25, null, 0.45); }
  hit(head = false) { this._tone(head ? 1500 : 1100, 0.06, 'sine', 0.4); }
  hurt() { this._tone(220, 0.15, 'sawtooth', 0.35, 110); }
  step() { this._noise(0.05, 0.12, 500); }
  beep(final = false) { this._tone(final ? 1400 : 950, final ? 0.3 : 0.09, 'sine', 0.4); }
  plant() { this.beep(); this.beep(); }
  explosion() {
    this._noise(0.9, 1.0, 300);
    this._tone(70, 0.8, 'sine', 0.9, 28);
    this._tone(50, 1.1, 'sine', 0.6, 24, 0.1);
  }
  win() { [523, 659, 784].forEach((f, i) => this._tone(f, 0.22, 'sine', 0.35, null, i * 0.13)); }
  lose() { [392, 330, 262].forEach((f, i) => this._tone(f, 0.25, 'sine', 0.3, null, i * 0.14)); }
  buy() { this._tone(880, 0.08, 'sine', 0.3); this._tone(1320, 0.1, 'sine', 0.25, null, 0.07); }
  denied() { this._tone(180, 0.12, 'square', 0.25); }
}
