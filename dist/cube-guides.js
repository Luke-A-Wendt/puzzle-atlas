/* Original in-game instructions, checked against the puzzle engines. */
(function () {
  'use strict';
  const notation = [
    "U / D / F / B / R / L mean top / bottom / front / back / right / left. A move is clockwise when looking straight at that face; ' means counterclockwise and 2 means two quarter-turns.",
    "The game’s letters stay fixed when you drag the camera. Select the named axis in either panel and use Turn left or Turn right; each arrow’s tooltip gives its notation move. Letter keys also work (Shift for inverse). Do not infer an algorithm’s direction from a ring’s on-screen arrow alone.",
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
      body: '<p>First gather the four D-color edge stickers around the U center, facing upward: a “daisy.” Ignore corners. Keep every existing upward-facing petal; before a side turn that brings a new petal to U, turn U until that side’s U-edge slot is free of petals. Then handle one of these cases:</p><ol><li><strong>D color faces down:</strong> turn the side beside that edge twice (DF uses F2, DR uses R2, DB uses B2, DL uses L2).</li><li><strong>The edge is in the middle layer:</strong> use the exact table below, choosing the column where the D-color sticker currently faces. First clear the U-edge slot of the face named in the move.</li><li><strong>D color points sideways in the U layer:</strong> turn the side displaying that sticker clockwise once. The edge enters the middle layer; use the table.</li><li><strong>D color points sideways in the D layer:</strong> first clear the U-edge slot of the side displaying that sticker, then turn that side clockwise once. Use the middle-layer table on the resulting edge.</li></ol><table><thead><tr><th>Current edge</th><th>D color faces</th><th>Lift to U</th></tr></thead><tbody><tr><td>FR</td><td>F / R</td><td>R / F′</td></tr><tr><td>FL</td><td>F / L</td><td>L′ / F</td></tr><tr><td>BR</td><td>B / R</td><td>R′ / B</td></tr><tr><td>BL</td><td>B / L</td><td>L / B′</td></tr></tbody></table><p>These steps add a petal without removing an earlier one. Repeat until all four are at U. “Clear the slot” always means turning U, never removing a finished petal with a side turn.</p><p>For each petal, turn U until the edge’s side sticker matches the center beneath it. Turn that side twice to put the edge in D. Repeat for a four-edge bottom cross whose side stickers match their centers.</p>'
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
    {label:'J Perm — beginner 3×3×3 method',url:'https://jperm.net/3x3'},
    {label:'Stanford Cube Club — layer-by-layer reference',url:'https://cube.stanford.edu/class/files/rubiks_cube_solution.pdf'},
    {label:'Ruwix — beginner method and final-corner technique',url:'https://ruwix.com/the-rubiks-cube/how-to-solve-the-rubiks-cube-beginners-method/'},
    {label:'Jaap’s Puzzle Page — 3×3×3 structure and methods',url:'https://www.jaapsch.net/puzzles/cube3.htm'}
  ];
  // Coordinate-only guide builders. The puzzle engine is not loaded by a guide.
  // Each orbit has 24 slots; only ordered triples are searched, never puzzles.
  const toolCache = new Map();
  const opposite = {U:'D',D:'U',F:'B',B:'F',R:'L',L:'R'};
  const faceVector = {U:[0,1,0],D:[0,-1,0],F:[0,0,1],B:[0,0,-1],R:[1,0,0],L:[-1,0,0]};
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0), cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const inverseWord=word=>word.slice().reverse().map(m=>m.endsWith("'")?m.slice(0,-1):m+"'");
  function configuration(n){
    const e=n-1,levels=Array.from({length:n},(_,i)=>2*i-e),moves=[];
    [['L','R','M'],['D','U','E'],['B','F','S']].forEach(([lo,hi,mid],axis)=>levels.forEach((layer,i)=>{
      const depth=Math.min(i,n-1-i),name=layer===0?mid:(layer<0?lo:hi)+'i'.repeat(depth),turn=layer===0?(axis===2?-1:1):-Math.sign(layer);
      for(const dir of [1,-1])moves.push({name:name+(dir<0?"'":''),axis,layer,turn:turn*dir});
    }));
    return {e,moves};
  }
  function turnPoint(p,m){
    if(p[m.axis]!==m.layer)return p.slice();let [x,y,z]=p;
    for(let k=0;k<(m.turn+4)%4;k++)if(m.axis===0)[y,z]=[-z,y];else if(m.axis===1)[x,z]=[z,-x];else [x,y]=[-y,x];
    return [x||0,y||0,z||0];
  }
  function slotName(p,n,kind){
    const e=n-1,faces=Object.keys(faceVector).filter(f=>dot(p,faceVector[f])===e);
    if(kind==='wing'){
      const axis=p.findIndex(v=>Math.abs(v)!==e),toward=[['L','R'],['D','U'],['B','F']][axis][p[axis]>0?1:0];
      return faces.join('')+' · toward '+toward+' · depth '+((e-Math.abs(p[axis]))/2);
    }
    const face=faces[0];let row,col;
    if(face==='F'){row=e-p[1];col=e+p[0];}if(face==='B'){row=e-p[1];col=e-p[0];}
    if(face==='R'){row=e-p[1];col=e-p[2];}if(face==='L'){row=e-p[1];col=e+p[2];}
    if(face==='U'){row=e+p[2];col=e+p[0];}if(face==='D'){row=e-p[2];col=e+p[0];}
    return face+' · row '+(row/2+1)+' · col '+(col/2+1);
  }
  function families(n,kind){
    const positive=Array.from({length:Math.floor((n-2)/2)},(_,i)=>n-3-2*i),out=[];
    if(kind==='wing')positive.forEach((a,i)=>out.push({a,depth:i+1,label:'Wing depth '+(i+1)}));
    else positive.forEach((a,i)=>[...positive,...(n%2?[0]:[])].forEach((b,j)=>out.push({a,b,A:'R'+'i'.repeat(i+1),B:b?'L'+'i'.repeat(j+1):'M',label:'Center family '+(out.length+1)+' · '+slotName([a,n-1,-b],n,'center')})));
    return out;
  }
  function orbitData(n,kind,family){
    const key=[n,kind,family].join('/');if(toolCache.has(key)){const d=toolCache.get(key);toolCache.delete(key);toolCache.set(key,d);return d;}
    const cfg=configuration(n),e=cfg.e,f=families(n,kind)[family];if(!f)throw Error('Choose a valid piece family.');
    const a=f.a,b=f.b,basePoints=kind==='center'?[[a,e,-b],[-b,a,e],[a,b,e]]:[[-e,a,e],[e,a,e],[e,-a,e]];
    const flip="R U R' F R' F' R".split(' '),slice='U'+'i'.repeat(f.depth||1);
    const work=kind==='center'?`${f.A} U' ${f.B}' U ${f.A}' U' ${f.B} U`.split(' '):[slice+"'",...flip,slice,...inverseWord(flip)];
    const positions=[basePoints[0]],seen=new Set([String(basePoints[0])]);
    for(let i=0;i<positions.length;i++)for(const m of cfg.moves){const p=turnPoint(positions[i],m),k=String(p);if(!seen.has(k)){seen.add(k);positions.push(p);}}
    if(positions.length!==24)throw Error('Unexpected coordinate orbit.');
    positions.sort((a,b)=>slotName(a,n,kind).localeCompare(slotName(b,n,kind)));
    const index=new Map(positions.map((p,i)=>[String(p),i])),base=basePoints.map(p=>index.get(String(p))),perms=cfg.moves.map(m=>positions.map(p=>index.get(String(turnPoint(p,m)))));
    const encode=(a,b,c)=>(a*24+b)*24+c,decode=k=>[Math.floor(k/576),Math.floor(k/24)%24,k%24];
    const parents=new Int32Array(13824).fill(-1),incoming=new Int16Array(13824),queue=new Int32Array(12144),start=encode(...base);let used=1;queue[0]=start;parents[start]=start;
    for(let head=0;head<used;head++){
      const state=queue[head],[a,b,c]=decode(state);
      for(let i=0;i<perms.length;i++){const p=perms[i],next=encode(p[a],p[b],p[c]);if(parents[next]===-1){parents[next]=state;incoming[next]=i;queue[used++]=next;}}
    }
    if(used!==12144)throw Error('A complete three-slot setup table could not be built.');
    const data={n,kind,family,positions,slots:positions.map(p=>slotName(p,n,kind)),base,work,perms,moves:cfg.moves,parents,incoming,start,encode,reachable:used};toolCache.set(key,data);
    // At most four tiny setup trees remain resident as different guides are used.
    while(toolCache.size>4)toolCache.delete(toolCache.keys().next().value);
    return data;
  }
  function buildCycle(n,kind,family,slots){
    const d=orbitData(n,kind,family),ids=slots.map(s=>typeof s==='number'?s:d.slots.indexOf(s));
    if(ids.length!==3||ids.some(i=>i<0||i>=24)||new Set(ids).size!==3)throw Error('Choose three different slots in this family.');
    const restore=[];let k=d.encode(...ids);
    while(k!==d.start){restore.push(d.moves[d.incoming[k]].name);k=d.parents[k];}restore.reverse();
    const setup=inverseWord(restore);return {setup,work:d.work.slice(),restore,word:[...setup,...d.work,...restore],slots:ids.map(i=>d.slots[i])};
  }
  const escapeTool=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function cycleResult(n,kind,family,slots){
    try{const r=buildCycle(n,kind,family,slots);return '<p><strong>'+r.slots.map(escapeTool).join(' → ')+' → '+escapeTool(r.slots[0])+'</strong></p>'+[['Set up',r.setup],['Work',r.work],['Restore',r.restore]].map(([label,word])=>'<p><strong>'+label+':</strong> '+(word.length?'<code>'+escapeTool(n===10?word.join(' ').replace(/\b([UDLRFB])iiii/g,'$1iv'):word.join(' '))+'</code>':'none')+'</p>').join('')+'<p>Finish all three parts. Only the selected three '+(kind==='center'?'center tiles':'wing pieces')+' change; all other pieces return unchanged.</p>';}
    catch(error){return '<p>'+escapeTool(error.message)+'</p>';}
  }
  const homeColors={U:'White · U',D:'Yellow · D',F:'Green · F',B:'Blue · B',R:'Red · R',L:'Orange · L'};
  function wingHome(n,family,slot,colors){
    const d=orbitData(n,'wing',family),id=typeof slot==='number'?slot:d.slots.indexOf(slot),p=d.positions[id],e=n-1;
    if(!p||colors.length!==2||colors[0]===colors[1]||opposite[colors[0]]===colors[1]||colors.some(f=>!faceVector[f]))throw Error('Choose the two different adjoining face colors on this wing.');
    const incident=Object.keys(faceVector).filter(f=>dot(p,faceVector[f])===e),normal1=faceVector[incident[0]],normal2=faceVector[incident[1]],target1=faceVector[colors[0]],target2=faceVector[colors[1]];
    const chirality=dot(p,cross(normal1,normal2)),axis=cross(target1,target2),target=target1.map((v,i)=>e*(v+target2[i])+chirality*axis[i]),index=d.positions.findIndex(q=>String(q)===String(target));
    if(index<0)throw Error('That target does not belong to this wing depth.');
    return {slot:d.slots[index],index,position:target,incident};
  }
  function wingHomeFields(d,slot){
    const p=d.positions[slot],incident=Object.keys(faceVector).filter(f=>dot(p,faceVector[f])===d.n-1);
    return '<details class="cube-wing-home"><summary>Find the home of the wing in From slot</summary><p>Read the two sticker colors on the specified current faces. The color names refer to the fixed solved frame, not the face currently displaying that color.</p><div class="fto-builder-fields">'+incident.map((face,i)=>'<label data-cube-color-label="'+i+'">Color facing '+face+'<select data-cube-color="'+i+'">'+Object.entries(homeColors).map(([value,label])=>'<option value="'+value+'"'+(value===face?' selected':'')+'>'+label+'</option>').join('')+'</select></label>').join('')+'</div><p data-cube-home-result></p></details>';
  }
  function updateWingHome(box){
    const n=Number(box.dataset.cubeSize),family=Number(box.querySelector('[data-cube-family]').value),slot=Number(box.querySelector('[data-cube-slot]').value),d=orbitData(n,'wing',family),p=d.positions[slot],incident=Object.keys(faceVector).filter(f=>dot(p,faceVector[f])===n-1);
    for(let i=0;i<2;i++){const label=box.querySelector('[data-cube-color-label="'+i+'"]');if(label?.firstChild)label.firstChild.textContent='Color facing '+incident[i];}
    const output=box.querySelector('[data-cube-home-result]');
    try{const h=wingHome(n,family,slot,Array.from(box.querySelectorAll('[data-cube-color]'),x=>x.value));output.textContent='This wing belongs at '+h.slot+'. Use it as To slot.';}catch(error){output.textContent=error.message;}
  }
  function builder(n,kind){
    const ff=families(n,kind);return '<fieldset class="cube-orbit-builder" data-cube-size="'+n+'" data-cube-kind="'+kind+'"><legend>Build a precise three-'+kind+' cycle</legend><label>Piece family<select data-cube-family>'+ff.map((f,i)=>'<option value="'+i+'">'+escapeTool(f.label)+'</option>').join('')+'</select></label><button type="button" class="small outline" data-cube-load>Open setup builder</button><div data-cube-controls hidden></div></fieldset>';
  }
  function renderBuilder(box){
    const n=Number(box.dataset.cubeSize),kind=box.dataset.cubeKind,family=Number(box.querySelector('[data-cube-family]').value),d=orbitData(n,kind,family),controls=box.querySelector('[data-cube-controls]');
    controls.hidden=false;controls.innerHTML='<div class="fto-builder-fields">'+['From slot','To slot','Then to slot'].map((label,i)=>'<label>'+label+'<select data-cube-slot>'+d.slots.map((s,j)=>'<option value="'+j+'"'+(j===d.base[i]?' selected':'')+'>'+escapeTool(s)+'</option>').join('')+'</select></label>').join('')+'</div>'+(kind==='wing'?wingHomeFields(d,d.base[0]):'')+'<div class="fto-builder-result" aria-live="polite">'+cycleResult(n,kind,family,d.base)+'</div>';
    box.querySelector('[data-cube-load]').hidden=true;if(kind==='wing')updateWingHome(box);
  }
  if(typeof document!=='undefined')document.addEventListener('click',event=>{const t=event.target;if(t?.matches?.('[data-cube-load]'))renderBuilder(t.closest('.cube-orbit-builder'));});
  if(typeof document!=='undefined')document.addEventListener('change',event=>{const t=event.target,box=t?.closest?.('.cube-orbit-builder');if(!box)return;if(t.matches('[data-cube-family]')){if(!box.querySelector('[data-cube-controls]').hidden)renderBuilder(box);return;}const slots=Array.from(box.querySelectorAll('[data-cube-slot]'),s=>Number(s.value));if(slots.length===3)box.querySelector('.fto-builder-result').innerHTML=cycleResult(Number(box.dataset.cubeSize),box.dataset.cubeKind,Number(box.querySelector('[data-cube-family]').value),slots);if(box.dataset.cubeKind==='wing')updateWingHome(box);});
  function completeRoute(n){
    const odd=n%2===1;
    return {title:'Complete fallback · a precise route for every legal scramble',body:
      '<p>The bar-and-pair method above is usually shorter. If a setup or final case is unclear, this route replaces intuition with exact three-piece builders. It needs no scramble record. Use the fixed color frame U white, D yellow, F green, B blue, R red, L orange.</p>'+
      (odd?'<p><strong>First align the six single central stickers.</strong> If earlier middle-slice turns moved them, turn all parallel layers together until white is on U and green is on F. This is an actual whole-puzzle turn, not a camera orbit. Across a rightward quarter-turn, execute <code>'+(['R',...Array.from({length:(n-3)/2},(_,i)=>'R'+'i'.repeat(i+1)),"M'",...Array.from({length:(n-3)/2},(_,i)=>'L'+'i'.repeat((n-3)/2-i)+"'"),"L'"]).join(' ')+'</code>. The analogous U direction uses U-side layers, E′, then inverse D-side layers; F uses F-side layers, S, then inverse B-side layers. At most 24 whole-puzzle orientations exist. Matching U and F fixes the complete frame.</p>':'')+
      '<details><summary>1 · Finish every center family exactly</summary><p>Count rows and columns over the whole '+n+'×'+n+' face, including the outside edge. Read each face straight from outside using this table. Turning the camera does not change these coordinates.</p><table><thead><tr><th>Face</th><th>Top neighbor</th><th>Right neighbor</th></tr></thead><tbody><tr><td>U</td><td>B</td><td>R</td></tr><tr><td>D</td><td>F</td><td>R</td></tr><tr><td>F</td><td>U</td><td>R</td></tr><tr><td>B</td><td>U</td><td>L</td></tr><tr><td>R</td><td>U</td><td>B</td></tr><tr><td>L</td><td>U</td><td>F</td></tr></tbody></table><p>Each family has 24 positions and four tiles of each color. The family menu supplies every movable family; the slot lists contain only that family’s positions.</p><ol><li>Pick a wrong-color center at slot A. Pick a wrong-color slot B whose face needs A’s color. Such a B exists because each color count is preserved.</li><li>If at least three slots in this family are wrong, choose any third wrong slot C, different from A and B. In the builder choose From=A, To=B, Then=C.</li><li>If exactly two slots are wrong, choose a currently correct slot C with the same color as the tile currently at B. There are four copies of each color, so a distinct spare exists. Use the same A → B → C → A cycle. Both wrong colors are repaired, and C keeps its color.</li><li>Perform Set up, Work and Restore completely. Repeat until the family is correct, then choose the next family.</li></ol><p>Every ordinary iteration fixes B without changing a previously correct center. The two-wrong case finishes that family while preserving the buffer color. No edges, corners or other center families change after the complete operation.</p>'+builder(n,'center')+'</details>'+
      '<details><summary>2 · Solve the '+(odd?'central-edge and corner':'corner')+' skeleton</summary>'+
      (odd?'<p>Follow the complete 3×3×3 stages in this guide now. For this stage only, “edge” means the <strong>single middle piece</strong> of each '+(n-2)+'-piece edge strip; ignore every wing beside it. The completed center blocks provide the colors. Use outer turns only, so centers remain uniform. These corners and twelve central edges obey the ordinary 3×3×3 parity and orientation rules. Finish all of them before the last stage.</p>':
      '<p>Ignore all edges and solve the eight corners as a 2×2×2, using the completed center colors as their destinations.</p><ol><li><strong>Bottom corners:</strong> choose a corner containing D’s yellow. Its other two colors specify its D-layer slot. If trapped wrongly in D, choose that slot as working DFR and do <code>R U R\' U\'</code> once to lift it. Turn U until it is above its intended destination; use that destination as working DFR, then repeat the four-move block until all three colors match. Repeat for all four D corners. Previously finished D corners remain solved.</li><li><strong>Top positions:</strong> ignore twist. If none is in its proper color-set slot, turn U until at least one is. With exactly two adjacent correct corners, turn U until exactly one is correct. Put a single correct corner at working UFR; with two diagonal correct corners use any working front. Run <code>U R U\' L\' U R\' U\' L</code>, recount, and repeat. Stop when all four top corners are in their proper slots.</li><li><strong>Top orientations:</strong> keep one working front. At UFR, repeat <code>R\' D\' R D</code> until that piece’s U color points upward, checking only after full four-move blocks. Use a U turn to bring the next top piece there. Visit all four pieces and make one U turn after each, even a piece already correct. The lower corners temporarily move but return when all four visits are complete.</li></ol><p>Use the working-front substitution table in this guide; orbiting the camera does not rename axes. All center colors remain unchanged under these outer moves.</p>')+'</details>'+
      '<details><summary>3 · Finish the wings, one depth at a time</summary><p>Each depth has 24 wings. The slot names identify an edge and the corner-facing side of that edge: <strong>UF · toward R · depth 1</strong> is the wing on UF nearest the UFR corner; greater depth is farther from that corner. Each wing has only one correct home position when both sticker directions are considered. The helper below computes that position from its current slot and the two colors visible on the adjoining faces.</p><ol><li>Choose a wing outside its exact home at A. Let B be its home; the wing occupying B is therefore also misplaced.</li><li>Choose any other misplaced wing C in the same depth. Use the builder to cycle A → B → C → A. This fixes the first wing and leaves every other already placed wing fixed.</li><li>If only two wings remain exchanged, run that depth’s existing <strong>UF wing-pair parity repair</strong> from the parity section. It exchanges the two UF wings, restores center colors and leaves the skeleton and other depths unchanged. You may displace correctly placed UF wings, but the remaining wing permutation is now even. Resume three-cycles; no second isolated-pair case can occur in this depth.</li><li>Repeat until this depth is solved, then continue to the next depth.</li></ol><p>There is no independent wing-flip stage after exact home placement: the legal coordinate orbit fixes its two sticker directions at that position. The controlled cycle affects only the selected three wings, including their full orientation. If two same-color wings seem interchangeable, use the destination helper rather than guessing. Once every depth is finished, all centers, corners and edges are solved.</p>'+builder(n,'wing')+'</details>'+
      '<details><summary>Why the setup builders cover every case</summary><p>A family’s 24 slots give 24×23×22 = 12,144 ordered triples of distinct positions. The builder follows legal single-layer moves from its verified base cycle and records one shortest setup route to each triple. Every triple is reached in these cube models. If S sends the base triple to your chosen triple, the displayed order is S inverse, then the base three-cycle, then S. The intermediate puzzle may look disturbed; the complete conjugate changes only your three selected pieces. Only four setup tables are retained at once. This is a small position search, not a table of full puzzle configurations.</p><p>Center-color repair reduces the number of wrong colors. Wing placement reduces the number of wrong exact positions; a lone final exchange uses one parity repair before the remaining even permutation is finished by three-cycles. The skeleton uses the complete corner or 3×3×3 method. These facts give a finite constructive route for every legal state of this model, although the fallback is deliberately not optimized for fewest turns.</p></details>'};
  }

  window.CUBE_GUIDE_TOOLS=Object.freeze({families,orbitData,buildCycle,wingHome,builder,completeRoute,configuration,turnPoint,slotName});

  window.CUBE_GUIDES = {
    cube2: {
      title:'2×2×2 · a three-stage solve',
      intro:'Eight corners, no edges or centers. Build a complete first layer, place the other four corners, then turn them into alignment.',
      notation:notation.concat(['There are no fixed centers. The side colors of your completed D layer become the reference for the U corners.']),
      steps:[
        {title:'Build a matching bottom layer',body:'<p>Choose a first-layer color, for example yellow. Place one corner with that color facing D. This is your reference corner. A neighboring first-layer corner must share the correct side color with it; a piece sharing only the bottom color belongs diagonally opposite.</p><p>Put the next corner in U directly above its intended slot. Choose a working front so the slot is DFR, then repeat <code>R U R\' U\'</code> until it is inserted correctly. If a wanted corner is trapped incorrectly in D, use one complete block from its slot to lift it out. Repeat until D is one color and each side’s two bottom stickers match.</p>'},
        {title:'Position the remaining corners',body:'<p>Ignore twist for now: a top corner belongs between the two side colors shown by the completed layer beneath it. Inspect how many are in their correct places.</p><ol><li>Four correct: continue to the next step.</li><li>None correct: turn U until at least one is correct.</li><li>One correct: use a working front that places it at UFR.</li><li>Two adjacent correct: turn U until exactly one is correct, then place that one at working UFR.</li><li>Two diagonal correct: use any working front.</li></ol><p>Do <code>U R U\' L\' U R\' U\' L</code>, then count and follow the cases again. This cycle preserves the completed bottom layer.</p>'},
        {...twistCorners,body:twistCorners.body.replace('U-color sticker','sticker opposite your bottom color')}
      ],
      sources:[
        {label:'J Perm — beginner 2×2×2 method',url:'https://jperm.net/2x2'},
        {label:'Jaap’s Puzzle Page — Mini Cube',url:'https://www.jaapsch.net/puzzles/cube2.htm'},
        {label:'Ruwix — final-corner turning technique',url:'https://ruwix.com/the-rubiks-cube/how-to-solve-the-rubiks-cube-beginners-method/orient-yellow-corners-how-to-solve-last-layer-corner/'}
      ]
    },
    cube3:{title:'3×3×3 · build one layer at a time',intro:'A complete beginner route with seven solving stages. Keep the first layer at D and work upward; the directions below use the current center colors.',notation,steps:cube3Steps,sources:cube3Sources},
    mirror:{
      title:'Mirror Cube · solve by shape',
      intro:'The same 3×3×3 moves rearrange unequal blocks. Start with the colored view, or enable Mirror mode in the 3D view to solve by shape alone.',
      notation,
      steps:[
        {title:'Read shapes as your color scheme',body:'<p>In <strong>Mirror mode</strong>, the ring map remains available with silver nodes. Use its selection and highlights to follow pieces, and identify their dimensions in the 3D view. Show goal is hidden in this mode. The six center blocks establish the face levels. An edge belongs between the two centers whose heights and widths it joins smoothly; a corner must fit three neighboring surfaces. The goal is one continuous cube with no steps or protrusions.</p><p>For a first solve, leave <strong>Mirror mode</strong> off and use the complete 3×3×3 instructions below. Enable Mirror mode once you can recognize the pieces by shape. The toggle changes only the display, not the scramble. A correct-looking flat face is only part of a layer: check its side surfaces too.</p>'},
        ...cube3Steps,
        {title:'Check the silhouette',body:'<p>Inspect all six sides by dragging the 3D view. Every piece should fit into a smooth cube. In Mirror mode, the color-based checkpoints above mean matching the corresponding center’s surface and making neighboring block edges flush. At the cross stage, all four edges must be flush with the center and side centers. For a corner, compare all three surface levels; for a middle edge, compare both. During the top-cross and corner-twisting stages, “facing up” means presenting the surface that will sit flush with the U center. A top piece can be at the correct height but in the wrong slot: its side widths must match the neighboring center blocks too. The completed cube, rather than hidden sticker colors, is the goal.</p>'}
      ],
      sources:[{label:'GANCUBE — Mirror Cube tutorial',url:'https://www.gancube.com/pages/mirror-cube-tutorial'},...cube3Sources]
    },
    cube4:{
      title:'4×4×4 · reduce, then solve',
      intro:'First build six centers and twelve two-piece edges. That creates a virtual 3×3×3. Two special parity repairs cover the cases that a 3×3×3 cannot have.',
      notation:notation.concat([
        'An i is an inner slice only: Ri is the slice beside R. A wide move turns the outer face and its neighboring inner slice in the same direction: Rw = R then Ri; Uw = U then Ui. Rw\' = R\' then Ri\'; Uw2 = U2 then Ui2. The two turns commute, so it is fine to execute them one after the other.',
        'Keep the original color scheme for the centers: U white, D yellow, F green, B blue, R red, L orange. Opposite colors alone do not determine their order; the three colors on a corner provide a handedness check.'
      ]),
      steps:[
        {title:'Build the six 2×2 centers',body:'<p>Each center consists of four one-color pieces. Make a two-piece bar, then make a second bar and join them. Start with orange on L and red on R. Outer turns reposition bars; an inner slice moves a bar to another face.</p><p>With those opposite centers finished, Li and Ri can transfer pieces among U, F, D and B without cutting either completed center. Build green on F, then white on U, then finish blue on B and yellow on D. Keep every center in the color scheme listed above.</p><p>Work with bars: align a source bar with an unfilled column, insert it with a slice, and restore any earlier center that the slice disturbed. If an insertion would cut a finished bar, turn the destination face so the finished bar lies outside that slice first. Record the slice moves so you can undo them after moving the newly placed pieces out of their return path. Use Undo to study a move’s effect when learning these intuitive center insertions.</p>'},
        {title:'Join matching edge wings',body:'<p>There are two wings for each two-color edge. Use outer turns to put matching wings at working FL and FR. They must occupy different horizontal slices and be oriented so a horizontal inner-slice turn joins them with matching stickers on both faces.</p><p>Slice to join them, move the completed pair into U with <code>R U R\'</code> or <code>R U\' R\'</code>, bringing an unpaired edge slot down in exchange, then undo the slice. This last action restores the centers. Store completed pairs away from the working slots and repeat.</p><p>If the wings cannot join in that orientation, the edge-flip sequence <code>R U R\' F R\' F\' R</code> flips the working FR slot. It also moves other outer-layer pieces, which is acceptable at this stage. Then set up the pair again. All twelve edges must consist of matching two-piece strips before the 3×3×3 stage.</p>'},
        {title:'Finish the last two edge pairs',body:'<p>When only two unmatched edge slots remain, bring them to FL and FR with outer turns. Arrange them so the two upper wings match one another in both colors and have the same color facing F; the two lower wings should match one another in the same way. The upper and lower pairs need not share a color.</p><p>Use <code>Uw\' R U R\' F R\' F\' R Uw</code>. Here Uw\' means U\' then Ui\', and the final Uw means U then Ui. This pairs the wings while restoring the centers. If the wings are diagonally paired instead, flip the FR slot using the previous step’s edge-flip sequence, then inspect and arrange the stated case.</p>'},
        {title:'Treat the result as a 3×3×3',body:'<p>A 2×2 center block now acts as one center, and each matching wing pair acts as one edge. From here, use only outer face moves except for the parity repairs below. The full 3×3×3 instructions follow, so you can finish without leaving this game.</p><p>If the top-cross stage shows one or three upward-facing edge pairs, use the next OLL repair. If the placement stage leaves an impossible two-piece exchange, use the PLL repair. Both are normal legal 4×4×4 cases.</p>'},
        {title:'Parity repair · one flipped edge pair',body:'<p>For OLL parity, use U turns to place an edge pair needing a flip at UF. Execute this rotation-free sequence; every Ri and Li is an inner slice, not a wide turn:</p><p><code>Ri2 B2 U2 Li U2 Ri\' U2 Ri U2 F2 Ri F2 Li\' B2 Ri2</code></p><p>This flips the UF pair, preserves the corners and restores the center colors. Reinspect the top cross and continue the ordinary 3×3×3 stages. With three wrongly oriented pairs, this removes the odd parity and the usual cross algorithm handles the remaining two.</p>'},
        {title:'Parity repair · two pieces exchanged',body:'<p>The following sequence exchanges the UF and UB edge pairs without changing the corner positions:</p><p><code>Ri2 U2 Ri2 Uw2 Ri2 Uw2 U2</code></p><p>Expand each Uw2 as <code>U2 Ui2</code>. If only two opposite edge pairs remain swapped, choose a working front that puts them at UF and UB and apply it. For an adjacent-edge exchange or a two-corner exchange, apply it once from any working front, then repeat the ordinary top-edge and top-corner placement stages below. It removes the parity obstruction; those remaining stages finish the rearrangement.</p>'},
        ...cube3Steps.map((s,i)=>i===0?{title:'3×3×3 stage · establish your colors',body:'<p>Your completed center blocks define each face. Use D’s color for the first layer and U’s color for the last. In this stage an “edge” always means an intact two-wing pair, and a “center” means an intact 2×2 center block. Keep those blocks intact with outer moves.</p>'}:{...s,title:'3×3×3 stage · '+s.title.charAt(0).toLowerCase()+s.title.slice(1)}),
        completeRoute(4)
      ],
      sources:[
        {label:'CubeSkills / Feliks Zemdegs — 4×4×4 reduction and parity',url:'https://www.cubeskills.com/uploads/pdf/tutorials/beginners-method-for-solving-the-4x4-cube.pdf'},
        {label:'J Perm — centers, wing pairing and parity',url:'https://jperm.net/4x4'},
        {label:'Ruwix — rotation-free inner-slice parity repair',url:'https://ruwix.com/twisty-puzzles/4x4x4-rubiks-cube-rubiks-revenge/parity/'},
        ...cube3Sources
      ]
    }
  };
})();
