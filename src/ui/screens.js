// All non-match screens.
import { h, $, MenuList, toast } from './kit.js';
import { tr, pick, getLang, setLang } from './i18n.js';
import { audio } from '../audio/audio.js';
import { input, DEFAULT_BINDS } from '../input/devices.js';
import { save, rankOf, RANKS } from '../game/save.js';
import { STAGES } from '../render/stagesList.js';
import { LESSONS } from '../game/tutorial.js';
import { LEVELS } from '../sim/ai.js';
import { QUOTES } from '../game/story.js';
import { ST } from '../sim/fighter.js';
import { fmtAdv, lvName } from './hud.js';
import * as M from '../game/modes.js';

const NAV_KEYS = { up: 'up', down: 'down', left: 'left', right: 'right' };
void NAV_KEYS;

const screen = (cls, ...kids) => h('div', { class: 'screen ' + cls }, ...kids);
const hint = (html) => h('div', { class: 'hint', html });
const kbd = (k) => `<kbd>${k}</kbd>`;
const navHint = () => tr(`${kbd('↑↓←→')} Move &nbsp; ${kbd('Enter')} Select &nbsp; ${kbd('Esc')} Back &nbsp; ${kbd('F')} Fullscreen`, `${kbd('↑↓←→')} เลื่อน &nbsp; ${kbd('Enter')} เลือก &nbsp; ${kbd('Esc')} ย้อนกลับ &nbsp; ${kbd('F')} เต็มจอ`);

// ------------------------------------------------------------------------------ title
export function title(app) {
  app.ui.clear();
  app.hud.root.classList.add('nohud');
  const el = screen('title-screen',
    h('div', { class: 'lang-toggle btn', onClick: (e) => { e.stopPropagation(); setLang(getLang() === 'th' ? 'en' : 'th'); save.settings.lang = getLang(); save.write(); title(app); } }, h('span', {}, getLang() === 'th' ? 'ภาษาไทย → EN' : 'EN → ภาษาไทย')),
    h('div', {},
      h('div', { class: 'logo' }, 'EFC'),
      h('div', { class: 'logo-sub' }, 'Elite Fighters Championship')),
    h('div', { class: 'press' }, app.isTouch ? tr('TAP TO START', 'แตะเพื่อเริ่ม') : tr('PRESS ANY BUTTON', 'กดปุ่มใดก็ได้')),
    h('div', { class: 'ver' }, 'v1.0'));
  const go = () => { audio.unlock(); audio.sfx('ui_select'); mainMenu(app); };
  el.addEventListener('click', go);
  const scr = { el, nav: (ev) => { if (ev) { go(); return true; } return false; }, back: () => {} };
  app.ui.push(scr);
  // any key
  scr.nav = () => { go(); return true; };
  const c = ['dojo', 'rooftop', 'temple'];
  const ids = pickTwo(app);
  app.setShowcase([{ id: ids[0], x: -2.4 }, { id: ids[1], x: 2.4 }], { stage: c[(Math.random() * 3) | 0], orbit: 0.12, radius: 8.5, height: 1.6, cam: [0, 1.6, 8.5], fov: 34 });
  audio.playTrack('menu');
}

function pickTwo(app) {
  const l = app.list.filter((c) => !c.boss);
  const a = l[(Math.random() * l.length) | 0];
  let b = l[(Math.random() * l.length) | 0];
  if (b === a) b = l[(l.indexOf(a) + 1) % l.length];
  return [a.id, b.id];
}

// ------------------------------------------------------------------------------ main menu
export function mainMenu(app) {
  app.ui.clear();
  app.hud.root.classList.add('nohud');
  const p = save.profile, rk = rankOf(p.exp);
  const info = h('div', { class: 'side-info' });
  const setInfo = (title, text) => { info.innerHTML = ''; info.append(h('h3', {}, title), h('p', {}, text)); };
  const go = (fn) => () => fn();
  const items = [
    { label: tr('Story Mode', 'โหมดเนื้อเรื่อง'), d: tr('Follow Tawan through the Iron Bell Tournament: 9 chapters of cinematic fights.', 'ติดตามตะวันในศึกระฆังเหล็ก 9 บท พร้อมบทสนทนา'), ok: go(() => M.story(app)) },
    { label: tr('Arcade Battle', 'อาร์เคด'), d: tr('Fight your way up an 8-stage ladder to the demon lord.', 'สู้ไต่บันได 8 ด่านเพื่อไปเจอจอมมาร'), ok: go(() => M.arcade(app)) },
    { label: tr('Versus (2 Players)', 'ผู้เล่นสองคน'), d: tr('Local versus on one keyboard or with two gamepads.', 'ต่อสู้กันบนคีย์บอร์ดเดียวหรือจอยสองตัว'), ok: go(() => M.versus(app, false)) },
    { label: tr('VS CPU', 'ต่อสู้กับคอม'), d: tr('Pick any fighter and any difficulty from Beginner to Master.', 'เลือกนักสู้และระดับความยากตั้งแต่มือใหม่ถึงมาสเตอร์'), ok: go(() => M.versus(app, true)) },
    { label: tr('Ghost Battle', 'แบทเทิลผี'), d: tr('An AI that studies your habits and adapts to beat you.', 'AI ที่เรียนรู้นิสัยของคุณและปรับตัวมาเอาชนะ'), ok: go(() => M.ghost(app)) },
    { label: tr('Survival', 'เอาชีวิตรอด'), d: tr('Endless opponents. Health carries over. How far can you go?', 'ศัตรูไม่จบสิ้น พลังชีวิตสะสมต่อเนื่อง ไปได้ไกลแค่ไหน'), ok: go(() => M.survival(app)) },
    { label: tr('Practice', 'ฝึกซ้อม'), d: tr('Training room with frame data, input display, hitboxes, dummy record & playback.', 'ห้องซ้อมพร้อมเฟรมดาต้า แสดงปุ่มกด ฮิตบ็อกซ์ และบันทึก/เล่นซ้ำหุ่นซ้อม'), ok: go(() => M.practice(app)) },
    { label: tr('Tutorial', 'สอนเล่น'), d: tr(`${LESSONS.length} interactive lessons: movement, blocking, throws, juggles, walls, Heat and Rage.`, `บทเรียน ${LESSONS.length} บทแบบโต้ตอบ การเคลื่อนไหว บล็อก จับทุ่ม คอมโบ กำแพง Heat และ Rage`), ok: go(() => lessonMenu(app)) },
    { label: tr('How to Play', 'วิธีเล่น'), d: tr('Controls for keyboard, gamepad and touch, plus the core rules in one page.', 'ปุ่มควบคุมคีย์บอร์ด จอย และทัชสกรีน พร้อมกฎพื้นฐานในหน้าเดียว'), ok: go(() => helpScreen(app, false)) },
    { label: tr('Move List', 'รายการท่า'), d: tr('Every command, frame data and property of every fighter.', 'คำสั่ง เฟรมดาต้า และคุณสมบัติของท่าทุกตัวละคร'), ok: go(() => M.moveList(app)) },
    { label: tr('Customize', 'ปรับแต่งตัวละคร'), d: tr('Change costumes and colors. Saved for all modes.', 'เปลี่ยนชุดและสี บันทึกใช้ได้ทุกโหมด'), ok: go(() => M.customize(app)) },
    { label: tr('Replays', 'รีเพลย์'), d: tr('Watch your last five matches again.', 'ดูการแข่งย้อนหลัง 5 แมตช์ล่าสุด'), ok: go(() => replayScreen(app)) },
    { label: tr('Options', 'ตั้งค่า'), d: tr('Gameplay rules, video, audio, controls, language.', 'กติกา ภาพ เสียง ปุ่มควบคุม และภาษา'), ok: go(() => optionsScreen(app, false)) },
    { label: tr('Credits', 'เครดิต'), d: tr('About this game.', 'เกี่ยวกับเกมนี้'), ok: go(() => creditsScreen(app)) },
  ];
  const list = new MenuList(items.map((it) => ({ label: it.label, ok: it.ok, d: it.d })), { cls: 'menu-list compact', onFocus: (it) => { setInfo(it.label, it.d); } });
  const prof = h('div', { class: 'ver', style: { left: '4vw', right: 'auto', opacity: 0.85 } }, `${tr('Rank', 'แรงก์')}: ${tr(rk.en, rk.th)} · ${tr('Wins', 'ชนะ')} ${p.wins} · ${tr('Fight Money', 'เงินต่อสู้')} ${p.fm} FM`);
  const el = screen('menu-screen veil',
    h('h1', { class: 'title' }, 'EFC'), h('h2', { class: 'sub' }, tr('Main Menu', 'เมนูหลัก')),
    list.el, info, prof, hint(navHint()));
  const scr = { el, nav: (ev) => list.nav(ev), back: () => title(app) };
  app.ui.push(scr);
  const ids = pickTwo(app);
  app.setShowcase([{ id: ids[0], x: 2.3 }, { id: ids[1], x: 5.5 }], { stage: 'rooftop', orbit: 0.06, orbit0: 0.4, radius: 7, height: 1.5, center: [3.5, 0], look: [3.5, 1.1, 0], fov: 34 });
  app.showcasePose(0, ST.INTRO);
  audio.playTrack('menu');
}

