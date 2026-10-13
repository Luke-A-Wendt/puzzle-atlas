'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createPage}=require('./solver-dom.cjs');
const games=path.join(__dirname,'../dist/games');
const clean=value=>JSON.parse(JSON.stringify(value));
const fetchFile=async url=>{const file=path.join(games,new URL(String(url),'https://atlas.test/games/').pathname.replace(/^\/games\//,''));return {ok:fs.existsSync(file),text:async()=>fs.readFileSync(file,'utf8')};};

function host(id='cube2'){
  const requests=[];
  class DeferredWorker {
    constructor(){this.listeners={};this.terminated=false;}
    postMessage(request){this.request=clean(request);requests.push({worker:this,request:this.request});}
    addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}
    removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(f=>f!==fn);}
    terminate(){this.terminated=true;}
    reply(data,force=false){if(this.terminated&&!force)return;const event={data};this.onmessage?.(event);for(const fn of this.listeners.message||[])fn(event);}
  }
  const app=createPage(id,{globals:{Worker:DeferredWorker,fetch:fetchFile}});
  app.requests=requests;app.model=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models',id+'.json'),'utf8'));
  app.ui=()=>app.context.ConstrainedSolverUI;app.core=()=>app.context.ConstrainedSolverCore;
  app.mapping=()=>app.core().mapSnapshot(app.model,app.snapshot());
  app.colors=()=>app.core().colorsFromSnapshot(app.model,app.snapshot());
  app.nodeId=node=>app.mapping().nodeToSticker[node];
  app.ready=async()=>{app.ui().setActive(true);for(let i=0;i<80&&app.ui().state().phase==='loading';i++)await app.advance(0);assert.equal(app.ui().state().phase,'selecting');};
  app.choose=({held,pair})=>{app.ui().setTool('hold');for(const node of held)app.ui().selectNode(app.nodeId(node));app.ui().setTool('swap');for(const node of pair)app.ui().selectNode(app.nodeId(node));assert.equal(app.element('csGo').disabled,false);};
  app.request=task=>requests.findLast(x=>x.request.task===task);
  app.payload=async entry=>{
    const replies=[],ctx={URL,performance,TextEncoder,console,fetch:fetchFile,location:{href:'https://atlas.test/games/constrained-solver-worker.js'},postMessage:data=>replies.push(clean(data))};
    ctx.self=ctx;ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(games,'constrained-solver-worker.js'),'utf8'),ctx);
    await ctx.onmessage({data:clean(entry.request)});return replies.at(-1);
  };
  app.settleSolver=async()=>{for(let i=0;i<1000;i++){await app.advance(1000);const s=app.snapshot(),u=app.ui().state();if(!s.animating&&s.mode==='idle'&&!u.auto?.active&&!['loading','solving','executing','auto-gap'].includes(u.phase))return;}throw Error('Solver did not settle');};
  app.autoStart=async()=>{app.click('solve');for(let i=0;i<80&&!app.request('full-solve');i++)await app.advance(0);assert(app.request('full-solve'));};
  return app;
}

// U2 is a useful independent witness: its U-face nodes exchange white stickers,
// while two side stickers exchange their exact identities.
function colorSwapFixture(model){
  const move=model.moves.findIndex(m=>m.name==='U2'),p=model.moves[move].perm;
  const held=model.nodes.find(n=>n.face==='U'&&p[n.index]!==n.index).index;
  const a=model.nodes.find(n=>n.face!=='U'&&n.piece===model.nodes[held].piece&&p[n.index]!==n.index&&p[p[n.index]]===n.index).index;
  return {move,held:[held],pair:[a,p[a]]};
}

