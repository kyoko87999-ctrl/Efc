// Input devices: keyboard (rebindable), gamepad, touch overlay -> raw fighter input.
const BTN = ['b1', 'b2', 'b3', 'b4'];
const MACROS = { m12: ['b1', 'b2'], m13: ['b1', 'b3'], m24: ['b2', 'b4'], m23: ['b2', 'b3'], m34: ['b3', 'b4'], m14: ['b1', 'b4'], m1234: ['b1', 'b2', 'b3', 'b4'] };
export const ACTIONS = ['u', 'd', 'l', 'r', 'b1', 'b2', 'b3', 'b4', 'm12', 'm13', 'm24', 'm23', 'm34', 'm14'];

export const DEFAULT_BINDS = {
  p1: { u: ['KeyW'], d: ['KeyS'], l: ['KeyA'], r: ['KeyD'], b1: ['KeyU'], b2: ['KeyI'], b3: ['KeyJ'], b4: ['KeyK'], m12: ['KeyO'], m13: ['KeyL'], m24: ['KeyP'], m23: ['Space'], m34: ['KeyN'], m14: ['KeyM'] },
  p2: { u: ['ArrowUp'], d: ['ArrowDown'], l: ['ArrowLeft'], r: ['ArrowRight'], b1: ['Numpad4', 'Comma'], b2: ['Numpad5', 'Period'], b3: ['Numpad1', 'Slash'], b4: ['Numpad2', 'ShiftRight'], m12: ['Numpad6'], m13: ['Numpad0'], m24: ['Numpad3'], m23: ['Numpad8', 'Enter'], m34: ['Numpad7'], m14: ['Numpad9'] },
};

export const emptyRaw = () => ({ l: false, r: false, u: false, d: false, b1: false, b2: false, b3: false, b4: false });

export class Input {
  constructor() {
    this.binds = JSON.parse(JSON.stringify(DEFAULT_BINDS));
    this.held = new Set();
    this.latch = new Set();
    this.pressedNav = [];
    this.padDead = 0.45;
    this.padState = [];
    this.touch = null;              // set by touch controls: {raw}
    this.map = { p1: ['kb1', 'pad0', 'touch'], p2: ['kb2', 'pad1'] };
    this.lastDevice = 'kb';
    this.rebinding = null;
    this.onAnyKey = null;
    this.onKeyDown = null;
    addEventListener('keydown', (e) => this.key(e, true), { passive: false });
    addEventListener('keyup', (e) => this.key(e, false), { passive: false });
    addEventListener('blur', () => { this.held.clear(); this.latch.clear(); });
    this.padPrev = [{}, {}, {}, {}];
  }

