'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../dist/games/ghost-engine.js'),V=E.vector;
const approx=(a,b,msg)=>assert(Math.abs(a-b)<1e-7,msg||`${a} != ${b}`);
const samePoints=(a,b)=>{assert.equal(a.length,b.length);a.forEach((p,i)=>p.forEach((x,j)=>approx(x,b[i][j])));};
const area=f=>{let sum=0;for(let i=1;i<f.points.length-1;i++)sum+=V.length(V.cross(V.sub(f.points[i],f.points[0]),V.sub(f.points[i+1],f.points[0])))/2;return sum;};
const volume=faces=>faces.reduce((sum,f)=>sum+V.dot(f.center,f.normal)*area(f)/3,0);
function poseDomain(model){const nodes=[],lookup=new Map(),key=s=>[s.pos,s.center,s.normal].flat().map(x=>Math.round(x*1e7)||0).join(',');function insert(s){const k=key(s);if(!lookup.has(k)){lookup.set(k,nodes.length);nodes.push(s);}return lookup.get(k);}model.stickerState.forEach(insert);function next(s,c){return s.pos[c.axis]*c.sign>0?{pos:V.transform(c.matrix,s.pos),center:V.transform(c.matrix,s.center),normal:V.transform(c.matrix,s.normal)}:s;}for(let i=0;i<nodes.length;i++)for(const c of model.configs)insert(next(nodes[i],c));return {nodes,key,lookup,moves:model.configs.map(c=>nodes.map(s=>lookup.get(key(next(s,c)))))};}

test('Ghost is a genuine offset, oblique polyhedral 3×3 with a closed solved cube',()=>{
 const m=E.create(),g=m.polyhedron;
 assert.equal(m.pieces.length,26);assert.equal(m.slots.length,61);
 assert.equal(m.pieces.filter(p=>p.kind==='corner').length,8);
 assert.equal(m.pieces.filter(p=>p.kind==='edge').length,12);
 assert.equal(m.pieces.filter(p=>p.kind==='center').length,6);
 assert(g.alignmentOffsets[1]!==0&&g.alignmentOffsets[-1]!==0);
 assert(g.faces.every(f=>f.normal.filter(x=>Math.abs(x)>1e-3).length===3),'outer faces oblique to all mechanism axes');
 const bodyVolume=m.pieces.reduce((sum,p)=>sum+volume(p.body),0);
 approx(bodyVolume,(2*g.shellHalf)**3-(2*g.cut)**3,'pieces partition cube outside the internal core');
 for(const face of g.faces){
  const surface=m.pieces.flatMap(p=>m.mesh(p).stickers).filter(s=>s.faceIndex===face.index);
  approx(surface.reduce((sum,s)=>sum+area({...s,points:s.regionPolygon}),0),(2*g.shellHalf)**2,'each face fully tiled');
  for(const s of surface)for(const point of s.regionPolygon)approx(V.dot(face.normal,point),face.offset,'every solved patch lies on its cube face');
 }
 // All physical pieces differ; shape mode has useful geometric information.
 const volumes=m.pieces.map(p=>volume(p.body));
 assert.equal(new Set(volumes.map(v=>v.toFixed(7))).size,26);
 assert(m.slots.some(s=>s.points.length===3)&&m.slots.some(s=>s.points.length>4));
});

test('Ghost quarter turns preserve rigidity, disjoint mechanism bins, and exact inverse states',()=>{
 const m=E.create(),initial=JSON.stringify(m.snapshot());
 for(const c of m.configs){for(let i=0;i<4;i++)m.applyMove(c.id);assert.equal(JSON.stringify(m.snapshot()),initial);m.applyMove(c.id);assert(!m.isSolved());m.applyMove({face:c.id,dir:-1});assert(m.isSolved());}
 const scramble=m.scramble('ghost-polyhedron-test',60);
 for(const move of scramble){
  m.applyMove(move);assert.equal(new Set(m.pieces.map(p=>p.pos.join(','))).size,26);
  for(const p of m.pieces){
   const mesh=m.mesh(p,{dock:0});approx(volume(mesh.body),volume(p.body));
   for(const f of mesh.body)for(const v of f.points)for(let axis=0;axis<3;axis++){
    if(p.pos[axis]===0)assert(Math.abs(v[axis])<=m.cut+1e-7,'middle bin');
    else assert(v[axis]*p.pos[axis]>=m.cut-1e-7,'outer bin');
   }
  }
 }
 m.invertMoves(scramble).forEach(move=>m.applyMove(move));assert.equal(JSON.stringify(m.snapshot()),initial);
});