// ------------------------------------------------------------------------------ character select
const STAT_KEYS = [['power', 'POWER', 'พลัง'], ['speed', 'SPEED', 'ความเร็ว'], ['range', 'RANGE', 'ระยะ'], ['tech', 'TECH', 'เทคนิค'], ['defense', 'DEFENSE', 'ป้องกัน']];

function pcard(app, id, alt, side, who, custom) {
  const ch = app.list.find((c) => c.id === id);
  const c = ch.body.glow || '#ffc94a';
  const el = h('div', { class: 'pcard ' + (side === 0 ? 'l' : 'r'), style: { '--c': c } },
    h('div', { class: 'who' }, who),
    h('div', { class: 'nm' }, pick(ch, 'name')),
    h('div', { class: 'ttl' }, ch.title),
    h('div', { class: 'sty' }, `${pick(ch, 'style')} · ${ch.country}`),
    ...STAT_KEYS.map(([k, en, th]) => h('div', { class: 'stat' }, h('span', {}, tr(en, th)), h('div', { class: 'bar' }, ...[1, 2, 3, 4, 5].map((i) => h('i', { class: i <= ch.stats[k] ? 'on' : '' }))))),
    h('div', { class: 'stat' }, h('span', {}, tr('DIFFICULTY', 'ความยาก')), h('div', { class: 'bar' }, ...[1, 2, 3, 4, 5].map((i) => h('i', { class: i <= ch.difficulty ? 'on' : '' })))),
    h('p', { style: { fontSize: '.8em', opacity: 0.8, margin: '.5em 0 0', lineHeight: 1.4 } }, pick(ch, 'desc')),
    h('div', { class: 'alts' }, ...['A', ...(ch.alts || []).map((a) => a.name), ...(custom ? [tr('Custom', 'กำหนดเอง')] : [])].map((n, i) => h('span', { class: 'alt' + (i === alt ? ' on' : ''), 'data-alt': i }, i === 0 ? tr('Default', 'ปกติ') : n))));
  return el;
}

