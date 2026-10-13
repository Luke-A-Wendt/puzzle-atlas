'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'../dist/games'),plain=x=>JSON.parse(JSON.stringify(x));
function modelFor(id){return JSON.parse(fs.readFileSync(path.join(root,'constrained-solver-models',id+'.json'),'utf8'));}
function engineFor(id){
 const model=modelFor(id),spec=model.adapter.source,ctx={CUBE_SIZE:Number(id.slice(4))};ctx.window=ctx;vm.createContext(ctx);
 let code=fs.readFileSync(path.join(root,path.basename(spec.file)),'utf8');
 if(spec.file.endsWith('.html'))code=[...code.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('root.'+spec.rootName+' =')||new RegExp('root\\.'+spec.rootName+'\\s*=').test(s));
 assert(code,'Missing engine '+id);vm.runInContext(code,ctx);const E=ctx[spec.rootName],M=spec.kind==='model'?E.create(id):null;let state=M?M.stickerState:E.makeSolved();
 return {model,getState:()=>plain(M?M.stickerState:state),apply:move=>{if(M)M.applyMove(move);else state=E.applyMove(state,move);}};
}
function browser(filename,{tamper=false,document=true,unavailableColorCache=false}={}){
 let fetches=0;const responses=[],fetchPaths=[];
 const ctx={URL,performance,TextEncoder,crypto:webcrypto,console,fetch:async url=>{fetches++;const pathname=new URL(url).pathname;fetchPaths.push(pathname);if(unavailableColorCache&&pathname.includes('/color-solver-caches/'))return {ok:false,status:503,text:async()=>''};let text=fs.readFileSync(path.join(root,pathname.replace(/^\/games\//,'')),'utf8');if(tamper)text+=' ';return {ok:true,text:async()=>text};}};
 if(document)ctx.document={currentScript:{src:'https://atlas.test/games/'+filename},baseURI:'https://atlas.test/games/cube2.html'};
 ctx.location={href:'https://atlas.test/games/'+filename};ctx.self=ctx;ctx.globalThis=ctx;ctx.postMessage=data=>responses.push(plain(data));vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,filename),'utf8'),ctx,{filename});
 return {ctx,responses,fetchPaths,get fetches(){return fetches;},send:async data=>{await ctx.onmessage({data:plain(data)});return responses.at(-1);}};
}
function selectFor(core,model,snapshot,protectedNodes,swap,extra={}){
 const mapping=core.mapSnapshot(model,snapshot);
 return {protectedStickerIds:protectedNodes.map(n=>mapping.nodeToSticker[n]),swapStickerIds:swap.map(n=>mapping.nodeToSticker[n]),...extra};
}
test('browser core is safe in the older minimal DOM harness and does no eager fetch',()=>{
 const ctx={document:{},globalThis:null};ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'constrained-solver-core.js'),'utf8'),ctx);
 assert.equal(ctx.ConstrainedSolverCore.assetBase,null);assert.equal(ctx.ConstrainedSolverCore.modelIds.length,34);
});
test('worker honors the longer retry budget while bounding time, storage and output',async()=>{
 const worker=browser('constrained-solver-worker.js'),engine=engineFor('cube2'),snapshot=engine.getState(),budgets=[];
 // Observe the budget actually delivered to the backend without waiting for a
 // difficult puzzle to consume it. Keep the real loading/validation/bridge.
 worker.ctx.require('./index.cjs').solveSync=(_model,_request,options)=>{budgets.push(plain(options));return {status:'unknown',reason:'test_budget_probe',optimal:false};};
 const base={modelId:'cube2',snapshot,selection:{swapStickerIds:snapshot.slice(0,2).map(s=>s.id)}};
 await worker.send({...base,id:1});
 await worker.send({...base,id:2,options:{maxMs:10000,searchMs:1500}});
 await worker.send({...base,id:3,options:{maxMs:60000,searchMs:60000,maxOutputMoves:20000,maxStorageBytes:128*1024*1024}});
 assert.equal(budgets.length,3);assert.equal(budgets[0].maxMs,3000);assert.equal(budgets[0].searchMs,450);
 assert.equal(budgets[1].maxMs,10000);assert.equal(budgets[1].searchMs,1500);
 assert.equal(budgets[2].maxMs,10000);assert.equal(budgets[2].searchMs,1500);assert.equal(budgets[2].maxOutputMoves,5000);assert.equal(budgets[2].maxStorageBytes,48*1024*1024);
});
test('all 34 browser move models map their actual engines, including changed shape poses',async()=>{
 const helper=browser('constrained-solver-core.js'),core=helper.ctx.ConstrainedSolverCore;
 for(const id of core.modelIds){const engine=engineFor(id),model=await core.loadModel(id);assert.equal(model.id,id);assert(Object.isFrozen(model));let before=core.mapSnapshot(model,engine.getState());
  for(const i of [0,Math.floor(model.moves.length/2),model.moves.length-1]){engine.apply(model.moves[i].engineMove);const after=core.mapSnapshot(model,engine.getState());for(const [sticker,node]of Object.entries(before.stickerToNode))assert.equal(after.stickerToNode[sticker],model.moves[i].perm[node],id+' node '+sticker);before=after;}
 }
});
test('real bundled worker finds and independently replays an optimal protected 2x2 swap',async()=>{
 const core=browser('constrained-solver-core.js').ctx.ConstrainedSolverCore,worker=browser('constrained-solver-worker.js'),engine=engineFor('cube2'),model=await core.loadModel('cube2');
 engine.apply({face:'R',dir:1,turns:1});const snapshot={stickers:engine.getState()},original=JSON.stringify(snapshot),selection=selectFor(core,model,snapshot,[1],[0,3]);
 const message={id:1,modelId:'cube2',snapshot,selection},reply=await worker.send(message);
 assert.equal(reply.type,'result');assert.equal(reply.id,1);assert.equal(reply.result.status,'solved');assert.equal(reply.result.optimal,true);assert.equal(reply.engineMoves.length,3);assert.equal(JSON.stringify(snapshot),original);
 const request=core.requestFromSnapshot(model,snapshot,selection),before=core.mapSnapshot(model,snapshot);assert(core.verify(model,core.normalize(model,request),reply.result.moveIndices));assert.equal(reply.modelFingerprint,core.modelFingerprint(model));assert.deepEqual(reply.result.permutation,plain(core.permutation(model,reply.result.moveIndices)));
 reply.engineMoves.forEach(engine.apply);const after=core.mapSnapshot(model,engine.getState());for(const [id,node]of Object.entries(before.stickerToNode))assert.equal(after.stickerToNode[id],reply.result.permutation[node]);assert.equal(after.stickerToNode[selection.protectedStickerIds[0]],1);assert.equal(after.stickerToNode[selection.swapStickerIds[0]],3);assert.equal(after.stickerToNode[selection.swapStickerIds[1]],0);
 const cached=await worker.send({...message,id:2});assert.equal(cached.result.cacheHit,true);assert.equal(worker.fetches,2,'model and complete stabilizer cache are each loaded once');
});
test('complete cached stabilizer supplies a verified pair transporter without short search',async()=>{
 const core=browser('constrained-solver-core.js').ctx.ConstrainedSolverCore,worker=browser('constrained-solver-worker.js'),engine=engineFor('cube2'),model=engine.model,snapshot=engine.getState();
 const selection=selectFor(core,model,snapshot,[1,2,4,5,6,7,8,9],[0,3]);const reply=await worker.send({id:1,modelId:'cube2',snapshot,selection,options:{maxSearchDepth:0,searchMs:0}});
 assert.equal(reply.result.status,'solved',reply.result.reason);assert.equal(reply.result.method,'cached_stabilizer_pair_transporter');assert(core.verify(model,core.normalize(model,reply.request),reply.result.moveIndices));
 assert(worker.fetchPaths.some(p=>p.includes('/constrained-solver-caches/')),'the real complete cache is downloaded, rather than a model file with the same basename');
 const before=core.mapSnapshot(model,snapshot);reply.engineMoves.forEach(engine.apply);const after=core.mapSnapshot(model,engine.getState());
 for(const held of selection.protectedStickerIds)assert.equal(after.stickerToNode[held],before.stickerToNode[held]);
 assert.equal(after.stickerToNode[selection.swapStickerIds[0]],3);assert.equal(after.stickerToNode[selection.swapStickerIds[1]],0);
});
test('color-hold checking falls back to the real cached transporter when the optional short-move catalog is unavailable',async()=>{
 const core=browser('constrained-solver-core.js').ctx.ConstrainedSolverCore,worker=browser('constrained-solver-worker.js',{unavailableColorCache:true}),engine=engineFor('cube2'),model=engine.model,snapshot=engine.getState();
 const protectedNodes=[1,2,4,5,6,7,8,9],selection=selectFor(core,model,snapshot,protectedNodes,[0,3],{holdSemantics:'color'});
 const reply=await worker.send({id:1,modelId:'cube2',snapshot,selection,options:{maxSearchDepth:0,searchMs:0}});
 assert.equal(reply.result.status,'solved',reply.result.reason);assert.equal(reply.result.method,'color_hold_pointwise_fallback');assert(reply.result.stats.pointwiseFallback.pairStates>0,'the complete-cache ordered-pair transporter supplied the fallback');
 const before=core.mapSnapshot(model,snapshot),colors=core.colorsFromSnapshot(model,snapshot);reply.engineMoves.forEach(engine.apply);const after=core.mapSnapshot(model,engine.getState()),finalColors=core.colorsFromSnapshot(model,engine.getState());
 for(const held of protectedNodes)assert.equal(finalColors[held],colors[held]);
 assert.equal(after.stickerToNode[before.nodeToSticker[0]],3);assert.equal(after.stickerToNode[before.nodeToSticker[3]],0);
 assert(worker.fetchPaths.some(p=>p.includes('/color-solver-caches/')));assert(worker.fetchPaths.some(p=>p.includes('/constrained-solver-caches/')));
});
test('isolated single-sticker transposition is proved impossible, never confused with a budget limit',async()=>{
 const core=browser('constrained-solver-core.js').ctx.ConstrainedSolverCore,worker=browser('constrained-solver-worker.js'),engine=engineFor('cube2'),snapshot=engine.getState(),selection=selectFor(core,engine.model,snapshot,[],[0,3],{mode:'exact_swap'});
 const impossible=await worker.send({id:1,modelId:'cube2',snapshot,selection});assert.equal(impossible.result.status,'impossible');assert.deepEqual(impossible.engineMoves,[]);
 const limited=await worker.send({id:2,modelId:'cube2',snapshot,selection,options:{maxSearchDepth:0,maxSearchStates:0,group:false}});assert.equal(limited.result.status,'unknown');assert.deepEqual(limited.engineMoves,[]);
});
test('shape-changing snapshot selects occupied addresses and returned commands replay',async()=>{
 const core=browser('constrained-solver-core.js').ctx.ConstrainedSolverCore,worker=browser('constrained-solver-worker.js'),engine=engineFor('pyramorphix'),model=engine.model;
 engine.apply({face:'R',dir:1,turns:1});engine.apply({face:'U',dir:-1,turns:1});const snapshot=engine.getState(),mapping=core.mapSnapshot(model,snapshot),occupied=new Set(mapping.occupiedNodes);let pair;
 for(const move of model.moves){for(const a of occupied){const b=move.perm[a];if(a!==b&&occupied.has(b)&&move.perm[b]===a){pair=[a,b];break;}}if(pair)break;}
 assert(pair);const selection=selectFor(core,model,snapshot,[],pair),reply=await worker.send({id:1,modelId:'pyramorphix',snapshot,selection});assert.equal(reply.result.status,'solved');assert.equal(reply.request.occupiedNodes.length,16);assert.equal(model.degree,32);
 reply.engineMoves.forEach(engine.apply);const after=core.mapSnapshot(model,engine.getState());assert.equal(after.stickerToNode[selection.swapStickerIds[0]],pair[1]);assert.equal(after.stickerToNode[selection.swapStickerIds[1]],pair[0]);
 assert(reply.result.changedNodes.every(n=>occupied.has(n)));
});
test('worker rejects overlapping selections, animation, unsupported jumbling and model version changes',async()=>{
 const worker=browser('constrained-solver-worker.js'),engine=engineFor('cube2'),snapshot=engine.getState(),ids=snapshot.map(s=>s.id);
 const bad=await worker.send({id:1,modelId:'cube2',snapshot,selection:{protectedStickerIds:[ids[0]],swapStickerIds:ids.slice(0,2)}});assert.equal(bad.result.status,'invalid');assert.match(bad.result.reason,/protected/);
 const animating=await worker.send({id:2,modelId:'cube2',snapshot:{stickers:snapshot,animating:true},selection:{swapStickerIds:ids.slice(0,2)}});assert.equal(animating.result.status,'invalid');assert.match(animating.result.reason,/finish/);
 const heli=engineFor('helicopter'),heliState=heli.getState(),jumble=await worker.send({id:3,modelId:'helicopter',snapshot:{stickers:heliState,advanced:true},selection:{swapStickerIds:heliState.slice(0,2).map(s=>s.id)}});assert.equal(jumble.result.status,'invalid');assert.match(jumble.result.reason,/jumbling/);
 const mismatch=await browser('constrained-solver-worker.js',{tamper:true}).send({id:4,modelId:'cube2',snapshot,selection:{swapStickerIds:ids.slice(0,2)}});assert.equal(mismatch.result.status,'unknown');assert.equal(mismatch.result.reason,'model_integrity_error');assert.match(mismatch.result.detail,/does not match this release/);
});