test('manual color hold accepts a shorter witness that replaces the held sticker and transfers the UI hold',async()=>{
  const app=host(),f=colorSwapFixture(app.model);await app.ready();const before=app.mapping(),colors=app.colors();app.choose(f);app.click('csGo');
  const entry=app.request('manual-swap');assert.equal(entry.request.selection.holdSemantics,'color');
  const payload=await app.payload(entry);assert.equal(payload.result.status,'solved',payload.result.reason);assert.equal(payload.result.moveIndices.length,1,'a direct half-turn suffices with a color hold');
  entry.worker.reply(payload);await app.settleSolver();const after=app.mapping();
  assert.notEqual(after.nodeToSticker[f.held[0]],before.nodeToSticker[f.held[0]],'this fixture really replaces the original sticker');
  assert.equal(app.colors()[f.held[0]],colors[f.held[0]],'the held location keeps its requested color');
  assert.equal(after.stickerToNode[before.nodeToSticker[f.pair[0]]],f.pair[1],'A still means a specific sticker');
  assert.equal(after.stickerToNode[before.nodeToSticker[f.pair[1]]],f.pair[0],'B still means a specific sticker');
  assert.deepEqual(clean(app.ui().state().held),[after.nodeToSticker[f.held[0]]],'the replacement at the held address inherits the dashed hold');
  assert.deepEqual(clean(app.ui().state().pair),[]);assert.equal(app.ui().state().phase,'selecting');
  assert.equal(app.element('speedText').textContent,'Normal');
});

test('a legal pair swap with the wrong endpoint hold color is rejected before playback',async()=>{
  const app=host(),f=colorSwapFixture(app.model),p=app.model.moves[f.move].perm;
  const held=app.model.nodes.find(n=>!f.pair.includes(n.index)&&p[n.index]!==n.index&&app.model.nodes[p[n.index]].color!==n.color).index;
  await app.ready();app.choose({held:[held],pair:f.pair});app.click('csGo');const entry=app.request('manual-swap');
  entry.worker.reply({id:entry.request.id,type:'result',result:{status:'solved',moveIndices:[f.move]},modelFingerprint:app.core().modelFingerprint(app.model)});
  await app.advance(1000);assert.equal(app.snapshot().history.length,0,'full permutation legality does not override a violated held color');assert.equal(app.ui().state().phase,'selecting');
});

test('a completed color swap invalidates old color-state eligibility and late replies cannot redim the new state',async()=>{
  const app=host(),f=colorSwapFixture(app.model);await app.ready();app.choose(f);await app.advance(200);
  const old=app.request('eligible-swaps');assert(old);assert.equal(old.request.selection.holdSemantics,'color');
  const oldPayload=await app.payload(old);old.worker.reply(oldPayload);await app.advance(0);
  assert.equal(app.element('csGo').getAttribute('data-readiness'),'ready');app.click('csGo');await app.advance(0);assert.equal(app.request('manual-swap'),undefined,'eligibility retained the witness so playback needs no second search');await app.settleSolver();await app.advance(200);
  const fresh=app.request('eligible-swaps');assert(fresh&&fresh!==old,'same held spatial address with a changed color state must be reanalyzed');
  const newPayload=await app.payload(fresh);fresh.worker.reply(newPayload);await app.advance(0);const current=clean(app.ui().state().eligibility);
  old.worker.reply(oldPayload,true);await app.advance(0);assert.deepEqual(clean(app.ui().state().eligibility),current,'previous color-state tables cannot change current eligibility');
});

test('unresolved color feasibility stays selectable instead of inheriting identity-only impossibility',async()=>{
  const app=host(),f=colorSwapFixture(app.model);await app.ready();app.ui().selectNode(app.nodeId(f.held[0]));await app.advance(200);const entry=app.request('eligible-swaps');
  entry.worker.reply({id:entry.request.id,type:'result',result:{status:'unknown',reason:'color_search_budget'},modelFingerprint:app.core().modelFingerprint(app.model)});await app.advance(0);
  assert.deepEqual(clean(app.ui().state().eligibility.blocked),[]);app.ui().setTool('swap');for(const n of f.pair)assert.equal(app.ui().selectNode(app.nodeId(n)),true);assert.equal(app.element('csGo').disabled,false);
});

