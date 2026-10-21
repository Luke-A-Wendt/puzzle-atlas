'use strict';

// The manual UI only offers verified swaps. Retained bounded searches remain
// backend capabilities, not a selectable question-mark workflow.
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
  app.pending=async()=>{await app.advance(100);const entry=requests.findLast(x=>x.request.task==='eligible-swaps');assert(entry);return entry;};
  app.settleSolver=async()=>{for(let i=0;i<80;i++){await app.advance(2000);const state=app.ui().state(),snap=app.snapshot();if(!snap.animating&&snap.mode==='idle'&&!['solving','executing','auto-gap'].includes(state.phase))return;}throw Error('Solver did not settle');};
  return app;
}

function readyResult(){
  const d=model.degree,readyPairs=new Uint8Array(Math.ceil(d*d/8)),readyFirstStatus=new Uint8Array(d);
  for(const [a,b]of [[f.a,f.b],[f.b,f.a]]){const i=a*d+b;readyPairs[i>>>3]|=1<<(i&7);readyFirstStatus[a]=1;}
  return {status:'partial',degree:d,knownPairs:new Uint8Array(readyPairs.length),feasiblePairs:readyPairs,firstStatus:readyFirstStatus,readyPairs,readyFirstStatus,readyWitnesses:[{word:[f.move],pairs:[f.a,f.b]}]};
}

test('pending and unresolved eligibility never launches a manual search or exposes Continue',async()=>{
  const app=host();await app.ready();app.ui().setTool('swap');
  assert.equal(app.ui().selectNode(app.nodeId(f.a)),false);
  const entry=await app.pending();await app.respond(entry,{status:'unknown',reason:'time_limit'});
  assert.equal(app.ui().selectNode(app.nodeId(f.a)),false);app.ui().go();
  assert.equal(app.manual(),undefined);assert.equal(app.ui().state().search,null);
  assert.equal(app.element('csRetry').hidden,true);assert.equal(app.element('csCancel').hidden,true);
  assert.equal(app.ui().state().phase,'selecting');assert.equal(app.ui().state().pairTarget,0);
  assert.equal(app.snapshot().history.length,0);assert.match(app.ui().state().status,/No verified swap ready/);
});

test('gray unresolved nodes draw no question marks and remain available to the Hold tool',async()=>{
  const app=host();await app.ready();const entry=await app.pending();await app.respond(entry,{status:'unknown',reason:'time_limit'});
  const overlay=app.element('csNodeOverlay'),texts=[],fills=[],ctx=overlay.drawing;
  ctx.fillText=text=>texts.push(String(text));ctx.fill=()=>fills.push(ctx.fillStyle);
  app.ui().setTool('swap');await app.advance(0);
  assert(!texts.includes('?'),'unresolved options no longer show a question mark');
  assert(fills.includes('rgba(20,21,29,.78)'),'unresolved choices use the unavailable gray mask');
  const id=app.nodeId(f.a);assert.equal(app.ui().selectNode(id),false);
  app.ui().setTool('hold');assert.equal(app.ui().selectNode(id),true);assert.deepEqual(clean(app.ui().state().held),[id]);
  assert.equal(app.ui().selectNode(id),true);assert.deepEqual(clean(app.ui().state().held),[]);
  assert.equal(app.manual(),undefined);
});

test('an eligibility result can promote a pending gray pair to a playable verified pair',async()=>{
  const app=host();await app.ready();app.ui().setTool('swap');assert.equal(app.ui().selectNode(app.nodeId(f.a)),false);
  const entry=await app.pending();await app.respond(entry,readyResult());
  assert(app.ui().state().eligibility.ready.includes(app.nodeId(f.a)));app.choose();await app.advance(0);
  assert.equal(app.ui().state().phase,'executing');assert.equal(app.manual(),undefined);
  assert.equal(app.snapshot().history.length,0);await app.settleSolver();assert.equal(app.snapshot().history.length,1);
});