// opts: { title, players: 1|2, onDone({chars, alts}), first: id }
export function selectScreen(app, opts) {
  app.ui.clear();
  const roster = app.list.filter((c) => !(c.boss && opts.noBoss));
  let cursor = Math.max(0, roster.findIndex((c) => c.id === (opts.first || save.data.lastChar)));
  if (cursor < 0) cursor = 0;
  let phase = 0;
  const picks = [];
  const alts = [0, 0];
  const el = screen('sel');
  const grid = h('div', { class: 'grid' });
  const card = [h('div'), h('div')];
  const crumb = h('div', { class: 'crumb' });
  const cols = 6;
  const tiles = roster.map((c, i) => {
    const t = h('div', { class: 'tile', style: { backgroundImage: app.portrait(c.id) ? `url(${app.portrait(c.id)})` : `linear-gradient(135deg, ${c.body.glow || '#345'}, #0b0e16)` } },
      h('div', { class: 'nm' }, pick(c, 'name').split(' ')[0]));
    t.addEventListener('pointerenter', () => { cursor = i; refresh(true); });
    t.addEventListener('click', () => { cursor = i; ok(); });
    grid.append(t);
    return t;
  });
  const rnd = h('div', { class: 'tile rnd' }, '?');
  rnd.addEventListener('click', () => { cursor = (Math.random() * roster.length) | 0; refresh(); ok(); });
  grid.append(rnd);
  app.onPortraits = () => { tiles.forEach((t, i) => { t.style.backgroundImage = `url(${app.portrait(roster[i].id)})`; }); };

  const custCount = (id) => (save.data.custom[id]?.custom ? 1 : 0);
  function altMax(id) { const ch = app.list.find((c) => c.id === id); return (ch.alts || []).length + custCount(id); }
  function refresh(hover) {
    const cur = roster[cursor];
    tiles.forEach((t, i) => { t.classList.toggle('h1', phase === 0 && i === cursor); t.classList.toggle('h2', phase === 1 && i === cursor); });
    const players = opts.players;
    crumb.textContent = opts.title + ' — ' + (players === 2 ? (phase === 0 ? tr('PLAYER 1', 'ผู้เล่น 1') : tr('PLAYER 2', 'ผู้เล่น 2')) : tr('SELECT YOUR FIGHTER', 'เลือกนักสู้ของคุณ'));
    const side0 = phase === 0 ? cur.id : picks[0];
    const side1 = players === 2 ? (phase === 1 ? cur.id : null) : null;
    card[0].replaceWith(card[0] = pcard(app, side0, alts[0], 0, tr('PLAYER 1', 'ผู้เล่น 1'), custCount(side0)));
    if (side1) { card[1].replaceWith(card[1] = pcard(app, side1, alts[1], 1, tr('PLAYER 2', 'ผู้เล่น 2'), 0)); card[1].hidden = false; } else card[1].hidden = true;
    // clickable alt pills
    card.forEach((c, i) => c.querySelectorAll('.alt').forEach((a) => a.addEventListener('click', () => { alts[i] = +a.dataset.alt; refresh(); })));
    if (!hover || true) {
      const defs = [{ id: side0, x: -1.45, alt: alts[0] || 0, custom: alts[0] === (app.list.find((c) => c.id === side0).alts || []).length + 1 ? save.data.custom[side0]?.custom : null }];
      if (side1) defs.push({ id: side1, x: 1.45, alt: alts[1] });
      else if (players === 2) defs.push({ id: side0, x: 60 });
      app.setShowcase(defs.length > 1 ? defs : [defs[0], { id: side0, x: 60 }], { stage: 'rooftop', cam: [0, 1.25, 7.4], look: [0, 0.6, 0], fov: 32 });
      app.showcasePose(0, ST.INTRO);
      if (side1) app.showcasePose(1, ST.INTRO);
    }
  }
  function ok() {
    const cur = roster[cursor];
    audio.sfx('ui_select');
    picks[phase] = cur.id;
    save.data.lastChar = cur.id;
    if (opts.players === 2 && phase === 0) { phase = 1; refresh(); return; }
    // resolve alt indices: alt index beyond costumes = custom
    const finalAlts = [0, 1].map((i) => {
      const id = picks[i]; if (!id) return 0;
      const ch = app.list.find((c) => c.id === id); const a = alts[i];
      return a;
    });
    app.showcasePose(0, ST.WIN);
    setTimeout(() => opts.onDone({ chars: picks.slice(0, opts.players), alts: finalAlts, useCustom: [alts[0] > (app.list.find((c) => c.id === picks[0]).alts || []).length, false] }), 350);
  }
  function move(dx, dy) {
    const n = roster.length;
    let x = cursor % cols, y = Math.floor(cursor / cols);
    x += dx; y += dy;
    const rows = Math.ceil(n / cols);
    if (x < 0) x = cols - 1; if (x >= cols) x = 0;
    if (y < 0) y = rows - 1; if (y >= rows) y = 0;
    let i = y * cols + x;
    if (i >= n) i = n - 1;
    cursor = i;
    audio.sfx('ui_move');
    refresh();
  }
  el.append(crumb, card[0], card[1], grid,
    hint(tr(`${kbd('↑↓←→')} Move &nbsp; ${kbd('Q')}/${kbd('E')} Costume &nbsp; ${kbd('Enter')} Select &nbsp; ${kbd('Esc')} Back`, `${kbd('↑↓←→')} เลื่อน &nbsp; ${kbd('Q')}/${kbd('E')} เปลี่ยนชุด &nbsp; ${kbd('Enter')} เลือก &nbsp; ${kbd('Esc')} ย้อนกลับ`)));
  const scr = {
    el,
    nav(ev) {
      if (ev === 'left') move(-1, 0); else if (ev === 'right') move(1, 0); else if (ev === 'up') move(0, -1); else if (ev === 'down') move(0, 1);
      else if (ev === 'ok') ok();
      else if (ev === 'tabL' || ev === 'tabR') { const id = roster[cursor].id; const mx = altMax(id); alts[phase] = ((alts[phase] || 0) + (ev === 'tabR' ? 1 : -1) + mx + 1) % (mx + 1); audio.sfx('ui_move'); refresh(); }
      else return false;
      return true;
    },
    back() { if (phase === 1) { phase = 0; refresh(); } else { app.onPortraits = null; if (opts.onBack) opts.onBack(); else mainMenu(app); } },
  };
  app.ui.push(scr);
  refresh();
  return scr;
}

// ------------------------------------------------------------------------------ stage select
export function stageSelect(app, onPick, onBack, opts = {}) {
  app.ui.clear();
  const list = STAGES.filter((s) => !s.hidden && !(opts.noGrid && s.id === 'grid'));
  let idx = Math.max(0, list.findIndex((s) => s.id === opts.first));
  const desc = h('div', { class: 'stagedesc' });
  const row = h('div', { class: 'stagerow' });
  const cards = list.map((s, i) => {
    const c = h('div', { class: 'stagecard', style: { backgroundImage: `linear-gradient(160deg, ${s.theme}, #05060a 80%)` } }, h('div', { class: 'nm' }, pick(s, 'name')));
    c.addEventListener('click', () => { idx = i; set(); ok(); });
    c.addEventListener('pointerenter', () => { idx = i; set(true); });
    row.append(c);
    return c;
  });
  const rnd = h('div', { class: 'stagecard', style: { backgroundImage: 'linear-gradient(160deg,#333,#05060a)' } }, h('div', { class: 'nm' }, tr('Random', 'สุ่ม')));
  rnd.addEventListener('click', () => { idx = list.length; set(); ok(); });
  row.append(rnd);
  function set() {
    cards.forEach((c, i) => c.classList.toggle('focus', i === idx)); rnd.classList.toggle('focus', idx === list.length);
    const s = list[idx];
    desc.innerHTML = '';
    desc.append(h('h1', { class: 'title' }, s ? pick(s, 'name') : tr('Random', 'สุ่ม')), h('p', {}, s ? s.desc : tr('A surprise stage.', 'สนามที่ไม่รู้ล่วงหน้า')));
    (cards[idx] || rnd).scrollIntoView({ inline: 'center', block: 'nearest' });
    if (s) { app.setShowcase([{ id: opts.ids?.[0] || app.list[0].id, x: -1.9 }, { id: opts.ids?.[1] || app.list[1].id, x: 1.9 }], { stage: s.id, cam: [0, 1.5, 7.2], look: [0, 1.1, 0], fov: 34 }); }
  }
  function ok() { audio.sfx('ui_select'); const s = list[idx] || list[(Math.random() * list.length) | 0]; onPick(s.id); }
  const el = screen('sel', h('div', { class: 'crumb' }, tr('STAGE SELECT', 'เลือกสนาม')), desc, row, hint(navHint()));
  const scr = { el, nav(ev) { if (ev === 'left') { idx = (idx + list.length) % (list.length + 1); idx = (idx - 1 + list.length + 1) % (list.length + 1); audio.sfx('ui_move'); set(); return true; } if (ev === 'right') { idx = (idx + 1) % (list.length + 1); audio.sfx('ui_move'); set(); return true; } if (ev === 'ok') { ok(); return true; } return false; }, back: onBack || (() => mainMenu(app)) };
  app.ui.push(scr);
  set();
  return scr;
}