test('manual worker resumes its actual projected frontier instead of rechecking earlier transitions',async()=>{
 const core=browser('constrained-solver-core.js').ctx.ConstrainedSolverCore,worker=browser('constrained-solver-worker.js'),engine=engineFor('cube2'),snapshot=engine.getState();
 const module=worker.ctx.require('./manual-session.cjs'),Actual=module.ManualSwapSession,instances=[];
 // Use the real bundled session with a deterministic compute clock. This
 // forces a tiny real search across slices without spending wall-clock seconds.
 module.ManualSwapSession=class extends Actual{constructor(model,request,options){let tick=0;super(model,request,{...options,constructive:false,_clock:()=>tick+=100});instances.push(this);}};
 const selection=selectFor(core,engine.model,snapshot,[],[0,6]),base={task:'manual-swap',modelId:'cube2',snapshot,selection};
 const first=await worker.send({...base,id:1,options:{maxMs:3000}});
 assert.equal(first.result.status,'unknown');assert.equal(first.result.search.canContinue,true);assert.equal(first.result.search.nextBudgetMs,10000);assert.equal(first.result.search.resumed,false);
 assert(first.result.search.transitions>0&&first.result.search.transitions<17,'the first slice genuinely performs part of the search');
 const retained=instances[0].records[0],second=await worker.send({...base,id:2,options:{maxMs:10000}});
 assert.equal(instances.length,1,'the same normalized request retains one session');assert.equal(instances[0].records[0],retained,'the original frontier is retained');
 assert.equal(second.result.status,'solved',second.result.reason);assert.equal(second.result.search.resumed,true);assert.equal(second.result.search.canContinue,false);
 assert.equal(second.result.search.transitions,17,'B2 is generator 17: each of the 17 root transitions is visited exactly once across both slices');
 assert.equal(second.result.moveIndices.length,1);assert(core.verify(engine.model,core.normalize(engine.model,second.request),second.result.moveIndices));
 assert(worker.responses.some(r=>r.type==='progress'&&r.stage==='searching'&&r.search.states>0),'live worker progress carries actual accumulated work');
 const before=core.mapSnapshot(engine.model,snapshot);second.engineMoves.forEach(engine.apply);const after=core.mapSnapshot(engine.model,engine.getState());
 assert.equal(after.stickerToNode[before.nodeToSticker[0]],6);assert.equal(after.stickerToNode[before.nodeToSticker[6]],0);
});

