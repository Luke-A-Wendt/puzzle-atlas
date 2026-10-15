'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createPage}=require('./solver-dom.cjs');
const puzzles=fs.readdirSync(path.join(__dirname,'../dist/games')).filter(f=>f.endsWith('.html')&&fs.readFileSync(path.join(__dirname,'../dist/games',f),'utf8').includes('id="undo"')).map(f=>f.slice(0,-5));
const clean=x=>JSON.parse(JSON.stringify(x));
function physical(app){const s=app.snapshot();return clean(s.stickers||s.pieces);}
function settle(app,max=2500){for(let i=0;i<max;i++){const s=app.snapshot();if(!s.animating&&s.mode==='idle'&&!app.context.PuzzleJournal.state().replaying)return;app.frame(2000);}throw Error('Journal did not finish');}
function moves(app){const s=app.context.PUZZLE_SOLVER_BRIDGE.nodes(),configs=app.context.PUZZLE_SOLVER_BRIDGE.axes?.()||[];return [app.snapshot().selected,app.document.querySelectorAll('.notation-key').map(b=>b.dataset.face).find(f=>f!==app.snapshot().selected)].filter(Boolean).map(face=>({face,dir:1}));}
for(const puzzle of puzzles)test(puzzle+' journal restores exact state with move and sequence undo/redo',()=>{
 const app=createPage(puzzle),api=app.context.PUZZLE_API,J=app.context.PuzzleJournal,initial=physical(app),word=moves(app);assert(word.length>=2,puzzle+' has turns');
 assert.equal(J.state().cursor,0);assert.equal(app.element('undo').disabled,true);assert.equal(app.element('redo').disabled,true);
 assert(api.runMoves([...word,word[0]],{label:'First sequence'}));assert.equal(app.element('undo').disabled,true);settle(app);const afterFirst=physical(app);
 assert.equal(J.state().total,3);assert.equal(app.snapshot().history.length,3);
 api.move(word[1]);settle(app);const afterSingle=physical(app);assert.equal(J.state().total,4);
 app.click('undo');assert.match(app.element('journalActivity').textContent,/Undoing Move/);settle(app);assert.deepEqual(physical(app),afterFirst);assert.equal(J.state().cursor,3);assert.equal(J.state().total,4);assert.equal(app.snapshot().history.length,3);
 app.click('redo');settle(app);assert.deepEqual(physical(app),afterSingle);assert.equal(J.state().cursor,4);assert.equal(app.snapshot().history.length,4);
 app.click('undoSequence');settle(app);assert.deepEqual(physical(app),afterFirst);app.click('undoSequence');settle(app);assert.deepEqual(physical(app),initial);assert.equal(app.snapshot().history.length,0);assert.equal(J.state().cursor,0);
 app.click('redoSequence');settle(app);assert.deepEqual(physical(app),afterFirst);assert.equal(J.state().cursor,3);app.click('redoSequence');settle(app);assert.deepEqual(physical(app),afterSingle);assert.equal(J.state().cursor,4);
 // A new legal turn after undo creates a branch and discards only the future.
 app.click('undo');settle(app);api.move(word[0]);settle(app);assert.equal(J.state().cursor,4);assert.equal(J.state().total,4);assert.equal(app.element('redo').disabled,true);assert.equal(app.snapshot().journal.filter(j=>j.move).length,4);
 api.reset();assert.equal(J.state().cursor,0);assert.equal(J.state().total,0);assert.equal(app.element('redoSequence').disabled,true);assert.deepEqual(physical(app),initial);
});
test('explicit solver transaction remains one sequence across native 300-move chunks',()=>{
 const app=createPage('cube2'),api=app.context.PUZZLE_API,J=app.context.PuzzleJournal,initial=physical(app);
 J.beginSequence('Auto Solve · step 7');api.runMoves(Array.from({length:300},()=>({face:'R',dir:1})),{label:'chunk one'});settle(app);api.runMoves([{face:'U',dir:1},{face:'F',dir:1}],{label:'chunk two'});settle(app);J.endSequence();const final=physical(app);
 assert.equal(new Set(J.state().entries.map(e=>e.sequence)).size,1);assert.equal(J.state().total,302);
 assert(J.navigate(-1,true));settle(app);assert.equal(J.state().cursor,0);assert.deepEqual(physical(app),initial);assert.equal(app.snapshot().history.length,0);
 assert(J.navigate(1,true));settle(app);assert.equal(J.state().cursor,302);assert.deepEqual(physical(app),final);assert.equal(app.snapshot().history.length,302);
});
test('scramble stop preserves committed prefix as one reversible sequence and locks transport while busy',()=>{
 const app=createPage('cube2'),api=app.context.PUZZLE_API,J=app.context.PuzzleJournal,initial=physical(app);
 api.randomize();assert.equal(J.navigate(-1,true),false);assert.equal(app.element('redo').disabled,true);
 for(let i=0;i<7;i++)app.frame(2000);api.stopScrambleNow();const done=J.state().cursor;assert(done>0);assert.equal(new Set(J.state().entries.map(e=>e.sequence)).size,1);const partial=physical(app);
 app.click('undoSequence');settle(app);assert.deepEqual(physical(app),initial);app.click('redoSequence');settle(app);assert.deepEqual(physical(app),partial);
});
test('solver planning and between-stage gaps lock every journal control',()=>{
 const app=createPage('cube2'),api=app.context.PUZZLE_API,J=app.context.PuzzleJournal;
 api.move('R');settle(app);app.context.ConstrainedSolverUI={journalBusy:()=>true};J.sync();
 for(const id of ['undo','undoSequence','redo','redoSequence'])assert.equal(app.element(id).disabled,true,id);
 assert.equal(J.navigate(-1,false),false);assert.equal(J.state().cursor,1);
 app.context.ConstrainedSolverUI={journalBusy:()=>false};J.sync();assert.equal(app.element('undo').disabled,false);
});
test('reset during playback cancels future continuation and clears journal',()=>{
 const app=createPage('cube2'),api=app.context.PUZZLE_API,J=app.context.PuzzleJournal,initial=physical(app);
 api.runMoves(['R','U','F'],{label:'Trial'});settle(app);app.click('undoSequence');app.frame(2000);api.reset();for(let i=0;i<20;i++)app.frame(2000);
 assert.deepEqual(physical(app),initial);assert.equal(J.state().total,0);assert.equal(J.state().replaying,false);
});
test('closing a solver transaction before its last legal turn settles preserves that partial sequence',()=>{
 const app=createPage('cube2'),api=app.context.PUZZLE_API,J=app.context.PuzzleJournal,initial=physical(app);
 J.beginSequence('Constrained swap');api.runMoves(['R','U','F'],{label:'Constrained swap'});app.frame(2000);api.stopAfterCurrentMove();J.endSequence();settle(app);
 assert.equal(new Set(J.state().entries.map(e=>e.sequence)).size,1);assert(J.state().total>=1);assert(J.state().total<3);
 app.click('undoSequence');settle(app);assert.deepEqual(physical(app),initial);
});