// ------------------------------------------------------------------------------ VS splash
export function vsSplash(app, cfg) {
  const [a, b] = cfg.chars.map((id) => app.list.find((c) => c.id === id));
  const st = STAGES.find((s) => s.id === cfg.stage);
  const cfgNames = cfg.names || [pick(a, 'name'), pick(b, 'name')];
  const el = h('div', { class: 'vs' },
    h('div', { class: 'half h1' }, h('div', { class: 'ic', style: { backgroundImage: `url(${app.portrait(a.id)})` } }), h('div', { class: 'who' }, cfg.cpu?.[0] ? 'CPU' : tr('PLAYER 1', 'ผู้เล่น 1')), h('div', { class: 'big' }, cfgNames[0]), h('div', { class: 'ttl' }, a.title)),
    h('div', { class: 'half h2' }, h('div', { class: 'ic', style: { backgroundImage: `url(${app.portrait(b.id)})` } }), h('div', { class: 'who' }, cfg.cpu?.[1] ? tr('CPU', 'คอม') : tr('PLAYER 2', 'ผู้เล่น 2')), h('div', { class: 'big' }, cfgNames[1]), h('div', { class: 'ttl' }, b.title)),
    h('div', { class: 'mid' }, 'VS'),
    h('div', { class: 'stg' }, st ? pick(st, 'name') : ''));
  app.modal = true;
  app.hud.root.classList.add('nohud');
  audio.sfx('ui_select');
  const scr = { el, isVs: true, nav: () => false };
  app.ui.push(scr);
  const done = () => { if (app.ui.top === scr) app.ui.pop(); app.modal = false; app.hud.root.classList.remove('nohud'); app.last = performance.now(); };
  el.addEventListener('click', done);
  setTimeout(done, 2400);
}

// ------------------------------------------------------------------------------ results
export function results(app, res, cfg) {
  app.modal = true;
  app.touch.show(false);
  const w = res.winner;
  const wn = w >= 0 ? res.names[w] : tr('DRAW', 'เสมอ');
  const q = w >= 0 ? QUOTES[res.ids[w]] : null;
  const quote = q ? q[(Math.random() * q.length) | 0] : null;
  const stat = (k, en, th, fmt = (v) => v) => { const a = res.stats[0][k], b = res.stats[1][k]; return h('tr', {}, h('td', { class: a > b ? 'lead' : '' }, fmt(a)), h('td', {}, tr(en, th)), h('td', { class: b > a ? 'lead' : '' }, fmt(b))); };
  audio.playTrack('results');
  const rk = rankOf(save.profile.exp);
  const acts = [];
  const nextItems = cfg.resultActions ? cfg.resultActions(res) : null;
  const el = screen('results dark',
    h('div', { class: 'res-card' },
      h('div', { class: 'res-title' }, w >= 0 ? `${wn} ${tr('WINS', 'ชนะ')}` : wn),
      quote ? h('div', { class: 'res-quote' }, `"${tr(quote[0], quote[1])}"`) : null,
      h('table', { class: 'res-table' },
        h('tr', {}, h('th', {}, res.names[0]), h('th', {}, ''), h('th', {}, res.names[1])),
        h('tr', {}, h('td', { class: res.wins[0] > res.wins[1] ? 'lead' : '' }, res.wins[0]), h('td', {}, tr('Rounds won', 'รอบที่ชนะ')), h('td', { class: res.wins[1] > res.wins[0] ? 'lead' : '' }, res.wins[1])),
        stat('dmg', 'Damage dealt', 'ดาเมจที่ทำได้'), stat('maxCombo', 'Max combo', 'คอมโบสูงสุด'), stat('counters', 'Counter hits', 'ตีสวน'), stat('punishes', 'Punishes', 'ลงโทษ'),
        stat('throws', 'Throws', 'จับทุ่ม'), stat('walls', 'Wall splats', 'ติดกำแพง'), stat('heats', 'Heat used', 'ใช้ Heat'), stat('rages', 'Rage Arts', 'Rage Art')),
      res.fm ? h('div', { class: 'reward' }, `+${res.fm} FM  ·  +${res.exp} EXP  ·  ${tr('Rank', 'แรงก์')}: ${tr(rk.en, rk.th)}`) : null,
      h('div', { class: 'res-actions' }, ...(nextItems || defaultResultActions(app, res, cfg)))));
  const btns = [...el.querySelectorAll('.btn')];
  let idx = 0;
  const foc = () => btns.forEach((b, i) => b.classList.toggle('focus', i === idx));
  const scr = { el, nav(ev) { if (ev === 'left' || ev === 'up') { idx = (idx - 1 + btns.length) % btns.length; foc(); audio.sfx('ui_move'); return true; } if (ev === 'right' || ev === 'down') { idx = (idx + 1) % btns.length; foc(); audio.sfx('ui_move'); return true; } if (ev === 'ok') { audio.sfx('ui_ok'); btns[idx].click(); return true; } return false; }, back() {} };
  app.ui.push(scr);
  foc();
  void acts;
}

function defaultResultActions(app, res, cfg) {
  const close = () => { app.modal = false; };
  const b = (label, fn, cls = '') => h('div', { class: 'btn ' + cls, onClick: () => { close(); fn(); } }, h('span', {}, label));
  return [
    b(tr('Rematch', 'แข่งใหม่'), () => { app.ui.clear(); app.startMatch({ ...cfg, showVs: true, seed: undefined }); }),
    b(tr('Character Select', 'เลือกตัวละคร'), () => { app.stopMatch(); app.ui.clear(); (cfg.reselect || (() => mainMenu(app)))(); }),
    b(tr('Main Menu', 'เมนูหลัก'), () => { app.ui.clear(); app.quitToMenu(); }, 'danger'),
  ];
}

