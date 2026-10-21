'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createPage}=require('./solver-dom.cjs');
const {offerVerifiedSwap}=require('./verified-swap-fixture.cjs');
const games=path.join(__dirname,'../dist/games');
const clean=value=>JSON.parse(JSON.stringify(value));
const fetchFile=async url=>{const file=path.join(games,new URL(String(url),'https://atlas.test/games/').pathname.replace(/^\/games\//,''));return {ok:fs.existsSync(file),text:async()=>fs.readFileSync(file,'utf8')};};
function host(id='cube2'){
  const requests=[],workers=[];
  class DeferredWorker {
    constructor(){this.listeners={};this.terminated=false;workers.push(this);}
    postMessage(request){this.request=clean(request);requests.push({worker:this,request:this.request});}
    addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}
    removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(f=>f!==fn);}
    terminate(){this.terminated=true;}
    reply(data,force=false){if(this.terminated&&!force)return;const event={data};this.onmessage?.(event);for(const fn of this.listeners.message||[])fn(event);}
  }
  const app=createPage(id,{globals:{Worker:DeferredWorker,fetch:fetchFile}});
  app.workers=workers;app.model=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models',id+'.json'),'utf8'));
  app.ui=()=>app.context.ConstrainedSolverUI;app.core=()=>app.context.ConstrainedSolverCore;
  app.mapping=()=>app.core().mapSnapshot(app.model,app.snapshot());
  app.id=node=>String(app.mapping().nodeToSticker[node]);
  app.request=task=>requests.findLast(x=>x.request.task===task);
  app.ready=async()=>{app.ui().setActive(true);for(let i=0;i<80&&app.ui().state().phase==='loading';i++)await app.advance(0);assert.equal(app.ui().state().phase,'selecting');};
  app.reply=(entry,result)=>entry.worker.reply({id:entry.request.id,type:'result',result,modelFingerprint:app.core().modelFingerprint(app.model)});
  app.payload=async entry=>{const replies=[],ctx={URL,performance,TextEncoder,console,fetch:fetchFile,location:{href:'https://atlas.test/games/constrained-solver-worker.js'},postMessage:data=>replies.push(clean(data))};ctx.self=ctx;ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(games,'constrained-solver-worker.js'),'utf8'),ctx);await ctx.onmessage({data:clean(entry.request)});return replies.at(-1);};
  app.settleSolver=async()=>{for(let i=0;i<200;i++){await app.advance(2000);const s=app.snapshot(),u=app.ui().state();if(!s.animating&&s.mode==='idle'&&!['solving','executing','auto-gap'].includes(u.phase))return;}throw Error('Solver did not settle');};
  return app;
}
function fixture(model){
  const move=model.moves.findIndex(m=>m.name==='U2'),p=model.moves[move].perm;
  const a=model.nodes.find(n=>n.face!=='U'&&p[n.index]!==n.index&&p[p[n.index]]===n.index).index;
  const fixed=model.nodes.find(n=>!([a,p[a]].includes(n.index))&&p[n.index]===n.index).index;
  return {move,pair:[a,p[a]],fixed};
}
function hold(app,ids){app.ui().setTool('hold');for(const id of ids)assert.equal(app.ui().selectNode(id),true);}
function choose(app,ids){app.ui().setTool('swap');for(const id of ids)assert.equal(app.ui().selectNode(id),true);}

