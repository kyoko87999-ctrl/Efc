import { App } from './game/app.js';
import * as S from './ui/screens.js';
import * as M from './game/modes.js';

const app = new App();
window.__app = app; window.__S = S; window.__M = M; import('./input/devices.js').then((m) => { window.__input = m.input; });
app.start();
