// Loads the app's own functions straight out of index.html so the tests can
// never drift from what ships. Everything above drawDial() is free of DOM
// calls at parse time, which is the seam these tests lean on.
const fs = require('fs');
const path = require('path');

const HTML = path.join(__dirname, '..', 'index.html');

function scriptOf() {
  return fs.readFileSync(HTML, 'utf8').split('<script>')[1].split('</script>')[0];
}

function loadPure(exportList) {
  const pure = scriptOf().split('function drawDial')[0];
  const ctx = {};
  new Function('exports', pure + '\nObject.assign(exports, { ' + exportList + ' });')(ctx);
  return ctx;
}

// The sync block sits below the DOM code, so it is pulled out separately and
// stitched onto the pure half, which is where `state` lives.
function loadWithSync(exportList) {
  const script = scriptOf();
  const pure = script.split('function drawDial')[0];
  const sync = '//' + script.split('// ---- Sync')[1].split('async function syncPull')[0];
  const ctx = {};
  new Function('exports', pure + sync + '\nObject.assign(exports, { ' + exportList + ' });')(ctx);
  return ctx;
}

// The validation helpers touch the DOM, so they get a stub element.
function loadValidation() {
  const script = scriptOf();
  const part = script.split('function fieldError')[1].split("\n['wakeTime'")[0];
  const box = { value: '', classList: { toggle() {} } };
  const document = { getElementById: () => box };
  const ctx = { box };
  new Function('document', 'exports', 'function fieldError' + part +
    '\nObject.assign(exports, { readCount });')(document, ctx);
  return ctx;
}

function runner(name) {
  let fails = 0;
  const check = (label, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (!ok) fails++;
    console.log((ok ? '  PASS  ' : '  FAIL  ') + label + (ok ? '' : '\n          got  ' + JSON.stringify(got) + '\n          want ' + JSON.stringify(want)));
  };
  const done = () => {
    console.log(fails === 0 ? '\n' + name + ': all checks passed.' : '\n' + name + ': ' + fails + ' FAILED');
    process.exit(fails === 0 ? 0 : 1);
  };
  return { check, done };
}

// Consecutive weekdays ending today, so recompute()'s walk to today does not
// count trailing gaps against the streak.
function weekdaysEndingToday(n) {
  const out = [];
  const d = new Date();
  while (out.length < n) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      out.push(d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'));
    }
    d.setDate(d.getDate() - 1);
  }
  return out.reverse();
}

module.exports = { loadPure, loadWithSync, loadValidation, runner, weekdaysEndingToday };