// ------------------------------------------------------------------------------ pause
export function pauseMenu(app) {
  const cfg = app.cfg;
  const close = () => { app.ui.pop(); app.resume(); };
  const items = [];
  items.push({ label: tr('Resume', 'เล่นต่อ'), ok: close });
  if (cfg.replay) {
    items.push({ label: tr('Quit Replay', 'ออกจากรีเพลย์'), ok: () => app.quitToMenu() });
  } else {
    if (cfg.practice) {
      const dummy = app.dummy;
      const modes = ['stand', 'crouch', 'jump', 'block', 'blocklow', 'blockrand', 'blockfirst', 'techroll', 'cpu', 'playback'];
      const names = { stand: tr('Stand', 'ยืนเฉยๆ'), crouch: tr('Crouch', 'ย่อ'), jump: tr('Jump', 'กระโดด'), block: tr('Block all', 'บล็อกทั้งหมด'), blocklow: tr('Crouch block', 'ย่อบล็อก'), blockrand: tr('Random block', 'บล็อกสุ่ม'), blockfirst: tr('Block after 1st hit', 'บล็อกหลังโดนฮิตแรก'), techroll: tr('Tech roll', 'ม้วนตัวตั้งหลัก'), cpu: tr('CPU', 'คอม'), playback: tr('Playback', 'เล่นซ้ำ') };
      items.push({ label: tr('Dummy', 'หุ่นซ้อม'), val: () => names[dummy.mode], left: () => { dummy.setMode(modes[(modes.indexOf(dummy.mode) + modes.length - 1) % modes.length]); }, right: () => { dummy.setMode(modes[(modes.indexOf(dummy.mode) + 1) % modes.length]); } });
      items.push({ label: tr('CPU level', 'ระดับคอม'), val: () => LEVELS[Math.round(dummy.cpu.level)].name, left: () => dummy.setLevel(dummy.cpu.level - 1), right: () => dummy.setLevel(dummy.cpu.level + 1) });
      const R = app.match.rules;
      const tog = (k, en, th, get, set) => items.push({ label: tr(en, th), val: () => (get() ? tr('ON', 'เปิด') : tr('OFF', 'ปิด')), ok: () => set(!get()), left: () => set(!get()), right: () => set(!get()) });
      tog('infHp', 'Infinite health', 'พลังชีวิตไม่จำกัด', () => !!R.infHp, (v) => { R.infHp = v; });
      tog('infHeat', 'Infinite Heat', 'Heat ไม่จำกัด', () => !!R.infHeat, (v) => { R.infHeat = v; });
      tog('infRage', 'Always Rage', 'Rage ตลอดเวลา', () => !!R.infRage, (v) => { R.infRage = v; });
      tog('fd', 'Frame data', 'เฟรมดาต้า', () => !app.hud.root.classList.contains('hide-fd'), (v) => app.hud.root.classList.toggle('hide-fd', !v));
      tog('il', 'Input display', 'แสดงปุ่มที่กด', () => !app.hud.root.classList.contains('hide-il'), (v) => app.hud.root.classList.toggle('hide-il', !v));
      tog('hb', 'Hitboxes', 'แสดงฮิตบ็อกซ์', () => !!app.gv.hitboxes, (v) => app.gv.setHitboxes(v));
      items.push({ label: tr('Reset positions', 'รีเซ็ตตำแหน่ง'), ok: () => { app.practiceReset(false); close(); } });
      items.push({ label: tr('Swap sides', 'สลับฝั่ง'), ok: () => { app.practiceReset(true); close(); } });
      items.push({ label: () => (app.practiceRec?.active ? tr('Stop recording', 'หยุดบันทึก') : tr('Record dummy', 'บันทึกหุ่นซ้อม')), ok: () => { if (app.practiceRec.active) app.stopPracticeRecord(); else app.startPracticeRecord(); close(); } });
      if (dummy.tape && dummy.tape.length) items.push({ label: tr('Play recording', 'เล่นบันทึก'), ok: () => { dummy.setMode('playback'); close(); } });
    }
    items.push({ label: tr('Controls', 'วิธีเล่น / ปุ่ม'), ok: () => helpScreen(app, true) });
    items.push({ label: tr('Command List', 'รายการท่า'), ok: () => M.moveList(app, app.match.fighters[0].ch.id, () => { app.ui.pop(); }, true) });
    if (cfg.tutorial) items.push({ label: tr('Lessons', 'บทเรียน'), ok: () => { app.ui.pop(); app.stopMatch(); lessonMenu(app); } });
    items.push({ label: tr('Restart', 'เริ่มใหม่'), ok: () => { app.ui.clear(); app.restartMatch(); } });
    items.push({ label: tr('Options', 'ตั้งค่า'), ok: () => optionsScreen(app, true) });
    items.push({ label: tr('Quit to Menu', 'ออกสู่เมนู'), ok: () => { app.ui.clear(); app.quitToMenu(); } });
  }
  const list = new MenuList(items);
  const el = screen('dark', h('div', { class: 'dialog' }, h('h2', {}, tr('Paused', 'หยุดชั่วคราว')), list.el), hint(navHint()));
  const scr = { el, nav: (ev) => list.nav(ev), back: close, overlay: true };
  app.ui.push(scr);
}

