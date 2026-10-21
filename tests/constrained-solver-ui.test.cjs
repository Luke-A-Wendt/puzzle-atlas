'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createPage}=require('./solver-dom.cjs');
const {offerVerifiedSwap}=require('./verified-swap-fixture.cjs');
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
  app.choose=async({held=[],pair,move,word=[move]})=>{app.ui().setTool('hold');for(const id of app.nodeIds(held))app.ui().selectNode(id);const request=app.core().requestFromSnapshot(app.model,app.snapshot(),{protectedStickerIds:app.nodeIds(held),swapStickerIds:app.nodeIds(pair),holdSemantics:'color'});await offerVerifiedSwap(app,app.model,...pair,word);app.ui().setTool('swap');for(const id of app.nodeIds(pair))app.ui().selectNode(id);await app.advance(0);return request;};
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
  if(request.colorByNode){
    const colors=app.core().colorsFromSnapshot(app.model,app.snapshot(),last);
    for(const node of request.protected)assert.equal(colors[node],request.colorByNode[node],'protected location retains its requested color');
    assert.equal(colors[request.swap[0]],request.colorByNode[request.swap[1]],'first endpoint receives the second requested color');
    assert.equal(colors[request.swap[1]],request.colorByNode[request.swap[0]],'second endpoint receives the first requested color');
  }else{
    for(const node of request.protected)assert.equal(last.stickerToNode[first.nodeToSticker[node]],node,'protected sticker returned to original node');
    assert.equal(last.stickerToNode[first.nodeToSticker[request.swap[0]]],request.swap[1]);
    assert.equal(last.stickerToNode[first.nodeToSticker[request.swap[1]]],request.swap[0]);
  }
}

test('inactive solver leaves normal ring turns unchanged and keeps solver help out of the ring panel',async()=>{
  const app=host();assert.equal(app.ui().state().active,false);assert.equal(app.workers.length,0);
  assert.equal(app.element('csReadme'),null);assert.equal(app.element('csNodeOverlay').hidden,true);
  app.context.PUZZLE_API.select('R');app.click('cw');await app.settle();assert.equal(app.snapshot().history.length,1);
  await app.ready();assert.equal(app.element('csNodeOverlay').hidden,false);
  assert.equal(app.element('csReadmeToggle'),null);
  app.ui().setActive(false);assert.equal(app.element('csReadme'),null);assert.equal(app.element('csNodeOverlay').hidden,true);
  app.context.PUZZLE_API.select('R');app.click('cw');await app.settle();assert.equal(app.snapshot().history.length,2);
});