test('held endpoints keep their classification, temporarily waive their constraints, and restore them when selection or search is canceled',async()=>{
  for(const puzzle of ['cube2','diamondstyle','homer','ghost']){
    const app=host(puzzle);await app.ready();const f=fixture(app.model),ids=[...f.pair,f.fixed].map(app.id);
    hold(app,ids);await offerVerifiedSwap(app,app.model,...f.pair,[f.move]);choose(app,[ids[0]]);
    assert.deepEqual(clean(app.ui().state().effectiveHeld),ids.slice(1));
    app.click('csPairA');assert.deepEqual(clean(app.ui().state().pair),[]);assert.deepEqual(clean(app.ui().state().effectiveHeld),ids,'editing the first node restores its hold before a second node is selected');
    choose(app,ids.slice(0,2));
    assert.equal(app.ui().state().phase,'solving','the second endpoint starts checking automatically');
    assert.deepEqual(clean(app.ui().state().held),ids,puzzle);assert.deepEqual(clean(app.ui().state().effectiveHeld),[ids[2]],puzzle);
    assert.deepEqual(clean(app.ui().visualState().held),ids,'3D keeps the dashed classification');
    assert.deepEqual(clean(app.ui().visualState().pair),ids.slice(0,2));
    assert.equal(app.request('manual-swap'),undefined,'ready selection does not dispatch manual search');
    assert.equal(app.ui().cancel(),true);assert.deepEqual(clean(app.ui().state().pair),[]);assert.deepEqual(clean(app.ui().state().effectiveHeld),ids);
    choose(app,[ids[0]]);hold(app,[ids[0]]);
    assert.deepEqual(clean(app.ui().state().pair),[ids[0]],'toggling a held classification preserves the selected first node');
    assert.deepEqual(clean(app.ui().state().held),ids.slice(1));
    app.click('csClear');assert.deepEqual(clean(app.ui().state().effectiveHeld),[]);assert.deepEqual(clean(app.ui().state().pair),[]);
  }
});

test('legacy held exclusions do not advertise readiness and eligibility requests retain endpoint exemptions',async()=>{
  const app=host();await app.ready();const f=fixture(app.model),ids=f.pair.map(app.id);hold(app,ids);await app.advance(200);
  const entry=app.request('eligible-swaps');assert.equal(entry.request.selection.exemptSwapEndpoints,true);assert.deepEqual(entry.request.selection.protectedStickerIds,ids);
  const degree=app.model.degree,bytes=Math.ceil(degree*degree/8);
  app.reply(entry,{status:'complete',degree,firstStatus:Array(degree).fill(2),knownPairs:Array(bytes).fill(255),feasiblePairs:Array(bytes).fill(0)});await app.advance(0);
  app.ui().setTool('swap');for(const id of ids)assert.equal(app.ui().selectNode(id),false,'a legacy feasibility table has no verified witness');
  assert.equal(app.request('manual-swap'),undefined);assert.deepEqual(clean(app.ui().state().effectiveHeld),ids);
  hold(app,[ids[0]]);assert.deepEqual(clean(app.ui().state().held),[ids[1]],'unavailable swaps never disable the hold tool');
});

test('a held selected node draws its dashed hold circle and a larger solid numbered circle',async()=>{
  const app=host();await app.ready();const f=fixture(app.model),id=app.id(f.pair[0]);hold(app,[id]);await offerVerifiedSwap(app,app.model,...f.pair,[f.move]);choose(app,[id]);
  const marks=[],ctx=app.element('csNodeOverlay').drawing;let arc=null,dash=[];
  ctx.setLineDash=value=>dash=Array.from(value);ctx.arc=(x,y,r)=>arc={x,y,r};ctx.stroke=()=>{if(arc)marks.push({...arc,dash:dash.slice(),width:ctx.lineWidth,color:ctx.strokeStyle});};
  await app.advance(0);const node=app.context.PUZZLE_SOLVER_BRIDGE.nodes().find(n=>String(n.stickerId)===id),own=marks.filter(m=>m.x===node.x&&m.y===node.y);
  const held=own.find(m=>m.dash.length),selected=own.find(m=>!m.dash.length&&m.width===4.8);
  assert(held&&selected,'both outlines are visible');assert(selected.r>held.r);assert.equal(held.color,'#ffffff');assert.equal(selected.color,'#ffffff');
});

