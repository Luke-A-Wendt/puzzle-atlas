'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'../dist/games'),plain=x=>JSON.parse(JSON.stringify(x));
function modelFor(id){return JSON.parse(fs.readFileSync(path.join(root,'constrained-solver-models',id+'.json'),'utf8'));}
function engineFor(id){
 const model=modelFor(id),spec=model.adapter.source,ctx={CUBE_SIZE:Number(id.slice(4))};ctx.window=ctx;vm.createContext(ctx);
 let code=fs.readFileSync(path.join(root,path.basename(spec.file)),'utf8');
 if(spec.file.endsWith('.html'))code=[...code.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>new RegExp('root\\.'+spec.rootName+'\\s*=').test(s));
 assert(code,'Missing engine '+id);vm.runInContext(code,ctx);const E=ctx[spec.rootName],M=spec.kind==='model'?E.create(id):null;let state=M?M.stickerState:E.makeSolved();
 return {model,getState:()=>plain(M?M.stickerState:state),isSolved:()=>M?M.isSolved():E.isSolved(state),apply:move=>{if(M)M.applyMove(move);else state=E.applyMove(state,move);}};
}
function browser(filename,{tamperCache=false}={}){
 const responses=[],fetches=[];
 const ctx={URL,performance,TextEncoder,crypto:webcrypto,console,fetch:async url=>{
  const pathname=new URL(url).pathname;fetches.push(pathname);
  let text=fs.readFileSync(path.join(root,pathname.replace(/^\/games\//,'')),'utf8');if(tamperCache&&pathname.includes('/constrained-solver-caches/'))text+=' ';
  return{ok:true,text:async()=>text};
 }};
 ctx.document={currentScript:{src:'https://atlas.test/games/'+filename},baseURI:'https://atlas.test/games/cube2.html'};
 ctx.location={href:'https://atlas.test/games/'+filename};ctx.self=ctx;ctx.globalThis=ctx;ctx.postMessage=data=>responses.push(plain(data));vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,filename),'utf8'),ctx,{filename});
 return {ctx,responses,fetches,send:async data=>{await ctx.onmessage({data:plain(data)});return responses.at(-1);}};
}
test('all 34 home targets use actual engine identities and are independent of a move journal',async()=>{
 const core=browser('constrained-solver-core.js').ctx.ConstrainedSolverCore;
 for(const id of core.modelIds){
  const engine=engineFor(id),model=await core.loadModel(id),solved=engine.getState(),progress=core.solvedProgress(model,{stickers:solved,history:[]});
  assert.equal(progress.solvedCount,model.stickerCount,id);assert.equal(progress.remainingStickerIds.length,0,id);assert.equal(Object.keys(model.homeBySticker).length,model.stickerCount,id);
  const move=id==='diamondstyle'?model.moves.find(m=>m.name==='R'):model.moves.find(m=>m.perm.some((x,i)=>x!==i));engine.apply(move.engineMove);
  const now=engine.getState(),without=core.autoRequestFromSnapshot(model,{stickers:now}),wrongHistory=core.autoRequestFromSnapshot(model,{stickers:now,history:[{face:'not-a-real-move'}]});
  assert.deepEqual(plain(without),plain(wrongHistory),id);assert(core.solvedProgress(model,now).solvedCount<model.stickerCount,id);
 }
});
test('full solve replays real engine snapshots without history for every supported puzzle',async()=>{
 const core=browser('constrained-solver-core.js').ctx.ConstrainedSolverCore,worker=browser('constrained-solver-worker.js');
 for(const id of (process.env.AUTO_SOLVER_TEST_IDS?process.env.AUTO_SOLVER_TEST_IDS.split(','):core.modelIds)){
  const engine=engineFor(id),model=await core.loadModel(id);
  for(const i of [0,Math.floor(model.moves.length/3),Math.floor(model.moves.length*2/3)])engine.apply(model.moves[i].engineMove);
  const snapshot={stickers:engine.getState(),history:[]},before=JSON.stringify(snapshot);
  const reply=await worker.send({task:'full-solve',id,modelId:id,snapshot});
  assert.equal(reply.result.status,'solved',id+': '+JSON.stringify(reply.result));assert(core.verifyAutoPlan(model,snapshot,reply.result),id);assert.equal(JSON.stringify(snapshot),before,id+' mutated caller snapshot');
  assert.equal(reply.modelFingerprint,core.modelFingerprint(id));assert.equal(reply.engineStages.length,reply.result.stages.length);
  const held=new Set();let moves=0;
  for(const stage of reply.engineStages){
   const previous=core.mapSnapshot(model,engine.getState()),previousColors=core.colorsFromSnapshot(model,engine.getState());for(const n of stage.protectedNodes)held.add(n);
   for(const move of stage.engineMoves){engine.apply(move);moves++;}
   const after=core.mapSnapshot(model,engine.getState()),afterColors=core.colorsFromSnapshot(model,engine.getState()),byHome=Object.fromEntries(Object.entries(model.homeBySticker).map(([s,n])=>[n,s]));
   for(const n of held)if(reply.result.goalSemantics==='colors')assert.equal(afterColors[n],previousColors[n],id+' protected color '+n);else assert.equal(after.stickerToNode[previous.nodeToSticker[n]],n,id+' protected node '+n);
   for(const n of stage.newlySolvedNodes){if(reply.result.goalSemantics==='colors')assert.equal(afterColors[n],model.colorBySticker[byHome[n]],id+' newly solved color '+n);else assert.equal(after.stickerToNode[byHome[n]],n,id+' newly solved '+n);held.add(n);}
  }
  assert.equal(moves,reply.result.moveIndices.length,id);assert.equal(core.solvedProgress(model,engine.getState()).solvedCount,model.stickerCount,id+' not solved');assert.equal(engine.isSolved(),true,id+' native game must also report Solved');
 }
});
test('full solve also handles mixed multi-axis scrambles with the journal discarded',async()=>{
 const core=browser('constrained-solver-core.js').ctx.ConstrainedSolverCore,worker=browser('constrained-solver-worker.js');
 for(const id of ['cube2','cube3','fto']){
  const engine=engineFor(id),model=await core.loadModel(id);let seed=9173;
  for(let k=0;k<19;k++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;engine.apply(model.moves[seed%model.moves.length].engineMove);}
  const snapshot={stickers:engine.getState(),history:[]},reply=await worker.send({task:'full-solve',id,modelId:id,snapshot});
  assert.equal(reply.result.status,'solved',id+': '+JSON.stringify(reply.result));assert(core.verifyAutoPlan(model,snapshot,reply.result),id);
  for(const stage of reply.engineStages)stage.engineMoves.forEach(engine.apply);
  assert.equal(core.solvedProgress(model,engine.getState()).solvedCount,model.stickerCount,id);assert.equal(engine.isSolved(),true,id+' native game must also report Solved');
 }
});
test('independent full-plan verifier rejects forged commands, targets, locks, and final state',async()=>{
 const core=browser('constrained-solver-core.js').ctx.ConstrainedSolverCore,worker=browser('constrained-solver-worker.js'),engine=engineFor('cube2'),model=await core.loadModel('cube2');
 for(const i of [0,3,6])engine.apply(model.moves[i].engineMove);const snapshot={stickers:engine.getState()};
 const reply=await worker.send({task:'full-solve',id:1,modelId:'cube2',snapshot});assert.equal(reply.result.status,'solved');assert(reply.result.stages.length);
 const good=reply.result;assert(core.verifyAutoPlan(model,snapshot,good));
 const badMove=plain(good);badMove.stages[0].moveIndices[0]=model.moves.length;assert.equal(core.verifyAutoPlan(model,snapshot,badMove),false);
 const badTarget=plain(good);badTarget.stages[0].targetNode=model.degree;assert.equal(core.verifyAutoPlan(model,snapshot,badTarget),false);
 const missing=plain(good);missing.stages.pop();assert.equal(core.verifyAutoPlan(model,snapshot,missing),false);
 const flat=plain(good);flat.moveIndices.push(0);assert.equal(core.verifyAutoPlan(model,snapshot,flat),false);
 const claim=plain(good);claim.stages[0].newlySolvedNodes=[];assert.equal(core.verifyAutoPlan(model,snapshot,claim),false);
 if(good.stages.length>1){const unlock=plain(good);unlock.stages[1].protectedNodes=[];assert.equal(core.verifyAutoPlan(model,snapshot,unlock),false);}
});
test('solved snapshots need no moves, while wrong sticker identities, budgets and jumbling fail safely',async()=>{
 const core=browser('constrained-solver-core.js').ctx.ConstrainedSolverCore,worker=browser('constrained-solver-worker.js'),engine=engineFor('cube2');
 const solved=await worker.send({task:'full-solve',id:1,modelId:'cube2',snapshot:{stickers:engine.getState()}});assert.equal(solved.result.status,'solved');assert.deepEqual(solved.result.moveIndices,[]);assert.deepEqual(solved.engineStages,[]);
 const bad=engine.getState();bad[0].id='not-a-sticker';const invalid=await worker.send({task:'full-solve',id:2,modelId:'cube2',snapshot:{stickers:bad}});assert.equal(invalid.result.status,'invalid');
 engine.apply(engine.model.moves[0].engineMove);const limited=await worker.send({task:'full-solve',id:3,modelId:'cube2',snapshot:{stickers:engine.getState()},options:{maxOutputMoves:0}});assert.equal(limited.result.status,'unknown');assert.deepEqual(limited.engineStages,[]);
 const heli=engineFor('helicopter'),jumble=await worker.send({task:'full-solve',id:4,modelId:'helicopter',snapshot:{stickers:heli.getState(),advanced:true}});assert.equal(jumble.result.status,'invalid');assert.match(jumble.result.reason,/jumbling/);
 const animated=await worker.send({task:'full-solve',id:5,modelId:'cube2',snapshot:{stickers:engine.getState(),animating:true}});assert.equal(animated.result.status,'invalid');
});
test('an illegal identity exchange is proved only in identity mode and remains unknown for a color goal',async()=>{
 const worker=browser('constrained-solver-worker.js'),engine=engineFor('cube2'),snapshot=engine.getState();
 const a=snapshot[0],b=snapshot.find(s=>s.color!==a.color);[a.p,b.p]=[b.p,a.p];[a.n,b.n]=[b.n,a.n];
 const reply=await worker.send({task:'full-solve',id:1,modelId:'cube2',snapshot:{stickers:snapshot,history:[]},options:{colorOptimize:false}});
 assert.equal(reply.result.status,'impossible',JSON.stringify(reply.result));assert.deepEqual(reply.engineStages,[]);
 const colorReply=await worker.send({task:'full-solve',id:2,modelId:'cube2',snapshot:{stickers:snapshot,history:[]}});
 assert.equal(colorReply.result.status,'unknown',JSON.stringify(colorReply.result));assert.equal(colorReply.result.reason,'color_goal_identity_baseline_unreachable');assert.deepEqual(colorReply.engineStages,[]);
});
test('stabilizer cache is lazy and rejects version mismatch before solving',async()=>{
 const worker=browser('constrained-solver-worker.js',{tamperCache:true}),engine=engineFor('cube2');
 assert.equal(worker.fetches.length,0);engine.apply(engine.model.moves[0].engineMove);
 const reply=await worker.send({task:'full-solve',id:1,modelId:'cube2',snapshot:{stickers:engine.getState()}});assert.equal(reply.result.status,'unknown');assert.equal(reply.result.reason,'cache_integrity_error');assert.match(reply.result.detail,/version/);
});
