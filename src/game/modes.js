// Game modes: versus, arcade ladder, story, survival, ghost, practice, tutorial (+ move list / customize entry points).
import { h, MenuList } from '../ui/kit.js';
import { tr, pick } from '../ui/i18n.js';
import { audio } from '../audio/audio.js';
import { save } from './save.js';
import { STORY } from './story.js';
import { LEVELS } from '../sim/ai.js';
import * as S from '../ui/screens.js';
import { moveListScreen } from '../ui/movelist.js';
import { customizeScreen } from '../ui/customize.js';
import { STAGES } from '../render/stagesList.js';

const rnd = (a) => a[(Math.random() * a.length) | 0];
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [b[i], b[j]] = [b[j], b[i]]; } return b; };
const back = (app) => () => S.mainMenu(app);

function difficultyDialog(app, onPick, onBack) {
  const items = LEVELS.map((L, i) => ({ label: L.name, val: () => (i === save.settings.difficulty ? tr('default', 'ค่าเริ่มต้น') : ''), ok: () => { app.ui.pop(); onPick(i); } }));
  const list = new MenuList(items, { start: save.settings.difficulty });
  const el = h('div', { class: 'screen dark' }, h('div', { class: 'dialog' }, h('h2', {}, tr('CPU difficulty', 'ความยากของคอม')), list.el));
  app.ui.push({ el, nav: (ev) => list.nav(ev), back: () => { app.ui.pop(); onBack(); }, overlay: true });
}

// ------------------------------------------------------------------------------ versus
export function versus(app, vsCpu) {
  S.selectScreen(app, {
    title: vsCpu ? tr('VS CPU', 'ต่อสู้กับคอม') : tr('VERSUS', 'ผู้เล่นสองคน'), players: vsCpu ? 1 : 2, onBack: back(app),
    onDone: (sel) => {
      const go = (level) => S.stageSelect(app, (stageId) => {
        const p2 = vsCpu ? rnd(app.list.filter((c) => c.id !== sel.chars[0]).map((c) => c.id)) : sel.chars[1];
        app.ui.clear();
        app.startMatch({ modeName: 'versus', chars: [sel.chars[0], p2], alts: [sel.alts[0], vsCpu ? 0 : sel.alts[1]], useCustom: sel.useCustom, stage: stageId, cpu: [false, !!vsCpu], level, reselect: () => versus(app, vsCpu) });
      }, () => versus(app, vsCpu), { ids: sel.chars });
      if (vsCpu) difficultyDialog(app, go, () => versus(app, vsCpu)); else go();
    },
  });
}

