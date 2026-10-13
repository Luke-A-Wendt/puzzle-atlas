'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('./fixtures.cjs');
const { identity, compose, inverse, applyWord, enumerateGroup, shortestWitness } = require('./oracle.cjs');

test('independent tiny-group oracle reconstructs chronological words', () => {
  for (const fixture of fixtures) {
    const group = enumerateGroup(fixture.degree, fixture.moves);
    assert.equal(group.length, fixture.expectedOrder, fixture.id);
    for (const node of group) {
      assert.deepEqual(applyWord(fixture.degree, fixture.moves, node.word), node.permutation);
      assert.deepEqual(compose(inverse(node.permutation), node.permutation), identity(fixture.degree));
    }
  }
});

test('protected points and exact swap are materially different requests', () => {
  const fixture = fixtures.find(x => x.id === 'coupled-swap');
  const group = enumerateGroup(fixture.degree, fixture.moves);
  assert.equal(shortestWitness(group, { a: 0, b: 1, protected: [] }).word.length, 1);
  assert.equal(shortestWitness(group, { a: 0, b: 1, protected: [2] }), null);
  assert.equal(shortestWitness(group, { a: 0, b: 1, exact: true }), null);
});

test('point transportability does not imply an exchange is possible', () => {
  const fixture = fixtures.find(x => x.id === 'cyclic-3');
  const group = enumerateGroup(fixture.degree, fixture.moves);
  assert(group.some(x => x.permutation[0] === 1));
  assert.equal(shortestWitness(group, { a: 0, b: 1 }), null);
});
