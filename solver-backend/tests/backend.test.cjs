'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('./fixtures.cjs');
const { solveSync, solve, Solver, applySequence } = require('../src/index.cjs');
const { applyWord, enumerateGroup, allSwapQueries, shortestWitness, matches, identity } = require('./oracle.cjs');

function modelFor(fixture) {
  return {
    id: fixture.id, degree: fixture.degree,
    nodeIds: identity(fixture.degree).map(i => `node-${i}`),
    moves: fixture.moves.map((perm, index) => ({ name: `move-${index}`, perm })),
  };
}
const options = { maxMs: 10000, searchMs: 10000, maxSearchStates: 50000, maxSearchDepth: 30, group: false };

for (const fixture of fixtures) {
  test(`bounded solver matches exhaustive optimum: ${fixture.id}`, () => {
    const model = modelFor(fixture);
    const group = enumerateGroup(fixture.degree, fixture.moves);
    for (const query of allSwapQueries(fixture.degree)) {
      const expected = shortestWitness(group, query);
      const request = {
        protected: query.protected, swap: [query.a, query.b],
        mode: query.exact ? 'exact_swap' : 'protected_swap',
      };
      const result = solveSync(model, request, options);
      const label = `${fixture.id} ${JSON.stringify(request)}: ${JSON.stringify(result)}`;
      if (!expected) {
        assert.equal(result.status, 'impossible', label);
      } else {
        assert.equal(result.status, 'solved', label);
        assert.equal(result.optimal, true, label);
        assert.equal(result.moveIndices.length, expected.word.length, label);
        const permutation = applyWord(fixture.degree, fixture.moves, result.moveIndices);
        assert(matches(permutation, query), label);
        assert.deepEqual(result.permutation, permutation, label);
        assert.deepEqual(result.sequence, result.moveIndices.map(i => model.moves[i].name), label);
      }
    }
  });
}

test('endpoint protection allows temporary disturbance; throughout protection forbids it', () => {
  const fixture = fixtures.find(x => x.id === 'symmetric-3');
  const model = modelFor(fixture);
  const request = { protected: [0], swap: [1, 2] };
  const endpoint = solveSync(model, request, options);
  assert.equal(endpoint.status, 'solved');
  assert(endpoint.moveIndices.some(i => model.moves[i].perm[0] !== 0));
  const throughout = solveSync(model, { ...request, protection: 'throughout' }, options);
  assert.equal(throughout.status, 'impossible');
});

test('string node ids and canonical protected-set order match integer requests', () => {
  const model = modelFor(fixtures.find(x => x.id === 'symmetric-5'));
  const a = solveSync(model, { protected: [2, 3, 4], swap: [0, 1] }, options);
  const b = solveSync(model, { protected: ['node-4', 'node-2', 'node-3', 'node-2'], swap: ['node-0', 'node-1'] }, options);
  assert.equal(a.status, 'solved');
  assert.deepEqual(b.moveIndices, a.moveIndices);
  assert.deepEqual(b.protected, [2, 3, 4]);
});

test('state and depth limits return unknown, never an unproved impossibility', () => {
  const model = modelFor(fixtures.find(x => x.id === 'symmetric-5'));
  const request = { protected: [1, 2, 3], swap: [0, 4] };
  assert.equal(solveSync(model, request, options).status, 'solved');
  for (const limit of [{ maxSearchStates: 1 }, { maxSearchDepth: 0 }]) {
    const result = solveSync(model, request, { ...options, ...limit });
    assert.equal(result.status, 'unknown', JSON.stringify(result));
    assert.equal(result.optimal, false);
  }
});

test('bidirectional search honors every depth boundary and certifies the correct shortest length', () => {
  for (const id of ['symmetric-4-directed', 'alternating-4', 'symmetric-5']) {
    const fixture = fixtures.find(x => x.id === id);
    const model = modelFor(fixture);
    const group = enumerateGroup(fixture.degree, fixture.moves);
    for (const query of allSwapQueries(fixture.degree)) {
      const expected = shortestWitness(group, query);
      const request = { protected: query.protected, swap: [query.a, query.b], mode: query.exact ? 'exact_swap' : 'protected_swap' };
      const finalDepth = expected ? expected.word.length + 1 : 8;
      for (let depth = 0; depth <= finalDepth; depth++) {
        const result = solveSync(model, request, { ...options, maxSearchDepth: depth });
        const label = `${id} depth=${depth} ${JSON.stringify(query)} ${JSON.stringify(result)}`;
        if (expected && depth >= expected.word.length) {
          assert.equal(result.status, 'solved', label);
          assert.equal(result.optimal, true, label);
          assert.equal(result.moveIndices.length, expected.word.length, label);
        } else if (expected) {
          assert.equal(result.status, 'unknown', label);
          assert(result.lowerBound <= expected.word.length, label);
        } else {
          assert(['unknown', 'impossible'].includes(result.status), label);
        }
      }
    }
  }
});

