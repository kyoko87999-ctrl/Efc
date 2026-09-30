// Practice-mode training dummy controller.
import { ST } from './fighter.js';
import { CpuBrain } from './ai.js';

const NEUTRAL = { l: false, r: false, u: false, d: false, b1: false, b2: false, b3: false, b4: false };

export const DUMMY_MODES = ['stand', 'crouch', 'jump', 'block', 'blocklow', 'blockrand', 'blockfirst', 'techroll', 'cpu', 'playback'];

export class DummyBrain {
  constructor(idx, mode = 'stand') {
    this.idx = idx;
    this.mode = mode;
    this.cpu = new CpuBrain(idx, 2, 99);
    this.tape = null;
    this.tapePos = 0;
    this.decided = -1;
    this.guardKind = 'stand';
    this.rng = 12345;
  }

  setMode(m) { this.mode = m; this.tapePos = 0; }
  setLevel(l) { this.cpu.setLevel(l); }
  rand() { this.rng = (this.rng * 1664525 + 1013904223) >>> 0; return this.rng / 4294967296; }

  bits(dir) {
    const mir = this.idx === 1;
    const f = dir === 6 || dir === 9 || dir === 3, b = dir === 4 || dir === 7 || dir === 1;
    return { l: mir ? f : b, r: mir ? b : f, u: dir === 7 || dir === 8 || dir === 9, d: dir === 1 || dir === 2 || dir === 3, b1: false, b2: false, b3: false, b4: false };
  }

  think(match) {
    const me = match.fighters[this.idx], opp = match.fighters[1 - this.idx];
    if (match.phase !== 'fight') return NEUTRAL;
    switch (this.mode) {
      case 'stand': return this.bits(5);
      case 'crouch': return this.bits(2);
      case 'jump': return me.state === ST.IDLE && this.rand() < 0.02 ? this.bits(8 + 1) : this.bits(5);
      case 'block': case 'blocklow': case 'blockrand': case 'blockfirst': return this.blockLogic(match, me, opp);
      case 'techroll': {
        const o = this.bits(4);
        if (me.state === ST.AIR) o.b1 = true;
        if (me.state === ST.DOWN) { o.u = true; }
        return o;
      }
      case 'cpu': return this.cpu.think(match);
      case 'playback': {
        if (!this.tape || !this.tape.length) return this.bits(5);
        const f = this.tape[this.tapePos % this.tape.length]; this.tapePos++;
        return { ...f };
      }
      default: return this.bits(5);
    }
  }

  blockLogic(match, me, opp) {
    let hold = false;
    if (this.mode === 'block') hold = true;
    else if (this.mode === 'blocklow') hold = true;
    else if (this.mode === 'blockfirst') hold = me.state === ST.BLK || me.state === ST.HIT || me.state === ST.AIR;
    else if (this.mode === 'blockrand') {
      if (opp.state === ST.ATK && opp.move && opp.moveStart !== this.decided) { this.decided = opp.moveStart; this.blocking = this.rand() < 0.5; }
      hold = !!this.blocking && opp.state === ST.ATK || me.state === ST.BLK;
    }
    let crouch = this.mode === 'blocklow';
    if (opp.state === ST.ATK && opp.move && opp.move.lv === 'l') crouch = true;
    if (me.state === ST.BLK && me.blkCrouch) crouch = true;
    if (!hold) return this.bits(5);
    return this.bits(crouch ? 1 : 4);
  }
}
