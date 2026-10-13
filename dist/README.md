# Puzzle Atlas

A buildless static collection of thirty-three main ring-controlled puzzles and one secret Homer head puzzle.

## Pages

- `dist/index.html`: compact dark catalog; family filters and thirty-three choices (Mirror Cube opens in color).
- `dist/play.html`: full-width game shell, guide hidden initially. The reveal button opens an independently scrollable guide beside the game on wide screens. The same panel toggles are available on phones.
- `dist/games/`: the game engines and renderers; same-origin integration via `window.PUZZLE_API` and readiness/height messages.
- `dist/*guide*.js`: self-contained guide data with notation, setup instructions, algorithms and references.
- `dist/assets/`: card images rendered from actual puzzle geometry.

No build or runtime dependencies. Hosting serves `dist`.

## Constrained Solver

Every ring panel has an optional **Constrained Solver** button. Ordinary ring geometry, painting, drag controls, and axis selection stay intact when this mode is off. The mode draws a separate selection overlay using read-only coordinates from the existing production drawing pass.

Choose **Select holds** or **Deselect holds**, then click or lasso nodes. Choose the **A** and **B** cards to set the endpoints. Choosing A again clears both endpoints but preserves holds; choosing B changes only B. Availability updates as the held set changes; only proved-impossible choices are dimmed. **Go** finds and animates a verified exchange. Protected stickers may move temporarily but return at the endpoint; other unprotected stickers may move. Held nodes have white dashed outlines. After a manual operation, A/B clear and holds remain. A filtering uses only current holds and legal moves; B filtering additionally uses A. Fixed centers and cyclic triads can still be unavailable without holds.

The right-hand guide starts with each puzzle’s specialized solution. Collapsed sections explain the UI and provide a reproducible mathematical/algorithmic specification. The general algorithm chapter sits immediately above the numbered IEEE-style references.

`constrained-solver-core.js`, `constrained-solver-worker.js`, and the 34 lazy-loaded move models package the separately developed exact permutation backend. The worker first attempts a short projected bidirectional search, then a stabilizer/ordered-pair transporter, with bounded exact shortening. Only certified shortest results are labeled shortest. Complete infeasibility and resource-limited unresolved results are distinct, and neither executes moves. Default computation is 3 seconds, with an explicit 10-second retry. Models and computations stay in the visitor's browser; there is no solver server or added external runtime dependency.

**Auto Solve** uses reusable full stabilizer chains to place stickers in their solved addresses, independent of the move journal. Dashed white outlines mark only nodes protected at subsequent step boundaries. Plans and each completed stage are independently checked. A short gap separates stages; two progress bars show overall and current-stage progress. The top **Stop** button completes the current stage before exiting to ordinary ring controls. Hiding the ring map instead stops immediately, exits solver mode and preserves the 3D view. Starting Auto Solve opens the ring map and leaves mirror mode. Auto Solve, randomize and manual Go use Fast animation, then restore Normal.

Full planning has a 15-second budget, a 30-second retry, and a 20,000-move output guard. No timeout falls back to journal reversal. The canonical target is each physical sticker's solved address, which also solves the visible puzzle. Complete stabilizer chains distinguish unreachable labeled states from exhausted resource limits. Helicopter advanced jumbling remains unsupported. Full-solve regression commands: `node --test tests/auto-solver-ui.test.cjs tests/auto-solver-worker.test.cjs tests/auto-solve-routing.test.cjs`.

Auto Solve shows immediate loading feedback and a persistent top-of-page diagnostic with Retry on failure. Model/cache assets use bounded 20-second loading; worker stage watchdogs distinguish downloads from computation. No device-age or hardware-capability gate disables solving.

Megaminx sticker identities use a fixed face/piece topology table. They must not depend on `atan2` ordering: last-bit browser math differences can cross the ±π seam and silently renumber slots. `tests/dodeca-browser-stability.test.cjs` reproduces that numerical variation and checks every legal permutation against the published model plus full solving; `tests/dodeca-precision.test.cjs` covers Crystal and Kilominx. The corrected topology table preserves existing node IDs, permutations, and solver cache bytes.