test('verified manual swap changes held endpoint colors and reattaches every hold to its original location',async()=>{
  const app=host();await app.ready();const f=fixture(app.model),before=app.mapping(),colors=app.core().colorsFromSnapshot(app.model,app.snapshot()),heldNodes=[...f.pair,f.fixed],ids=heldNodes.map(app.id);
  assert.notEqual(colors[f.pair[0]],colors[f.pair[1]],'the fixture exchanges different colors');hold(app,ids);await offerVerifiedSwap(app,app.model,...f.pair,[f.move]);choose(app,ids.slice(0,2));
  assert.equal(app.request('manual-swap'),undefined);assert.deepEqual(clean(app.ui().state().effectiveHeld),[ids[2]],'only the two selected holds are waived');assert.equal(String(app.element('speed').value),'5','manual solving preserves the user playback speed');
  await app.advance(0);
  assert.equal(app.ui().state().phase,'executing');assert.equal(app.snapshot().history.length,0,'verified swap pauses before its first move');assert.equal(app.snapshot().animating,false);assert.deepEqual(clean(app.ui().visualState().held),ids);assert.deepEqual(clean(app.ui().visualState().pair),ids.slice(0,2));
  await app.settleSolver();const after=app.mapping(),nowColors=app.core().colorsFromSnapshot(app.model,app.snapshot());
  assert.equal(after.stickerToNode[before.nodeToSticker[f.pair[0]]],f.pair[1]);assert.equal(after.stickerToNode[before.nodeToSticker[f.pair[1]]],f.pair[0]);
  assert.equal(nowColors[f.pair[0]],colors[f.pair[1]]);assert.equal(nowColors[f.pair[1]],colors[f.pair[0]]);assert.equal(nowColors[f.fixed],colors[f.fixed]);
  assert.deepEqual(clean(app.ui().state().held).sort(),heldNodes.map(app.id).sort(),'holds survive on the original physical locations with their new occupants');
  assert.deepEqual(clean(app.ui().state().effectiveHeld).sort(),heldNodes.map(app.id).sort());assert.deepEqual(clean(app.ui().state().pair),[]);assert.match(app.ui().state().status,/Swap complete/);assert.equal(String(app.element('speed').value),'5','completion or failure preserves playback speed');
  await app.advance(200);const refreshed=app.request('eligible-swaps');assert.deepEqual(refreshed.request.selection.protectedStickerIds.slice().sort(),heldNodes.map(app.id).sort(),'the next table protects all post-swap occupants');assert.equal(refreshed.request.selection.exemptSwapEndpoints,true);
});

test('rejected witnesses and canceled preview restore every held endpoint without a retry search',async()=>{
  for(const corrupt of [true,false]){
    const app=host();await app.ready();const f=fixture(app.model),ids=[...f.pair,f.fixed].map(app.id);hold(app,ids);
    await offerVerifiedSwap(app,app.model,...f.pair,corrupt?[]:[f.move]);choose(app,ids.slice(0,2));
    if(corrupt)await app.advance(0);else app.ui().cancel();
    assert.deepEqual(clean(app.ui().state().pair),[]);assert.deepEqual(clean(app.ui().state().effectiveHeld),ids);
    assert.equal(String(app.element('speed').value),'5');assert.equal(app.snapshot().history.length,0);assert.equal(app.request('manual-swap'),undefined);
  }
});

test('the actual eligibility worker can prepare held-pair readiness, which executes without another search',async()=>{
  const app=host();await app.ready();const f=fixture(app.model),ids=[...f.pair,f.fixed].map(app.id);hold(app,ids);await app.advance(200);
  const entry=app.request('eligible-swaps'),payload=await app.payload(entry);assert.equal(payload.result.exemptSwapEndpoints,true,'the bundled worker uses pair-dependent holds');entry.worker.reply(payload);await app.advance(0);
  choose(app,ids.slice(0,2));await app.advance(0);
  assert.equal(app.element('csGo'),null,'there is no separate execution button');assert.equal(app.ui().state().phase,'executing');assert.equal(app.snapshot().history.length,0,'a ready witness also gets the preview pause');
  assert.equal(app.request('manual-swap'),undefined,'a verified eligible pair reuses its witness');await app.settleSolver();assert.equal(app.snapshot().history.length,1);assert.equal(app.ui().state().held.length,3);
});
