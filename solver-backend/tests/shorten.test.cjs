'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('./fixtures.cjs');
const { shorten } = require('../src/shorten.cjs');
const { applyWord } = require('./oracle.cjs');

test('bounded word shortening preserves complete permutations for noncommuting directed moves', () => {
  const fixture = fixtures.find(x => x.id === 'symmetric-4-directed');
  const model = { degree: fixture.degree, moves: fixture.moves.map((perm, i) => ({ name: `m${i}`, perm })) };
  const words = [
    [], [0], [0, 0, 0, 0], [1, 1], [0, 1, 0, 0, 0],
    [0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0],
  ];
  for (const word of words) {
    const original = word.slice();
    const result = shorten(model, word, { maxMs: 1000 });
    assert.deepEqual(applyWord(fixture.degree, fixture.moves, result.moveIndices), applyWord(fixture.degree, fixture.moves, word));
    assert(result.moveIndices.length <= word.length);
    assert.equal(result.shortenedBy, word.length - result.moveIndices.length);
    assert.deepEqual(word, original);
  }
  assert.deepEqual(shorten(model, [0, 0, 0, 0]).moveIndices, []);
  assert.deepEqual(shorten(model, [1, 1]).moveIndices, []);
  const limited = shorten(model, words[5], { maxBytes: 0 });
  assert.equal(limited.limited, true);
  assert.deepEqual(limited.moveIndices, words[5]);
});
