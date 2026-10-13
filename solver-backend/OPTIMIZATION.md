# Stabilizer-table refinement

The existing complete stabilizer bases and orbit entries are retained. This bounded offline pass found shorter stored words for 27 of 28 puzzle models. Tetraminx was examined with the same method, but no shorter word was found within the budget; its existing table is retained. These results do not claim globally shortest solutions.

The new optimizer collects short sift residues, improves duplicate generator words, considers generators at every eligible stabilizer level, schedules deeper levels first, and performs weighted orbit relaxation. A verified commuting-move rewrite exposes additional power and inverse reductions. Only exact full-permutation rewrites are used when simplifying an existing word. New representatives may change collateral motion while fixing the earlier base and reaching the same orbit node.

Each candidate was checked against its legal generator words and was accepted only when the conservative length bound, mean benchmark length, and 95th-percentile benchmark length did not increase. The benchmark uses the same 32 legal scrambles per model, with depths cycling through 5, 10, 20, 30, 50, and 80 moves. A generator, including a half-turn where available, has cost one. These are ordinary optimization and witness checks; the separate comprehensive group-coverage audit is run after publication.

Cache JSON totals 7,260,522 bytes, down from 7,767,847 bytes. Individual puzzle caches are loaded on demand.

| Puzzle | Previous bound | Refined bound | Previous mean | Refined mean |
|---|---:|---:|---:|---:|
| Cube 2×2 | 40 | 40 | 26.5 | 26.3 |
| Cube 3×3 | 139 | 133 | 79.9 | 74.1 |
| Cube 4×4 | 658 | 529 | 378.0 | 317.2 |
| Cube 5×5×5 | 1551 | 1006 | 817.1 | 534.4 |
| Cube 6×6×6 | 3906 | 2234 | 1988.6 | 1182.1 |
| Cube 7×7×7 | 9496 | 3502 | 4081.3 | 1706.2 |
| Mirror Cube | 143 | 134 | 80.4 | 72.7 |
| Homer | 41 | 40 | 26.8 | 26.3 |
| Pyraminx | 65 | 65 | 28.6 | 28.1 |
| Tetraminx | 56 | 56 | 31.7 | 31.7 |
| Megaminx | 1365 | 536 | 547.4 | 293.1 |
| Jing Pyraminx | 72 | 51 | 41.0 | 35.1 |
| Skewb | 69 | 60 | 42.6 | 42.5 |
| Master Skewb | 725 | 552 | 447.4 | 332.2 |
| Skewb Puzzleball | 101 | 89 | 61.8 | 53.0 |
| Skewb Diamond | 48 | 43 | 27.6 | 26.6 |
| Face-turning Octahedron | 593 | 371 | 320.2 | 230.7 |
| Pyraminx Crystal | 631 | 376 | 253.6 | 225.6 |
| Dino Cube | 41 | 39 | 21.4 | 20.9 |
| Rainbow Cube | 41 | 39 | 21.4 | 20.9 |
| Rhombic Dodecahedron Cube | 341 | 291 | 176.2 | 162.9 |
| Flat Diamond Cube | 304 | 235 | 135.5 | 113.7 |
| Corner-turning Octahedron | 173 | 151 | 89.1 | 80.2 |
| Trajber’s Octahedron | 415 | 344 | 206.5 | 188.6 |
| Christoph’s Jewel | 159 | 137 | 83.2 | 76.7 |
| Pyramorphix | 65 | 65 | 20.7 | 20.7 |
| MasterMorphix | 544 | 400 | 235.8 | 188.3 |
| Helicopter Cube | 306 | 214 | 117.5 | 88.8 |

The bound is the sum of the longest representative word at each base level. It bounds this solver’s path length, not the puzzle’s optimal distance. Changing collateral motion can alter later placements, so an individual state can occasionally take more moves even when the bound and benchmark statistics improve. The full-permutation word rewrites themselves cannot increase any state’s path length.

## Reproduce the refinement

Run `node tools/refine-caches.cjs` from the backend directory, or append model IDs for a subset. The default budgets are four seconds for smaller models and twenty seconds for degree 90 and above, with at most 12,000 retained candidate generators. MasterMorphix received one additional ten-second deterministic seed pass after a candidate failed the percentile gate. Exact-generator-compatible tables were also compared for Cube 2×2/Homer and Cube 3×3/Mirror; only a gated improvement to Cube 2×2 was accepted.

`data/full-solver/refinement-report.json` records the full before/after sample bank, acceptance decisions, accepted statistics, and transfer checks. Earlier `validation.json` and `report.json` are historical records of the original tables.

## Independent audit after publication

Only after the updated website is published, run:

```sh
node --expose-gc solver-backend/tools/audit-complete-coverage.cjs --expected-commit PUBLISHED_COMMIT --output /absolute/path/outside/site/final-solvability-audit.json
```

The command requires a clean source checkout and the expected published commit. It byte-compares each deployed cache with its audited backend copy and compares the deployed move permutations with the backend model. It then replays every representative, verifies its fixed prefix and orbit image, and independently recomputes the exact legal group order with complete Schreier closure. The cached orbit-size product must equal that order. Legal prefix-preserving representatives produce distinct transversal products, so this equality certifies complete coverage of the legal permutation group, rather than relying on sampled scrambles. The audit writes its report outside the published repository and checks that the source commit and worktree remained unchanged.
