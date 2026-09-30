// Procedural audio: synthesised SFX, a small generative music sequencer and a speech-synth announcer.
import { Rng } from '../util.js';

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], phrygian: [0, 1, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], pent: [0, 3, 5, 7, 10], hirajoshi: [0, 2, 3, 7, 8], harm: [0, 2, 3, 5, 7, 8, 11],
};

// music styles per stage id
export const TRACKS = {
  menu: { bpm: 96, root: 45, scale: 'minor', drums: 'half', bass: 'pulse', lead: 'sparse', pad: true, prog: [0, 5, 3, 4] },
  rooftop: { bpm: 132, root: 43, scale: 'minor', drums: 'four', bass: 'drive', lead: 'arp', pad: true, prog: [0, 5, 3, 6] },
  dojo: { bpm: 104, root: 45, scale: 'hirajoshi', drums: 'taiko', bass: 'pulse', lead: 'sparse', pad: true, prog: [0, 3, 4, 0] },
  temple: { bpm: 112, root: 40, scale: 'phrygian', drums: 'taiko', bass: 'drone', lead: 'sparse', pad: true, prog: [0, 1, 0, 6] },
  alley: { bpm: 140, root: 42, scale: 'dorian', drums: 'four', bass: 'drive', lead: 'arp', pad: false, prog: [0, 3, 4, 3] },
  volcano: { bpm: 126, root: 38, scale: 'phrygian', drums: 'break', bass: 'drive', lead: 'riff', pad: true, prog: [0, 1, 0, 5] },
  ring: { bpm: 128, root: 41, scale: 'pent', drums: 'break', bass: 'drive', lead: 'riff', pad: false, prog: [0, 3, 4, 0] },
  ice: { bpm: 118, root: 47, scale: 'major', drums: 'half', bass: 'pulse', lead: 'arp', pad: true, prog: [0, 4, 5, 3] },
  throne: { bpm: 150, root: 38, scale: 'harm', drums: 'break', bass: 'drive', lead: 'riff', pad: true, prog: [0, 5, 6, 4] },
  grid: { bpm: 120, root: 43, scale: 'minor', drums: 'four', bass: 'pulse', lead: 'sparse', pad: false, prog: [0, 0, 3, 4] },
  results: { bpm: 90, root: 45, scale: 'major', drums: 'half', bass: 'pulse', lead: 'sparse', pad: true, prog: [0, 3, 4, 0] },
};

class Audio {
  constructor() {
    this.ctx = null; this.enabled = true;
    this.vol = { master: 0.8, music: 0.5, sfx: 0.8, voice: 0.8 };
    this.track = null; this.trackId = ''; this.step = 0; this.nextTime = 0; this.timer = null;
    this.announcer = true;
    this.lastSpeak = 0;
    this.rng = new Rng(77);
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    // brick-wall limiter so the loud KO / Rage Art layers never clip at the output
    this.lim = c.createDynamicsCompressor(); this.lim.threshold.value = -2; this.lim.knee.value = 0; this.lim.ratio.value = 20; this.lim.attack.value = 0.001; this.lim.release.value = 0.12;
    this.master.connect(this.lim); this.lim.connect(c.destination);
    this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 4;
    this.comp.connect(this.master);
    this.sfxG = c.createGain(); this.sfxG.connect(this.comp);
    this.musG = c.createGain(); this.musG.connect(this.comp);
    // reverb-ish delay for lead
    this.delay = c.createDelay(1); this.delay.delayTime.value = 0.28;
    const fb = c.createGain(); fb.gain.value = 0.32; this.delay.connect(fb); fb.connect(this.delay);
    const dg = c.createGain(); dg.gain.value = 0.35; this.delay.connect(dg); dg.connect(this.musG);
    // noise buffer
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
  }

  unlock() {
    this.init();
    if (this.ctx && this.ctx.state !== 'running') this.ctx.resume();
  }