test('public API can fall back to a verified stabilizer witness', () => {
  const fixture = fixtures.find(x => x.id === 'symmetric-4-directed');
  const model = modelFor(fixture);
  const query = { a: 0, b: 3, protected: [1, 2] };
  const result = solveSync(model, { protected: query.protected, swap: [query.a, query.b] }, {
    maxSearchDepth: 0, maxMs: 10000,
  });
  assert.equal(result.status, 'solved', JSON.stringify(result));
  assert.equal(result.verified, true);
  assert.equal(result.optimal, false); // a valid factorization is not a shortest-word proof
  assert.equal(Object.hasOwn(result, 'moves'), false);
  assert(matches(applyWord(fixture.degree, fixture.moves, result.moveIndices), query));
});

test('throughout protection survives stabilizer fallback and optional shortening', () => {
  const fixture = fixtures.find(x => x.id === 'symmetric-5');
  const model = modelFor(fixture);
  const request = { protected: [0], swap: [1, 4], protection: 'throughout' };
  const result = solveSync(model, request, { maxSearchDepth: 0, maxMs: 10000, shorten: true });
  assert.equal(result.status, 'solved', JSON.stringify(result));
  for (const action of result.moveIndices) assert.equal(model.moves[action].perm[0], 0);
  assert.equal(result.permutation[1], 4);
  assert.equal(result.permutation[4], 1);
});

test('malformed permutations and contradictory or unsupported requests are rejected', () => {
  const model = modelFor(fixtures.find(x => x.id === 'symmetric-3'));
  const request = { protected: [], swap: [0, 1] };
  const brokenModels = [
    { ...model, degree: 0 },
    { ...model, moves: [] },
    { ...model, moves: [{ name: 'bad', perm: [0, 0, 2] }] },
    { ...model, moves: [{ name: 'bad', perm: [0, 1, 3] }] },
    { ...model, moves: [{ name: 'bad', perm: [0, 1] }] },
    { ...model, moves: model.moves.map(x => ({ ...x, name: 'duplicate' })) },
    { ...model, moves: model.moves.map(x => ({ ...x, cost: 2 })) },
    { ...model, nodeIds: ['same', 'same', 'other'] },
    { ...model, nodeIds: 'abc' },
    { ...model, nodeIds: [0, 1, 2] },
    { ...model, stateDependentLegality: true },
    { ...model, supported: false },
    { ...model, fixedPermutation: false },
  ];
  for (const bad of brokenModels) assert.equal(solveSync(bad, request, options).status, 'invalid');
  const brokenRequests = [
    { swap: [0, 0] }, { swap: [0, 1], protected: [0] },
    { swap: ['missing', 1] }, { swap: [0, 4] }, { swap: [0] },
    { swap: [0, 1], protected: '0' },
    { swap: [0, 1], mode: 'unknown' },
    { swap: [0, 1], protection: 'unknown' },
  ];
  for (const bad of brokenRequests) assert.equal(solveSync(model, bad, options).status, 'invalid');
});

test('output length budget also caps short-search witnesses', () => {
  const model = modelFor(fixtures.find(x => x.id === 'symmetric-3'));
  const request = { swap: [0, 1] };
  const result = solveSync(model, request, { ...options, maxOutputMoves: 0 });
  assert.equal(result.status, 'unknown');
  assert.equal(result.reason, 'output_limit');
  assert.equal(result.optimal, false);
  assert.equal(result.requiredMoves, 1);
  assert.equal(result.moveIndices, undefined);
  assert.equal(result.sequence, undefined);
  assert.equal(result.moves, undefined);
});

test('tuple storage budget limits search before allocation and scales with protected nodes', () => {
  const model = modelFor(fixtures.find(x => x.id === 'symmetric-5'));
  const request = { swap: [0, 4], protected: [1, 2, 3] };
  for (const maxStorageBytes of [0, 1000]) {
    const result = solveSync(model, request, { ...options, maxStorageBytes });
    assert.equal(result.status, 'unknown', JSON.stringify(result));
    assert.equal(result.reason, 'storage_limit');
    assert(result.stats.estimatedBytes <= maxStorageBytes);
    assert.equal(result.stats.bytesPerState, 256 + 40 * model.degree);
  }
  const unconstrained = solveSync(model, { swap: [0, 4] }, { ...options, maxStorageBytes: 1000 });
  assert.equal(unconstrained.stats.bytesPerState, 256 + 40 * 2);
  assert.equal(unconstrained.status, 'unknown');
  assert.equal(unconstrained.reason, 'storage_limit');
});

