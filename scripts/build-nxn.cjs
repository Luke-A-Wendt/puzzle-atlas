const fs=require('node:fs'),path=require('node:path');
const base=path.join(__dirname,'../dist/games/');
const old=fs.readFileSync(base+'cube4.html','utf8');
const sections=[...old.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
let engine=sections[0].replace('Exact integer-coordinate 4×4×4','Exact integer-coordinate N×N×N');
engine=engine.replace(/  const levels = [\s\S]*?  const faceColors =/,`  const size = Number(root.CUBE_SIZE || 5);
  if (!Number.isInteger(size) || size < 2 || size > 7) throw new Error('Unsupported cube size');
  const extent = size - 1;
  const levels = Object.freeze(Array.from({length:size}, (_,i) => 2*i-extent));
  const axisFaces = [['L','R','M'],['D','U','E'],['B','F','S']];
  const faceWords = {L:'Left',R:'Right',D:'Lower',U:'Upper',B:'Back',F:'Front',M:'Middle left / right',E:'Middle down / up',S:'Middle back / front'};
  const configs = Object.freeze(Object.fromEntries(axisFaces.flatMap(([negative,positive,middle],axis) => levels.map((layer,index) => {
    const depth = Math.min(index,size-1-index);
    const base = layer < 0 ? negative : positive;
    const face = layer === 0 ? middle : base+'i'.repeat(depth);
    const turn = layer === 0 ? (axis === 2 ? -1 : 1) : -Math.sign(layer);
    const label = layer === 0 ? faceWords[middle]+' slice' : faceWords[base]+(depth===0?' outer':depth===1?' inner':' second inner');
    return [face,Object.freeze({axis,layer,turn,inner:Math.abs(layer)!==extent,depth,label})];
  }))));
  const faceColors =`);
engine=engine.replace('/^([UDLRFB]i?)([2]?)([\'’′]?)$/','/^([UDLRFB]i{0,2}|[MES])(2?)([\'’′]?)$/');
engine=engine.replace("if (!match) throw new Error('Invalid cube move: ' + move);","if (!match || !configs[match[1]]) throw new Error('Invalid cube move: ' + move);");
engine=engine.replace('stickers.length !== 96','stickers.length !== 6*size*size').replace('face.count === 16','face.count === size*size');
engine=engine.replace('length === undefined ? 50 : length','length === undefined ? size*12 : length');
engine=engine.replace('    configs, levels, colors, faceColors,','    size, extent, configs, levels, colors, faceColors,');
let geometry=sections[1].replace(/\/\* Ring Atlas geometry:[\s\S]*?\*\//,`/* Ring Atlas: 3N intersecting circles encode all 6N² facelets.
 * Each slice belt has 4N dots; a quarter-turn advances exactly N slots.
 */`);
geometry=geometry.replace(/  const levels=\[-3,-1,1,3\],radii=\[98,117,136,155\];[\s\S]*?  const rings = \[\];/,`  const E=root.CubeEngine,levels=E.levels;
  const radii=levels.map((_,i)=>98+57*i/(levels.length-1));
  const names=[0,1,2].map(axis=>levels.map(layer=>Object.keys(E.configs).find(name=>E.configs[name].axis===axis&&E.configs[name].layer===layer)));
  const faceNames=Object.fromEntries(Object.entries(E.configs).map(([name,cfg])=>[name,cfg.label]));
  const rings = [];`);
geometry=geometry.replace("String(name).replace(/[′'2]/g, '')","String(name).replace(/[′'2]/g, '')");
geometry=geometry.replace('p[normal] = 3*sign','p[normal] = E.extent*sign');
let app=sections[3];
app=app.replace('const E=CubeEngine,G=RingGeometry,$=','const E=CubeEngine,N=E.size,G=RingGeometry,$=');
app=app.replace("function displayFace(face){return face;}","function displayFace(face){return face;}\nconst SCRAMBLE_LENGTH=N*12;\nconst axisGroups=[['LEFT / RIGHT',G.rings.filter(r=>r.axis===0).map(r=>r.name)],['DOWN / UP',G.rings.filter(r=>r.axis===1).map(r=>r.name)],['BACK / FRONT',G.rings.filter(r=>r.axis===2).map(r=>r.name)]];");
app=app.replace("'This inner slice moves 16 stickers; both outer layers stay in place.'","'This inner slice moves '+(4*N)+' stickers; the outer layers stay in place.'");
app=app.replace("'This outer layer moves 32 stickers, including the 16 on its face.'","'This outer layer moves '+(N*N+4*N)+' stickers, including the '+(N*N)+' on its face.'");
app=app.replace("'Scramble ready. 50 legal turns from solved — your move.'","'Scramble ready. '+SCRAMBLE_LENGTH+' legal turns from solved — your move.'");
app=app.replace('E.scramble(seed,50)','E.scramble(seed,SCRAMBLE_LENGTH)').replace("addLabel('Scramble · 50 legal turns')","addLabel('Scramble · '+SCRAMBLE_LENGTH+' legal turns')");
app=app.replace('rc.arc(p.x,p.y,(onLayer?4.5:3.3)/zoom','rc.arc(p.x,p.y,(onLayer?4.5-(N-5)*.2:3.3-(N-5)*.15)/zoom');
app=app.replace('tagRadius=12/zoom','tagRadius=(selected.length>2?14:10)/scale');
app=app.replace("rc.lineWidth=1/zoom;rc.stroke();rc.font='600 '+(11/zoom)","rc.lineWidth=1/scale;rc.stroke();rc.font='600 '+(11/scale)").replace('x,y+.5/zoom','x,y+.5/scale');
app=app.replace('const scale=Math.min(w,h)*.118*view.zoom,eye=9.7;','const scale=Math.min(w,h)*.118*view.zoom*4/N,eye=9.7*N/4;');
app=app.replace("for(const x of E.levels)for(const y of E.levels)for(const z of E.levels){for(const n of normals)polygon([x,y,z],n,.483,.481,'#191820',false);}",`// Draw outer plastic and both sides of each currently opened slice cut.
 // Hidden internal faces contribute no pixels; excluding them keeps 7×7 turns responsive.
 for(const x of E.levels)for(const y of E.levels)for(const z of E.levels){
  const p=[x,y,z];
  for(const n of normals){
   const axis=n.findIndex(v=>v!==0),sign=n[axis];
   const outside=p[axis]===sign*E.extent;
   const cut=active&&axis===cfg.axis&&(p[axis]===cfg.layer||p[axis]+2*sign===cfg.layer);
   if(outside||cut)polygon(p,n,.483,.481,'#191820',false);
  }
 }`);
app=app.replace("[['LEFT / RIGHT',['L','Li','Ri','R']],['DOWN / UP',['D','Di','Ui','U']],['BACK / FRONT',['B','Bi','Fi','F']]]","axisGroups");
app=app.replace(/window\.RingCube4/g,'window.RingCubeN');
app=app.replace("const notationFaces=['U', 'R', 'F', 'D', 'L', 'B', 'Ui', 'Ri', 'Fi', 'Di', 'Li', 'Bi'];","const notationFaces=['U','R','F','D','L','B',...Object.keys(E.configs).filter(face=>E.configs[face].inner)];");
// Retain same-origin parent bridge and per-game names.
app=app.replaceAll("puzzle:'cube4'","puzzle:'cube'+N");
let markup=old.slice(0,old.indexOf('<script>'));
markup=markup.replace('body class="game-cube4"','body class="game-cubeNXN"');
markup=markup.replace('</head>',`<style>
.game-cubeNXN .axis-buttons{display:grid;grid-template-columns:repeat(var(--size),minmax(0,1fr));gap:2px}
.game-cubeNXN .ring-key{font-size:11px;min-width:21px}
.game-cubeNXN .notation-buttons{display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:4px}
.game-cubeNXN .notation-key{font-size:11px;min-width:0;padding-inline:3px}
@media(max-width:1100px){.game-cubeNXN .selector{grid-template-columns:1fr}.game-cubeNXN .axis-row{display:flex;align-items:center;gap:8px;padding:2px 5px}.game-cubeNXN .axis-label{width:63px;text-align:left;margin:0;flex-shrink:0}.game-cubeNXN .axis-buttons{flex:1}.game-cubeNXN .ring-key{min-height:26px}.game-cubeNXN .notation-buttons{grid-template-columns:repeat(7,minmax(0,1fr))}}
@media(max-width:850px) and (orientation:portrait),(max-width:680px){.game-cubeNXN .ring-key{min-height:35px;font-size:12px}.game-cubeNXN .axis-label{width:77px}.game-cubeNXN .notation-key{font-size:12px}}
</style></head>`);
markup=markup.replace('i = inner slice. Arrows turn the ring as seen here, one quarter-turn at a time.','i = one layer inward · ii = two layers inward. Arrows follow the ring on screen.');
markup=markup.replace('There are four independently movable layers on each axis. <b>L R U D F B</b> are the six outer layers. A lowercase <b>i</b> marks the inner slice next to that face: <b>Ri</b>, for example, is the second layer in from the right. Each inner control turns just that one slice. The journal writes these moves as <b>Ri</b>, <b>Li</b>, and so on.',`There are SIZE independently movable layers on each axis. <b>L R U D F B</b> are the outer layers. <b>Ri</b> is the second layer in from the right; <b>Rii</b>, when present, is the third. Each control turns just one layer. ODD_MIDDLE_GUIDE`);
markup=markup.replace('The 96 dots are all 96 stickers. Every dot sits at a crossing of two rings. Each ring carries a belt of 16 stickers. An outer turn also rotates the 16 stickers on its own face; an inner turn moves only its belt. The 3D view highlights the entire selected slice.','The STICKERS dots are all STICKERS stickers. Every dot sits at a crossing of two rings. Each ring carries a belt of BELT stickers. An outer turn also rotates the FACE_STICKERS stickers on its face; an inner turn moves only its belt. The 3D view highlights the selected slice. Select “Focus selected rings” to inspect one belt more closely.');
markup=markup.replace('hold <kbd>Alt</kbd> for the adjacent inner slice, and <kbd>Shift</kbd> to reverse.','hold <kbd>Alt</kbd> for the adjacent inner slice, and <kbd>Shift</kbd> to reverse. Select deeper slices using their ring buttons. On odd cubes, <kbd>M</kbd> <kbd>E</kbd> <kbd>S</kbd> turn the middle slices.');
markup=markup.replace('applies 50 legal','applies SCRAMBLE_LENGTH legal').replace('The game works offline with no external files.','The seed records the generated sequence. The journal uses a prime (′) for inverse moves and 2 for half-turns, so Rii2 means a half-turn of the third layer in from the right.');
fs.writeFileSync(base+'nxn-engine.js',engine);fs.writeFileSync(base+'nxn-rings.js',geometry);fs.writeFileSync(base+'nxn-app.js',app);
for(const N of [5,6,7]){
 let html=markup.replaceAll('4 × 4 Cube',`${N} × ${N} Cube`).replaceAll('4×4 cube',`${N}×${N} cube`).replaceAll('twelve linked rings',`${3*N} linked rings`).replaceAll('LIVE 4×4 VIEW',`LIVE ${N}×${N} VIEW`).replaceAll('4 × 4 × 4 · 12 RINGS · 96 STICKERS',`${N} × ${N} × ${N} · ${3*N} RINGS · ${6*N*N} STICKERS`)
 .replace('class="game-cubeNXN"',`class="game-cubeNXN game-cube${N}" style="--size:${N}"`)
 .replaceAll('FACE_STICKERS',String(N*N)).replaceAll('STICKERS',String(6*N*N)).replace(`${6*N*N} ${6*N*N}</span>`,`${6*N*N} STICKERS</span>`).replaceAll('BELT',String(4*N)).replaceAll('SCRAMBLE_LENGTH',String(N*12)).replaceAll('SIZE',String(N)).replace('ODD_MIDDLE_GUIDE',N%2?'The central slices are <b>M</b> (turns like L), <b>E</b> (turns like D) and <b>S</b> (turns like F).':'There is no single middle slice on this even cube.');
 html+=`<script>window.CUBE_SIZE=${N};</script>\n`+[engine,geometry,sections[2],app].map(code=>'<script>\n'+code+'\n</script>\n').join('')+'<script src="ring-panel.js"></script>\n<script src="constrained-solver-core.js"></script>\n<script src="constrained-solver.js"></script>\n</body></html>\n';
 fs.writeFileSync(base+`cube${N}.html`,html);
 console.log(`Generated cube${N}.html (${html.length} bytes)`);
}
