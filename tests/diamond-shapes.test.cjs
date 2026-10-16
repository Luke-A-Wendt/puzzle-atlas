'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const E=require('../dist/games/shape-engine.js'),R=require('../dist/games/shape-rings.js');
const {createHarness}=require('./game-harness.cjs');
const key=s=>[s.center,s.normal].map(v=>v.map(n=>Math.round(n*1e6)).join(',')).join('/');
test('Diamond Style has 26 one-facelet pieces and three visually solved bands',()=>{
 const m=E.create('diamondstyle');assert.equal(m.faces.length,26);assert.equal(m.slots.length,26);
 assert.equal(m.pieces.filter(p=>p.kind==='center').length,6);assert.equal(m.pieces.filter(p=>p.kind==='edge').length,12);assert.equal(m.pieces.filter(p=>p.kind==='corner').length,8);
 for(const p of m.pieces){assert.equal(p.stickers.length,1);assert.equal(p.stickers[0].color,p.home[1]>0?'#f36c73':p.home[1]<0?'#4394f7':'#36bf85');assert.equal(p.stickers[0].regionPolygon.length,p.kind==='corner'?3:4);}
 for(const move of ['U','D','U2',"D'"]){m.applyMove(move);assert(m.isSolved(),'same-color rotations remain solved');}assert(!m.isExactSolved(),'hidden piece identity is not the visual goal');
 m.applyMove('R');assert(!m.isSolved());m.applyMove("R'");assert(m.isSolved());
});
test('Diamond Cube is a 14-color cuboctahedron with its real 86 facelets',()=>{
 const m=E.create('diamondcube');assert.equal(m.faces.length,14);assert.equal(m.slots.length,86);assert.equal(new Set(m.slots.map(s=>s.color)).size,14);
 for(const f of m.faces){const cells=m.slots.filter(s=>s.faceIndex===f.index),shapes=cells.map(s=>s.regionPolygon.length).sort();if(f.points.length===4)assert.deepEqual(shapes,[3,3,3,3,4,5,5,5,5]);else{assert.equal(f.points.length,3);assert.deepEqual(shapes,[3,3,3,6]);}}
 assert.equal(m.pieces.filter(p=>p.kind==='edge'&&p.stickers.length===4).length,12);assert.equal(m.pieces.filter(p=>p.kind==='corner'&&p.stickers.length===4).length,8);
 for(const face of ['U','R','F','D','L','B']){m.reset();m.applyMove(face);assert(!m.isSolved());assert(m.isShapeSolved());}
});
for(const type of ['diamondstyle','diamondcube']){
 test(type+': exact fixed sticker slots and legal ring endpoints survive independent moves',()=>{
  const m=E.create(type),slots=new Map(m.slots.map(s=>[key(s),s.id])),G=R.create(m);assert.equal(m.configs.length,6);assert.equal(m.mirrorEligible,false);
  for(const move of m.scramble('diamond-fixed-pose-proof',160)){
   const before=G.views(),ends=new Map(before.map(v=>[v.id,G.interpolate(v,{move,progress:1})]));m.applyMove(move);const positions=m.stickerState.map(s=>slots.get(key(s)));
   assert.equal(positions.length,m.slots.length);assert.equal(new Set(positions).size,m.slots.length);assert(!positions.includes(undefined));
   for(const v of G.views()){const p=ends.get(v.id);assert(Math.hypot(v.x-p.x,v.y-p.y)<1e-7,'animation reaches exact legal slot');}
  }
 });
 test(type+': complete native page exposes real nodes and preserves Randomize/Stop/manual play',()=>{
  const app=createHarness({htmlPath:path.join(__dirname,'../dist/games',type+'.html'),bundled:true,speed:3}),api=app.context.PUZZLE_API;
  assert.equal(app.context.PUZZLE_SOLVER_BRIDGE.nodes().length,type==='diamondstyle'?26:86);assert(app.elements.get('mirrorMode').hidden);
  assert(api.randomize());assert.equal(app.elements.get('speed').value,'5');assert.equal(app.elements.get('pause').textContent,'Stop');
  app.frame(2000);const committed=app.snapshot().history.length;assert(committed>0);app.frame(20);app.click('pause');assert.equal(app.snapshot().mode,'idle');assert.equal(app.snapshot().history.length,committed);assert.equal(app.elements.get('speed').value,'5');
  assert(api.move('R'));app.complete();assert.equal(app.snapshot().history.length,committed+1);api.reset();assert(app.snapshot().solved);assert.equal(app.context.PUZZLE_SOLVER_BRIDGE.nodes().length,type==='diamondstyle'?26:86);
 });
}
