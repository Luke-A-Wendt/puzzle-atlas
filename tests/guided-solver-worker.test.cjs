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

const goalColors=model=>Object.fromEntries(Object.entries(model.homeBySticker).map(([id,node])=>[node,model.colorBySticker[id]]));
function matching(core,model,snapshot){const map=core.mapSnapshot(model,snapshot),colors=core.colorsFromSnapshot(model,snapshot,map),goal=goalColors(model);return Object.entries(map.stickerToNode).filter(([,node])=>colors[node]===goal[node]).map(([id])=>id);}
function metric(core,model,snapshot){const map=core.mapSnapshot(model,snapshot),colors=core.colorsFromSnapshot(model,snapshot,map),goal=goalColors(model);return [Object.entries(model.homeBySticker).filter(([,node])=>colors[node]===goal[node]).length,Object.entries(model.homeBySticker).filter(([id,node])=>map.stickerToNode[id]===node).length];}
const improves=(a,b)=>b[0]>a[0]||b[0]===a[0]&&b[1]>a[1];
test('guided checkpoints preserve every already-correct color and reach the native solved goal for all catalog puzzles',async()=>{
 const core=browser('constrained-solver-core.js').ctx.ConstrainedSolverCore,worker=browser('constrained-solver-worker.js');let checkedStages=0,shapeParticipants=0;
 for(const id of core.modelIds){
  const engine=engineFor(id),model=await core.loadModel(id);let seed=71038;
  for(let k=0;k<7;k++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;engine.apply(model.moves[seed%model.moves.length].engineMove);}
  const snapshot={stickers:engine.getState(),history:[]},before=JSON.stringify(snapshot),protectedStickerIds=matching(core,model,snapshot);
  const reply=await worker.send({task:'guided-solve',id,modelId:id,snapshot,selection:{protectedStickerIds}}),plan=reply.result;
  assert.equal(plan.status,'solved',id+': '+JSON.stringify(plan));assert.equal(plan.guided,true,id);assert(core.verifyGuidedPlan(model,snapshot,plan),id+' plan verification');assert.equal(JSON.stringify(snapshot),before,id+' mutated snapshot');
  assert.equal(reply.engineStages.length,plan.stages.length,id);
  for(const stage of reply.engineStages){
   const start={stickers:engine.getState()},map=core.mapSnapshot(model,start),beforeColors=core.colorsFromSnapshot(model,start),beforeMetric=metric(core,model,start),allCorrect=matching(core,model,start).map(s=>map.stickerToNode[s]);
   assert.deepEqual(stage.protectedNodes.slice().sort((a,b)=>a-b),allCorrect.sort((a,b)=>a-b),id+' all current correct colors held');assert(core.verifyGuidedStep(model,start,stage),id+' step verify');
   assert.equal(new Set(stage.displayNodes).size,stage.displayNodes.length,id+' unique marker nodes');assert(stage.displayNodes.every(n=>map.nodeToSticker[n]!==undefined),id+' marker on occupied node');shapeParticipants+=stage.displayKind==='participants';
   for(const move of stage.engineMoves)engine.apply(move);
   const after={stickers:engine.getState()},afterColors=core.colorsFromSnapshot(model,after),afterMetric=metric(core,model,after);
   assert(improves(beforeMetric,afterMetric),id+' strict progress');const progressIndex=plan.progressSemantics==='identity'?1:0;assert(afterMetric[progressIndex]>beforeMetric[progressIndex],id+' strictly increasing actual goal match');for(const n of stage.protectedNodes)assert.equal(afterColors[n],beforeColors[n],id+' held color '+n);checkedStages++;
  }
  assert.equal(engine.isSolved(),true,id+' native goal');assert.equal(core.solvedProgress(model,engine.getState()).solvedCount,model.stickerCount,id+' canonical goal');
 }
 assert(checkedStages>=34,'multiple useful guided checkpoints tested');
});
test('repeated Suggest holds + Suggest swap + Go replanning cannot cycle on cube, corner, dodecahedral, or shape puzzles',async()=>{
 const core=browser('constrained-solver-core.js').ctx.ConstrainedSolverCore,worker=browser('constrained-solver-worker.js');
 for(const id of ['cube2','jing','megaminx','ghost','homer']){
  const engine=engineFor(id),model=await core.loadModel(id);for(const i of [0,Math.floor(model.moves.length/3),Math.floor(model.moves.length*2/3)])engine.apply(model.moves[i].engineMove);
  const seen=new Set();let steps=0;
  while(!engine.isSolved()){
   const snapshot={stickers:engine.getState(),history:[]},before=metric(core,model,snapshot),key=before.join(',');assert(!seen.has(key),id+' progress cycle');seen.add(key);
   const reply=await worker.send({task:'guided-solve',id:id+steps,modelId:id,snapshot,selection:{protectedStickerIds:matching(core,model,snapshot)}}),stage=reply.engineStages?.[0];
   assert.equal(reply.result.status,'solved',id+': '+JSON.stringify(reply.result));assert(stage,id+' nonempty next step');assert(core.verifyGuidedStep(model,snapshot,stage));for(const move of stage.engineMoves)engine.apply(move);
   assert(improves(before,metric(core,model,engine.getState())),id);assert(++steps<=model.stickerCount*model.stickerCount,id+' finite bound');
  }
 }
});
test('guidance explains conflicting off-goal holds, handles solved state and respects solver budgets',async()=>{
 const core=browser('constrained-solver-core.js').ctx.ConstrainedSolverCore,worker=browser('constrained-solver-worker.js'),engine=engineFor('cube2'),model=await core.loadModel('cube2');
 const solved=await worker.send({task:'guided-solve',id:1,modelId:'cube2',snapshot:{stickers:engine.getState()},selection:{protectedStickerIds:[]}});assert.equal(solved.result.status,'solved');assert.deepEqual(solved.result.stages,[]);assert(core.verifyGuidedPlan(model,engine.getState(),solved.result));
 engine.apply(model.moves[0].engineMove);const snapshot={stickers:engine.getState()},map=core.mapSnapshot(model,snapshot),good=new Set(matching(core,model,snapshot)),bad=Object.keys(map.stickerToNode).find(id=>!good.has(id));assert(bad);
 const conflict=await worker.send({task:'guided-solve',id:2,modelId:'cube2',snapshot,selection:{protectedStickerIds:[bad]}});assert.equal(conflict.result.status,'unknown');assert.equal(conflict.result.reason,'guided_holds_conflict');assert.deepEqual(conflict.engineStages,[]);assert(conflict.result.conflictingNodes.includes(map.stickerToNode[bad]));
 const limited=await worker.send({task:'guided-solve',id:3,modelId:'cube2',snapshot,options:{maxOutputMoves:0}});assert.equal(limited.result.status,'unknown');assert.deepEqual(limited.engineStages,[]);
});
test('guided verification rejects false holds, forged progress, arbitrary pairs, missing stages and illegal commands',async()=>{
 const core=browser('constrained-solver-core.js').ctx.ConstrainedSolverCore,worker=browser('constrained-solver-worker.js'),engine=engineFor('cube2'),model=await core.loadModel('cube2');for(const i of [0,3,6])engine.apply(model.moves[i].engineMove);const snapshot={stickers:engine.getState()},reply=await worker.send({task:'guided-solve',id:1,modelId:'cube2',snapshot}),good=reply.result;
 assert.equal(good.status,'solved');assert(core.verifyGuidedPlan(model,snapshot,good));assert(good.stages.length);
 for(const mutate of [p=>p.stages[0].protectedNodes.push(model.degree),p=>p.stages[0].progressAfter[0]++,p=>p.stages[0].displayNodes[0]=model.degree,p=>p.stages[0].moveIndices[0]=model.moves.length,p=>p.moveIndices.pop(),p=>p.stages.pop(),p=>p.goalSemantics='invalid']){const bad=plain(good);mutate(bad);assert.equal(core.verifyGuidedPlan(model,snapshot,bad),false);}
});
