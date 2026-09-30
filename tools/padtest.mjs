// Gamepad smoke test with a mocked Gamepad API: node tools/padtest.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { resolve } from 'node:path';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => {
  window.__pad = { buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0], connected: true, id: 'Mock Pad', index: 0, mapping: 'standard' };
  navigator.getGamepads = () => [window.__pad, null, null, null];
});
await page.goto('file://' + resolve('dist/efc.html'));
await page.waitForTimeout(1200);
const press = async (i, ms = 450) => { await page.evaluate((i) => { window.__pad.buttons[i].pressed = true; }, i); await page.waitForTimeout(ms); await page.evaluate((i) => { window.__pad.buttons[i].pressed = false; }, i); await page.waitForTimeout(120); };
const state = () => page.evaluate(() => ({ ui: __app.ui.top && __app.ui.top.el ? __app.ui.top.el.className : null, match: !!__app.match, focus: document.querySelector('.mi.focus') ? document.querySelector('.mi.focus').textContent.slice(0, 24) : null }));
// title -> any pad button
await page.evaluate(() => { __app.ui.clear(); __S.title(__app); });
await page.waitForTimeout(600);
console.log('title:', JSON.stringify(await state()));
await press(0);             // A
await page.waitForTimeout(500);
console.log('after A:', JSON.stringify(await state()));
await press(13);            // dpad down
await press(13);
console.log('after 2x down:', JSON.stringify(await state()));
await press(12);            // dpad up
console.log('after up:', JSON.stringify(await state()));
await press(1);             // B = back
console.log('after B:', JSON.stringify(await state()));
// in match: hold right (axis) and press X (btn 2 = LP), check the fighter reacts
await page.evaluate(() => { __app.ui.clear(); __app.startMatch({ chars: ['kenzo', 'tawan'], stage: 'grid', practice: { dummy: 'stand' }, cpu: [false, true], showVs: false }); });
await page.waitForTimeout(2500);
const before = await page.evaluate(() => __app.match.fighters[0].x);
await page.evaluate(() => { window.__pad.axes[0] = 1; });
await page.waitForTimeout(1200);
await page.evaluate(() => { window.__pad.axes[0] = 0; });
const after = await page.evaluate(() => __app.match.fighters[0].x);
console.log('stick right moved P1 x', before.toFixed(2), '->', after.toFixed(2));
const moves = [];
for (const [b, name] of [[2, 'X=1'], [3, 'Y=2'], [0, 'A=3'], [1, 'B=4']]) {
  await page.evaluate(() => { __app.match.fighters[0].enterIdleClean && __app.match.fighters[0].enterIdleClean(); });
  await page.waitForTimeout(400);
  await press(b, 200);
  await page.waitForTimeout(300);
  moves.push(name + ':' + await page.evaluate(() => __app.match.fighters[0].lastMoveId));
}
console.log('button -> move:', moves.join(' '));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