test('selecting an unverified second tile leaves the first choice intact without searching',async()=>{
  const app=host();await app.ready();await app.respond(await app.pending(),readyResult());
  app.ui().setTool('swap');assert.equal(app.ui().selectNode(app.nodeId(f.a)),true);
  const other=model.nodes.find(n=>![f.a,f.b].includes(n.index)).index;
  assert.equal(app.ui().selectNode(app.nodeId(other)),false);
  assert.deepEqual(clean(app.ui().state().pair),[app.nodeId(f.a)]);assert.equal(app.ui().state().pairTarget,1);
  assert.equal(app.manual(),undefined);assert.equal(app.snapshot().history.length,0);
  assert.equal(app.ui().selectNode(app.nodeId(f.b)),true);await app.advance(0);await app.settleSolver();assert.equal(app.snapshot().history.length,1);
});

test('changed holds reject stale positive eligibility while a new table is pending',async()=>{
  const app=host();await app.ready();const old=await app.pending(),result=readyResult();await app.respond(old,result);
  const blocking=model.nodes.find(n=>![f.a,f.b].includes(n.index)&&model.nodes[model.moves[f.move].perm[n.index]].color!==n.color).index;
  app.ui().setTool('hold');assert(app.ui().selectNode(app.nodeId(blocking)));app.ui().setTool('swap');
  assert.equal(app.ui().selectNode(app.nodeId(f.a)),false);const fresh=await app.pending();assert.notEqual(fresh,old);
  await app.respond(old,result,{force:true});assert.equal(app.ui().selectNode(app.nodeId(f.a)),false);
  assert.equal(app.ui().state().eligibility.ready.length,0);assert.equal(app.manual(),undefined);assert.equal(app.snapshot().history.length,0);
});

test('closing during the verified pause prevents playback and late eligibility from restoring selections',async()=>{
  const app=host();await app.ready();const entry=await app.pending(),result=readyResult();await app.respond(entry,result);
  app.choose();await app.advance(0);assert.equal(app.ui().state().phase,'executing');
  app.click('ringModeDefault');await app.advance(1000);await app.respond(entry,result,{force:true});
  assert.equal(app.ui().state().active,false);assert.equal(app.snapshot().history.length,0);assert.deepEqual(clean(app.ui().visualState().pair),[]);
});

test('Auto Solve remains independent when no verified manual pair is available',async()=>{
  const app=host();app.context.PUZZLE_API.move('R');await app.settleSolver();await app.ready();
  const entry=await app.pending();await app.respond(entry,{status:'unknown',reason:'time_limit'});app.ui().selectNode(app.nodeId(f.held));
  app.ui().setTool('swap');assert.equal(app.ui().selectNode(app.nodeId(f.a)),false);
  app.click('solve');for(let i=0;i<40&&!app.requests.some(x=>x.request.task==='full-solve');i++)await app.advance(0);
  const full=app.requests.findLast(x=>x.request.task==='full-solve');assert(full);assert.equal(app.manual(),undefined);
  assert.deepEqual(clean(app.ui().state().pair),[]);assert.deepEqual(clean(app.ui().state().held),[]);
  assert.equal(full.request.options.maxMs,15000);assert.equal(app.ui().state().phase,'solving');
  app.ui().cancel();assert.equal(full.worker.terminated,true);assert.equal(app.ui().state().active,false);
});

test('visualState remains a lightweight snapshot while a verified pair is displayed',async()=>{
  const app=host();await app.ready();await app.respond(await app.pending(),readyResult());
  app.ui().selectNode(app.nodeId(f.held));
  // Holding this same-color face location still admits U2; provide the new table.
  await app.respond(await app.pending(),readyResult());app.choose();await app.advance(0);
  const state=app.ui().visualState(),expected=clean(state);state.held.length=0;state.pair.length=0;
  assert.deepEqual(clean(app.ui().visualState()),expected,'returned arrays cannot mutate live selections');
  assert.equal(expected.pair.length,2);assert.equal(expected.held.length,1);
  app.ui().stop();await app.advance(500);assert.deepEqual(clean(app.ui().visualState().pair),[]);assert.equal(app.ui().state().held.length,1);
});