test('finite resource option validation applies to sync and worker entry points', async () => {
  const model = modelFor(fixtures.find(x => x.id === 'symmetric-3'));
  const request = { swap: [0, 1] };
  const invalid = [
    { maxMs: NaN }, { maxMs: Infinity }, { maxMs: -1 }, { maxMs: 60001 },
    { searchMs: 0.5 }, { maxSearchDepth: NaN }, { maxSearchStates: Infinity },
    { maxSearchStates: 250001 }, { memoryMb: 257 }, { memoryMb: -1 },
    { maxDagNodes: 300001 }, { maxOutputMoves: 20001 },
    { maxStorageBytes: 128 * 1024 * 1024 + 1 }, { cacheBytes: 64 * 1024 * 1024 + 1 },
    { group: 'false' }, { shorten: 1 }, null,
  ];
  for (const input of invalid) {
    assert.equal(solveSync(model, request, input).status, 'invalid');
    assert.equal((await solve(model, request, input)).status, 'invalid');
  }
});

test('geometric pose-domain requests require current occupied nodes and protect physical stickers only', () => {
  const model = {
    id: 'sparse-pose-fixture', degree: 4, stickerCount: 2, requiresOccupiedState: true,
    nodeIds: ['a', 'b', 'empty-c', 'empty-d'],
    moves: [{ name: 'exchange', perm: [1, 0, 3, 2] }],
  };
  const request = { swap: ['a', 'b'], mode: 'exact_swap', occupiedNodes: ['a', 'b'] };
  const result = solveSync(model, request, options);
  assert.equal(result.status, 'solved', JSON.stringify(result));
  assert.deepEqual(result.protected, []);
  assert.deepEqual(result.moveIndices, [0]);
  assert.deepEqual(result.occupiedNodes, [0, 1]);
  assert.deepEqual(result.changedNodes, [0, 1]);
  assert.deepEqual(result.collateralNodes, []);
  assert.deepEqual(result.allChangedPoseAddresses, [0, 1, 2, 3]);
  assert.equal(solveSync(model, { ...request, occupiedNodes: undefined }, options).status, 'invalid');
  assert.equal(solveSync(model, { ...request, occupiedNodes: ['a'] }, options).status, 'invalid');
  assert.equal(solveSync(model, { ...request, occupiedNodes: ['a', 'a', 'b'] }, options).status, 'invalid');
  assert.equal(solveSync(model, { ...request, swap: ['a', 'empty-c'] }, options).status, 'invalid');
  assert.equal(solveSync(model, { ...request, protected: ['empty-c'] }, options).status, 'invalid');
  const thirdStickerModel = { ...model, stickerCount: 3 };
  const occupiedThree = { ...request, occupiedNodes: ['a', 'b', 'empty-c'] };
  assert.equal(solveSync(thirdStickerModel, occupiedThree, options).status, 'impossible');
});

test('execution helper uses chronological source-to-destination moves without mutating input', () => {
  const fixture = fixtures.find(x => x.id === 'symmetric-3');
  const model = modelFor(fixture);
  const labels = ['red-sticker', 'green-sticker', 'blue-sticker'];
  const before = labels.slice();
  const word = [0, 2]; // noncommuting pair catches chronological reversal
  const permutation = applyWord(fixture.degree, fixture.moves, word);
  const expected = Array(fixture.degree);
  permutation.forEach((to, from) => { expected[to] = labels[from]; });
  assert.deepEqual(applySequence(model, labels, word), expected);
  assert.deepEqual(labels, before);
});

test('worker API and bounded LRU cache preserve verified answers', async () => {
  const model = modelFor(fixtures.find(x => x.id === 'symmetric-3'));
  const request = { protected: [0], swap: [1, 2] };
  const direct = await solve(model, request, options);
  assert.equal(direct.status, 'solved');
  const solver = new Solver(model, { ...options, cacheBytes: 10000 });
  const first = await solver.solve(request);
  const cached = await solver.solve(request);
  assert.equal(first.status, 'solved');
  assert.equal(cached.cacheHit, true);
  assert.deepEqual(cached.moveIndices, first.moveIndices);
  assert(solver.bytes <= solver.maxBytes);
  cached.moveIndices.push(999);
  const fresh = await solver.solve(request);
  assert(!fresh.moveIndices.includes(999));
});

test('solver snapshots model and options so caller mutation cannot invalidate cached answers', async () => {
  const model = modelFor(fixtures.find(x => x.id === 'symmetric-3'));
  const callerOptions = { ...options, cacheBytes: 10000 };
  const solver = new Solver(model, callerOptions);
  const request = { protected: [0], swap: [1, 2] };
  const first = await solver.solve(request);
  assert.equal(first.status, 'solved');
  model.moves[0].perm.fill(0);
  callerOptions.maxMs = NaN;
  assert(Object.isFrozen(solver.model));
  assert(Object.isFrozen(solver.model.moves[0].perm));
  assert.throws(() => { solver.model = model; }, TypeError);
  const again = await solver.solve(request);
  assert.equal(again.cacheHit, true);
  assert.deepEqual(again.moveIndices, first.moveIndices);
  assert.equal((await solver.solve(request, { maxMs: NaN })).status, 'invalid');
});
