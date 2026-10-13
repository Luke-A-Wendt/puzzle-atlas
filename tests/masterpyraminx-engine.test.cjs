'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),E=require('../dist/games/masterpyraminx-engine.js'),v=E.vector;
const area=ps=>ps.slice(1,-1).reduce((n,p,i)=>n+v.length(v.cross(v.sub(p,ps[0]),v.sub(ps[i+2],ps[0])))/2,0);
const volume=body=>body.reduce((sum,f)=>sum+f.points.slice(1,-1).reduce((s,p,i)=>s+v.dot(f.points[0],v.cross(p,f.points[i+2]))/6,0),0);
const point=p=>p.map(n=>Math.round(n*1e6)||0).join(','),polygon=ps=>ps.map(point).sort().join(';');
test('Master Pyraminx has 30 exact convex planar cells and 64 equal triangular stickers',()=>{
 const m=E.create();assert.deepEqual(m.pieces.reduce((a,p)=>(a[p.kind]=(a[p.kind]||0)+1,a),{}),{tip:4,wing:12,center:4,axial:4,midge:6});assert.equal(E.rotations.length,12);assert.equal(m.mirrorEligible,false);
 const wholeVolume=volume(m.faces),piecesVolume=m.pieces.reduce((sum,p)=>sum+volume(p.body),0);assert(Math.abs(wholeVolume*15/16-piecesVolume)<1e-8,'visible cells fill 60/64 of the solid; four internal tetrahedral cavities hold no stickers');
 for(const p of m.pieces){assert(volume(p.body)>0);for(const f of p.body)for(const x of f.points){assert(Math.abs(v.dot(f.normal,x)-f.offset)<1e-7);for(const side of p.body)assert(v.dot(side.normal,x)<=side.offset+1e-7,'convex body');}}
 for(const f of m.faces){const ss=m.slots.filter(s=>s.face===f.id);assert.equal(ss.length,16);for(const s of ss){assert.equal(s.regionPolygon.length,3);assert(Math.abs(area(s.regionPolygon)-area(f.points)/16)<1e-8,'equal triangular facelet area');}assert(Math.abs(ss.reduce((sum,s)=>sum+area(s.regionPolygon),0)-area(f.points))<1e-8);}
});
test('every legal depth obeys its cutting plane, has exact order three, and retains rigid cells',()=>{
 const m=E.create(),start=JSON.stringify(m.snapshot());
 for(const cfg of m.configs){const ids=new Set(m.movingPieces(cfg.id)),count=cfg.tip?1:cfg.kind==='wide'?14:5;assert.equal(ids.size,count);assert.equal(m.stickerState.filter(s=>ids.has(s.piece)).length,cfg.tip?3:cfg.kind==='wide'?27:12);
  for(const p of m.pieces)for(const f of p.body)for(const x of f.points)assert(ids.has(p.id)?E.lambda(x,cfg.axisIndex)>=cfg.threshold-1e-7:E.lambda(x,cfg.axisIndex)<=cfg.threshold+1e-7,'no rigid cell straddles its move cut');
  for(let k=0;k<3;k++)m.applyMove(cfg.id);assert.equal(JSON.stringify(m.snapshot()),start);
  m.applyMove(cfg.id);m.applyMove(cfg.id+"'");assert.equal(JSON.stringify(m.snapshot()),start);
  m.applyMove(cfg.id+'2');m.applyMove(cfg.id);assert.equal(JSON.stringify(m.snapshot()),start);
 }
 const targets=m.slots.map(s=>polygon(s.regionPolygon)).sort().join('|');
 for(let seed=0;seed<8;seed++){const moves=m.scramble('master-pyraminx-'+seed,60);assert.deepEqual(moves,m.scramble('master-pyraminx-'+seed,60));moves.forEach(move=>m.applyMove(move));assert.equal(new Set(m.pieces.map(p=>p.slot)).size,30);assert.equal(new Set(m.stickerState.map(s=>s.slot)).size,64);assert.equal(m.pieces.flatMap(p=>m.mesh(p).stickers).map(s=>polygon(s.regionPolygon)).sort().join('|'),targets,'scramble preserves physical surface cell locations');E.invertMoves(moves).forEach(move=>m.applyMove(move));assert.equal(JSON.stringify(m.snapshot()),start);}
});
test('independent sticker permutations match engine composition on arbitrary scrambled states',()=>{
 const m=E.create(),maps=Object.fromEntries(m.configs.map(c=>{m.reset().applyMove(c.id);return[c.id,m.stickerState.slice().sort((a,b)=>a.id-b.id).map(s=>s.slot)];}));m.reset();let expected=m.slots.map(s=>s.id);const random=E.seededRandom('independent-permutations');
 for(let i=0;i<250;i++){const c=m.configs[Math.floor(random()*m.configs.length)],dir=random()<.5?-1:1,move={face:c.id,dir,turns:1};for(let k=0;k<(dir===1?1:2);k++)expected=expected.map(x=>maps[c.id][x]);m.applyMove(move);assert.deepEqual(m.stickerState.slice().sort((a,b)=>a.id-b.id).map(s=>s.slot),expected);}
 for(const invalid of ['Z','U3','uw','Uw3','',null,{face:'R',dir:0}])assert.throws(()=>m.applyMove(invalid));
});
