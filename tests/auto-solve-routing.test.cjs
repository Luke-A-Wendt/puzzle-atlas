'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHarness } = require('./game-harness.cjs');
const puzzles = ['cube2','cube3','cube4','cube5','cube6','cube7','mirror','homer','pyraminx','tetraminx','megaminx','jing','skewb','masterskewb','ultimate','diamond','fto','crystal','dino','rainbow','rhombic','flatdiamond','cornerocta','trajber','jewel','pyramorphix','mastermorphix','helicopter'];
function solved(app) { return app.snapshot().solved ?? app.elements.get('status').textContent.includes('● Solved'); }
function page(puzzle) { return createHarness({ htmlPath: path.join(__dirname, '../dist/games', puzzle + '.html'), bundled: true, speed: 5 }); }
for (const puzzle of puzzles) test(puzzle + ': Auto Solve delegates; engine playback and Undo stay unchanged', () => {
  const app = page(puzzle), api = app.context.PUZZLE_API;
  let calls = 0;
  app.context.ConstrainedSolverUI = { autoSolve() { calls++; return true; } };
  assert.equal(api.solve(), false, 'Already solved states need no sequence');
  assert.equal(calls, 0);
  const face = app.snapshot().selected;
  assert.equal(api.move({ face, dir: 1, turns: 1 }), true);
  assert.equal(api.solve(), false, 'Active atomic moves still block a new solve');
  app.complete();
  assert.equal(solved(app), false);
  assert.equal(app.elements.get('solve').disabled, false);
  const snapshot = app.snapshot();
  assert.equal(api.solve(), true);
  assert.equal(calls, 1);
  assert.deepEqual(app.snapshot(), snapshot, 'Delegation itself neither reverses history nor moves a sticker');
  app.click('solve');
  assert.equal(calls, 2, 'The button and public API share the same delegate');
  delete app.context.ConstrainedSolverUI;
  assert.equal(api.solve(), false, 'Unavailable solver has no journal-reversal fallback');
  assert.match(app.elements.get('toast').textContent, /Constrained Solver is unavailable/);
  assert.deepEqual(app.snapshot(), snapshot);
  app.click('undo');
  app.complete();
  assert.equal(solved(app), true, 'Ordinary Undo remains intact');
  assert.equal(api.runMoves([{ face, dir: 1, turns: 1 }], { label: 'Auto Solve · constrained step 1/2' }), true);
  app.complete();
  assert(app.snapshot().journal.some(entry => entry.label === 'Auto Solve · constrained step 1/2'));
  assert.equal(app.snapshot().history.length, 1, 'Constrained stages use regular legal recorded moves');
  api.reset();
  assert.equal(api.runMoves([{ face, dir: 1, turns: 1 }]), true);
  app.complete();
  assert(app.snapshot().journal.some(entry => entry.label === 'Guide practice'), 'Existing guide callers keep the default label');
});

test('An unsolved imported cube state with no journal still enables Auto Solve', () => {
  // Test-only fixture: initialize the real controller from a legal non-solved
  // state without creating history. No import/debug API is added to production.
  const read = fs.readFileSync;
  let injections = 0;
  fs.readFileSync = function (filename, options) {
    const data = read.call(this, filename, options);
    if (String(filename).endsWith('/dist/games/cube2.html') && typeof data === 'string') {
      injections++;
      return data.replace('let stickers=E.makeSolved(),history=[]', "let stickers=E.applyMove(E.makeSolved(),{face:'R',dir:1,turns:1}),history=[]");
    }
    return data;
  };
  let app;
  try { app = page('cube2'); } finally { fs.readFileSync = read; }
  assert.equal(injections, 1);
  assert.equal(solved(app), false);
  assert.equal(app.snapshot().history.length, 0);
  assert.equal(app.elements.get('solve').disabled, false);
  assert.equal(app.elements.get('undo').disabled, true);
  let calls = 0;
  app.context.ConstrainedSolverUI = { autoSolve() { calls++; return true; } };
  assert.equal(app.context.PUZZLE_API.solve(), true);
  app.click('solve');
  assert.equal(calls, 2);
  assert.equal(app.snapshot().history.length, 0);
});
