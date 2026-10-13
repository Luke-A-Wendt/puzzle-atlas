'use strict';
const assert = require('node:assert/strict');

// These engine UI suites deliberately use a minimal DOM without solver workers.
// Actual planning/playback is covered by auto-solve-ui/worker tests. Here the
// controller must delegate and must not alter state or silently reverse history.
module.exports = function assertAutoSolveDelegates(context, accepted = true) {
  const previous = context.ConstrainedSolverUI;
  const before = JSON.stringify(context.PUZZLE_API.snapshot());
  let calls = 0;
  context.ConstrainedSolverUI = { autoSolve() { calls++; return accepted; } };
  try {
    assert.equal(context.PUZZLE_API.solve(), accepted);
    assert.equal(calls, 1);
    assert.equal(JSON.stringify(context.PUZZLE_API.snapshot()), before, 'Delegating cannot play or erase any recorded move');
  } finally {
    if (previous === undefined) delete context.ConstrainedSolverUI;
    else context.ConstrainedSolverUI = previous;
  }
};
