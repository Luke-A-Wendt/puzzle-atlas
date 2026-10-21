'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createPage}=require('./solver-dom.cjs');
const {offerVerifiedSwap}=require('./verified-swap-fixture.cjs');
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

const move=model.moves.findIndex(m=>m.name==='U2'),p=model.moves[move].perm;
const a=model.nodes.find(n=>n.face!=='U'&&p[n.index]!==n.index&&p[p[n.index]]===n.index).index;
const f={move,a,b:p[a],hold:p.findIndex((v,i)=>v===i)};
const offer=app=>offerVerifiedSwap(app,model,f.a,f.b,[f.move]);

test('feasibility-only tables never advertise a selectable first node without a verified word',async()=>{
 const app=host();await app.ready();app.ui().selectNode(app.id(f.hold));const entry=await app.eligibilityRequest();await app.answer(entry);
 assert.deepEqual(entry.request.selection.protectedStickerIds,[app.id(f.hold)]);
 app.ui().setTool('swap');for(const node of app.mapping().occupiedNodes)assert.equal(app.ui().selectNode(app.id(node)),false);
 assert.equal(app.requests.filter(x=>x.request.task==='manual-swap').length,0);assert.equal(app.snapshot().history.length,0);
 app.ui().setTool('hold');assert.equal(app.ui().selectNode(app.id(f.hold)),true,'hold tool stays usable');
});

test('first-node editing clears old endpoint restrictions and verified endpoint two starts automatically',async()=>{
 const app=host();await app.ready();await offer(app);app.ui().setTool('swap');assert.equal(app.ui().selectNode(app.id(f.a)),true);
 const count=app.requests.length;app.click('csPairA');assert.deepEqual(clean(app.ui().state().pair),[]);assert.equal(app.ui().state().pairTarget,0);
 assert.equal(app.ui().selectNode(app.id(f.b)),true);assert.equal(app.ui().selectNode(app.id(f.a)),true);
 assert.equal(app.ui().state().phase,'solving');assert.equal(app.requests.length,count,'stored word needs no manual search');
 await app.advance(0);assert.equal(app.ui().state().phase,'executing');assert.equal(app.snapshot().history.length,0,'preview pause precedes animation');assert.equal(app.element('csGo'),null);
});

test('holding a selected endpoint waives only that endpoint and clears its exemption when edited',async()=>{
 const app=host();await app.ready();await offer(app);app.ui().setTool('swap');app.ui().selectNode(app.id(f.a));app.ui().setTool('hold');app.ui().selectNode(app.id(f.a));
 assert.deepEqual(clean(app.ui().state().pair),[app.id(f.a)]);assert.deepEqual(clean(app.ui().state().effectiveHeld),[]);
 app.click('csPairA');assert.deepEqual(clean(app.ui().state().pair),[]);assert.deepEqual(clean(app.ui().state().effectiveHeld),[app.id(f.a)]);
 await offer(app);assert.equal(app.ui().selectNode(app.id(f.a)),true,'held endpoint remains selectable once verified');
});

test('changed holds invalidate readiness immediately and reject stale eligibility replies',async()=>{
 const app=host();await app.ready();await offer(app);app.ui().setTool('swap');app.ui().selectNode(app.id(f.a));
 app.ui().setTool('hold');app.ui().selectNode(app.id(f.hold));assert.deepEqual(clean(app.ui().state().pair),[app.id(f.a)]);
 app.click('csPairB');assert.equal(app.ui().selectNode(app.id(f.b)),false,'old word is unavailable pending revalidation');
 const stale=await app.eligibilityRequest(),payload=app.resultFor(stale);
 app.ui().setTool('hold');app.ui().selectNode(app.id(f.hold));await offer(app);
 const before=clean(app.ui().state().eligibility);stale.worker.reply(payload,true);await app.advance(0);assert.deepEqual(clean(app.ui().state().eligibility),before);
 app.click('csPairB');assert.equal(app.ui().selectNode(app.id(f.b)),true);assert.equal(app.requests.filter(x=>x.request.task==='manual-swap').length,0);
});

test('Clear removes holds and endpoints without enabling unresolved nodes or accepting late old tables',async()=>{
 const app=host();await app.ready();app.ui().selectNode(app.id(f.hold));const pending=await app.eligibilityRequest(),stale=app.resultFor(pending);
 app.click('csClear');assert.deepEqual(clean(app.ui().state().held),[]);assert.deepEqual(clean(app.ui().state().pair),[]);assert.equal(app.ui().state().pairTarget,0);
 pending.worker.reply(stale,true);await app.advance(0);app.ui().setTool('swap');assert.equal(app.ui().selectNode(app.id(f.a)),false);
 await offer(app);assert.equal(app.ui().selectNode(app.id(f.a)),true,'fresh verified readiness restores interaction');
});

