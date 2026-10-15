'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createHarness}=require('./game-harness.cjs');
const puzzles=['cube2','cube3','cube4','cube5','cube6','cube7','mirror','homer','pyraminx','tetraminx','megaminx','jing','skewb','masterskewb','ultimate','diamond','fto','crystal','dino','rainbow','rhombic','flatdiamond','cornerocta','trajber','jewel','pyramorphix','mastermorphix','helicopter'];
function drawing(){
 const counts={arcs:0,clears:0};
 const ctx=new Proxy({}, {get:(target,key)=>{
  if(key==='arc')return(x,y,r)=>{assert([x,y,r].every(Number.isFinite),'Canvas arc arguments are finite');assert(r>=0,'Canvas arc radius cannot be negative');counts.arcs++;};
  if(key==='clearRect')return()=>{counts.clears++;};
  if(key==='measureText')return text=>({width:String(text).length*6});
  if(key==='createRadialGradient'||key==='createLinearGradient')return()=>({addColorStop(){}});
  return key in target?target[key]:()=>{};
 },set:(target,key,value)=>(target[key]=value,true)});
 return {ctx,counts};
}
const physical=s=>JSON.stringify({stickers:s.stickers,pieces:s.pieces,axisStops:s.axisStops});
for(const puzzle of puzzles)test(puzzle+': stopping commits one legal move, cancels queue, and leaves collapsed-map 3D playable',()=>{
 const ring=drawing(),cube=drawing();
 const app=createHarness({htmlPath:path.join(__dirname,'../dist/games',puzzle+'.html'),bundled:true,speed:1,
  dimensions:{rings:{width:0,height:0},cube:{width:500,height:400}},canvasContexts:{rings:ring.ctx,cube:cube.ctx}}),api=app.context.PUZZLE_API;
 assert.equal(typeof api.stopAfterCurrentMove,'function');
 assert.equal(api.stopAfterCurrentMove(),false,'Idle stop is a no-op');
 const first={face:app.snapshot().selected,dir:1,turns:1};
 assert(api.move(first));app.complete();const expectedOneMove=physical(app.snapshot());api.reset();
 assert.deepEqual(app.snapshot().sequence,{completed:0,total:0,remaining:0,active:false,stopping:false});
 app.elements.get('speed').value='1';app.elements.get('speed').dispatch('input');
 assert(api.runMoves([first,first,first],{label:'Constrained test step'}));
 assert.deepEqual(app.snapshot().sequence,{completed:0,total:3,remaining:3,active:true,stopping:false});
 app.frame(350);const before=physical(app.snapshot());
 assert.equal(api.stopAfterCurrentMove(),true);
 assert.equal(physical(app.snapshot()),before,'A finish-current-turn request does not commit prematurely');
 assert.equal(app.snapshot().paused,false,'The atomic turn continues normally to its legal endpoint');
 assert.deepEqual(app.snapshot().sequence,{completed:0,total:3,remaining:1,active:true,stopping:true});
 app.frame(549);assert(app.snapshot().animating,'A finish-current-turn request retains the original remaining duration');
 app.frame(2);
 const stopped=app.snapshot();
 assert.equal(stopped.mode,'idle');assert.equal(stopped.animating,false);assert.equal(stopped.paused,false);
 assert.deepEqual(stopped.sequence,{completed:1,total:3,remaining:0,active:false,stopping:false});
 assert.equal(stopped.history.length,1);assert.equal(stopped.userTurns,1);
 assert.equal(stopped.journal.filter(entry=>entry.move).length,1,'Only the completed turn enters the journal');
 assert.equal(physical(stopped),expectedOneMove,'Stopped state is the exact legal one-turn endpoint');
 const unchanged=physical(stopped);app.frame(10000);assert.equal(physical(app.snapshot()),unchanged,'Canceled turns never resume');
 assert.equal(api.stopAfterCurrentMove(),false);
 assert.match(app.elements.get('message').textContent,/Remaining moves were canceled/);
 assert.equal(ring.counts.arcs,0,'Collapsed ring canvas never enters ring geometry or negative-radius drawing');
 assert.equal(app.context.PUZZLE_SOLVER_BRIDGE.nodes().length,0,'Collapsed ring map exposes no stale selectable nodes');
 assert(cube.counts.clears>3,'3D continues drawing while the ring map is collapsed');
 assert(api.move(first),'3D/manual play is available after stopping');app.complete();
 assert.equal(app.snapshot().history.length,2);
 app.click('undo');app.complete();assert.equal(physical(app.snapshot()),expectedOneMove,'Undo remains coherent after cancellation');
 api.reset();assert(api.runMoves([first,first]));app.complete();
 assert.deepEqual(app.snapshot().sequence,{completed:2,total:2,remaining:0,active:false,stopping:false},'A fresh sequence has independent progress');
});
