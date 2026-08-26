const { loadPure, runner, weekdaysEndingToday } = require('./helpers');
const { check, done } = runner('scoring');

const app = loadPure('state, recompute, wakePoints, questionPoints, roundHalf, fmtPts, tierMultiplier, dropOneTier, scoreLine, bandLabel, greTier, migrateRewards, DEFAULT_REWARDS, REWARDS_VERSION, setState: s => state = s');

console.log('\nwake points — 9:00 is the baseline and still earns');
check('06:00 -> 6', app.wakePoints('06:00'), 6);
check('06:45 -> 5', app.wakePoints('06:45'), 5);
check('07:45 -> 3', app.wakePoints('07:45'), 3);
check('08:45 -> 1', app.wakePoints('08:45'), 1);
check('09:00 -> 1', app.wakePoints('09:00'), 1);
check('09:01 -> 0', app.wakePoints('09:01'), 0);
check('05:00 -> 6 (capped)', app.wakePoints('05:00'), 6);
check('09:00 sits in the baseline band', app.bandLabel('09:00'), '8:30–9:00 — baseline');
check('09:01 sits past it', app.bandLabel('09:01'), 'after 9:00 — no points');

console.log('\nquestions — half a point per ten, to three');
check('0 -> 0', app.questionPoints(0), 0);
check('9 -> 0', app.questionPoints(9), 0);
check('10 -> 0.5', app.questionPoints(10), 0.5);
check('25 -> 1', app.questionPoints(25), 1);
check('59 -> 2.5', app.questionPoints(59), 2.5);
check('60 -> 3 (capped)', app.questionPoints(60), 3);
check('200 -> 3 (still capped)', app.questionPoints(200), 3);
check('a missing field reads as 0', app.questionPoints(undefined), 0);

console.log('\nhalf points');
check('roundHalf 6.25 -> 6.5', app.roundHalf(6.25), 6.5);
check('roundHalf 7.5 stays 7.5', app.roundHalf(7.5), 7.5);
check('fmtPts drops a trailing .0', app.fmtPts(9), '9');
check('fmtPts keeps a half', app.fmtPts(10.5), '10.5');

console.log('\nstreak tiers');
check('day 2 -> 1x', app.tierMultiplier(2), 1);
check('day 3 -> 1.25x', app.tierMultiplier(3), 1.25);
check('day 7 -> 1.5x', app.tierMultiplier(7), 1.5);
check('a missed weekday drops 8 to 4', app.dropOneTier(8), 4);
check('and 5 to 1', app.dropOneTier(5), 1);

console.log('\nthe long run');
// Was 172 on the old five-point ladder, then 206 once 9:00 earned a point,
// then 201 once halves stopped rounding up.
// Days 1-2 at 1x: (5+3)*2 = 16. Days 3-6 at 1.25x: (6.5+3)*4 = 38.
// Days 7-20 at 1.5x: (7.5+3)*14 = 147.
const entries = {};
weekdaysEndingToday(20).forEach(d => { entries[d] = { wake: '06:45', studyMin: 40 }; });
app.setState({ entries, rewards: [] });
const calc = app.recompute();
const dates = Object.keys(entries).sort();
check('20 weekdays at 6:45 with study = 201', calc.total, 201);
check('entries with no questions field still score', calc.points[dates[3]], 9.5);
check('day-4 breakdown', app.scoreLine(calc.detail[dates[3]]), '5 wake × 1.25 (day 4) = 6.5, +3 study → 9.5 pts');
check('day-1 breakdown', app.scoreLine(calc.detail[dates[0]]), '5 wake, +3 study → 8 pts');

console.log('\nthe worked example the app shows');
const eg = {};
weekdaysEndingToday(4).forEach(d => { eg[d] = { wake: '06:45', studyMin: 40, questions: 25 }; });
app.setState({ entries: eg, rewards: [] });
const egCalc = app.recompute();
const egDay4 = Object.keys(eg).sort()[3];
check('scores 10.5', egCalc.points[egDay4], 10.5);
check('and says so', app.scoreLine(egCalc.detail[egDay4]), '5 wake × 1.25 (day 4) = 6.5, +3 study, +1 questions → 10.5 pts');

console.log('\nthe three inputs stay independent');
const qOnly = {};
weekdaysEndingToday(2).forEach(d => { qOnly[d] = { wake: '09:30', studyMin: 0, questions: 40 }; });
app.setState({ entries: qOnly, rewards: [] });
check('questions alone earn on a late day', app.recompute().total, 4);
const sOnly = {};
weekdaysEndingToday(10).forEach(d => { sOnly[d] = { wake: '09:30', studyMin: 45, questions: 0 }; });
app.setState({ entries: sOnly, rewards: [] });
check('the study bonus never takes the multiplier', app.recompute().total, 30);
const base = {};
weekdaysEndingToday(2).forEach(d => { base[d] = { wake: '09:00', studyMin: 0, questions: 0 }; });
app.setState({ entries: base, rewards: [] });
check('two baseline days earn 2', app.recompute().total, 2);