test('manual worker keys the retained session by current holds, selected pair and colors',async()=>{
 const core=browser('constrained-solver-core.js').ctx.ConstrainedSolverCore,worker=browser('constrained-solver-worker.js'),engine=engineFor('cube2');
 const module=worker.ctx.require('./manual-session.cjs'),Actual=module.ManualSwapSession,instances=[];
 module.ManualSwapSession=class extends Actual{constructor(model,request,options){let tick=0;super(model,request,{...options,colorCache:null,constructive:false,_clock:()=>tick+=100});instances.push(this);}};
 let snapshot=engine.getState();const base={task:'manual-swap',id:1,modelId:'cube2',options:{maxMs:3000}};
 const send=(held,pair)=>worker.send({...base,snapshot,selection:selectFor(core,engine.model,snapshot,held,pair,{holdSemantics:'color'})});
 await send([],[0,6]);assert.equal(instances.length,1);await send([],[0,6]);assert.equal(instances.length,1,'same request retains its completed work');
 await send([2],[0,6]);assert.equal(instances.length,2,'new holds create a new projected goal');
 await send([2],[0,7]);assert.equal(instances.length,3,'new endpoint creates a new projected goal');
 engine.apply(engine.model.moves.find(m=>m.name==='R').engineMove);snapshot=engine.getState();
 await send([2],[0,7]);assert.equal(instances.length,4,'same node addresses with changed colors cannot reuse the previous search');
});

