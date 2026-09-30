// Application core: main loop, match lifecycle, menu showcase, audio / HUD / FX event routing.
import * as THREE from 'three';
import { GameView, FighterView } from '../render/scene.js';
import { Rig, mergeBody } from '../render/rig.js';
import { newPose, finalize } from '../render/pose.js';
import { buildPose } from '../render/anim.js';
import { Hud } from '../ui/hud.js';
import { UI, h, $, toast } from '../ui/kit.js';
import { tr, pick, setLang, getLang } from '../ui/i18n.js';
import { audio } from '../audio/audio.js';
import { input } from '../input/devices.js';
import { TouchControls } from '../input/touch.js';
import { Match } from '../sim/match.js';
import { compileChar } from '../sim/move.js';
import { ST } from '../sim/fighter.js';
import { CpuBrain } from '../sim/ai.js';
import { DummyBrain } from '../sim/dummy.js';
import { CHARS } from '../data/roster.js';
import { STAGES, stageById } from '../render/stagesList.js';
import { save, rankOf } from './save.js';
import { QUOTES } from './story.js';
import { LESSONS } from './tutorial.js';
import * as S from '../ui/screens.js';

const pack = (r) => (r.l ? 1 : 0) | (r.r ? 2 : 0) | (r.u ? 4 : 0) | (r.d ? 8 : 0) | (r.b1 ? 16 : 0) | (r.b2 ? 32 : 0) | (r.b3 ? 64 : 0) | (r.b4 ? 128 : 0);
const unpack = (v) => ({ l: !!(v & 1), r: !!(v & 2), u: !!(v & 4), d: !!(v & 8), b1: !!(v & 16), b2: !!(v & 32), b3: !!(v & 64), b4: !!(v & 128) });
const NEUTRAL = { l: false, r: false, u: false, d: false, b1: false, b2: false, b3: false, b4: false };

