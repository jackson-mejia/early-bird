#!/usr/bin/env node
//
// Prints every synced log in the KV namespace: one row per sync code, with the
// same totals the app itself shows.
//
//   node tools/report.js            summary table
//   node tools/report.js --days     also list each logged day
//
// Scoring is pulled straight out of index.html rather than reimplemented, so
// this can never drift from what she sees on her phone.
//
// Read-only. It lists and gets keys; it never writes or deletes.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const NAMESPACE = /id\s*=\s*"([^"]+)"/.exec(fs.readFileSync(path.join(ROOT, 'worker/wrangler.toml'), 'utf8'))[1];
const SHOW_DAYS = process.argv.includes('--days');

function wrangler(args) {
  return execFileSync('npx', ['wrangler'].concat(args), {
    cwd: path.join(ROOT, 'worker'),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore']
  });
}

// The app's own scoring, lifted from the page.
function loadScoring() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const script = html.split('<script>')[1].split('</script>')[0];
  const pure = script.split('function drawDial')[0];
  const ctx = {};
  new Function('exports', pure + '\nObject.assign(exports, { recompute, fmtPts, greTier, setState: s => state = s });')(ctx);
  return ctx;
}

function main() {
  const scoring = loadScoring();

  let keys;
  try {
    keys = JSON.parse(wrangler(['kv', 'key', 'list', '--namespace-id=' + NAMESPACE, '--remote']));
  } catch (e) {
    console.error('Could not list keys. Is `npx wrangler login` still valid?');
    process.exit(1);
  }

  if (!keys.length) {
    console.log('No synced logs yet.\n');
    console.log('Nothing has turned sync on, so nothing has been uploaded. Anyone using the app');
    console.log('without sync keeps their history in their own browser and it never lands here.');
    return;
  }

  const rows = keys.map(k => {
    let state;
    try {
      state = JSON.parse(wrangler(['kv', 'key', 'get', '--namespace-id=' + NAMESPACE, '--remote', k.name]));
    } catch (e) {
      return { code: k.name, broken: true };
    }
    const entries = (state && state.entries) || {};
    const dates = Object.keys(entries).sort();
    scoring.setState({ entries, rewards: (state && state.rewards) || [] });
    const calc = scoring.recompute();

    const gre = ((state && state.rewards) || []).find(r => r.type === 'event');
    const tier = gre ? scoring.greTier(gre.score) : null;

    return {
      code: k.name,
      days: dates.length,
      total: scoring.fmtPts(calc.total),
      streak: calc.streak,
      first: dates[0] || '—',
      last: dates[dates.length - 1] || '—',
      questions: dates.reduce((s, d) => s + (Number(entries[d].questions) || 0), 0),
      minutes: dates.reduce((s, d) => s + (Number(entries[d].studyMin) || 0), 0),
      gre: tier ? tier.label : (gre && gre.score ? 'scored ' + gre.score : '—'),
      entries,
      dates
    };
  });

  const w = (s, n) => String(s).padEnd(n);
  console.log('');
  console.log(w('sync code', 26) + w('days', 6) + w('points', 8) + w('streak', 8) + w('mins', 7) + w('qs', 6) + w('last logged', 13) + 'GRE');
  console.log('-'.repeat(100));
  rows.forEach(r => {
    if (r.broken) { console.log(w(r.code, 26) + 'could not be read'); return; }
    console.log(w(r.code, 26) + w(r.days, 6) + w(r.total, 8) + w(r.streak, 8) + w(r.minutes, 7) + w(r.questions, 6) + w(r.last, 13) + r.gre);
  });
  console.log('');
  console.log(rows.length + ' synced ' + (rows.length === 1 ? 'log' : 'logs') + '. A log only appears here once sync is turned on for it.');

  if (SHOW_DAYS) {
    rows.filter(r => !r.broken).forEach(r => {
      console.log('\n' + r.code);
      scoring.setState({ entries: r.entries, rewards: [] });
      const calc = scoring.recompute();
      r.dates.forEach(d => {
        const e = r.entries[d];
        console.log('  ' + d + '  ' + w(e.wake || '—', 7) + w((e.studyMin || 0) + 'm', 6) + w((e.questions || 0) + 'q', 6) + '+' + scoring.fmtPts(calc.points[d] || 0));
      });
    });
  }
}

main();
