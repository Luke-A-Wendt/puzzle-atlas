'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createPage}=require('./solver-dom.cjs');
const {EligibilityAnalyzer,eligibilityStatus}=require('../solver-backend/src/eligibility.cjs');
const games=path.join(__dirname,'../dist/games');
const clean=value=>JSON.parse(JSON.stringify(value));
const model=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models/cube2.json'),'utf8'));
const stored=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-caches/cube2.json'),'utf8'));
const analyzer=new EligibilityAnalyzer(model,stored);

function host(){
  const workers=[],requests=[];
  class DeferredWorker{
    constructor(){this.listeners={};this.terminated=false;workers.push(this);}
    postMessage(request){this.request=clean(request);requests.push({worker:this,request:this.request});}
    addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}
    removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(f=>f!==fn);}
    terminate(){this.terminated=true;}
    reply(data,force=false){if(this.terminated&&!force)return;const event={data};this.onmessage?.(event);for(const fn of this.listeners.message||[])fn(event);}
  }
  const app=createPage('cube2',{globals:{Worker:DeferredWorker,fetch:async url=>{
    const file=path.join(games,new URL(String(url),'https://atlas.test/games/').pathname.replace(/^\/games\//,''));
    return {ok:fs.existsSync(file),text:async()=>fs.readFileSync(file,'utf8')};
  }}});
  app.workers=workers;app.requests=requests;app.ui=()=>app.context.ConstrainedSolverUI;
  app.core=()=>app.context.ConstrainedSolverCore;app.model=model;
  app.mapping=()=>app.core().mapSnapshot(model,app.snapshot());
  app.id=node=>app.mapping().nodeToSticker[node];
  app.ready=async()=>{app.click('constrainedSolverToggle');for(let i=0;i<80&&app.ui().state().phase==='loading';i++)await app.advance(0);assert.equal(app.ui().state().phase,'selecting');};
  app.eligibilityRequest=async()=>{await app.advance(200);const request=requests.findLast(x=>x.request.task==='eligible-swaps');assert(request,'eligibility starts while selecting holds');return request;};
  app.resultFor=entry=>{
    const map=app.core().mapSnapshot(model,entry.request.snapshot);
    const result=analyzer.analyze({protected:entry.request.selection.protectedStickerIds.map(id=>map.stickerToNode[id]),occupiedNodes:map.occupiedNodes},{maxMs:5000});
    assert.equal(result.status,'complete',result.reason);
    return {id:entry.request.id,type:'result',result,modelFingerprint:app.core().modelFingerprint(model)};
  };
  app.answer=async entry=>{const payload=app.resultFor(entry);entry.worker.reply(payload);await app.advance(0);return payload.result;};
  app.selectPair=(a,b)=>{app.ui().setTool('swap');app.ui().selectNode(app.id(a));app.ui().selectNode(app.id(b));assert.deepEqual(clean(app.ui().state().pair),[app.id(a),app.id(b)]);};
  app.settleSolver=async()=>{for(let i=0;i<80;i++){await app.advance(2000);const s=app.snapshot(),u=app.ui().state();if(!s.animating&&s.mode==='idle'&&!['executing','auto-gap','solving'].includes(u.phase))return;}throw Error('Solver did not settle');};
  return app;
}

function fixture(){
  const occupied=model.initialOccupied||Array.from({length:model.degree},(_,i)=>i);
  const open=analyzer.analyze({occupiedNodes:occupied});assert.equal(open.status,'complete');
  for(const a of occupied)for(const b of occupied){
    if(eligibilityStatus(open,a,b)!==1)continue;
    const c=occupied.find(n=>n!==a&&n!==b&&eligibilityStatus(open,n,b)===1);
    const d=occupied.find(n=>![a,b,c].includes(n)&&eligibilityStatus(open,c,n)===1);
    if(c===undefined||d===undefined)continue;
    for(const hold of occupied.filter(n=>n!==a&&n!==b)){
      const limited=analyzer.analyze({protected:[hold],occupiedNodes:occupied},{maxMs:5000});
      if(limited.status==='complete'&&eligibilityStatus(limited,a,b)===2)return {a,b,c,d,hold,open,limited};
    }
  }
  throw Error('Could not find a real cube pair made incompatible by one hold');
}
const f=fixture();

test('eligibility is prepared during hold selection and A/B edits reuse the existing table immediately',async()=>{
  const app=host();await app.ready();assert.equal(app.ui().state().tool,'hold');
  app.ui().selectNode(app.id(f.hold));const entry=await app.eligibilityRequest(),result=await app.answer(entry);
  assert.deepEqual(entry.request.selection.protectedStickerIds,[app.id(f.hold)]);
  const impossible=result.candidateNodes.filter(node=>eligibilityStatus(result,node)===2).map(app.id);
  assert(impossible.length,'real held corner excludes some first nodes');
  for(const id of impossible)assert(app.ui().state().eligibility.dimmed.includes(id),'first-node restriction is visible before changing tools');
  app.ui().setTool('swap');const count=app.requests.length;
  assert.equal(app.ui().selectNode(impossible[0]),false,'proved-impossible first node rejects immediately');
  const a=result.candidateNodes.find(node=>eligibilityStatus(result,node)===1);assert.notEqual(a,undefined);
  app.ui().selectNode(app.id(a));assert.equal(app.ui().state().pairTarget,1);
  const blocked=result.candidateNodes.filter(node=>node!==a&&eligibilityStatus(result,a,node)===2).map(app.id);
  assert(blocked.length);for(const id of blocked)assert(app.ui().state().eligibility.dimmed.includes(id),'B filtering updates synchronously');
  assert.equal(app.ui().selectNode(blocked[0]),false);assert.equal(app.requests.length,count,'choosing A reuses the pair table');
  const b=result.candidateNodes.find(node=>node!==a&&eligibilityStatus(result,a,node)===1);
  assert.equal(app.ui().selectNode(app.id(b)),true);await app.advance(0);
  app.click('csPairA');await app.advance(0);
  assert.deepEqual(clean(app.ui().state().pair),[]);
  assert.deepEqual(clean(app.ui().state().held),[app.id(f.hold)],'restarting the pair preserves holds');
  assert(app.ui().state().anchors.every(anchor=>anchor.id===app.id(f.hold)),'old A/B background markers are cleared');
  for(const id of impossible)assert(app.ui().state().eligibility.dimmed.includes(id),'hold-based restrictions still apply');
  assert.equal(app.snapshot().history.length,0);
});

test('choosing A again clears both endpoints and immediately releases the old B restriction',async()=>{
  const app=host();await app.ready();await app.answer(await app.eligibilityRequest());app.selectPair(f.a,f.b);
  const requests=app.requests.length;
  const newA=f.open.candidateNodes.find(node=>![f.a,f.b].includes(node)&&eligibilityStatus(f.open,node,f.b)===2&&eligibilityStatus(f.open,node)===1);
  assert.notEqual(newA,undefined);
  app.click('csPairA');assert.equal(app.ui().state().pairTarget,0);assert.deepEqual(clean(app.ui().state().pair),[]);
  assert(!app.ui().state().eligibility.dimmed.includes(app.id(newA)),'old B no longer excludes a valid first choice');
  assert.equal(app.element('csGo').disabled,true);
  assert.equal(app.ui().selectNode(app.id(newA)),true);assert.deepEqual(clean(app.ui().state().pair),[app.id(newA)]);
  assert.equal(app.ui().state().pairTarget,1);assert.equal(app.element('csGo').disabled,true);
  const newB=f.open.candidateNodes.find(node=>node!==newA&&eligibilityStatus(f.open,newA,node)===1);
  assert.equal(app.ui().selectNode(app.id(newB)),true);assert.equal(app.element('csGo').disabled,false);
  app.click('csPairB');assert.equal(app.ui().state().pairTarget,1);
  assert.deepEqual(clean(app.ui().state().pair),[app.id(newA),app.id(newB)],'editing B keeps A');
  assert.equal(app.requests.length,requests,'endpoint editing reuses the eligibility table');
  assert.equal(app.snapshot().history.length,0,'selection alone never executes');
});

test('holding A clears both endpoints and returns to choosing A with only hold restrictions',async()=>{
  const app=host();await app.ready();app.selectPair(f.a,f.b);app.ui().setTool('hold');app.ui().selectNode(app.id(f.a));
  assert.deepEqual(clean(app.ui().state().pair),[]);assert(app.ui().state().held.includes(app.id(f.a)));
  assert.match(app.element('csPairB').textContent,/Choose a node/);
  assert.equal(app.element('csGo').disabled,true);app.ui().setTool('swap');assert.equal(app.ui().state().pairTarget,0);
  app.ui().setTool('release');app.ui().selectNode(app.id(f.a));app.ui().setTool('swap');app.ui().selectNode(app.id(f.a));
  assert.deepEqual(clean(app.ui().state().pair),[app.id(f.a)],'refilling A starts a fresh pair');
});

test('changed holds revalidate the retained pair and both disabled Go and public Go reject a proved-impossible request',async()=>{
  const app=host();await app.ready();await app.answer(await app.eligibilityRequest());app.selectPair(f.a,f.b);
  assert.equal(app.element('csGo').disabled,false);app.ui().setTool('hold');app.ui().selectNode(app.id(f.hold));
  assert.deepEqual(clean(app.ui().state().pair),[app.id(f.a),app.id(f.b)]);
  const entry=await app.eligibilityRequest();await app.answer(entry);
  assert.equal(app.element('csGo').disabled,true,'a retained pair is rechecked when its holds change');
  const before=app.requests.length;app.ui().go();assert.equal(app.ui().state().phase,'selecting');assert.equal(app.requests.length,before,'public Go does not bypass proved impossibility');
  assert.equal(app.snapshot().history.length,0);
  app.ui().setTool('release');app.ui().selectNode(app.id(f.hold));await app.advance(200);
  const latest=app.requests.findLast(x=>x.request.task==='eligible-swaps');if(latest!==entry)await app.answer(latest);
  assert.equal(app.element('csGo').disabled,false,'removing the hold restores the already selected pair');
  assert.deepEqual(clean(app.ui().state().pair),[app.id(f.a),app.id(f.b)]);
});

test('Clear all immediately drops hold and endpoint restrictions and rejects late old tables',async()=>{
  const app=host();await app.ready();const open=await app.eligibilityRequest();await app.answer(open);
  app.selectPair(f.a,f.b);app.ui().setTool('hold');app.ui().selectNode(app.id(f.hold));
  const pending=await app.eligibilityRequest(),stale=app.resultFor(pending);await app.answer(pending);
  assert(app.ui().state().eligibility.dimmed.length);
  app.click('csClear');
  assert.deepEqual(clean(app.ui().state().held),[]);assert.deepEqual(clean(app.ui().state().pair),[]);
  assert.equal(app.ui().state().pairTarget,0);assert.deepEqual(clean(app.ui().state().eligibility.dimmed),[]);
  pending.worker.reply(stale,true);await app.advance(0);
  assert.deepEqual(clean(app.ui().state().eligibility.dimmed),[]);
  app.ui().setTool('swap');assert.equal(app.ui().selectNode(app.id(f.a)),true);
});

test('a late table for removed holds cannot dim or disable the current pair',async()=>{
  const app=host();await app.ready();await app.answer(await app.eligibilityRequest());app.selectPair(f.a,f.b);
  app.ui().setTool('hold');app.ui().selectNode(app.id(f.hold));const stale=await app.eligibilityRequest(),payload=app.resultFor(stale);
  assert.equal(eligibilityStatus(payload.result,f.a,f.b),2);
  app.ui().setTool('release');app.ui().selectNode(app.id(f.hold));await app.advance(200);
  const current=app.requests.findLast(x=>x.request.task==='eligible-swaps');if(current!==stale)await app.answer(current);
  const before=clean(app.ui().state().eligibility);assert.equal(app.element('csGo').disabled,false);
  stale.worker.reply(payload,true);await app.advance(0);
  assert.deepEqual(clean(app.ui().state().eligibility),before);assert.equal(app.element('csGo').disabled,false);
  assert.deepEqual(clean(app.ui().state().pair),[app.id(f.a),app.id(f.b)]);assert.equal(app.snapshot().history.length,0);
});

test('unknown feasibility does not block full checking or falsely dim candidates',async()=>{
  const app=host();await app.ready();const entry=await app.eligibilityRequest();
  entry.worker.reply({id:entry.request.id,type:'result',result:{status:'unknown',reason:'time_limit'},modelFingerprint:app.core().modelFingerprint(model)});await app.advance(0);
  assert.deepEqual(clean(app.ui().state().eligibility.dimmed),[]);app.selectPair(f.a,f.b);assert.equal(app.element('csGo').disabled,false);
  app.click('csGo');assert.equal(app.ui().state().phase,'solving');assert(app.requests.some(x=>!x.request.task),'unknown feasibility delegates to the full solver');
});

test('the visible mode switch is explicit, solver selection is idempotent, and normal mode clears solver state',async()=>{
  const app=host(),normal=app.element('ringModeDefault'),solver=app.element('constrainedSolverToggle');
  assert(normal&&solver);assert.equal(normal.getAttribute('aria-pressed'),'true');assert.equal(solver.getAttribute('aria-pressed'),'false');
  await app.ready();assert.equal(normal.getAttribute('aria-pressed'),'false');assert.equal(solver.getAttribute('aria-pressed'),'true');
  app.ui().selectNode(app.id(f.hold));app.click('constrainedSolverToggle');assert.equal(app.ui().state().active,true);assert.deepEqual(clean(app.ui().state().held),[app.id(f.hold)],'choosing the current mode is not a destructive toggle');
  app.click('ringModeDefault');assert.equal(app.ui().state().active,false);assert.equal(normal.getAttribute('aria-pressed'),'true');assert.equal(solver.getAttribute('aria-pressed'),'false');
  assert.equal(app.element('csNodeOverlay').hidden,true);assert.deepEqual(clean(app.ui().state().held),[]);
  app.click('cw');await app.settle();assert.equal(app.snapshot().history.length,1,'ordinary ring rotation works after leaving solver mode');
});

test('normal mode requested during a manual sequence waits for restored holds and then exits',async()=>{
  const app=host();await app.ready();let one;
  for(let move=0;move<model.moves.length&&!one;move++){const p=model.moves[move].perm;for(let a=0;a<model.degree;a++){const b=p[a],held=p.findIndex((v,i)=>v===i);if(a!==b&&p[b]===a&&held>=0){one={move,a,b,held};break;}}}
  assert(one);app.ui().selectNode(app.id(one.held));app.selectPair(one.a,one.b);app.click('csGo');
  const entry=app.requests.findLast(x=>!x.request.task);assert(entry);const indices=[0,model.moves[0].inverse,one.move],before=app.mapping();
  entry.worker.reply({id:entry.request.id,type:'result',result:{status:'solved',moveIndices:indices,optimal:false},modelFingerprint:app.core().modelFingerprint(model)});await app.advance(0);
  assert.equal(app.ui().state().phase,'executing');app.click('ringModeDefault');assert.equal(app.ui().state().active,true,'a manual step finishes before leaving');
  await app.settleSolver();assert.equal(app.ui().state().active,false);assert.equal(app.snapshot().history.length,indices.length,'the full verified sequence executes');
  const after=app.mapping();assert.equal(after.stickerToNode[before.nodeToSticker[one.held]],one.held);assert.equal(after.stickerToNode[before.nodeToSticker[one.a]],one.b);assert.equal(after.stickerToNode[before.nodeToSticker[one.b]],one.a);
  assert.equal(app.element('ringModeDefault').getAttribute('aria-pressed'),'true');
});

test('normal mode cancels Auto Solve planning and keeps stale plans from entering playback',async()=>{
  const app=host();app.context.PUZZLE_API.move('R');await app.settle();app.click('solve');
  for(let i=0;i<80&&!app.requests.some(x=>x.request.task==='full-solve');i++)await app.advance(0);
  const entry=app.requests.findLast(x=>x.request.task==='full-solve');assert(entry);app.click('ringModeDefault');
  assert.equal(app.ui().state().active,false);assert.equal(app.element('ringModeDefault').getAttribute('aria-pressed'),'true');assert.equal(app.element('speedText').textContent,'Normal');
  entry.worker.reply({id:entry.request.id,type:'result',result:{status:'unknown',reason:'late_reply'}},true);await app.advance(0);
  assert.equal(app.ui().state().active,false);assert.equal(app.snapshot().history.length,1);
});