function colorAutoWitness(app,names=["R'"]){
  const model=app.model,home=model.homeBySticker,before=app.mapping().stickerToNode,current={...before},colors=model.colorBySticker;
  const solved=map=>Object.entries(map).filter(([id,node])=>String(colors[id])===String(model.nodes[node].color)).map(([,node])=>node).sort((a,b)=>a-b);
  const protectedNodes=solved(current),moveIndices=names.map(name=>model.moves.findIndex(m=>m.name===name));assert(moveIndices.every(i=>i>=0));
  for(const i of moveIndices)for(const id of Object.keys(current))current[id]=model.moves[i].perm[current[id]];
  const finalProtectedNodes=solved(current),newlySolvedNodes=finalProtectedNodes.filter(n=>!protectedNodes.includes(n));assert.equal(finalProtectedNodes.length,model.stickerCount);assert(newlySolvedNodes.length);
  const targetNode=newlySolvedNodes[0],targetId=Object.keys(current).find(id=>current[id]===targetNode),sourceNode=before[targetId];
  assert(Object.keys(current).some(id=>current[id]!==home[id]),'fixture solves colors but deliberately leaves labels permuted');
  const stage={moveIndices,protectedNodes,newlySolvedNodes,targetNode,sourceNode};
  const result={status:'solved',goalSemantics:'colors',initialProtectedNodes:protectedNodes,stages:[stage],moveIndices,finalProtectedNodes,optimal:false,verified:true,stats:{}};
  return {id:app.request('full-solve').request.id,type:'result',result,engineStages:[{...stage,engineMoves:moveIndices.map(i=>model.moves[i].engineMove)}],modelFingerprint:app.core().modelFingerprint(model)};
}

test('Auto Solve accepts a fully color-solved endpoint with nonhome labels and returns to the default mode',async()=>{
  const app=host('diamondstyle');app.context.PUZZLE_API.runMoves(['U','R']);await app.settleSolver();await app.autoStart();
  const entry=app.request('full-solve'),payload=colorAutoWitness(app);
  assert.equal(app.core().verifyAutoPlan(app.model,app.snapshot(),payload.result),true);entry.worker.reply(payload);await app.settleSolver();
  assert.equal(app.snapshot().solved,true);assert.notDeepEqual(clean(app.mapping().stickerToNode),clean(app.model.homeBySticker));
  assert.equal(app.ui().state().active,false);assert.equal(app.ui().state().phase,'off');assert.equal(app.element('ringModeDefault').getAttribute('aria-pressed'),'true');assert.equal(app.element('speedText').textContent,'Normal');
});

test('Stop during a color-goal stage completes and verifies its color endpoint before exiting solver mode',async()=>{
  const app=host('diamondstyle');app.context.PUZZLE_API.runMoves(['U','R']);await app.settleSolver();await app.autoStart();
  const payload=colorAutoWitness(app,['F',"F'","R'"]),entry=app.request('full-solve');entry.worker.reply(payload);await app.advance(20);app.click('pause');await app.settleSolver();
  assert.equal(app.snapshot().history.length,5,'the complete three-move witness executes after Stop');assert.equal(app.snapshot().solved,true);
  assert.notDeepEqual(clean(app.mapping().stickerToNode),clean(app.model.homeBySticker));assert.equal(app.ui().state().active,false);assert.deepEqual(clean(app.ui().state().held),[]);assert.equal(app.element('ringModeDefault').getAttribute('aria-pressed'),'true');
});

test('Auto Solve chooses color goals only for models whose appearance is fully described by colors',async()=>{
  for(const [id,safe] of [['cube2',true],['diamondstyle',true],['mirror',false],['ghost',false],['homer',false]]){
    const app=host(id);assert.equal(app.model.colorRelaxationSafe,safe,id);app.context.PUZZLE_API.runMoves(['R']);await app.settleSolver();await app.autoStart();
    const payload=await app.payload(app.request('full-solve'));assert.equal(payload.result.status,'solved',id+': '+payload.result.reason);
    assert.equal(payload.result.goalSemantics||'identity',safe?'colors':'identity',id);app.ui().cancel();
  }
});
