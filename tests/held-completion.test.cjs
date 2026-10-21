'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createPage}=require('./solver-dom.cjs');
const {fixturePlan}=require('./auto-holds-plan-fixture.cjs');
const {createCascade,measure,px}=require('./css-budget-helper.cjs');
const games=path.join(__dirname,'../dist/games');
function host(id='cube2'){
 const workers=[];class Worker{constructor(){workers.push(this);}postMessage(request){this.request=request;}terminate(){this.terminated=true;}addEventListener(){}removeEventListener(){}}
 const app=createPage(id,{globals:{Worker,fetch:async url=>{const file=path.join(games,new URL(String(url),'https://atlas.test/games/').pathname.replace(/^\/games\//,''));return {ok:fs.existsSync(file),text:async()=>fs.readFileSync(file,'utf8')};}}});
 app.model=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models',id+'.json')));app.ui=app.context.ConstrainedSolverUI;app.core=app.context.ConstrainedSolverCore;app.workers=workers;
 app.ready=async()=>{await app.ui.setActive(true);await app.advance(0);assert.equal(app.ui.state().phase,'selecting');};
 app.percent=()=>app.element('csCompletionValue').textContent;
 return app;
}
test('completion counts all correct goals, including same-color replacements, independently of holds',async()=>{
 const app=host();app.context.PUZZLE_API.runMoves(['U2']);await app.settle();await app.ready();
 const snapshot=app.snapshot(),map=app.core.mapSnapshot(app.model,snapshot),goals=new Map(Object.entries(app.model.homeBySticker).map(([id,n])=>[n,app.model.colorBySticker[id]]));
 const ids=Object.keys(map.stickerToNode),correct=ids.filter(id=>app.model.colorBySticker[id]===goals.get(map.stickerToNode[id])),wrong=ids.find(id=>!correct.includes(id));
 const replacement=correct.find(id=>map.stickerToNode[id]!==app.model.homeBySticker[id]);assert(replacement);assert(wrong);
 const expected=Math.floor(100*correct.length/ids.length)+'%';assert.equal(app.percent(),expected);assert.notEqual(expected,'0%');assert.notEqual(expected,'100%');
 app.ui.selectNode(wrong);assert.equal(app.percent(),expected);
 app.ui.selectNode(replacement);assert.equal(app.percent(),expected);
 assert.match(app.element('csCompletion').getAttribute('aria-label'),new RegExp(correct.length+' of 24 nodes matching the goal'));
 app.ui.selectNode(replacement);assert.equal(app.percent(),expected);app.ui.clearSelection();assert.equal(app.percent(),expected);app.click('csSwap');assert.equal(app.percent(),expected);app.click('csHold');assert.equal(app.percent(),expected);
});
test('guided completion remains steady through turns and updates at each completed checkpoint',async()=>{
 const app=host();app.context.PUZZLE_API.runMoves(['U','D']);await app.settle();await app.ready();const plan=fixturePlan(app.model,app.snapshot(),[["R","R'","U'"],["D'"]]);const beforeAuto=app.percent();
 app.click('csSuggestHolds');await app.advance(100);const worker=app.workers.findLast(w=>w.request?.task==='auto-holds-plan');assert(worker);
 worker.onmessage({data:{id:worker.request.id,type:'result',modelFingerprint:app.core.modelFingerprint(app.model),result:plan}});await app.advance(0);
 assert.equal(app.percent(),beforeAuto,'Auto and Select use the same goal-match count');let before=app.percent();
 for(let step=0;step<plan.stages.length;step++){
  app.ui.selectNode(app.ui.state().eligibility.goalImproving[0]);app.ui.selectNode(app.ui.state().eligibility.goalImproving[0]);
  assert.equal(app.percent(),before);
  for(let frame=0;frame<1000;frame++){
   await app.advance(40);
   if(app.ui.state().phase==='selecting')break;
   assert.equal(app.percent(),before,'intermediate turns must not change completion');
  }
  assert.equal(app.ui.state().phase,'selecting');const progress=app.core.solvedProgress(app.model,app.snapshot()),expected=Math.floor(progress.solvedCount*100/progress.totalCount)+'%';assert.equal(app.percent(),expected);assert(parseInt(app.percent())>parseInt(before));before=app.percent();
 }
 assert.equal(app.percent(),'100%');assert.equal(app.ui.state().autoHold,true);app.click('csHold');assert.equal(app.percent(),'100%','switching back to Select leaves the value unchanged');
});
test('Auto Solve uses all initial goal matches before its first move',async()=>{
 const app=host();app.context.PUZZLE_API.runMoves(['R','U']);await app.settle();await app.ready();const plan=fixturePlan(app.model,app.snapshot(),[["U'"],["R'"]]);assert(plan.initialProtectedNodes.length>0);const expected=Math.floor(app.core.solvedProgress(app.model,app.snapshot()).solvedCount*100/app.model.stickerCount)+'%';
 await app.ui.autoSolve();const worker=app.workers.findLast(w=>w.request?.task==='full-solve');assert(worker);
 worker.onmessage({data:{id:worker.request.id,type:'result',modelFingerprint:app.core.modelFingerprint(app.model),result:plan}});
 assert.equal(app.percent(),expected);assert.equal(app.ui.state().phase,'executing');
});
for(const id of ['ghost','pyramorphix','cube10'])test(id+' counts correct unheld physical tiles, not hypothetical shape poses',async()=>{
 const app=host(id);await app.ready();assert.equal(app.percent(),'100%');
 const tile=app.context.PUZZLE_SOLVER_BRIDGE.nodes()[0];app.ui.selectNode(tile.stickerId);
 assert.equal(app.percent(),'100%');assert.match(app.element('csCompletion').getAttribute('aria-label'),new RegExp(app.model.stickerCount+' of '+app.model.stickerCount+' nodes'));app.ui.clearSelection();assert.equal(app.percent(),'100%');
});
test('completion floats at the map top-right without blocking gestures or adding layout rows',async()=>{
 const app=host();await app.ready();
 for(const [width,panel]of [[320,304],[360,344],[412,396],[1280,600]]){
  const style=createCascade(app,'cube2',width,panel),readout=app.element('csCompletion'),value=app.element('csCompletionValue'),caption=readout.querySelector('.cs-completion-caption');
  assert.equal(readout.parentElement,app.element('rings').parentElement);assert.equal(style(readout).position,'absolute');assert.equal(style(readout).top,'10px');assert.equal(style(readout).right,'10px');assert.equal(style(readout)['pointer-events'],'none');assert.equal(style(readout).background,'transparent','no separate tinted background');assert.equal(style(readout)['white-space'],'nowrap');
  assert.equal(style(app.element('constrainedSolverControls').querySelector('.cs-feedback'))['grid-template-rows'],'30px','no extra row or play-space loss');
  assert(measure('100%',style(value))<=px(style(readout),'width')-16);assert.equal(caption,null);
  assert(px(style(value),'line-height')<=30);assert(px(style(value),'font-size')>=24);assert(px(style(value),'font-weight')>=700);
 }
 assert.equal(app.element('csCompletion').hidden,false);app.ui.closePanel();assert.equal(app.element('csCompletion').hidden,true,'readout is exclusive to constrained mode');
});