test('held selection and the second endpoint execute a verified sequence and clear endpoints while retaining holds',async()=>{
 const app=host(),c=oneMoveCase(app.model);await app.ready();const before=app.snapshot(),request=await app.choose(c);
 assert.equal(app.ui().state().phase,'executing');assert.equal(app.workers.filter(w=>w.request?.task==='manual-swap').length,0);await app.advance(350);await app.settle();
 assert.equal(app.ui().state().phase,'selecting');assertRequestSatisfied(app,before,request);assert.equal(app.snapshot().history.length,1);assert.deepEqual(Array.from(app.ui().state().pair),[]);assert.deepEqual(Array.from(app.ui().state().held),app.nodeIds(c.held,before));
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

test('verified held nodes may be swap endpoints and selecting one twice does not launch',async()=>{
 const app=host(),c=oneMoveCase(app.model);await app.ready();const [one]=app.nodeIds(c.pair);app.ui().selectNode(one);await offerVerifiedSwap(app,app.model,...c.pair,[c.move]);app.ui().setTool('swap');app.ui().selectNode(one);
 assert.deepEqual(Array.from(app.ui().state().pair),[one]);assert.deepEqual(Array.from(app.ui().state().held),[one]);assert.deepEqual(Array.from(app.ui().state().effectiveHeld),[]);
 app.ui().selectNode(one);await app.advance(0);assert.equal(app.snapshot().history.length,0);assert.equal(app.workers.filter(w=>w.request?.task==='manual-swap').length,0);
});

test('impossible and unknown eligibility are both unavailable and do not execute moves',async()=>{
 for(const status of ['impossible','unknown']){
  const app=host(),c=oneMoveCase(app.model);await app.ready();await app.advance(200);const worker=app.workers.at(-1);worker.reply({id:worker.request.id,type:'result',result:{status},modelFingerprint:app.core().modelFingerprint(app.model)});await app.advance(0);
  app.ui().setTool('swap');for(const id of app.nodeIds(c.pair))assert.equal(app.ui().selectNode(id),false);assert.equal(app.snapshot().history.length,0);assert.equal(app.ui().state().phase,'selecting');assert.equal(app.workers.filter(w=>w.request?.task==='manual-swap').length,0);
 }
});

test('pending eligibility cannot launch a swap and closing the mode terminates its worker',async()=>{
 const app=host(),c=oneMoveCase(app.model);await app.ready();await app.advance(200);const worker=app.workers.at(-1);app.ui().setTool('swap');for(const id of app.nodeIds(c.pair))assert.equal(app.ui().selectNode(id),false);
 app.ui().setActive(false);assert.equal(worker.terminated,true);assert.equal(app.snapshot().history.length,0);assert.equal(app.ui().state().phase,'off');
});

test('cancelled preview and stale eligibility replies cannot execute a sequence',async()=>{
 const app=host(),c=oneMoveCase(app.model);await app.ready();await app.choose(c);app.ui().stop();await app.advance(1000);assert.equal(app.snapshot().history.length,0);assert.equal(app.ui().state().phase,'selecting');
 app.ui().clearSelection();await app.advance(200);const worker=app.workers.at(-1),payload=await app.payload();app.ui().setActive(false);app.context.PUZZLE_API.move('R');await app.settle();const length=app.snapshot().history.length;worker.reply(payload,true);await app.advance(1000);assert.equal(app.snapshot().history.length,length);assert.equal(app.ui().state().active,false);
});

test('a forged ready sequence or eligibility model fingerprint is rejected before playback',async()=>{
 const app=host(),c=oneMoveCase(app.model);await app.ready();await app.choose({...c,word:[]});await app.advance(1000);assert.equal(app.snapshot().history.length,0);assert.deepEqual(Array.from(app.ui().state().pair),[]);
 const other=host();await other.ready();await other.advance(200);const worker=other.workers.at(-1),payload=await other.payload();payload.modelFingerprint='wrong-model';worker.reply(payload);await other.advance(0);other.ui().setTool('swap');for(const id of other.nodeIds(c.pair))assert.equal(other.ui().selectNode(id),false);assert.equal(other.snapshot().history.length,0);
});

test('long verified solutions execute all moves across the 300-move game API boundary',async()=>{
 const app=host(),c=oneMoveCase(app.model);await app.ready();const before=app.snapshot(),indices=[];for(let i=0;i<160;i++)indices.push(0,app.model.moves[0].inverse);indices.push(c.move);
 const request=await app.choose({...c,word:indices});await app.advance(350);await app.settle(1200);assert.equal(app.snapshot().history.length,indices.length);assertRequestSatisfied(app,before,request);
});

test('Stop commits only the active legal turn and returns to manual selection',async()=>{
 const app=host(),c=oneMoveCase(app.model);await app.ready();const indices=[0,app.model.moves[0].inverse,c.move],before=app.snapshot();app.element('speed').value='1';app.element('speed').dispatch('input');await app.choose({...c,word:indices});await app.advance(350);await app.advance(200);app.click('pause');assert.equal(app.snapshot().paused,false);assert.equal(app.ui().state().phase,'executing');
 await app.settle();assert.equal(app.snapshot().history.length,1);const start=app.core().mapSnapshot(app.model,before).stickerToNode,end=app.core().mapSnapshot(app.model,app.snapshot()).stickerToNode;for(const [id,node]of Object.entries(start))assert.equal(end[id],app.model.moves[indices[0]].perm[node]);assert.equal(app.ui().state().held.length,0);assert.equal(app.ui().state().active,true);assert.deepEqual(Array.from(app.ui().state().pair),[]);assert.equal(String(app.element('speed').value),'1');
});

test('a shape-changing puzzle executes a verified word against occupied geometric addresses',async()=>{
 const app=host('pyramorphix'),c=oneMoveCase(app.model);await app.ready();const before=app.snapshot(),request=await app.choose(c);await app.advance(350);await app.settle();assertRequestSatisfied(app,before,request);assert.equal(app.snapshot().history.length,1);assert.deepEqual(Array.from(app.ui().state().pair),[]);assert.deepEqual(Array.from(app.ui().state().held),app.nodeIds(c.held,before));
});

test('readme content and controls are absent from the ring panel in every feature state',async()=>{
  const app=host();assert.equal(app.element('csReadme'),null);assert.equal(app.element('csReadmeToggle'),null);await app.ready();
  assert.equal(app.element('ringPanel').querySelectorAll('math').length,0);
  assert.equal(Object.hasOwn(app.ui().state(),'readmeOpen'),false);
  app.ui().setActive(false);assert.equal(app.element('csReadme'),null);assert.equal(app.element('csReadmeToggle'),null);
});

test('all catalog game pages expose an optional solver and enter selection mode without changing their state',async()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models/manifest.json'),'utf8'));
  const ids=Array.isArray(manifest)?manifest.map(x=>x.id):manifest.models?.map(x=>x.id)||manifest.puzzles?.map(x=>x.id);
  assert.equal(ids.length,37);assert(ids.includes('axis'));assert(ids.includes('cube9'));assert(ids.includes('cube10'));
  for(const id of ids){const app=host(id),before=JSON.stringify(app.snapshot().stickers);assert(app.element('constrainedSolverToggle'),id);await app.ready();assert.equal(app.context.PuzzleAxisDisplay.labelMode(),'none',id+' manual setup preserves labels');assert.equal(app.context.PuzzleAxisDisplay.highlights3D(),true,id+' manual setup highlights');assert.equal(app.ui().blocksManualMoves(),true,id+' manual moves blocked');assert.equal(JSON.stringify(app.snapshot().stickers),before,id+' activation preserves state');assert.equal(app.context.PUZZLE_SOLVER_BRIDGE.nodes().length,app.model.stickerCount,id+' all physical nodes selectable');app.ui().setActive(false);assert.equal(app.context.PuzzleAxisDisplay.labelMode(),'none',id+' label preference retained');assert.equal(app.context.PuzzleAxisDisplay.highlights3D(),true,id+' outline preference retained');assert.equal(app.ui().blocksManualMoves(),false,id+' manual moves unlocked');assert.equal(app.element('csReadme'),null,id);}
});

test('toggle holds and automatic execution preserve stationary references during playback and only holds afterward',async()=>{
  const app=host(),c=oneMoveCase(app.model);await app.ready();const before=app.snapshot(),[fixed]=app.nodeIds(c.held),pairIds=app.nodeIds(c.pair);
  app.ui().selectNode(fixed);assert.deepEqual(Array.from(app.ui().state().held),[fixed]);
  app.ui().selectNode(fixed);assert.equal(app.ui().state().held.length,0,'Selecting the same node releases it');
  app.click('csHold');app.ui().selectNode(fixed);const g=app.model.moves.findIndex(m=>m.perm[c.held[0]]!==c.held[0]),inv=app.model.moves[g].inverse,indices=[g,inv,c.move];await offerVerifiedSwap(app,app.model,...c.pair,indices);app.click('csSwap');for(const id of pairIds)app.ui().selectNode(id);
  assert.equal(app.ui().state().phase,'solving');assert.equal(app.snapshot().history.length,0);assert.equal(app.workers.length,1,'choosing endpoint 2 begins checking without moving');
  await app.advance(0);const anchors=clean(app.ui().state().anchors);assert.equal(anchors.length,3);assert.deepEqual(anchors.filter(a=>a.label).map(a=>a.label),['1','2']);
  const layer=app.element('csAnchorBackdrop'),marks=[];layer.drawing.clearRect=()=>marks.length=0;layer.drawing.arc=(x,y,r)=>marks.push({x,y,r});
  assert(g>=0&&inv>=0);
  app.context.PuzzleAxisDisplay.choose('U');assert.equal(String(app.element('speed').value),'5','manual playback preserves the user rate');assert.equal(app.workers.filter(w=>w.request?.task==='manual-swap').length,0);
  await app.advance(350);await app.advance(45);assert.equal(app.ui().state().phase,'executing');assert.equal(String(app.element('speed').value),'5');assert.deepEqual(clean(app.ui().state().anchors),anchors);
  app.element('rings').bounds={left:0,top:0,width:650,height:460};app.win.dispatch('resize');await app.advance(0);
  const v=app.context.PUZZLE_SOLVER_BRIDGE.viewport();for(const a of anchors)assert(marks.some(m=>Math.hypot(m.x-v.x-a.x*v.scale,m.y-v.y-a.y*v.scale)<1e-6),'reference follows the viewport, not a moving piece');
  await app.settle();assert.deepEqual(Array.from(app.ui().state().held),[fixed]);assert.deepEqual(Array.from(app.ui().state().pair),[]);assert.deepEqual(clean(app.ui().state().anchors).map(({r,...a})=>a),anchors.filter(a=>a.id===fixed).map(({r,...a})=>a));assert.equal(app.ui().state().pairTarget,0);assert.equal(app.element('csGo'),null);
  const end=app.core().mapSnapshot(app.model,app.snapshot());assert.equal(end.stickerToNode[pairIds[0]],c.pair[1]);assert.equal(end.stickerToNode[pairIds[1]],c.pair[0]);
  assert.equal(String(app.element('speed').value),'5','manual completion retains the chosen rate');assert.equal(app.context.PuzzleAxisDisplay.selection('U'),null,'completed manual playback clears the previously highlighted axis');assert.equal(layer.hidden,false);assert.equal(app.element('csStepProgressBar').value,3);assert.equal(app.element('csStepProgressBar').max,3);
  app.click('csClear');await app.advance(0);assert.equal(app.ui().state().anchors.length,0);
});

test('solver mode changes clear display selection without changing puzzle moves and preserve speed on cancelled checking',async()=>{
  const app=host(),display=app.context.PuzzleAxisDisplay,c=oneMoveCase(app.model);
  assert(display,'all games load the common display state');
  display.choose('R');display.hover('F');assert.equal(display.selection('R'),'R');
  const before=JSON.stringify(app.snapshot().stickers);
  await app.ready();assert.equal(display.selection('R'),null);assert.equal(display.hovered(),null);
  assert.equal(JSON.stringify(app.snapshot().stickers),before,'changing display mode does not turn stickers');
  assert.equal(app.element('csPairA').querySelector('.cs-slot-label').textContent,'1');
  assert.equal(app.element('csPairB').querySelector('.cs-slot-label').textContent,'2');
  await app.choose(c);assert.equal(String(app.element('speed').value),'5');
  app.ui().stop();assert.equal(String(app.element('speed').value),'5');
  assert.deepEqual(Array.from(app.ui().state().pair),[]);
  display.choose('F');assert.equal(display.selection('F'),null,'idle constrained mode does not highlight a rotation axis');app.click('ringModeDefault');
  assert.equal(display.selection('F'),null,'leaving the solver also clears a subsequently highlighted axis');
  assert.equal(app.ui().state().active,false);assert.equal(JSON.stringify(app.snapshot().stickers),before);
});