// ------------------------------------------------------------------------------ arcade
export function arcade(app) {
  S.selectScreen(app, {
    title: tr('ARCADE BATTLE', 'อาร์เคด'), players: 1, onBack: back(app),
    onDone: (sel) => {
      const me = sel.chars[0];
      const pool = shuffle(app.list.filter((c) => c.id !== me && !c.boss).map((c) => c.id)).slice(0, 7);
      const boss = me === 'asura' ? 'ironclad' : 'asura';
      const ladder = [...pool, boss];
      const stages = shuffle(STAGES.filter((s) => s.id !== 'grid' && s.id !== 'throne').map((s) => s.id));
      const base = save.settings.difficulty;
      const state = { i: 0, continues: 2, me, alt: sel.alts[0], useCustom: sel.useCustom, score: 0 };
      const runFight = () => {
        const i = state.i;
        const last = i === ladder.length - 1;
        const stage = last ? 'throne' : stages[i % stages.length];
        const level = Math.min(5, base + Math.floor(i / 3) + (last ? 1 : 0));
        S.chapterCard(app, last ? tr('FINAL STAGE', 'ด่านสุดท้าย') : `${tr('STAGE', 'ด่านที่')} ${i + 1} / ${ladder.length}`, `${pick(app.list.find((c) => c.id === state.me), 'name')}  vs  ${pick(app.list.find((c) => c.id === ladder[i]), 'name')}`, () => {
          app.ui.clear();
          app.startMatch({ modeName: 'arcade', chars: [state.me, ladder[i]], alts: [state.alt, 0], useCustom: state.useCustom, stage, cpu: [false, true], level, music: undefined,
            onEnd: (res) => onEnd(res) });
        });
      };
      const onEnd = (res) => {
        app.modal = true;
        if (res.winner === 0) {
          state.score += 1000 + Math.round(res.hp[0] * 500);
          state.i++;
          if (state.i >= ladder.length) return arcadeEnding(app, state, back(app));
          resultLite(app, res, tr('NEXT STAGE', 'ด่านถัดไป'), () => { app.modal = false; runFight(); }, () => { app.modal = false; app.quitToMenu(); });
        } else {
          const items = [];
          if (state.continues > 0) items.push({ label: `${tr('Continue', 'เล่นต่อ')} (${state.continues})`, ok: () => { state.continues--; app.ui.pop(); app.modal = false; runFight(); } });
          items.push({ label: tr('Give up', 'ยอมแพ้'), ok: () => { app.ui.clear(); app.modal = false; app.quitToMenu(); } });
          const list = new MenuList(items);
          app.ui.push({ el: h('div', { class: 'screen dark' }, h('div', { class: 'dialog' }, h('h2', {}, tr('DEFEATED', 'พ่ายแพ้')), list.el)), nav: (ev) => list.nav(ev), back: () => {}, overlay: true });
        }
      };
      runFight();
    },
  });
}

function resultLite(app, res, nextLabel, onNext, onQuit) {
  app.touch.show(false);
  const p = save.profile;
  const items = [{ label: nextLabel, ok: () => { app.ui.pop(); onNext(); } }, { label: tr('Quit to menu', 'ออกสู่เมนู'), ok: () => { app.ui.clear(); onQuit(); } }];
  const list = new MenuList(items);
  const el = h('div', { class: 'screen dark' }, h('div', { class: 'dialog' },
    h('h2', {}, `${res.names[0]} ${tr('WINS', 'ชนะ')}`),
    h('p', {}, `${tr('Max combo', 'คอมโบสูงสุด')} ${res.stats[0].maxCombo} · ${tr('Damage', 'ดาเมจ')} ${res.stats[0].dmg} · FM ${p.fm}`), list.el));
  audio.sfx('win');
  app.ui.push({ el, nav: (ev) => list.nav(ev), back: () => {}, overlay: true });
}

function arcadeEnding(app, state, done) {
  const p = save.profile;
  p.arcadeClears++; p.fm += 500; p.exp += 60; save.write();
  app.stopMatch();
  app.ui.clear();
  S.chapterCard(app, tr('ARCADE CLEARED!', 'จบอาร์เคด!'), `${tr('Score', 'คะแนน')} ${state.score}  ·  +500 FM  ·  +60 EXP`, () => { app.modal = false; done(); });
}

