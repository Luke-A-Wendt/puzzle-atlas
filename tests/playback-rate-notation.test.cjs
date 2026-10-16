'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const {createPage} = require('./solver-dom.cjs');
const games = path.join(__dirname, '../dist/games');
const puzzles = fs.readdirSync(games).filter(name => name.endsWith('.html') && fs.readFileSync(path.join(games, name), 'utf8').includes('id="notationButtons"')).map(name => name.slice(0, -5));
const physical = app => { const state = app.snapshot(); return state.stickers || state.pieces; };
function settle(app) { for (let n = 0; n < 500; n++) { const state = app.snapshot(); if (!state.animating && state.mode === 'idle') return; app.frame(2000); } throw Error('Unfinished notation turn'); }

for (const puzzle of puzzles) test(puzzle + ': explicit notation pairs preserve native moves, inverse and busy locks', () => {
  const app = createPage(puzzle), api = app.context.PUZZLE_API;
  const pairs = app.document.querySelectorAll('.notation-pair');
  assert(pairs.length > 0);
  assert.equal(app.element('notationButtons').classList.contains('notation-has-long-labels'), pairs.some(pair => pair.children[1].textContent.length >= 4), 'one size class keeps every notation button in this puzzle uniform');
  assert(app.element('notationInverse').hidden && app.element('notationInverse').disabled);
  for (const pair of pairs) {
    assert.equal(pair.children.length, 2);
    const [forward, inverse] = pair.children;
    assert.equal(forward.dataset.face, inverse.dataset.face);
    assert.equal(forward.dataset.direction, '1'); assert.equal(inverse.dataset.direction, '-1');
    assert.equal(inverse.textContent, forward.textContent + '′');
    assert(forward.title.includes('clockwise')); assert(inverse.title.includes('counterclockwise'));
  }
  // Include both outer and deep/lowercase axes on families that have them.
  for (const pair of new Set([pairs[0], pairs.at(-1)])) for (const button of pair.children) {
    api.reset();
    const move = {face:button.dataset.face, dir:Number(button.dataset.direction)};
    assert.equal(api.move(move), true); settle(app); const expected = physical(app);
    api.reset(); button.click(); assert.equal(app.snapshot().animating, true);
    for (const key of app.document.querySelectorAll('.notation-key')) assert.equal(key.disabled, true);
    const before = app.snapshot().history.length; pair.children[1].click();
    assert.equal(app.snapshot().history.length, before, 'busy inverse click cannot queue an extra move');
    settle(app); assert.deepEqual(physical(app), expected);
    const opposite = pair.children[button.dataset.direction === '1' ? 1 : 0]; opposite.click(); settle(app);
    const restored = physical(app); api.reset(); assert.deepEqual(restored, physical(app), 'opposite named moves undo each other');
  }
});

test('top speed selector owns visible rate and keyboard order; range is an internal compatibility control', () => {
  const app = createPage('cube2'), actions = app.document.querySelector('.action-group');
  app.context.PUZZLE_API.reset();
  assert.deepEqual(actions.children.map(el => el.id || el.className), ['randomize','solve','pause','journal-transport','playbackSpeedControl','reset','journalActivity']);
  const speed = app.element('speed'), select = app.element('playbackSpeed');
  assert.equal(speed.hidden, true); assert.equal(speed.tabIndex, -1);
  assert.equal(speed.closest('.view-speed-control').hidden, true);
  assert.equal(select.value, '3');
  assert.deepEqual(select.children.map(option => option.textContent), ['0.5×','0.75×','1×','1.5×','2×','4×','8×']);
  select.value = '1'; select.dispatch('change'); assert.equal(speed.value, '1');
  speed.value = '5'; speed.dispatch('input'); assert.equal(select.value, '5', 'explicit fast choice reflects 2×');
  speed.value = '3'; speed.dispatch('input'); assert.equal(select.value, '3', 'explicit normal choice reflects 1×');
});

for (const puzzle of ['cube2','cube8','megaminx','skewb','helicopter','ghost']) test(puzzle + ': actual turn times scale by the displayed playback rate', () => {
  const app = createPage(puzzle), api = app.context.PUZZLE_API;
  const button = app.document.querySelector('.notation-key');
  for (const [position, rate] of [[1,.5],[2,.75],[3,1],[4,1.5],[5,2],[6,4],[7,8]]) {
    api.reset(); const select = app.element('playbackSpeed'); select.value = String(position); select.dispatch('change');
    const expected = 450 / rate;
    assert.equal(app.context.PuzzlePlaybackControls.duration(position), expected);
    button.click(); assert.equal(app.snapshot().animating, true);
    app.frame(expected - 1); assert.equal(app.snapshot().animating, true, rate + '× remains in its one legal move until the duration ends');
    app.frame(1); assert.equal(app.snapshot().animating, false, rate + '× commits at exactly ' + expected + ' ms');
  }
});

test('changing playback rate mid-turn keeps continuous progress and changes the remaining duration', () => {
  const app = createPage('cube2'); app.context.PUZZLE_API.reset();
  const select = app.element('playbackSpeed'); select.value = '3'; select.dispatch('change');
  app.document.querySelector('.notation-key').click(); app.frame(225);
  select.value = '5'; select.dispatch('change'); // half of a 225 ms turn remains
  app.frame(112); assert.equal(app.snapshot().animating, true);
  app.frame(.5); assert.equal(app.snapshot().animating, false);
});

test('randomize and stop retain the explicit playback selection', () => {
  for (const puzzle of ['cube2','axis','ghost','megaminx','skewb','helicopter']) {
    const app = createPage(puzzle), api = app.context.PUZZLE_API;
    const select=app.element('playbackSpeed');select.value='6';select.dispatch('change');
    api.reset(); assert.equal(select.value, '6');
    api.randomize(); assert.equal(select.value, '6', puzzle + ' retains 4×');
    assert.equal(api.stopScrambleNow(), true);
    assert.equal(select.value, '6', puzzle + ' retains 4× after stopping');
  }
});
