# Puzzle Atlas

An interactive collection of **36 twisty puzzles**, with linked 3D views and ring maps, built-in solution guides, and browser-based solvers powered by permutation groups and stabilizer chains.

**[Play Puzzle Atlas](https://luke-a-wendt.github.io/puzzle-atlas/)**

Explore how a puzzle moves, solve it by hand, watch an incremental automatic solution, or experiment with exchanging two tiles while preserving selected colors.

<img width="1846" height="931" alt="image" src="https://github.com/user-attachments/assets/03b54abd-d4b1-47fe-b89a-0e5a8b24ac6e" />

## Features

- **36 public puzzles:** cubes from 2×2×2 through 10×10×10, plus tetrahedral, octahedral, dodecahedral, and shape-changing puzzles. There is also a hidden bonus puzzle.
- **Linked 3D views and ring maps:** inspect the puzzle, select an axis, drag a ring to turn it, and see which tiles correspond to the map’s nodes.
- **Constrained Solver:** choose colors to hold and two tiles to exchange, automatically execute a verified legal move sequence after selecting the second tile.
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

1. In the **Hold** group, turn on **Auto** once. It prepares a verified route and selects its secured holds without moving the puzzle. Choose a white-ringed **Move ①**, then a white-ringed **Move ②**; the verified step starts after a brief pause.
2. Auto stays on. After each completed step, it preserves earlier secured holds, adds at least one more, and offers the next white-ringed choices automatically. Keep choosing 1, then 2 until solved—there is no need to click Auto between steps.
3. To choose your own holds, click **Select**. This turns Auto off, keeps the current holds, and enables clicking, tapping, or lassoing nodes to flip their held state. The counter shows the held total; **Clear** removes all manual holds and endpoint selections. Choose bright **Swap ①** and **Swap ②** endpoints for an ordinary verified exchange.

**Select** and **Auto** are mutually exclusive hold modes. Choosing a Swap button leaves hold-editing input while keeping manual hold mode. Auto prevents manual hold edits and disables Clear until you choose Select; clicking Auto again also returns to manual swapping. The separate top-level **Auto Solve** plays its whole plan, while Auto in the Hold group waits for your pair selections at every step.

Auto prepares and independently verifies a complete route before offering its first guided choice. Its initial holds are the route’s secured set, which can be smaller than all currently correct colors. All white choices offered for a given step execute the same certified stage and lead to its verified next state. Once the stage completes, the held set strictly grows and the next choices appear without another click. The endpoint labels say **Move** in guidance because some necessary steps are placements or cycles rather than literal two-way swaps. On a shape-changing puzzle with an empty target pose, the two markers identify participating tiles; they do not imply that an invisible target is selectable.

Manual holds protect the **color at a location at the end of the complete sequence**, not necessarily the identity of the sticker occupying it. Another sticker of the same color may replace it. The selected manual endpoints exchange their sticker identities; other unheld tiles may also move. A held manual endpoint is temporarily exempt from protection, then retains its held classification with the new color. Guided holds instead retain the plan’s secured color or exact-pose goal; they are never released merely to choose a guided endpoint.

Holds can be disturbed temporarily during playback. Stopping before a complete step finishes cancels its remaining plan and clears the holds because their restoration is not yet guaranteed. Switching to Select, turning Auto off, making unrelated moves, or changing modes leaves guidance. Turn Auto on again to plan from the resulting position. The completion guarantee applies while following and completing the retained guided steps; it is not a shortest-path claim.

In manual selection, **full-color** nodes have a stored verified swap: before choosing tile 1, at least one verified partner exists; afterward, full-color nodes are partners for that specific pair, including held endpoints. A **bold white circle** additionally marks a ready exchange with an unheld partner that would put at least one currently incorrect endpoint color at its goal location. These are local hints: other unheld colors can change, so they do not guarantee an increasing solved total or eventual completion. **Gray** nodes have no verified swap ready and cannot currently be selected for swapping. Gray does not prove mathematical impossibility; Select can still toggle gray nodes. Solid white hint circles sit outside dashed held circles. In Auto, white rings instead identify the certified next guided step, whose secured holds strictly increase.

After a complete operation, endpoint selections clear. Auto stays active, expands its secured holds, and presents the next Move ① choices; a manual exchange retains its existing hold locations and refreshes swap availability. Failed verification makes no moves and returns to the first selection. If Auto cannot produce a verified complete route, it reports the failure and returns to manual mode without offering a speculative guided choice.

## How solving works

Legal moves act as permutations of sticker addresses. Precomputed group data and stabilizer chains provide constructive sequences that preserve progressively more of the puzzle at operation boundaries.

The browser offers only swaps backed by stored legal sequences. Bounded search and stricter stabilizer-based constructions remain available through the backend API. Color-aware checks permit same-colored stickers to substitute at held locations. Proposed sequences are independently verified before playback.

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
