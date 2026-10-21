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

Ordinary manual swaps protect colors at held locations and exchange the two selected sticker identities. Eligibility combines full-group negatives with catalog/strict positives. Bright choices require a retained verified word: before choosing 1, at least one verified partner exists; afterward, bright nodes are partners for that pair. Other choices are gray and unavailable for swapping, without claiming mathematical impossibility. The manual Select tool can still toggle gray nodes. Selecting endpoint 2 independently validates its word and starts after a short pause. Failed verification clears the pair while retaining manual holds.

Auto in the Hold controls is a persistent toggle backed by a separate verified **guided plan**. It retains the full incremental route and offers white-ringed Move ①/Move ② choices for the next stage. Each completed stage restores the previous secured set and adds at least one goal address; holds and next choices refresh automatically, without clicking Auto again. All offered choices for one stage reach the same certified next state. Move markers can describe a placement or cycle, so they are never silently presented as two-way Swap endpoints. Auto prevents hold edits and disables Clear. Select turns Auto off, retains the holds, and enables manual editing; clicking an active Auto returns to manual pair selection. Ordinary manual swaps retain their exact exchange semantics. Their white rings are only local endpoint-goal hints for ready exchanges with an unheld partner, not a complete-route guarantee.

The backend retains small legal-operation catalogs, exact inverse-preimage tuple search, cached strict fallback and resumable bounded-search APIs for programmatic use. The prior `ColorEligibilityAnalyzer.suggestHolds()` local endpoint heuristic remains callable, but no longer drives the browser Auto button. White rings have mode-specific meaning: certified next-stage choices in Auto, or local endpoint-color improvement in manual Select mode. Only the former inherits the finite-completion certificate.

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
- `src/monotone-plan.cjs`: certify the strictly growing secured sets and marker
  choices of an Auto-guided route retained for user-selected step playback.
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
