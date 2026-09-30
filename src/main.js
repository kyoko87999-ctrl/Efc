import { App } from './game/app.js';
import * as S from './ui/screens.js';
import * as M from './game/modes.js';

let app = null;
try {
  app = new App();
} catch (e) {
  // most likely WebGL is unavailable or disabled
  console.error(e);
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#07080c;color:#fff;font:600 18px/1.5 system-ui,sans-serif;text-align:center;padding:24px';
  box.innerHTML = '<div><div style="font-size:28px;color:#ffc94a;margin-bottom:8px">EFC</div>This game needs WebGL 3D graphics, but the browser could not start it.<br>Enable hardware acceleration or try another browser.<br><br>เกมนี้ต้องใช้กราฟิก 3D (WebGL) แต่เบราว์เซอร์เริ่มทำงานไม่ได้<br>ลองเปิดการเร่งฮาร์ดแวร์หรือใช้เบราว์เซอร์อื่น</div>';
  document.body.appendChild(box);
}
if (app) {
  window.__app = app; window.__S = S; window.__M = M;
  import('./input/devices.js').then((m) => { window.__input = m.input; });
  import('./audio/audio.js').then((m) => { window.__audio = m.audio; window.__TRACKS = m.TRACKS; });
  app.start();
}
