// Scripted browser session: node tools/play.mjs '<json steps>' [--w=1280 --h=720 --file=dist/efc.html --out=/path/prefix]
// steps: {"wait":ms} {"js":"code"} {"key":"Enter"} {"down":"KeyD"} {"up":"KeyD"} {"shot":"name"} {"log":"js expr"}
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { resolve } from 'node:path';
const args = process.argv.slice(2);
const steps = JSON.parse(args[0]);
const opt = Object.fromEntries(args.slice(1).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || true]; }));
const W = +(opt.w || 1280), H = +(opt.h || 720);
const out = opt.out || '/tmp/claude-0/-home-user-Efc/519c67b6-6fef-5d28-907c-7a7105e2f7dd/scratchpad/p_';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: !!opt.touch, isMobile: !!opt.touch, reducedMotion: 'reduce' });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { const t = m.text(); if ((m.type() === 'error' || m.type() === 'warning') && !t.includes('CERT') && !t.includes('ERR_')) errors.push(m.type() + ': ' + t); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
await page.goto('file://' + resolve(opt.file || 'dist/efc.html'));
await page.waitForTimeout(1200);
for (const s of steps) {
  if (s.js) { try { const r = await page.evaluate(s.js); if (r !== undefined) console.log('js:', JSON.stringify(r)); } catch (e) { console.log('js error:', e.message); } }
  if (s.log) { try { console.log(s.log, '=>', JSON.stringify(await page.evaluate(s.log))); } catch (e) { console.log('log error', e.message); } }
  if (s.key) { await page.keyboard.press(s.key); }
  if (s.down) await page.keyboard.down(s.down);
  if (s.up) await page.keyboard.up(s.up);
  if (s.click) await page.mouse.click(s.click[0], s.click[1]);
  if (s.clicktext) { try { await page.getByText(s.clicktext, { exact: false }).first().click({ timeout: 3000 }); } catch (e) { console.log('clicktext failed', s.clicktext); } }
  if (s.touch) { await page.touchscreen.tap(s.touch[0], s.touch[1]); }
  if (s.wait) await page.waitForTimeout(s.wait);
  if (s.shot) { await page.screenshot({ path: out + s.shot + '.png' }); console.log('shot', s.shot); }
}
if (errors.length) console.log('--- console issues ---\n' + (opt.nodedupe ? errors : [...new Set(errors)]).slice(0, +(opt.maxerr || 12)).join('\n'));
await browser.close();
