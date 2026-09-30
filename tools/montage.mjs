// node tools/montage.mjs out.png cols img1 img2 ...   (tiles screenshots into one image)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const [out, cols, ...files] = process.argv.slice(2);
const c = +cols;
const cellW = Math.floor(1400 / c);
const html = `<body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(${c},${cellW}px)">${files.map((f) => `<img src="file://${f}" style="width:${cellW}px;display:block">`).join('')}</body>`;
writeFileSync('/tmp/_m.html', html);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 800 } });
await p.goto('file:///tmp/_m.html');
await p.waitForTimeout(300);
const h = await p.evaluate(() => document.body.scrollHeight);
await p.setViewportSize({ width: 1400, height: h });
await p.screenshot({ path: out });
await b.close();