test('unknown eligibility stays unavailable without calling a full swap search or declaring impossibility',async()=>{
 const app=host();await app.ready();const entry=await app.eligibilityRequest();entry.worker.reply({id:entry.request.id,type:'result',result:{status:'unknown',reason:'time_limit'},modelFingerprint:app.core().modelFingerprint(model)});await app.advance(0);
 assert.deepEqual(clean(app.ui().state().eligibility.blocked),[]);app.ui().setTool('swap');assert.equal(app.ui().selectNode(app.id(f.a)),false);assert.equal(app.ui().selectNode(app.id(f.b)),false);
 assert.equal(app.ui().state().phase,'selecting');assert.equal(app.requests.filter(x=>x.request.task==='manual-swap').length,0);
});

test('the visible mode switch is explicit, solver selection is idempotent, and normal mode clears solver state',async()=>{
  const app=host(),normal=app.element('ringModeDefault'),solver=app.element('constrainedSolverToggle');
  assert(normal&&solver);assert.equal(normal.getAttribute('aria-pressed'),'true');assert.equal(solver.getAttribute('aria-pressed'),'false');
  await app.ready();assert.equal(normal.getAttribute('aria-pressed'),'false');assert.equal(solver.getAttribute('aria-pressed'),'true');
  app.ui().selectNode(app.id(f.hold));app.click('constrainedSolverToggle');assert.equal(app.ui().state().active,true);assert.deepEqual(clean(app.ui().state().held),[app.id(f.hold)],'choosing the current mode is not a destructive toggle');
  app.click('ringModeDefault');assert.equal(app.ui().state().active,false);assert.equal(normal.getAttribute('aria-pressed'),'true');assert.equal(solver.getAttribute('aria-pressed'),'false');
  assert.equal(app.element('csNodeOverlay').hidden,true);assert.deepEqual(clean(app.ui().state().held),[]);
  app.context.PUZZLE_API.select('R');app.click('cw');await app.settle();assert.equal(app.snapshot().history.length,1,'ordinary ring rotation works after leaving solver mode');
});

test('normal mode cancels Auto Solve planning and keeps stale plans from entering playback',async()=>{
  const app=host();app.context.PUZZLE_API.move('R');await app.settle();app.click('solve');
  for(let i=0;i<80&&!app.requests.some(x=>x.request.task==='full-solve');i++)await app.advance(0);
  const entry=app.requests.findLast(x=>x.request.task==='full-solve');assert(entry);app.click('ringModeDefault');
  assert.equal(app.ui().state().active,false);assert.equal(app.element('ringModeDefault').getAttribute('aria-pressed'),'true');assert.equal(String(app.element('speed').value),'5');
  entry.worker.reply({id:entry.request.id,type:'result',result:{status:'unknown',reason:'late_reply'}},true);await app.advance(0);
  assert.equal(app.ui().state().active,false);assert.equal(app.snapshot().history.length,1);
});

test('normal mode requested during a verified manual sequence completes only the active turn',async()=>{
 const app=host();await app.ready();const indices=[0,model.moves[0].inverse,f.move],before=app.mapping();app.ui().selectNode(app.id(f.hold));
 await offerVerifiedSwap(app,model,f.a,f.b,indices);app.selectPair(f.a,f.b);await app.advance(0);await app.advance(350);app.click('ringModeDefault');
 await app.settleSolver();assert.equal(app.ui().state().active,false);assert.equal(app.snapshot().history.length,1);
 const after=app.mapping();for(const [id,node]of Object.entries(before.stickerToNode))assert.equal(after.stickerToNode[id],model.moves[indices[0]].perm[node]);assert.equal(app.ui().state().held.length,0);
});

test('manual verified playback preserves independent label and playback choices',async()=>{
 const app=host();await app.ready();const D=app.context.PuzzleAxisDisplay;app.ui().selectNode(app.id(f.hold));await offerVerifiedSwap(app,model,f.a,f.b,[0,model.moves[0].inverse,f.move]);
 D.setLabelMode('all');app.element('speed').value='4';app.element('speed').dispatch('input');app.selectPair(f.a,f.b);await app.advance(0);
 D.setLabelMode('none');assert.equal(String(app.element('speed').value),'4');app.element('speed').value='2';app.element('speed').dispatch('input');await app.advance(2000);
 assert.equal(app.ui().state().phase,'executing');D.setLabelMode('some');app.element('speed').value='4';app.element('speed').dispatch('input');await app.settleSolver();assert.equal(D.labelMode(),'some');assert.equal(String(app.element('speed').value),'4');assert.equal(app.ui().state().phase,'selecting');
});

test('rejected readiness and canceled verification leave preferences and puzzle state intact',async()=>{
 for(const corrupt of [true,false]){
  const app=host();await app.ready();const D=app.context.PuzzleAxisDisplay;await offerVerifiedSwap(app,model,f.a,f.b,corrupt?[]:[f.move]);app.ui().setTool('swap');app.ui().selectNode(app.id(f.a));app.ui().selectNode(app.id(f.b));
  if(corrupt)await app.advance(0);else app.ui().cancel();assert.equal(D.labelMode(),'none');assert.equal(String(app.element('speed').value),'5');assert.equal(app.snapshot().history.length,0);assert.deepEqual(clean(app.ui().state().pair),[]);
 }
});
