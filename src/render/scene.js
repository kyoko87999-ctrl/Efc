// GameView: owns the WebGL renderer, stage, fighter views, camera and effects.
import * as THREE from 'three';
import { Puppet } from './puppet.js';
import { CameraRig } from './camera.js';
import { Fx, Trail } from './fx.js';
import { buildStage, stageById } from './stages.js';
import { ST } from '../sim/fighter.js';
import { limbAt } from '../sim/move.js';
import { lerp, angleDiff, DEG, clamp } from '../util.js';

const V3 = THREE.Vector3;
const UP = new THREE.Vector3(0, 1, 0);

class CapVis {
  constructor(scene, color) {
    this.g = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.85, depthTest: false });
    this.a = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), m);
    this.b = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), m);
    this.c = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true), m);
    this.g.add(this.a, this.b, this.c);
    this.g.renderOrder = 999;
    this.g.visible = false;
    scene.add(this.g);
  }
  set(cap) {
    if (!cap) { this.g.visible = false; return; }
    this.g.visible = true;
    const [a, b, r] = [cap.a, cap.b, cap.r];
    this.a.position.set(a[0], a[1], a[2]); this.a.scale.setScalar(r);
    this.b.position.set(b[0], b[1], b[2]); this.b.scale.setScalar(r);
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    this.c.visible = len > 1e-4;
    if (len > 1e-4) {
      this.c.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      this.c.scale.set(r, len, r);
      this.c.quaternion.setFromUnitVectors(UP, new V3(dx / len, dy / len, dz / len));
    }
  }
  dispose() { this.g.parent?.remove(this.g); }
}

export class FighterView {
  constructor(gv, f, ch, cust) {
    this.gv = gv; this.f = f; this.ch = ch;
    this.puppet = new Puppet(f, ch, cust);
    this.rig = this.puppet.rig;
    this.anim = this.puppet.anim;
    gv.scene.add(this.rig.root);
    this.trails = {};
    this.tmp = new V3(); this.tmp2 = new V3();
    this.auraT = 0;
    this.glow = ch.body.glow ? new THREE.Color(ch.body.glow) : new THREE.Color(0xffffff);
    this.lastHit = 0;
  }

  trail(limb) {
    if (!this.trails[limb]) this.trails[limb] = new Trail(this.gv.scene, this.glow, 12);
    return this.trails[limb];
  }

  update(alpha, T, dtF, freeze) {
    const f = this.f, rig = this.rig;
    this.puppet.update(alpha, T, dtF, freeze);
    const { x, z } = this.puppet.pos;
    // hair / scarf sway
    if (rig.hairTail) rig.hairTail.rotation.x = 0.15 + Math.sin(T * 3) * 0.06 + (f.walkDir ? 0.15 : 0);
    if (rig.scarfTail) rig.scarfTail.rotation.x = -0.15 + Math.sin(T * 4) * 0.12;
    if (rig.wings) rig.wings.forEach((w, i) => { w.rotation.y = (i ? -1 : 1) * (0.55 + Math.sin(T * 2 + i) * 0.1); });

    // colour effects
    let tintC = null, tintA = 0;
    if (f.flash > 0) { tintC = '#ffffff'; tintA = f.flash / 6 * 0.7; }
    else if (f.rage) { tintC = '#ff1a1a'; tintA = 0.22 + 0.12 * Math.sin(T * 8); }
    else if (f.heat.on) { tintC = '#ff8a1a'; tintA = 0.22 + 0.08 * Math.sin(T * 10); }
    if (this.gv.blackout && f.state !== ST.GRAB) { /* cinematic dim handled by lights */ }
    rig.tint(tintC || '#000000', tintC ? tintA : 0);

    // particles for heat / rage
    this.auraT += dtF;
    if ((f.heat.on || f.rage) && this.auraT > 2) {
      this.auraT = 0;
      const col = f.rage ? 0xff2a2a : 0xff9a2b;
      const px = x + (Math.random() - 0.5) * 0.7, pz = z + (Math.random() - 0.5) * 0.7;
      this.gv.fx.ember(px, 0.1 + Math.random() * 1.2, pz, col);
    }
    // move trails
    const m = f.state === ST.ATK ? f.move : null;
    const specials = ['fL', 'fR', 'hL', 'hR'];
    if (m && (m.limb[0] === 'h' || m.limb[0] === 'f' || m.limb[0] === 'k' || m.limb[0] === 'e') && f.mf >= m.wf && f.mf <= m.st + m.ac + 3 && m.lv !== 't') {
      const anc = m.limb === 'kL' ? 'kL' : m.limb === 'kR' ? 'kR' : m.limb === 'eL' ? 'eL' : m.limb === 'eR' ? 'eR' : m.limb;
      rig.anchorWorld(anc, this.tmp);
      const key = anc;
      const tr = this.trail(key);
      tr.setColor(f.rage ? 0xff4040 : f.heat.on ? 0xffa030 : m.an && m.an.elec ? 0x8fe3ff : m.limb[0] === 'f' ? 0xfff2c4 : 0xffffff);
      tr.push(this.tmp, this.tmp2.set(0, 1, 0), m.limb[0] === 'f' || m.limb[0] === 'k' ? 0.13 : 0.09);
      tr.update(true);
      if (m.an && m.an.elec && f.mf >= m.st - 4 && f.mf <= m.st + m.ac + 4 && Math.random() < 0.7) {
        const p = this.tmp.toArray();
        this.gv.fx.bolt([p[0] + (Math.random() - 0.5) * 0.4, p[1] + (Math.random() - 0.5) * 0.4, p[2] + (Math.random() - 0.5) * 0.4], [p[0], p[1], p[2]], 0x8fe3ff, 0.4);
      }
    }
    for (const k of Object.keys(this.trails)) {
      if (!(m && (k === m.limb) && f.mf >= m.wf && f.mf <= m.st + m.ac + 3)) this.trails[k].update(false);
    }
  }