test('manual worker clamps time and memory, reports a nonproof limit, and cannot restart a terminal session',async()=>{
 const core=browser('constrained-solver-core.js').ctx.ConstrainedSolverCore,worker=browser('constrained-solver-worker.js'),engine=engineFor('cube2'),snapshot=engine.getState();
 const module=worker.ctx.require('./manual-session.cjs'),Actual=module.ManualSwapSession,instances=[];
 module.ManualSwapSession=class extends Actual{constructor(model,request,options){super(model,request,{...options,constructive:false});instances.push(this);}};
 const message={task:'manual-swap',id:1,modelId:'cube2',snapshot,selection:selectFor(core,engine.model,snapshot,[],[0,6]),options:{maxMs:60000,maxStorageBytes:128*1024*1024,maxOutputMoves:20000,maxSearchStates:1}};
 const first=await worker.send(message);assert.equal(first.result.status,'unknown');assert.equal(first.result.search.canContinue,false);assert.equal(first.result.search.terminalReason,'state_limit');
 assert.equal(instances[0].options.maxMs,60000);assert.equal(instances[0].options.maxStorageBytes,48*1024*1024);assert.equal(instances[0].options.maxOutputMoves,5000);
 assert.equal(first.result.search.budgetMs,60000);assert.equal(first.result.search.nextBudgetMs,null);assert.deepEqual(first.engineMoves,[]);
 const second=await worker.send({...message,id:2});assert.equal(instances.length,1);assert.equal(second.result.status,'unknown');assert.equal(second.result.search.canContinue,false);assert.equal(second.result.search.transitions,first.result.search.transitions,'terminal requests do not silently repeat a bounded search');
 const overLimit=await worker.send({...message,id:3,options:{maxMs:120000}});assert.equal(overLimit.result.status,'invalid');assert.equal(instances.length,1,'a budget above the one-minute safety ceiling cannot start extra work');
});

test('manual worker independently rejects a bad session witness before returning engine commands',async()=>{
 const core=browser('constrained-solver-core.js').ctx.ConstrainedSolverCore,worker=browser('constrained-solver-worker.js'),engine=engineFor('cube2'),snapshot=engine.getState();
 worker.ctx.require('./manual-session.cjs').ManualSwapSession=class{advance(){return {status:'solved',moveIndices:[0],search:{budgetMs:3000,canContinue:false}};}};
 const reply=await worker.send({task:'manual-swap',id:1,modelId:'cube2',snapshot,selection:selectFor(core,engine.model,snapshot,[],[0,6])});
 assert.equal(reply.result.status,'unknown');assert.equal(reply.result.reason,'internal_witness_verification_failed');assert.equal(reply.result.search.canContinue,false);assert.deepEqual(reply.engineMoves,[]);
});
