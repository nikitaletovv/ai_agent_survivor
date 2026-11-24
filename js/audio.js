/* ============================================================
   AI Agent Survivors — procedural audio (WebAudio synthesis)
   Music: generative synthwave loop. SFX: short synthesized cues.
   No external audio files are used; everything is generated.
   ============================================================ */
'use strict';

class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicOn = true;
    this.sfxOn = true;
    this.musicVol = 0.6;
    this.sfxVol = 0.8;
    this.started = false;
    this._beatTimer = null;
    this._nextNoteTime = 0;
    this._step = 0;
    this.bpm = 112;
    this._noiseBuf = null;
  }

  ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicOn ? this.musicVol : 0;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxOn ? this.sfxVol : 0;
    this.sfxGain.connect(this.master);
    // reusable noise buffer
    const len = this.ctx.sampleRate * 1;
    this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this._noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  resume() {
    this.ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMusic(on) { this.musicOn = on; if (this.musicGain) this.musicGain.gain.value = on ? this.musicVol : 0; }
  setSfx(on) { this.sfxOn = on; if (this.sfxGain) this.sfxGain.gain.value = on ? this.sfxVol : 0; }
  setMusicVol(v) { this.musicVol = v; if (this.musicGain && this.musicOn) this.musicGain.gain.value = v; }
  setSfxVol(v) { this.sfxVol = v; if (this.sfxGain && this.sfxOn) this.sfxGain.gain.value = v; }

  /* ---------------- SFX ---------------- */
  sfx(name, opt) {
    if (!this.ctx || !this.sfxOn) return;
    const t = this.ctx.currentTime;
    const o = opt || {};
    switch (name) {
      case 'shoot': this._blip(t, o.freq || 620, 0.07, 'square', 0.12, -400); break;
      case 'shoot2': this._blip(t, o.freq || 380, 0.09, 'sawtooth', 0.10, -200); break;
      case 'hit': this._noiseHit(t, 0.05, 2400, 0.10); break;
      case 'kill': this._blip(t, 200, 0.12, 'triangle', 0.14, -120); break;
      case 'boom': this._noiseHit(t, 0.35, 500, 0.30); this._blip(t, 90, 0.35, 'sine', 0.28, -60); break;
      case 'bigboom': this._noiseHit(t, 0.7, 380, 0.45); this._blip(t, 60, 0.6, 'sine', 0.4, -40); break;
      case 'pickup': this._blip(t, 780, 0.06, 'sine', 0.10, 350); break;
      case 'pickupRare': this._arp(t, [620, 780, 1040], 0.06, 'sine', 0.12); break;
      case 'hurt': this._blip(t, 160, 0.18, 'sawtooth', 0.20, -70); this._noiseHit(t, 0.1, 900, 0.15); break;
      case 'levelup': this._arp(t, [440, 554, 659, 880], 0.09, 'triangle', 0.16); break;
      case 'evolve': this._arp(t, [330, 494, 659, 988, 1319], 0.11, 'sawtooth', 0.14); break;
      case 'boss': this._arp(t, [110, 110, 82], 0.35, 'sawtooth', 0.30); this._noiseHit(t, 0.8, 300, 0.2); break;
      case 'zap': this._noiseHit(t, 0.12, 4000, 0.14); break;
      case 'click': this._blip(t, 520, 0.05, 'square', 0.08, 100); break;
      case 'warn': this._blip(t, 220, 0.25, 'square', 0.16, -30); break;
      case 'nova': this._blip(t, 140, 0.4, 'sine', 0.25, 180); this._noiseHit(t, 0.3, 700, 0.2); break;
    }
  }

  _blip(t, freq, dur, type, vol, slide) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  _arp(t, freqs, step, type, vol) {
    freqs.forEach((f, i) => this._blip(t + i * step, f, step * 1.8, type, vol, 0));
  }

  _noiseHit(t, dur, cutoff, vol) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, t);
    f.frequency.exponentialRampToValueAtTime(60, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t); src.stop(t + dur + 0.02);
  }

  /* ---------------- Music ---------------- */
  startMusic() {
    this.ensure();
    if (!this.ctx || this.started) return;
    this.started = true;
    this._nextNoteTime = this.ctx.currentTime + 0.1;
    this._step = 0;
    this._beatTimer = setInterval(() => this._schedule(), 40);
  }

  stopMusic() {
    this.started = false;
    if (this._beatTimer) { clearInterval(this._beatTimer); this._beatTimer = null; }
  }

  /** Small lookahead scheduler driving the synthwave loop. */
  _schedule() {
    if (!this.ctx || !this.started) return;
    const stepDur = 60 / this.bpm / 4; // 16th note
    while (this._nextNoteTime < this.ctx.currentTime + 0.25) {
      this._playStep(this._step, this._nextNoteTime);
      this._step = (this._step + 1) % 32;
      this._nextNoteTime += stepDur;
    }
  }

  _playStep(step, t) {
    const g = this.musicGain;
    // bass line (Am feel): A1/A2 pattern
    const bassPat = [0, -1, -1, 0, -1, -1, 0, -1, 7, -1, -1, 7, -1, -1, 5, -1,
                     0, -1, -1, 0, -1, -1, 0, -1, 3, -1, -1, 3, -1, -1, -1, -1];
    const n = bassPat[step];
    if (n >= 0) this._synthNote(t, 55 * Math.pow(2, n / 12), 0.22, 'sawtooth', 0.20, 320, g);
    // kick on quarters
    if (step % 8 === 0) this._kick(t, g);
    // hats on off-16ths
    if (step % 4 === 2) this._hat(t, 0.05, 0.05, g);
    // arp melody every 2 steps
    if (step % 2 === 0) {
      const scale = [0, 3, 7, 10, 12, 10, 7, 3];
      const root = 220;
      const idx = (step / 2 + Math.floor(this._step / 16)) % scale.length;
      this._synthNote(t, root * Math.pow(2, scale[idx] / 12), 0.16, 'square', 0.05, 2200, g, 0.35);
    }
  }

  _synthNote(t, freq, dur, type, vol, cutoff, dest, echo) {
    const o = this.ctx.createOscillator(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cutoff, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f); f.connect(g);
    let out = g;
    if (echo && this.ctx.createDelay) {
      const dl = this.ctx.createDelay(0.5), fb = this.ctx.createGain(), dg = this.ctx.createGain();
      dl.delayTime.value = 0.28; fb.gain.value = 0.3; dg.gain.value = echo;
      g.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(dg); dg.connect(dest);
      out = g;
    }
    out.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }

  _kick(t, dest) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.14);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + 0.25);
  }

  _hat(t, dur, vol, dest) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf; src.playbackRate.value = 1.6;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 6500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t); src.stop(t + dur + 0.02);
  }
}

const AudioSys_ = new AudioSys();
