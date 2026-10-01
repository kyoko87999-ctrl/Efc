// Prints before / after of the animation metrics:  node tests/anim_compare.mjs tests/anim_baseline.json new.json
import { readFileSync } from 'node:fs';
const [a, b] = process.argv.slice(2);
const A = JSON.parse(readFileSync(a, 'utf8')), B = JSON.parse(readFileSync(b, 'utf8'));
const row = (name, x, y, unit, lower = true) => {
  const r = lower ? (y > 1e-9 ? x / y : Infinity) : (x > 1e-9 ? y / x : Infinity);
  console.log(name.padEnd(46), String(x.toFixed(2)).padStart(8), '->', String(y.toFixed(2)).padStart(8), unit.padEnd(6), Number.isFinite(r) ? (r >= 10 ? '>=10x' : r.toFixed(1) + 'x').padStart(7) + ' better' : '   (eliminated)');
};
for (const n of ['walk fwd', 'walk back', 'sidewalk', 'run']) { const i = A.footSlip.findIndex((r) => r.name === n); row('foot slip: ' + n, A.footSlip[i].slipPerSec, B.footSlip[i].slipPerSec, 'm/s'); }
row('contact miss: limb vs hit volume, first active frame', A.reach.missFirstMeanCm, B.reach.missFirstMeanCm, 'cm');
row('contact miss: p90', A.reach.missFirstP90Cm, B.reach.missFirstP90Cm, 'cm');
row('moves whose limb misses the hit volume by >1 cm', A.reach.missOver1cm, B.reach.missOver1cm, 'moves');
row('moves whose limb misses the hit volume by >5 cm', A.reach.missOver5cm, B.reach.missOver5cm, 'moves');
row('strike reach error, first active frame (mean)', A.reach.firstFrameMeanCm, B.reach.firstFrameMeanCm, 'cm');
row('strike reach error, first active frame (p90)', A.reach.firstFrameP90Cm, B.reach.firstFrameP90Cm, 'cm');
row('strike reach error, worst move', A.reach.firstFrameMaxCm, B.reach.firstFrameMaxCm, 'cm');
row('moves missing their strike point by >15 cm', A.reach.over15cm, B.reach.over15cm, 'moves');
row('moves missing their strike point by >5 cm', A.reach.over5cm, B.reach.over5cm, 'moves');
row('head aim error (degrees off the opponent)', A.fights.headAimDeg, B.fights.headAimDeg, 'deg');
row('state-change pop, mean excess', A.fights.popExcessMean, B.fights.popExcessMean, 'deg');
row('state-change pop, p90 excess', A.fights.popExcessP90, B.fights.popExcessP90, 'deg');
row('angular jerk p99', A.fights.jerkP99, B.fights.jerkP99, 'deg/f2');
row('angular jerk mean', A.fights.jerkMean, B.fights.jerkMean, 'deg/f2');
console.log('standing life: chest RMS', A.life.chestRmsCm.toFixed(2), '->', B.life.chestRmsCm.toFixed(2), 'cm   head turn', A.life.headTurnDegPerSec.toFixed(2), '->', B.life.headTurnDegPerSec.toFixed(2), 'deg/s');