console.log('\nGRE score tiers');
const tier = s => { const t = app.greTier(s); return t ? t.label : 'none'; };
check('no score yet', tier(null), 'none');
check('blank', tier(''), 'none');
check('130', tier(130), 'none');
check('159', tier(159), 'none');
check('160', tier(160), 'Michelin recommended');
check('164', tier(164), 'Michelin recommended');
check('165', tier(165), 'One-star restaurant');
check('170', tier(170), 'One-star restaurant');

console.log('\nreward defaults');
check('plushie', app.DEFAULT_REWARDS[0].target, 40);
check('cactus dinner', app.DEFAULT_REWARDS[1].target, 75);
check('aritzia outfit', app.DEFAULT_REWARDS[2].target, 200);
const score = app.DEFAULT_REWARDS.filter(r => r.type === 'score');
check('one score reward', score.length, 1);
check('with no target', score[0].target, undefined);
check('and no score yet', score[0].score, null);
const doneR = app.DEFAULT_REWARDS.filter(r => r.type === 'done');
check('one completion reward', doneR.length, 1);
check('named for the prize, like every other reward', doneR[0].name, 'One Pair of Cutie Shoes');
check('with the milestone as its condition', doneR[0].milestone, 'Gregmat Math Completion');
check('and no leftover prize field', doneR[0].prize, undefined);
check('starting undone', doneR[0].done, false);
check('with no target', doneR[0].target, undefined);

console.log('\nmigrating saved rewards');
const ORIGINAL = [{ name: 'Plushie', target: 30 }, { name: 'Cactus dinner', target: 50 }, { name: 'Aritzia outfit', target: 180 }];
const m = app.migrateRewards(ORIGINAL, undefined);
check('targets are raised', m.rewards.slice(0, 3).map(r => r.target).join('/'), '40/75/200');
check('the dinner is added', m.rewards.filter(r => r.type === 'score').length, 1);
check('and so are the shoes', m.rewards.filter(r => r.type === 'done').length, 1);
check('it reports a change', m.changed, true);
check('and stamps the current version', m.version, app.REWARDS_VERSION);
check('the input is not mutated', ORIGINAL[0].target, 30);

const MID = [{ name: 'Plushie', target: 35 }, { name: 'Cactus dinner', target: 55 }, { name: 'Aritzia outfit', target: 190 }, { name: 'Michelin dinner', type: 'event', score: null }];
const mid = app.migrateRewards(MID, 2);
check('a device on the previous defaults catches up', mid.rewards.slice(0, 3).map(r => r.target).join('/'), '40/75/200');
check("the old 'event' dinner is renamed, not duplicated", mid.rewards.filter(r => r.type === 'score').length, 1);
check('the shoes join it', mid.rewards.filter(r => r.type === 'done').length, 1);
check('leaving five rewards', mid.rewards.length, 5);

const scored = app.migrateRewards([{ name: 'Michelin dinner', type: 'event', score: 166 }], app.REWARDS_VERSION);
check('an entered score survives the rename', scored.rewards[0].score, 166);
check('as a score reward', scored.rewards[0].type, 'score');
// The shoes first shipped with the milestone in the name box and the prize below it
const BACKWARDS = [{ name: 'Gregmat Math Completion', type: 'done', prize: 'One Pair of Cutie Shoes', done: true }];
const swapped = app.migrateRewards(BACKWARDS, app.REWARDS_VERSION);
check('the prize moves into the name', swapped.rewards[0].name, 'One Pair of Cutie Shoes');
check('the milestone becomes the condition', swapped.rewards[0].milestone, 'Gregmat Math Completion');
check('the old prize field is dropped', swapped.rewards[0].prize, undefined);
check('a completed milestone stays completed', swapped.rewards[0].done, true);
check('and the swap is reported', swapped.changed, true);
check('swapping is not repeated', app.migrateRewards(swapped.rewards, app.REWARDS_VERSION).changed, false);
check('the input is not mutated', BACKWARDS[0].name, 'Gregmat Math Completion');

const again = app.migrateRewards(m.rewards, m.version);
check('running it twice changes nothing', again.changed, false);
check('and leaves the targets alone', again.rewards.slice(0, 3).map(r => r.target).join('/'), '40/75/200');

const EDITED = [{ name: 'Plushie', target: 42 }, { name: 'Custom', target: 50 }];
const edited = app.migrateRewards(EDITED, app.REWARDS_VERSION);
check('a hand-edited target survives', edited.rewards[0].target, 42);
check('and so does a 50 once the version is stamped', edited.rewards[1].target, 50);

done();
