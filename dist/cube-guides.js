/* Original in-game instructions, checked against the puzzle engines. */
(function () {
  'use strict';
  const notation = [
    "U / D / F / B / R / L mean top / bottom / front / back / right / left. A move is clockwise when looking straight at that face; ' means counterclockwise and 2 means two quarter-turns.",
    "The game’s letters stay fixed when you drag the camera. Use the Notation moves buttons, with Inverse checked for a prime, or letter keys (Shift for inverse). Do not infer an algorithm’s direction from a ring’s on-screen arrow alone.",
    "A position such as UFR is the corner where U, F and R meet. UF is the edge between U and F. Read algorithms from left to right and finish every move.",
    "Working front: keep U on top. When a step uses another side as front, translate its algorithm letters with this table. U and D stay fixed. Orbiting alone does not change these mappings.<table><thead><tr><th>Working front</th><th>F</th><th>R</th><th>B</th><th>L</th></tr></thead><tbody><tr><th>F</th><td>F</td><td>R</td><td>B</td><td>L</td></tr><tr><th>R</th><td>R</td><td>B</td><td>L</td><td>F</td></tr><tr><th>B</th><td>B</td><td>L</td><td>F</td><td>R</td></tr><tr><th>L</th><td>L</td><td>F</td><td>R</td><td>B</td></tr></tbody></table>"
  ];
  const firstCorners = {
    title: 'Complete the first layer',
    body: '<p>Find a corner containing the D-center color in the U layer. Its other two colors identify its destination between two side centers. Turn U to put it directly above that destination, then choose a working front that puts the destination at DFR.</p><p>Repeat <code>R U R\' U\'</code> until the corner is correctly inserted. Check after each complete four-move block. A misplaced D-layer corner can be lifted out with one block from that slot, then inserted normally. Solve all four corners; the side colors must match too.</p>'
  };
  const twistCorners = {
    title: 'Turn the final corners',
    body: '<p>Keep one working front for this entire step. Use U turns to bring a twisted corner to UFR. Repeat <code>R\' D\' R D</code> until that corner’s U-color sticker faces up, usually two or four complete blocks.</p><p><strong>Finish all four moves even if the sticker turns upward sooner.</strong> The lower layers will look scrambled temporarily. Turn only U to bring the next twisted corner to UFR, then repeat the same block. Do not change the working front or try to repair the lower layers midway. After every corner faces up, turn U to align the sides; the lower layers return automatically.</p>'
  };
  const cube3Steps = [
    {
      title: 'Choose the first layer',
      body: '<p>Use the color currently on the D center as your first-layer color and the U center as your last-layer color. In the starting orientation these are yellow and white. Center colors, rather than camera position, tell you where pieces belong.</p><p>Use only the six outer face moves throughout this guide. The middle rings remain available for play, but are not needed for this method. If a middle turn previously moved the centers, keep using the centers’ current color arrangement.</p>'
    },
    {
      title: 'Build the bottom cross',
      body: '<p>First gather the four D-color edge stickers around the U center, facing upward: a “daisy.” Ignore corners. For an edge in the middle layer, turn the side carrying its other sticker to lift the D sticker upward. Turn U first if its landing place already contains a petal. A downward-facing D sticker reaches U with a half-turn of its side. For a sideways top or bottom edge, first turn its side a quarter-turn to bring it into the middle, then lift it.</p><p>For each petal, turn U until the edge’s side sticker matches the center beneath it. Turn that side twice to put the edge in D. Repeat for a four-edge bottom cross whose side stickers match their centers.</p>'
    }, firstCorners,
    {
      title: 'Fill the middle edges',
      body: '<p>Choose a U-layer edge without the U-center color. Turn U until its outward-facing sticker matches the side center below; make that side your working F. Look at the sticker facing upward.</p><p>If it belongs on working R: <code>U R U\' R\' U\' F\' U F</code></p><p>If it belongs on working L: <code>U\' L\' U L U F U\' F\'</code></p><p>If every usable edge is trapped incorrectly in the middle, use the appropriate insertion to replace one with a U-layer edge, then insert the displaced piece correctly. Finish all four middle edges.</p>'
    },
    {
      title: 'Make the top cross',
      body: '<p>Look only at the four U-layer edges. Count the stickers showing the U-center color upward. Use <code>F R U R\' U\' F\'</code> with these setups:</p><ol><li>Two opposite stickers: arrange them at UL and UR; do the sequence once.</li><li>Two adjacent stickers: arrange them at UL and UB, a back-left elbow; do the sequence twice without changing the setup between repetitions.</li><li>No stickers face up: do the sequence once, inspect the new pattern, then use one of the cases above.</li></ol><p>Four upward-facing edge stickers completes this step. Corners do not count.</p>'
    },
    {
      title: 'Match the top edges to the sides',
      body: '<p>Turn U to match as many edge side stickers as possible with their centers. Four matches finishes the step. With two adjacent matches, choose a working front so the matched edges are at UB and UR. Then do <code>R U R\' U R U2 R\' U</code>; this exchanges UF and UL.</p><p>With two opposite matches, do that sequence once from any working front, then turn U and inspect again. You can now use the adjacent setup. Recheck all four side matches before continuing.</p>'
    },
    {
      title: 'Put the top corners in their places',
      body: '<p>A corner is in the right place when its three colors match the three surrounding centers, even if it is twisted. If one corner is correct, choose a working front that puts it at UFR. Do <code>U R U\' L\' U R\' U\' L</code> once or twice until all four corners occupy the right places.</p><p>If no corner is correct, do the sequence once, then locate the correct corner and continue. Keep the top edges aligned; do not use U as a setup here. The working-front substitution changes your viewpoint for the algorithm without moving pieces.</p>'
    }, twistCorners
  ];
  const cube3Sources = [
    {label:'J Perm — beginner 3×3 method',url:'https://jperm.net/3x3'},
    {label:'Stanford Cube Club — layer-by-layer reference',url:'https://cube.stanford.edu/class/files/rubiks_cube_solution.pdf'},
    {label:'Ruwix — beginner method and final-corner technique',url:'https://ruwix.com/the-rubiks-cube/how-to-solve-the-rubiks-cube-beginners-method/'},
    {label:'Jaap’s Puzzle Page — 3×3 structure and methods',url:'https://www.jaapsch.net/puzzles/cube3.htm'}
  ];
  window.CUBE_GUIDES = {
    cube2: {
      title:'2×2 · a three-stage solve',
      intro:'Eight corners, no edges or centers. Build a complete first layer, place the other four corners, then turn them into alignment.',
      notation:notation.concat(['There are no fixed centers. The side colors of your completed D layer become the reference for the U corners.']),
      steps:[
        {title:'Build a matching bottom layer',body:'<p>Choose a first-layer color, for example yellow. Place one corner with that color facing D. This is your reference corner. A neighboring first-layer corner must share the correct side color with it; a piece sharing only the bottom color belongs diagonally opposite.</p><p>Put the next corner in U directly above its intended slot. Choose a working front so the slot is DFR, then repeat <code>R U R\' U\'</code> until it is inserted correctly. If a wanted corner is trapped incorrectly in D, use one complete block from its slot to lift it out. Repeat until D is one color and each side’s two bottom stickers match.</p>'},
        {title:'Position the remaining corners',body:'<p>Ignore twist for now: a top corner belongs between the two side colors shown by the completed layer beneath it. Inspect how many are in their correct places.</p><ol><li>Four correct: continue to the next step.</li><li>None correct: turn U until at least one is correct.</li><li>One correct: use a working front that places it at UFR.</li><li>Two adjacent correct: turn U until exactly one is correct, then place that one at working UFR.</li><li>Two diagonal correct: use any working front.</li></ol><p>Do <code>U R U\' L\' U R\' U\' L</code>, then count and follow the cases again. This cycle preserves the completed bottom layer.</p>'},
        {...twistCorners,body:twistCorners.body.replace('U-color sticker','sticker opposite your bottom color')}
      ],
      sources:[
        {label:'J Perm — beginner 2×2 method',url:'https://jperm.net/2x2'},
        {label:'Jaap’s Puzzle Page — Mini Cube',url:'https://www.jaapsch.net/puzzles/cube2.htm'},
        {label:'Ruwix — final-corner turning technique',url:'https://ruwix.com/the-rubiks-cube/how-to-solve-the-rubiks-cube-beginners-method/orient-yellow-corners-how-to-solve-last-layer-corner/'}
      ]
    },
    cube3:{title:'3×3 · build one layer at a time',intro:'A complete beginner route with seven solving stages. Keep the first layer at D and work upward; the directions below use the current center colors.',notation,steps:cube3Steps,sources:cube3Sources},
    mirror:{
      title:'Mirror Cube · solve by shape',
      intro:'The same 3×3 moves rearrange unequal blocks. Start with the colored view, or enable Mirror mode in the 3D view to solve by shape alone.',
      notation,
      steps:[
        {title:'Read shapes as your color scheme',body:'<p>In <strong>Mirror mode</strong>, the ring map is hidden. Identify pieces by their dimensions in the 3D view. The six center blocks establish the face levels. An edge belongs between the two centers whose heights and widths it joins smoothly; a corner must fit three neighboring surfaces. The goal is one continuous cube with no steps or protrusions.</p><p>For a first solve, leave <strong>Mirror mode</strong> off and use the complete 3×3 instructions below. Enable Mirror mode once you can recognize the pieces by shape. The toggle changes only the display, not the scramble. A correct-looking flat face is only part of a layer: check its side surfaces too.</p>'},
        ...cube3Steps,
        {title:'Check the silhouette',body:'<p>Inspect all six sides by dragging the 3D view. Every piece should fit into a smooth cube. In Mirror mode, the color-based checkpoints above mean matching the corresponding center’s surface and making neighboring block edges flush. At the cross stage, all four edges must be flush with the center and side centers. For a corner, compare all three surface levels; for a middle edge, compare both. During the top-cross and corner-twisting stages, “facing up” means presenting the surface that will sit flush with the U center. A top piece can be at the correct height but in the wrong slot: its side widths must match the neighboring center blocks too. The completed cube, rather than hidden sticker colors, is the goal.</p>'}
      ],
      sources:[{label:'GANCUBE — Mirror Cube tutorial',url:'https://www.gancube.com/pages/mirror-cube-tutorial'},...cube3Sources]
    },
    cube4:{
      title:'4×4 · reduce, then solve',
      intro:'First build six centers and twelve two-piece edges. That creates a virtual 3×3. Two special parity repairs cover the cases that a 3×3 cannot have.',
      notation:notation.concat([
        'An i is an inner slice only: Ri is the slice beside R. A wide move turns the outer face and its neighboring inner slice in the same direction: Rw = R then Ri; Uw = U then Ui. Rw\' = R\' then Ri\'; Uw2 = U2 then Ui2. The two turns commute, so it is fine to execute them one after the other.',
        'Keep the original color scheme for the centers: U white, D yellow, F green, B blue, R red, L orange. Opposite colors alone do not determine their order; the three colors on a corner provide a handedness check.'
      ]),
      steps:[
        {title:'Build the six 2×2 centers',body:'<p>Each center consists of four one-color pieces. Make a two-piece bar, then make a second bar and join them. Start with orange on L and red on R. Outer turns reposition bars; an inner slice moves a bar to another face.</p><p>With those opposite centers finished, Li and Ri can transfer pieces among U, F, D and B without cutting either completed center. Build green on F, then white on U, then finish blue on B and yellow on D. Keep every center in the color scheme listed above.</p><p>Work with bars: align a source bar with an unfilled column, insert it with a slice, and restore any earlier center that the slice disturbed. If an insertion would cut a finished bar, turn the destination face so the finished bar lies outside that slice first. Record the slice moves so you can undo them after moving the newly placed pieces out of their return path. Use Undo to study a move’s effect when learning these intuitive center insertions.</p>'},
        {title:'Join matching edge wings',body:'<p>There are two wings for each two-color edge. Use outer turns to put matching wings at working FL and FR. They must occupy different horizontal slices and be oriented so a horizontal inner-slice turn joins them with matching stickers on both faces.</p><p>Slice to join them, move the completed pair into U with <code>R U R\'</code> or <code>R U\' R\'</code>, bringing an unpaired edge slot down in exchange, then undo the slice. This last action restores the centers. Store completed pairs away from the working slots and repeat.</p><p>If the wings cannot join in that orientation, the edge-flip sequence <code>R U R\' F R\' F\' R</code> flips the working FR slot. It also moves other outer-layer pieces, which is acceptable at this stage. Then set up the pair again. All twelve edges must consist of matching two-piece strips before the 3×3 stage.</p>'},
        {title:'Finish the last two edge pairs',body:'<p>When only two unmatched edge slots remain, bring them to FL and FR with outer turns. Arrange them so the two upper wings match one another in both colors and have the same color facing F; the two lower wings should match one another in the same way. The upper and lower pairs need not share a color.</p><p>Use <code>Uw\' R U R\' F R\' F\' R Uw</code>. Here Uw\' means U\' then Ui\', and the final Uw means U then Ui. This pairs the wings while restoring the centers. If the wings are diagonally paired instead, flip the FR slot using the previous step’s edge-flip sequence, then inspect and arrange the stated case.</p>'},
        {title:'Treat the result as a 3×3',body:'<p>A 2×2 center block now acts as one center, and each matching wing pair acts as one edge. From here, use only outer face moves except for the parity repairs below. The full 3×3 instructions follow, so you can finish without leaving this game.</p><p>If the top-cross stage shows one or three upward-facing edge pairs, use the next OLL repair. If the placement stage leaves an impossible two-piece exchange, use the PLL repair. Both are normal legal 4×4 cases.</p>'},
        {title:'Parity repair · one flipped edge pair',body:'<p>For OLL parity, use U turns to place an edge pair needing a flip at UF. Execute this rotation-free sequence; every Ri and Li is an inner slice, not a wide turn:</p><p><code>Ri2 B2 U2 Li U2 Ri\' U2 Ri U2 F2 Ri F2 Li\' B2 Ri2</code></p><p>This flips the UF pair, preserves the corners and restores the center colors. Reinspect the top cross and continue the ordinary 3×3 stages. With three wrongly oriented pairs, this removes the odd parity and the usual cross algorithm handles the remaining two.</p>'},
        {title:'Parity repair · two pieces exchanged',body:'<p>The following sequence exchanges the UF and UB edge pairs without changing the corner positions:</p><p><code>Ri2 U2 Ri2 Uw2 Ri2 Uw2 U2</code></p><p>Expand each Uw2 as <code>U2 Ui2</code>. If only two opposite edge pairs remain swapped, choose a working front that puts them at UF and UB and apply it. For an adjacent-edge exchange or a two-corner exchange, apply it once from any working front, then repeat the ordinary top-edge and top-corner placement stages below. It removes the parity obstruction; those remaining stages finish the rearrangement.</p>'},
        ...cube3Steps.map((s,i)=>i===0?{title:'3×3 stage · establish your colors',body:'<p>Your completed center blocks define each face. Use D’s color for the first layer and U’s color for the last. In this stage an “edge” always means an intact two-wing pair, and a “center” means an intact 2×2 center block. Keep those blocks intact with outer moves.</p>'}:{...s,title:'3×3 stage · '+s.title.charAt(0).toLowerCase()+s.title.slice(1)})
      ],
      sources:[
        {label:'CubeSkills / Feliks Zemdegs — 4×4 reduction and parity',url:'https://www.cubeskills.com/uploads/pdf/tutorials/beginners-method-for-solving-the-4x4-cube.pdf'},
        {label:'J Perm — centers, wing pairing and parity',url:'https://jperm.net/4x4'},
        {label:'Ruwix — rotation-free inner-slice parity repair',url:'https://ruwix.com/twisty-puzzles/4x4x4-rubiks-cube-rubiks-revenge/parity/'},
        ...cube3Sources
      ]
    }
  };
})();