// ------------------------------------------------------------------------------ options
const ROUNDS = [1, 2, 3];
const TIMES = [30, 60, 99, 0];
export function optionsScreen(app, fromPause) {
  const s = save.settings;
  let tab = 0;
  const tabs = [tr('Game', 'เกม'), tr('Video', 'ภาพ'), tr('Audio', 'เสียง'), tr('Controls', 'ปุ่มควบคุม'), tr('Language', 'ภาษา'), tr('Data', 'ข้อมูล')];
  const cycle = (arr, v, d) => arr[(arr.indexOf(v) + d + arr.length) % arr.length];
  const onoff = (k) => ({ val: () => (s[k] ? tr('ON', 'เปิด') : tr('OFF', 'ปิด')), ok: () => { s[k] = !s[k]; apply(); }, left: () => { s[k] = !s[k]; apply(); }, right: () => { s[k] = !s[k]; apply(); } });
  const slider = (k, en, th) => ({ label: tr(en, th), val: () => Math.round(s[k] * 100) + '%', left: () => { s[k] = Math.max(0, Math.round((s[k] - 0.05) * 100) / 100); apply(); audio.sfx('hit_light'); }, right: () => { s[k] = Math.min(1, Math.round((s[k] + 0.05) * 100) / 100); apply(); audio.sfx('hit_light'); } });
  function apply() { save.write(); app.applySettings(); }
  const rebindItems = (who) => {
    const names = { u: tr('Up / sidestep', 'บน / สเต็ป'), d: tr('Down / crouch', 'ล่าง / ย่อ'), l: tr('Left', 'ซ้าย'), r: tr('Right', 'ขวา'), b1: tr('Left Punch (1)', 'หมัดซ้าย (1)'), b2: tr('Right Punch (2)', 'หมัดขวา (2)'), b3: tr('Left Kick (3)', 'เตะซ้าย (3)'), b4: tr('Right Kick (4)', 'เตะขวา (4)'), m12: '1+2 (Rage Art)', m13: '1+3 (' + tr('Throw', 'จับทุ่ม') + ')', m24: '2+4 (' + tr('Throw', 'จับทุ่ม') + ')', m23: '2+3 (HEAT)', m34: '3+4', m14: '1+4' };
    return Object.keys(names).map((a) => ({ label: names[a], val: () => (rebind && rebind.k === who + a ? tr('Press a key...', 'กดปุ่ม...') : (input.binds[who][a] || []).map((c) => c.replace('Key', '').replace('Digit', '').replace('Arrow', '')).join(' / ')), ok: (list) => { rebind = { k: who + a }; list.refresh(); input.rebinding = (code) => { input.binds[who][a] = [code]; s.binds = JSON.parse(JSON.stringify(input.binds)); save.write(); rebind = null; list.refresh(); audio.sfx('ui_ok'); }; } }));
  };
  let rebind = null;
  const build = () => {
    switch (tab) {
      case 0: return [
        { label: tr('Rounds to win', 'จำนวนรอบที่ต้องชนะ'), val: () => s.rounds, left: () => { s.rounds = cycle(ROUNDS, s.rounds, -1); apply(); }, right: () => { s.rounds = cycle(ROUNDS, s.rounds, 1); apply(); } },
        { label: tr('Round time', 'เวลาต่อรอบ'), val: () => (s.time ? s.time + 's' : '∞'), left: () => { s.time = cycle(TIMES, s.time, -1); apply(); }, right: () => { s.time = cycle(TIMES, s.time, 1); apply(); } },
        { label: tr('CPU difficulty', 'ความยากของคอม'), val: () => LEVELS[s.difficulty].name, left: () => { s.difficulty = Math.max(0, s.difficulty - 1); apply(); }, right: () => { s.difficulty = Math.min(5, s.difficulty + 1); apply(); } },
        { label: tr('Heat system', 'ระบบ Heat'), ...onoff('heat') },
        { label: tr('Rage system', 'ระบบ Rage'), ...onoff('rage') },
        { label: tr('Recoverable health', 'พลังชีวิตที่ฟื้นได้'), ...onoff('recoverable') },
        { label: tr('Tech rolls (ukemi)', 'ม้วนตัวตั้งหลัก'), ...onoff('tech') },
        { label: tr('Damage multiplier', 'ตัวคูณดาเมจ'), val: () => 'x' + s.dmgMul, left: () => { s.dmgMul = Math.max(0.5, Math.round((s.dmgMul - 0.25) * 100) / 100); apply(); }, right: () => { s.dmgMul = Math.min(3, Math.round((s.dmgMul + 0.25) * 100) / 100); apply(); } },
      ];
      case 1: return [
        { label: tr('Graphics quality', 'คุณภาพกราฟิก'), val: () => [tr('Low', 'ต่ำ'), tr('Medium', 'กลาง'), tr('High', 'สูง')][s.quality], left: () => { s.quality = Math.max(0, s.quality - 1); apply(); }, right: () => { s.quality = Math.min(2, s.quality + 1); apply(); } },
        { label: tr('Fullscreen', 'เต็มจอ'), val: () => (document.fullscreenElement ? tr('ON', 'เปิด') : tr('OFF', 'ปิด')), ok: () => { app.toggleFullscreen(); setTimeout(() => list && list.refresh(), 350); }, left: () => { app.toggleFullscreen(); setTimeout(() => list && list.refresh(), 350); }, right: () => { app.toggleFullscreen(); setTimeout(() => list && list.refresh(), 350); } },
        { label: tr('Camera shake', 'กล้องสั่น'), ...onoff('shake') },
        { label: tr('FPS counter', 'แสดง FPS'), ...onoff('fps') },
        { label: tr('Touch controls', 'ปุ่มสัมผัส'), val: () => ({ auto: tr('Auto', 'อัตโนมัติ'), on: tr('Always on', 'เปิดตลอด'), off: tr('Off', 'ปิด') }[s.touch]), left: () => { s.touch = cycle(['auto', 'on', 'off'], s.touch, -1); apply(); }, right: () => { s.touch = cycle(['auto', 'on', 'off'], s.touch, 1); apply(); } },
      ];
      case 2: return [slider('master', 'Master volume', 'เสียงรวม'), slider('music', 'Music', 'ดนตรี'), slider('sfx', 'Sound effects', 'เสียงเอฟเฟกต์'), slider('voice', 'Announcer volume', 'เสียงผู้ประกาศ'), { label: tr('Announcer', 'ผู้ประกาศ'), ...onoff('announcer') }];
      case 3: return [...rebindItems('p1').map((x) => ({ ...x, label: 'P1 · ' + x.label })), ...rebindItems('p2').map((x) => ({ ...x, label: 'P2 · ' + x.label })), { label: tr('Reset controls to default', 'คืนค่าปุ่มเริ่มต้น'), ok: () => { input.binds = JSON.parse(JSON.stringify(DEFAULT_BINDS)); s.binds = null; save.write(); toast(tr('Controls reset', 'คืนค่าปุ่มแล้ว')); } }];
      case 4: return [{ label: 'English', ok: () => { setLang('en'); s.lang = 'en'; save.write(); optionsScreen(app, fromPause); app.ui.stack.splice(app.ui.stack.length - 2, 1)[0]?.el.remove(); } }, { label: 'ภาษาไทย', ok: () => { setLang('th'); s.lang = 'th'; save.write(); optionsScreen(app, fromPause); app.ui.stack.splice(app.ui.stack.length - 2, 1)[0]?.el.remove(); } }];
      default: return [
        { label: tr('Reset ALL saved data', 'ล้างข้อมูลทั้งหมด'), sub: tr('Deletes profile, replays, customization and settings', 'ลบโปรไฟล์ รีเพลย์ การปรับแต่ง และตั้งค่า'), cls: '', ok: () => { save.reset(); toast(tr('All data reset', 'ล้างข้อมูลแล้ว')); app.applySettings(); } },
        { label: tr('Delete replays', 'ลบรีเพลย์'), ok: () => { save.data.replays = []; save.write(); toast(tr('Replays deleted', 'ลบรีเพลย์แล้ว')); } },
      ];
    }
  };
  let list = null;
  const wrap = h('div', { class: 'opt-wrap' });
  const tabEl = h('div', { class: 'tabs' });
  const holder = h('div', { class: 'opt-list' });
  const rebuild = () => {
    tabEl.innerHTML = '';
    tabs.forEach((t, i) => tabEl.append(h('div', { class: 'tab' + (i === tab ? ' on' : ''), onClick: () => { tab = i; rebuild(); audio.sfx('ui_move'); } }, h('span', {}, t))));
    list = new MenuList(build(), { cls: 'menu-list' });
    list.el.style.width = '100%'; list.el.style.maxHeight = '60vh';
    list.el.querySelectorAll('.mi').forEach((n) => { n.style.fontSize = '1.05em'; });
    holder.innerHTML = ''; holder.append(list.el);
  };
  wrap.append(h('h1', { class: 'title', style: { fontSize: '1.8em', marginBottom: '.3em' } }, tr('Options', 'ตั้งค่า')), tabEl, holder);
  rebuild();
  const el = screen('dark', wrap, hint(tr(`${kbd('←→')} Change &nbsp; ${kbd('Q')}/${kbd('E')} Tab &nbsp; ${kbd('Esc')} Back`, `${kbd('←→')} เปลี่ยนค่า &nbsp; ${kbd('Q')}/${kbd('E')} เปลี่ยนแท็บ &nbsp; ${kbd('Esc')} ย้อนกลับ`)));
  const scr = {
    el, overlay: !!fromPause,
    nav(ev) {
      if (ev === 'tabL') { tab = (tab + tabs.length - 1) % tabs.length; rebuild(); audio.sfx('ui_move'); return true; }
      if (ev === 'tabR') { tab = (tab + 1) % tabs.length; rebuild(); audio.sfx('ui_move'); return true; }
      return list.nav(ev);
    },
    back() { input.rebinding = null; save.write(); if (fromPause) app.ui.pop(); else { app.ui.pop(); if (!app.ui.top) mainMenu(app); } },
  };
  app.ui.push(scr);
}

