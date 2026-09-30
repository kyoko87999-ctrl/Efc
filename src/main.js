import { App } from './game/app.js';
import * as S from './ui/screens.js';
import * as M from './game/modes.js';

const app = new App();
window.__app = app; window.__S = S; window.__M = M; import('./input/devices.js').then((m) => { window.__input = m.input; }); import('./audio/audio.js').then((m) => { window.__audio = m.audio; window.__TRACKS = m.TRACKS; });
app.start();
