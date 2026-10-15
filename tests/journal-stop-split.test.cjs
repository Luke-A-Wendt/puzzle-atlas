'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createPage}=require('./solver-dom.cjs');
const puzzles=fs.readdirSync(path.join(__dirname,'../dist/games')).filter(f=>f.endsWith('.html')&&fs.readFileSync(path.join(__dirname,'../dist/games',f),'utf8').includes('id="undoSequence"')).map(f=>f.slice(0,-5));
const physical=a=>JSON.parse(JSON.stringify(a.snapshot().stickers||a.snapshot().pieces));
function settle(a,max=1200){for(let i=0;i<max;i++){const s=a.snapshot();if(!s.animating&&s.mode==='idle'&&!a.context.PuzzleJournal.isReplaying())return;a.frame(2000);}throw Error('Journal playback did not settle');}
function word(a){return a.document.querySelectorAll('.notation-key').slice(0,3).map(b=>({face:b.dataset.face,dir:1}));}
for(const puzzle of puzzles)test(puzzle+' stop preserves legal cursor, replay remainder, branch split and seed',()=>{
 const a=createPage(puzzle),api=a.context.PUZZLE_API,J=a.context.PuzzleJournal,m=word(a);assert.equal(m.length,3);const initial=physical(a);
 api.runMoves(m,{label:'Named sequence'});settle(a);const final=physical(a);
 a.context.PuzzleAxisDisplay.setLabelMode('none');a.element('speed').value='4';a.element('speed').dispatch('input');
 a.click('undoSequence');a.frame(2000);const prefix=physical(a),cursor=J.state().cursor;assert.equal(cursor,2);a.frame(20);a.click('pause');
 assert.equal(a.snapshot().animating,false);assert.equal(a.snapshot().mode,'idle');assert.equal(a.snapshot().paused,false);assert.equal(J.isReplaying(),false);assert.equal(J.state().cursor,cursor);assert.equal(J.state().total,3);assert.deepEqual(physical(a),prefix);assert.equal(String(a.element('speed').value),'4');assert.equal(a.context.PuzzleAxisDisplay.labelMode(),'none');
 a.frame(5000);assert.deepEqual(physical(a),prefix,'no queued continuation after stop');
 a.click('redoSequence');settle(a);assert.deepEqual(physical(a),final);assert.equal(J.state().cursor,3);assert.equal(String(a.element('speed').value),'4');assert.equal(a.context.PuzzleAxisDisplay.labelMode(),'none');
 a.click('undoSequence');a.frame(2000);api.stopPlaybackNow();a.click('undoSequence');settle(a);assert.deepEqual(physical(a),initial);
 a.click('redoSequence');a.frame(2000);api.stopPlaybackNow();assert.equal(J.state().cursor,1);
 api.move(m[1]);settle(a);assert.equal(J.state().total,2);assert.equal(J.state().entries[0].name,'Named sequence · split');assert.notEqual(J.state().entries[1].sequence,J.state().entries[0].sequence);assert.equal(a.element('redo').disabled,true);
 a.click('undoSequence');settle(a);a.click('undoSequence');settle(a);assert.deepEqual(physical(a),initial,'split prefix remains a reversible named sequence');
 api.reset();api.randomize();a.frame(2000);a.frame(20);a.click('pause');assert.equal(J.state().total,1);const entry=J.state().entries[0];assert.equal(entry.seed,a.snapshot().seed);assert.match(a.element('log').textContent,/Randomize seed:/);assert(a.snapshot().journal.some(e=>e.label?.includes('Randomize seed: '+entry.seed)),'copied raw journal preserves seed');
 assert.equal(a.element('seed').closest('.action-panel'),null,'seed removed from top controls');assert.equal(a.element('pause').textContent,'Stop');
});
test('stop at chunk boundary cancels deferred replay continuation without discarding >300 future turns',()=>{
 const a=createPage('cube2'),api=a.context.PUZZLE_API,J=a.context.PuzzleJournal;J.beginSequence('Long route');api.runMoves(Array.from({length:300},()=>({face:'R',dir:1})),{label:'part 1'});settle(a);api.runMoves(['U','F'],{label:'part 2'});settle(a);J.endSequence();
 a.click('undoSequence');for(let i=0;i<300;i++)a.frame(2000);assert.equal(J.state().cursor,2);api.stopPlaybackNow();for(let i=0;i<5;i++)a.frame(2000);assert.equal(J.state().cursor,2);assert.equal(J.state().total,302);assert.equal(J.isReplaying(),false);
 a.click('undoSequence');settle(a);assert.equal(J.state().cursor,0);a.click('redoSequence');settle(a);assert.equal(J.state().cursor,302);
});
test('top Stop dispatches constrained requests to complete-step owner without truncating its playback',()=>{
 const a=createPage('cube2');let manual=0,auto=0;a.context.ConstrainedSolverUI={autoStopActive:()=>false,manualStopActive:()=>true,stop:()=>++manual};a.context.PUZZLE_API.runMoves(['R','U'],{label:'Protected stage'});a.click('pause');assert.equal(manual,1);assert.equal(a.snapshot().animating,true);
 a.context.ConstrainedSolverUI={autoStopActive:()=>true,stopAuto:()=>++auto};a.click('pause');assert.equal(auto,1);assert.equal(a.snapshot().animating,true);
});