  setVolumes(v) { Object.assign(this.vol, v); this.applyVolumes(); }
  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.vol.master;
    this.sfxG.gain.value = this.vol.sfx;
    this.musG.gain.value = this.vol.music * 0.55;
  }

  // ---------------------------------------------------------------- primitives
  osc(type, freq, t0, dur, gain, dest, opts = {}) {
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t0 + dur);
    if (opts.detune) o.detune.value = opts.detune;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + (opts.attack ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || this.sfxG);
    o.start(t0); o.stop(t0 + dur + 0.05);
    return { o, g };
  }

  noiseBurst(t0, dur, gain, freq, q = 1, type = 'bandpass', dest, sweepTo) {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfxG);
    s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
  }

  // ---------------------------------------------------------------- SFX
  sfx(name, o = {}) {
    if (!this.ctx || !this.enabled || this.ctx.state !== 'running') return;
    const c = this.ctx, t = c.currentTime + (o.delay || 0);
    const v = o.vol ?? 1;
    const r = () => 0.92 + Math.random() * 0.16;
    switch (name) {
      case 'hit_light': this.noiseBurst(t, 0.07, 0.5 * v, 1800 * r(), 0.8); this.osc('sine', 190 * r(), t, 0.09, 0.6 * v, null, { to: 70 }); break;
      case 'hit_med': this.noiseBurst(t, 0.1, 0.7 * v, 1200 * r(), 0.7); this.osc('sine', 150 * r(), t, 0.16, 0.9 * v, null, { to: 50 }); this.osc('triangle', 320, t, 0.06, 0.25 * v, null, { to: 120 }); break;
      case 'hit_heavy': this.noiseBurst(t, 0.2, 0.9 * v, 900 * r(), 0.6, 'lowpass', null, 200); this.osc('sine', 110 * r(), t, 0.3, 1.1 * v, null, { to: 36 }); this.osc('sawtooth', 220, t, 0.1, 0.25 * v, null, { to: 60 }); break;
      case 'counter': this.sfx('hit_heavy', { vol: v }); this.osc('square', 1560, t, 0.14, 0.18 * v, null, { to: 780 }); this.osc('square', 2340, t + 0.02, 0.12, 0.1 * v, null, { to: 1200 }); break;
      case 'block': this.noiseBurst(t, 0.05, 0.4 * v, 3200, 1.5); this.osc('square', 880 * r(), t, 0.06, 0.16 * v, null, { to: 500 }); this.osc('sine', 130, t, 0.09, 0.4 * v, null, { to: 70 }); break;
      case 'whiff': this.noiseBurst(t, 0.16 * (o.len || 1), 0.22 * v, 500, 0.9, 'bandpass', null, 2600); break;
      case 'whiff_heavy': this.noiseBurst(t, 0.28, 0.32 * v, 300, 0.8, 'bandpass', null, 2000); break;
      case 'throw_grab': this.noiseBurst(t, 0.1, 0.4 * v, 700, 2); this.osc('triangle', 240, t, 0.1, 0.5 * v, null, { to: 100 }); break;
      case 'slam': this.noiseBurst(t, 0.3, 1 * v, 500, 0.5, 'lowpass', null, 120); this.osc('sine', 80, t, 0.5, 1.4 * v, null, { to: 30 }); break;
      case 'wall': this.noiseBurst(t, 0.25, 1 * v, 2500, 0.5, 'highpass'); this.osc('sine', 90, t, 0.4, 1.2 * v, null, { to: 30 }); this.osc('sawtooth', 140, t, 0.2, 0.3 * v, null, { to: 40 }); break;
      case 'wallbreak': this.noiseBurst(t, 0.9, 1.2 * v, 1500, 0.4, 'highpass'); this.osc('sine', 60, t, 0.9, 1.6 * v, null, { to: 25 }); break;
      case 'ko': this.sfx('hit_heavy', { vol: 1.3 }); this.osc('sine', 70, t, 1.2, 1.6, null, { to: 22 }); this.noiseBurst(t + 0.05, 0.8, 0.6, 3000, 0.3, 'lowpass', null, 200); this.osc('sawtooth', 330, t + 0.05, 0.9, 0.2, null, { to: 40 }); break;
      case 'heat_on': this.osc('sawtooth', 120, t, 0.6, 0.4 * v, null, { to: 900 }); this.noiseBurst(t, 0.6, 0.5 * v, 400, 0.6, 'bandpass', null, 5000); this.osc('sine', 60, t, 0.5, 1 * v, null, { to: 40 }); break;
      case 'heat_end': this.osc('sawtooth', 500, t, 0.4, 0.2 * v, null, { to: 80 }); break;
      case 'rage_on': for (let i = 0; i < 3; i++) this.osc('sine', 70, t + i * 0.22, 0.2, 1.1 * v, null, { to: 38 }); this.osc('sawtooth', 90, t, 0.7, 0.35 * v, null, { to: 45 }); this.noiseBurst(t, 0.7, 0.3, 200, 0.7); break;
      case 'rage_art': this.sfx('rage_on'); this.osc('square', 220, t, 0.5, 0.3, null, { to: 1760 }); this.noiseBurst(t, 0.5, 0.7, 5000, 0.4, 'highpass'); break;
      case 'smash': this.osc('sawtooth', 200, t, 0.35, 0.4, null, { to: 1200 }); this.noiseBurst(t, 0.4, 0.6, 3000, 0.5, 'highpass'); break;
      case 'parry': this.osc('sine', 1400, t, 0.3, 0.4 * v, null, { to: 1600 }); this.osc('sine', 2100, t, 0.25, 0.25 * v); this.noiseBurst(t, 0.05, 0.4, 5000, 2); break;
      case 'pcrush': this.osc('square', 200, t, 0.18, 0.4, null, { to: 90 }); this.noiseBurst(t, 0.12, 0.6, 700, 1.2); break;
      case 'break': this.osc('triangle', 660, t, 0.2, 0.5 * v, null, { to: 990 }); this.noiseBurst(t, 0.08, 0.5, 4000, 1.5); break;
      case 'elec': this.noiseBurst(t, 0.12, 0.35 * v, 6000, 1, 'highpass'); this.osc('sawtooth', 400 * r(), t, 0.12, 0.15, null, { to: 1800 }); break;
      case 'beam': this.osc('sawtooth', 300, t, 0.9, 0.3, null, { to: 100 }); this.noiseBurst(t, 0.9, 0.4, 800, 0.4, 'bandpass', null, 3000); break;
      case 'step': this.noiseBurst(t, 0.05, 0.12 * v, 400, 0.8, 'lowpass'); break;
      case 'land': this.noiseBurst(t, 0.12, 0.35 * v, 300, 0.6, 'lowpass'); this.osc('sine', 100, t, 0.14, 0.4 * v, null, { to: 50 }); break;
      case 'dash': this.noiseBurst(t, 0.14, 0.14 * v, 700, 0.7, 'bandpass', null, 1800); break;
      case 'roll': this.noiseBurst(t, 0.2, 0.14 * v, 500, 0.5, 'lowpass'); break;
      case 'ui_move': this.osc('square', 660, t, 0.04, 0.12, null, { to: 700 }); break;
      case 'ui_ok': this.osc('square', 520, t, 0.07, 0.18); this.osc('square', 780, t + 0.06, 0.1, 0.18); break;
      case 'ui_back': this.osc('square', 420, t, 0.08, 0.16, null, { to: 300 }); break;
      case 'ui_select': this.osc('sawtooth', 300, t, 0.3, 0.25, null, { to: 900 }); this.osc('square', 900, t + 0.05, 0.25, 0.14); this.noiseBurst(t, 0.2, 0.3, 3000, 0.6, 'highpass'); break;
      case 'round': this.osc('sine', 196, t, 1.6, 0.6, null); this.osc('sine', 293, t, 1.4, 0.35); this.osc('sine', 392, t, 1.2, 0.2); this.noiseBurst(t, 0.06, 0.4, 3000, 1); break;
      case 'fight': this.sfx('smash'); this.osc('sine', 90, t, 0.4, 1.1, null, { to: 40 }); break;
      case 'timeup': this.osc('square', 300, t, 0.5, 0.3); this.osc('square', 250, t + 0.25, 0.6, 0.3); break;
      case 'count': this.osc('sine', 880, t, 0.08, 0.2); break;
      case 'win': for (let i = 0; i < 4; i++) this.osc('triangle', NOTE(60 + [0, 4, 7, 12][i]), t + i * 0.1, 0.5, 0.3); break;
      case 'lose': for (let i = 0; i < 3; i++) this.osc('triangle', NOTE(60 - i * 2), t + i * 0.18, 0.5, 0.3); break;
      case 'coin': this.osc('square', 988, t, 0.05, 0.15); this.osc('square', 1319, t + 0.05, 0.25, 0.15); break;
      default:
    }
  }

  // ---------------------------------------------------------------- announcer
  say(text, o = {}) {
    if (!this.announcer || !this.vol.voice || typeof speechSynthesis === 'undefined') return;
    try {
      const now = performance.now();
      if (!o.force && now - this.lastSpeak < 250) return;
      this.lastSpeak = now;
      if (o.cancel !== false) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = o.lang || 'en-US';
      u.volume = Math.min(1, this.vol.voice * this.vol.master);
      u.rate = o.rate ?? 0.95; u.pitch = o.pitch ?? 0.8;
      const voices = speechSynthesis.getVoices();
      const v = voices.find((x) => x.lang === u.lang && /male|david|daniel|google us english|alex|mark/i.test(x.name)) || voices.find((x) => x.lang === u.lang);
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) { /* speech not available */ }
  }

  // ---------------------------------------------------------------- music
  playTrack(id) {
    if (!this.ctx) return;
    if (this.trackId === id && this.timer) return;
    this.stopTrack();
    const tr = TRACKS[id] || TRACKS.menu;
    this.track = tr; this.trackId = id; this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.rng = new Rng(hashStr(id));
    this.buildPatterns(tr);
    this.timer = setInterval(() => this.schedule(), 60);
  }

  stopTrack() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null; this.trackId = ''; this.track = null;
  }

  buildPatterns(tr) {
    const rng = this.rng, sc = SCALES[tr.scale] || SCALES.minor;
    const deg = (d, oct = 0) => tr.root + sc[((d % sc.length) + sc.length) % sc.length] + 12 * (Math.floor(d / sc.length) + oct);
    this.deg = deg;
    // bass: per bar (16 steps) pattern of scale degrees offset by the chord root
    const bass = [];
    for (let bar = 0; bar < 4; bar++) {
      const root = tr.prog[bar];
      const pat = [];
      for (let s = 0; s < 16; s++) {
        let n = null;
        if (tr.bass === 'drive') { if (s % 2 === 0 || (s % 4 === 3 && rng.chance(0.4))) n = deg(root, -1) + (s % 8 === 6 && rng.chance(0.5) ? 12 : 0); }
        else if (tr.bass === 'pulse') { if (s % 4 === 0) n = deg(root, -1); else if (s % 8 === 6) n = deg(root + 4, -1); }
        else if (tr.bass === 'drone') { if (s === 0) n = deg(root, -2); }
        pat.push(n);
      }
      bass.push(pat);
    }
    // lead: 4 bars, 16 steps
    const lead = [];
    let last = 4;
    for (let bar = 0; bar < 4; bar++) {
      const root = tr.prog[bar];
      const pat = [];
      for (let s = 0; s < 16; s++) {
        let n = null;
        if (tr.lead === 'arp') { if (s % 2 === 0) n = deg(root + [0, 2, 4, 2, 7, 4, 2, 4][(s / 2) % 8], 1); }
        else if (tr.lead === 'riff') { if ([0, 3, 6, 8, 11, 14].includes(s) && rng.chance(0.8)) { last = clamp(last + rng.pick([-2, -1, 0, 1, 2, 3]), 0, 9); n = deg(root + last, 0) + 12; } }
        else if (tr.lead === 'sparse') { if ((s === 0 || s === 6 || s === 10) && rng.chance(0.75)) { last = clamp(last + rng.pick([-2, -1, 1, 2, 3]), 0, 9); n = deg(root + last, 1); } }
        pat.push(n);
      }
      lead.push(pat);
    }
    this.pat = { bass, lead };
  }

  schedule() {
    const c = this.ctx, tr = this.track;
    if (!c || !tr || c.state !== 'running') return;
    const spb = 60 / tr.bpm / 4;
    while (this.nextTime < c.currentTime + 0.25) {
      this.playStep(this.step, this.nextTime, spb);
      this.nextTime += spb; this.step++;
    }
  }

  playStep(step, t, spb) {
    const tr = this.track, s = step % 16, bar = Math.floor(step / 16) % 4;
    const dest = this.musG;
    const D = tr.drums;
    // drums
    const kick = () => { this.osc('sine', 130, t, 0.18, 0.9, dest, { to: 40 }); };
    const snare = () => { this.noiseBurst(t, 0.14, 0.4, 1800, 0.8, 'bandpass', dest); this.osc('triangle', 190, t, 0.08, 0.3, dest, { to: 120 }); };
    const hat = (g = 0.13) => { this.noiseBurst(t, 0.04, g, 8000, 1, 'highpass', dest); };
    if (D === 'four') { if (s % 4 === 0) kick(); if (s % 8 === 4) snare(); if (s % 2 === 1) hat(); }
    else if (D === 'half') { if (s === 0 || s === 10) kick(); if (s === 8) snare(); if (s % 4 === 2) hat(0.08); }
    else if (D === 'break') { if (s === 0 || s === 6 || s === 10 || (s === 14 && bar === 3)) kick(); if (s === 4 || s === 12) snare(); if (s % 2 === 0) hat(0.1); }
    else if (D === 'taiko') { if (s === 0) { this.osc('sine', 90, t, 0.4, 1, dest, { to: 45 }); } if (s === 8 || (s === 11 && bar % 2)) { this.osc('sine', 110, t, 0.3, 0.8, dest, { to: 55 }); } if (s % 4 === 2) hat(0.05); }
    // bass
    const bn = this.pat.bass[bar][s];
    if (bn) { const o = this.osc('sawtooth', NOTE(bn), t, spb * (tr.bass === 'drone' ? 14 : 1.7), 0.32, null, {}); void o; this.bassFilter(t, bn, spb * (tr.bass === 'drone' ? 14 : 1.7)); }
    // lead
    const ln = this.pat.lead[bar][s];
    if (ln) {
      const o = this.osc('square', NOTE(ln), t, spb * 1.9, 0.11, dest, { detune: 6 });
      void o;
      const g = this.ctx.createGain(); g.gain.value = 0.5;
      this.osc('triangle', NOTE(ln), t, spb * 1.9, 0.12, this.delay);
    }
    // pad
    if (tr.pad && s === 0) {
      const root = tr.prog[bar];
      for (const d of [0, 2, 4]) {
        const f = NOTE(this.deg(root + d, 0));
        this.osc('sawtooth', f, t, spb * 15.5, 0.05, dest, { attack: 0.4, detune: -5 });
        this.osc('sawtooth', f, t, spb * 15.5, 0.05, dest, { attack: 0.4, detune: 5 });
      }
    }
  }

  bassFilter() { /* simple oscillator bass; kept for future filter work */ }
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export const audio = new Audio();