// ------------------------------------------------------------------------------ story
export function story(app) {
  const st = save.data.story;
  const items = [{ label: tr('New Story', 'เริ่มเนื้อเรื่องใหม่'), ok: () => { st.chapter = 0; save.write(); app.ui.pop(); begin(0, true); } }];
  if (st.chapter > 0 && st.chapter < STORY.chapters.length) items.push({ label: `${tr('Continue: Chapter', 'เล่นต่อ: บทที่')} ${st.chapter + 1}`, ok: () => { app.ui.pop(); begin(st.chapter, false); } });
  const chapters = STORY.chapters.map((c, i) => ({ label: `${i + 1}. ${tr(c.title.replace(/^.*? - /, ''), c.titleTH.replace(/^.*? - /, ''))}`, disabled: i > st.chapter, ok: () => { app.ui.pop(); begin(i, false); } }));
  const list = new MenuList([...items, ...chapters]);
  const el = h('div', { class: 'screen menu-screen veil' }, h('h1', { class: 'title' }, tr(STORY.title, STORY.titleTH)), h('h2', { class: 'sub' }, tr('Story Mode', 'โหมดเนื้อเรื่อง')), list.el);
  app.ui.clear();
  app.ui.push({ el, nav: (ev) => list.nav(ev), back: back(app) });
  app.setShowcase([{ id: 'tawan', x: -1.9 }, { id: 'asura', x: 1.9 }], { stage: 'ring', cam: [0, 1.5, 7.4], look: [0, 1.1, 0], fov: 34 });
  app.showcasePose(0, 'intro'); app.showcasePose(1, 'intro');

  function begin(i, withPrologue) {
    app.ui.clear();
    const play = () => chapter(i);
    if (withPrologue) S.dialogue(app, STORY.prologue, play, { hero: STORY.hero });
    else play();
  }
  function chapter(i) {
    const c = STORY.chapters[i];
    const alt = save.data.custom[STORY.hero]?.alt ?? 0;
    S.chapterCard(app, tr(c.title, c.titleTH), '', () => {
      const fight = () => {
        app.ui.clear();
        app.startMatch({
          modeName: 'story', chars: [STORY.hero, c.opp], alts: [alt, 0], useCustom: [true, false], stage: c.stage, cpu: [false, true], level: Math.min(5, c.level + Math.max(0, save.settings.difficulty - 2)),
          onEnd: (res) => {
            app.modal = true;
            if (res.winner === 0) {
              st.chapter = Math.max(st.chapter, i + 1); save.profile.storyDone = Math.max(save.profile.storyDone, i + 1); save.profile.fm += 100; save.write();
              app.stopMatch(); app.ui.clear();
              S.dialogue(app, c.post, () => {
                if (i + 1 >= STORY.chapters.length) { S.dialogue(app, STORY.ending, () => { app.modal = false; app.quitToMenu(); }, { hero: STORY.hero }); }
                else { app.modal = false; chapter(i + 1); }
              }, { hero: STORY.hero });
            } else {
              const items = [{ label: tr('Retry', 'ลองใหม่'), ok: () => { app.ui.pop(); app.modal = false; fight(); } }, { label: tr('Story menu', 'เมนูเนื้อเรื่อง'), ok: () => { app.ui.clear(); app.modal = false; app.stopMatch(); story(app); } }];
              const list = new MenuList(items);
              app.ui.push({ el: h('div', { class: 'screen dark' }, h('div', { class: 'dialog' }, h('h2', {}, tr('DEFEATED', 'พ่ายแพ้')), list.el)), nav: (ev) => list.nav(ev), back: () => {}, overlay: true });
            }
          },
        });
      };
      S.dialogue(app, c.pre, fight, { hero: STORY.hero });
    });
  }
}

