# Puzzle Atlas solver backend

This directory keeps the exact permutation algorithms, puzzle move models,
complete stabilizer caches, precomputation tools, and engine fixtures used by the
website. It is versioned with the site, but is not shipped as a server: production
runs the generated solver in a browser worker.

From the repository root:

```sh
node scripts/build-constrained-solver.cjs
node --test solver-backend/tests/*.test.cjs
node --test tests/auto-solver-worker.test.cjs tests/constrained-solver-worker.test.cjs
node --test tests/eligibility-worker.test.cjs
```

The builder generates `dist/games/constrained-solver-core.js`,
`constrained-solver-worker.js`, and the adjacent move-model/cache directories.
It records the actual engines' solved sticker addresses and SHA-256 fingerprints
for all lazily fetched assets. A deployment needs only `dist/`.

## Color-aware behavior

The website requests color holds at fixed locations; A/B still exchange their selected sticker identities. A compact legal-operation catalog and exact inverse-preimage tuple search expand the successful requests, with the cached strict solver retained as a bounded positive fallback. The browser keeps the tuple-search session between checks: its explored records, parents, queue position and next move index survive a time slice. Continue raises the total planning allowance from 3 to 10, 30 and finally 60 seconds. A state, storage or final-time limit ends that attempt honestly as unknown; no further identical retry is offered. A strict negative cannot prove a color request impossible. Eligibility combines full-group negatives with catalog/strict positives. Bright choices separately require a retained verified word; unresolved or mathematically feasible choices without a word are moderately dim with a question mark and remain selectable through Check & solve. Go executes a stored ready witness after independent validation, without repeating its search.

For explicitly safe fully occupied color goals, Auto Solve shortens the existing exact legal witness by deleting color loops, using bounded one-move shortcuts and merging identity-only progress stages. Shape/picture models keep exact goals. Accepted plans have no more turns or stages than their baseline; the pass adds bounded planning compute and does not claim shortest solutions.

See [`COLOR_SOLVER.md`](COLOR_SOLVER.md) for the complete algorithms, API, cache contracts, budgets and measured validation.

## Interfaces

- `src/index.cjs`: bounded two-node constrained swaps, independent verification,
  and the Node worker wrapper.
- `src/manual-session.cjs`: progressive manual construction with a retained
  catalog cursor, exact preimage BFS frontier and explicit terminal limits.
- `src/color-solve.cjs`: legal short-operation witnesses, exact bounded preimage
  tuple search, and a strict positive fallback for endpoint color holds.
- `src/color-eligibility.cjs`: sound positive/negative proof bounds for relaxed
  color requests, separate retained-witness readiness, and full-color cache keys.
- `src/cached-swap.cjs`: word-aware base reordering of the complete cache and
  weighted pair transport, avoiding a fresh chain build for each held set.
- `src/atlas-adapter.cjs`: convert current game snapshots to permutation-node
  addresses, including geometric addresses for shape-changing puzzles.
- `src/full-solve.cjs`: precompute a complete stabilizer chain and construct a
  full solution from current sticker positions. No move journal is read.
- `src/auto-adapter.cjs`: record solved progress and independently verify every
  proposed auto-solve stage, its retained constraints, and the final state.
- `src/eligibility.cjs`: exact candidate-swap eligibility for arbitrary held
  nodes, with compact three-state results and bounded computation. See
  `ELIGIBILITY.md` for the algorithm, worker contract, and resource behavior.

The Auto Solve baseline restores labeled stickers to their home addresses in successive
placements. A supported color plan may instead finish with every goal color correct. Previously constrained nodes return to their fixed positions at each
stage boundary; they may move during the individual turns within that stage.
Other nodes may move as needed. Such a stage is not necessarily an isolated
transposition. The complete plan is verified before animation starts.

A solved result provides an exact legal sequence; it does not generally certify
that the sequence is shortest. A complete stabilizer chain can prove an
incompatible state impossible. Time, storage, or output limits return `unknown`
without executing a partial plan. Helicopter jumbling is outside the exported
fixed-permutation model; normal half-turn states are supported.

## Cache regeneration

The checked-in tables are already complete. Rebuilding them is an offline task,
not a startup requirement for users. To intentionally rebuild one model:

```sh
node solver-backend/tools/precompute-full.cjs cube2
node solver-backend/tools/optimize-cache.cjs cube2
node solver-backend/tools/verify-full-caches.cjs
node solver-backend/tools/precompute-color.cjs
node solver-backend/tools/verify-color-precompute.cjs
node scripts/build-constrained-solver.cjs
```

Larger puzzles may need a higher explicit precomputation budget through the
exported `precomputeFull` function. Keep the current complete cache if an attempted
rebuild reaches a limit. Representative shortening preserves legal witnesses and
stabilizer orbits while reducing animation length. Validate replacement tables
and run the browser replay tests before deploying them.

See `FULL_SOLVER.md` for the algorithm and the saved cache validation report under
`data/full-solver/` for the checked-in build's evidence.
