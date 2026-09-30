// Tiny UI toolkit: element helper, focusable menu list, screen stack with gamepad/keyboard navigation.
import { audio } from '../audio/audio.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}

// Vertical menu with focus handling. items: [{ label, sub, val(), ok(), left(), right(), disabled, cls }]
export class MenuList {
  constructor(items, opts = {}) {
    this.items = items;
    this.idx = opts.start ?? 0;
    this.opts = opts;
    this.el = h('div', { class: opts.cls || 'menu-list' });
    this.render();
  }

  render() {
    this.el.innerHTML = '';
    this.nodes = this.items.map((it, i) => {
      const n = h('div', { class: 'mi' + (it.disabled ? ' off' : '') + (it.cls ? ' ' + it.cls : '') },
        h('span', {}, typeof it.label === 'function' ? it.label() : it.label, it.val ? h('span', { class: 'val' }, it.val()) : null, it.sub ? h('small', {}, typeof it.sub === 'function' ? it.sub() : it.sub) : null));
      n.addEventListener('pointerenter', () => { if (this.idx !== i) { this.setIdx(i, true); } });
      n.addEventListener('click', (e) => { e.stopPropagation(); this.setIdx(i, true); this.activate(); });
      this.el.append(n);
      return n;
    });
    this.applyFocus();
  }

  refresh() {
    this.items.forEach((it, i) => {
      const n = this.nodes[i];
      const val = n.querySelector('.val');
      if (val && it.val) val.textContent = it.val();
      const lab = n.firstChild;
      if (typeof it.label === 'function' && lab) lab.childNodes[0].textContent = it.label();
      n.classList.toggle('off', !!it.disabled);
    });
  }

  applyFocus() {
    this.nodes.forEach((n, i) => n.classList.toggle('focus', i === this.idx));
    const n = this.nodes[this.idx];
    if (n && n.scrollIntoView) n.scrollIntoView({ block: 'nearest' });
    if (this.opts.onFocus) this.opts.onFocus(this.items[this.idx], this.idx);
  }

  setIdx(i, silent = false) {
    this.idx = (i + this.items.length) % this.items.length;
    if (!silent) audio.sfx('ui_move'); else audio.sfx('ui_move', { vol: 0.5 });
    this.applyFocus();
  }

  activate() {
    const it = this.items[this.idx];
    if (!it || it.disabled) { audio.sfx('ui_back'); return; }
    audio.sfx('ui_ok');
    if (it.ok) it.ok(this);
    this.refresh();
  }

  nav(ev) {
    const it = this.items[this.idx];
    switch (ev) {
      case 'up': this.setIdx(this.idx - 1); return true;
      case 'down': this.setIdx(this.idx + 1); return true;
      case 'left': if (it && it.left) { it.left(this); audio.sfx('ui_move'); this.refresh(); return true; } return false;
      case 'right': if (it && it.right) { it.right(this); audio.sfx('ui_move'); this.refresh(); return true; } return false;
      case 'ok': this.activate(); return true;
      default: return false;
    }
  }
}

export class UI {
  constructor(root) {
    this.root = root;
    this.stack = [];
    this.locked = false;
  }
  get top() { return this.stack[this.stack.length - 1]; }
  push(scr) {
    const t = this.top;
    if (t && t.el) t.el.style.display = scr.overlay === false ? 'none' : '';
    this.stack.push(scr);
    this.root.append(scr.el);
    if (scr.onEnter) scr.onEnter();
    return scr;
  }
  pop() {
    const s = this.stack.pop();
    if (s) { if (s.onExit) s.onExit(); s.el.remove(); }
    const t = this.top;
    if (t && t.el) { t.el.style.display = ''; if (t.onResume) t.onResume(); }
    return s;
  }
  replace(scr) { const s = this.stack.pop(); if (s) { if (s.onExit) s.onExit(); s.el.remove(); } return this.push(scr); }
  clear() { while (this.stack.length) { const s = this.stack.pop(); if (s.onExit) s.onExit(); s.el.remove(); } this.root.innerHTML = ''; }
  nav(ev) { const t = this.top; if (!t || !t.nav) return false; return t.nav(ev); }
  update(dt) { const t = this.top; if (t && t.update) t.update(dt); }
}

export function toast(text) {
  const box = $('#toast');
  const t = h('div', { class: 'toast' }, text);
  box.append(t);
  setTimeout(() => t.remove(), 2300);
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
