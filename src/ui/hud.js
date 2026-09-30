// Match HUD: health / recoverable / heat / rage, timer, round pips, combo counters, banners, practice overlays.
import { tr, pick } from './i18n.js';
import { save, rankOf } from '../game/save.js';
import { ST } from '../sim/fighter.js';

const $ = (s, r = document) => r.querySelector(s);
const DIR_ARROW = { 1: '↙', 2: '↓', 3: '↘', 4: '←', 5: '', 6: '→', 7: '↖', 8: '↑', 9: '↗' };

export class Hud {
  constructor(root) {
    this.root = root;
    this.match = null;
    this.projector = null;
    this.ghost = [100, 100];
    this.lastCombo = [0, 0];
    this.bannerT = 0;
    this.inputLog = [[], []];
    this.lastIn = [0, 0];
    this.build();
  }

  build() {
    this.root.innerHTML = `
      <div class="hud-top">
        ${[0, 1].map((i) => `
        <div class="pl p${i + 1}" data-i="${i}">
          <div class="pl-head"><span class="pn"></span><span class="rk"></span></div>
          <div class="hpbar"><div class="hp-ghost"></div><div class="hp-rec"></div><div class="hp-fill"></div><div class="hp-grid"></div><span class="rage-tag">RAGE</span></div>
          <div class="sub"><div class="heatbar"><div class="heat-fill"></div><span class="heat-label">HEAT</span></div><div class="pips"></div></div>
        </div>`).join('')}
        <div class="timer"><span>60</span><em></em></div>
      </div>
      <div class="combo c1"><b></b><i>HITS</i><em></em></div>
      <div class="combo c2"><b></b><i>HITS</i><em></em></div>
      <div class="tags t1"></div><div class="tags t2"></div>
      <div class="banner"></div>
      <div class="dmgnums"></div>
      <div class="practice-hud" hidden>
        <div class="fd fd1"></div><div class="fd fd2"></div>
        <div class="inlog il1"></div><div class="inlog il2"></div>
      </div>
      <div class="fps" hidden></div>`;
    this.el = {
      pl: [$('.p1', this.root), $('.p2', this.root)],
      timer: $('.timer span', this.root), timerEm: $('.timer em', this.root),
      combo: [$('.c1', this.root), $('.c2', this.root)],
      tags: [$('.t1', this.root), $('.t2', this.root)],
      banner: $('.banner', this.root), nums: $('.dmgnums', this.root),
      practice: $('.practice-hud', this.root), fd: [$('.fd1', this.root), $('.fd2', this.root)], il: [$('.il1', this.root), $('.il2', this.root)],
      fps: $('.fps', this.root),
    };
    this.parts = this.el.pl.map((p) => ({
      name: $('.pn', p), rank: $('.rk', p), ghost: $('.hp-ghost', p), rec: $('.hp-rec', p), fill: $('.hp-fill', p), hp: $('.hpbar', p),
      heat: $('.heatbar', p), heatFill: $('.heat-fill', p), pips: $('.pips', p),
    }));
  }

  setMatch(match, opts = {}) {
    this.match = match;
    this.opts = opts;
    this.ghost = [100, 100];
    this.el.banner.className = 'banner';
    this.el.banner.textContent = '';
    this.el.nums.innerHTML = '';
    this.el.tags.forEach((t) => (t.innerHTML = ''));
    const names = opts.names || match.fighters.map((f) => pick(f.ch, 'name'));
    match.fighters.forEach((f, i) => {
      this.parts[i].name.textContent = names[i];
      const r = opts.ranks?.[i];
      this.parts[i].rank.textContent = r || '';
      this.parts[i].pips.innerHTML = '<i></i>'.repeat(match.rules.rounds);
      this.el.pl[i].classList.remove('rage');
    });
    this.el.practice.hidden = !opts.practice;
    this.root.classList.toggle('practice', !!opts.practice);
    this.root.classList.toggle('nohud', !!opts.hidden);
    this.inputLog = [[], []];
    this.lastIn = [0, 0];
    this.el.timer.parentElement.style.visibility = match.rules.time > 0 ? 'visible' : 'hidden';
  }

  clear() { this.match = null; }

