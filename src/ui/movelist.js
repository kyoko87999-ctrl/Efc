// Command list: every move of a fighter with notation, level and frame data.
import { h, MenuList } from './kit.js';
import { tr, pick } from './i18n.js';
import { audio } from '../audio/audio.js';
import { CHARS } from '../data/roster.js';
import { compileChar } from '../sim/move.js';
import { fmtAdv, lvName } from './hud.js';

const ARR = { 'd/f': '↘', 'd/b': '↙', 'u/f': '↗', 'u/b': '↖', f: '→', b: '←', d: '↓', u: '↑', n: 'N' };
export function prettyCmd(display) {
  if (!display) return '';
  return display.split(/([+,])/).map((t) => ARR[t] || t).join('');
}

const cache = {};
const comp = (id) => (cache[id] ||= compileChar(CHARS.find((c) => c.id === id)));

export function categorize(cc) {
  const groups = { normal: [], string: [], move: [], throw: [], stance: [], special: [] };
  for (const m of cc.moveList) {
    if (m.noAI && m.noHit && !m.toStance && !m.auto && !m.pry && !m.inv) continue;
    if (m.hbst || m.hs || m.ra || m.rd) groups.special.push(m);
    else if (m.lv === 't') groups.throw.push(m);
    else if (m.ctx && m.ctx.startsWith('st:')) groups.stance.push(m);
    else if (m.toStance) groups.stance.unshift(m);
    else if (m.ctx === 'chain') groups.string.push(m);
    else if (['ws', 'wr', 'ss', 'cd', 'air', 'dn'].includes(m.ctx)) groups.move.push(m);
    else groups.normal.push(m);
  }
  return groups;
}

export function moveProps(m) {
  const p = [];
  const HT = { launch: tr('Launcher', 'ส่งลอย'), kd: tr('Knockdown', 'ล้มลง'), bound: tr('Bound', 'กระแทกพื้น'), tornado: tr('Tornado', 'พายุหมุน'), screw: tr('Screw', 'หมุนสกรู'), stag: tr('Stagger', 'เซถอย'), crumple: tr('Crumple', 'ทรุด') };
  if (HT[m.ht]) p.push(HT[m.ht]);
  if (m.cht === 'launch') p.push(tr('Launches on Counter Hit', 'ส่งลอยเมื่อตีสวน'));
  if (m.ws) p.push(tr('Wall splat', 'ติดกำแพง'));
  if (m.wb) p.push(tr('Wall break', 'ทะลวงกำแพง'));
  if (m.hom) p.push(tr('Homing', 'ตามเป้าหมาย'));
  if (m.pc) p.push(tr('Power Crush', 'พลังทะลวง') + ` (${m.pc[0]}-${m.pc[1]}f)`);
  if (m.he) p.push(tr('Heat Engager', 'ตัวจุดฮีท'));
  if (m.hbst) p.push(tr('Heat Burst: activates Heat', 'Heat Burst เปิดสถานะฮีท'));
  if (m.hs) p.push(tr('Heat Smash (during Heat)', 'Heat Smash (ขณะฮีท)'));
  if (m.ra) p.push(tr('Rage Art (Rage only)', 'Rage Art (เมื่อเรจ)'));
  if (m.rd) p.push(tr('Rage Drive (Rage only)', 'Rage Drive (เมื่อเรจ)'));
  if (m.pry) p.push(tr('Parry', 'ปัดป้อง'));
  if (m.gh) p.push(tr('Hits grounded foes', 'ตีคนที่ล้มอยู่ได้'));
  if (m.inv) p.push(tr('Evasive', 'หลบหลีก'));
  if (m.hb && m.hb.some((x) => x[2] === 'crouch')) p.push(tr('Ducks under highs', 'ย่อหลบท่าบน'));
  if (m.lv === 't' && m.grab) p.push(tr('Throw', 'จับทุ่ม') + (m.grab.brk ? ` — ${tr('break with', 'สลัดด้วย')} ${m.grab.brk}` : '') + (m.grab.low ? ' · ' + tr('hits crouching', 'จับคนย่อได้') : ''));
  if (m.toStance) p.push(tr('Enters a stance', 'เข้าท่าตั้ง'));
  if (m.unbl && m.lv !== 't') p.push(tr('Unblockable', 'บล็อกไม่ได้'));
  p.push(`${tr('Reach', 'ระยะ')} ~${m.reach.toFixed(1)}m`);
  return p.join(' · ');
}

