# Puzzle Atlas

An interactive collection of **36 twisty puzzles**, with linked 3D views and ring maps, built-in solution guides, and browser-based solvers powered by permutation groups and stabilizer chains.

**[Play Puzzle Atlas](https://luke-a-wendt.github.io/puzzle-atlas/)**

Explore how a puzzle moves, solve it by hand, watch an incremental automatic solution, or experiment with exchanging two tiles while preserving selected colors.

<img width="1846" height="931" alt="image" src="https://github.com/user-attachments/assets/03b54abd-d4b1-47fe-b89a-0e5a8b24ac6e" />

## Features

- **36 public puzzles:** cubes from 2×2×2 through 10×10×10, plus tetrahedral, octahedral, dodecahedral, and shape-changing puzzles. There is also a hidden bonus puzzle.
- **Linked 3D views and ring maps:** inspect the puzzle, select an axis, drag a ring to turn it, and see which tiles correspond to the map’s nodes.
- **Constrained Solver:** choose colors to hold and two tiles to exchange, then execute a verified legal move sequence.
- **Incremental Auto Solve:** solve from the current configuration independently of the move journal, with secured-node and current-sequence progress bars.
- **Puzzle-specific guides and a shared solving handbook:** solving strategies, mathematical explanations, pseudocode, implementation details, and references.
- **Colored and mirror variants:** supported ShapeShifter puzzles have separate atlas entries for each mode. Mirror mode keeps the ring map visible with silver nodes.
- **Move-journal playback:** step or replay forward and backward, including sequence navigation, with adjustable playback speed and stop controls.
- **Responsive dark interface:** collapsible ring-map and guide panels, configurable labels and highlights, and mouse or touch interaction.

All puzzle simulation, rendering, and solving run **locally in the visitor’s browser**. Playing requires no AI tokens, model API calls, account, API key, or remote solver. The website serves static files and precomputed solver data; its runtime assets are included in the repository.

## Explore the atlas

Filter by **Tetrahedral**, **Cubical**, **Octahedral**, **Dodecahedral**, or **ShapeShifter**. ShapeShifter puzzles appear in their own category, with colored versions before mirror versions. Alternate mirror entries do not increase the count of 36 public puzzles.

Cards show **Colors**, **Rings**, and **Nodes**. Rings count distinct drawn motion paths in the solved map—not geometric rotation axes. A single axis can move tiles along several paths.

Difficulty labels estimate **human solving difficulty**, including the complexity of the methods a person must learn and execute. They are not shortest-solution distances or rankings of automatic solver performance. Colored puzzles are rated Easy, Medium, or Hard; mirror variants are rated Very Hard. Each puzzle’s guide explains its rating.

## Getting started

1. Choose a puzzle from the atlas.
2. Use **Randomize** to scramble its current configuration.
3. Drag the 3D view to change the camera; scroll or pinch to zoom.
4. Tap a tile to cycle through its turning axes, or select a ring in the map. Drag a ring or use the 3D panel’s rotation buttons to make a move.
5. Open **Show guide** for puzzle-specific instructions, or **Auto Solve** to watch a staged solution.

Hovering over a 3D tile identifies its corresponding ring-map node. Clicking empty space in the ring map clears the selected axis. **Show goal** temporarily displays the target colors while pressed; it is hidden in mirror mode.

The ring map opens by default. Its zoom and pan are disabled. Labels, highlights, ring visibility, and playback speed remain at your chosen settings while you use that puzzle page; entering a puzzle fresh restores the defaults.

The atlas’s **How to play** gives a quick overview. The shared **Solving handbook** contains the detailed controls and algorithms.

## Constrained Solver

Switch the ring-map panel from **Turn rings** to **Constrained Solver**:

1. Use **Hold** to toggle held nodes by clicking or selecting a region. The adjacent count shows how many are marked; **Clear** releases them and **Suggest** replaces them with suggested holds.
2. Choose **Swap ①** and **Swap ②**. You can select endpoints on the ring map or on the 3D tiles.
3. Press **Go** to check the request and execute a verified sequence.

Holds protect the **color at a location at the end of the complete sequence**, not necessarily the identity of the sticker occupying it. Another sticker of the same color may replace it. The selected endpoint stickers exchange places; other unheld tiles may also move.

Held colors can be disturbed temporarily during playback. Stopping before the sequence finishes does not guarantee that they have been restored. Selecting a held node as an endpoint temporarily exempts it from protection for that exchange while retaining its held classification.

Availability updates with the current holds and selected endpoint. Dimmed choices are unavailable; a **?** means feasibility is unresolved and may require a bounded search. An unresolved request is not a proof of impossibility. Continuing a paused search retains useful work, subject to the solver’s time and memory limits.

After a successful manual exchange, the endpoint selections clear and the holds remain. **Suggest** is a hold-selection aid; it does not guarantee that an arbitrary swap is possible or provide a complete solve plan.

## How solving works

Legal moves act as permutations of sticker addresses. Precomputed group data and stabilizer chains provide constructive sequences that preserve progressively more of the puzzle at operation boundaries.

The manual solver combines cached legal sequences, bounded search, and stricter stabilizer-based constructions. Color-aware checks permit same-colored stickers to substitute at held locations. Proposed sequences are independently verified before playback.

Auto Solve uses verified incremental stages rather than reversing the move journal. Its upper progress bar tracks secured nodes; its lower bar tracks moves within the current stage. Those bars describe the plan’s progress, not the shortest remaining distance to a solution.

Solver computation runs in Web Workers, and puzzle-specific data loads as needed.

### Guarantees and limits

- Verified complete sequences satisfy their stated endpoint constraints.
- Solutions are **not generally guaranteed to be shortest**.
- Resource-limited or unresolved searches are distinct from proven-impossible requests.
- Runtime limits, device capabilities, and puzzle complexity can affect planning time and whether a manual request is resolved.
- Shape-changing puzzles may use expanded geometric-address models; their displayed node positions need not remain fixed as the shape changes.
- Advanced Helicopter Cube jumbling is outside the supported fixed-permutation solver mode.

The solving handbook gives the technical details, including color versus sticker constraints, verification, caching, and a worked 2×2×2 case study.

## Run locally and offline

The finished website is in `dist/` and requires no build step to serve. From the repository root, run:

```sh
python3 -m http.server 8000 --directory dist
```

Then open **http://localhost:8000**. On Windows, `py` can be used instead of `python3`.

**Do not launch the site by double-clicking `index.html`.** A `file://` URL can block the data or worker loading needed by puzzle pages, leaving them on the loading screen.

With the complete repository downloaded, local HTTP serving works without internet access. It uses your own computer, not an external compute service. Visiting the hosted site requires a connection to retrieve its files; automatic offline caching is not required or promised. Optional reference links and the GitHub-hosted screenshot in this README are external resources, not dependencies of the puzzle runtime.

## Project layout

| Path | Contents |
| --- | --- |
| `dist/index.html` | Atlas and category filters |
| `dist/play.html` | Puzzle and guide shell |
| `dist/games/` | Puzzle engines, rendering, controls, runtime bundles, and browser solver |
| `dist/games/constrained-solver-models/` | Legal move permutations and address models |
| `dist/games/constrained-solver-caches/` | Precomputed stabilizer-chain data |
| `dist/games/color-solver-caches/` | Color-aware solver caches |
| `dist/assets/` | Local puzzle images and visual assets |
| `dist/solver-handbook.html` | Shared controls and solver documentation |
| `solver-backend/` | Solver source, precomputation tools, data, and backend tests |
| `scripts/` | Generation, packaging, measurement, and verification tools |
| `tests/` | Puzzle, solver, interaction, and regression tests |
| `.github/workflows/static.yml` | GitHub Pages deployment |

The development tools are not required to serve the prepared `dist/` website.

## References and feedback

Puzzle guides and the solving handbook contain relevant webpages and scholarly references.

When reporting an issue, include the puzzle name, browser and device, whether you are using GitHub Pages or a local HTTP server, reproduction steps, and any displayed diagnostic. Screenshots and the move journal can help reproduce a problem.

## Credits

**Author:** [Dr. Luke A. Wendt](https://github.com/Luke-A-Wendt)  
**AI co-author:** [Astra Ultra](https://openai.com/index/gpt-6-astra/)

See [LICENSE](LICENSE) for the repository’s license terms.
