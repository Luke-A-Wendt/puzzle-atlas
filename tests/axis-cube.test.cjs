'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Engine=require('../dist/games/shape-engine.js'),Rings=require('../dist/games/shape-rings.js');
const model=require('../solver-backend/data/axis.json'),cache=require('../solver-backend/data/full-solver/axis.json');
const {solveFull,modelSignature}=require('../solver-backend/src/full-solve.cjs');
const {compose,inverse,identity}=require('../solver-backend/src/group.cjs');
const {CachedSwapSolver}=require('../solver-backend/src/cached-swap.cjs');
const {verify}=require('../solver-backend/src/index.cjs');
const {shapeAdapter}=require('../solver-backend/tools/export-models.cjs');
const {verifyColorCache}=require('../solver-backend/tools/precompute-color.cjs');
const home=Object.fromEntries(model.initialOccupied.map((v,i)=>[String(i),v]));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

test('Axis Cube is the 60-degree diagonal 3×3 modification, with six standard color groups',()=>{
 const m=Engine.create('axis');assert.equal(m.pieces.length,26);assert.equal(m.slots.length,42);assert.equal(m.faces.length,6);
 assert.equal(m.pieces.filter(p=>p.kind==='corner'&&p.stickers.length===3).length,2);
 assert.equal(m.pieces.filter(p=>p.kind==='corner'&&p.stickers.length===1).length,6);
 assert.equal(m.pieces.filter(p=>p.kind==='edge'&&p.stickers.length===1).length,6);
 assert.equal(m.pieces.filter(p=>p.kind==='edge'&&p.stickers.length===2).length,6);
 assert.equal(m.pieces.filter(p=>p.kind==='center'&&p.stickers.length===2).length,6);
 for(const face of m.faces){assert.equal(m.slots.filter(s=>s.faceIndex===face.index).length,7);assert.equal(face.points.length,4);const n=Engine.rotateVector(m.configs[face.index].normal,[1,1,1],Math.PI/3);assert(n.every((v,i)=>Math.abs(v-face.normal[i])<1e-8));}
 assert.deepEqual(m.faces.map(f=>f.color),['#f4f2e8','#f36c73','#36bf85','#ffd447','#ff9b52','#4394f7']);
 assert(m.mirrorEligible);m.applyMove('R');assert(!m.isShapeSolved());m.applyMove("R'");assert(m.isSolved());
});

test('Axis ring colors form six separated groups and exact smooth orbit paths',()=>{
 const m=Engine.create('axis'),rings=Rings.create(m),solved=rings.views();
 assert.equal(solved.length,42);assert.equal(rings.nodeRadius,5);
 for(const a of solved){const nearest=solved.filter(b=>a.id!==b.id).sort((b,c)=>distance(a,b)-distance(a,c))[0];assert.equal(a.color,nearest.color);assert(distance(a,nearest)>28);}
 let checks=0;
 for(let seed=0;seed<3;seed++){
  m.reset();if(seed)m.scramble('axis-rings-'+seed,25).forEach(move=>m.applyMove(move));
  for(const spec of model.moves){
   const move=spec.engineMove,before=rings.views(),curves=rings.orbits(move.face),moving=new Set(m.movingPieces(move)),ending=new Map();
   for(const point of before){ending.set(point.id,rings.interpolate(point,{move,progress:1}));if(!moving.has(point.piece.id))continue;
    for(const progress of [0,.2,.5,.8,1]){const at=rings.interpolate(point,{move,progress});assert(Number.isFinite(at.x+at.y));assert(Math.min(...curves.map(c=>rings.distance(at,c)))<.15,'moving marker stays on its drawn orbit');checks++;}
   }
   for(const curve of curves){assert(distance(curve.points[0],curve.points.at(-1))<1e-6);for(let i=1;i<curve.points.length;i++)assert(distance(curve.points[i-1],curve.points[i])<10.01,'adaptive circle samples avoid jagged chords');}
   m.applyMove(move);for(const point of rings.views())assert(distance(point,ending.get(point.id))<1e-7);m.applyMove({...move,dir:-move.dir});
  }
 }
 assert(checks>3000);
});

