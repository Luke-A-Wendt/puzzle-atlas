# Large cube builds and checks

Run from any working directory (replace the relative checkout path as needed):

```sh
node scripts/build-nxn.cjs
node tests/nxn-engine.test.cjs
```

`build-nxn.cjs` derives the 5×5, 6×6 and 7×7 pages from the current `dist/games/cube4.html` layout, controls and BSP renderer. It generalizes the exact integer-coordinate model and intersecting-circle mapping, fits the 3D model by size, omits hidden plastic faces for performance, and applies the larger-ring-dot and fixed-pixel-label improvements. It writes both the self-contained game scripts embedded in each HTML file and the matching `nxn-engine.js`, `nxn-rings.js` and `nxn-app.js` sources.

The game has no JavaScript runtime dependencies. Automated model and simulated-control tests use only Node built-ins; `tests/game-harness.cjs` supplies the minimal DOM and drawing stubs. The tests also assert that embedded scripts match their source copies.

To regenerate the actual-model card images and a visual contact sheet:

```sh
node scripts/render-nxn.cjs
```

Rendering needs the optional Node package `@napi-rs/canvas` installed/resolvable in the environment. It rewrites `dist/assets/cube5.png`, `cube6.png` and `cube7.png`, and puts the contact sheet in `tests/artifacts/nxn-preview.png`. The PNG card images have transparent backgrounds, are fitted without clipping and show the production 3D geometry.

The simulated DOM verifies game handlers and frame rendering, but does not implement browser CSS layout. Responsive browser inspection remains a separate check.

# Constrained Solver and Auto Solve

The reproducible permutation backend is kept in `solver-backend/`. Its source,
move models, complete stabilizer caches, engine fixtures, and tests are versioned
with this project. Production needs only the generated assets under `dist/`.

From the repository root:

```sh
node scripts/build-constrained-solver.cjs
node --test tests/constrained-solver-worker.test.cjs tests/auto-solver-worker.test.cjs
node --test solver-backend/tests/*.test.cjs
```

The build reads the actual game engines to record each sticker's solved address,
bundles the solver in a worker, and writes SHA-256 fingerprints for the move models
and full-solve caches. Assets are fetched only when the corresponding solver is
used; the full stabilizer cache is specific to the current puzzle.

To rebuild an individual stabilizer cache, use the bounded precomputation and
representative-shortening tools, then rebuild the browser bundle:

```sh
node solver-backend/tools/precompute-full.cjs cube2
node solver-backend/tools/optimize-cache.cjs cube2
node scripts/build-constrained-solver.cjs
```

Precomputation is an offline operation. Larger puzzles may need higher explicit
resource budgets through the exported `precomputeFull` function. Keep the
checked-in complete caches unless an intentional, independently verified rebuild
replaces them. Auto Solve reconstructs a solution from current sticker positions;
it never reads the move journal. Each placement preserves the already constrained
nodes at its endpoint. The main thread independently replays the whole proposed
plan before allowing animation. Cached solutions are exact but are not generally
shortest move sequences.
