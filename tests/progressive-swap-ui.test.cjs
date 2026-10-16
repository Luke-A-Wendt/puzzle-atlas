'use strict';

// The browser/worker boundary is deliberately controllable here: advancing
// search budgets must preserve one computation, never replay a timed-out job.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createPage}=require('./solver-dom.cjs');
const games=path.join(__dirname,'../dist/games');
const clean=x=>JSON.parse(JSON.stringify(x));
const model=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models/cube2.json'),'utf8'));

function fixture(){
  const move=model.moves.findIndex(m=>m.name==='U2'),p=model.moves[move].perm;
  const a=model.nodes.find(n=>n.face!=='U'&&p[n.index]!==n.index&&p[p[n.index]]===n.index).index;
  const held=model.nodes.find(n=>n.face==='U'&&p[n.index]!==n.index).index;
  return {move,a,b:p[a],held};
}
const f=fixture();

function host(){
  const requests=[],workers=[];
  class Worker{
    constructor(){this.listeners={};this.terminated=false;workers.push(this);}
    postMessage(q){this.request=clean(q);requests.push({worker:this,request:this.request});}
    addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}
    removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(f=>f!==fn);}
    terminate(){this.terminated=true;}
    reply(data,force=false){if(this.terminated&&!force)return;const event={data};this.onmessage?.(event);for(const fn of this.listeners.message||[])fn(event);}
  }
  const app=createPage('cube2',{globals:{Worker,fetch:async url=>{
    const file=path.join(games,new URL(String(url),'https://atlas.test/games/').pathname.replace(/^\/games\//,''));
    return {ok:fs.existsSync(file),text:async()=>fs.readFileSync(file,'utf8')};
  }}});
  app.requests=requests;app.workers=workers;app.ui=()=>app.context.ConstrainedSolverUI;app.core=()=>app.context.ConstrainedSolverCore;
  app.mapping=()=>app.core().mapSnapshot(model,app.snapshot());app.nodeId=n=>app.mapping().nodeToSticker[n];
  app.ready=async()=>{
    app.ui().setActive(true);
    // Model verification uses asynchronous Web Crypto. Under a parallel suite,
    // a fixed number of event-loop turns can finish before its worker responds.
    const deadline=performance.now()+5000;
    while(app.ui().state().phase==='loading'&&performance.now()<deadline)await app.advance(0);
    assert.equal(app.ui().state().phase,'selecting','model verification must finish before selecting nodes');
  };
  app.choose=()=>{app.ui().setTool('swap');assert(app.ui().selectNode(app.nodeId(f.a)));assert(app.ui().selectNode(app.nodeId(f.b)));};
  app.manual=()=>requests.findLast(x=>x.request.task==='manual-swap');
  app.respond=async(entry,result,{force=false,id=entry.request.id}={})=>{entry.worker.reply({id,type:'result',result,modelFingerprint:app.core().modelFingerprint(model)},force);await app.advance(0);};
  app.pending=async()=>{await app.ready();app.choose();app.click('csGo');const entry=app.manual();assert(entry,'manual checking uses the resumable worker route');return entry;};
  app.settleSolver=async()=>{for(let i=0;i<80;i++){await app.advance(2000);const state=app.ui().state(),snap=app.snapshot();if(!snap.animating&&snap.mode==='idle'&&!['solving','executing','auto-gap'].includes(state.phase))return;}throw Error('Solver did not settle');};
  return app;
}

function exhausted(budgetMs,nextBudgetMs,extra={}){
  return {status:'unknown',reason:nextBudgetMs?'time_slice_complete':'manual_search_time_limit',optimal:false,
    search:{budgetMs,elapsedMs:budgetMs,states:budgetMs/10,transitions:budgetMs/2,canContinue:!!nextBudgetMs,nextBudgetMs:nextBudgetMs||null,terminalReason:nextBudgetMs?undefined:'time_limit',resumed:budgetMs>3000,...extra}};
}

test('Continue reuses the worker and accumulated search, and the one-minute endpoint cannot restart the same request',async()=>{
  const app=host(),first=await app.pending();
  assert.equal(first.request.options.maxMs,3000);assert.equal(app.element('csSearchProgress').hidden,false);assert.equal(String(app.element('speed').value),'5');
  let entry=first;
  for(const [budget,next,added]of [[3000,10000,7],[10000,30000,20],[30000,60000,30]]){
    await app.respond(entry,exhausted(budget,next));
    assert.equal(entry.worker.terminated,false,'the frontier remains in its original worker');
    assert.equal(app.ui().state().phase,'selecting');assert.equal(app.ui().state().search.budgetMs,budget);assert.equal(String(app.element('speed').value),'5','a paused unsuccessful check preserves speed');
    assert.deepEqual(clean(app.ui().visualState().pair),[],'failed checks release both visible endpoints');
    assert.equal(app.ui().state().pairTarget,0);assert.equal(app.ui().state().tool,'swap');
    assert.equal(app.ui().state().anchors.some(a=>a.label),false,'failed pair anchors disappear');
    assert.equal(app.element('csGo').disabled,true,'Go must not restart the same timed-out request');
    assert.equal(app.element('csRetry').hidden,false);assert.match(app.element('csRetry').textContent,new RegExp('Continue.*\\+'+added+'s'));
    const n=app.requests.length;app.ui().go();assert.equal(app.requests.length,n,'the public Go API also prevents restarting');
    app.click('csRetry');entry=app.manual();assert.deepEqual(clean(app.ui().visualState().pair),[app.nodeId(f.a),app.nodeId(f.b)],'Continue explicitly restores the saved pair');assert.equal(entry.worker,first.worker);assert.equal(entry.request.options.maxMs,next);assert.notEqual(entry.request.id,first.request.id);
  }
  await app.respond(entry,exhausted(60000,null));
  assert.equal(first.worker.terminated,true);assert.equal(app.ui().state().search.canContinue,false);
  assert.equal(app.element('csRetry').hidden,true);assert.equal(app.element('csGo').disabled,true);
  assert.match(app.ui().state().status,/no.*found|could not find|did not find/i);
  assert.match(app.ui().state().status,/not.*proof|not.*proved|may.*exist|not.*impossible/i,'compute exhaustion is not a proof that a solution is impossible');
  assert.equal(app.ui().state().result.status,'unknown');assert.equal(app.snapshot().history.length,0);
  const n=app.requests.length;app.ui().go();app.click('csGo');assert.equal(app.requests.length,n);
});

test('late results from an earlier slice cannot interrupt a resumed search or animate a stale answer',async()=>{
  const app=host(),first=await app.pending();await app.respond(first,exhausted(3000,10000));app.click('csRetry');const second=app.manual();
  await app.respond(first,{status:'solved',moveIndices:[f.move],optimal:false},{force:true});
  assert.equal(app.ui().state().phase,'solving');assert.equal(app.snapshot().history.length,0);
  assert.equal(second.worker.terminated,false);await app.respond(second,exhausted(10000,30000));
  assert.equal(app.ui().state().search.budgetMs,10000);assert.equal(app.element('csRetry').hidden,false);
});

test('live checking reports accumulated work without inventing a completion percentage and can be canceled',async()=>{
  const app=host(),entry=await app.pending();
  const progress={budgetMs:3000,elapsedMs:1200,states:240,transitions:890,canContinue:true,nextBudgetMs:10000,resumed:false};
  entry.worker.reply({id:entry.request.id,type:'progress',stage:'searching',search:progress});await app.advance(0);
  assert.equal(app.ui().state().search.states,240);assert.equal(app.ui().state().search.transitions,890);
  assert.equal(app.element('csSearchProgress').hidden,false);assert.match(app.element('csSearchProgressLabel').textContent,/240/);
  const progressBar=app.element('csSearchProgress').querySelector('progress');assert(progressBar);assert.equal(progressBar.hasAttribute('value'),false,'search progress is indeterminate because its distance to a solution is unknown');
  assert.equal(app.element('csCancel').hidden,false);app.click('csCancel');assert.equal(entry.worker.terminated,true);
  assert.equal(app.ui().state().search,null);assert.equal(app.ui().state().phase,'selecting');assert.deepEqual(clean(app.ui().visualState().pair),[]);assert.equal(app.ui().state().pairTarget,0);assert.equal(app.snapshot().history.length,0);
  entry.worker.reply({id:entry.request.id,type:'progress',stage:'searching',search:{...progress,states:999}},true);await app.advance(0);
  assert.equal(app.ui().state().search,null,'late progress cannot revive a canceled session');
});

test('a resumed verified result executes normally, clears A/B, and discards the finished session',async()=>{
  const app=host();await app.ready();app.ui().selectNode(app.nodeId(f.held));app.choose();const before=app.mapping();app.click('csGo');const first=app.manual();
  await app.respond(first,exhausted(3000,10000));app.click('csRetry');const second=app.manual();
  await app.respond(second,{status:'solved',moveIndices:[f.move],optimal:false,search:{budgetMs:10000,elapsedMs:3600,states:380,transitions:2400,canContinue:false,resumed:true}});
  assert.equal(second.worker.terminated,true);assert.equal(app.ui().state().phase,'executing');assert.equal(String(app.element('speed').value),'5','resumed manual playback keeps the selected rate');
  assert.deepEqual(clean(app.ui().visualState()),{active:true,held:[before.nodeToSticker[f.held]],pair:[before.nodeToSticker[f.a],before.nodeToSticker[f.b]]},'A/B physical sticker identities remain available throughout playback');
  await app.advance(1);assert.equal(app.ui().visualState().pair.length,2);await app.settleSolver();
  const after=app.mapping();assert.equal(after.stickerToNode[before.nodeToSticker[f.a]],f.b);assert.equal(after.stickerToNode[before.nodeToSticker[f.b]],f.a);
  assert.deepEqual(clean(app.ui().state().pair),[]);assert.equal(app.ui().state().held.length,1);assert.equal(app.ui().state().search,null);
  assert.equal(app.element('csRetry').hidden,true);assert.equal(app.element('speedText').textContent,'Normal');
});

test('editing A, B, holds, Clear all, cancellation and leaving solver mode discard old search state',async()=>{
  for(const action of ['A','B','holds','clear','cancel','mode','move']){
    const app=host(),first=await app.pending();await app.respond(first,exhausted(3000,10000));
    if(action==='A')app.click('csPairA');
    if(action==='B'){app.click('csPairB');const node=model.nodes.find(n=>![f.a,f.b].includes(n.index)).index;assert(app.ui().selectNode(app.nodeId(node)));}
    if(action==='holds'){app.ui().setTool('hold');app.ui().selectNode(app.nodeId(f.held));}
    if(action==='clear')app.click('csClear');
    if(action==='cancel')app.ui().cancel();
    if(action==='mode')app.click('ringModeDefault');
    if(action==='move'){app.click('ringModeDefault');assert.equal(app.context.PUZZLE_API.move('R'),true);await app.settleSolver();}
    await app.advance(0);assert.equal(first.worker.terminated,true,action+' discards the retained worker');assert.equal(app.ui().state().search,null,action+' discards progress for the old constraint set');
    const moves=app.snapshot().history.length;await app.respond(first,{status:'solved',moveIndices:[f.move]},{force:true});
    assert.equal(app.snapshot().history.length,moves,action+' rejects late results');assert.notEqual(app.ui().state().phase,'executing');
  }
});

test('changing constraints after the bounded endpoint permits a fresh request with its own initial budget',async()=>{
  const app=host(),first=await app.pending();await app.respond(first,exhausted(60000,null));
  app.ui().setTool('hold');assert(app.ui().selectNode(app.nodeId(f.held)));
  assert.equal(app.element('csGo').disabled,true,'failed pair remains cleared after changing holds');app.choose();assert.equal(app.element('csGo').disabled,false);app.click('csGo');const second=app.manual();
  assert.notEqual(second.worker,first.worker);assert.equal(second.request.options.maxMs,3000);assert.equal(second.request.selection.protectedStickerIds.length,1);
  assert.equal(app.snapshot().history.length,0);
});

test('Auto Solve discards paused manual work and starts an independent full-state plan',async()=>{
  const app=host();app.context.PUZZLE_API.move('R');await app.settleSolver();
  const manual=await app.pending();await app.respond(manual,exhausted(3000,10000));const moves=app.snapshot().history.length;
  app.click('solve');for(let i=0;i<40&&!app.requests.some(x=>x.request.task==='full-solve');i++)await app.advance(0);
  const full=app.requests.findLast(x=>x.request.task==='full-solve');assert(full);assert.notEqual(full.worker,manual.worker);
  assert.equal(manual.worker.terminated,true);assert.equal(app.ui().state().search,null);assert.deepEqual(clean(app.ui().state().pair),[]);assert.equal(app.element('csRetry').hidden,true);
  assert.equal(full.request.options.maxMs,15000,'manual continuation budgets do not leak into Auto Solve');
  await app.respond(manual,{status:'solved',moveIndices:[f.move]},{force:true});assert.equal(app.ui().state().phase,'solving');assert.equal(app.snapshot().history.length,moves);
  app.ui().cancel();assert.equal(full.worker.terminated,true);assert.equal(app.ui().state().active,false);assert.equal(app.element('speedText').textContent,'Normal');
});

test('choosing an already verified available pair keeps direct playback without another search',async()=>{
  const app=host();await app.ready();app.ui().selectNode(app.nodeId(f.held));await app.advance(200);
  const entry=app.requests.findLast(x=>x.request.task==='eligible-swaps');assert(entry);
  const d=model.degree,readyPairs=new Uint8Array(Math.ceil(d*d/8)),readyFirstStatus=new Uint8Array(d);
  for(const [a,b]of [[f.a,f.b],[f.b,f.a]]){const i=a*d+b;readyPairs[i>>>3]|=1<<(i&7);readyFirstStatus[a]=1;}
  await app.respond(entry,{status:'partial',degree:d,knownPairs:new Uint8Array(readyPairs.length),feasiblePairs:readyPairs,firstStatus:readyFirstStatus,readyPairs,readyFirstStatus,readyWitnesses:[{word:[f.move],pairs:[f.a,f.b]}]});
  app.choose();assert.deepEqual(clean(app.ui().state().pair).sort(),[app.nodeId(f.a),app.nodeId(f.b)].sort());
  assert.equal(app.ui().state().held.length,1);assert.equal(app.snapshot().history.length,0,'suggestion only selects; the user still chooses Go');
  assert.equal(app.element('csGo').textContent,'Go');const count=app.requests.length;app.click('csGo');await app.advance(0);
  assert.equal(app.requests.length,count,'a suggested retained witness needs no manual search');assert.equal(app.ui().state().phase,'executing');await app.settleSolver();assert.equal(app.snapshot().history.length,1);
});


test('failed manual checks clear A and B and their anchors but preserve held colors and selections',async()=>{
  for(const result of [{status:'impossible',reason:'outside_orbit'},{status:'invalid',reason:'unsupported_state'},exhausted(3000,null),{status:'unknown',reason:'worker_unavailable'},{status:'solved',moveIndices:[],optimal:false}]){
    const app=host();await app.ready();const heldId=app.nodeId(f.held);app.ui().selectNode(heldId);app.choose();app.click('csGo');const request=app.manual();
    assert.equal(app.ui().visualState().pair.length,2);await app.respond(request,result);
    const state=app.ui().state();assert.deepEqual(clean(state.pair),[],result.status);assert.deepEqual(clean(state.held),[heldId]);
    assert.deepEqual(clean(app.ui().visualState()),{active:true,held:[heldId],pair:[]});
    assert.equal(state.pairTarget,0);assert.equal(state.tool,'swap');assert.equal(state.anchors.some(a=>a.label),false);
    assert.equal(app.element('csRetry').hidden,true);assert.equal(app.element('csGo').disabled,true);assert.equal(app.snapshot().history.length,0);
    const next=model.nodes.find(n=>![f.a,f.b,f.held].includes(n.index)).index;assert(app.ui().selectNode(app.nodeId(next)),'a new A is immediately selectable');assert.equal(app.ui().state().pair.length,1);
  }
});

test('visualState stays lightweight and immediately follows selection changes and execution',async()=>{
  let nodeReads=0,snapshotReads=0,renders=0;
  const app=createPage('cube2',{skipScripts:['constrained-solver.js'],globals:{fetch:async url=>({ok:true,text:async()=>fs.readFileSync(path.join(games,new URL(String(url),'https://atlas.test/games/').pathname.replace(/^\/games\//,'')),'utf8')})}});
  const originalBridge=app.context.PUZZLE_SOLVER_BRIDGE,originalAPI=app.context.PUZZLE_API;
  app.context.PUZZLE_SOLVER_BRIDGE={...originalBridge,nodes:()=>{nodeReads++;return originalBridge.nodes();},requestRender:()=>{renders++;return originalBridge.requestRender();}};
  app.context.PUZZLE_API={...originalAPI,snapshot:()=>{snapshotReads++;return originalAPI.snapshot();}};
  app.document.currentScript={src:'https://atlas.test/games/constrained-solver.js'};app.loadScript('constrained-solver.js');app.document.currentScript=null;
  const ui=app.context.ConstrainedSolverUI;
  assert.deepEqual(clean(ui.visualState()),{active:false,held:[],pair:[]});await ui.setActive(true);
  const ids=originalBridge.nodes().slice(0,3).map(n=>String(n.stickerId));
  let before=renders;ui.selectNode(ids[0]);assert(renders>before,'hold selection requests immediate redraw');
  assert.deepEqual(clean(ui.visualState()),{active:true,held:[ids[0]],pair:[]});
  before=renders;ui.selectNode(ids[0]);assert(renders>before,'unholding requests immediate redraw');assert.deepEqual(clean(ui.visualState().held),[]);
  ui.selectNode(ids[0]);app.click('csPairA');before=renders;ui.selectNode(ids[1]);ui.selectNode(ids[2]);assert(renders>before,'A/B changes request immediate redraw');
  const reads=[nodeReads,snapshotReads];for(let i=0;i<100;i++)ui.visualState();assert.deepEqual([nodeReads,snapshotReads],reads,'render-state reads perform no node, snapshot or eligibility work');
  const v=ui.visualState();v.held.length=0;v.pair.length=0;assert.deepEqual(clean(ui.visualState()),{active:true,held:[ids[0]],pair:[ids[1],ids[2]]},'returned arrays cannot mutate selection state');
  before=renders;app.click('csPairA');assert(renders>before);assert.deepEqual(clean(ui.visualState().pair),[]);
  ui.clearSelection();assert.deepEqual(clean(ui.visualState()),{active:true,held:[],pair:[]});ui.closePanel();assert.deepEqual(clean(ui.visualState()),{active:false,held:[],pair:[]});
});