  dispose() {
    this.gv.scene.remove(this.rig.root);
    this.rig.dispose();
    for (const t of Object.values(this.trails)) t.dispose();
  }
}

export class GameView {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.opts = { quality: 2, shadows: true, ...opts };
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.opts.quality > 0, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserve });
    this.renderer.shadowMap.enabled = this.opts.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 400);
    this.rig = new CameraRig(this.camera);
    this.fx = new Fx(this.scene);
    this.views = [];
    this.stage = null;
    this.stageId = null;
    this.T = 0;
    this.match = null;
    this.flashEl = null;
    this.fill = new THREE.DirectionalLight(0xffffff, 0.75);
    this.fill.position.set(0, 4, 8);
    this.scene.add(this.fill, this.fill.target);
    this.setQuality(this.opts.quality);
    this.resize();
    this.excite = 0;
    this.rain = null;
    this.ambient = null;
    this.camMax = 12;
    this.hitboxes = false;
    this.hitVis = [];
  }

  setHitboxes(v) {
    this.hitboxes = v;
    if (!v) { this.hitVis.forEach((c) => c.dispose()); this.hitVis = []; }
  }

  updateHitboxes() {
    if (!this.hitboxes || !this.match) return;
    const fs = this.match.fighters;
    if (this.hitVis.length !== fs.length * 2) {
      this.hitVis.forEach((c) => c.dispose());
      this.hitVis = [];
      fs.forEach(() => { this.hitVis.push(new CapVis(this.scene, 0x37ff8a), new CapVis(this.scene, 0xff3b3b)); });
    }
    fs.forEach((f, i) => {
      this.hitVis[i * 2].set(f.hurtCapsule());
      const sc = f.state === ST.ATK && f.move && !f.move.noHit ? f.moveCapsule(f.move) : null;
      const act = f.strikeCapsule();
      this.hitVis[i * 2 + 1].set(act || sc);
      if (this.hitVis[i * 2 + 1].g.visible) this.hitVis[i * 2 + 1].a.material.color.setHex(act ? 0xff3b3b : 0xffcc33);
    });
  }

  setQuality(q) {
    this.opts.quality = q;
    const dpr = Math.min(window.devicePixelRatio || 1, q >= 2 ? 2 : q === 1 ? 1.5 : 1);
    this.renderer.setPixelRatio(dpr);
    this.renderer.shadowMap.enabled = q > 0;
    if (this.stage?.key) this.configureShadow(this.stage.key);
    this.resize();
  }

  configureShadow(key) {
    key.castShadow = this.opts.quality > 0;
    const s = key.shadow;
    const size = this.opts.quality >= 2 ? 2048 : 1024;
    if (s.mapSize.x !== size) { s.mapSize.set(size, size); if (s.map) { s.map.dispose(); s.map = null; } }
    const c = s.camera; c.left = -11; c.right = 11; c.top = 11; c.bottom = -11; c.near = 1; c.far = 40; c.updateProjectionMatrix();
    s.bias = -0.0004; s.normalBias = 0.03;
    key.target.position.set(0, 0, 0);
    this.scene.add(key.target);
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  loadStage(id, phase = 0) {
    if (this.stage) { this.scene.remove(this.stage.group); this.disposeGroup(this.stage.group); this.stage = null; }
    const def = stageById(id);
    const name = phase > 0 && def.id === 'dojo' ? 'garden' : def.id;
    const s = buildStage(name, this.opts.quality);
    this.stage = s; this.stageId = id; this.stagePhase = phase;
    this.scene.add(s.group);
    this.scene.fog = new THREE.FogExp2(s.fog[0], s.fog[1]);
    this.scene.background = new THREE.Color(s.fog[0]);
    if (s.key) this.configureShadow(s.key);
    this.buildWeather(s);
    this.def = def;
    if (phase > 0) this.stageOffset = def.phases[phase]?.center || [0, 0];
    else this.stageOffset = [0, 0];
    s.group.position.set(this.stageOffset[0], 0, this.stageOffset[1]);
    if (s.key) { s.key.position.add(new V3(this.stageOffset[0], 0, this.stageOffset[1])); s.key.target.position.set(this.stageOffset[0], 0, this.stageOffset[1]); this.scene.add(s.key.target); }
    this.camMax = id === 'alley' ? 6.4 : id === 'ring' ? 10 : 12;
  }

  disposeGroup(g) {
    g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); } });
    if (this.weather) { this.scene.remove(this.weather.points); this.weather.points.geometry.dispose(); this.weather = null; }
  }

  buildWeather(s) {
    if (this.weather) { this.scene.remove(this.weather.points); this.weather.points.geometry.dispose(); this.weather = null; }
    const kind = s.rain ? 'rain' : s.snow ? 'snow' : null;
    if (!kind || this.opts.quality === 0) return;
    const n = kind === 'rain' ? 900 : 500;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 30; pos[i * 3 + 1] = Math.random() * 14; pos[i * 3 + 2] = (Math.random() - 0.5) * 22; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: kind === 'rain' ? 0xaad0ff : 0xffffff, size: kind === 'rain' ? 0.05 : 0.09, transparent: true, opacity: kind === 'rain' ? 0.5 : 0.8, depthWrite: false });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    this.scene.add(pts);
    this.weather = { points: pts, kind, n };
  }

  updateWeather(dtF) {
    const w = this.weather; if (!w) return;
    const p = w.points.geometry.attributes.position;
    const sp = w.kind === 'rain' ? 0.5 : 0.04;
    for (let i = 0; i < w.n; i++) {
      let y = p.getY(i) - sp * dtF;
      if (y < 0) y += 14;
      p.setY(i, y);
      if (w.kind === 'snow') p.setX(i, p.getX(i) + Math.sin(this.T * 0.5 + i) * 0.003);
    }
    p.needsUpdate = true;
    w.points.position.set(this.rig.look.x, 0, this.rig.look.z);
  }

  loadMatch(match, customs = [null, null]) {
    this.unloadMatch();
    this.match = match;
    match.fighters.forEach((f, i) => { this.views.push(new FighterView(this, f, f.ch, customs[i])); });
  }

  addView(f, ch, cust = null) {
    const v = new FighterView(this, f, ch, cust);
    this.views.push(v);
    return v;
  }

  unloadMatch() {
    for (const v of this.views) v.dispose();
    this.views = [];
    this.match = null;
  }

  // effects for sim events
  handleEvent(e) {
    const m = this.match;
    switch (e.t) {
      case 'hit': {
        this.fx.hit(e.pos, e.kind, { counter: e.counter, pcrush: e.pcrush });
        this.rig.shake(e.kind === 'heavy' ? 0.7 : e.kind === 'med' ? 0.3 : 0.12);
        if (e.kind === 'heavy') this.rig.zoomPunch(1);
        this.excite = Math.min(1, this.excite + (e.kind === 'heavy' ? 0.6 : 0.25));
        if (e.launch) this.fx.dust(e.pos[0], e.pos[2], true);
        break;
      }
      case 'block': this.fx.block(e.pos, e.kind); this.rig.shake(0.06); break;
      case 'parry': this.fx.burst(e.pos, 0xffe066, 2); break;
      case 'break': this.fx.burst(e.pos, 0x9fe8ff, 2.2); break;
      case 'grab': break;
      case 'land': this.fx.dust(e.x, e.z, e.big); if (e.big) this.rig.shake(0.35); break;
      case 'bound': this.fx.dust(e.x, e.z, true); break;
      case 'wallsplat': {
        this.fx.burst([e.x - e.nx * 0.3, 1.2, e.z - e.nz * 0.3], 0xfff0c0, 3);
        this.rig.shake(1);
        if (this.stage?.walls && e.nx) this.crackWall(e);
        break;
      }
      case 'wallbreak': this.onWallBreak(e); break;
      case 'phase': if (e.idx !== this.stagePhase) this.loadStage(this.stageId, e.idx); break;
      case 'heat': { const f = m.fighters[e.who]; this.fx.burst([f.x, 0.9, f.z], 0xff9a2b, 3.6); this.rig.shake(0.5); break; }
      case 'heatburst': { const f = m.fighters[e.who]; this.fx.burst([f.x, 1.0, f.z], 0xffd08a, 4); break; }
      case 'rage': { const f = m.fighters[e.who]; this.fx.burst([f.x, 0.9, f.z], 0xff2a2a, 3.6); this.rig.shake(0.5); break; }
      case 'rageart': { const f = m.fighters[e.who]; this.fx.burst([f.x, 1.0, f.z], 0xff3030, 5); this.flash('#ffffff', 220); break; }
      case 'heatsmash': { const f = m.fighters[e.who]; this.fx.burst([f.x, 1.0, f.z], 0xffa040, 5); this.flash('#fff2d0', 180); break; }
      case 'ko': { this.flash('#ffffff', 260); this.rig.shake(1); this.rig.zoomPunch(2); break; }
      case 'dash': { const f = m.fighters[e.who]; this.fx.dust(f.x, f.z, false); break; }
      case 'roll': { const f = m.fighters[e.who]; this.fx.dust(f.x, f.z, false); break; }
      default:
    }
  }

  crackWall(e) {
    const w = this.stage.walls;
    void w;
  }

  onWallBreak(e) {
    this.flash('#ffffff', 320);
    this.rig.shake(1.4);
    this.fx.burst([e.x, 1.2, e.z], 0xffe6b0, 6);
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      this.fx.spawn({ map: this.fx.tex.glow, x: e.x, y: 0.8 + Math.random() * 2, z: e.z, vx: Math.cos(a) * 0.12, vy: Math.random() * 0.1, vz: Math.sin(a) * 0.12, g: 0.006, s0: 0.3, s1: 0.1, life: 50, color: 0xe8dcc0, blend: 'normal' });
    }
    this.loadStage(this.stageId, e.to);
  }

  flash(color, ms) {
    if (!this.flashEl) return;
    this.flashEl.style.transition = 'none';
    this.flashEl.style.background = color;
    this.flashEl.style.opacity = '0.85';
    void this.flashEl.offsetWidth;
    this.flashEl.style.transition = `opacity ${ms}ms ease-out`;
    this.flashEl.style.opacity = '0';
  }

  cullWalls() {
    const s = this.stage; if (!s || !s.culls) return;
    const ox = this.stageOffset?.[0] || 0, oz = this.stageOffset?.[1] || 0;
    const c = { x: this.camera.position.x - ox, z: this.camera.position.z - oz };
    for (const w of s.culls) w.mesh.visible = !(w.dir > 0 ? c[w.ax] > w.at - 0.4 : c[w.ax] < -w.at + 0.4);
  }

  // called every render frame
  frame(dtSec, alpha, timeScale = 1) {
    const dtF = dtSec * 60 * timeScale;
    this.T += dtSec;
    const match = this.match;
    const freeze = match ? match.hitstop > 0 : false;
    for (const v of this.views) v.update(freeze ? 0 : alpha, this.T, freeze ? 0 : dtF, freeze);
    if (this.stage?.anim) for (const fn of this.stage.anim) fn(this.T, { excite: this.excite });
    this.excite *= Math.pow(0.99, dtF);
    this.fx.update(freeze ? 0 : dtF);
    this.updateWeather(dtF);
    this.rig.update(dtF || 0.0001, match, this.camMax);
    if (match && this.stage) {
      // stage embers
      if (this.stage.embers && Math.random() < 0.5) this.fx.ember((Math.random() - 0.5) * 14 + (this.stageOffset?.[0] || 0), 0.1, (Math.random() - 0.5) * 12, this.stage.ember || 0xff8a3d);
      if (this.stage.mist && Math.random() < 0.1) this.fx.spawn({ map: this.fx.tex.smoke, x: (Math.random() - 0.5) * 16, y: 0.3, z: (Math.random() - 0.5) * 16, vx: 0.004, s0: 2, s1: 4, life: 90, color: 0xc8b8a0, blend: 'normal', a0: 0.12 });
    }
    // camera-side fill light so fighters stay readable on dark stages
    const cp = this.camera.position, lk = this.rig.look;
    this.fill.position.set(cp.x + (cp.z - lk.z) * 0.1 - 1.5, cp.y + 2.2, cp.z);
    this.fill.target.position.copy(lk);
    this.cullWalls();
    this.updateHitboxes();
    this.renderer.render(this.scene, this.camera);
  }
}

export { limbAt, clamp };
