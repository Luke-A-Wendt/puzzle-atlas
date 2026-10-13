'use strict';
const assert=require('node:assert/strict');
const E=require('../dist/games/dino-engine.js'),v=E.vector;
const state=m=>JSON.stringify(m.snapshot()),point=p=>p.map(n=>Math.round(n*1e6)).join(','),shape=p=>p.map(point).sort().join(';');
const polygonArea=f=>{let total=0;for(let i=1;i<f.length-1;i++)total+=v.length(v.cross(v.sub(f[i],f[0]),v.sub(f[i+1],f[0])))/2;return total;};
const bodyVolume=body=>body.reduce((sum,f)=>sum+f.points.slice(1,-1).reduce((a,p,i)=>a+v.dot(f.points[0],v.cross(p,f.points[i+2]))/6,0),0);
const parity=permutation=>{let n=0;for(let i=0;i<permutation.length;i++)for(let j=i+1;j<permutation.length;j++)if(permutation[i]>permutation[j])n++;return n%2;};
assert.equal(E.rotations.length,12,'no independent flips: exact tetrahedral orientation group');
for(const type of E.types){const m=E.create(type),original=state(m),slots=new Map(m.pieces.filter(p=>p.kind==='edge').map((p,i)=>[p.home.join(','),i]));
 assert.equal(m.pieces.filter(p=>p.kind==='edge').length,12);assert.equal(m.pieces.filter(p=>p.stationary).length,type==='dino'?0:8);assert.equal(m.slots.length,type==='dino'?24:56);assert.equal(m.faces.length,type==='dino'?6:14);assert.equal(new Set(m.slots.map(s=>s.color)).size,m.faces.length);
 for(const p of m.pieces){assert.ok(bodyVolume(p.body)>0,'closed outward oriented solid');for(const f of p.body){for(const q of f.points)assert.ok(Math.abs(v.dot(q,f.normal)-f.offset)<1e-7,'planar rigid piece boundary');const n=v.cross(v.sub(f.points[1],f.points[0]),v.sub(f.points[2],f.points[0]));assert.ok(v.dot(n,f.normal)>0,'outward winding');}}
 if(type==='rainbow')assert.ok(Math.abs(m.pieces.reduce((sum,p)=>sum+bodyVolume(p.body),0)+4/3-bodyVolume(m.faces))<1e-7,'Rainbow pieces plus concealed octahedral core exactly partition the cuboctahedron');
 // Every physical face is covered exactly by its sticker regions, without gaps.
 for(const f of m.faces){const stickers=m.slots.filter(s=>s.faceIndex===f.index);assert.equal(stickers.length,4);assert.ok(Math.abs(stickers.reduce((s,t)=>s+polygonArea(t.regionPolygon),0)-polygonArea(f.points))<1e-7);if(type==='rainbow'){const triangles=f.id.startsWith('T');for(const s of stickers)assert.equal(s.regionPolygon.length,triangles?3:4);if(triangles)assert.equal(stickers.filter(s=>m.pieces[s.piece].stationary).length,1);}}
 // The 12 rotations act freely/transitively on each edge: a slot fixes orientation.
 for(const p of m.pieces.filter(p=>p.kind==='edge'))assert.equal(new Set(E.rotations.map(r=>v.transform(r,p.home).join(','))).size,12);
 for(const c of m.configs){const moving=m.movingPieces(c.id);assert.equal(moving.length,3);assert.equal(m.animationPieces(c.id).length,type==='dino'?3:4);assert.ok(moving.every(id=>m.pieces[id].kind==='edge'));const animated=new Set(m.animationPieces(c.id));for(const p of m.pieces)for(const f of p.body)for(const q of f.points)assert.ok(animated.has(p.id)?v.dot(q,c.corner)>=1-1e-7:v.dot(q,c.corner)<=1+1e-7,'rigid moving layer is cleanly separated by its exact cut plane');m.applyMove(c.id);assert.ok(!m.isSolved());assert.equal(parity(m.pieces.filter(p=>p.kind==='edge').map(p=>slots.get(p.pos.join(',')))),0);m.applyMove(c.id);m.applyMove(c.id);assert.equal(state(m),original,'three 120° turns are exact identity');m.applyMove(c.id);m.applyMove(c.id,-1);assert.equal(state(m),original,'inverse exact identity');}
 const expectedSurface=m.slots.map(s=>shape(s.regionPolygon)).sort().join('|');
 for(let seed=0;seed<120;seed++){const moves=m.scramble('dino-model-'+seed,30);assert.deepEqual(moves,m.scramble('dino-model-'+seed,30),'deterministic seed');moves.forEach(move=>m.applyMove(move));const edges=m.pieces.filter(p=>p.kind==='edge');assert.equal(new Set(edges.map(p=>p.pos.join(','))).size,12);assert.equal(parity(edges.map(p=>slots.get(p.pos.join(',')))),0,'all legal states have even edge permutation');for(const p of m.pieces){assert.ok(p.pos.every(Number.isInteger));assert.ok(p.orientation.flat().every(n=>[-1,0,1].includes(n)));if(p.stationary){assert.deepEqual(p.pos,p.home);assert.deepEqual(p.orientation,v.identity());}else{assert.deepEqual(p.orientation,E.rotations.find(r=>v.transform(r,p.home).every((n,i)=>n===p.pos[i])),'orientation determined by edge slot');}}
  assert.equal(m.pieces.flatMap(p=>m.mesh(p).stickers).map(s=>shape(s.regionPolygon)).sort().join('|'),expectedSurface,'legal turns preserve all physical sticker slots');E.invertMoves(moves).forEach(move=>m.applyMove(move));assert.equal(state(m),original);assert.ok(m.isSolved());}
 console.log(type+': exact geometry and complete sticker coverage; 120 seeded scrambles, even permutations, unique orientations and reversal passed.');
}
// Source-documented alternate mirror solution. Identical moves leave Rainbow centres unmatched.
const mirrorPattern="B D E G A' C' F' H' B D E G".split(' ');
const dino=E.create('dino'),rainbow=E.create('rainbow');for(const move of mirrorPattern){dino.applyMove(move);rainbow.applyMove(move);}assert.ok(dino.isSolved());assert.ok(!dino.isExactSolved());assert.equal(dino.uniformFaces(),6);assert.ok(!rainbow.isSolved());assert.equal(rainbow.uniformFaces(),6);
for(const bad of ['Q','A2','',null,{face:'A',dir:0}])assert.throws(()=>dino.applyMove(bad));assert.throws(()=>E.create('unknown'));
console.log('Both Dino solved patterns, Rainbow fixed-center constraints, and invalid moves passed.');