  key(e, down) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
    const code = e.code;
    if (down) {
      if (this.rebinding) { e.preventDefault(); const cb = this.rebinding; this.rebinding = null; cb(code); return; }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(code)) e.preventDefault();
      if (!e.repeat) { this.latch.add(code); this.lastDevice = 'kb'; if (this.onKeyDown) this.onKeyDown(code, e); }
      this.held.add(code);
    } else this.held.delete(code);
  }

  isDown(codes) {
    for (const c of codes) if (this.held.has(c) || this.latch.has(c)) return true;
    return false;
  }

  gamepads() {
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    const out = [];
    for (const g of gps) if (g && g.connected) out.push(g);
    return out;
  }

  padRaw(g) {
    const r = emptyRaw();
    if (!g) return r;
    const b = (i) => !!(g.buttons[i] && g.buttons[i].pressed);
    const ax = g.axes[0] || 0, ay = g.axes[1] || 0;
    r.l = b(14) || ax < -this.padDead; r.r = b(15) || ax > this.padDead;
    r.u = b(12) || ay < -this.padDead; r.d = b(13) || ay > this.padDead;
    r.b1 = b(2); r.b2 = b(3); r.b3 = b(0); r.b4 = b(1);
    if (b(4)) { r.b1 = true; r.b3 = true; }
    if (b(5)) { r.b2 = true; r.b4 = true; }
    if (b(6)) { r.b1 = true; r.b2 = true; }
    if (b(7)) { r.b2 = true; r.b3 = true; }
    return r;
  }

  kbRaw(which) {
    const bd = this.binds[which];
    const r = emptyRaw();
    for (const a of ['u', 'd', 'l', 'r', ...BTN]) r[a] = this.isDown(bd[a]);
    for (const [m, bs] of Object.entries(MACROS)) if (bd[m] && this.isDown(bd[m])) for (const b of bs) r[b] = true;
    return r;
  }

  // called once per rendered frame
  poll(player) {
    const r = emptyRaw();
    const merge = (o) => { for (const k in r) r[k] = r[k] || o[k]; };
    for (const dev of this.map[player === 0 ? 'p1' : 'p2']) {
      if (dev === 'kb1') merge(this.kbRaw('p1'));
      else if (dev === 'kb2') merge(this.kbRaw('p2'));
      else if (dev.startsWith('pad')) {
        const g = this.gamepads()[+dev.slice(3)];
        if (g) { const pr = this.padRaw(g); merge(pr); if (Object.values(pr).some(Boolean)) this.lastDevice = 'pad'; }
      } else if (dev === 'touch' && this.touch) merge(this.touch.raw());
    }
    return r;
  }

  // must be called after all polls of the frame
  endFrame() { this.latch.clear(); }

  setMode(mode) {
    // mode: 'solo' (all devices control P1) | 'versus'
    if (mode === 'solo') this.map = { p1: ['kb1', 'kb2', 'pad0', 'touch'], p2: [] };
    else if (mode === 'versus') this.map = { p1: ['kb1', 'pad0'], p2: ['kb2', 'pad1'] };
    else if (mode === 'p2') this.map = { p1: [], p2: ['kb1', 'kb2', 'pad0', 'touch'] };
    else this.map = { p1: ['kb1', 'pad0', 'touch'], p2: ['kb2', 'pad1'] };
  }

  // ------------------------------------------------ menu navigation (keyboard + gamepad)
  navPoll() {
    // returns list of nav events this frame: 'up','down','left','right','ok','back','tabL','tabR','start'
    const ev = [];
    const L = this.latch;
    const has = (...c) => c.some((x) => L.has(x));
    if (has('ArrowUp', 'KeyW')) ev.push('up');
    if (has('ArrowDown', 'KeyS')) ev.push('down');
    if (has('ArrowLeft', 'KeyA')) ev.push('left');
    if (has('ArrowRight', 'KeyD')) ev.push('right');
    if (has('Enter', 'Space', 'KeyU', 'KeyJ', 'Numpad5')) ev.push('ok');
    if (has('Escape', 'Backspace', 'KeyI', 'KeyK')) ev.push('back');
    if (has('KeyQ', 'PageUp')) ev.push('tabL');
    if (has('KeyE', 'PageDown')) ev.push('tabR');
    if (has('Tab')) ev.push('start');
    const gps = this.gamepads();
    gps.forEach((g, gi) => {
      const st = this.padPrev[gi] || (this.padPrev[gi] = {});
      const b = (i) => !!(g.buttons[i] && g.buttons[i].pressed);
      const ax = g.axes[0] || 0, ay = g.axes[1] || 0;
      const cur = { up: b(12) || ay < -0.6, down: b(13) || ay > 0.6, left: b(14) || ax < -0.6, right: b(15) || ax > 0.6, ok: b(0), back: b(1), tabL: b(4), tabR: b(5), start: b(9) };
      for (const k in cur) if (cur[k] && !st[k]) { ev.push(k); this.lastDevice = 'pad'; }
      this.padPrev[gi] = cur;
    });
    return ev;
  }

  anyPress() {
    if (this.latch.size) return true;
    for (const g of this.gamepads()) if (g.buttons.some((b) => b.pressed)) return true;
    return false;
  }
}

export const input = new Input();
