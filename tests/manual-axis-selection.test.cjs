'use strict';
// Execute each shipped engine and its genuine notation/keyboard routes. The
// worker is deferred so these input guards do not depend on a solver search.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createPage}=require('./solver-dom.cjs');
const games=path.join(__dirname,'../dist/games');
const ids=require('../dist/games/constrained-solver-models/manifest.json').models.map(model=>model.id);
class DeferredWorker {constructor(){this.listeners={};}postMessage(){}addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}removeEventListener(){}terminate(){}}
function host(id){return createPage(id,{globals:{Worker:DeferredWorker,fetch:async url=>{const file=path.join(games,new URL(String(url),'https://atlas.test/games/').pathname.replace(/^\/games\//,''));return {ok:fs.existsSync(file),text:async()=>fs.readFileSync(file,'utf8')};}}});}
function physical(app){const s=app.snapshot();return JSON.stringify(s.stickers||s.pieces);}
function settle(app){for(let n=0;n<500;n++){const s=app.snapshot();if(!s.animating&&s.mode==='idle')return;app.frame(2000);}throw Error('Native move did not settle');}
for(const puzzle of ids)test(puzzle+': manual actions retain their actual axis; constrained mode blocks manual moves but permits planned sequences',async()=>{
 const app=host(puzzle),api=app.context.PUZZLE_API,D=app.context.PuzzleAxisDisplay,ui=app.context.ConstrainedSolverUI;
 await app.flush();
 const notation=app.document.querySelectorAll('.notation-key');assert(notation.length>0);
 const chosen=[notation[0],notation.at(-1)];
 for(const button of chosen){
  D.clear();await app.flush();assert.equal(app.element('selectedName').textContent,'Select axis');
  const axis=button.dataset.face;button.click();assert.equal(app.snapshot().animating,true);
  settle(app);await app.flush();
  assert.equal(app.snapshot().history.at(-1).face,axis,'journal records the exact outer/inner move');
  assert.equal(D.selection(app.snapshot().selected,null),axis,'manual action remains the selected ring after the animation');
  assert.equal(app.element('viewRingSelectedName').textContent,'');
 }
 // API moves and ring-direction moves use the same legal native entry point.
 const axis=chosen[0].dataset.face;D.clear();assert.equal(api.move({face:axis,dir:1}),true);settle(app);await app.flush();
 assert.equal(D.selection(app.snapshot().selected,null),axis);
 app.click('cw');assert.equal(app.snapshot().animating,true);settle(app);await app.flush();assert.equal(D.selection(app.snapshot().selected,null),axis);
 await ui.setActive(true);for(let n=0;n<30&&ui.state().phase==='loading';n++)await app.advance(0);
 assert.equal(ui.state().active,true);assert.equal(ui.blocksManualMoves(),true);
 const before=physical(app),historyLength=app.snapshot().history.length;
 assert(notation.every(button=>button.disabled),'all 3D notation commands are disabled during constraint setup');
 for(const id of ['ccw','cw','viewRingCCW','viewRingCW'])assert.equal(app.element(id).disabled,true,id+' is disabled');
 for(const button of chosen)button.click();app.click('cw');
 assert.equal(api.move({face:axis,dir:1}),false,'programmatic manual entry respects the same guard');
 app.document.body.dispatch('keydown',{key:'ArrowRight'});app.document.body.dispatch('keydown',{key:axis});
 assert.equal(app.snapshot().animating,false);assert.equal(physical(app),before);assert.equal(app.snapshot().history.length,historyLength);
 // A validated constrained plan uses runMoves, not a simulated user click.
 assert.equal(api.runMoves([{face:axis,dir:1}],{label:'Constrained plan input guard check'}),true);
 assert.equal(app.snapshot().animating,true);settle(app);await app.flush();
 assert.notEqual(physical(app),before);assert.equal(D.selection(app.snapshot().selected,null),null,'planned animations do not leave a manual ring selected');
 await ui.setActive(false);await app.flush();assert.equal(ui.blocksManualMoves(),false);assert(notation.every(button=>!button.disabled),'notation unlocks immediately on exit');
 assert.equal(api.move({face:axis,dir:-1}),true);settle(app);await app.flush();assert.equal(D.selection(app.snapshot().selected,null),axis);
});
