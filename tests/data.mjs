// Static data validation: story, stages, music, quotes, characters
import { CHARS } from '../src/data/roster.js';
import { STORY, QUOTES, ARCADE_ENDINGS } from '../src/game/story.js';
import { STAGES } from '../src/render/stagesData.js';
import { TRACKS } from '../src/audio/audio.js';
import { LESSONS } from '../src/game/tutorial.js';

let bad = 0;
const fail = (m) => { bad++; console.log('FAIL', m); };
const ids = new Set(CHARS.map((c) => c.id));
const stageIds = new Set(STAGES.map((s) => s.id));
if (!ids.has(STORY.hero)) fail('story hero ' + STORY.hero);
STORY.chapters.forEach((c, i) => {
  if (!ids.has(c.opp)) fail(`chapter ${i + 1} opponent ${c.opp}`);
  if (!stageIds.has(c.stage)) fail(`chapter ${i + 1} stage ${c.stage}`);
  for (const key of ['pre', 'post']) for (const ln of c[key] || []) {
    if (ln.who !== 'narr' && !ids.has(ln.who)) fail(`chapter ${i + 1} ${key} speaker ${ln.who}`);
    if (!ln.en || !ln.th) fail(`chapter ${i + 1} ${key} missing translation: ${JSON.stringify(ln).slice(0, 60)}`);
  }
});
for (const key of ['prologue', 'ending']) for (const ln of STORY[key] || []) {
  if (ln.who !== 'narr' && !ids.has(ln.who)) fail(`${key} speaker ${ln.who}`);
  if (!ln.en || !ln.th) fail(`${key} missing translation`);
}
for (const c of CHARS) {
  if (!ARCADE_ENDINGS[c.id] || !ARCADE_ENDINGS[c.id].length) fail('arcade ending for ' + c.id);
  for (const ln of ARCADE_ENDINGS[c.id] || []) { if (ln.who !== 'narr' && !ids.has(ln.who)) fail('ending speaker ' + ln.who); if (!ln.en || !ln.th) fail('ending text ' + c.id); }
  if (!QUOTES[c.id] || !QUOTES[c.id].length) fail('quotes for ' + c.id);
  for (const k of ['name', 'nameTH', 'title', 'style', 'styleTH', 'desc', 'descTH', 'country']) if (!c[k]) fail(`${c.id} missing ${k}`);
  for (const k of ['power', 'speed', 'range', 'tech', 'defense']) if (!(c.stats[k] >= 1 && c.stats[k] <= 5)) fail(`${c.id} stat ${k}`);
}
for (const s of STAGES) {
  if (!TRACKS[s.music]) fail(`stage ${s.id} music ${s.music}`);
  if (!s.nameTH || !s.desc) fail(`stage ${s.id} text`);
}
for (const t of ['menu', 'results']) if (!TRACKS[t]) fail('track ' + t);
LESSONS.forEach((L) => { if (!L.title() || !L.text()) fail('lesson ' + L.id); });
console.log(bad ? `${bad} problems` : `data OK: ${CHARS.length} fighters, ${STAGES.length} stages, ${STORY.chapters.length} chapters, ${LESSONS.length} lessons, ${Object.keys(TRACKS).length} tracks`);
process.exit(bad ? 1 : 0);
