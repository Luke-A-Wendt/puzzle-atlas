# Atlas permutation adapter audit

This backend exports the **existing simulator's move action**. It does not
change or deploy the website and does not claim a new mechanical validation of
every physical commercial puzzle. `data/manifest.json` inventories 28 puzzles.

## Convention

Each `moves[i].perm` is an integer destination list: a token at position `a`
moves to position `perm[a]`. A chronological move sequence updates its current
position by repeatedly looking up that list. `moves[i].inverse` is the index
of an inverse move; `engineMove` is the object accepted by the saved engine.
The cost metric assigns one step to each exported nonidentity rotation,
including a half/double turn. All permitted single slices of the Atlas cube
engines are included, not just the six outer faces.

`nodeIds` refer to spatial addresses, **not the currently occupying sticker**.
All computations distinguish physical labeled tokens even when colors match.
A protected node is restored after the whole sequence. Protecting a node
throughout the sequence is a stricter optional solver mode.

## Ring-node mapping

`src/atlas-adapter.cjs` is a pure data adapter. It never changes a website or
executes moves. Call:

```js
const { mapSnapshot, requestFromSnapshot } = require('./src/atlas-adapter.cjs');
const mapping = mapSnapshot(model, puzzleSnapshot);
const request = requestFromSnapshot(model, puzzleSnapshot, {
  protectedStickerIds: ['U:-1:-1'],
  swapStickerIds: ['F:-1:-1', 'R:-1:-1'],
  mode: 'protected_swap',
  protection: 'endpoint'
});
```

IDs in this example are Cube 2×2 engine sticker identities; other engines use
their own IDs. The map gives `stickerToNode`, `nodeToSticker`, and
`occupiedNodes`. It accepts a live engine snapshot or a sticker array and
rejects animating/incomplete states. For slot-based engines it uses their
current `slot`; for geometric engines it uses current center and normal, never
the shape engines' misleading `slot` field (which is a sticker identity).

### Fixed domains

The 25 ordinary exports map each sticker to one of the same number of fixed
spatial slots. Cube slots use `(p,n)`; other geometric slots use
`(center,normal)`; table engines expose exact integer slot IDs. Geometric
coordinates are keyed at precision 1e-7, after independently verifying moves
against the engines. This is not a floating-point permutation representation:
the generated models contain integer permutations.

### Shape-changing domains

The following engines do not have one fixed solved slot per rendered node:

| Puzzle | Actual stickers | Finite pose addresses |
|---|---:|---:|
| Flat Diamond Cube | 68 | 254 |
| Pyramorphix | 16 | 32 |
| MasterMorphix | 40 | 80 |

These three models set `requiresOccupiedState: true`. We close the set of
single-marker poses under legal moves, using `(piece.pos, sticker.center,
sticker.normal)` as an address. Closure is only over individual markers, not
over puzzle configurations. Move selection depends on the marker's discrete
piece position, making each move a fixed permutation of this expanded domain.
All current physical ring dots map to distinct occupied addresses. Other
addresses are empty and are not rendered.

Requests **must include current `occupiedNodes`** and select only occupied
addresses. A request to swap two physical nodes and leave every other physical
node fixed must protect the other occupied addresses, **not all expanded
addresses**. Empty pose addresses remain unconstrained. Requiring a literal
transposition over every expanded coordinate would be overly restrictive and
could yield a false impossibility answer for the intended physical request.
`requestFromSnapshot(...,{mode:'exact_swap'})` performs the correct translation
to a protected swap automatically.

The encoded property is ring-node pose, not the full orientation of a
decorated sticker. Rotations in place that leave center and normal invariant
are intentionally invisible here, consistent with the ring map. Any future
request to preserve texture orientation or the full orientation of a piece
needs an augmented representation.

### Helicopter restriction

Only normal non-jumbling 180-degree moves are exported. Those 12 involutions
act on the 48 visible sticker slots. Fractional jumbling moves can change
which cuts are legal and are outside this fixed-permutation solver. The
snapshot adapter rejects advanced mode, nonstandard alignment stops, or
recorded fractional/stop moves. Direct low-level calls with an invented
ordinary-slot state cannot establish that a jumbled physical puzzle is
supported.

### Mirror and Homer

These use the existing underlying cube sticker frame. The Mirror export
includes the slice moves exposed by that engine. The mirror-mode UI currently
hides its ring map. Single-face sticker spin/texture orientation is not tracked
by the cube node permutation model.

## Validation and reproducibility

`tools/export-models.cjs [atlas-dist-directory]` reads existing engine code,
extracts inline engine blocks where needed, generates all move permutations,
and saves copies in `vendor/atlas-engines` for standalone checking. It never
writes to the Atlas directory. Sources and SHA-256 values are recorded in each
model's `adapter.source` metadata.

`node tools/verify-models.cjs` uses these saved engine copies and checks:

1. Every exported move against an independent engine application.
2. Move bijections, inverse maps, and cycle orders.
3. Four deterministic 40-step sequences per model, comparing every step's
   occupied sticker addresses with engine state.
4. Another 40-step snapshot-to-ring-address mapping per model.
5. Exact-swap protection counts on occupied addresses; Helicopter advanced-mode
   rejection.

All 28 models passed: 692 single moves and 4,480 multi-step engine comparisons,
plus 28 snapshot sequences. `data/validation.json` records the run.

Exports occupy about 0.83 MB uncompressed, before solver caches. Saved engines
are about 0.36 MB. No large precomputation tables are required by the adapters.

## Integration boundary

The website has not been changed. A future UI integration must read a stable
snapshot, translate selected physical IDs to current addresses, make the
request, verify the result against that same state, preview affected nodes,
and execute only if the puzzle has not changed since the snapshot. Request
budgets, `unknown` results, and optimality are handled by the solver, not by
this adapter. The existing website's 300-move `runMoves` cap must be respected
or deliberately redesigned before integration; do not silently truncate a
backend sequence.
