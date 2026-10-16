'use strict';
// Exercise the published engines through their real UI and animation clock.
// A speed option is useful only if it changes the primitive's actual duration.
const test=require('node:test'),assert=require('node:assert/strict');
const {createPage}=require('./solver-dom.cjs');
const puzzles=require('../dist/games/constrained-solver-models/manifest.json').models.map(model=>model.id);
for(const puzzle of puzzles)test(puzzle+' offers 4× and 8× playback and completes actual moves at those rates',async()=>{
 const app=createPage(puzzle);await app.flush();
 const playback=app.element('playbackSpeed'),speed=app.element('speed'),api=app.context.PUZZLE_API;
 assert.equal(String(playback.value),'3','first load starts at 1×');
 assert.equal(String(speed.max),'7');
 assert.deepEqual(playback.children.map(option=>[String(option.value),option.textContent]),[['1','0.5×'],['2','0.75×'],['3','1×'],['4','1.5×'],['5','2×'],['6','4×'],['7','8×']]);
 const face=app.element('viewRingSelector').querySelector('.ring-key').dataset.face;
 for(const [index,rate]of [[6,4],[7,8]]){
  playback.value=String(index);playback.dispatch('change');
  assert.equal(String(speed.value),String(index));
  assert.equal(app.context.PuzzlePlaybackControls.duration(index),450/rate);
  assert.equal(api.runMoves([{face,dir:1}],{label:'Playback duration test'}),true);
  await app.advance(0);assert.equal(app.snapshot().animating,true);
  await app.advance(450/rate-.1);assert.equal(app.snapshot().animating,true,'turn remains in flight immediately before requested duration');
  await app.advance(.2);assert.equal(app.snapshot().animating,false,'turn commits immediately after requested duration');
  assert.equal(String(playback.value),String(index),'completing the sequence preserves the user playback setting');
  await app.advance(500);
 }
});
