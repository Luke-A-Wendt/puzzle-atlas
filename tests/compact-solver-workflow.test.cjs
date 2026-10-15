'use strict';
// Cross-feature integration: actual game scripts and event handlers, deterministic
// DOM/clock host. These are not assertions about physical browser rendering.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createPage}=require('./solver-dom.cjs');
const {createCascade}=require('./css-budget-helper.cjs');
const games=path.resolve(__dirname,'../dist/games');
const puzzles=require('../dist/games/constrained-solver-models/manifest.json').models.map(m=>m.id);
const plain=x=>JSON.parse(JSON.stringify(x));
function host(id){
 const workers=[];
 class DeferredWorker {
  constructor(){this.listeners={};workers.push(this);}
  postMessage(value){this.request=plain(value);}
  addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}
  removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(f=>f!==fn);}
  terminate(){this.terminated=true;}
 }
 const app=createPage(id,{globals:{Worker:DeferredWorker,fetch:async url=>{
  const file=path.join(games,new URL(String(url),'https://atlas.test/games/').pathname.replace(/^\/games\//,''));
  return{ok:fs.existsSync(file),text:async()=>fs.readFileSync(file,'utf8')};
 }}});app.workers=workers;return app;
}
for(const puzzle of puzzles)test(puzzle+': 3D-only axis controls retain constrained search, cancellation and native turn behavior',async()=>{
 const app=host(puzzle),D=app.context.PuzzleAxisDisplay,ui=app.context.ConstrainedSolverUI;
 await app.flush();
 const canvas=app.element('cube').parentElement,metrics=app.document.querySelector('.cube-bottom'),top=app.document.querySelector('.cube-top');
 const mobileStyle=createCascade(app,puzzle,360);
 const retired=app.element('selector').closest('.ring-controls');
 assert.equal(retired.hidden,true);assert.equal(retired.inert,true);assert.equal(retired.getAttribute('aria-hidden'),'true');assert.equal(mobileStyle(retired).display,'none');
 assert.equal(app.element('viewRingControls').hidden,false);assert.equal(app.element('viewRingControls').inert,false);
 assert.deepEqual(app.element('viewDisplayTools').children.filter(el=>el.nodeType!==3).map(el=>el.id),['viewLabelMode','viewHighlightToggle'],'the visible settings group contains only labels and highlights');
 for(const id of ['homeView','faceView']){
  const legacy=app.element(id);if(!legacy)continue;
  assert.equal(legacy.hidden,true,id+' cannot occupy a header slot');assert.equal(legacy.disabled,true,id+' cannot dispatch a retained native handler');
  assert.equal(legacy.getAttribute('aria-hidden'),'true');assert.equal(legacy.tabIndex,-1,id+' is outside keyboard navigation');assert.equal(mobileStyle(legacy).display,'none',id+' stays hidden under mobile CSS');
 }
 assert.equal(mobileStyle(app.element('viewLabelMode'))['white-space'],'nowrap');assert.equal(mobileStyle(app.element('viewHighlightToggle'))['white-space'],'nowrap');
 for(const button of top.querySelectorAll('button').filter(button=>!button.hidden&&mobileStyle(button).display!=='none'))assert.doesNotMatch(button.textContent,/View axis|Reset view/,'no visible camera placeholder remains');
 assert.equal(app.element('viewActionsToggle'),null,'retired action disclosure is not presented');
 assert.equal(app.element('viewAxisTurns'),null,'retired square turn group is not presented');
 assert.equal(app.document.querySelector('.cube-top').nextSibling,canvas,'the header directly precedes the 3D canvas without a metrics row');
 assert.equal(metrics.hidden,true,'native counter elements remain inert for engine compatibility');assert.equal(metrics.getAttribute('aria-hidden'),'true');
 assert.equal(app.document.querySelector('.view-metrics'),null,'no relocated metrics strip remains');assert.equal(app.element('playTimer'),null);assert.equal(app.element('playSolvedReadout'),null);
 assert.equal(app.element('selectedName').textContent,'Select axis');assert.equal(app.element('viewRingSelectedName').textContent,'Select axis');
 const before=plain(app.snapshot()),history=before.history.length;
 for(const id of ['ccw','cw','viewRingCCW','viewRingCW']){assert.equal(app.element(id).disabled,true,'no axis means no turn');app.click(id);}
 assert.equal(app.snapshot().history.length,history);
 await ui.setActive(true);for(let n=0;n<80&&ui.state().phase==='loading';n++)await app.advance(0);
 assert.equal(ui.state().phase,'selecting');assert.equal(D.labelMode(),'all');assert.equal(app.element('viewLabelMode').textContent,'No labels');
 assert.equal(D.highlights3D(),true,'manual mode exposes selection borders even on Homer');assert.equal(String(app.element('playbackSpeed').value),'1');
 const moveButtons=app.document.querySelectorAll('.notation-key');assert(moveButtons.length>0);
 for(const button of moveButtons){assert.equal(button.disabled,true,button.textContent+' disabled during selection');button.click();}
 for(const id of ['ccw','cw','viewRingCCW','viewRingCW']){assert.equal(app.element(id).disabled,true);app.click(id);}
 assert.equal(app.snapshot().history.length,history);assert.equal(app.snapshot().animating,false);
 const available=app.context.PUZZLE_SOLVER_BRIDGE.nodes().filter(n=>n.stickerId!=null);
 assert(available.length>1);ui.setTool('swap');assert.equal(ui.selectNode(available[0].stickerId),true);assert.equal(ui.selectNode(available[1].stickerId),true);
 assert.equal(app.element('csGo').textContent,'Go');assert.equal(app.element('csGo').disabled,false);
 app.click('csGo');for(let n=0;n<10&&ui.state().phase!=='solving';n++)await app.advance(0);
 assert.equal(ui.state().phase,'solving');assert.equal(app.element('csGo').textContent,'Go','unchecked pair does not rename the action');
 assert(app.workers.some(w=>w.request?.task==='manual-swap'),'Go dispatches a search for the unknown pair');
 for(const button of moveButtons)assert.equal(button.disabled,true,'search continues blocking native notation');
 for(const id of ['ccw','cw','viewRingCCW','viewRingCW'])assert.equal(app.element(id).disabled,true,'search continues blocking visible turns and their native handlers');
 assert.equal(app.snapshot().history.length,history,'planning cannot move the puzzle');
 app.click('pause');assert.equal(ui.state().phase,'selecting');assert.equal(ui.state().active,true);
 assert.equal(D.labelMode(),'all','canceling the check leaves setup labels visible');assert.equal(D.highlights3D(),true);
 await ui.setActive(false);await app.advance(0);
 assert.equal(ui.state().active,false);assert.equal(D.labelMode(),'some');assert.equal(app.element('viewLabelMode').textContent,'All labels');assert.equal(String(app.element('playbackSpeed').value),'3');
 assert.equal(D.highlights3D(),puzzle!=='homer','ordinary highlight default restored');
 const selector=app.element('viewRingSelector'),first=selector.querySelectorAll('button').find(button=>!button.disabled);assert(first,'exiting restores 3D axis selection');
 first.click();await app.advance(0);
 const selected=app.snapshot().selected;
 assert.equal(app.element('viewRingSelectedName').textContent,app.element('selectedName').textContent,'3D selection synchronizes both captions');
 assert.equal(app.element('viewRingCW').disabled,false,'a chosen axis restores its turn action');
 app.click('viewRingCW');assert.equal(app.snapshot().animating,true,'3D duplicated ring action works again');
 await app.settle();assert.equal(app.snapshot().selected,selected,'the completed 3D turn preserves its actual axis');
 assert.equal(app.snapshot().history.length,history+1);
});

test('Helicopter retains advanced alignment controls without the removed conventional disclosure',async()=>{
 const app=host('helicopter');await app.flush();
 const advanced=app.element('jumbleControls');assert.equal(app.element('viewActionsToggle'),null);assert.equal(advanced.hidden,true);
 app.click('advanced');await app.advance(0);assert.equal(advanced.hidden,false,'advanced controls retain their own native visibility');
 assert.notEqual(createCascade(app,'helicopter',360)(advanced).display,'none','the advanced panel is not hidden by retired-notation CSS');
 assert.equal(app.element('mirrorMode').hidden,false,'advanced mirror choice remains available');
 assert.equal(app.element('viewRingSelector').querySelectorAll('button').length,app.element('selector').querySelectorAll('button').length,'advanced mode retains the mirrored axis vocabulary');
 app.click('advanced');await app.advance(0);assert.equal(advanced.hidden,true);assert.equal(app.element('mirrorMode').hidden,true);
});

for(const puzzle of ['mirror','ghost','mastermorphix','pyramorphix'])test(puzzle+': mirror settings keep the 3D turn panel available without reviving removed ring controls',async()=>{
 const app=host(puzzle);await app.flush();const mirror=app.element('mirrorMode'),before=plain(app.snapshot().stickers||app.snapshot().pieces),top=app.document.querySelector('.cube-top');
 assert.equal(mirror.hidden,false);assert.equal(mirror.parentElement,top);assert.ok(top.children.indexOf(mirror)<top.children.indexOf(app.element('viewDisplayTools')),'mirror remains before general settings');
 for(const enabled of [true,false]){
  app.click('mirrorMode');await app.flush();assert.equal(mirror.getAttribute('aria-pressed'),String(enabled));assert.deepEqual(plain(app.snapshot().stickers||app.snapshot().pieces),before,'changing presentation preserves the puzzle state');
  assert.equal(app.element('ringPanel').hidden,false);assert.equal(app.element('viewRingSelector').querySelectorAll('button').length,app.element('selector').querySelectorAll('button').length);
  assert.equal(app.element('selector').closest('.ring-controls').hidden,true);assert.equal(app.element('selector').closest('.ring-controls').inert,true);assert.equal(app.element('viewRingControls').hidden,false);
  for(const id of ['homeView','faceView'])if(app.element(id)){assert.equal(app.element(id).hidden,true);assert.equal(app.element(id).disabled,true);}
 }
});
