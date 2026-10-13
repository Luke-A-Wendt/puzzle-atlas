'use strict';

// Fixtures use explicit action permutations, avoiding dependence on the puzzle
// exporters or production permutation helpers.
module.exports = [
  {
    id: 'trivial', degree: 3, expectedOrder: 1,
    moves: [[0, 1, 2]],
  },
  {
    id: 'cyclic-3', degree: 3, expectedOrder: 3,
    moves: [[1, 2, 0], [2, 0, 1]],
  },
  {
    id: 'symmetric-3', degree: 3, expectedOrder: 6,
    moves: [[1, 2, 0], [2, 0, 1], [1, 0, 2]],
  },
  {
    id: 'coupled-swap', degree: 4, expectedOrder: 2,
    moves: [[1, 0, 3, 2]],
  },
  {
    id: 'square-dihedral', degree: 4, expectedOrder: 8,
    moves: [[1, 2, 3, 0], [3, 0, 1, 2], [0, 3, 2, 1]],
  },
  {
    id: 'alternating-4', degree: 4, expectedOrder: 12,
    moves: [[1, 2, 0, 3], [2, 0, 1, 3], [1, 3, 2, 0], [3, 0, 2, 1]],
  },
  {
    id: 'symmetric-4', degree: 4, expectedOrder: 24,
    moves: [[1, 0, 2, 3], [0, 2, 1, 3], [0, 1, 3, 2]],
  },
  {
    id: 'symmetric-4-directed', degree: 4, expectedOrder: 24,
    // Inverse of the four-cycle is NOT supplied. A returned witness must use
    // actual input actions, or expand an inverse as three forward actions.
    moves: [[1, 2, 3, 0], [1, 0, 2, 3]],
  },
  {
    id: 'symmetric-5', degree: 5, expectedOrder: 120,
    moves: [[1, 0, 2, 3, 4], [0, 2, 1, 3, 4], [0, 1, 3, 2, 4], [0, 1, 2, 4, 3]],
  },
];