All 34 chains are cached in individually loaded puzzle files; only the current puzzle needs its table. The refinement pass improves stored words on 27 puzzles; Tetraminx keeps its existing table because the bounded pass found no accepted improvement. Candidates retain exact legal witnesses, and the acceptance gate checks conservative word bounds plus mean and 95th-percentile length on a fixed 32-state benchmark bank per puzzle. This algorithm's maximum constructed word lengths for the 2×2 through 7×7 cubes are 40, 133, 529, 1,006, 2,234, and 3,502 moves respectively; these are upper bounds, not optimal distances. An individual state's sequence can change with its chosen representatives. Large cubes can still take substantial animation time. Details, before/after results, and reproducible checks are in `solver-backend/FULL_SOLVER.md`, `solver-backend/data/full-solver/refinement-report.json`, and the backend tools. The cache audit independently checks every representative and compares transversal counts with exact group order.

Before playback, the main thread independently verifies the word against the current model and rejects stale snapshots. Sequences are sent through the existing move runner in chunks of at most 300 moves; each chunk and the final sticker mappings are checked, so long words are not truncated. The shared transport and speed controls remain active. Search can be canceled; playback must finish to guarantee held-node restoration. Shape-changing models map current occupied poses. Helicopter jumbling is unsupported.

Regressions: `node --test tests/constrained-solver-ui.test.cjs tests/constrained-solver-worker.test.cjs` and `node tests/constrained-solver-nodes.test.cjs`. Tests cover all 34 node bridges, current drawn coordinates, stationary references, active/inactive controls, automatic playback, stale/canceled/invalid/timeout responses, pause, a 321-move sequence, and Pyramorphix pose mapping. Browser visual QA was unavailable in the managed environment; real production event handlers, draw coordinates, and engine outcomes were checked in the portable test harness.

Solver backend source, stabilizer tables, and regeneration tools are versioned in `solver-backend/`. `node scripts/build-constrained-solver.cjs` regenerates the browser solver and models with recorded source hashes; an explicit backend directory can also be passed. Regeneration is not needed to serve this buildless site.

## Play

Randomize continues from the current position and applies legal moves from a fresh random seed. Auto solve delegates to the Constrained Solver, reads the current state independently of history, opens the ring map, and highlights solved nodes protected by subsequent stages. Verified stages animate through the existing move API, with a short pause between stages. It reports resource limits instead of falling back to journal reversal; it does not promise a globally shortest full solution. Camera movement and mirror-mode toggles do not alter puzzle state. Mirror mode hides the map and color/identity hints, expands the 3D area, and checks monochrome shape completion. Switching puzzles starts a new game. The move journal opens automatically for auto-solve.

Desktop canvases flex into available space without the previous width or 290px height caps. Mobile iframe sizing uses intrinsic content height to avoid a viewport/resize feedback loop.

The conventional notation buttons use face-relative turns, while ring arrows follow screen motion. Camera orbit never relabels controls. Ultimate and Diamond expose four axis pairs: L/l, R/r, D/d, B/b. Lowercase means the opposite hemisphere, not a tip.

## Skewb-family geometry

`skewb-engine.js` constructs Skewb, Jing Pyraminx, Skewb Puzzleball, Skewb Diamond, and Master Skewb from intersected rigid polyhedra. The first four have fourteen pieces; Master Skewb has fifty pieces with eight independent shallow cuts. All state updates use integer rotation matrices. Ultimate has twelve faces and forty-eight stickers; Diamond has eight faces and thirty-two stickers. Seven pieces move on a standard Skewb-family 120-degree turn; Master Skewb moves nineteen. Sticker permutations and transformed physical meshes are independently cross-checked.

Run `node tests/skewb-engine.test.cjs` for legal-move checks and the full Diamond state graph. Its 138,240 states and distance distribution match Jaap Scherphuis's published physical-puzzle results.

## Validation

VM interactions cover all controls, seeded scrambling, pause/resume, undo, manual and guide sequences, and animated move sequences. The earlier six puzzles retain their validated move models. Guides were checked against their move models, including center/edge/parity algorithms for the larger cubes and complete Tetraminx solves. Canvas renderings were visually inspected. Landing filters, route selection, hidden-guide/toggle state, responsive sizing rules, assets and JavaScript syntax were checked. Full browser layout testing was unavailable in the execution environment.