  announce(text, cls = '', ms = 1400) {
    const b = this.el.banner;
    b.className = 'banner';
    b.textContent = text;
    void b.offsetWidth;
    b.className = 'banner show ' + cls;
    this.bannerT = ms;
    clearTimeout(this._bt);
    this._bt = setTimeout(() => { b.className = 'banner'; }, ms);
  }

  tag(who, text, cls = '') {
    const box = this.el.tags[who];
    const d = document.createElement('div');
    d.className = 'tag ' + cls;
    d.textContent = text;
    box.appendChild(d);
    if (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => d.remove(), 1400);
  }

  damageNum(pos, dmg, cls = '') {
    if (!this.projector || dmg <= 0) return;
    const p = this.projector(pos);
    if (!p) return;
    const d = document.createElement('div');
    d.className = 'dn ' + cls;
    d.textContent = dmg;
    d.style.left = p.x + 'px'; d.style.top = p.y + 'px';
    this.el.nums.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }

  handleEvent(e) {
    switch (e.t) {
      case 'text': {
        const map = {
          counter: [tr('COUNTER HIT', 'ตีสวน'), 'counter'], punish: [tr('PUNISH', 'ลงโทษ'), 'punish'], break: [tr('THROW BREAK', 'สลัดหลุด'), 'break'],
          parry: [tr('PARRY', 'ปัดป้อง'), 'parry'], powercrush: [tr('POWER CRUSH', 'พลังทะลวง'), 'crush'],
        };
        const m = map[e.text];
        if (m) this.tag(e.who, m[0], m[1]);
        break;
      }
      case 'hit': if (!e.cap || e.dmg > 3) this.damageNum(e.pos, e.dmg, e.counter ? 'ch' : e.kind); break;
      case 'wallsplat': this.tag(this.match.fighters[e.who].opp.idx, tr('WALL SPLAT', 'ติดกำแพง'), 'wall'); break;
      case 'wallbreak': this.announce(tr('WALL BREAK!', 'ทะลวงกำแพง!'), 'wb', 1600); break;
      case 'heat': this.tag(e.who, tr('HEAT ACTIVATED', 'ฮีทเริ่มทำงาน'), 'heat'); break;
      case 'heatburst': this.tag(e.who, tr('HEAT BURST', 'ฮีทเบิร์สต์'), 'heat'); break;
      case 'heatsmash': this.tag(e.who, tr('HEAT SMASH', 'ฮีทสแมช'), 'heat'); break;
      case 'heatdash': this.tag(e.who, tr('HEAT DASH', 'ฮีทแดช'), 'heat'); break;
      case 'rage': this.tag(e.who, tr('RAGE!', 'เรจ!'), 'rage'); break;
      case 'rageart': this.tag(e.who, tr('RAGE ART', 'เรจอาร์ต'), 'rage'); break;
      default:
    }
  }