export class App {
  constructor() {
    this.canvas = document.getElementById('gl');
    const st = save.settings;
    if (st.lang) setLang(st.lang);
    this.gv = new GameView(this.canvas, { quality: st.quality });
    this.gv.flashEl = document.getElementById('flash');
    this.hud = new Hud(document.getElementById('hud'));
    this.ui = new UI(document.getElementById('ui'));
    this.touch = new TouchControls(document.getElementById('touch'), () => this.pause());
    input.touch = this.touch;
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.list = CHARS;
    this.compiled = Object.fromEntries(CHARS.map((c) => [c.id, compileChar(c)]));
    this.portraits = {};
    this.match = null;
    this.cfg = null;
    this.paused = false;
    this.acc = 0;
    this.last = performance.now();
    this.T = 0;
    this.showMatch = null;
    this.showState = null;
    this.speed = 1;
    this.recording = null;
    this.dummy = null;
    this.brains = [null, null];
    this.pending = [];
    this.fpsAcc = 0; this.fpsN = 0;
    this.orbit = 0;
    this.finished = false;
    this.applySettings();
    this.gv.hudProjector = null;
    this.hud.projector = (p) => this.project(p);
    addEventListener('resize', () => this.gv.resize());
    const unlock = () => { audio.unlock(); };
    addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.match && !this.paused && !this.cfg?.replay) this.pause(); });
    // losing keyboard focus (e.g. clicking outside the embedded frame) pauses the fight instead of leaving keys stuck
    addEventListener('blur', () => { if (!navigator.webdriver && this.match && !this.paused && !this.modal && !this.cfg?.replay && !this.cfg?.tutorial) this.pause(); });
    this.frame = this.frame.bind(this);
  }

  // ---------------------------------------------------------------- settings
  applySettings() {
    const s = save.settings;
    audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx, voice: s.voice });
    audio.announcer = s.announcer;
    this.gv.setQuality(s.quality);
    if (s.binds) input.binds = JSON.parse(JSON.stringify(s.binds));
    this.hud.el.fps.hidden = !s.fps;
    this.updateTouchVisibility();
  }

  updateTouchVisibility() {
    const t = save.settings.touch;
    const inMatch = !!this.match && !this.paused;
    const want = inMatch && (t === 'on' || (t === 'auto' && this.isTouch));
    this.touch.show(want);
  }

  project(pos) {
    const v = new THREE.Vector3(pos[0], pos[1], pos[2]).project(this.gv.camera);
    if (v.z > 1) return null;
    const w = this.canvas.clientWidth, h2 = this.canvas.clientHeight;
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h2 };
  }

  // ---------------------------------------------------------------- boot
  start() {
    this.buildPortraitsSoon();
    this.menuMusic();
    S.title(this);
    requestAnimationFrame(this.frame);
  }

  menuMusic() { audio.playTrack('menu'); }

  // ---------------------------------------------------------------- portraits (offscreen render of each fighter's head/bust)
  buildPortraitsSoon() {
    setTimeout(() => { try { this.buildPortraits(); } catch (e) { console.warn('portraits failed', e); } }, 400);
  }

  buildPortraits() {
    const size = 256;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: false });
    r.setSize(size, size, false);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(2, 3, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0x88aaff, 1.6); rim.position.set(-3, 2, -2); scene.add(rim);
    const cam = new THREE.PerspectiveCamera(24, 1, 0.1, 30);
    for (const ch of CHARS) this.portraits[ch.id] = this.renderPortrait(r, scene, cam, ch, null);
    r.dispose();
    r.forceContextLoss();
    this.portraitsReady = true;
    if (this.onPortraits) this.onPortraits();
  }

  renderPortrait(r, scene, cam, ch, cust) {
    const alt = ch.alts && cust?.alt != null && cust.alt > 0 ? ch.alts[cust.alt - 1] : null;
    const rig = new Rig(mergeBody(ch.body, alt, cust?.custom));
    const fake = { state: ST.IDLE, stT: 0, sc: 1, crouch: false, guard: null, walkDir: 0, sideWalk: 0, walkPhase: 0, idx: 0, move: null, stance: null };
    const cc = this.compiled[ch.id];
    const P = buildPose({ f: fake, ch: cc, R: cc.rest, T: 0, frac: 0 });
    void newPose; void finalize;
    rig.apply(P);
    rig.root.scale.setScalar(ch.body.scale || 1);
    rig.root.rotation.y = 0.5;
    scene.add(rig.root);
    scene.background = new THREE.Color(ch.body.glow || '#334');
    scene.background.multiplyScalar(0.35);
    rig.root.updateMatrixWorld(true);
    const head = rig.anchorWorld('head', new THREE.Vector3());
    cam.position.set(head.x + 0.35, head.y + 0.1, head.z + 1.75);
    cam.lookAt(head.x, head.y + 0.05, head.z);
    r.render(scene, cam);
    const url = r.domElement.toDataURL('image/jpeg', 0.88);
    scene.remove(rig.root);
    rig.dispose();
    return url;
  }

  portrait(id) { return this.portraits[id] || ''; }

  // ---------------------------------------------------------------- showcase (menu 3D backdrops)
  clearShowcase() {
    if (!this.showMatch) return;
    this.gv.unloadMatch();
    this.showMatch = null;
  }

  setShowcase(defs, opts = {}) {
    this.clearShowcase();
    this.showOpts = opts;
    if (this.gv.stageId !== (opts.stage || 'rooftop') || this.gv.stagePhase) this.gv.loadStage(opts.stage || 'rooftop');
    const a = this.compiled[defs[0].id], b = this.compiled[(defs[1] || defs[0]).id];
    const m = new Match({ chars: [a, b], stage: stageById(opts.stage || 'rooftop'), rules: { time: 0 }, seed: 1 });
    m.phase = 'fight';
    m.fighters.forEach((f, i) => { f.enterIdleClean(); f.x = defs[i] ? defs[i].x : 99; f.z = defs[i] ? (defs[i].z || 0) : 0; f.fx = i === 0 ? 1 : -1; f.fz = 0; f.px = f.x; f.pz = f.z; f.pfx = f.fx; f.pfz = 0; });
    this.showMatch = m;
    defs.forEach((d, i) => {
      if (!d) return;
      const cust = save.data.custom[d.id] || {};
      this.gv.addView(m.fighters[i], m.fighters[i].ch, { alt: d.alt ?? cust.alt, custom: d.custom ?? cust.custom });
      if (d.state) { m.fighters[i].state = d.state; m.fighters[i].stT = 0; }
    });
    this.showT = 0;
    if (opts.cam) this.gv.rig.setManual(opts.cam, opts.look || [0, 1.1, 0], opts.fov || 34, opts.snap !== false);
  }

  showcasePose(i, state) { const f = this.showMatch?.fighters[i]; if (f) { f.state = state; f.stT = 0; } }

  updateShowcase(dt) {
    const m = this.showMatch;
    if (!m) return;
    this.showT += dt;
    for (const f of m.fighters) { f.stT++; f.px = f.x; f.py = f.y; f.pz = f.z; }
    const o = this.showOpts;
    if (o.orbit) {
      const a = this.showT * o.orbit + (o.orbit0 || 0);
      const R = o.radius || 6.5;
      const cx = o.center?.[0] ?? 0;
      this.gv.rig.setManual([cx + Math.sin(a) * R, o.height ?? 1.6, Math.cos(a) * R], o.look || [cx, 1.1, 0], o.fov || 34);
    }
  }

  // ---------------------------------------------------------------- main loop
  frame(now) {
    requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.frozen) { input.endFrame(); return; }
    this.T += dt;
    // navigation
    const evs = input.navPoll();
    const inMatch = !!this.match && !this.paused && !this.modal;
    for (const ev of evs) {
      if (inMatch) { if (ev === 'start') this.pause(); continue; }
      const handled = this.ui.nav(ev);
      if (!handled && ev === 'back' && this.ui.top?.back) this.ui.top.back();
    }
    if (inMatch && input.latch.has('Escape')) this.pause();
    if (!inMatch && !input.rebinding && input.latch.has('KeyF')) this.toggleFullscreen();
    if (inMatch && this.cfg?.replay) this.replayKeys();
    this.ui.update(dt);
    let alpha = 0, ts = 1;
    if (this.match) {
      if (!this.paused && !this.modal && !this.frozen) {
        const r = this.updateMatch(dt);
        alpha = r.alpha; ts = r.ts;
      } else alpha = 0;
      this.hud.update(dt * 60, {});
    } else this.updateShowcase(dt);
    this.gv.frame(this.paused ? 0 : dt, alpha, ts);
    this.adaptQuality(dt);
    // fps
    if (save.settings.fps) {
      this.fpsAcc += dt; this.fpsN++;
      if (this.fpsAcc > 0.5) { this.hud.el.fps.textContent = Math.round(this.fpsN / this.fpsAcc) + ' fps'; this.fpsAcc = 0; this.fpsN = 0; }
    }
    input.endFrame();
  }

  // drop one graphics level when the device clearly cannot hold ~40 fps (never raises it again, never under automation)
  adaptQuality(dt) {
    const st = save.settings;
    if (!st.autoQuality || navigator.webdriver || !this.match || this.paused || this.modal || this.frozen || st.quality <= 0) { this.slowT = 0; this.perfT = 0; return; }
    this.perfT = (this.perfT || 0) + dt;
    if (dt > 0.03 && dt < 0.12) this.slowT = (this.slowT || 0) + dt;
    else if (dt < 0.022) this.slowT = Math.max(0, (this.slowT || 0) - dt * 2);
    if (this.perfT > 6 && this.slowT > 3) {
      st.quality--; save.write(); this.applySettings();
      toast(tr('Graphics lowered to keep the game smooth (Options > Video)', 'ลดคุณภาพกราฟิกเพื่อให้เล่นลื่นขึ้น (ตั้งค่า > ภาพ)'));
      this.slowT = 0; this.perfT = 0;
    }
  }

  toggleFullscreen() {
    try {
      if (document.fullscreenElement) { const p = document.exitFullscreen && document.exitFullscreen(); if (p && p.catch) p.catch(() => {}); }
      else { const p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen({ navigationUI: 'hide' }); if (p && p.catch) p.catch(() => {}); }
    } catch (e) { /* fullscreen not permitted here */ }
  }

  // ---------------------------------------------------------------- match
  inputsFor(m) {
    const out = [NEUTRAL, NEUTRAL];
    for (let i = 0; i < 2; i++) {
      if (this.cfg.replay) {
        const rp = this.cfg.replay;
        const v = rp.frames[this.replayPos * 2 + i];
        out[i] = v === undefined ? NEUTRAL : unpack(v);
      } else if (this.brains[i]) out[i] = this.brains[i].think(m);
      else out[i] = this.polled[i];
    }
    // practice: record mode = human controls the dummy
    if (this.practiceRec && this.practiceRec.active) {
      out[1] = this.polled[0];
      out[0] = NEUTRAL;
      this.practiceRec.tape.push({ ...out[1] });
      if (this.practiceRec.tape.length > 60 * 20) this.stopPracticeRecord();
    }
    return out;
  }

  updateMatch(dt) {
    const m = this.match;
    const cfg = this.cfg;
    this.polled = [input.poll(0), input.poll(1)];
    let ts = m.timeScale * this.speed;
    if (this.cfg.replay && this.replayPaused) ts = 0;
    this.acc += dt * ts;
    let steps = 0;
    while (this.acc >= 1 / 60 && steps < 4) {
      if (cfg.replay && this.replayPos * 2 >= cfg.replay.frames.length) { this.replayFinished(); break; }
      const raws = this.inputsFor(m);
      if (this.recording) this.recording.push(pack(raws[0]), pack(raws[1]));
      m.step(raws);
      if (cfg.replay) this.replayPos++;
      this.drainEvents();
      this.acc -= 1 / 60; steps++;
      if (this.match !== m) return { alpha: 0, ts: 1 };
    }
    if (this.acc > 0.2) this.acc = 0.2;
    return { alpha: Math.min(1, this.acc * 60), ts: m.timeScale };
  }

  // deterministic stepping for automated visual checks (tools/play.mjs): freeze real time, advance n sim frames
  debugStep(n, r0, r1, every = 4) {
    const m = this.match;
    if (!m) return;
    this.frozen = true;
    let dtAcc = 0;
    for (let i = 0; i < n; i++) {
      const raws = this.cfg.replay ? this.inputsFor(m) : [r0 ? { ...NEUTRAL, ...r0 } : (this.brains[0] ? this.brains[0].think(m) : NEUTRAL), r1 ? { ...NEUTRAL, ...r1 } : (this.brains[1] ? this.brains[1].think(m) : NEUTRAL)];
      m.step(raws);
      this.drainEvents();
      if (this.match !== m) return;
      dtAcc += (1 / 60) / Math.max(0.05, m.timeScale);
      if (i % every === every - 1 || i === n - 1) { this.hud.update(dtAcc * 60, {}); this.gv.frame(dtAcc, 1, m.timeScale); dtAcc = 0; }
    }
  }

  drainEvents() {
    const m = this.match;
    if (!m) return;
    const evs = m.events; m.events = [];
    for (const e of evs) {
      this.gv.handleEvent(e);
      this.hud.handleEvent(e);
      this.audioEvent(e);
      this.matchEvent(e);
      if (this.tut) this.tutEvent(e);
    }
  }

  audioEvent(e) {
    const m = this.match;
    switch (e.t) {
      case 'hit': {
        const nm = e.kind === 'heavy' ? 'hit_heavy' : e.kind === 'med' ? 'hit_med' : 'hit_light';
        audio.sfx(e.counter ? 'counter' : e.sfx === 'slam' ? 'slam' : nm);
        break;
      }
      case 'block': audio.sfx('block'); break;
      case 'move': {
        const f = m.fighters[e.who];
        const mv = f.ch.moveMap.get(e.id);
        if (mv && !mv.noHit && mv.lv !== 't') audio.sfx(mv.dmg >= 15 ? 'whiff_heavy' : 'whiff', { delay: Math.max(0, (mv.st - 4) / 60), vol: mv.dmg >= 15 ? 1 : 0.8 });
        if (mv && mv.an && mv.an.elec) audio.sfx('elec', { delay: (mv.st - 5) / 60 });
        if (mv && mv.style === 'burst' && mv.r > 0.3) audio.sfx('beam', { delay: (mv.st - 2) / 60 });
        break;
      }
      case 'grab': audio.sfx('throw_grab'); break;
      case 'break': audio.sfx('break'); break;
      case 'parry': audio.sfx('parry'); break;
      case 'wallsplat': audio.sfx('wall'); break;
      case 'wallbreak': audio.sfx('wallbreak'); break;
      case 'land': audio.sfx('land', { vol: e.big ? 1 : 0.5 }); break;
      case 'bound': audio.sfx('slam'); break;
      case 'dash': audio.sfx('dash'); break;
      case 'ss': audio.sfx('dash', { vol: 0.6 }); break;
      case 'roll': audio.sfx('roll'); break;
      case 'heat': audio.sfx('heat_on'); audio.say('Heat', { rate: 1 }); break;
      case 'heatend': audio.sfx('heat_end'); break;
      case 'heatsmash': audio.sfx('smash'); break;
      case 'rage': audio.sfx('rage_on'); break;
      case 'rageart': audio.sfx('rage_art'); break;
      case 'ko': audio.sfx('ko'); break;
      case 'text': if (e.text === 'powercrush') audio.sfx('pcrush'); break;
      default:
    }
  }

  matchEvent(e) {
    const m = this.match, cfg = this.cfg;
    if (cfg.practice || cfg.tutorial) { if (e.t === 'fight') return; }
    switch (e.t) {
      case 'round': {
        if (cfg.practice) break;
        const last = m.wins[0] === m.rules.rounds - 1 && m.wins[1] === m.rules.rounds - 1;
        const txt = last ? tr('FINAL ROUND', 'รอบตัดสิน') : tr('ROUND ', 'รอบที่ ') + m.round;
        this.hud.announce(txt, last ? 'small' : '', 1800);
        audio.sfx('round');
        audio.say(last ? 'Final round' : 'Round ' + m.round, { rate: 0.9 });
        break;
      }
      case 'fight':
        if (cfg.practice) break;
        this.hud.announce(tr('FIGHT!', 'ลุย!'), '', 1100); audio.sfx('fight'); audio.say('Fight!', { rate: 1.05, pitch: 0.7 });
        break;
      case 'ko': this.hud.announce('K.O.', 'ko', 2200); audio.say('K. O.', { rate: 0.8, force: true }); break;
      case 'timeup': this.hud.announce(tr('TIME UP', 'หมดเวลา'), 'small', 1800); audio.sfx('timeup'); audio.say('Time up'); break;
      case 'roundend':
        if (e.perfect) { this.hud.announce(tr('PERFECT!', 'สมบูรณ์แบบ!'), 'perfect', 2000); audio.say('Perfect!', { force: true }); }
        else if (e.winner >= 0) { this.hud.announce(tr('WINNER', 'ผู้ชนะ'), 'small', 1800); }
        else this.hud.announce(tr('DRAW', 'เสมอ'), 'small', 1800);
        if (e.winner >= 0) audio.sfx(e.winner === 0 || !this.cfg.cpu?.[1] ? 'win' : 'lose');
        break;
      case 'matchend': setTimeout(() => { if (this.match === m) this.finishMatch(); }, 1600); break;
      default:
    }
  }

  // ---------------------------------------------------------------- start / stop
  startMatch(cfg) {
    audio.unlock();
    this.stopMatch(true);
    this.clearShowcase();
    this.cfg = cfg;
    this.finished = false;
    const st = save.settings;
    const stageDef = stageById(cfg.stage || 'grid');
    const rules = {
      rounds: st.rounds, time: st.time, heat: st.heat, rage: st.rage, recoverable: st.recoverable, tech: st.tech, dmgMul: st.dmgMul,
      ...(cfg.rules || {}),
    };
    if (cfg.practice) Object.assign(rules, { practice: true, time: 0, rounds: 99 });
    const chars = cfg.chars.map((id) => this.compiled[id]);
    const m = new Match({ chars, stage: stageDef, rules, seed: cfg.seed ?? ((Math.random() * 1e9) | 0) });
    this.match = m;
    this.seed = m.rng.s;
    this.gv.loadStage(stageDef.id);
    const customs = cfg.chars.map((id, i) => {
      const c = save.data.custom[id] || {};
      const alt = cfg.alts?.[i];
      return { alt: alt !== undefined && alt !== null ? alt : (i === 0 ? c.alt : 0), custom: (i === 0 || cfg.useCustom?.[i]) ? c.custom : null };
    });
    this.gv.loadMatch(m, customs);
    this.gv.rig.clearManual();
    const p = save.profile;
    const names = cfg.names || m.fighters.map((f, i) => (i === 0 && !cfg.cpu?.[0] ? (cfg.playerName || pick(f.ch, 'name')) : pick(f.ch, 'name')));
    this.hud.setMatch(m, { names, practice: !!cfg.practice, ranks: cfg.ranks || [cfg.cpu?.[0] ? '' : tr(rankOf(p.exp).en, rankOf(p.exp).th), cfg.cpu?.[1] ? tr('CPU', 'คอม') : ''], hidden: false });
    // controllers
    this.brains = [null, null];
    this.dummy = null;
    const lv = cfg.level ?? st.difficulty;
    for (let i = 0; i < 2; i++) {
      if (cfg.cpu?.[i]) this.brains[i] = new CpuBrain(i, cfg.levels?.[i] ?? lv, (m.rng.s + i * 13) >>> 0, cfg.ghost && i === 1 ? { profile: save.data.ghost || undefined } : {});
    }
    if (cfg.practice) { this.dummy = new DummyBrain(1, cfg.practice.dummy || 'stand'); this.brains[1] = this.dummy; this.practiceRec = { active: false, tape: [] }; }
    else this.practiceRec = null;
    input.setMode(cfg.cpu?.[1] || cfg.practice ? (cfg.cpu?.[0] ? 'p2' : 'solo') : 'versus');
    if (cfg.cpu?.[0] && !cfg.cpu?.[1]) input.setMode('p2');
    this.recording = cfg.replay ? null : [];
    this.replayPos = 0; this.replayPaused = false; this.speed = 1;
    this.paused = false;
    this.acc = 0;
    this.tut = null;
    if (cfg.tutorial) this.startLesson(cfg.tutorial.index || 0);
    audio.playTrack(cfg.music || stageDef.music);
    // first few matches: remind the player of the basic controls
    if (!cfg.replay && !cfg.tutorial && (save.data.hints || 0) < 3) {
      save.data.hints = (save.data.hints || 0) + 1; save.write();
      setTimeout(() => { if (this.match === m && !this.touch.active) toast(tr('A/D move · W/S sidestep · U I J K = 1 2 3 4 · Esc pause & controls', 'A/D เดิน · W/S สเต็ป · U I J K = 1 2 3 4 · Esc หยุดเกมและดูปุ่ม')); }, 2600);
    }
    this.updateTouchVisibility();
    if (cfg.showVs !== false && !cfg.practice && !cfg.replay) S.vsSplash(this, cfg);
    else this.hud.root.classList.remove('nohud');
    this.applyStageAudio();
  }

  applyStageAudio() { /* crowd / ambience could be added here */ }

  stopMatch(silent = false) {
    if (!this.match) return;
    this.gv.unloadMatch();
    this.hud.clear();
    this.frozen = false;
    this.match = null; this.cfg = null; this.tut = null; this.practiceRec = null;
    this.paused = false;
    this.brains = [null, null];
    this.touch.show(false);
    input.setMode('all');
    document.getElementById('hud').classList.add('nohud');
    if (!silent) { this.gv.rig.clearManual(); }
  }

  // ---------------------------------------------------------------- pause
  pause() {
    if (!this.match || this.paused || this.finished) return;
    if (this.cfg.showVs !== false && this.match.phase === 'intro' && !this.cfg.practice && this.ui.top && this.ui.top.isVs) return;
    this.paused = true;
    this.updateTouchVisibility();
    S.pauseMenu(this);
  }

  resume() {
    this.paused = false;
    this.last = performance.now();
    this.updateTouchVisibility();
  }

  restartMatch() {
    const cfg = this.cfg;
    const c = { ...cfg, showVs: false };
    if (cfg.replay) c.replay = cfg.replay;
    this.paused = false;
    this.startMatch(c);
  }

  quitToMenu() {
    this.stopMatch();
    this.ui.clear();
    this.paused = false;
    this.menuMusic();
    S.mainMenu(this);
  }

  // ---------------------------------------------------------------- results / progression
  finishMatch() {
    if (this.finished || !this.match) return;
    this.finished = true;
    const m = this.match, cfg = this.cfg;
    const res = {
      winner: m.winner, wins: [...m.wins], rounds: m.round,
      stats: m.fighters.map((f) => ({ ...f.stats })),
      names: m.fighters.map((f) => pick(f.ch, 'name')),
      ids: m.fighters.map((f) => f.ch.id),
      hp: m.fighters.map((f) => f.hp / f.maxHp),
      frames: m.frame,
    };
    if (!cfg.replay && !cfg.practice && !cfg.tutorial) {
      this.saveReplay(res);
      const p = save.profile;
      const humanWin = res.winner === 0 && !cfg.cpu?.[0];
      const humanLoss = res.winner === 1 && !cfg.cpu?.[0];
      if (cfg.cpu?.[1] && !cfg.cpu?.[0]) {
        p.matches++;
        p.totalDmg += res.stats[0].dmg; p.maxCombo = Math.max(p.maxCombo, res.stats[0].maxCombo); p.throws += res.stats[0].throws; p.heats += res.stats[0].heats; p.rages += res.stats[0].rages;
        const lvl = cfg.level ?? save.settings.difficulty;
        if (humanWin) { p.wins++; res.fm = 40 + 15 * lvl + 10 * res.wins[0]; res.exp = 12 + 4 * lvl; }
        else if (humanLoss) { p.losses++; res.fm = 10; res.exp = 3; }
        else { res.fm = 5; res.exp = 1; }
        p.fm += res.fm; p.exp += res.exp;
        if (cfg.ghost && save.data.ghost !== undefined) this.updateGhost();
        save.write();
      }
    }
    if (cfg.onEnd) cfg.onEnd(res);
    else if (cfg.replay) this.replayFinished();
    else S.results(this, res, cfg);
  }

  updateGhost() {
    const b = this.brains[1];
    if (b && b.prof) save.data.ghost = { ...b.prof };
  }

  saveReplay(res) {
    if (!this.recording || !this.recording.length) return;
    try {
      const cfg = this.cfg;
      const bytes = new Uint8Array(this.recording);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      const rep = {
        id: Date.now(), date: new Date().toISOString(), chars: cfg.chars, alts: cfg.alts || [0, 0], stage: cfg.stage, seed: this.seed,
        rules: this.match.rules, names: res.names, wins: res.wins, frames: btoa(bin), n: bytes.length, mode: cfg.modeName || 'versus',
        customs: cfg.chars.map((id, i) => (i === 0 ? save.data.custom[id] || null : null)),
      };
      const list = save.data.replays;
      list.unshift(rep);
      while (list.length > 5) list.pop();
      save.write();
    } catch (e) { /* storage full etc. */ }
  }

  // ---------------------------------------------------------------- replays
  startReplay(rep) {
    const bin = atob(rep.frames);
    const frames = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) frames[i] = bin.charCodeAt(i);
    const rules = { ...rep.rules };
    this.startMatch({ chars: rep.chars, alts: rep.alts, stage: rep.stage, seed: rep.seed, rules, replay: { frames }, showVs: false, cpu: [false, false], names: rep.names });
    // replays apply their own rules exactly
    this.match.rules = { ...this.match.rules, ...rules };
    toast(tr('Replay: [ ] speed, Space pause, Esc exit', 'รีเพลย์: [ ] ปรับความเร็ว, Space หยุด, Esc ออก'));
  }

  replayKeys() {
    const L = input.latch;
    if (L.has('Space')) this.replayPaused = !this.replayPaused;
    if (L.has('BracketRight')) this.speed = Math.min(4, this.speed * 2);
    if (L.has('BracketLeft')) this.speed = Math.max(0.125, this.speed / 2);
    if (L.has('Escape')) this.quitToMenu();
  }

  replayFinished() {
    if (this.finished) return;
    this.finished = true;
    toast(tr('Replay finished', 'จบรีเพลย์'));
    setTimeout(() => this.quitToMenu(), 800);
  }

  // ---------------------------------------------------------------- practice tools
  practiceApply(k, v) {
    const m = this.match, R = m.rules;
    if (k === 'infHp') R.infHp = v; if (k === 'infHeat') R.infHeat = v; if (k === 'infRage') R.infRage = v;
    if (k === 'frame' || k === 'input') this.hud.root.classList.toggle(k === 'frame' ? 'hide-fd' : 'hide-il', !v);
    if (k === 'hit') this.gv.setHitboxes(v);
  }

  startPracticeRecord() { if (!this.practiceRec) return; this.practiceRec.active = true; this.practiceRec.tape = []; toast(tr('Recording: you control the dummy (P2 side)', 'กำลังบันทึก: คุณควบคุมหุ่นซ้อม')); }
  stopPracticeRecord() {
    const r = this.practiceRec; if (!r) return;
    r.active = false;
    if (r.tape.length > 5) { this.dummy.tape = r.tape.slice(); this.dummy.setMode('playback'); toast(tr('Playback armed', 'พร้อมเล่นซ้ำ')); }
  }

  dummyPerform(id) {
    const d = this.dummy; if (!d) return;
    d.setMode('cpu');
    const m = this.match.fighters[1].ch.moveMap.get(id);
    if (m) d.cpu.pressMove(m);
  }

  practiceReset(swap = false) {
    const m = this.match;
    m.resetPositions(swap);
    this.hud.setMatch(m, { ...this.hud.opts });
  }

  // ---------------------------------------------------------------- tutorial
  startLesson(i) {
    const cfgT = this.cfg.tutorial;
    const L = LESSONS[i];
    this.tut = { i, L, S: { walkF: false, dash: false, ss: false, btns: new Set(), maxCombo: 0, blocks: 0, lowHit: 0, midHit: 0, grabs: 0, breaks: 0, walls: 0, heatburst: 0, heatsmash: 0, rageart: 0, punish: 0 }, done: false, t: 0 };
    void cfgT;
    if (this.match) {
      const m = this.match;
      m.resetPositions(false);
      const d = L.dummy;
      if (this.dummy) {
        if (d === 'cpu1') { this.dummy.setMode('cpu'); this.dummy.setLevel(0); }
        else if (d === 'cpu2') { this.dummy.setMode('cpu'); this.dummy.setLevel(1); }
        else if (d === 'throwme') this.dummy.setMode('stand');
        else this.dummy.setMode('stand');
      }
      m.rules.infHp = true; m.rules.infHeat = true;
      m.rules.infRage = !!L.lowHp;
      if (L.wallPractice) { m.fighters[0].x = 4.5; m.fighters[1].x = 5.6; }
      if (!L.lowHp) { m.fighters.forEach((f) => { f.rage = false; f.rageUsed = false; }); }
    }
    S.tutorialPanel(this);
  }

  tutEvent(e) {
    const t = this.tut; if (!t || t.done) return;
    const s = t.S, m = this.match;
    switch (e.t) {
      case 'move': if (e.who === 0) { const mv = m.fighters[0].ch.moveMap.get(e.id); if (mv && mv.btn) [1, 2, 4, 8].forEach((b) => { if (mv.btn & b && !mv.motion) s.btns.add(b); }); } break;
      case 'dash': if (e.who === 0) s.dash = true; break;
      case 'ss': if (e.who === 0) s.ss = true; break;
      case 'hit': if (e.att === 0) { s.maxCombo = Math.max(s.maxCombo, m.fighters[1].comboHits); if (e.lv === 'l') s.lowHit++; if (e.lv === 'm') s.midHit++; } break;
      case 'block': if (e.def === 0) s.blocks++; break;
      case 'grab': if (e.att === 0) s.grabs++; break;
      case 'break': if (e.def === 0) s.breaks++; break;
      case 'wallsplat': if (e.who === 1) s.walls++; break;
      case 'heatburst': if (e.who === 0) s.heatburst++; break;
      case 'heatsmash': if (e.who === 0) s.heatsmash++; break;
      case 'rageart': if (e.who === 0) s.rageart++; break;
      case 'text': if (e.text === 'punish' && e.who === 0) s.punish++; break;
      default:
    }
  }

  tutorialTick() {
    const t = this.tut; if (!t) return 0;
    const m = this.match;
    t.t++;
    if (m.fighters[0].walkDir > 0) t.S.walkF = true;
    if (t.L.id === 'break' && t.t % 240 === 120 && !t.done) {
      const f = m.fighters[1];
      if (f.state === ST.IDLE) { this.dummyPerform(Math.random() < 0.5 ? 'th13' : 'th24'); }
    }
    if (t.L.id === 'guard' || t.L.id === 'punish') { /* cpu dummy attacks by itself */ }
    if (t.L.lowHp && m.fighters[0].hp > m.fighters[0].maxHp * 0.22) m.fighters[0].hp = Math.round(m.fighters[0].maxHp * 0.2);
    const prog = t.L.check(t.S);
    if (!t.done && prog >= t.L.goal) { t.done = true; audio.sfx('win'); }
    return prog;
  }
}
