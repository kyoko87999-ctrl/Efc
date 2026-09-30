// Persistent settings / profile (localStorage, fully optional).
const KEY = 'efc.save.v1';

const DEFAULTS = () => ({
  settings: {
    lang: null, master: 0.8, music: 0.5, sfx: 0.85, voice: 0.8, announcer: true,
    quality: 2, shake: true, showFx: true, fps: false, touch: 'auto',
    rounds: 2, time: 60, difficulty: 2, heat: true, rage: true, recoverable: true, tech: true, dmgMul: 1,
    inputDisplay: false, binds: null, hitboxes: false, camShake: 1,
  },
  profile: { name: 'PLAYER', wins: 0, losses: 0, matches: 0, fm: 0, exp: 0, maxCombo: 0, totalDmg: 0, throws: 0, heats: 0, rages: 0, arcadeClears: 0, storyDone: 0, survivalBest: 0, playtime: 0 },
  custom: {},         // per character: { alt: n, custom: {...} }
  replays: [],
  ghost: null,
  unlocked: { costumes: {} },
  story: { chapter: 0 },
});

function merge(a, b) {
  for (const k of Object.keys(b || {})) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') merge(a[k], b[k]);
    else a[k] = b[k];
  }
  return a;
}

class Save {
  constructor() { this.data = DEFAULTS(); this.load(); }
  load() {
    try { const raw = localStorage.getItem(KEY); if (raw) merge(this.data, JSON.parse(raw)); } catch (e) { /* storage unavailable */ }
  }
  write() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
  }
  get settings() { return this.data.settings; }
  get profile() { return this.data.profile; }
  reset() { this.data = DEFAULTS(); this.write(); }
}

export const save = new Save();

export const RANKS = [
  ['Beginner', 'มือใหม่', 0], ['Fighter', 'นักสู้', 60], ['Brawler', 'นักลุย', 160], ['Warrior', 'นักรบ', 320], ['Elite', 'ยอดฝีมือ', 560],
  ['Champion', 'แชมเปี้ยน', 900], ['Grand Master', 'แกรนด์มาสเตอร์', 1400], ['Legend', 'ตำนาน', 2200],
];
export function rankOf(exp) {
  let r = RANKS[0];
  for (const x of RANKS) if (exp >= x[2]) r = x;
  const i = RANKS.indexOf(r), next = RANKS[i + 1];
  return { en: r[0], th: r[1], idx: i, next: next ? next[2] : null, base: r[2] };
}
