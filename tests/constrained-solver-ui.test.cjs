'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createPage}=require('./solver-dom.cjs');
const games=path.join(__dirname,'../dist/games');
const clean=x=>JSON.parse(JSON.stringify(x));
const model=id=>JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models',id+'.json'),'utf8'));

function host(id='cube2'){
  const workers=[];
  class DeferredWorker{
    constructor(url){this.url=String(url);this.listeners={};this.terminated=false;workers.push(this);}
    postMessage(request){this.request=clean(request);}
    addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}
    removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(f=>f!==fn);}
    terminate(){this.terminated=true;}
    reply(data,force=false){if(this.terminated&&!force)return;const event={data};this.onmessage?.(event);for(const fn of this.listeners.message||[])fn(event);}
  }
  const app=createPage(id,{globals:{Worker:DeferredWorker,fetch:async url=>{
    const file=path.join(games,new URL(String(url),'https://atlas.test/games/').pathname.replace(/^\/games\//,''));
    return {ok:fs.existsSync(file),text:async()=>fs.readFileSync(file,'utf8')};
  }}});
  app.workers=workers;app.ui=()=>app.context.ConstrainedSolverUI;app.core=()=>app.context.ConstrainedSolverCore;app.model=model(id);
  app.ready=async()=>{app.ui().setActive(true);for(let i=0;i<60&&app.ui().state().phase==='loading';i++)await app.advance(0);assert.equal(app.ui().state().phase,'selecting');};
  app.nodeIds=(nodes,snapshot=app.snapshot())=>nodes.map(n=>app.core().mapSnapshot(app.model,snapshot).nodeToSticker[n]);
  app.choose=async({held=[],pair})=>{app.ui().setTool('hold');for(const id of app.nodeIds(held))app.ui().selectNode(id);app.ui().setTool('swap');for(const id of app.nodeIds(pair))app.ui().selectNode(id);assert.equal(app.ui().state().phase,'selecting');app.click('csGo');await app.flush();};
  app.payload=async(override={})=>{
    const q=app.workers.at(-1).request,responses=[];
    const ctx={URL,performance,TextEncoder,console,fetch:async url=>({ok:true,text:async()=>fs.readFileSync(path.join(games,new URL(url).pathname.replace(/^\/games\//,'')),'utf8')}),location:{href:'https://atlas.test/games/constrained-solver-worker.js'},postMessage:result=>responses.push(clean(result))};
    ctx.self=ctx;ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(games,'constrained-solver-worker.js'),'utf8'),ctx);
    await ctx.onmessage({data:clean(q)});return {...responses.at(-1),...override};
  };
  return app;
}
function oneMoveCase(m){
  const occupied=new Set(m.initialOccupied||Array.from({length:m.degree},(_,i)=>i));
  for(let i=0;i<m.moves.length;i++){const p=m.moves[i].perm;for(const a of occupied)if(p[a]!==a&&occupied.has(p[a])&&p[p[a]]===a){const held=p.findIndex((v,k)=>v===k&&occupied.has(k));if(held>=0)return {move:i,pair:[a,p[a]],held:[held]};}}
  throw Error('Model has no suitable half-turn');
}
function assertRequestSatisfied(app,before,request){
  const first=app.core().mapSnapshot(app.model,before),last=app.core().mapSnapshot(app.model,app.snapshot());
  for(const node of request.protected)assert.equal(last.stickerToNode[first.nodeToSticker[node]],node,'protected sticker returned to original node');
  assert.equal(last.stickerToNode[first.nodeToSticker[request.swap[0]]],request.swap[1]);
  assert.equal(last.stickerToNode[first.nodeToSticker[request.swap[1]]],request.swap[0]);
}

test('inactive solver leaves normal ring turns unchanged and keeps solver help out of the ring panel',async()=>{
  const app=host();assert.equal(app.ui().state().active,false);assert.equal(app.workers.length,0);
  assert.equal(app.element('csReadme'),null);assert.equal(app.element('csNodeOverlay').hidden,true);
  app.click('cw');await app.settle();assert.equal(app.snapshot().history.length,1);
  await app.ready();assert.equal(app.element('csNodeOverlay').hidden,false);
  assert.equal(app.element('csReadmeToggle'),null);
  app.ui().setActive(false);assert.equal(app.element('csReadme'),null);assert.equal(app.element('csNodeOverlay').hidden,true);
  app.click('cw');await app.settle();assert.equal(app.snapshot().history.length,2);
});

test('held selection and explicit Go execute a verified sequence and clear endpoints while retaining holds',async()=>{
  const app=host(),c=oneMoveCase(app.model);await app.ready();const before=app.snapshot();
  await app.choose(c);assert.equal(app.workers.length,1);assert.equal(app.ui().state().phase,'solving');
  const payload=await app.payload();assert.equal(payload.result.status,'solved');app.workers[0].reply(payload);await app.settle();
  assert.equal(app.ui().state().phase,'selecting');assertRequestSatisfied(app,before,payload.request);
  assert.equal(app.snapshot().history.length,payload.result.moveIndices.length);assert.deepEqual(Array.from(app.ui().state().pair),[]);assert.deepEqual(Array.from(app.ui().state().held),app.nodeIds(c.held,before));
});

test('node picking never triggers the ring drag or manual keyboard move handlers',async()=>{
  const app=host();await app.ready();const bridge=app.context.PUZZLE_SOLVER_BRIDGE,point=bridge.nodes()[0],overlay=app.element('csNodeOverlay');
  const event={clientX:point.x,clientY:point.y,pointerId:44};overlay.dispatch('pointerdown',event);overlay.dispatch('pointerup',event);await app.advance(1000);
  assert.equal(app.ui().state().held.length,1);assert.equal(app.snapshot().history.length,0);
  app.element('rings').dispatch('keydown',{key:'R'});app.element('rings').dispatch('keydown',{key:'ArrowRight'});await app.advance(1000);
  assert.equal(app.snapshot().history.length,0,'active selection mode intercepts old manual moves');
  app.ui().setActive(false);app.element('rings').dispatch('keydown',{key:'R'});await app.settle();assert.equal(app.snapshot().history.length,1);
});

test('puzzle letter shortcuts remain blocked while a solver toolbar button has focus',async()=>{
  const app=host();await app.ready();app.element('csSwap').focus();app.element('csSwap').dispatch('keydown',{key:'R'});await app.advance(1000);
  assert.equal(app.snapshot().history.length,0,'button focus must not leak into the native document move shortcut');
});

test('held nodes cannot also be a swap endpoint; selecting one endpoint twice does not launch',async()=>{
  const app=host(),c=oneMoveCase(app.model);await app.ready();app.ui().setTool('hold');const [held]=app.nodeIds(c.held);app.ui().selectNode(held);app.ui().setTool('swap');app.ui().selectNode(held);assert.equal(app.workers.length,0);
  const [one]=app.nodeIds(c.pair);app.ui().selectNode(one);app.ui().selectNode(one);await app.flush();assert.equal(app.workers.length,0);assert.equal(app.snapshot().history.length,0);
});

test('impossible and unknown responses do not execute any moves and remain distinct',async()=>{
  for(const status of ['impossible','unknown']){
    const app=host(),c=oneMoveCase(app.model);await app.ready();await app.choose(c);
    const payload=await app.payload({result:{status,reason:status==='unknown'?'request_time_limit':'no_pair_transporter',optimal:false},engineMoves:undefined});
    app.workers[0].reply(payload);await app.advance(1000);assert.equal(app.snapshot().history.length,0);assert.equal(app.ui().state().result.status,status);assert.equal(app.ui().state().phase,'selecting');
  }
});

test('hard worker time limit terminates computation and leaves the puzzle unchanged',async()=>{
  const app=host(),c=oneMoveCase(app.model);await app.ready();await app.choose(c);const worker=app.workers[0];
  worker.reply({id:worker.request.id,type:'progress',stage:'planning'});
  await app.advance(6001); // initial 3s compute slice plus the worker watchdog grace
  assert.equal(worker.terminated,true);assert.equal(app.ui().state().result.status,'unknown');assert.equal(app.snapshot().history.length,0);assert.equal(app.ui().state().phase,'selecting');
});

test('cancelled or externally stale replies cannot execute a sequence',async()=>{
  const app=host(),c=oneMoveCase(app.model);await app.ready();await app.choose(c);const worker=app.workers[0],payload=await app.payload();app.ui().cancel();worker.reply(payload,true);await app.advance(1000);assert.equal(app.snapshot().history.length,0);assert.equal(app.ui().state().phase,'selecting');
  app.ui().clearSelection();await app.choose(c);const second=app.workers.at(-1),reply=await app.payload();app.context.PUZZLE_API.move('R');await app.settle();const length=app.snapshot().history.length;second.reply(reply,true);await app.advance(1000);assert.equal(app.snapshot().history.length,length,'stale state prevented automatic execution');
});

test('a forged sequence or model fingerprint is rejected before the puzzle moves',async()=>{
  for(const tamper of ['sequence','fingerprint']){
    const app=host(),c=oneMoveCase(app.model);await app.ready();await app.choose(c);const payload=await app.payload();
    if(tamper==='sequence')payload.result.moveIndices=[];else payload.modelFingerprint='wrong-model';
    app.workers[0].reply(payload);await app.advance(1000);assert.equal(app.snapshot().history.length,0);
  }
});

test('long legal solutions execute all moves across the 300-move game API boundary',async()=>{
  const app=host(),c=oneMoveCase(app.model);await app.ready();const before=app.snapshot();await app.choose(c);const payload=await app.payload();
  assert.equal(payload.result.status,'solved');const first=0,undo=app.model.moves[first].inverse,indices=[];
  for(let i=0;i<160;i++)indices.push(first,undo);indices.push(...payload.result.moveIndices);
  payload.result={...payload.result,moveIndices:indices,sequence:indices.map(i=>app.model.moves[i].name),permutation:app.core().permutation(app.model,indices),optimal:false};payload.engineMoves=indices.map(i=>app.model.moves[i].engineMove);
  app.workers[0].reply(payload);await app.settle(1200);assert.equal(app.snapshot().history.length,indices.length);assertRequestSatisfied(app,before,payload.request);
});

test('pause and resume remain usable during constrained-solver execution',async()=>{
  const app=host();await app.ready();await app.choose({held:[1],pair:[0,3]});const payload=await app.payload();assert.equal(payload.result.status,'solved');
  // Pad the independently verified witness with cancelling turns so this tests
  // pause timing even when the color solver finds a single-move solution.
  const padding=Array.from({length:3},()=>[0,app.model.moves[0].inverse]).flat(),indices=[...padding,...payload.result.moveIndices];
  payload.result={...payload.result,moveIndices:indices,sequence:indices.map(i=>app.model.moves[i].name),permutation:app.core().permutation(app.model,indices),optimal:false};payload.engineMoves=indices.map(i=>app.model.moves[i].engineMove);
  app.element('speed').value='1';app.element('speed').dispatch('input');app.workers[0].reply(payload);await app.advance(0);await app.advance(200);app.click('pause');assert.equal(app.snapshot().paused,true);
  const atPause=app.snapshot().history.length;await app.advance(5000);assert.equal(app.snapshot().history.length,atPause);assert.equal(app.ui().state().phase,'executing');
  app.click('pause');assert.equal(app.snapshot().paused,false);await app.settle();assert.equal(app.snapshot().history.length,payload.result.moveIndices.length);
});

test('a shape-changing puzzle executes against occupied geometric addresses',async()=>{
  const app=host('pyramorphix'),c=oneMoveCase(app.model);await app.ready();const before=app.snapshot();await app.choose(c);const payload=await app.payload();assert.equal(payload.result.status,'solved');
  app.workers[0].reply(payload);await app.settle();assertRequestSatisfied(app,before,payload.request);assert.equal(app.snapshot().history.length,payload.result.moveIndices.length);assert.deepEqual(Array.from(app.ui().state().pair),[]);assert.deepEqual(Array.from(app.ui().state().held),app.nodeIds(c.held,before));
});

test('readme content and controls are absent from the ring panel in every feature state',async()=>{
  const app=host();assert.equal(app.element('csReadme'),null);assert.equal(app.element('csReadmeToggle'),null);await app.ready();
  assert.equal(app.element('ringPanel').querySelectorAll('math').length,0);
  assert.equal(Object.hasOwn(app.ui().state(),'readmeOpen'),false);
  app.ui().setActive(false);assert.equal(app.element('csReadme'),null);assert.equal(app.element('csReadmeToggle'),null);
});

test('all 34 game pages expose an optional solver and enter selection mode without changing their state',async()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models/manifest.json'),'utf8'));
  const ids=Array.isArray(manifest)?manifest.map(x=>x.id):manifest.models?.map(x=>x.id)||manifest.puzzles?.map(x=>x.id);
  assert.equal(ids.length,34);
  for(const id of ids){const app=host(id),before=JSON.stringify(app.snapshot().stickers);assert(app.element('constrainedSolverToggle'),id);await app.ready();assert.equal(JSON.stringify(app.snapshot().stickers),before,id+' activation preserves state');assert.equal(app.context.PUZZLE_SOLVER_BRIDGE.nodes().length,app.model.stickerCount,id+' all physical nodes selectable');app.ui().setActive(false);assert.equal(app.element('csReadme'),null,id);}
});

test('toggle holds and Go preserve stationary references during playback and only holds afterward',async()=>{
  const app=host(),c=oneMoveCase(app.model);await app.ready();const before=app.snapshot(),[fixed]=app.nodeIds(c.held),pairIds=app.nodeIds(c.pair);
  app.ui().selectNode(fixed);assert.deepEqual(Array.from(app.ui().state().held),[fixed]);
  app.ui().selectNode(fixed);assert.equal(app.ui().state().held.length,0,'Selecting the same node releases it');
  app.click('csHold');app.ui().selectNode(fixed);app.click('csSwap');for(const id of pairIds)app.ui().selectNode(id);
  assert.equal(app.ui().state().phase,'selecting');assert.equal(app.snapshot().history.length,0);assert.equal(app.workers.length,0,'choosing B does not plan or move');
  await app.advance(0);const anchors=clean(app.ui().state().anchors);assert.equal(anchors.length,3);assert.deepEqual(anchors.filter(a=>a.label).map(a=>a.label),['A','B']);
  const layer=app.element('csAnchorBackdrop'),marks=[];layer.drawing.clearRect=()=>marks.length=0;layer.drawing.arc=(x,y,r)=>marks.push({x,y,r});
  const g=app.model.moves.findIndex(m=>m.perm[c.held[0]]!==c.held[0]),inv=app.model.moves.findIndex(m=>m.perm.every((x,j)=>app.model.moves[g].perm[x]===j));assert(g>=0&&inv>=0);
  app.click('csGo');const worker=app.workers.at(-1),indices=[g,inv,c.move];
  worker.reply({id:worker.request.id,type:'result',result:{status:'solved',moveIndices:indices,optimal:false},modelFingerprint:app.core().modelFingerprint(app.model)});
  await app.advance(45);assert.equal(app.ui().state().phase,'executing');assert.deepEqual(clean(app.ui().state().anchors),anchors);
  app.element('rings').bounds={left:0,top:0,width:650,height:460};app.win.dispatch('resize');await app.advance(0);
  const v=app.context.PUZZLE_SOLVER_BRIDGE.viewport();for(const a of anchors)assert(marks.some(m=>Math.hypot(m.x-v.x-a.x*v.scale,m.y-v.y-a.y*v.scale)<1e-6),'reference follows the viewport, not a moving piece');
  await app.settle();assert.deepEqual(Array.from(app.ui().state().held),[fixed]);assert.deepEqual(Array.from(app.ui().state().pair),[]);assert.deepEqual(clean(app.ui().state().anchors).map(({r,...a})=>a),anchors.filter(a=>a.id===fixed).map(({r,...a})=>a));assert.equal(app.ui().state().pairTarget,0);assert.equal(app.element('csGo').disabled,true);
  const end=app.core().mapSnapshot(app.model,app.snapshot());assert.equal(end.stickerToNode[pairIds[0]],c.pair[1]);assert.equal(end.stickerToNode[pairIds[1]],c.pair[0]);
  assert.equal(layer.hidden,false);assert.equal(app.element('csStepProgressBar').value,3);assert.equal(app.element('csStepProgressBar').max,3);
  app.click('csClear');await app.advance(0);assert.equal(app.ui().state().anchors.length,0);
});