// ------------------------------------------------------------------------------ how to play
const ARROWS = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' };
const keyName = (c) => ARROWS[c] || (c || '').replace(/^Key/, '').replace(/^Digit/, '').replace('Numpad', 'Num ').replace('Comma', ',').replace('Period', '.').replace('Slash', '/').replace('ShiftRight', 'R-Shift');
export function helpScreen(app, fromPause) {
  const B = input.binds;
  const ks = (who, a) => (B[who][a] || []).map(keyName).join('  or  ');
  const row = (label, p1, p2, pad) => h('tr', {}, h('th', {}, label), h('td', {}, p1), h('td', {}, p2), h('td', {}, pad));
  const table = h('table', { class: 'help-tbl' },
    h('tr', {}, h('th', {}), h('td', { class: 'hd' }, tr('Player 1', 'ผู้เล่น 1')), h('td', { class: 'hd' }, tr('Player 2', 'ผู้เล่น 2')), h('td', { class: 'hd' }, tr('Gamepad', 'จอยเกม'))),
    row(tr('Move ← →', 'เดิน ← →'), `${ks('p1', 'l')} ${ks('p1', 'r')}`, `${ks('p2', 'l')} ${ks('p2', 'r')}`, 'D-pad / L-stick'),
    row(tr('Up / Down', 'ขึ้น / ลง'), `${ks('p1', 'u')} ${ks('p1', 'd')}`, `${ks('p2', 'u')} ${ks('p2', 'd')}`, ''),
    row(tr('1 Left Punch', '1 หมัดซ้าย'), ks('p1', 'b1'), ks('p2', 'b1'), 'X'),
    row(tr('2 Right Punch', '2 หมัดขวา'), ks('p1', 'b2'), ks('p2', 'b2'), 'Y'),
    row(tr('3 Left Kick', '3 เตะซ้าย'), ks('p1', 'b3'), ks('p2', 'b3'), 'A'),
    row(tr('4 Right Kick', '4 เตะขวา'), ks('p1', 'b4'), ks('p2', 'b4'), 'B'),
    row(tr('Heat 2+3', 'Heat 2+3'), ks('p1', 'm23'), ks('p2', 'm23'), 'RT'),
    row(tr('Rage Art 1+2', 'Rage Art 1+2'), ks('p1', 'm12'), ks('p2', 'm12'), 'LT'),
    row(tr('Throw 1+3 / 2+4', 'จับทุ่ม 1+3 / 2+4'), `${ks('p1', 'm13')} / ${ks('p1', 'm24')}`, `${ks('p2', 'm13')} / ${ks('p2', 'm24')}`, 'LB / RB'),
    row(tr('Pause', 'หยุดเกม'), 'Esc / Tab', '', 'Start'));
  const tips = [
    [tr('Move & defend', 'เคลื่อนที่และป้องกัน'), tr('Tap forward twice to dash. Tap up or down to sidestep around attacks. Hold BACK to block; hold DOWN+BACK to block low attacks.', 'กดหน้าสองครั้งเพื่อแดช กดขึ้นหรือลงเพื่อสเต็ปหลบข้าง กดถอยหลังเพื่อบล็อก กด ↙ เพื่อบล็อกท่าล่าง')],
    [tr('High / mid / low', 'บน / กลาง / ล่าง'), tr('Highs miss a crouching enemy, lows must be blocked crouching, mids beat crouch-blocking. Check the level of every move in the Command List.', 'ท่าบนพลาดถ้าคู่ต่อสู้ย่อ ท่าล่างต้องบล็อกแบบย่อ ท่ากลางทะลวงการย่อ ดูระดับของทุกท่าได้ในรายการท่า')],
    [tr('Throws', 'จับทุ่ม'), tr('Throws beat blocking but can be ducked. When grabbed, press 1 (1+3 throws) or 2 (2+4 throws) quickly to break free.', 'จับทุ่มชนะการบล็อกแต่ย่อหลบได้ เมื่อโดนจับให้กด 1 (ท่า 1+3) หรือ 2 (ท่า 2+4) ให้ทันเพื่อสลัดหลุด')],
    [tr('Launch & combo', 'ส่งลอยและคอมโบ'), tr('Launchers (e.g. d/f+2) send the enemy airborne: keep hitting while they fly. Strong moves near a wall cause a wall splat for extra combos.', 'ท่าส่งลอย (เช่น d/f+2) ทำให้ศัตรูลอย ตามตีต่อได้ ท่าแรงๆ ใกล้กำแพงจะทำให้ติดกำแพงเพื่อต่อคอมโบ')],
    [tr('Heat & Rage', 'Heat และ Rage'), tr('Heat (2+3) powers you up for a few seconds with chip damage and Heat Dash. At low health you enter Rage: 1+2 unleashes a Rage Art.', 'Heat (2+3) เพิ่มพลังชั่วคราว ทำดาเมจแม้ถูกบล็อก และใช้ Heat Dash ได้ เมื่อเลือดต่ำจะเข้าสู่ Rage กด 1+2 เพื่อใช้ Rage Art')],
    [tr('Learn more', 'เรียนรู้เพิ่มเติม'), tr('Tutorial teaches everything step by step. Practice shows frame data and hitboxes. Every fighter has 50+ moves: open the Command List from the pause menu.', 'โหมดสอนเล่นสอนทุกอย่างทีละขั้น โหมดฝึกซ้อมแสดงเฟรมดาต้าและฮิตบ็อกซ์ ตัวละครละ 50+ ท่า เปิดรายการท่าได้จากเมนูพัก')],
  ];
  const back = () => { if (fromPause) app.ui.pop(); else { app.ui.pop(); if (!app.ui.top) mainMenu(app); } };
  const panel = h('div', { class: 'help' },
    h('h1', { class: 'title', style: { fontSize: '1.8em', marginBottom: '.3em' } }, tr('How to Play', 'วิธีเล่น')),
    h('div', { class: 'help-grid' }, table, h('div', { class: 'help-tips' }, ...tips.map(([t, d]) => h('div', { class: 'tip' }, h('b', {}, t), h('p', {}, d))))),
    h('div', { class: 'btn help-back', onClick: () => { audio.sfx('ui_back'); back(); } }, h('span', {}, tr('Back', 'กลับ'))));
  const el = screen('dark', panel, hint(navHint()));
  app.ui.push({ el, nav: (ev) => { if (ev === 'ok') { back(); return true; } return false; }, back, overlay: !!fromPause });
}

// ------------------------------------------------------------------------------ credits
export function creditsScreen(app) {
  const el = screen('dark', h('div', { class: 'dialog', style: { textAlign: 'center' } },
    h('h1', { class: 'title' }, 'EFC'),
    h('p', {}, tr('Elite Fighters Championship — a browser 3D fighting game.', 'Elite Fighters Championship เกมต่อสู้ 3 มิติบนเบราว์เซอร์')),
    h('p', { style: { opacity: 0.8 } }, tr('4-button 3D fighting with Heat, Rage, wall combos, juggles, throws, frame data, 10 fighters, 9 stages, story, arcade, survival, ghost AI, practice, replays and more.', 'ต่อสู้ 3 มิติสี่ปุ่ม พร้อม Heat, Rage, คอมโบกำแพง, ลอยตัว, จับทุ่ม, เฟรมดาต้า นักสู้ 10 ตัว 9 สนาม เนื้อเรื่อง อาร์เคด เอาชีวิตรอด AI ผี โหมดซ้อม รีเพลย์ และอื่นๆ')),
    h('p', { style: { opacity: 0.7, fontSize: '.85em' } }, tr('All characters, names and stages are original creations. Built with Three.js and Web Audio.', 'ตัวละคร ชื่อ และสนามทั้งหมดเป็นงานออริจินัล สร้างด้วย Three.js และ Web Audio')),
    h('div', { class: 'btn focus', onClick: () => mainMenu(app) }, h('span', {}, tr('Back', 'กลับ')))));
  app.ui.push({ el, nav: (ev) => { if (ev === 'ok') { mainMenu(app); return true; } return false; }, back: () => mainMenu(app) });
}

