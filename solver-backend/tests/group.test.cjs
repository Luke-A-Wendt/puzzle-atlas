'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('./fixtures.cjs');
const { solveGroup } = require('../src/group.cjs');
const { enumerateGroup, allSwapQueries, shortestWitness, applyWord, matches, identity } = require('./oracle.cjs');

for (const fixture of fixtures) {
  test(`stabilizer transporter matches exhaustive feasibility: ${fixture.id}`, () => {
    const group = enumerateGroup(fixture.degree, fixture.moves);
    const model = { degree: fixture.degree, moves: fixture.moves.map((perm, i) => ({ name: `m${i}`, perm })) };
    for (const query of allSwapQueries(fixture.degree)) {
      const expected = shortestWitness(group, query);
      const protectedNodes = query.exact ? identity(fixture.degree).filter(i => i !== query.a && i !== query.b) : query.protected;
      const result = solveGroup({ model, protected: protectedNodes, swap: [query.a, query.b], budget: { maxMs: 10000 } });
      const label = `${fixture.id} ${JSON.stringify(query)}: ${JSON.stringify(result)}`;
      if (!expected) {
        assert.equal(result.status, 'impossible', label);
      } else {
        assert.equal(result.status, 'solved', label);
        const word = result.moveIndices ?? result.moves;
        assert(matches(applyWord(fixture.degree, fixture.moves, word), query), label);
        if (result.optimal) assert.equal(word.length, expected.word.length, label);
      }
    }
  });
}

test('stabilizer resource exhaustion never becomes impossibility', () => {
  const fixture = fixtures.find(x => x.id === 'symmetric-5');
  const model = { degree: fixture.degree, moves: fixture.moves.map((perm, i) => ({ name: `m${i}`, perm })) };
  for (const budget of [{ maxStrongGenerators: 0 }, { maxDagNodes: 1 }, { maxOrbitStates: 1 }, { maxSchreierTests: -1 }]) {
    const result = solveGroup({ model, protected: [1, 2, 3], swap: [0, 4], budget: { maxMs: 10000, ...budget } });
    assert.equal(result.status, 'unknown', JSON.stringify(result));
  }
});
