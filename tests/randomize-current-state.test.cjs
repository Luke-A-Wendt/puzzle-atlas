'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createPage}=require('./solver-dom.cjs');
const models=JSON.parse(fs.readFileSync('dist/games/constrained-solver-models/manifest.json')).models;
const plain=x=>JSON.parse(JSON.stringify(x));
for(const {id}of models)test(id+': Randomize composes with the current state and retains Undo history',async()=>{
 const app=createPage(id),api=app.context.PUZZLE_API,core=app.context.ConstrainedSolverCore;
 const model=JSON.parse(fs.readFileSync('dist/games/constrained-solver-models/'+id+'.json'));
 const initial=app.snapshot();assert(api.move(model.moves[0].engineMove));await app.settle();
 const before=app.snapshot();assert.notDeepEqual(before.stickers,initial.stickers);
 app.click('randomize');
 const started=app.snapshot();assert.deepEqual(started.stickers,before.stickers,'no jump to solved before animation');
 assert.deepEqual(started.history,before.history);assert.equal(started.userTurns,before.userTurns);
 assert.deepEqual(started.journal.slice(0,before.journal.length),before.journal);
 assert.equal(String(app.element('speed').value),'5');
 await app.settle();const after=app.snapshot();assert(after.history.length>before.history.length);
 let expected=plain(core.mapSnapshot(model,before.stickers).stickerToNode);
 for(const move of after.history.slice(before.history.length)){
  const options=model.moves.filter(m=>m.engineMove.face===move.face),order=Math.max(...options.map(m=>m.order));
  const power=m=>(((m.dir??1)*(m.turns??1))%order+order)%order;
  const turn=options.find(m=>power(m.engineMove)===power(move));assert(turn,id+' legal generated move');
  expected=Object.fromEntries(Object.entries(expected).map(([s,n])=>[s,turn.perm[n]]));
 }
 assert.deepEqual(plain(core.mapSnapshot(model,after.stickers).stickerToNode),expected,'random word applies to the preceding arrangement');
 assert.equal(String(app.element('speed').value),'3');
 app.click('randomize');assert.deepEqual(app.snapshot().stickers,after.stickers,'repeated Randomize also continues');
 await app.advance(2000);assert.equal(app.snapshot().history.length,after.history.length+1);
 app.click('pause');assert.equal(app.snapshot().mode,'idle');assert.equal(String(app.element('speed').value),'3');
 app.click('undo');await app.settle();assert.deepEqual(app.snapshot().stickers,after.stickers,'Undo crosses the new scramble boundary');
 api.reset();assert.deepEqual(app.snapshot().stickers,initial.stickers);assert.equal(app.snapshot().history.length,0);
});
test('Helicopter generates legal jumbling from an already offset shape',async()=>{
 const app=createPage('helicopter'),api=app.context.PUZZLE_API;
 assert(api.setAdvanced(true));assert(api.stopMove('UF',1));await app.settle();
 const before=app.snapshot();app.click('randomize');
 assert.deepEqual(app.snapshot().pieces,before.pieces);assert.deepEqual(app.snapshot().axisStops,before.axisStops);
 await app.settle();const after=app.snapshot();assert.equal(after.history.length,before.history.length+25);
 const model=app.context.HelicopterEngine.create();for(const move of after.history)model.applyMove(move);
 assert.deepEqual(after.pieces,plain(model.snapshot().pieces));assert.deepEqual(after.axisStops,plain(model.snapshot().axisStops));
 for(let i=0;i<25;i++){app.click('undo');await app.settle();}
 // Fractional jumbling rotations accumulate ordinary floating-point roundoff.
 const round=x=>JSON.parse(JSON.stringify(x,(_,v)=>typeof v==='number'?Math.round(v*1e9)/1e9:v));
 assert.deepEqual(round(app.snapshot().pieces),round(before.pieces));assert.deepEqual(app.snapshot().axisStops,before.axisStops);
});