The Auto Solve update passes its dedicated engine-routing, worker, and UI regressions. Two older suites still contain pre-existing source-text checks unrelated to this change: `nxn-engine.test.cjs` compares stale standalone ring code to the embedded balanced layout, and `mirror-modes.test.cjs` expects a literal drawing call now provided by shared rendering. Those assertions and the existing ring geometry were left intact.

## Expanded collection

Tetraminx is the tipless, truncated relative of the existing Pyraminx: 24 stickers and four main controls. Pyraminx remains available with its independent tips. The 5×5×5, 6×6×6 and 7×7×7 cubes expose 15, 18 and 21 individual slice controls; `Ri` is the second layer from R and `Rii` the third, with unambiguous half turns such as `Rii2`. Odd cubes include M/E/S.

The Face-turning Octahedron uses eight outer face turns A–H and four middle slices Am–Dm. Its 42 rigid pieces carry 72 stickers: six vertices, twelve edges and two independent sets of twelve centers. Its connected ring map shows one solid dot per sticker, with smooth shared belts for the selected move and companion paths for face rotations.

Run the portable Node checks in `tests/`: `catalog.test.cjs`, `nxn-engine.test.cjs`, `fto-engine.test.cjs`, `tetraminx.test.cjs` and `skewb-engine.test.cjs`. These validate routing, guide visibility, asset references, ring correspondences, physical pieces, legal moves and move inverses. Auto Solve routing is checked separately in `tests/auto-solve-routing.test.cjs`, including an unsolved state with empty history. The guide and octahedral UI tests validate their specific algorithms and interactions. No production dependencies or build step are needed.

## Shape modifications and map refinement

The five additions—Rhombic Dodecahedron Cube, Flat Diamond Cube, Corner-turning Octahedron, Trajber’s Octahedron and colored Pyramorphix—are grouped by their six cubical turning directions. Exact clipped solid meshes rotate with signed integer matrices. Solved detection checks complete colored geometry and recognizes invisible orientations and equivalent pieces. Pyramorphix changes shape, and Corner-turning Octahedron includes six independent tips. Home labels and a piece inspector support complete fixed-slot solution builders.

Ring maps show every movable sticker as a single full-color circular node, grouped by its current physical face. Bright paths and white-outlined nodes preview the selected turn; other rings stay faint, with an optional full-ring view. Each animated node follows its drawn path to its exact engine destination. Quiet face-guide loops provide intersections for single-axis pieces without suggesting an extra legal turn. Permanently fixed centers use the same circular color nodes and are never highlighted as moving nodes.

Tetrahedral and dodecahedral maps use spherical circle intersections; other families combine exact orbit circles or smooth closed transport belts to keep the selected paths readable. Cube maps retain true circular slice belts, with larger spacing between face clusters and nested companion loops for turns within each face. All node colors stay opaque. Cube 3D views include selectable U/R/F/D/L/B axis badges that follow the camera.

Animation speed ranges from 1.4 seconds to 0.11 seconds per quarter-turn. Explicit speed selections apply under reduced-motion preferences, and changing the slider preserves current progress while changing remaining duration. The setting applies to manual, scramble and solve sequences, including paused sequences.

Additional portable checks: `tests/motion-ui.test.cjs`, `tests/balanced-ring-maps.test.cjs`, `tests/shape-engine.test.cjs`, `tests/shape-guides.test.cjs`, `tests/shape-ui.test.cjs`, `tests/octa-solid-stickers.test.cjs`, `tests/shape-solid-rings.test.cjs` and `tests/solid-map-review.test.cjs`. Browser CSS layout testing remains unavailable in this managed execution environment; production canvas renderings and real event handlers were checked independently.

## New corner-turners and mirror difficulty

Christoph’s Jewel is the corner-turning octahedron without independent tips: eighteen pieces, eight colored hexagons, and six plain black square caps. MasterMorphix uses a 3×3 mechanism inside a four-color tetrahedron. Dino Cube and Rainbow Cube turn three edge pieces around each of eight corners; Rainbow also includes eight fixed triangular face centers. The atlas groups these by their six or eight directed turning axes.

Advanced mirror mode is available on Mirror Cube, Flat Diamond Cube, Pyramorphix, and MasterMorphix. Each opens in color. The toggle sits in the 3D view; mirror mode hides the ring map, uses a single reflective surface color, and keeps the existing puzzle state and move history. Symmetric puzzles whose geometry does not change under legal moves have no mirror toggle.