// ------------------------------------------------------------------------------ replays
export function replayScreen(app) {
  app.ui.clear();
  const reps = save.data.replays;
  const items = reps.length ? reps.map((r) => ({
    label: `${r.names[0]}  vs  ${r.names[1]}`,
    sub: `${new Date(r.date).toLocaleString()} · ${r.wins[0]}-${r.wins[1]} · ${(r.n / 2 / 60).toFixed(0)}s`,
    ok: () => { app.ui.clear(); app.startReplay(r); },
  })) : [{ label: tr('No replays yet — play a match first.', 'ยังไม่มีรีเพลย์ ลองเล่นสักแมตช์ก่อน'), disabled: true }];
  const list = new MenuList(items);
  const el = screen('menu-screen veil', h('h1', { class: 'title' }, tr('Replays', 'รีเพลย์')), list.el, hint(navHint()));
  app.ui.push({ el, nav: (ev) => list.nav(ev), back: () => mainMenu(app) });
}

// ------------------------------------------------------------------------------ story dialogue
export function dialogue(app, lines, onDone, opts = {}) {
  let i = 0;
  const box = h('div', { class: 'story-box' });
  const bg = h('div', { style: { position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(0,0,0,.2), rgba(0,0,0,.75))', pointerEvents: 'none' } });
  const portrait = h('div', { style: { position: 'absolute', bottom: '18vh', width: '32vh', height: '32vh', backgroundSize: 'cover', backgroundPosition: 'center', border: '.2em solid var(--c, #ffc94a)', boxShadow: '0 0 2em rgba(0,0,0,.8)', display: 'none' } });
  let typing = null;
  const el = screen('', bg, portrait, box);
  function show() {
    const ln = lines[i];
    const ch = app.list.find((c) => c.id === ln.who);
    box.style.setProperty('--c', ch ? (ch.body.glow || '#ffc94a') : '#ffc94a');
    portrait.style.setProperty('--c', ch ? (ch.body.glow || '#ffc94a') : '#ffc94a');
    if (ch) {
      portrait.style.display = 'block'; portrait.style.backgroundImage = `url(${app.portrait(ch.id)})`;
      const right = lines.slice(0, i).some((l) => l.who !== ln.who && l.who !== 'narr') || opts.side === 1;
      portrait.style.left = ln.who === opts.hero ? '6vw' : 'auto'; portrait.style.right = ln.who === opts.hero ? 'auto' : '6vw';
      void right;
    } else portrait.style.display = 'none';
    const txt = tr(ln.en, ln.th);
    box.innerHTML = '';
    const t = h('div', { class: 'txt' });
    box.append(h('div', { class: 'spk' }, ch ? pick(ch, 'name') : tr('Narrator', 'ผู้เล่าเรื่อง')), t, h('div', { class: 'nx' }, '▶'));
    let n = 0; clearInterval(typing);
    typing = setInterval(() => { n += 2; t.textContent = txt.slice(0, n); if (n >= txt.length) { clearInterval(typing); typing = null; } }, 22);
    box._full = txt; box._t = t;
  }
  function next() {
    if (typing) { clearInterval(typing); typing = null; box._t.textContent = box._full; return; }
    i++;
    audio.sfx('ui_move');
    if (i >= lines.length) { app.ui.pop(); onDone(); return; }
    show();
  }
  el.addEventListener('click', next);
  const scr = { el, nav: (ev) => { if (ev === 'ok') { next(); return true; } return false; }, back: () => { clearInterval(typing); app.ui.pop(); onDone(); }, overlay: true };
  app.ui.push(scr);
  show();
}

export function chapterCard(app, titleText, body, onDone) {
  const el = screen('chapter', h('h1', { class: 'title' }, titleText), body ? h('p', {}, body) : null, h('div', { class: 'press' }, tr('Press any button', 'กดปุ่มใดก็ได้')));
  const go = () => { app.ui.pop(); onDone(); };
  el.addEventListener('click', go);
  app.ui.push({ el, nav: (ev) => { if (ev === 'ok' || ev === 'back') { go(); return true; } return false; }, back: go, overlay: true });
  audio.sfx('round');
}

// ------------------------------------------------------------------------------ tutorial
export function lessonMenu(app) {
  app.ui.clear();
  const items = LESSONS.map((L, i) => ({ label: `${i + 1}. ${L.title()}`, sub: () => L.text().slice(0, 78) + '…', ok: () => M.tutorial(app, i) }));
  const list = new MenuList(items);
  const el = screen('menu-screen veil', h('h1', { class: 'title' }, tr('Tutorial', 'สอนเล่น')), h('h2', { class: 'sub' }, tr('Pick a lesson', 'เลือกบทเรียน')), list.el, hint(navHint()));
  app.ui.push({ el, nav: (ev) => list.nav(ev), back: () => mainMenu(app) });
  app.setShowcase([{ id: 'kenzo', x: -1.9 }, { id: 'marcus', x: 1.9 }], { stage: 'grid', cam: [0, 1.5, 7.2], look: [0, 1.1, 0], fov: 34 });
}

export function tutorialPanel(app) {
  const t = app.tut;
  const el = h('div', { class: 'tut' }, h('h3', {}, `${tr('Lesson', 'บทเรียน')} ${t.i + 1}/${LESSONS.length} · ${t.L.title()}`), h('p', {}, t.L.text()), h('div', { class: 'prog' }, h('i')));
  const bar = el.querySelector('.prog i');
  let old = document.querySelector('.tut'); if (old) old.remove();
  document.getElementById('hud').append(el);
  el.style.pointerEvents = 'none';
  const tick = setInterval(() => {
    if (app.tut !== t || !app.match) { clearInterval(tick); el.remove(); return; }
    if (app.paused || app.modal) return;
    const prog = app.tutorialTick();
    bar.style.width = Math.min(100, (prog / t.L.goal) * 100) + '%';
    if (t.done && !t.notified) { t.notified = true; el.classList.add('done'); el.querySelector('h3').textContent = tr('Lesson complete!', 'ผ่านบทเรียน!'); el.querySelector('p').textContent = tr('Press Enter (or tap) for the next lesson.', 'กด Enter (หรือแตะ) เพื่อไปบทถัดไป'); setTimeout(() => lessonComplete(app, t), 900); }
  }, 1000 / 60);
}

function lessonComplete(app, t) {
  if (app.tut !== t) return;
  app.modal = true;
  const last = t.i >= LESSONS.length - 1;
  const items = [
    { label: last ? tr('Finish tutorial', 'จบบทเรียน') : tr('Next lesson', 'บทถัดไป'), ok: () => { app.ui.pop(); app.modal = false; if (last) { app.quitToMenu(); } else { app.cfg.tutorial.index = t.i + 1; app.startLesson(t.i + 1); } } },
    { label: tr('Repeat lesson', 'ทำซ้ำ'), ok: () => { app.ui.pop(); app.modal = false; app.startLesson(t.i); } },
    { label: tr('Lesson list', 'รายการบทเรียน'), ok: () => { app.ui.clear(); app.modal = false; app.stopMatch(); lessonMenu(app); } },
  ];
  const list = new MenuList(items);
  const el = screen('dark', h('div', { class: 'dialog' }, h('h2', {}, tr('Lesson complete!', 'ผ่านบทเรียน!')), list.el));
  app.ui.push({ el, nav: (ev) => list.nav(ev), back: () => {}, overlay: true });
}

export { fmtAdv, lvName, ST };
