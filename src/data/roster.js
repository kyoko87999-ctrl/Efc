import kenzo from './chars/kenzo.js';
import tawan from './chars/tawan.js';
import meilan from './chars/meilan.js';
import bruno from './chars/bruno.js';
import jaeho from './chars/jaeho.js';
import marcus from './chars/marcus.js';
import luna from './chars/luna.js';
import kage from './chars/kage.js';
import ironclad from './chars/ironclad.js';
import asura from './chars/asura.js';

export const CHARS = [kenzo, tawan, meilan, jaeho, marcus, bruno, luna, kage, ironclad, asura];
export const charById = (id) => CHARS.find((c) => c.id === id) || CHARS[0];