The new models and controls are covered by `tests/dino-engine.test.cjs`, `tests/dino-ui.test.cjs`, `tests/mirror-modes.test.cjs` and `tests/expansion-review.test.cjs`. Guides include complete model-checked methods for colored and monochrome play: `tests/dino-guides.test.cjs` checks 880 edge cycles and 200 complete solves, while `tests/shape-mirror-guides.test.cjs` checks 300 shape-only solves without hidden color identities.

## Secret Homer puzzle

The plain donut emoji link after the Dodecahedral filter opens `play.html?p=homer`. This bonus game is separate from the thirty-three main catalog cards. It uses the existing 2×2 corner mechanism inside a modeled Homer head, with eight rigid sections that change shape on every quarter-turn. The cube-style ring colors are a learning aid for its internal mechanism. The embedded guide explains the head puzzle directly. Advanced mirror mode removes color and the ring map while preserving the scramble and camera.


## Skewb, Jing, Crystal, and Helicopter additions

The catalog adds straight-cut Skewb, Master Skewb, Jing Pyraminx, Pyraminx Crystal, and Helicopter Cube. Jing uses four vertex controls; Skewb and Master Skewb expose eight directed corner controls. Master Skewb scrambles sample all eight shallow cuts. Crystal has fifty pieces, twelve 72-degree face controls, and ten stickers per face: five triangles and five kites. Helicopter Cube introduces the Rhombic Dodecahedral (12 axes) category, with twelve edge axes and normal 180-degree turns. Its advanced mode adds six alignment stops per edge with blocked-turn detection. Shape-changing jumbling hides the face map until the cube shape returns; optional mirror mode is limited to this advanced challenge.

Each new page has an embedded, model-checked manual solution guide with interactive move builders. Manual guides and Auto Solve both work from the current state independently of recorded history. Ordinary Helicopter solving is complete; advanced jumbling guidance explains shape restoration and its limits, with Undo and Reset available for recovery; constrained Auto Solve supports ordinary half-turn states only.

The new model, UI, guide, and face-layout checks live in `tests/skewb-expansion*.test.cjs`, `tests/crystal-*.test.cjs`, `tests/helicopter-*.test.cjs`, `tests/edge-crystal-guides.test.cjs`, `tests/face-grouped-rings.test.cjs`, and `tests/face-map-inline.test.cjs`.

Ring-map clarity checks include `tests/ring-intersection-audit.cjs`, `tests/cube-map-clarity.test.cjs`, `tests/connected-ring-maps.test.cjs`, and the native path and pointer regression suites. These check actual Canvas paths, physical sticker endpoints, stationary references, face grouping, spacing, and selection behavior.


## Master Pyraminx, Kilominx and Ghost Cube

The catalog includes Master Pyraminx (four axes with three depths, 64 stickers), Kilominx (twelve face axes, 60 stickers), and a colored Ghost Cube with optional silver Mirror mode. Each has a geometry-rendered thumbnail, a native ring/3D game page, exact move model, cached state-based Auto Solve, constrained exchanges and a complete specialized guide. The common mathematical chapters remain at the bottom of every guide, immediately before references.

Ghost is an original polyhedral realization of the classic offset-layer construction, not measured commercial dimensions. Its 26 rigid pieces carry 61 real colored surface patches. A finite 168-address logical attachment domain tracks their full orientation, including the six directional centers. This separates abstract ring-map addresses from measured physical polygon centroids and enables meaningful exchanges. Only occupied addresses can be selected. Automatic opening/closing alignment motions are rendered separately from the journal’s quarter-turn moves.

The new solver tables total about 306 KiB. Verified conservative constructed-word bounds are 208 moves for Master Pyraminx, 102 for Kilominx and 368 for Ghost. These are worst-case bounds of these cached methods, not shortest-distance claims. The puzzle-specific manual guides supply local move builders; tests verify every builder choice plus independent scrambled-state solutions.

Regeneration: `node scripts/build-master-guide.cjs`, `node solver-backend/tools/export-models.cjs dist masterpyraminx kilominx ghost`, then precompute/refine selected caches and run `node scripts/build-constrained-solver.cjs`. Exporting an engine with changed move permutations requires regenerating its cache; the bundle rejects mismatches. Native renderer/interaction tests cover circular nodes, drawn move paths and endpoint agreement.
