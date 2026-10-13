/* Reduction instructions and slot cycles checked against nxn-engine.js. */
(function () {
  'use strict';
  const base = window.CUBE_GUIDES.cube3;
  const flip = "R U R' F R' F' R";
  const flipInverse = "R' F R F' R U' R'";
  const wingCycle = (slice) => `${slice}' ${flip} ${slice} ${flipInverse}`;
  const parity = (right, left) => `${right}2 B2 U2 ${left} U2 ${right}' U2 ${right} U2 F2 ${right} F2 ${left}' B2 ${right}2`;
  const parity6 = 'Ri2 Rii2 U2 Ri2 Rii2 U2 Ui2 Uii2 Ri2 Rii2 U2 Ui2 Uii2 U2';
  const parity8 = 'Ri2 Rii2 Riii2 U2 Ri2 Rii2 Riii2 U2 Ui2 Uii2 Uiii2 Ri2 Rii2 Riii2 U2 Ui2 Uii2 Uiii2 U2';
  const sources = [
    {label:'CubeSkills / Feliks Zemdegs — 5×5 reduction method',url:'https://www.cubeskills.com/uploads/pdf/tutorials/beginners-method-for-solving-the-5x5-cube.pdf'},
    {label:'Jaap’s Puzzle Page — centers, wings and the odd-cube parity constraints',url:'https://www.jaapsch.net/puzzles/cube5.htm'},
    {label:'CubeSkills — reduction on 6×6 and 7×7',url:'https://www.cubeskills.com/tutorials/big-cube-tutorials'},
    ...base.sources
  ];
  const centerTable = (n) => {
    const e=n-1, levels=n===5?[[2,'Ri','Li'],[0,'','M']]:n===6?[[3,'Ri','Li'],[1,'Rii','Lii']]:n===7?[[4,'Ri','Li'],[2,'Rii','Lii'],[0,'','M']]:[[5,'Ri','Li'],[3,'Rii','Lii'],[1,'Riii','Liii']];
    const cell=(r,c)=>`row ${r}, col ${c}`;
    const rows=[];
    levels.filter(([a])=>a>0).forEach(([a,A])=>levels.forEach(([b,,B])=>{
      rows.push(`<tr><td>${A}</td><td>${B}</td><td>${cell((e-b)/2+1,(e+a)/2+1)}</td><td>${cell((e-a)/2+1,(e-b)/2+1)}</td><td>${cell((e-b)/2+1,(e+a)/2+1)}</td></tr>`);
    }));
    return '<table><thead><tr><th>A</th><th>B</th><th>U slot</th><th>F slot 1</th><th>F slot 2</th></tr></thead><tbody>'+rows.join('')+'</tbody></table>';
  };
  const makeGuide = (n) => {
    const odd=n%2===1, wings=n-2, centers=n-2;
    const orbitText=n===5?'one pair of wings around a central edge':n===6?'an inner pair and an outer pair of wings':n===7?'two wing pairs around a central edge':'three wing pairs, called outer, middle and inner, with no central edge piece';
    const centerOrder=n===5?'Start with the middle bar through the fixed center; add a bar on either side.':n===6?'Build two-piece bars into a 2×2 block, extend them to four-piece bars, and join four bars.':n===7?'Build the central 3×3 section first, then extend its bars to five pieces and add the two outside bars.':'Build a central 2×2 block, extend it to 4×4, then complete the 6×6 block with six-piece bars. The inside-out order makes it easier to see which center families still need work.';
    const orbits=n===5?[['outer','Ri','Li','Ui']]:n===8?[['outer','Ri','Li','Ui'],['middle','Rii','Lii','Uii'],['inner','Riii','Liii','Uiii']]:[['outer','Ri','Li','Ui'],['inner','Rii','Lii','Uii']];
    const parityRows=orbits.map(([name,r,l])=>`<tr><th>${name} wings</th><td><code>${parity(r,l)}</code></td></tr>`).join('');
    const cycleRows=orbits.map(([name,,,u])=>`<tr><th>${name} wings</th><td><code>${wingCycle(u)}</code></td></tr>`).join('');
    const pairingIntro=odd?`The central edge piece is your reference. Attach the ${n===5?'two':'four'} matching wings to it, with the same color visible along each side of the strip. ${n===7?'Work on the inner wing pair first; then add the outer pair.':''}`:n===8?'First pair the two innermost wings, then add the middle pair, then the outer pair. Each matching pair becomes a reference for the next; there is no single center edge to orient it for you. The completed edge is a straight six-piece strip: both of its visible sides must be one color.':'First pair the two innermost wings, then add the two outer wings. The completed edge is a straight four-piece strip: both of its visible sides must be one color.';
    const steps = [
      {
        title:`Know the pieces and choose a color frame`,
        body:`<p>Each face has a ${centers}×${centers} center block. Each complete edge contains ${wings} pieces: ${orbitText}. Corners still have three stickers, and a center piece still has only one.</p><p>${odd?'The six single stickers at the exact centers define your colors. Middle-slice moves can move this reference frame, so use their current arrangement consistently; the reduction method itself does not require M, E or S except for the optional center cycle.':'There is no fixed center sticker. Build the original color arrangement: U white, D yellow, F green, B blue, R red, L orange. Check an actual corner to confirm the side-color order; opposite pairs alone are not enough.'}</p>${n===8?'<p>The 8×8 has 216 movable center pieces in nine separate 24-piece families, plus 72 wings in three 24-piece families. A legal move cannot exchange a wing between different depths or a center between different families. Each center family supplies four stickers of each face color; the table below gives a separate working cycle for all nine.</p>':''}<p>Reduction means finishing these larger centers and edges first. They then move as six centers and twelve edges in the complete 3×3 method below.</p>`
      },
      {
        title:`Build six ${centers}×${centers} centers`,
        body:`<p>${centerOrder} Build one center on L, then its opposite on R. With these complete, inner slices parallel to L/R can move center pieces between U, F, D and B without cutting the L or R centers.</p><p>Finish F and U next, then the remaining two faces. A useful insertion pattern is <strong>slice, move the new bar clear, restore the slice</strong>. Align a source bar with an unfinished column on the destination. Turn that slice to deliver it. Turn the destination so the new bar leaves the slice’s return path, then reverse the slice. Check the earlier centers after every insertion.</p><p>Do not force unlike center pieces together: face turns rotate a piece around its face center, but do not change its distance from that center. When the last two centers resist a bar insertion, use the precise three-piece cycle in the next step.</p>`
      },
      {
        title:'A precise center tool · cycle just three pieces',
        body:`<p>For the last few center pieces, this sequence moves only three center stickers and restores every edge and corner:</p><p><code>A U' B' U A' U' B U</code></p><p>Replace A and B with one row of the table. It cycles <strong>U slot → F slot 1 → F slot 2 → U slot</strong>. Doing the entire sequence twice reverses the cycle. The different rows cover the movable center families in this cube.</p><p>Count rows and columns across the <em>whole ${n}×${n} face</em>, including the outside border. On F, U is above and R is to the right. On U, B is above and R is to the right.</p>${centerTable(n)}<p>Use face turns to bring a wrong U sticker to the listed U slot and a wanted U-color sticker to F slot 2. Keep F slot 1 as a temporary buffer, then run the cycle. A setup may use other slices when the wanted piece is on another face; write those setup moves down, perform the cycle, and undo the setup in reverse order with every direction inverted. That confines the final change to the three setup positions. Choose those positions among unfinished centers; the cycle can also exchange two visible colors by using two interchangeable same-color centers as its third piece.</p><p>Repeat until all six blocks are uniform. These slot cycles are verified against this game’s exact move model.</p>`
      },
      {
        title:`Pair the twelve ${wings}-piece edges`,
        body:`<p>${pairingIntro}</p><p>Work between the vertical FL and FR edges. Outer moves position candidate pieces without splitting centers. Turn a horizontal inner slice to bring a matching wing alongside its reference piece; inspect both stickers. Move a completed strip out of the working zone with <code>R U R'</code> or <code>R U' R'</code>, bringing an unfinished strip down, then reverse the slice to restore the centers.</p><p>If a working strip faces the wrong way, <code>${flip}</code> reverses FR end-for-end. It also rearranges complete outer-layer edges and corners, which are not being solved yet. Never stop midway through the sequence.</p><p>Use the slice corresponding to the wing you are pairing: Ui for the outer wing positions${n===8?', Uii for the middle pair and Uiii for the inner pair':n>5?', Uii for the inner wing positions':''}. Keep completed strips in the top or bottom layer while working. If an insertion would split one, choose a different unfinished storage slot or use the controlled cycle below.</p>`
      },
      {
        title:'Finish awkward edges · a controlled wing cycle',
        body:`<p>This longer tool leaves all centers, corners and other edge pieces exactly where they started. It moves only three wings at the selected distance from the edge midpoint:</p><p><strong>FL upper wing → FR upper wing → FR lower wing → FL upper wing.</strong> “Upper” means closer to U, and “lower” closer to D. Use Ui for the wings nearest the corners${n===8?', Uii for the middle pair, or Uiii for the pair nearest the midpoint':n>5?', or Uii for the pair nearer the midpoint':''}.</p><table><thead><tr><th>Pair</th><th>Three-wing cycle</th></tr></thead><tbody>${cycleRows}</tbody></table><p>Put an unfinished strip at FR and a supplying strip at FL using outer turns. Select a direction that brings the wanted wing into its intended FR position; repeat the whole cycle twice to run it backward. A wing arriving from FL turns its F sticker toward R, so inspect both colors when setting up. The return from FR lower to FL upper keeps its F sticker on F.</p><p>For setups involving more than one outer turn, record the setup, run the cycle, and undo the setup. Only those three wings are changed. Repeat on unfinished wings until every strip matches, apart from a possible reversed pair handled next. On ${n}×${n}, ${odd?'central edge pieces stay untouched by this cycle':n===8?'finish the inner pair, then the middle pair, then the outer pair':'finish the inner pair before matching the outside pair to it'}.</p>`
      },
      {
        title:odd?'Edge parity · repair a reversed wing pair':'Edge pairing parity · repair one wing orbit',
        body:`<p>If one edge strip has two matching wings reversed relative to its other pieces, put that strip at UF with outer turns. Run the repair for that wing pair:</p><table><thead><tr><th>Pair</th><th>Repair at UF</th></tr></thead><tbody>${parityRows}</tbody></table><p>Each repair exchanges and turns over <em>only the two UF wings in that orbit</em>. It restores every center color and leaves the corners and other edge pieces fixed. ${n===8?'Use only the rows for the reversed pairs; one, two or all three can need repair.':n>5?'If both pairs are reversed, perform both rows.':''} Restore any setup turns afterward.</p><p>${odd?'Once all twelve strips match, the central edge pieces enforce the ordinary 3×3 constraints. A fully reduced odd cube cannot have a single flipped whole edge or a lone two-edge exchange. If you see one, recheck the wing pairing and center colors instead of using an even-cube PLL repair.':n===8?'This is also the OLL-parity repair during the 3×3 stage. If a whole six-piece edge is flipped, run all three rows at UF. One row turns over only two of the six wings. With three wrongly oriented edges, this removes the odd obstruction, and the normal top-cross step handles the remaining two.':'This is also the OLL-parity repair during the 3×3 stage. If a whole four-piece edge is flipped, run both rows at UF; one row would turn over only half the edge. With three wrongly oriented edges, this removes the odd obstruction, and the normal top-cross step handles the remaining two.'}</p>`
      }
    ];
    if (!odd) steps.push({
      title:`${n}×${n} permutation parity · exchange two whole edges`,
      body:n===8?`<p>After reduction, a two-edge exchange can remain even when the corners are correct. This sequence exchanges all six UF pieces with all six UB pieces, preserves every corner, and restores every center color:</p><p><code>${parity8}</code></p><p>Keep every Ri/Rii/Riii and Ui/Uii/Uiii group: all three depths are necessary to move complete six-piece edges and restore the centers. The moves are separate single-slice half turns, not wide turns.</p><p>For opposite swapped edges on U, turn U until they occupy UF and UB. For adjacent swapped edges or a two-corner exchange, run the repair once, then repeat the ordinary edge- and corner-placement stages below. OLL parity and this permutation parity are different: repair a flipped edge with the previous three rows, and a remaining odd exchange with this sequence.</p>`:`<p>After reduction, a two-edge exchange can remain even when the corners are correct. This sequence exchanges all four pieces of UF with all four pieces of UB, preserves the corners, and restores every center color:</p><p><code>${parity6}</code></p><p>Keep every Ri/Rii and Ui/Uii pair in the sequence: using only one depth would disturb the centers. For opposite swapped edges on U, turn U until they occupy UF and UB. For adjacent swapped edges or a two-corner exchange, run it once, then repeat the ordinary edge- and corner-placement stages below to finish.</p>`
    });
    steps.push({
      title:'Begin the 3×3 stage',
      body:`<p>Check all six center blocks and all twelve edge strips before proceeding. From now on, use only outer face turns except for a stated parity repair. Read “center” below as one complete ${centers}×${centers} block, and “edge” as one complete ${wings}-piece strip.</p>`
    });
    steps.push(...base.steps.map((s,i)=>i===0?{
      title:'3×3 stage · establish your colors',
      body:'<p>Use the completed D-center block as your first-layer color and the U-center block as your last-layer color. The center arrangement already chosen remains your reference throughout the solve.</p>'
    }:{...s,title:'3×3 stage · '+s.title.charAt(0).toLowerCase()+s.title.slice(1)}));
    return {
      title:`${n}×${n} · centers, edges, then 3×3`,
      intro:`Build the six ${centers}×${centers} center blocks and twelve ${wings}-piece edge strips. The guide includes precise center and wing cycles, ${odd?'wing-pair repairs':'both parity repairs'}, and every step of the final 3×3 solve.`,
      notation:base.notation.concat([
        `Each button turns exactly one layer. Ri is the layer just inside R${n>5?'; Rii is the next layer inward':''}${n===8?'; Riii is the third inner layer, closest to the midpoint':''}. The same naming applies to U, D, F, B and L. ${odd?'M turns like L, E like D, and S like F. These are single central slices.':'There is no single middle layer on this even cube.'}`,
        `Across the cube from L to R, the layers are <code>${n===5?'L · Li · M · Ri · R':n===6?'L · Li · Lii · Rii · Ri · R':n===7?'L · Li · Lii · M · Rii · Ri · R':'L · Li · Lii · Liii · Riii · Rii · Ri · R'}</code>. Every algorithm here is already written in the game’s single-layer notation; no unlisted wide-turn button is needed.`,
        'A setup is a short sequence used to bring pieces to the listed working positions. Undo it afterward by reversing the order and inverting each move. Example: after setup <code>U R2</code>, the undo is <code>R2 U\'</code>. Camera dragging alone never changes letter names.'
      ]),
      steps,
      sources:n===8?[
        {label:'CubeSkills / Feliks Zemdegs — big-cube reduction, centers, edges and the 3×3 stage',url:'https://www.cubeskills.com/tutorials/big-cube-tutorials'},
        {label:'Jaap’s Puzzle Page — Rubik’s Revenge and even-cube edge parity',url:'https://www.jaapsch.net/puzzles/cube4.htm'},
        {label:'Jaap’s Puzzle Page — Professor’s Cube: center families and reduction',url:'https://www.jaapsch.net/puzzles/cube5.htm'},
        ...base.sources
      ]:sources
    };
  };
  window.LARGE_CUBE_GUIDES = {cube5:makeGuide(5),cube6:makeGuide(6),cube7:makeGuide(7),cube8:makeGuide(8)};
})();
