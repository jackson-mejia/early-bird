#!/usr/bin/env node
// Runs every suite. node tests/run.js
const { execFileSync } = require('child_process');
const path = require('path');
const suites = ['scoring.test.js', 'sync.test.js', 'validation.test.js'];
let failed = 0;
suites.forEach(s => {
  try {
    execFileSync('node', [path.join(__dirname, s)], { stdio: 'inherit' });
  } catch (e) { failed++; }
});
console.log(failed === 0 ? '\nAll suites passed.' : '\n' + failed + ' suite(s) failed.');
process.exit(failed === 0 ? 0 : 1);