export function moveListScreen(app, charId, onBack, overlay) {
  let cur = charId;
  const wrap = h('div', { class: 'screen ml dark' });
  const side = h('div', { class: 'ml-side' });
  const main = h('div', { class: 'ml-main' });
  const chips = h('div', { class: 'ml-head' });
  const table = h('div', { class: 'ml-table' });
  const detail = h('div', { style: { padding: '.6em 1em', borderTop: '1px solid var(--line)', minHeight: '3.4em', fontSize: '.9em', opacity: 0.9 } });
  let rows = [], focus = 0;
  const GROUP_NAME = { normal: tr('Normal moves', 'ท่าปกติ'), string: tr('Strings', 'คอมโบ'), move: tr('Movement attacks', 'ท่าจากการเคลื่อนที่'), throw: tr('Throws', 'จับทุ่ม'), stance: tr('Stances', 'ท่าตั้ง'), special: tr('Heat / Rage', 'Heat / Rage') };

  function build() {
    const cc = comp(cur);
    const ch = CHARS.find((c) => c.id === cur);
    chips.innerHTML = '';
    CHARS.forEach((c) => chips.append(h('div', { class: 'tab' + (c.id === cur ? ' on' : ''), onClick: () => { cur = c.id; build(); audio.sfx('ui_move'); } }, h('span', {}, pick(c, 'name').split(' ')[0]))));
    side.innerHTML = '';
    side.append(h('div', { class: 'tile', style: { width: '100%', height: '20vw', maxHeight: '32vh', backgroundImage: app.portrait(cur) ? `url(${app.portrait(cur)})` : '', backgroundSize: 'cover' } }),
      h('h1', { class: 'title', style: { fontSize: '1.6em' } }, pick(ch, 'name')), h('div', { style: { color: 'var(--gold)' } }, `${ch.title} · ${pick(ch, 'style')}`), h('p', { style: { opacity: 0.8, fontSize: '.85em', lineHeight: 1.5 } }, pick(ch, 'desc')),
      h('p', { style: { opacity: 0.6, fontSize: '.8em' } }, `${cc.moveList.length} ${tr('moves', 'ท่า')}`),
      h('div', { class: 'btn', onClick: () => close() }, h('span', {}, tr('Back', 'กลับ'))));
    table.innerHTML = '';
    rows = [];
    table.append(h('div', { class: 'ml-row hd' }, h('span', {}, tr('Command', 'คำสั่ง')), h('span', {}, tr('Name', 'ชื่อท่า')), h('span', { style: { textAlign: 'center' } }, tr('Lv', 'ระดับ')), h('span', {}, tr('Start', 'เริ่ม')), h('span', {}, tr('Block', 'บล็อก')), h('span', {}, tr('Hit', 'โดน')), h('span', {}, tr('Dmg', 'ดาเมจ'))));
    const groups = categorize(cc);
    for (const g of Object.keys(groups)) {
      if (!groups[g].length) continue;
      table.append(h('div', { class: 'ml-sec' }, GROUP_NAME[g]));
      for (const m of groups[g]) {
        const isT = m.lv === 't', noHit = m.noHit;
        const row = h('div', { class: 'ml-row' },
          h('span', { class: 'cmd' }, prettyCmd(m.display || m.cmd || m.id)),
          h('span', { class: 'nm' }, m.name || m.id),
          h('span', { class: 'lv ' + (m.lv === 'sm' ? 'm' : m.lv) }, noHit ? '-' : lvName(m.lv)),
          h('span', {}, noHit ? '-' : 'i' + m.st),
          h('span', { class: 'adv ' + (m.blk >= 0 ? 'p' : 'n') }, noHit || isT ? '-' : fmtAdv(m.blk)),
          h('span', { class: 'adv ' + (m.hit >= 0 ? 'p' : 'n') }, noHit || isT ? '-' : m.ht === 'launch' ? tr('Launch', 'ลอย') : fmtAdv(m.hit)),
          h('span', {}, noHit ? '-' : isT && m.grab ? m.grab.hits.reduce((s, x) => s + x.dmg, 0) : m.dmg + (m.grab && m.grab.hits ? '+' + m.grab.hits.reduce((s, x) => s + x.dmg, 0) : '')));
        const i = rows.length;
        row.addEventListener('click', () => { focus = i; setFocus(); });
        table.append(row);
        rows.push({ row, m });
      }
    }
    focus = Math.min(focus, rows.length - 1);
    setFocus(true);
  }
  function setFocus(quiet) {
    rows.forEach((r, i) => r.row.classList.toggle('focus', i === focus));
    const r = rows[focus];
    if (r) { r.row.scrollIntoView({ block: 'nearest' }); detail.innerHTML = ''; detail.append(h('b', { style: { color: 'var(--gold)' } }, `${prettyCmd(r.m.display || r.m.cmd || '')}  ${r.m.name}`), h('div', {}, moveProps(r.m))); }
    if (!quiet) audio.sfx('ui_move', { vol: 0.5 });
  }
  function close() { app.ui.pop(); if (onBack) onBack(); }
  main.append(chips, table, detail);
  wrap.append(side, main);
  build();
  const scr = {
    el: wrap, overlay: !!overlay,
    nav(ev) {
      if (ev === 'up') { focus = Math.max(0, focus - 1); setFocus(); return true; }
      if (ev === 'down') { focus = Math.min(rows.length - 1, focus + 1); setFocus(); return true; }
      const idx = CHARS.findIndex((c) => c.id === cur);
      if (ev === 'left' || ev === 'tabL') { cur = CHARS[(idx + CHARS.length - 1) % CHARS.length].id; build(); audio.sfx('ui_move'); return true; }
      if (ev === 'right' || ev === 'tabR') { cur = CHARS[(idx + 1) % CHARS.length].id; build(); audio.sfx('ui_move'); return true; }
      return false;
    },
    back: close,
  };
  if (!overlay) app.ui.clear();
  app.ui.push(scr);
  return scr;
}
