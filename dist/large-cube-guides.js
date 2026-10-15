/* Reduction instructions and slot cycles checked against nxn-engine.js. */
(function () {
  'use strict';
  const base = window.CUBE_GUIDES.cube3;
  const flip = "R U R' F R' F' R";
  const flipInverse = "R' F R F' R U' R'";
  const wingCycle = (slice) => `${slice}' ${flip} ${slice} ${flipInverse}`;
  const parity = (right, left) => `${right}2 B2 U2 ${left} U2 ${right}' U2 ${right} U2 F2 ${right} F2 ${left}' B2 ${right}2`;
  const layer = (face, depth) => face + (depth===4?'iv':'i'.repeat(depth));
  const innerDepths = n => Array.from({length:Math.floor((n-2)/2)},(_,i)=>i+1);
  const wholeEdgeParity = n => {
    const right=innerDepths(n).map(d=>layer('R',d)+'2').join(' '), up=innerDepths(n).map(d=>layer('U',d)+'2').join(' ');
    return `${right} U2 ${right} U2 ${up} ${right} U2 ${up} U2`;
  };
  const sources = [
    {label:'CubeSkills / Feliks Zemdegs — 5×5×5 reduction method',url:'https://www.cubeskills.com/uploads/pdf/tutorials/beginners-method-for-solving-the-5x5-cube.pdf'},
    {label:'Jaap’s Puzzle Page — centers, wings and the odd-cube parity constraints',url:'https://www.jaapsch.net/puzzles/cube5.htm'},
    {label:'CubeSkills — reduction on 6×6×6 and 7×7×7',url:'https://www.cubeskills.com/tutorials/big-cube-tutorials'},
    ...base.sources
  ];
  const centerTable = (n) => {
    const e=n-1, levels=innerDepths(n).map(d=>[e-2*d,layer('R',d),layer('L',d)]);
    if(n%2)levels.push([0,'','M']);
    const cell=(r,c)=>`row ${r}, col ${c}`;
    const rows=[];
    levels.filter(([a])=>a>0).forEach(([a,A])=>levels.forEach(([b,,B])=>{
      rows.push(`<tr><td>${A}</td><td>${B}</td><td>${cell((e-b)/2+1,(e+a)/2+1)}</td><td>${cell((e-a)/2+1,(e-b)/2+1)}</td><td>${cell((e-b)/2+1,(e+a)/2+1)}</td></tr>`);
    }));
    return '<table><thead><tr><th>A</th><th>B</th><th>U slot</th><th>F slot 1</th><th>F slot 2</th></tr></thead><tbody>'+rows.join('')+'</tbody></table>';
  };
  const makeGuide = (n) => {
    const odd=n%2===1, wings=n-2, centers=n-2, depths=innerDepths(n), h=depths.length;
    const pairNames=h===1?['outer']:h===2?['outer','inner']:h===3?['outer','middle','inner']:['outer','second','third','inner'];
    const orbitText=`${h} wing ${h===1?'pair':'pairs'}${odd?' around a central edge piece':', with no central edge piece'}`;
    const centerOrder=odd
      ? `Start with the central ${n===5?'bar':'3×3 section'} through the fixed center, then extend ${n===5?'each bar to three pieces':n===7?'to five-piece bars':'to a 5×5 section and finally seven-piece bars'}. Join matching bars until the ${centers}×${centers} block is complete.`
      : `Build a central 2×2 block, then extend it ${n===6?'to four-piece bars':n===8?'to 4×4 and finally six-piece bars':'to 4×4, then 6×6 and finally eight-piece bars'}. Join matching bars until the ${centers}×${centers} block is complete. The inside-out order makes the remaining center families easier to track.`;
    const orbits=depths.map((d,i)=>[pairNames[i],layer('R',d),layer('L',d),layer('U',d)]);
    const parityRows=orbits.map(([name,r,l])=>`<tr><th>${name} wings</th><td><code>${parity(r,l)}</code></td></tr>`).join('');
    const cycleRows=orbits.map(([name,,,u])=>`<tr><th>${name} wings</th><td><code>${wingCycle(u)}</code></td></tr>`).join('');
    const sliceList=orbits.map(([name,,,u])=>`<strong>${u}</strong> for the ${name} pair`).join('; ');
    const inwardNames=orbits.map(([,r])=>r).join('/'), upwardNames=orbits.map(([,,,u])=>u).join('/');
    const across=['L',...depths.map(d=>layer('L',d)),...(odd?['M']:[]),...depths.slice().reverse().map(d=>layer('R',d)),'R'].join(' · ');
    const pairingIntro=odd
      ? `The central edge piece is your reference. Attach the ${2*h} matching wings to it, with the same color visible along each side of the strip. Work from the innermost pair outward, completing one depth before adding the next.`
      : `First pair the two innermost wings, then add one matching pair at a time toward the corners. Each completed pair is a reference for the next; there is no single central edge piece to orient it for you. The completed edge is a straight ${wings}-piece strip: both visible sides must be one color.`;
    const movableCenters=6*(centers*centers-(odd?1:0)), centerFamilies=movableCenters/24;
    const steps = [
      {
        title:`Know the pieces and choose a color frame`,
        body:`<p>Each face has a ${centers}×${centers} center block. Each complete edge contains ${wings} pieces: ${orbitText}. Corners still have three stickers, and a center piece still has only one.</p><p>${odd?'The six single stickers at the exact centers define your colors. Middle-slice moves can move this reference frame, so use their current arrangement consistently; the reduction method itself does not require M, E or S except for the optional center cycle.':'There is no fixed center sticker. Build the original color arrangement: U white, D yellow, F green, B blue, R red, L orange. Check an actual corner to confirm the side-color order; opposite pairs alone are not enough.'}</p><p>The ${n}×${n} has ${movableCenters} movable center pieces in ${centerFamilies} separate 24-piece families, plus ${24*h} wings in ${h} 24-piece families${odd?' and twelve central edge pieces':''}. A legal move cannot exchange a wing between different depths or a center between different families. Each movable center family supplies four stickers of each face color; the table below gives a separate working cycle for all ${centerFamilies}.${odd?' The six exact face-center stickers form a separate frame; the center cycles leave them untouched.':''}</p><p>Reduction means finishing these larger centers and edges first. They then move as six centers and twelve edges in the complete 3×3×3 method below.</p>`
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
        body:`<p>${pairingIntro}</p><p>Work between the vertical FL and FR edges. Outer moves position candidate pieces without splitting centers. Turn a horizontal inner slice to bring a matching wing alongside its reference piece; inspect both stickers. Move a completed strip out of the working zone with <code>R U R'</code> or <code>R U' R'</code>, bringing an unfinished strip down, then reverse the slice to restore the centers.</p><p>If a working strip faces the wrong way, <code>${flip}</code> reverses FR end-for-end. It also rearranges complete outer-layer edges and corners, which are not being solved yet. Never stop midway through the sequence.</p><p>Use the slice corresponding to the wing you are pairing: ${sliceList}. Keep completed strips in the top or bottom layer while working. If an insertion would split one, choose a different unfinished storage slot or use the controlled cycle below.</p>`
      },
      {
        title:'Finish awkward edges · a controlled wing cycle',
        body:`<p>This longer tool leaves all centers, corners and other edge pieces exactly where they started. It moves only three wings at the selected distance from the edge midpoint:</p><p><strong>FL upper wing → FR upper wing → FR lower wing → FL upper wing.</strong> “Upper” means closer to U, and “lower” closer to D. Use ${sliceList}. “Inner” is nearest the midpoint and “outer” nearest a corner.</p><table><thead><tr><th>Pair</th><th>Three-wing cycle</th></tr></thead><tbody>${cycleRows}</tbody></table><p>Put an unfinished strip at FR and a supplying strip at FL using outer turns. Select a direction that brings the wanted wing into its intended FR position; repeat the whole cycle twice to run it backward. A wing arriving from FL turns its F sticker toward R, so inspect both colors when setting up. The return from FR lower to FL upper keeps its F sticker on F.</p><p>For setups involving more than one outer turn, record the setup, run the cycle, and undo the setup. Only those three wings are changed. Repeat on unfinished wings until every strip matches, apart from a possible reversed pair handled next. On ${n}×${n}, ${odd?'central edge pieces stay untouched by this cycle':'finish the innermost pair first and work outward one depth at a time'}.</p>`
      },
      {
        title:odd?'Edge parity · repair a reversed wing pair':'Edge pairing parity · repair one wing orbit',
        body:`<p>If one edge strip has two matching wings reversed relative to its other pieces, put that strip at UF with outer turns. Run the repair for that wing pair:</p><table><thead><tr><th>Pair</th><th>Repair at UF</th></tr></thead><tbody>${parityRows}</tbody></table><p>Each repair exchanges and turns over <em>only the two UF wings in that orbit</em>. It restores every center color and leaves the corners and other edge pieces fixed. Use only the rows for reversed pairs; any of the ${h} pairs can need repair. Restore any setup turns afterward.</p><p>${odd?'Once all twelve strips match, the central edge pieces enforce the ordinary 3×3×3 constraints. A fully reduced odd cube cannot have a single flipped whole edge or a lone two-edge exchange. If you see one, recheck the wing pairing and center colors instead of using an even-cube PLL repair.':`This is also the OLL-parity repair during the 3×3×3 stage. If a whole ${wings}-piece edge is flipped, run all ${h} rows at UF. One row turns over only two of the ${wings} wings. With three wrongly oriented edges, this removes the odd obstruction, and the normal top-cross step handles the remaining two.`}</p>`
      }
    ];
    if (!odd) steps.push({
      title:`${n}×${n} permutation parity · exchange two whole edges`,
      body:`<p>After reduction, a two-edge exchange can remain even when the corners are correct. This sequence exchanges all ${wings} UF pieces with all ${wings} UB pieces, preserves every corner, and restores every center color:</p><p><code>${wholeEdgeParity(n)}</code></p><p>Keep every ${inwardNames} and ${upwardNames} group: all ${h} depths are necessary to move complete ${wings}-piece edges and restore the centers. These are separate single-slice half turns, not wide turns.</p><p>For opposite swapped edges on U, turn U until they occupy UF and UB. For adjacent swapped edges or a two-corner exchange, run the repair once, then repeat the ordinary edge- and corner-placement stages below. OLL parity and this permutation parity are different: repair a flipped edge with the previous ${h} rows, and a remaining odd exchange with this sequence.</p>`
    });
    steps.push({
      title:'Begin the 3×3×3 stage',
      body:`<p>Check all six center blocks and all twelve edge strips before proceeding. From now on, use only outer face turns except for a stated parity repair. Read “center” below as one complete ${centers}×${centers} block, and “edge” as one complete ${wings}-piece strip.</p>`
    });
    steps.push(...base.steps.map((s,i)=>i===0?{
      title:'3×3×3 stage · establish your colors',
      body:'<p>Use the completed D-center block as your first-layer color and the U-center block as your last-layer color. The center arrangement already chosen remains your reference throughout the solve.</p>'
    }:{...s,title:'3×3×3 stage · '+s.title.charAt(0).toLowerCase()+s.title.slice(1)}));
    steps.push(window.CUBE_GUIDE_TOOLS.completeRoute(n));
    return {
      title:`${n}×${n}×${n} · centers, edges, then 3×3×3`,
      intro:`Build the six ${centers}×${centers} center blocks and twelve ${wings}-piece edge strips. The guide includes precise center and wing cycles, ${odd?'wing-pair repairs':'both parity repairs'}, and every step of the final 3×3×3 solve.`,
      notation:base.notation.concat([
        `Each button turns exactly one layer. ${depths.map(d=>`${layer('R',d)} is ${d===1?'the layer just inside R':`inner layer ${d} counting inward from R`}`).join('; ')}. The same naming applies to U, D, F, B and L.${n===10?' The fourth inner slice is labeled Riv: iv means fourth. Move input also accepts Riiii (four i characters) for the same layer.':''} ${odd?'M turns like L, E like D, and S like F. These are single central slices.':'There is no single middle layer on this even cube.'}`,
        `Across the cube from L to R, the layers are <code>${across}</code>. Every algorithm here is already written in the game’s single-layer notation; no unlisted wide-turn button is needed.`,
        'A setup is a short sequence used to bring pieces to the listed working positions. Undo it afterward by reversing the order and inverting each move. Example: after setup <code>U R2</code>, the undo is <code>R2 U\'</code>. Camera dragging alone never changes letter names.'
      ]),
      steps,
      sources:n>=8?[
        {label:'CubeSkills / Feliks Zemdegs — big-cube reduction, centers, edges and the 3×3×3 stage',url:'https://www.cubeskills.com/tutorials/big-cube-tutorials'},
        {label:'Jaap’s Puzzle Page — Rubik’s Revenge and even-cube edge parity',url:'https://www.jaapsch.net/puzzles/cube4.htm'},
        {label:'Jaap’s Puzzle Page — Professor’s Cube: center families and reduction',url:'https://www.jaapsch.net/puzzles/cube5.htm'},
        ...base.sources
      ]:sources
    };
  };
  window.LARGE_CUBE_GUIDES = Object.fromEntries([5,6,7,8,9,10].map(n=>['cube'+n,makeGuide(n)]));
})();