// ------------------------------------------------------------------------------ survival
export function survival(app) {
  S.selectScreen(app, {
    title: tr('SURVIVAL', 'เอาชีวิตรอด'), players: 1, onBack: back(app),
    onDone: (sel) => {
      const st = { me: sel.chars[0], alt: sel.alts[0], useCustom: sel.useCustom, wins: 0, hp: 1 };
      const next = () => {
        const opp = rnd(app.list.filter((c) => c.id !== st.me).map((c) => c.id));
        const level = Math.min(5, 1 + Math.floor(st.wins / 2));
        const stage = rnd(STAGES.filter((s) => s.id !== 'grid').map((s) => s.id));
        app.ui.clear();
        app.startMatch({
          modeName: 'survival', chars: [st.me, opp], alts: [st.alt, 0], useCustom: st.useCustom, stage, cpu: [false, true], level, rules: { rounds: 1, startHp: [st.hp, 1] },
          onEnd: (res) => {
            app.modal = true;
            if (res.winner === 0) {
              st.wins++; st.hp = Math.min(1, res.hp[0] + 0.28);
              const p = save.profile; p.fm += 25; save.write();
              resultLite(app, res, `${tr('Next fighter', 'คู่ต่อสู้ถัดไป')} (${st.wins} ${tr('wins', 'ชนะ')})`, () => { app.modal = false; next(); }, () => { app.modal = false; app.quitToMenu(); });
            } else {
              const p = save.profile;
              if (st.wins > p.survivalBest) { p.survivalBest = st.wins; save.write(); }
              const items = [{ label: tr('Main menu', 'เมนูหลัก'), ok: () => { app.ui.clear(); app.modal = false; app.quitToMenu(); } }];
              const list = new MenuList(items);
              app.ui.push({ el: h('div', { class: 'screen dark' }, h('div', { class: 'dialog' }, h('h2', {}, tr('GAME OVER', 'จบเกม')), h('p', {}, `${tr('Wins in a row', 'ชนะติดต่อกัน')}: ${st.wins}  ·  ${tr('Best', 'สูงสุด')}: ${Math.max(p.survivalBest, st.wins)}`), list.el)), nav: (ev) => list.nav(ev), back: () => {}, overlay: true });
            }
          },
        });
      };
      next();
    },
  });
}

// ------------------------------------------------------------------------------ ghost battle
export function ghost(app) {
  S.selectScreen(app, {
    title: tr('GHOST BATTLE', 'แบทเทิลผี'), players: 1, onBack: back(app),
    onDone: (sel) => {
      S.stageSelect(app, (stageId) => {
        const opp = rnd(app.list.filter((c) => c.id !== sel.chars[0] && !c.boss).map((c) => c.id));
        app.ui.clear();
        app.startMatch({ modeName: 'ghost', chars: [sel.chars[0], opp], alts: [sel.alts[0], 0], useCustom: sel.useCustom, stage: stageId, cpu: [false, true], level: 4, ghost: true, reselect: () => ghost(app), names: [null, tr('GHOST · ', 'ผี · ') + pick(app.list.find((c) => c.id === opp), 'name')].map((n, i) => n || pick(app.list.find((c) => c.id === sel.chars[0]), 'name')) });
      }, () => ghost(app), { ids: sel.chars });
    },
  });
}

// ------------------------------------------------------------------------------ practice
export function practice(app) {
  S.selectScreen(app, {
    title: tr('PRACTICE - YOU', 'ฝึกซ้อม - คุณ'), players: 1, onBack: back(app),
    onDone: (sel) => {
      S.selectScreen(app, {
        title: tr('PRACTICE - DUMMY', 'ฝึกซ้อม - หุ่นซ้อม'), players: 1, first: sel.chars[0], onBack: () => practice(app),
        onDone: (sel2) => {
          app.ui.clear();
          app.startMatch({ modeName: 'practice', chars: [sel.chars[0], sel2.chars[0]], alts: [sel.alts[0], sel2.alts[0]], useCustom: sel.useCustom, stage: 'grid', cpu: [false, false], practice: { dummy: 'stand' }, showVs: false, reselect: () => practice(app) });
        },
      });
    },
  });
}

// ------------------------------------------------------------------------------ tutorial
export function tutorial(app, index = 0) {
  app.ui.clear();
  app.startMatch({ modeName: 'tutorial', chars: ['kenzo', 'marcus'], alts: [0, 0], stage: 'grid', cpu: [false, false], practice: { dummy: 'stand' }, tutorial: { index }, showVs: false });
}

// ------------------------------------------------------------------------------ move list / customize
export function moveList(app, charId, onBack, overlay) {
  if (overlay) { moveListScreen(app, charId || 'kenzo', onBack, true); return; }
  moveListScreen(app, charId || save.data.lastChar || 'kenzo', () => S.mainMenu(app), false);
}

export function customize(app) { customizeScreen(app); }
