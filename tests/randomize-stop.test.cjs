'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createPage}=require('./solver-dom.cjs');
const manifest=JSON.parse(fs.readFileSync('dist/games/constrained-solver-models/manifest.json','utf8'));
for(const {id}of manifest.models)test(id+': top Stop immediately cancels randomizing and preserves exactly the completed moves',async()=>{
 const app=createPage(id);app.click('randomize');assert.equal(app.element('pause').textContent,'Stop');assert.equal(String(app.element('speed').value),'5');
 await app.advance(2000);assert.equal(app.snapshot().sequence.completed,1);
 const settled=app.snapshot();await app.advance(20);assert.equal(app.snapshot().animating,true);
 app.click('pause');const stopped=app.snapshot();assert.equal(stopped.mode,'idle');assert.equal(stopped.animating,false);assert.equal(stopped.paused,false);
 assert.deepEqual(stopped.stickers,settled.stickers,'unfinished move is never committed');assert.deepEqual(stopped.history,settled.history);assert.equal(stopped.sequence.remaining,0);assert.equal(String(app.element('speed').value),'3');assert.equal(app.element('pause').hidden,true);
 await app.advance(5000);assert.deepEqual(app.snapshot().stickers,settled.stickers);assert.deepEqual(app.snapshot().history,settled.history);
 const model=JSON.parse(fs.readFileSync('dist/games/constrained-solver-models/'+id+'.json','utf8'));assert.equal(app.context.PUZZLE_API.move(model.moves[0].engineMove),true);await app.settle();assert.equal(app.snapshot().history.length,settled.history.length+1);
 const v=app.context.PUZZLE_SOLVER_BRIDGE.viewport();assert(Number.isFinite(v.x)&&Number.isFinite(v.y)&&v.scale>0);
});