  update(dtF, extra = {}) {
    const m = this.match;
    if (!m) return;
    const P = this.parts;
    m.fighters.forEach((f, i) => {
      const pct = Math.max(0, f.hp / f.maxHp * 100);
      const rec = Math.min(100 - pct, f.rec / f.maxHp * 100);
      if (this.ghost[i] > pct) this.ghost[i] = Math.max(pct, this.ghost[i] - 0.35 * dtF - (f.state === ST.HIT || f.state === ST.AIR ? 0 : 0.3 * dtF));
      else this.ghost[i] = pct;
      const p = P[i];
      p.fill.style.transform = `scaleX(${pct / 100})`;
      p.ghost.style.transform = `scaleX(${Math.max(pct, this.ghost[i]) / 100})`;
      p.rec.style.transform = `scaleX(${Math.min(1, (pct + rec) / 100)})`;
      p.fill.dataset.lv = pct < 25 ? 'low' : pct < 50 ? 'mid' : 'hi';
      this.el.pl[i].classList.toggle('rage', !!f.rage);
      // heat
      const h = f.heat;
      p.heat.classList.toggle('on', h.on);
      p.heat.classList.toggle('ready', h.avail && !h.on);
      p.heat.classList.toggle('used', !h.avail && !h.on);
      p.heatFill.style.transform = `scaleX(${h.on ? Math.max(0, h.t / 600) : h.avail ? 1 : 0})`;
      // pips
      const pips = p.pips.children;
      for (let k = 0; k < pips.length; k++) pips[k].classList.toggle('w', k < m.wins[i]);
      // combo counters (shown on the attacker's side)
      const c = f.comboOut, ce = this.el.combo[i];
      if (c.hits >= 2 && c.t > 0) {
        ce.classList.add('show');
        if (c.hits !== this.lastCombo[i]) {
          ce.firstElementChild.textContent = c.hits;
          ce.lastElementChild.textContent = c.dmg + ' ' + tr('DMG', 'ดาเมจ');
          ce.classList.remove('pop'); void ce.offsetWidth; ce.classList.add('pop');
          this.lastCombo[i] = c.hits;
        }
      } else { ce.classList.remove('show'); this.lastCombo[i] = 0; }
    });
    if (m.rules.time > 0) {
      const s = Math.max(0, Math.ceil(m.timeLeft / 60));
      this.el.timer.textContent = m.timeLeft < 0 ? '' : s;
      this.el.timer.parentElement.classList.toggle('warn', m.timeLeft > 0 && s <= 10);
    }
    if (this.opts.practice) this.updatePractice(extra);
  }

  updatePractice() {
    const m = this.match;
    m.fighters.forEach((f, i) => {
      // input history
      const key = f.dir | (f.btn << 4);
      const log = this.inputLog[i];
      if (key !== this.lastIn[i]) {
        this.lastIn[i] = key;
        log.unshift({ dir: f.dir, btn: f.btn, n: 1 });
        if (log.length > 14) log.pop();
        this.renderLog(i);
      } else if (log[0]) { log[0].n++; if (log[0].n % 6 === 0) this.renderLog(i); }
      // frame data
      const mv = f.move || f.lastMoveRef;
      if (f.move) f.lastMoveRef = f.move;
      const box = this.el.fd[i];
      const mm = f.lastMoveRef;
      if (mm && f.lastMoveRef !== this._fdLast?.[i]) {
        (this._fdLast ||= [])[i] = mm;
        box.innerHTML = `<b>${mm.display || mm.id}</b> ${mm.name || ''}<br>` +
          `<span>${tr('Startup', 'สตาร์ทอัพ')} i${mm.st}</span> <span>${tr('Block', 'บล็อก')} ${fmtAdv(mm.blk)}</span> <span>${tr('Hit', 'โดน')} ${fmtAdv(mm.hit)}</span> <span>${tr('Dmg', 'ดาเมจ')} ${mm.dmg}</span> <span>${lvName(mm.lv)}</span>`;
      }
      void mv;
    });
    const lm = m.lastMeasure;
    if (lm && lm !== this._lm) {
      this._lm = lm;
      const box = this.el.fd[lm.att];
      const span = document.createElement('div');
      span.className = 'meas ' + (lm.adv >= 0 ? 'plus' : 'minus');
      span.textContent = (lm.kind === 'block' ? tr('On block ', 'ตอนบล็อก ') : tr('On hit ', 'ตอนโดน ')) + fmtAdv(lm.adv);
      box.appendChild(span);
      setTimeout(() => span.remove(), 3500);
    }
  }

  renderLog(i) {
    const log = this.inputLog[i];
    const el = this.el.il[i];
    el.innerHTML = log.map((e) => `<div>${e.dir !== 5 ? `<span class="ar">${DIR_ARROW[e.dir]}</span>` : '<span class="ar"></span>'}${[1, 2, 4, 8].map((b, k) => (e.btn & b ? `<span class="bt b${k + 1}">${k + 1}</span>` : '')).join('')}<em>${e.n}</em></div>`).join('');
  }
}

export const fmtAdv = (v) => (v > 0 ? '+' + v : String(v));
export const lvName = (lv) => ({ h: tr('High', 'บน'), m: tr('Mid', 'กลาง'), sm: tr('Mid', 'กลาง'), l: tr('Low', 'ล่าง'), t: tr('Throw', 'จับทุ่ม') }[lv] || lv);
export { rankOf, save };
