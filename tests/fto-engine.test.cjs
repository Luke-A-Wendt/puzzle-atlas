'use strict';
const assert=require('node:assert/strict');
const E=require('../dist/games/fto-engine.js');
const {distance,transform,dot,cross,sub,length}=E.vector;
const m=E.create(),initial=m.snapshot(),EPS=1e-8;
assert.equal(m.faces.length,8);assert.equal(m.pieces.length,42);assert.equal(m.slots.length,72);
assert.deepEqual(['vertex','edge','center'].map(k=>m.pieces.filter(p=>p.kind===k).length),[6,12,24]);
assert.deepEqual(m.configs.map(c=>c.id),['A','B','C','D','E','F','G','H','Am','Bm','Cm','Dm']);
assert.ok(m.isSolved());
for(const f of m.faces){
 const stickers=m.slots.filter(s=>s.face===f.id);assert.equal(stickers.length,9);
 for(const s of stickers)assert.equal(s.regionPolygon.length,3);
 const triangleArea=points=>length(cross(sub(points[1],points[0]),sub(points[2],points[0])))/2;
 const surfaceArea=stickers.reduce((s,t)=>s+triangleArea(t.regionPolygon),0);
 assert.ok(Math.abs(surfaceArea-triangleArea(f.points))<EPS,'Nine triangles must tile each face');
}
for(const p of m.pieces){assert.ok(p.home.every(Number.isInteger));assert.equal(p.stickers.length,p.kind==='vertex'?4:p.kind==='edge'?2:1);}
function consistent(model){
 assert.equal(new Set(model.pieces.map(p=>p.pos.join(','))).size,42);
 assert.equal(new Set(model.stickerState.map(s=>s.slot)).size,72);
 for(const p of model.pieces){
  assert.ok(p.orientation.flat().every(v=>Number.isInteger(v)&&Math.abs(v)<=1));
  assert.deepEqual(transform(p.orientation,p.home),p.pos);
  const target=model.polyhedron.pieces.find(t=>distance(t.home,p.pos)<EPS);
  assert.ok(target);assert.equal(target.kind,p.kind);
  // Independently compare rigid rotated surface polygons to exact slot mapping.
  for(const sticker of p.stickers){
   const slot=model.slots[model.stickerState[sticker.id].slot];
   assert.ok(distance(transform(p.orientation,sticker.center),slot.center)<EPS);
   assert.ok(distance(transform(p.orientation,sticker.normal),slot.normal)<EPS);
   for(const vertex of sticker.regionPolygon)assert.ok(slot.regionPolygon.some(v=>distance(transform(p.orientation,vertex),v)<EPS));
  }
  // Cut surfaces must also remain rigid and fit their destination piece cell.
  const sourceVertices=p.body.flatMap(f=>f.points),targetVertices=target.body.flatMap(f=>f.points);
  for(const v of sourceVertices)assert.ok(targetVertices.some(t=>distance(transform(p.orientation,v),t)<EPS));
 }
}
const pieceMaps=[];
for(const c of m.configs){
 const moving=m.movingPieces(c.id).map(i=>m.pieces[i]);
 assert.deepEqual(['vertex','edge','center'].map(k=>moving.filter(p=>p.kind===k).length),c.middle?[0,6,6]:[3,3,9]);
 const perm=m.permutations[c.id];assert.equal(new Set(perm).size,72);
 assert.ok(perm.some((v,i)=>v!==i));
 m.applyMove(c.id);consistent(m);assert.equal(m.isSolved(),false);
 if(!c.middle)pieceMaps.push(m.pieces.map(p=>m.polyhedron.pieces.find(t=>distance(t.home,p.pos)<EPS).id));
 m.applyMove(c.id);consistent(m);m.applyMove(c.id);assert.deepEqual(m.snapshot(),initial);
 m.applyMove(c.id).applyMove(c.id,-1);assert.deepEqual(m.snapshot(),initial);
}
// Published physical FTO invariants: 6 vertices with 2 orientations, 12 edges
// with no independent flip, and two separate sets of 12 center pieces.
const seen=new Set(),orbits=[];
for(const piece of m.pieces){if(seen.has(piece.id))continue;const queue=[piece.id];seen.add(piece.id);
 for(let i=0;i<queue.length;i++)for(const map of pieceMaps){const next=map[queue[i]];if(!seen.has(next)){seen.add(next);queue.push(next);}}
 orbits.push(queue);
}
assert.deepEqual(orbits.map(o=>[m.pieces[o[0]].kind,o.length]).sort(),[['center',12],['center',12],['edge',12],['vertex',6]].sort());
function orientationsFor(pieceId){
 const home=m.pieces[pieceId].home,start={pos:home,orientation:[[1,0,0],[0,1,0],[0,0,1]]};
 const key=s=>s.pos.join(',')+'/'+s.orientation.flat().join(','),states=[start],keys=new Set([key(start)]);
 for(let i=0;i<states.length;i++)for(const c of m.outerConfigs){
  const s=states[i];if(dot(s.pos,c.anchor)<=2)continue;
  const next={pos:transform(c.matrix,s.pos),orientation:E.vector.multiply(c.matrix,s.orientation)},k=key(next);
  if(!keys.has(k)){keys.add(k);states.push(next);}
 }
 return states;
}
assert.equal(orientationsFor(m.pieces.find(p=>p.kind==='vertex').id).length,12);
assert.equal(orientationsFor(m.pieces.find(p=>p.kind==='edge').id).length,12);
for(const c of m.outerConfigs){
 const middle=m.middleConfigs[c.axis],dir=c.index<4?1:-1;
 m.applyMove(c.id).applyMove(c.opposite,-1).applyMove(middle.id,dir);
 consistent(m);assert.ok(m.isSolved(),'Two opposite outer turns and middle make a rigid whole-object rotation');m.reset();
}
for(let seed=0;seed<100;seed++){
 const moves=m.scramble('fto-regression-'+seed,60);
 assert.deepEqual(moves,m.scramble('fto-regression-'+seed,60));
 assert.ok(moves.every(v=>!m.configById[v.face].middle));
 if(seed)assert.notDeepEqual(moves,m.scramble('fto-regression-'+(seed-1),60));
 moves.forEach(move=>m.applyMove(move));consistent(m);
 const manual=m.configs.map(c=>({face:c.id,dir:seed%2?1:-1}));manual.forEach(move=>m.applyMove(move));consistent(m);
 m.invertMoves([...moves,...manual]).forEach(move=>m.applyMove(move));assert.deepEqual(m.snapshot(),initial);assert.ok(m.isSolved());
}
assert.throws(()=>m.applyMove('invalid'));assert.throws(()=>m.applyMove('A',0));
console.log('FTO: exact 42-piece / 72-sticker geometry, all 12 layers, physical orbits, rigid mesh fits, 100 scrambles and inverses pass');