test('Axis cached chain certifies the complete oriented 3×3 group and bounded legal representatives',()=>{
 assert.equal(cache.complete,true);assert.equal(cache.modelSignature,modelSignature(model));assert.equal(model.degree,168);assert.equal(model.stickerCount,42);
 assert.equal(cache.levels.reduce((n,l)=>n*BigInt(l.entries.length+1),1n),88580102706155225088000n);
 const perms=[identity(model.degree)],lengths=[0],inv=[];const term=r=>r<0?(inv[-r]??=inverse(perms[-r])):perms[r];
 for(let i=1;i<cache.words.length;i++){const w=cache.words[i];perms[i]=w.length===1?model.moves[w[0]].perm:compose(term(w[0]),term(w[1]));lengths[i]=w.length===1?1:lengths[Math.abs(w[0])]+lengths[Math.abs(w[1])];}
 let upper=0;
 for(let k=0;k<cache.levels.length;k++){const level=cache.levels[k];let longest=0;for(const [dest,word,stored]of level.entries){const perm=term(word);assert.deepEqual(Array.from(perm),stored);assert.equal(perm[level.base],dest);assert(cache.base.slice(0,k).every(n=>perm[n]===n));longest=Math.max(longest,lengths[Math.abs(word)]);}upper+=longest;}
 assert.equal(upper,cache.stats.optimization.solutionLengthUpperBound);assert(upper<=317);
});

test('Axis Auto Solve restores actual rigid geometry from independent scrambles without history',()=>{
 const lengths=[];
 for(let seed=0;seed<20;seed++){
  const m=Engine.create('axis'),adapter=shapeAdapter({id:'axis',kind:'model',engine:Engine,model:m});m.scramble('axis-autosolve-'+seed,30).forEach(move=>m.applyMove(move));
  const currentBySticker=Object.fromEntries(adapter.mapping().map((v,i)=>[String(i),v]));
  const plan=solveFull(model,{homeBySticker:home,currentBySticker},{cache,maxMs:5000,maxOutputMoves:1000});assert.equal(plan.status,'solved',plan.reason);
  for(const i of plan.moveIndices)m.applyMove(model.moves[i].engineMove);
  assert(m.isExactSolved());assert(m.isSolved());assert(m.isShapeSolved());assert(plan.moveIndices.length<=317);lengths.push(plan.moveIndices.length);
 }
 console.log('Axis actual-engine solve lengths:',Math.min(...lengths),'to',Math.max(...lengths),'mean',lengths.reduce((a,b)=>a+b)/lengths.length);
});

test('Axis constrained exchange restores held patch poses at the verified endpoint',()=>{
 const request={protected:[0,2,4],swap:[3,5],occupiedNodes:model.initialOccupied},solver=new CachedSwapSolver(model,cache),result=solver.solve(request,{maxMs:3000,maxOutputMoves:1000});
 assert.equal(result.status,'solved',result.reason);assert(verify(model,request,result.moveIndices));assert(result.moveIndices.length<=100);
 const m=Engine.create('axis'),adapter=shapeAdapter({id:'axis',kind:'model',engine:Engine,model:m});for(const i of result.moveIndices)m.applyMove(model.moves[i].engineMove);const poses=adapter.mapping();assert.equal(poses[3],5);assert.equal(poses[5],3);for(const n of request.protected)assert.equal(poses[n],n);
 // A point in the distinct corner action cannot be exchanged with an edge marker.
 const impossible=solver.solve({protected:[],swap:[0,3],occupiedNodes:model.initialOccupied},{maxMs:3000});assert.equal(impossible.status,'impossible');
});

test('Axis color-cache witnesses and exhaustive exact-pair audit agree with the mechanism',()=>{
 const catalog=require('../solver-backend/data/color-solver/axis.json'),verified=verifyColorCache(model,catalog),audit=catalog.exactTranspositions;
 assert.equal(verified.verifiedWords,513);assert.equal(verified.exchangePairs,492);
 assert.equal(audit.modelSignature,cache.modelSignature);assert.equal(audit.complete,true);
 assert.equal(audit.totalPairs,model.degree*(model.degree-1)/2);assert.equal(audit.unresolved,0);
 assert.equal(audit.possible,0);assert.equal(audit.impossible,14028);
 assert.equal(audit.orbits.reduce((total,orbit)=>total+orbit.pairs,0),audit.totalPairs);
});
