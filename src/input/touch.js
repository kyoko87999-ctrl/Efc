// On-screen touch controls (virtual stick + 4 attack buttons + macro buttons).
import { emptyRaw } from './devices.js';

export class TouchControls {
  constructor(root, onPause) {
    this.root = root;
    this.onPause = onPause;
    this.state = emptyRaw();
    this.macro = {};
    this.active = false;
    this.stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.btnIds = new Map();
    this.build();
  }

  build() {
    const r = this.root;
    r.innerHTML = `
      <div class="tc-stick" data-zone="stick"><div class="tc-base"><div class="tc-knob"></div></div></div>
      <div class="tc-btns">
        <button class="tc-b b1" data-b="b1">1</button><button class="tc-b b2" data-b="b2">2</button>
        <button class="tc-b b3" data-b="b3">3</button><button class="tc-b b4" data-b="b4">4</button>
      </div>
      <div class="tc-macros">
        <button class="tc-m" data-m="m13">1+3</button><button class="tc-m" data-m="m24">2+4</button>
        <button class="tc-m" data-m="m12">1+2</button><button class="tc-m heat" data-m="m23">HEAT</button>
        <button class="tc-m" data-m="m34">3+4</button><button class="tc-m" data-m="m14">1+4</button>
      </div>
      <button class="tc-pause" data-p="1">II</button>`;
    this.stickEl = r.querySelector('.tc-stick');
    this.knob = r.querySelector('.tc-knob');
    this.base = r.querySelector('.tc-base');
    const opt = { passive: false };
    this.stickEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.stick.id = e.pointerId; this.stickEl.setPointerCapture(e.pointerId);
      const rc = this.stickEl.getBoundingClientRect();
      this.stick.ox = e.clientX; this.stick.oy = e.clientY;
      this.base.style.left = (e.clientX - rc.left) + 'px'; this.base.style.top = (e.clientY - rc.top) + 'px';
      this.stick.x = 0; this.stick.y = 0; this.update();
    }, opt);
    this.stickEl.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stick.id) return;
      e.preventDefault();
      this.stick.x = e.clientX - this.stick.ox; this.stick.y = e.clientY - this.stick.oy;
      const l = Math.hypot(this.stick.x, this.stick.y), max = 46;
      if (l > max) { this.stick.x *= max / l; this.stick.y *= max / l; this.stick.ox = e.clientX - this.stick.x; this.stick.oy = e.clientY - this.stick.y; }
      this.update();
    }, opt);
    const end = (e) => { if (e.pointerId === this.stick.id) { this.stick.id = null; this.stick.x = 0; this.stick.y = 0; this.update(); } };
    this.stickEl.addEventListener('pointerup', end); this.stickEl.addEventListener('pointercancel', end);
    r.querySelectorAll('[data-b],[data-m]').forEach((b) => {
      const key = b.dataset.b || b.dataset.m, isM = !!b.dataset.m;
      const down = (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); (isM ? this.macro : this.state)[key] = true; b.classList.add('on'); };
      const up = (e) => { (isM ? this.macro : this.state)[key] = false; b.classList.remove('on'); };
      b.addEventListener('pointerdown', down, opt); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    });
    const pb = r.querySelector('.tc-pause');
    pb.addEventListener('pointerdown', (e) => { e.preventDefault(); if (this.onPause) this.onPause(); }, opt);
    r.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  update() {
    const { x, y } = this.stick;
    const T = 20;
    this.state.l = x < -T; this.state.r = x > T; this.state.u = y < -T; this.state.d = y > T;
    this.knob.style.transform = `translate(${x}px, ${y}px)`;
  }

  raw() {
    const r = { ...this.state };
    const M = { m12: ['b1', 'b2'], m13: ['b1', 'b3'], m24: ['b2', 'b4'], m23: ['b2', 'b3'], m34: ['b3', 'b4'], m14: ['b1', 'b4'] };
    for (const [k, on] of Object.entries(this.macro)) if (on) for (const b of M[k]) r[b] = true;
    return r;
  }

  show(v) { this.active = v; this.root.classList.toggle('show', v); }
}