// Fixed frame for the original face-turning solution: U=A, R=B, L=C,
// F=H, D=E, r=Bm. Check advertised effects independently of generated guides.
function algorithm(text){for(const token of text.trim().split(/\s+/))m.applyMove(token.replace(/'/g,''),token.endsWith("'")?-1:1);}
function position(home){return m.pieces.find(p=>p.home.join(',')===home.join(',')).pos;}
const UR=[0,4,0],UL=[4,0,0],LR=[0,0,-4],UB=[0,0,4];
m.reset();algorithm("B' E B");assert.deepEqual(position([0,-2,-2]),[0,2,-2]); // DL -> FR
m.reset();algorithm("C E' C'");assert.deepEqual(position([-2,0,-2]),[2,0,-2]); // DR -> FL
m.reset();algorithm("B A' B' A");assert.deepEqual(position(UR),UL);assert.deepEqual(position(UL),LR);assert.deepEqual(position(LR),UR);
for(const p of m.pieces.filter(p=>p.kind==='edge'))assert.deepEqual(p.pos,p.home);
m.reset();algorithm("A B A' B'");assert.deepEqual(position(UB),UR);assert.deepEqual(position(UR),LR);assert.deepEqual(position(LR),UB);
for(const p of m.pieces.filter(p=>p.kind==='edge'))assert.deepEqual(p.pos,p.home);
m.reset();algorithm("B' A C' A' C A' B A");
for(const p of m.pieces.filter(p=>p.kind==='vertex'||p.kind==='edge'))assert.deepEqual(p.pos,p.home);
assert.deepEqual(m.pieces.filter(p=>p.kind==='vertex'&&JSON.stringify(p.orientation)!==JSON.stringify([[1,0,0],[0,1,0],[0,0,1]])).map(p=>p.home).sort(),[UR,UL].sort());
m.reset();for(let i=0;i<5;i++)algorithm("Bm A Bm' A'");
for(const p of m.pieces.filter(p=>p.kind!=='center')){assert.deepEqual(p.pos,p.home);assert.deepEqual(p.orientation,[[1,0,0],[0,1,0],[0,0,1]]);}
assert.ok(!m.isExactSolved());consistent(m);m.reset();
console.log('FTO: Jaap fixed-frame edge insertions, vertex three-cycles, paired flips and center-only commutator match A–H controls');
