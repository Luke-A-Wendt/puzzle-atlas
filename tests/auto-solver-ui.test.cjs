'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createPage}=require('./solver-dom.cjs');
const games=path.join(__dirname,'../dist/games');
const clean=value=>JSON.parse(JSON.stringify(value));

function host(id='cube2',{withoutHistory=false}={}){
  const workers=[],runCalls=[];
  class DeferredWorker{
    constructor(url){this.url=String(url);this.listeners={};this.terminated=false;workers.push(this);}
    postMessage(request){this.request=clean(request);}
    addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}
    removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(f=>f!==fn);}
    terminate(){this.terminated=true;}
    reply(data,force=false){if(this.terminated&&!force)return;const event={data};this.onmessage?.(event);for(const fn of this.listeners.message||[])fn(event);}
  }
  const app=createPage(id,{skipScripts:['constrained-solver.js'],globals:{Worker:DeferredWorker,fetch:async url=>{
    const file=path.join(games,new URL(String(url),'https://atlas.test/games/').pathname.replace(/^\/games\//,''));
    return {ok:fs.existsSync(file),text:async()=>fs.readFileSync(file,'utf8')};
  }}});
  const original=app.context.PUZZLE_API;
  app.context.PUZZLE_API=Object.freeze({...original,
    snapshot:()=>{const snap=original.snapshot();return withoutHistory?{...snap,history:[]}:snap;},
    runMoves:moves=>{runCalls.push({at:app.now(),moves:clean(moves)});return original.runMoves(moves);}
  });
  app.document.currentScript={src:new URL('constrained-solver.js',app.document.baseURI).href};
  app.loadScript('constrained-solver.js');app.document.currentScript=null;
  app.workers=workers;app.runCalls=runCalls;app.original=original;
  app.finishMotion=async(max=2000)=>{for(let i=0;i<max;i++){await app.advance(2000);const s=app.snapshot();if(!s.animating&&s.mode==='idle')return;}throw Error('Native sequence did not finish');};
  app.settle=async(max=2000)=>{for(let i=0;i<max;i++){await app.advance(2000);const s=app.snapshot(),u=app.context.ConstrainedSolverUI.state();if(!s.animating&&s.mode==='idle'&&!u.auto?.active&&!['executing','loading','solving','auto-gap'].includes(u.phase))return;}throw Error('Solver did not settle');};
  app.ui=()=>app.context.ConstrainedSolverUI;app.core=()=>app.context.ConstrainedSolverCore;
  app.model=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models',id+'.json'),'utf8'));
  app.home=app.core().mapSnapshot(app.model,app.snapshot()).stickerToNode;
  app.scramble=async(names=['R','U'])=>{assert.equal(original.runMoves(names),true);await app.settle();app.runCalls.length=0;};
  app.start=async()=>{app.click('solve');const until=performance.now()+3000;while(!workers.some(w=>w.request?.task==='full-solve')&&performance.now()<until)await app.advance(0);assert(workers.some(w=>w.request?.task==='full-solve'),'wait for asynchronous model verification before reading the full-solve request');};
  app.payload=async()=>{
    const responses=[],request=workers.at(-1).request;
    const context={URL,performance,TextEncoder,console,fetch:async url=>({ok:true,text:async()=>fs.readFileSync(path.join(games,new URL(url).pathname.replace(/^\/games\//,'')),'utf8')}),location:{href:'https://atlas.test/games/constrained-solver-worker.js'},postMessage:result=>responses.push(clean(result))};
    context.self=context;context.globalThis=context;vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(games,'constrained-solver-worker.js'),'utf8'),context);
    await context.onmessage({data:clean(request)});return responses.at(-1);
  };
  // Construct two known constrained transports for the R,U fixture. This is an
  // independent legal witness, allowing precise animation timing tests without
  // depending on the planner choosing any particular factorization.
  app.stagedReply=(stageNames=[["U'"],["R'"]])=>{
    let current={...app.core().mapSnapshot(app.model,app.snapshot()).stickerToNode};
    const solved=map=>Object.keys(map).filter(id=>map[id]===app.home[id]).map(id=>app.home[id]).sort((a,b)=>a-b);
    const stages=[];let fixed=solved(current);
    for(const names of stageNames){
      const indices=names.map(name=>{const i=app.model.moves.findIndex(m=>m.name===name);assert(i>=0);return i;});
      const before={...current};
      for(const i of indices)for(const id of Object.keys(current))current[id]=app.model.moves[i].perm[current[id]];
      const after=solved(current),newlySolvedNodes=after.filter(node=>!fixed.includes(node));
      assert(newlySolvedNodes.length,'fixture stage makes progress');
      for(const node of fixed){const id=Object.keys(app.home).find(id=>app.home[id]===node);assert.equal(current[id],node,'fixture restores old constraints');}
      const targetNode=newlySolvedNodes[0],targetId=Object.keys(app.home).find(id=>app.home[id]===targetNode);
      stages.push({moveIndices:indices,protectedNodes:fixed.slice(),newlySolvedNodes,targetNode,sourceNode:before[targetId]});fixed=after;
    }
    assert.equal(fixed.length,Object.keys(app.home).length,'fixture solves all labels');
    const result={status:'solved',stages,moveIndices:stages.flatMap(s=>s.moveIndices),finalProtectedNodes:fixed,optimal:false,verified:true,stats:{}};
    return {id:workers.at(-1).request.id,type:'result',result,engineStages:stages.map(s=>({...s,engineMoves:s.moveIndices.map(i=>app.model.moves[i].engineMove)})),modelFingerprint:app.core().modelFingerprint(app.model)};
  };
  app.assertSolved=()=>assert.deepEqual(clean(app.core().mapSnapshot(app.model,app.snapshot()).stickerToNode),clean(app.home));
  return app;
}

// Tests below deliberately use real puzzle scripts and the public solver UI;
// canvas layout/rendering remains covered by the existing ring-map tests.

test('Auto Solve opens the ring panel and enables constrained mode before state-based planning',async()=>{
  const app=host('cube2',{withoutHistory:true});await app.scramble();app.click('ringPanelHide');
  assert.equal(app.document.body.classList.contains('rings-collapsed'),true);
  assert.equal(app.ui().state().active,false);await app.start();
  assert.equal(app.document.body.classList.contains('rings-collapsed'),false);
  assert.equal(app.ui().state().active,true);
  assert.equal(app.element('constrainedSolverToggle').getAttribute('aria-pressed'),'true');
  assert.equal(app.workers.length,1);assert.equal(app.workers[0].request.task,'full-solve');
  assert.deepEqual(app.workers[0].request.snapshot.history,[],'planner must receive a state with no journal to reverse');
  const payload=await app.payload();assert.equal(payload.result.status,'solved',payload.result.reason);
  app.workers[0].reply(payload);await app.settle();app.assertSolved();
});

test('each completed constrained stage locks its goal-matching colors and pauses before the next stage',async()=>{
  const app=host();await app.scramble(['U','D']);await app.start();const payload=app.stagedReply([["U'"],["D'"]]);
  const checkpoint=payload.result.stages[0];
  assert.equal(app.core().verifyAutoPlan(app.model,app.snapshot(),payload.result),true);
  app.workers[0].reply(payload);await app.flush();
  const initialVisual=app.ui().visualState(),initialState=app.ui().state();
  assert.deepEqual(clean(initialVisual),{active:true,auto:true,held:clean(initialState.held),pair:clean(initialState.pair)});assert.equal(initialVisual.pair.length,2,'auto stage exposes both moving sticker markers');
  for(let i=0;i<100&&app.ui().state().auto?.completed!==1;i++)await app.advance(20);
  const state=app.ui().state();assert.equal(state.auto.completed,1);assert.equal(app.runCalls.length,1);
  assert.deepEqual(clean(app.ui().visualState()),{active:true,auto:true,held:clean(state.held),pair:[]},'between stages the completed pair clears while secured-node borders remain');
  const expected=[...checkpoint.protectedNodes,...checkpoint.newlySolvedNodes].sort((a,b)=>a-b);
  assert.deepEqual(clean(state.auto.lockedNodes).sort((a,b)=>a-b),expected);
  const map=app.core().mapSnapshot(app.model,app.snapshot());
  for(const node of state.auto.lockedNodes){const id=map.nodeToSticker[node],homeId=Object.keys(app.home).find(id=>app.home[id]===node);assert.equal(app.model.colorBySticker[id],app.model.colorBySticker[homeId],'only goal-matching colors are highlighted');}
  const completedAt=app.now();await app.advance(350);assert.equal(app.runCalls.length,1,'stage pause is visible');
  await app.advance(200);assert.equal(app.runCalls.length,2);assert(app.runCalls[1].at-completedAt>=450);
  await app.settle();app.assertSolved();
});

test('top Stop stays visible between steps and exits immediately at a completed step',async()=>{
  const app=host();await app.scramble(['U','D']);await app.start();app.workers[0].reply(app.stagedReply([["U'"],["D'"]]));await app.flush();
  for(let i=0;i<100&&app.ui().state().auto?.completed!==1;i++)await app.advance(20);
  assert.equal(app.element('pause').hidden,false);assert.equal(app.element('pause').textContent,'Stop');
  app.click('pause');await app.advance(5000);assert.equal(app.runCalls.length,1);
  assert.equal(app.ui().state().active,false);assert.equal(app.element('pause').hidden,true);
});

test('top Stop restores constraints then leaves solver mode without starting a later stage',async()=>{
  const app=host();await app.scramble();await app.start();const payload=app.stagedReply();
  app.element('speed').value='1';app.element('speed').dispatch('input');app.workers[0].reply(payload);await app.advance(20);
  app.click('pause');await app.settle();assert.equal(app.runCalls.length,1);
  const mapping=app.core().mapSnapshot(app.model,app.snapshot());
  for(const node of [...payload.result.stages[0].protectedNodes,...payload.result.stages[0].newlySolvedNodes]){
    const id=Object.keys(app.home).find(id=>app.home[id]===node);assert.equal(mapping.stickerToNode[id],node);
  }
  assert.equal(app.ui().state().auto?.active||false,false);assert.equal(app.ui().state().active,false);assert.equal(app.ui().state().phase,'off');assert.deepEqual(Array.from(app.ui().state().held),[]);
});

test('cancelled, stale, and forged Auto Solve plans never start playback',async()=>{
  for(const scenario of ['cancelled','stale','forged','fingerprint']){
    const app=host();await app.scramble();await app.start();const worker=app.workers[0],payload=app.stagedReply();
    if(scenario==='cancelled')app.ui().cancel();
    if(scenario==='stale'){app.original.runMoves(['F']);await app.finishMotion();}
    if(scenario==='forged'){payload.result.stages[0].moveIndices=[0];payload.result.moveIndices=payload.result.stages.flatMap(s=>s.moveIndices);}
    if(scenario==='fingerprint')payload.modelFingerprint='stale-model';
    worker.reply(payload,true);await app.advance(1000);assert.equal(app.runCalls.length,0,scenario+' must execute no automatic moves');
  }
});

test('unresolved or illegal full-state requests remain distinct and do not move the puzzle',async()=>{
  for(const status of ['unknown','impossible','invalid']){
    const app=host();await app.scramble();const before=app.snapshot().stickers;await app.start();const worker=app.workers[0];
    worker.reply({id:worker.request.id,type:'result',result:{status,reason:status==='unknown'?'time_limit':'not_a_legal_state'},modelFingerprint:app.core().modelFingerprint(app.model)});
    await app.advance(1000);assert.equal(app.runCalls.length,0);assert.deepEqual(app.snapshot().stickers,before);
    assert.equal(app.ui().state().result.status,status);
    if(status==='impossible'){
      assert.equal(app.element('csAutoNotice').hidden,false);
      assert.match(app.element('csAutoNoticeText').textContent,/browser\/model mismatch/);
      assert.match(app.element('csAutoNoticeText').textContent,/not_a_legal_state/);
    }
  }
});

test('a constrained Auto Solve stage longer than 300 moves is fully verified and chunked without truncation',async()=>{
  const app=host();await app.scramble();await app.start();const padding=Array.from({length:160},()=>['F',"F'"]).flat();
  const payload=app.stagedReply([[...padding,"U'"],["R'"]]);
  assert.equal(app.core().verifyAutoPlan(app.model,app.snapshot(),payload.result),true);
  app.workers[0].reply(payload);await app.settle(1800);app.assertSolved();
  assert.equal(app.runCalls.reduce((sum,call)=>sum+call.moves.length,0),322);
  assert(app.runCalls.every(call=>call.moves.length<=300));assert.deepEqual(app.runCalls.map(call=>call.moves.length),[300,21,1],'long stages chunk at 300 moves without merging the next incremental stage');
});

test('Auto Solve preserves mirror difficulty while opening its silver ring-map solver',async()=>{
  const app=host('mirror');await app.scramble();app.click('ringPanelHide');app.click('mirrorMode');
  assert.equal(app.snapshot().mirrorMode,true);await app.start();
  assert.equal(app.snapshot().mirrorMode,true);assert.equal(app.element('ringPanel').hidden,false);assert.equal(app.element('csShowGoal').hidden,true);
  assert.equal(app.document.body.classList.contains('rings-collapsed'),false);assert.equal(app.ui().state().active,true);
  assert.equal(app.workers.at(-1).request.task,'full-solve');app.ui().cancel();
});

test('all catalog puzzle pages route Auto Solve to full-state constrained planning',async()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models/manifest.json'),'utf8'));
  const ids=Array.isArray(manifest)?manifest.map(x=>x.id):manifest.models?.map(x=>x.id)||manifest.puzzles?.map(x=>x.id);
  assert.equal(new Set(ids).size,ids.length);for(const id of ['axis','cube9','cube10'])assert(ids.includes(id),id+' must be covered by native Auto Solve routing');
  for(const id of ids){
    const app=host(id);
    // U only rearranges same-colored cap pieces on the three-band Diamond;
    // choose a side turn so the native Solve button has an unsolved puzzle.
    const move=id==='diamondstyle'?app.model.moves.find(m=>m.name==='R'):app.model.moves[0];
    assert.equal(app.original.runMoves([move.engineMove]),true,id);await app.settle();app.runCalls.length=0;
    assert.notEqual(app.snapshot().solved,true,id+' fixture must be visibly unsolved');
    await app.start();assert.equal(app.ui().state().active,true,id);assert.equal(app.workers.length,1,id);
    assert.equal(app.workers[0].request.task,'full-solve',id);assert.equal(app.runCalls.length,0,id+' must not start legacy reversal');app.ui().cancel();
  }
});

test('top Stop cancels Auto Solve planning while the engine is idle',async()=>{
  const app=host();await app.scramble();await app.start();const worker=app.workers[0],payload=app.stagedReply();
  assert.equal(app.snapshot().mode,'idle');assert.equal(app.element('pause').hidden,false);assert.equal(app.element('pause').textContent,'Stop');
  app.click('pause');assert.equal(app.ui().state().active,false);assert.equal(app.element('pause').hidden,true);assert.equal(String(app.element('speed').value),'5');
  worker.reply(payload,true);await app.advance(3000);assert.equal(app.runCalls.length,0);
});

test('an external move during the inter-stage gap stops stale playback without hanging',async()=>{
  const app=host();await app.scramble();await app.start();app.workers[0].reply(app.stagedReply());await app.flush();
  for(let i=0;i<100&&app.ui().state().auto?.completed!==1;i++)await app.advance(20);
  assert.equal(app.ui().state().phase,'auto-gap');app.element('speed').value='1';app.element('speed').dispatch('input');
  assert.equal(app.original.runMoves(['F']),true);await app.advance(550);await app.advance(2000);await app.advance(2000);
  assert.equal(app.runCalls.length,1,'no automatic next stage can use a changed starting state');
  assert.equal(app.ui().state().auto,null,'a stale auto job must stop instead of waiting forever');
  assert.equal(app.ui().state().phase,'selecting');
});

test('clicking Constrained Solver during Auto Solve finishes the current stage then stays in manual solver mode',async()=>{
  const app=host();await app.scramble();await app.start();const payload=app.stagedReply();
  app.workers[0].reply(payload);await app.advance(20);app.click('constrainedSolverToggle');
  assert.equal(app.ui().state().auto?.active,true);await app.settle();
  const state=app.ui().state();assert.equal(app.runCalls.length,1,'must finish only the current stage');assert.equal(state.active,true);assert.equal(state.phase,'selecting');assert.equal(state.auto,null);assert.deepEqual(clean(state.pair),[]);assert.equal(app.ui().autoStopActive(),false);assert.equal(String(app.element('speed').value),'5');assert.equal(app.context.PuzzleAxisDisplay.labelMode(),'none');assert.equal(app.context.PuzzleAxisDisplay.highlights3D(),true);
  assert.equal(app.element('constrainedSolverToggle').getAttribute('aria-pressed'),'true');assert.equal(app.element('csSuggestHolds').hidden,false);
  const map=app.core().mapSnapshot(app.model,app.snapshot());for(const id of state.held)assert.equal(map.stickerToNode[id],app.home[id]);
});

test('Auto Solve preserves small verified stages instead of grouping incidental matches into a long opening run',async()=>{
  const app=host('cube5');let seed=9173;const names=[];
  for(let k=0;k<19;k++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;names.push(app.model.moves[seed%app.model.moves.length].name);}
  await app.scramble(names);await app.start();const payload=await app.payload(),plan=payload.result;
  assert.equal(plan.status,'solved',plan.reason);assert(app.core().verifyAutoPlan(app.model,app.snapshot(),plan));
  const regrouped=app.core().groupGuidedPlan(app.model,app.core().autoRequestFromSnapshot(app.model,app.snapshot()),plan);
  assert(plan.stages.length>20,'fixture has many independent secured placements');
  assert(regrouped.stages[0].moveIndices.length>300,'fixture reproduces the excessive old opening checkpoint');
  assert(plan.stages[0].moveIndices.length<10,'the native first placement is short');
  const goalBefore=app.core().solvedProgress(app.model,app.snapshot()).solvedCount;
  assert(goalBefore>plan.initialProtectedNodes.length,'accidental correct colors are not automatically protected');
  app.workers[0].reply(payload);await app.flush();
  assert.equal(app.ui().state().auto.totalStages,plan.stages.length);
  assert.deepEqual(app.runCalls[0].moves,plan.stages[0].moveIndices.map(i=>app.model.moves[i].engineMove));
  assert.equal(app.element('csAutoProgressBar').value,plan.initialProtectedNodes.length,'upper bar starts at the verified prefix, not accidental goal matches');
  for(let i=0;i<100&&app.ui().state().auto.completed!==1;i++)await app.advance(20);
  const locked=app.ui().state().auto.lockedNodes.length;
  assert.equal(app.ui().state().auto.completed,1);assert.equal(app.element('csAutoProgressBar').value,locked);assert(locked>plan.initialProtectedNodes.length);
  assert.equal(app.runCalls.length,1,'a visible pause follows the small first stage');
  app.ui().stopAuto();await app.advance(0);assert.equal(app.ui().state().active,false);
});
