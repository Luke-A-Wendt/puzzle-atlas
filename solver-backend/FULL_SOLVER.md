# Full-state constrained solving

`src/full-solve.cjs` adds a full-state solver to the protected-swap backend. It reads the current positions of labeled stickers and their solved positions. It never reads or reverses the move journal.

The algorithm below is the complete identity-correct baseline. Supported fixed, fully occupied color puzzles now receive a bounded verified post-pass that removes color loops, adds one-move edges along the witnessed route and merges stages with no new secured colors. Shape/picture models keep the strict goal. Color plans declare `goalSemantics: 'colors'`, preserve colors at secured stage endpoints, and may use different sticker identities there. They never increase baseline move or stage count. See [`COLOR_SOLVER.md`](COLOR_SOLVER.md) for the complete second-pass algorithm and verification contract.

## API

```js
const { precomputeFull, solveFull } = require('./src/full-solve.cjs');
const cache = precomputeFull(model, { maxMs: 30000 }); // offline
const result = solveFull(model, {
  homeBySticker: { stickerA: 0, stickerB: 1 /* every physical sticker */ },
  currentBySticker: { stickerA: 1, stickerB: 0 /* current addresses */ }
}, { cache, maxMs: 30000, maxOutputMoves: 20000 });
```

Each mapping contains `stickerCount` entries, with distinct integer addresses in `[0, degree)`. For ordinary fixed-slot models, every address is occupied. Pose-expanded models have additional virtual addresses: only physical sticker home positions are required to be solved; unused addresses remain unconstrained.

The result is `solved`, `impossible`, `unknown`, or `invalid`. A successful result includes:

- `initialProtectedNodes`: an already-correct prefix of the precomputed base.
- `stages`: chronological objects containing `sourceNode`, `targetNode`, `protectedNodes`, `newlySolvedNodes`, and `moveIndices`.
- `moveIndices`: all staged moves concatenated.
- `finalProtectedNodes`: every actual solved home address.
- `verified: true`: the complete witness was replayed and all requested conditions checked.

For an identity-baseline plan, `protectedNodes` are fixed by a stage's **net permutation**. In a color plan their **colors** are restored instead, and the net permutation may exchange equal-colored occupants. They may move temporarily during its constituent turns. Only nodes explicitly locked by the staged solver are protected; an incidentally correct node outside the prefix may move again. A stage usually places a desired sticker at its home position with collateral motion on unlocked nodes. It need not exchange precisely two stickers: a literal two-node transposition can be illegal even in a solvable state.

## Exact algorithm

Let `d = model.degree`, and let the legal moves be permutations `P_1, ..., P_m` on `d` addresses, represented as arrays of `d` integers. Let `G = <P_1, ..., P_m>` and choose a base ordering `b_1, ..., b_d`. Define

\[
G_k = \{g\in G: g(b_1)=b_1,\ldots,g(b_k)=b_k\}.
\]

Offline deterministic Schreier closure computes a complete stabilizer chain. At level `k`, it stores a representative `r_{k,x}` for every address in the orbit of `b_k` under `G_{k-1}`:

\[
r_{k,x}(b_k)=x,\qquad r_{k,x}\in G_{k-1}.
\]

If the sticker whose home is `b_k` currently occupies `x`, apply the legal move word for `r_{k,x}^{-1}`. It sends that sticker home and fixes every previously locked address. Then lock `b_k` and any immediately following already-correct base nodes. Repeating gives a finite exact solution for every legal state represented by the model.

A missing orbit entry proves the requested labeled state cannot reach the goal through this legal move set. Time, storage, or output limits yield `unknown`, never an impossibility claim.

The chain stores compact word DAGs and representative permutations. It does **not** enumerate all puzzle configurations or all protected subsets. The offline optimizer replaces representatives only with shorter legal words having the same base-image requirement and fixing the earlier base. It repeatedly sifts short legal words and their Schreier residues through the existing table. This preserves exactness and the complete orbit certificate while reducing playback length substantially.

For an optimized cache, `stats.optimization.solutionLengthUpperBound` is the sum of the longest stored representative word at each level. It is a conservative upper bound on this algorithm's solution length for every legal labeled state, not an optimal-distance bound. Optional runtime adjacent-word shortening (`shorten: true`) may reduce it further; it is off by default because the offline tables already have short words. The algorithm does not promise globally shortest solutions.

## Regenerating caches

From the backend directory:

```sh
node tools/precompute-full.cjs cube2 cube3
node tools/optimize-cache.cjs cube2 cube3
```

The first command allows 60 seconds per model (150 seconds and an alternative complete builder for Cube 7×7) and keeps explicit `unknown` results on a resource cutoff. It overwrites the specified caches, so optimize and validate before publishing them. To give a difficult offline compilation more time:

```js
const cache = precomputeFull(model, {
  maxMs: 150000,
  algorithm: 'unweighted', // an alternative complete Schreier builder
  maxStorageBytes: 160 * 1024 * 1024
});
```

The browser loads only the selected puzzle's cache when Auto Solve is used. It must integrity-check the asset, map the actual engine snapshot, verify the stages, and execute each stage in order. Do not truncate a long sequence. Disallow concurrent user moves while planning/executing; revalidate the current snapshot before starting. Helicopter's supported group includes ordinary half-turn moves, not state-dependent jumbling.

## Further offline refinement and publication audit

See `OPTIMIZATION.md` and `data/full-solver/refinement-report.json` for the latest bounded word-shortening results. `tools/refine-caches.cjs` performs candidate witness checks and a fixed-bank benchmark gate. The separate `tools/audit-complete-coverage.cjs` is intentionally run only after website publication; it certifies the exact published caches against freshly computed legal-group orders without modifying the published source.
