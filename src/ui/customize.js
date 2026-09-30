// Costume / colour customization with a live 3D preview.
import { h, MenuList, toast } from './kit.js';
import { tr, pick } from './i18n.js';
import { save } from '../game/save.js';
import { audio } from '../audio/audio.js';
import { CHARS } from '../data/roster.js';
import * as S from './screens.js';

export function customizeScreen(app) {
  app.ui.clear();
  let idx = Math.max(0, CHARS.findIndex((c) => c.id === save.data.lastChar));
  const el = h('div', { class: 'screen cust' });
  const panel = h('div', { class: 'cust-panel' });
  el.append(h('div', { class: 'crumb' }, tr('CUSTOMIZE', 'ปรับแต่งตัวละคร')), panel, h('div', { class: 'hint' }, tr('Q/E: fighter · ←→: costume · click colours to edit', 'Q/E: เปลี่ยนตัวละคร · ←→: เปลี่ยนชุด · คลิกช่องสีเพื่อแก้ไข')));
  let list = null;
  const get = () => (save.data.custom[CHARS[idx].id] ||= { alt: 0, custom: null });

  function preview() {
    const ch = CHARS[idx], c = get();
    app.setShowcase([{ id: ch.id, x: -1.6, alt: c.alt, custom: c.alt === (ch.alts || []).length + 1 ? c.custom : null }], { stage: 'rooftop', orbit: 0.25, radius: 5.6, height: 1.5, center: [-1.6, 0], look: [-1.6, 1.05, 0], fov: 34 });
    app.showcasePose(0, 'intro');
  }
  function colorRow(labelText, path) {
    const ch = CHARS[idx];
    const c = get();
    const base = ch.body;
    const cur = () => {
      const cu = c.custom || {};
      const get2 = (o, p) => p.reduce((a, k) => (a ? a[k] : undefined), o);
      return get2(cu, path) || get2(base, path) || '#888888';
    };
    const input = h('input', { type: 'color', value: toHex(cur()) });
    input.addEventListener('input', () => {
      c.custom = c.custom || {};
      let o = c.custom;
      path.slice(0, -1).forEach((k) => { o[k] = o[k] || {}; o = o[k]; });
      o[path[path.length - 1]] = input.value;
      c.alt = (ch.alts || []).length + 1;
      preview();
    });
    input.addEventListener('change', () => save.write());
    return h('div', { class: 'row' }, h('div', { class: 'lab' }, labelText), h('div', { class: 'ctl' }, input));
  }
  function toHex(v) { return /^#[0-9a-f]{6}$/i.test(v) ? v : '#888888'; }
  function build() {
    const ch = CHARS[idx], c = get();
    panel.innerHTML = '';
    const names = [tr('Default', 'ปกติ'), ...(ch.alts || []).map((a) => a.name), tr('Custom', 'กำหนดเอง')];
    panel.append(h('h1', { class: 'title', style: { fontSize: '1.7em' } }, pick(ch, 'name')), h('div', { style: { color: 'var(--gold)', marginBottom: '.6em' } }, `${ch.title} · ${pick(ch, 'style')}`));
    const items = [
      { label: tr('Fighter', 'ตัวละคร'), val: () => pick(ch, 'name'), left: () => { idx = (idx + CHARS.length - 1) % CHARS.length; build(); preview(); }, right: () => { idx = (idx + 1) % CHARS.length; build(); preview(); } },
      { label: tr('Costume', 'ชุด'), val: () => names[Math.min(c.alt, names.length - 1)], left: () => { c.alt = (c.alt + names.length - 1) % names.length; save.write(); build(); preview(); }, right: () => { c.alt = (c.alt + 1) % names.length; save.write(); build(); preview(); } },
      { label: tr('Reset custom colours', 'รีเซ็ตสีที่กำหนดเอง'), ok: () => { c.custom = null; c.alt = 0; save.write(); toast(tr('Reset', 'รีเซ็ตแล้ว')); build(); preview(); } },
      { label: tr('Save & back', 'บันทึกและกลับ'), ok: () => { save.data.lastChar = ch.id; save.write(); S.mainMenu(app); } },
    ];
    list = new MenuList(items);
    list.el.style.width = '100%';
    panel.append(list.el, colorRow(tr('Outfit colour', 'สีชุดหลัก'), ['top', 'color']), colorRow(tr('Outfit trim', 'สีขอบชุด'), ['top', 'trim']), colorRow(tr('Trousers / shorts', 'สีกางเกง'), ['bottom', 'color']), colorRow(tr('Hair', 'สีผม'), ['hair', 'color']), colorRow(tr('Skin', 'สีผิว'), ['skin']));
    panel.append(h('div', { style: { opacity: 0.6, fontSize: '.8em', marginTop: '.6em' } }, `${tr('Fight Money', 'เงินต่อสู้')}: ${save.profile.fm} FM`));
  }
  const scr = {
    el,
    nav(ev) {
      if (ev === 'tabL') { idx = (idx + CHARS.length - 1) % CHARS.length; build(); preview(); audio.sfx('ui_move'); return true; }
      if (ev === 'tabR') { idx = (idx + 1) % CHARS.length; build(); preview(); audio.sfx('ui_move'); return true; }
      return list.nav(ev);
    },
    back() { save.write(); S.mainMenu(app); },
  };
  app.ui.push(scr);
  build();
  preview();
}
