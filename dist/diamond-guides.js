/* In-game diamond methods. Band operations are checked against ShapeEngine;
 * the cuboctahedron embeds the existing complete 3x3 beginner instructions. */
(function () {
  'use strict';
  const cube = window.CUBE_GUIDES && window.CUBE_GUIDES.cube3;
  if (!cube) throw new Error('Load cube-guides.js before diamond-guides.js');
  const notation = cube.notation.slice();
  const styleSource = {label:'Jaap Scherphuis — Diamond Style Puzzler: mechanism and band method',url:'https://www.jaapsch.net/puzzles/diamstyl.htm'};
  const cubeSource = {label:'Jaap Scherphuis — Diamond Cube and the 3×3 mechanism',url:'https://www.jaapsch.net/puzzles/cube3.htm'};
  const museumSource = {label:'Smithsonian National Museum of American History — The Diamond, collection record nmah_1301122',url:'https://americanhistory.si.edu/collections/object/nmah_1301122'};
  window.DIAMOND_GUIDES = {
    diamondstyle: {
      title:'Diamond Puzzler · restore the three bands',
      intro:'Solve the green edge belt, separate the upper and lower edge colors, then separate the corner colors. Matching pieces within one band are interchangeable.',
      notation:notation.concat([
        'The six axis labels refer to the underlying cube mechanism. U is the red cap, D the blue cap. Four green square centers surround the middle. The triangular surfaces are corner pieces; the rectangular surfaces are edges. Each entire piece has one visible color.',
        'A slot name describes a mechanism position, not a separate colored face. UF is the rectangle between the U and F axis centers. UFR is the triangle between U, F and R. Use the 3D view to identify these positions; ring-map nodes show their current colors.'
      ]),
      steps:[
        {
          title:'Read the goal before starting',
          body:'<p>This is the three-color shaved-cube puzzle, distinct from the fourteen-color Diamond Cuboctahedron. Its moves use the 3×3 mechanism, but edge flips and corner twists are not visible. Jaap’s band method is summarized in the next three stages.</p><p>In this game, the target has nine red pieces above the green belt, eight green pieces in the belt, and nine blue pieces below it. Six square centers stay at their axis positions. You therefore need to sort only twelve edge rectangles and eight corner triangles.</p><p><strong>A band is a layer of pieces, not one polygonal face.</strong> A red corner and a red edge may have different shapes and still belong together in the upper band. A U or D turn can rearrange their hidden identities without spoiling a finished band.</p>'
        },
        {
          title:'1 · Fill the green edge belt',
          body:'<p>Choose a working front with a non-green edge at FR. Turn U to place a green edge at UF, then execute <code>R U\' R\'</code>. Repeat while U contains green edges.</p><p>Then use D as the working top and repeat. Finish when all four middle edges are green.</p>'
        },
        {
          title:'Working with the lower layer',
          body:'<p>The axis letters on screen do not change when you orbit the camera. For the lower-layer version of the previous insertion, use this substitution:</p><table><thead><tr><th>Working letter</th><th>U</th><th>R</th><th>F</th><th>D</th><th>L</th><th>B</th></tr></thead><tbody><tr><th>Game button</th><td>D</td><td>L</td><td>F</td><td>U</td><td>R</td><td>B</td></tr></tbody></table><p>With that frame, a non-green game FL edge is the destination; turn game D until a green edge reaches game DF. The insertion is <code>L D\' L\'</code>. To work at another side, also apply the working-front table in the notation above. Leave prime marks and half-turn suffixes unchanged.</p><p>The insertion moves one green edge into the belt and ejects the previous occupant into the working upper layer. Other belt slots remain fixed. Once a belt slot is green, choose a different unfinished destination. Each insertion increases the number of completed belt slots.</p>'
        },
        {
          title:'2 · Separate red and blue edges',
          body:'<p>Return to the ordinary U/D frame. Put a blue edge at UF and a red edge at DF using U and D turns. Execute <code>F2</code>. Repeat until every upper edge is red and every lower edge is blue.</p><p>The belt stays green: its affected edges only exchange places within that belt. Ignore the corners until the next stage.</p>'
        },
        {
          title:'3 · Separate red and blue corners',
          body:'<p>Put a blue corner at UFR and a red corner at DFR using U and D turns. Execute <code>U F U D B L R B</code>. Repeat until the upper corners are red and the lower corners blue.</p>'
        },
        {
          title:'Check each complete operation',
          body:'<p>The eight-move corner operation sends the selected DFR corner to UFR and the selected UFR corner into the lower band. It also rearranges other pieces <em>within</em> their own bands. It is not an isolated swap of two labeled nodes. Finish the whole sequence before inspecting the result.</p><p>After the edge belt is complete, wrong upper and lower edges occur in matching numbers. Each edge exchange fixes one of each. The same counting argument applies to the corners: each eight-move operation fixes two wrongly colored corners while preserving every edge band. Neither stage needs more than four exchanges.</p><p>Inspect the underside too. A completed puzzle has a red upper cap and surrounding red pieces, an unbroken green belt, and an entirely blue lower layer. There is no additional orientation stage. Auto Solve may restore more of the original piece identities than this color-only method requires; it need not follow these short band operations or produce a shortest solution.</p><p>For manual Constrained Solver experiments, holds protect exact selected nodes at the endpoint. They may move temporarily. Holding every green node by identity is a stronger requirement than merely keeping the belt green, so it can rule out a useful band operation. Use fewer holds if a requested pair is unavailable.</p>'
        }
      ],
      sources:[styleSource,cubeSource]
    },
    diamondcube: {
      title:'Diamond Cuboctahedron · a 3×3 inside a cuboctahedron',
      intro:'Use the six square faces as an ordinary 3×3. Their colors identify all the underlying cube pieces; solving them also completes the eight triangular faces.',
      notation:notation.concat([
        'U, R, F, D, L and B name the six square faces and their quarter-turn axes. The eight triangular faces are additional colored surfaces; they are not turning axes. There are six directed turning sides, arranged along three opposite axis pairs.',
        'The starting square centers are U green, R yellow, F orange, D blue, L white and B red. Use the actual centers as your reference. The familiar white/yellow first-layer convention is unnecessary: the instructions below use D’s color first and U’s color last.'
      ]),
      steps:[
        {
          title:'Identify the cube pieces beneath the extra faces',
          body:'<p>This is the <strong>Diamond Cuboctahedron</strong>, also documented as The Diamond. It has six square faces and eight triangular faces, each with its own color. The mechanism and solving moves are those of a 3×3 cube.</p><table><thead><tr><th>Visible feature</th><th>Underlying piece</th><th>How to read it</th></tr></thead><tbody><tr><td>Small square in a square face</td><td>One of six fixed face centers</td><td>Its color identifies that axis.</td></tr><tr><td>Pentagon beside a square center</td><td>One of twelve edges</td><td>Find its second pentagon on the neighboring square face; those two square-face colors identify its destination.</td></tr><tr><td>Large hexagon inside a triangular face</td><td>One of eight corners</td><td>The same physical piece carries three tiny triangles on neighboring square faces. Their three colors identify its cube corner.</td></tr></tbody></table><p>A square face contains nine patches: the central square, four pentagons and four tiny corner triangles. A triangular face contains a corner’s large hexagon and three small triangles belonging to edges. Those extra triangles travel with their edge pieces; they are not independently movable.</p>'
        },
        {
          title:'Set up your first layer',
          body:'<p>Use the D square center’s color for the first layer and the U square center’s color for the last. At reset these are blue and green. Keep the axis labels fixed while following the algorithms; camera rotation only changes the view.</p><p>For every mention of an edge sticker below, inspect a <strong>pentagon on a square face</strong>. For a corner sticker, inspect a <strong>tiny triangle on a square face</strong>. Ignore the extra triangular-face colors during these stages. The complete beginner method follows here; no external guide is needed.</p>'
        },
        ...cube.steps.slice(1).map(step=>({title:step.title,body:step.body})),
        {
          title:'Verify all fourteen faces',
          body:'<p>First check all nine patches of each square face, including the tiny triangles at its corners. All six square faces must be uniform and match their centers. An edge pentagon can look correct on one side while its second pentagon exposes a wrong position or flip. A large corner hexagon alone does not show whether the corner’s three square-face colors are oriented correctly.</p><p>Once the underlying edges and corners are in their correct positions and orientations, their extra patches complete the eight triangular faces automatically. Each large hexagon should match its three neighboring small triangles. A mismatch means a cube piece still needs attention; do not try to turn the triangular face itself.</p><p>There is no extra face-center orientation repair on this color scheme. A single-color square center has fourfold symmetry, so an otherwise hidden quarter-turn does not spoil it. This differs from shape modifications with visibly directional centers.</p><p>Auto Solve uses the current state and the same six legal turning sides. Manual Constrained Solver holds exact selected patches, not just their colors. Several patches belong to one rigid edge or corner, so holding one of those patches can restrict which other patches can exchange. A gray unavailable choice is a legal-move restriction, not an invitation to move a sticker separately.</p>'
        }
      ],
      sources:[museumSource,cubeSource,...cube.sources.filter(source=>source.url!==cubeSource.url)]
    }
  };
})();
