'use strict';

// Deliberately independent, exhaustive reference implementation. These helpers
// are for tiny test groups only; the backend never needs this full-state table.
// Convention: p[source] = destination; chronological actions act on the left.
function identity(degree) {
  return Array.from({ length: degree }, (_, i) => i);
}

function compose(left, right) {
  if (left.length !== right.length) throw new Error('degree mismatch');
  return right.map(destination => left[destination]);
}

function inverse(permutation) {
  const result = Array(permutation.length);
  for (let source = 0; source < permutation.length; source++) {
    result[permutation[source]] = source;
  }
  return result;
}

function applyWord(degree, moves, word) {
  let result = identity(degree);
  for (const action of word) {
    const move = moves[action];
    if (!move) throw new Error(`Unknown action index ${action}`);
    result = compose(move, result);
  }
  return result;
}

function enumerateGroup(degree, moves) {
  if (!Number.isInteger(degree) || degree < 1 || degree > 6) {
    throw new Error('The exhaustive test oracle is intentionally limited to degree <= 6.');
  }
  const root = { permutation: identity(degree), word: [] };
  const nodes = [root];
  const seen = new Set([root.permutation.join(',')]);
  for (let head = 0; head < nodes.length; head++) {
    const { permutation, word } = nodes[head];
    moves.forEach((move, action) => {
      const next = compose(move, permutation);
      const key = next.join(',');
      if (seen.has(key)) return;
      seen.add(key);
      nodes.push({ permutation: next, word: word.concat(action) });
    });
  }
  return nodes;
}

function matches(permutation, { a, b, protected: protectedNodes = [], exact = false }) {
  if (permutation[a] !== b || permutation[b] !== a) return false;
  if (!protectedNodes.every(position => permutation[position] === position)) return false;
  if (exact) {
    for (let position = 0; position < permutation.length; position++) {
      if (position !== a && position !== b && permutation[position] !== position) return false;
    }
  }
  return true;
}

function shortestWitness(group, query) {
  return group.find(node => matches(node.permutation, query)) || null;
}

function subsets(values) {
  const result = [];
  for (let mask = 0; mask < 2 ** values.length; mask++) {
    result.push(values.filter((_, index) => mask & (1 << index)));
  }
  return result;
}

function allSwapQueries(degree) {
  const queries = [];
  for (let a = 0; a < degree; a++) {
    for (let b = a + 1; b < degree; b++) {
      const others = identity(degree).filter(position => position !== a && position !== b);
      for (const protectedNodes of subsets(others)) {
        for (const exact of [false, true]) {
          queries.push({ a, b, protected: protectedNodes, exact });
        }
      }
    }
  }
  return queries;
}

module.exports = {
  identity, compose, inverse, applyWord, enumerateGroup,
  matches, shortestWitness, subsets, allSwapQueries,
};
