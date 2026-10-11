#!/usr/bin/env node
//
// How many logged weekdays until each threshold unlocks, at a few question
// volumes. Run it before changing a target so the choice is a decision rather
// than a guess.
//
//   node tools/pacing.js            6:45 wake, 40 min study
//   node tools/pacing.js 07:15 20   a later wake and a shorter session
//
// Thresholds and scoring both come from index.html, so this tracks the app.

const { loadPure, weekdaysEndingToday } = require('../tests/helpers');

const WAKE = process.argv[2] || '06:45';
const STUDY = process.argv[3] === undefined ? 40 : Number(process.argv[3]);
const PROFILES = [0, 20, 25, 40];
const HORIZON = 80;

const app = loadPure('recompute, DEFAULT_REWARDS, fmtPts, setState: s => state = s');
const targets = app.DEFAULT_REWARDS.filter(r => !r.type);

// Cumulative total after each of the first k logged weekdays.
function curve(questions) {
  const all = weekdaysEndingToday(HORIZON);
  const out = [];
  for (let k = 1; k <= HORIZON; k++) {
    const entries = {};
    all.slice(HORIZON - k).forEach(d => { entries[d] = { wake: WAKE, studyMin: STUDY, questions }; });
    app.setState({ entries, rewards: [] });
    out.push(app.recompute().total);
  }
  return out;
}
const unlockDay = (c, target) => {
  for (let i = 0; i < c.length; i++) if (c[i] >= target) return i + 1;
  return null;
};

const pad = (v, n) => String(v).padEnd(n);
console.log('\nWeekdays to unlock, waking at ' + WAKE + ' with ' + STUDY + ' min of study\n');
console.log(pad('questions/day', 15) + targets.map(t => pad(t.name + ' (' + t.target + ')', 22)).join(''));
console.log('-'.repeat(15 + targets.length * 22));
PROFILES.forEach(q => {
  const c = curve(q);
  console.log(pad(q, 15) + targets.map(t => {
    const d = unlockDay(c, t.target);
    return pad(d === null ? 'beyond ' + HORIZON : 'day ' + d, 22);
  }).join(''));
});

console.log('\nSteady daily rate once the streak is at 1.5x:');
PROFILES.forEach(q => {
  const c = curve(q);
  console.log('  ' + pad(q + ' questions', 16) + app.fmtPts(c[20] - c[19]) + ' pts/day');
});
console.log('');
