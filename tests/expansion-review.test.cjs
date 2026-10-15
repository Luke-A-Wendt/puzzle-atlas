'use strict';
const assertAutoSolveDelegates=require('./auto-solve-delegate.cjs');
// Independent regression review: a visual difficulty toggle must never mutate
// the puzzle, undo history, camera, queue, or timing of an in-flight turn.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {createHarness}=require('./game-harness.cjs');
const games=path.join(__dirname,'../dist/games');
const stable=s=>JSON.stringify(Object.fromEntries(['pieces','stickers','history','journal','selected','userTurns','seed','mode','paused','animating','view'].filter(k=>k in s).map(k=>[k,s[k]])));
const make=type=>createHarness({htmlPath:path.join(games,type+'.html'),bundled:true,speed:1,reducedMotion:true});
for(const type of ['mirror','flatdiamond','pyramorphix','mastermorphix']){
  const a=make(type),b=make(type),api=a.context.PUZZLE_API;
  assert.equal(a.snapshot().mirrorMode,false,type+' starts colored');
  for(const app of [a,b]){
    const cube=app.elements.get('cube');cube.dispatch('pointerdown',{clientX:17,clientY:23});cube.dispatch('pointermove',{clientX:56,clientY:38});cube.dispatch('pointerup',{clientX:56,clientY:38});
    assert(app.context.PUZZLE_API.runMoves("R U' F2"));app.frame(350);
  }
  const before=stable(a.snapshot());assert(api.setMirrorMode(true));
  assert.equal(stable(a.snapshot()),before,type+' mirror toggle preserves live state');
  assert.equal(a.elements.get('ringPanel').hidden,false);
  assert(a.document.body.classList.contains('mirror-active'));
  assert.equal(a.elements.get('mirrorMode').attributes['aria-pressed'],'true');
  if(type!=='mirror'){
    assert.equal(a.elements.get('pieceLabels').hidden,false);
    assert.equal(a.elements.get('identityMetric').hidden,true);
    assert.equal(a.elements.get('pieceInfo').textContent,'');
  }
  a.frame(350);b.frame(350);assert.equal(stable(a.snapshot()),stable(b.snapshot()),type+' toggling does not restart or consume animation');
  a.click('pause');b.click('pause');a.frame(4000);b.frame(4000);
  const paused=stable(a.snapshot());api.setMirrorMode(false);assert.equal(stable(a.snapshot()),paused,type+' stopped toggle preserves committed state');
  assert.equal(a.elements.get('ringPanel').hidden,false);assert(!a.document.body.classList.contains('mirror-active'));
  assert.equal(a.snapshot().mode,'idle');assert.equal(b.snapshot().mode,'idle');assert(api.runMoves("R U' F2"));assert(b.context.PUZZLE_API.runMoves("R U' F2"));a.complete();b.complete();
  assert.equal(stable(a.snapshot()),stable(b.snapshot()),type+' same final state and history');
  const mixed=stable(a.snapshot());a.click('mirrorMode');assert.equal(stable(a.snapshot()),mixed);a.click('mirrorMode');assert.equal(stable(a.snapshot()),mixed);
  assertAutoSolveDelegates(a.context);assert.equal(stable(a.snapshot()),mixed);api.reset();assert(a.snapshot().solved);assert.equal(a.snapshot().history.length,0);
  if(type==='pyramorphix'||type==='mastermorphix'){
    api.move('U2');a.complete();assert.equal(a.snapshot().solved,false);
    api.setMirrorMode(true);assert.equal(a.snapshot().solved,true,type+' accepts restored shape with mixed colors');
    api.setMirrorMode(false);assert.equal(a.snapshot().solved,false,type+' colored goal restored without state reset');
  }
  console.log(type+': mirror toggle preserves camera, in-flight/paused queue, timing, undo history and physical state PASS');
}
for(const type of ['rhombic','cornerocta','trajber','jewel']){
  const a=make(type);assert.equal(a.snapshot().mirrorEligible,false);
  assert.equal(a.context.PUZZLE_API.setMirrorMode(true),false);
  assert.equal(a.snapshot().mirrorMode,false);assert.equal(a.elements.get('mirrorMode').hidden,true);
}
const theme=fs.readFileSync(path.join(games,'game-theme.css'),'utf8');
assert.doesNotMatch(theme,/\.mirror-active\s+\.workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0,1fr\)/);
assert.match(theme,/#ringPanel\[hidden\][^{]*\{[^}]*display:\s*none!important/);
console.log('Only shape-changing games expose mirror mode; silver map retains linked tile targets PASS');

const Dino=require('../dist/games/dino-engine.js'),Rings=require('../dist/games/dino-rings.js');
for(const type of ['dino','rainbow']){
  const model=Dino.create(type),map=Rings.create(model),initial=map.views();
  assert.equal(initial.length,type==='dino'?24:56);
  const nearest=initial.map(a=>initial.filter(b=>b.id!==a.id).sort((b,c)=>Math.hypot(a.x-b.x,a.y-b.y)-Math.hypot(a.x-c.x,a.y-c.y))[0]);
  const min=Math.min(...initial.map((a,i)=>Math.hypot(a.x-nearest[i].x,a.y-nearest[i].y)));
  assert(min>2*map.nodeRadius+1,type+' solved map nodes must not overlap');
  assert(initial.filter((a,i)=>a.color===nearest[i].color).length/initial.length>.8,type+' solved colors grouped');
  const stationary=()=>JSON.stringify(model.pieces.filter(p=>p.fixed).map(p=>({id:p.id,pos:p.pos,orientation:p.orientation})));
  const fixed=stationary();
  for(const move of model.scramble('independent expansion review',18)){
    assert.equal(model.movingPieces(move).length,3,'every legal turn cycles exactly three edges');
    const before=map.views(),end=before.map(p=>map.interpolate(p,{move,progress:1}));
    for(const progress of [0,.25,.5,.75,1])for(const node of before){
      const at=map.interpolate(node,{move,progress});
      assert(Number.isFinite(at.x)&&Number.isFinite(at.y));assert.equal(at.color,node.color);
      assert.match(at.color,/^#[0-9a-f]{6}$/i,'each node has one plain solid color');
      if(node.piece.fixed)assert(Math.hypot(at.x-node.x,at.y-node.y)<1e-8,'fixed center node remains stationary');
    }
    model.applyMove(move);assert.equal(stationary(),fixed,'Rainbow centers retain fixed positions and endpoint orientation');
    const after=new Map(map.views().map(node=>[node.id,node]));
    for(const p of end){const q=after.get(p.id);assert(Math.hypot(p.x-q.x,p.y-q.y)<1e-7,'animation endpoint equals physical state');}
  }
  model.reset();for(const move of "B D E G A' C' F' H' B D E G".split(' '))model.applyMove(move);
  assert.equal(model.isSolved(),type==='dino','only Dino accepts the mirror-related color solution');
  console.log(type+': single-color map nodes, solved spacing '+min.toFixed(1)+', fixed centers, exact animated endpoints and reflected-solution rule PASS');
}