test('Ghost solver marker domain captures every exact rigid pose, including center orientation',()=>{
 const m=E.create(),domain=poseDomain(m);assert.equal(domain.nodes.length,168);
 for(const perm of domain.moves)assert.equal(new Set(perm).size,domain.nodes.length);
 const frames=[V.identity()];for(let i=0;i<frames.length;i++)for(const c of m.configs){const frame=V.multiply(c.matrix,frames[i]);if(!frames.some(f=>JSON.stringify(f)===JSON.stringify(frame)))frames.push(frame);}
 assert.equal(frames.length,24);
 for(const s of m.slots){const keys=frames.map(frame=>domain.key({pos:V.transform(frame,s.markerCenter),center:V.transform(frame,s.markerCenter),normal:V.transform(frame,s.markerNormal)}));assert.equal(new Set(keys).size,24,'every real patch marker determines its complete piece orientation');}
 let mapping=m.stickerState.map(s=>domain.lookup.get(domain.key(s)));
 const original=mapping.slice();
 assert.equal(new Set(original).size,61,'one distinct marker per real surface patch');
 const occupied=new Set(original);assert(domain.moves.some(p=>original.some(a=>{const b=p[p[a]];return b!==a&&occupied.has(b)&&p[p[b]]===a;})),'some actual occupied nodes can be exchanged by a legal half turn');
 for(const move of m.scramble('ghost-markers',45)){
  const axis=m.configs.findIndex(c=>c.id===move.face),count=(move.dir*move.turns%4+4)%4;
  for(let j=0;j<count;j++)mapping=mapping.map(x=>domain.moves[axis][x]);
  m.applyMove(move);assert.deepEqual(m.stickerState.map(s=>domain.lookup.get(domain.key(s))),mapping);
 }
 m.reset();assert.deepEqual(m.stickerState.map(s=>domain.lookup.get(domain.key(s))),original);
 const center=m.pieces.find(p=>p.name==='U');center.orientation=m.configById.U.matrix.map(r=>r.slice());
 assert(!m.isSolved());assert(!m.isShapeSolved(),'a rotated asymmetrical center is not a solved Ghost');
});

test('Ghost docking and ring timing have continuous exact endpoints',()=>{
 const m=E.create();for(const face of ['R','U','F']){
  m.reset();const move={face,dir:1,turns:1},before=m.pieces.map(p=>m.mesh(p)),start=m.pieces.map(p=>m.renderMesh(p,{move,progress:0}));
  for(let i=0;i<26;i++)samePoints(before[i].body.flatMap(f=>f.points),start[i].body.flatMap(f=>f.points));
  assert.equal(m.animationPlan({move,progress:.1}).turn,0,'ring colors stay still during opening');
  const end=m.pieces.map(p=>m.renderMesh(p,{move,progress:1}));m.applyMove(move);
  for(let i=0;i<26;i++)samePoints(end[i].body.flatMap(f=>f.points),m.mesh(m.pieces[i]).body.flatMap(f=>f.points));
  const inverse=m.invertMove(move);assert.equal(m.animationPlan({move:inverse,progress:.9}).turn,1,'ring permutation finishes before docking');
  const closed=m.pieces.map(p=>m.renderMesh(p,{move:inverse,progress:1}));m.applyMove(inverse);assert(m.isSolved());
  for(let i=0;i<26;i++)samePoints(closed[i].body.flatMap(f=>f.points),m.mesh(m.pieces[i]).body.flatMap(f=>f.points));
 }
});

test('Ghost VM engine is independent and page has a colored default with optional mirror mode',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/games/ghost-engine.js'),'utf8'),ctx);
 assert.equal(ctx.GhostEngine.create('ghost').slots.length,61);
 const html=fs.readFileSync(path.join(__dirname,'../dist/games/ghost.html'),'utf8');
 assert.match(html,/data-puzzle="ghost"/);assert.match(html,/id="mirrorMode"[^>]+aria-pressed="false"/);
 const scripts=require('./page-script-sources.cjs')(html);
 for(const script of ['ghost-engine.js','ghost-renderer.js','ghost-rings.js','shape-app.js','constrained-solver.js'])assert(scripts.includes(script),script);
 assert.match(html,/align automatically/);
});
