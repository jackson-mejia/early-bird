const { loadWithSync, runner } = require('./helpers');
const { check, done } = runner('sync merge');

const app = loadWithSync('mergeRemote, setState: v => { state = v }, getState: () => state, setSync: v => { sync = v }, getSync: () => sync');

const A = { wake: '06:45', studyMin: 40, questions: 25 };
const B = { wake: '07:30', studyMin: 0, questions: 0 };
const OLD = '2026-07-20T10:00:00.000Z', NEW = '2026-07-25T10:00:00.000Z';

function setup(entries, deleted, updatedAt) {
  app.setState({ entries: JSON.parse(JSON.stringify(entries)), rewards: [{ name: 'Plushie', target: 40 }] });
  app.setSync({ code: 'x', updatedAt, deleted: deleted || {} });
}

console.log('\nadds survive from either side');
setup({ '2026-07-21': A }, {}, OLD);
app.mergeRemote({ entries: { '2026-07-22': B }, deleted: {}, updatedAt: NEW });
check('the remote day arrives', Object.keys(app.getState().entries).sort(), ['2026-07-21', '2026-07-22']);

setup({ '2026-07-23': A }, {}, OLD);
app.mergeRemote({ entries: {}, deleted: {}, updatedAt: NEW });
check('a local-only day is not clobbered', app.getState().entries['2026-07-23'], A);

setup({}, {}, null);
app.mergeRemote({ entries: { '2026-07-21': A, '2026-07-22': B }, deleted: {}, updatedAt: NEW });
check('a fresh device receives the whole log', Object.keys(app.getState().entries).sort(), ['2026-07-21', '2026-07-22']);

console.log('\nsame-day conflicts go to the last writer');
setup({ '2026-07-21': A }, {}, NEW);
app.mergeRemote({ entries: { '2026-07-21': B }, deleted: {}, updatedAt: OLD });
check('newer local wins', app.getState().entries['2026-07-21'], A);
setup({ '2026-07-21': A }, {}, OLD);
app.mergeRemote({ entries: { '2026-07-21': B }, deleted: {}, updatedAt: NEW });
check('newer remote wins', app.getState().entries['2026-07-21'], B);

console.log('\ndeletions do not come back');
setup({ '2026-07-21': A }, {}, OLD);
app.mergeRemote({ entries: {}, deleted: { '2026-07-21': NEW }, updatedAt: NEW });
check('a remote deletion removes the day', app.getState().entries['2026-07-21'], undefined);

setup({}, { '2026-07-21': NEW }, NEW);
app.mergeRemote({ entries: { '2026-07-21': A }, deleted: {}, updatedAt: OLD });
check('a local deletion survives a stale remote', app.getState().entries['2026-07-21'], undefined);

setup({ '2026-07-21': B }, {}, NEW);
app.mergeRemote({ entries: {}, deleted: { '2026-07-21': OLD }, updatedAt: OLD });
check('re-logging a day beats its tombstone', app.getState().entries['2026-07-21'], B);
check('and clears it', app.getSync().deleted['2026-07-21'], undefined);

console.log('\nrewards follow the newer side');
setup({}, {}, OLD);
app.mergeRemote({ entries: {}, rewards: [{ name: 'Aritzia outfit', target: 200 }], deleted: {}, updatedAt: NEW });
check('rewards are taken from the newer copy', app.getState().rewards[0].name, 'Aritzia outfit');

setup({}, {}, OLD);
app.mergeRemote({ entries: {}, rewards: [{ name: 'Gregmat Math Completion', type: 'done', prize: 'One Pair of Cutie Shoes', done: true }], deleted: {}, updatedAt: NEW });
check('including a completed milestone', app.getState().rewards[0].done, true);

done();
