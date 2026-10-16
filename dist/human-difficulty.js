/* Editorial first-solve ratings for the actual colored Puzzle Atlas models.
 * Reviewed against the local puzzle-specific guides and the linked original
 * tutorials/first-person reviews, October 16, 2026. No runtime network requests.
 * These are broad human learning estimates, not optimal distances or timings. */
(function(root){
 'use strict';
 const jaap=(page,title)=>({title:'J. Scherphuis — '+title,url:'https://www.jaapsch.net/puzzles/'+page+'.htm',kind:'solution guide'});
 const source=(title,url,kind='solution guide')=>({title,url,kind});
 const refs={
  dino:jaap('dinocube','Dino Cube and Rainbow Cube'),
  pyra:jaap('pyraminx','Pyraminx, Tetraminx and Jing Pyraminx'),
  style:jaap('diamstyl','Diamond Style Puzzler'),
  cube2:source('J Perm — beginner 2×2×2 method','https://jperm.net/2x2'),
  cube3:source('J Perm — beginner 3×3×3 method','https://jperm.net/3x3'),
  diamond:jaap('diamond','Skewb Diamond'),
  skewb:jaap('skewb','Skewb'),
  morph:jaap('pyramorf','Pyramorphix'),
  kilo:source('Ruwix — Kilominx tutorial','https://ruwix.com/twisty-puzzles/kilominx/'),
  octa:jaap('octahed','Corner-turning Octahedron, Christoph’s Jewel and Trajber’s Octahedron'),
  variants:jaap('cubevari','Rubik’s Cube variants'),
  cube:jaap('cube3','Rubik’s Cube and Diamond Cube'),
  ultimate:jaap('ultimate','Ultimate Skewb / Puzzleball'),
  mega:jaap('megaminx','Megaminx'),
  masterpyra:source('Ruwix — Master Pyraminx tutorial','https://ruwix.com/twisty-puzzles/pyraminx-triangle-rubiks-cube/master-pyraminx/'),
  cube4:source('F. Zemdegs / CubeSkills — beginner 4×4×4 method','https://www.cubeskills.com/uploads/pdf/tutorials/beginners-method-for-solving-the-4x4-cube.pdf'),
  cube5:source('F. Zemdegs / CubeSkills — beginner 5×5×5 method','https://www.cubeskills.com/uploads/pdf/tutorials/beginners-method-for-solving-the-5x5-cube.pdf'),
  big:source('CubeSkills — big-cube reduction tutorials','https://www.cubeskills.com/tutorials/big-cube-tutorials'),
  axis:source('K. Dearn — Axis Cube solving experience','https://cyaeghauk.blogspot.com/2020/11/axis-cube.html','first-person review and method'),
  helicopter:jaap('helicopter','Helicopter Cube, normal turns and jumbling'),
  fto:jaap('octaface','Face-turning Octahedron'),
  crystal:jaap('pyracrys','Pyraminx Crystal'),
  masterskewb:jaap('mastskewb','Master Skewb'),
  ghost:source('Recent Toys — Ghost Cube','https://recenttoys.com/ghost-cube-m-4/','manufacturer'),
  ghostReview:source('Eridian Shores — Ghost Cube solving experience','https://eridianshores.wordpress.com/2024/06/27/cube-review-19-the-ghost-cube/','first-person review'),
  mirror:source('GANCUBE — Mirror Cube tutorial','https://www.gancube.com/pages/mirror-cube-tutorial')
 };
 const rows=[
  ['dino','easy','One moving piece family and a reusable three-piece cycle keep the rule set small. The main task is choosing the right destination while protecting the pieces already placed.',[refs.dino]],
  ['tetraminx','easy','A short base-and-last-edges method handles the small edge set. There are no independent tips to finish, and the few insertion and flip patterns are practical to learn together.',[refs.pyra]],
  ['pyraminx','easy','The tips are independent, and the main solve uses a small set of edge insertions, cycles and flips. Its short stages and clear four-color frame make errors easier to spot.',[refs.pyra]],
  ['diamondstyle','easy','Three color bands remove much of an ordinary cube’s piece-recognition burden. The guide reduces the solve to filling the middle belt and separating the two outer colors with a few repeated operations.',[refs.style]],
  ['cube2','easy','Only eight corners need placing and orienting, with no edge or center stages. The three-stage beginner method reuses short sequences; keeping the same working orientation during the last stage is the main care point.',[refs.cube2]],
  ['diamond','easy','The compact point-and-center method has relatively few cases, and triangular face-center orientation is irrelevant. Recognizing the correct working frame takes practice, but the amount to remember stays modest.',[refs.diamond]],
  ['skewb','easy','Corner turns initially feel unfamiliar, but a small collection of repeated corner and center operations is enough. There are only two main piece families to track, without a separate edge-solving stage.',[refs.skewb]],
  ['rainbow','easy','This retains the Dino Cube’s twelve moving pieces and reusable cycle rather than adding independent solving stages for every color. The extra face colors increase visual checking, but the algorithm burden remains small.',[refs.dino]],
  ['jing','medium','The familiar Pyraminx-like edges now share the puzzle with movable face centers. The guide requires a separate center stage, so the player must recognize which piece family an operation preserves.',[refs.pyra]],
  ['pyramorphix','medium','The underlying job is still eight-corner placement and orientation, but flat pieces and pointed pieces disguise those roles. Restoring the tetrahedral shape while interpreting the colors adds recognition work to the small mechanism.',[refs.morph]],
  ['cube3','medium','The beginner method combines edge placement, corner placement and orientation across several stages. Its rules are manageable with practice, but remembering the last-layer cases and preserving completed layers is a substantial step beyond the smallest puzzles.',[refs.cube3]],
  ['mirror','medium','With colors enabled, the usual 3×3×3 layer method provides clear destinations. Unequal block sizes and the changing outline add visual bookkeeping, but they do not require a new family of solving algorithms.',[refs.cube3,refs.mirror]],
  ['kilominx','medium','Only corners move, so the guide needs placement and paired twists rather than edge or center stages. Tracking twenty corners across twelve colors and maintaining the full color frame raises the recognition burden above a 2×2×2.',[refs.kilo]],
  ['jewel','medium','The guide handles edge placement, paired edge flips and oriented vertex bodies. Removing the independent tips shortens the checklist, although the octahedral working frame takes more care than an ordinary cube.',[refs.octa]],
  ['cornerocta','medium','Edge placement and flips must be combined with the orientation of the main vertex bodies. The tips are an extra but independent task; most of the difficulty is maintaining the correct octahedral frame through the edge stages.',[refs.octa]],
  ['diamondcube','medium','The complete 3×3×3 method still applies beneath the cuboctahedral surface. Extra triangular faces and fourteen colors make piece recognition busier, so every face needs checking even after the six square faces look correct.',[refs.cube,refs.cube3]],
  ['ultimate','medium','The Skewb-related mechanism has a manageable number of pieces, but roof-like pieces have visible orientations. Its guide adds a final roof-orientation stage, increasing the case recognition and memory required beyond the ordinary Skewb.',[refs.ultimate]],
  ['megaminx','medium','Much of the solve repeats familiar corner and edge operations around a larger color frame. Twelve faces demand patience and careful tracking, but repetition adds more work than new rules; this is not rated from its enormous state count.',[refs.mega]],
  ['masterpyraminx','medium','Ordinary, wide and tip turns act on different piece families, so matching wings, midges and centers requires more care than a Pyraminx. The guide separates these stages and repeatedly reuses cycle and flip ideas rather than requiring a large speedsolving algorithm set.',[refs.masterpyra]],
  ['cube4','hard','Center construction and wing pairing must be learned before the 3×3×3 finish. The lack of fixed centers and the extra parity repairs add both recognition decisions and longer sequences that are easy to misapply.',[refs.cube4]],
  ['cube5','hard','Fixed central colors help establish the frame, but the guide adds several center and edge groups before the 3×3×3 finish. Pairing the last wings correctly and preserving completed blocks demand more sustained attention than a 3×3×3.',[refs.cube5]],
  ['trajber','hard','The octahedral edge and vertex work is followed by placement of eight triangular face centers. The additional piece family and unfamiliar correspondence with cube pieces create more stages to coordinate than on the shallower corner-turning octahedron.',[refs.octa]],
  ['rhombic','hard','The cube mechanism is disguised by rhombic faces and altered visible orientations. Recognizing corresponding piece types and the apparent last-pair exceptions adds reasoning beyond an ordinary cube’s layer method.',[refs.variants]],
  ['flatdiamond','hard','The flattened corners and many visible facets make underlying cube-piece identities less obvious. Hidden orientation symmetries can create apparent last-pair cases, so the guide’s piece checks and final shape checks matter.',[refs.variants]],
  ['mastermorphix','hard','Four tetrahedral colors hide several distinct cube-piece roles, while sloping centers have visible orientation. Distinguishing equivalent-looking pieces and completing the shape checks adds substantial recognition work to the 3×3×3 algorithm base.',[refs.variants]],
  ['axis','hard','Oblique cuts make apparent corners, edges and centers differ from their mechanism roles. The colored version still requires careful piece identification and center-ridge alignment, so familiar cube algorithms alone do not make the first solve straightforward.',[refs.variants,refs.axis]],
  ['helicopter','hard','For the normal half-turn game, corners and four separate center orbits must be solved without confusing their allowed destinations. The guide includes paired center exchanges and several protected stages; advanced physical jumbling is outside this rating.',[refs.helicopter]],
  ['fto','hard','Edges, vertex positions, vertex orientation and two groups of centers need distinct treatment. The unfamiliar triangular geometry and restricted piece orbits make recognition and setup choices more demanding than repeating a cube layer method.',[refs.fto]],
  ['crystal','hard','Corner placement and twists are followed by thirty edges and paired flips across twelve faces. Its deeper turns disturb a broad area, so maintaining the color frame and preserving completed stages require careful setup and restoration.',[refs.crystal]],
  ['cube6','hard','Multiple center and wing families must be kept separate, with even-cube parity repairs before the reduced solve finishes. The familiar reduction method scales, but choosing the right inner slice and restoring long setup sequences adds error risk.',[refs.big,refs.cube4]],
  ['cube7','hard','Fixed centers provide a useful frame, yet large center blocks and several edge groups create a long, repetitive solve. The main increase is precise slice tracking and endurance rather than an entirely new collection of algorithms.',[refs.big,refs.cube5]],
  ['masterskewb','hard','Edges, two corner groups, two off-center groups and face centers all need separate attention. The guide’s seven stages use multiple cycles and paired twists; coordinating those families gives this puzzle a high learning and execution burden.',[refs.masterskewb]],
  ['ghost','hard','Colors help distinguish destinations, but the offset shell, irregular piece roles and oriented centers still make recognition demanding. The guide separates mechanism alignment from the final exterior docking; shape-only reviews inform that recognition concern, not a claimed measured rating of this colored version.',[refs.ghost,refs.variants,refs.ghostReview]],
  ['cube8','hard','The reduction method is familiar, but three wing-pair orbits and large center blocks require extensive bookkeeping. Even-cube parity and closely spaced inner slices increase the chance of a small execution mistake spoiling a completed group.',[refs.big]],
  ['cube9','hard','The fixed central pieces help orientation, while twelve movable-center families and long edge groups make the solve demanding to track. Most rules reuse smaller-cube reduction; the high rating reflects sustained recognition and execution effort.',[refs.big]],
  ['cube10','hard','Six large center blocks, sixteen movable-center families and four wing-pair orbits create the longest reduction checklist here. Reused algorithms remain useful, but slice accuracy, parity repairs and the cost of a mistake make this an advanced first solve.',[refs.big]]
 ];
 const puzzles=Object.fromEntries(rows.map(([id,difficulty,rationale,sources],index)=>[id,{difficulty,rank:index+1,rationale,sources}]));
 puzzles.homer={difficulty:'medium',rank:10.5,secret:true,rationale:'The eight-piece corner mechanism uses the small cube’s placement and orientation ideas. Reconstructing a recognizable face and head replaces the ordinary color frame, adding a visual-recognition task.',sources:[jaap('cube2','Mini Cube and puzzle-head variants')]};
 const data={
  schemaVersion:1,
  reviewed:'2026-10-16',
  publicPuzzleCount:36,
  methodology:{
   summary:'Editorial estimates of human first-solve learning and execution difficulty with the guide available; these are not measured solve times, shortest distances or automatic-solver rankings.',
   baseline:'Colored puzzles are assessed with their actual colors and legal moves in Puzzle Atlas. The comparison assumes a player learning a beginner method, rather than an expert already fluent in every related puzzle.',
   factors:['Number and variety of solving ideas and exceptional cases','Difficulty recognizing piece types, destinations and orientations','Working memory needed to preserve earlier stages and undo setups','Length and repetition of the manual solve, and the risk of selecting the wrong slice'],
   guideReview:'The puzzle-specific guides were inspected for their actual stages, repeated algorithms, setup choices and final checks. Text length alone is not a score: reference tables, generated move builders, recovery notes and repeated explanations can make an easy method look long.',
   evidence:'Original solution tutorials and puzzle descriptions are the main evidence. First-person reviews provide qualitative context for shape recognition. The final tiers and within-tier order are Puzzle Atlas editorial judgments, not consensus review scores.',
   sorting:'Colored puzzles are ordered Easy, Medium, then Hard, with an approximate editorial order within each tier. Nearby positions are not a precise measurement. Mirror entries follow all colored entries.',
   levels:{easy:'A small, reusable rule set with relatively clear piece recognition.',medium:'Several coordinated stages or a familiar method with extra recognition work.',hard:'Additional piece families, exceptional cases, demanding shape recognition, or sustained precise execution.','very-hard':'The atlas’s advanced shape-only mirror challenge; color cues are removed.'},
   scope:'Helicopter Cube is assessed for the normal half-turn model. Ratings for larger cubes extrapolate the established reduction method to the center and wing families documented in their local guides. Familiarity can make a particular puzzle feel much easier than its tier.',
   mirror:'Every mirror-mode entry is labeled Very Hard as a deliberate advanced challenge tier. This is a display convention for shape-only play, not a claim that removing color changes the legal move group or makes every mirror puzzle equally difficult.'
  },
  mirror:{difficulty:'very-hard',rationale:'Mirror mode removes the colored face cues while preserving the puzzle’s legal moves. You must identify destinations and orientations from shape and alignment; Puzzle Atlas labels this advanced shape-only challenge Very Hard.'},
  puzzles
 };
 if(typeof module==='object'&&module.exports)module.exports=data;
 if(root)root.HUMAN_DIFFICULTY=data;
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:null);
