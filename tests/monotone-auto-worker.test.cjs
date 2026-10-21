'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const games=path.resolve(__dirname,'../dist/games'),plain=x=>JSON.parse(JSON.stringify(x));
function engineFor(id){
 const model=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models',id+'.json'),'utf8')),spec=model.adapter.source,ctx={CUBE_SIZE:Number(id.slice(4))};ctx.window=ctx;vm.createContext(ctx);
 let code=fs.readFileSync(path.join(games,path.basename(spec.file)),'utf8');if(spec.file.endsWith('.html'))code=[...code.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>new RegExp('root\\.'+spec.rootName+'\\s*=').test(s));
 assert(code);vm.runInContext(code,ctx);const E=ctx[spec.rootName],M=spec.kind==='model'?E.create(id):null;let state=M?M.stickerState:E.makeSolved();
 return {model,snapshot:()=>({stickers:plain(M?M.stickerState:state)}),apply:move=>{if(M)M.applyMove(move);else state=E.applyMove(state,move);}};
}
function browser(filename){
 const replies=[],fetches=[],ctx={URL,performance,TextEncoder,crypto:webcrypto,console,fetch:async url=>{const u=new URL(url);assert.equal(u.origin,'https://atlas.test');fetches.push(u.pathname);const file=path.join(games,u.pathname.replace(/^\/puzzle-atlas\/games\//,''));return{ok:true,text:async()=>fs.readFileSync(file,'utf8')};}};
 ctx.document={currentScript:{src:'https://atlas.test/puzzle-atlas/games/'+filename},baseURI:'https://atlas.test/puzzle-atlas/games/cube2.html'};ctx.location={href:'https://atlas.test/puzzle-atlas/games/'+filename};ctx.self=ctx;ctx.globalThis=ctx;ctx.postMessage=data=>replies.push(structuredClone(data));vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(games,filename),'utf8'),ctx,{filename});
 return{ctx,fetches,send:async data=>{await ctx.onmessage({data:plain(data)});return replies.at(-1);}};
}
function scramble(engine){let seed=13;for(let i=0;i<12;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;engine.apply(engine.model.moves[seed%engine.model.moves.length].engineMove);}}

test('guided Auto worker retains a finite secured-prefix route and every offered choice shares the next state',async()=>{
 const core=browser('constrained-solver-core.js').ctx.ConstrainedSolverCore,worker=browser('constrained-solver-worker.js');
 for(const id of ['cube2','cube3','ghost','pyramorphix','homer']){
  const engine=engineFor(id);scramble(engine);const model=await core.loadModel(id),snapshot=engine.snapshot();
  const reply=await worker.send({task:'auto-holds-plan',id,modelId:id,expectedRelease:core.assetRelease,snapshot,options:{maxMs:15000}}),plan=reply.result;
  assert.equal(reply.id,id);assert.equal(reply.modelFingerprint,core.modelFingerprint(model));assert.equal(plan.status,'solved',id+': '+plan.reason);assert.equal(plan.guidedAuto,true);assert(core.verifyAutoHoldsPlan(model,snapshot,plan));
  const held=new Set(plan.initialProtectedNodes);let count=held.size;
  for(const stage of plan.stages){
   assert(core.verifyAutoHoldsStage(model,engine.snapshot(),stage,[...held]));assert(stage.choices.length>0);
   const before=core.mapSnapshot(model,engine.snapshot());for(const c of stage.choices){assert(before.nodeToSticker[c.firstNode]!==undefined);assert(before.nodeToSticker[c.secondNode]!==undefined);assert.notEqual(c.firstNode,c.secondNode);}
   for(const move of stage.moveIndices)engine.apply(model.moves[move].engineMove);
   for(const node of stage.newlySolvedNodes)held.add(node);assert(held.size>count);count=held.size;
   const after=core.mapSnapshot(model,engine.snapshot());for(const c of stage.choices){assert.equal(after.stickerToNode[before.nodeToSticker[c.sourceNode]],c.targetNode);if(c.kind==='swap')assert.equal(after.stickerToNode[before.nodeToSticker[c.secondNode]],c.firstNode);}
  }
  assert.equal(held.size,model.stickerCount);assert.equal(core.solvedProgress(model,engine.snapshot()).solvedCount,model.stickerCount);assert(plan.stages.length<=model.stickerCount-plan.initialProtectedNodes.length);
 }
 assert(worker.fetches.some(p=>p.includes('/constrained-solver-caches/')),'guided Auto uses the existing complete local cache');
});

test('guided Auto worker handles solved, stale-release and exact mirror goals without speculative choices',async()=>{
 const core=browser('constrained-solver-core.js').ctx.ConstrainedSolverCore,worker=browser('constrained-solver-worker.js'),engine=engineFor('cube3'),model=await core.loadModel('cube3');
 const base={task:'auto-holds-plan',id:1,modelId:'cube3',expectedRelease:core.assetRelease};
 const solved=await worker.send({...base,snapshot:engine.snapshot()});assert.equal(solved.result.status,'solved');assert.deepEqual(solved.result.stages,[]);assert.equal(solved.result.initialProtectedNodes.length,model.stickerCount);
 scramble(engine);const snapshot={...engine.snapshot(),mirrorMode:true},reply=await worker.send({...base,id:2,snapshot});assert.equal(reply.result.status,'solved',reply.result.reason);assert.equal(reply.result.goalSemantics,'identity');assert(core.verifyAutoHoldsPlan(model,snapshot,reply.result));
 const stale=await worker.send({...base,id:3,snapshot,expectedRelease:'old-release'});assert.equal(stale.result.reason,'release_mismatch');assert.equal(stale.result.status,'unknown');
});
