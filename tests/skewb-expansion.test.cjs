'use strict';
const assert=require('node:assert/strict'),E=require('../dist/games/skewb-engine.js');
const {dot,cross,sub,distance,transform}=E.vector;
const cases={skewb:{faces:6,pieces:14,stickers:30,turn:7,kinds:{corner:8,center:6},volume:8},jing:{faces:4,pieces:14,stickers:28,turn:7,kinds:{corner:4,edge:6,center:4},volume:8/3},masterskewb:{faces:6,pieces:50,stickers:78,turn:19,kinds:{corner:8,edge:12,center:6,face:24},volume:8}};
const area=f=>f.points.slice(2).reduce((sum,p,i)=>sum+Math.abs(dot(cross(sub(f.points[i+1],f.points[0]),sub(p,f.points[0])),f.normal))/2,0);
function consistent(m){
 assert.equal(new Set(m.pieces.map(p=>p.pos.map(v=>v.toFixed(9)).join(','))).size,m.pieces.length);
 assert.equal(new Set(m.stickerState.map(s=>s.slot)).size,m.slots.length);
 for(const p of m.pieces){
  assert.ok(p.orientation.flat().every(Number.isInteger));assert.ok(distance(transform(p.orientation,p.home),p.pos)<1e-8);
  for(const s of p.stickers){const slot=m.slots[m.stickerState[s.id].slot];assert.ok(distance(transform(p.orientation,s.center),slot.center)<1e-8);assert.ok(distance(transform(p.orientation,s.normal),slot.normal)<1e-8);}
 }
}
for(const [type,expected]of Object.entries(cases)){
 const m=E.create(type),initial=m.snapshot();
 assert.equal(m.faces.length,expected.faces);assert.equal(m.pieces.length,expected.pieces);assert.equal(m.slots.length,expected.stickers);
 assert.deepEqual(m.pieces.reduce((a,p)=>(a[p.kind]=(a[p.kind]||0)+1,a),{}),expected.kinds);
 assert.equal(m.configs.length,type==='jing'?4:8);
 // Geometry covers each full face with actual, disjoint cut regions, and all
 // pieces have positive volume. Master also has internal unstickered mechanism cells.
 let volume=0;
 for(const p of m.pieces){const v=p.body.reduce((sum,f)=>sum+area(f)*dot(f.normal,f.center)/3,0);assert(v>1e-5);volume+=v;}
 if(type==='masterskewb')assert.ok(Math.abs(volume-7.5)<1e-8);
 else assert.ok(Math.abs(volume-expected.volume)<1e-8);
 for(const f of m.faces){const skin=m.slots.filter(s=>s.faceIndex===f.index);assert.equal(skin.length,expected.stickers/expected.faces);const covered=skin.reduce((sum,s)=>sum+area({points:s.regionPolygon,normal:s.normal}),0);assert.ok(Math.abs(covered-area(f))<1e-8);}
 for(const c of m.configs){
  assert.equal(m.movingPieces(c.id).length,expected.turn);
  if(type==='masterskewb')assert.deepEqual(m.movingPieces(c.id).map(id=>m.pieces[id]).reduce((a,p)=>(a[p.kind]=(a[p.kind]||0)+1,a),{}),{corner:4,face:9,center:3,edge:3});
  for(let i=0;i<3;i++){m.applyMove(c.id);consistent(m);}assert.deepEqual(m.snapshot(),initial);
  m.applyMove(c.id).applyMove(c.id,-1);assert.deepEqual(m.snapshot(),initial);
  assert(m.permutations[c.id].some((s,i)=>s!==i));assert.equal(new Set(m.permutations[c.id]).size,m.slots.length);
 }
 for(let i=0;i<60;i++){const moves=m.scramble(type+'-'+i,50);for(const move of moves)m.applyMove(move);consistent(m);assert(!m.isSolved());m.invertMoves(moves).forEach(move=>m.applyMove(move));assert.deepEqual(m.snapshot(),initial);}
 if(type==='masterskewb')assert.equal(new Set(m.scramble('all-independent-cuts',240).map(m=>m.face)).size,8);
 assert.throws(()=>m.applyMove('invalid'));if(type==='jing')assert.throws(()=>m.applyMove('l'));
 console.log(type+': exact geometry, face coverage, piece counts, legal turns, slot/mesh agreement and60 seeded reversals PASS');
}
// Existing variants remain unchanged after extending the common mechanism.
for(const type of ['ultimate','diamond']){const m=E.create(type);assert.equal(m.pieces.length,14);assert.equal(m.slots.length,type==='ultimate'?48:32);for(const c of m.configs)assert.equal(m.movingPieces(c.id).length,7);}
