// Random UI monkey test: node tools/monkey.mjs [steps=400] [seed=1]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { resolve } from 'node:path';
const STEPS = +(process.argv[2] || 400);
let seed = +(process.argv[3] || 1);
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1000, height: 600 }, reducedMotion: 'reduce' })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('CERT') && !m.text().includes('ERR_')) errors.push('console.error ' + m.text()); });
await page.goto('file://' + resolve('dist/efc.html'));
await page.waitForTimeout(1200);
const KEYS = ['Enter', 'Enter', 'Enter', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ', 'KeyE', 'Space', 'KeyU', 'KeyI', 'KeyJ', 'KeyK', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Tab', 'KeyO', 'KeyL', 'KeyP', 'KeyF'];
let last = '';
for (let i = 0; i < STEPS; i++) {
  const r = rnd();
  try {
    if (r < 0.7) { const k = pick(KEYS); await page.keyboard.down(k); await page.waitForTimeout(30 + rnd() * 120); await page.keyboard.up(k); last = k; }
    else if (r < 0.9) { const x = 30 + rnd() * 940, y = 30 + rnd() * 540; await page.mouse.click(x, y); last = `click ${x | 0},${y | 0}`; }
    else { await page.waitForTimeout(200 + rnd() * 800); last = 'wait'; }
  } catch (e) { errors.push('driver ' + e.message); break; }
  if (i % 50 === 49) {
    const s = await page.evaluate(() => ({ ui: document.querySelector('.screen') ? document.querySelector('.screen').className : null, match: !!(window.__app && __app.match), phase: __app.match && __app.match.phase }));
    console.log(`step ${i + 1}: ${JSON.stringify(s)} errors=${errors.length}`);
  }
  if (errors.length > 8) break;
}
console.log('--- errors ---');
console.log(errors.length ? [...new Set(errors)].join('\n') : 'none');
await browser.close();
process.exit(errors.length ? 1 : 0);
