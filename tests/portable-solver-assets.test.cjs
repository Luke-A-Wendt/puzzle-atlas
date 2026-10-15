'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto,createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../dist/games'),plain=x=>JSON.parse(JSON.stringify(x));
const assetGroups=[['fingerprints','constrained-solver-models'],['fullCacheFingerprints','constrained-solver-caches'],['colorCacheFingerprints','color-solver-caches']];
const catalogIds=JSON.parse(fs.readFileSync(path.join(root,'constrained-solver-models/manifest.json'),'utf8')).models.map(model=>model.id).sort();

// Execute the shipping bundles with real WebCrypto. The fetch adapter denies
// every origin/path outside the selected static deployment; no development
// server, API, or Internet resource can satisfy an accidentally absolute URL.
function host(filename,{base='https://luke-a-wendt.github.io/puzzle-atlas/games/',tamper=false,staleFirst=false,missing=false,offline=false}={}){
 const baseURL=new URL(base),requests=[],responses=[],fetchOptions=[];
 const ctx={URL,performance,TextEncoder,crypto:webcrypto,console,setTimeout,clearTimeout,AbortController,fetch:async (input,options={})=>{
  const url=new URL(input);requests.push(url.href);fetchOptions.push(options);
  assert.equal(url.origin,baseURL.origin,'asset must stay on deployment origin');
  assert(url.pathname.startsWith(baseURL.pathname),'asset must stay inside deployment subdirectory');
  if(offline)throw new TypeError('Failed to fetch');
  if(missing)return {ok:false,status:404,text:async()=>''};
  const relative=url.pathname.slice(baseURL.pathname.length);assert(!relative.includes('..'));
  let text=fs.readFileSync(path.join(root,relative),'utf8');if(tamper||(staleFirst&&requests.length===1))text+=' ';
  return {ok:true,status:200,text:async()=>text};
 }};
 if(filename.endsWith('-core.js'))ctx.document={currentScript:{src:new URL(filename,baseURL).href},baseURI:new URL('homer.html',baseURL).href};
 ctx.location={href:new URL(filename,baseURL).href};ctx.self=ctx;ctx.globalThis=ctx;ctx.postMessage=value=>responses.push(plain(value));
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,filename),'utf8'),ctx,{filename});
 return {ctx,requests,responses,fetchOptions,send:async message=>{await ctx.onmessage({data:plain(message)});return responses.at(-1);}};
}
function homerEngine(){
 const model=JSON.parse(fs.readFileSync(path.join(root,'constrained-solver-models/homer.json'),'utf8'));
 const html=fs.readFileSync(path.join(root,'homer.html'),'utf8');
 const code=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>/root\.CubeEngine\s*=/.test(s));
 assert(code);const ctx={};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx);
 const E=ctx.CubeEngine;let state=E.makeSolved();
 return {model,snapshot:()=>({stickers:plain(state),history:[]}),apply:move=>{state=E.applyMove(state,move);},isSolved:()=>E.isSolved(state)};
}

test('all catalog model/cache files match both shipping bundles byte for byte',()=>{
 for(const filename of ['constrained-solver-core.js','constrained-solver-worker.js']){
  const source=fs.readFileSync(path.join(root,filename),'utf8');let checked=0;
  for(const [name,directory]of assetGroups){
   const found=source.match(new RegExp('const '+name+'=(\\{[^;]+\\});'));assert(found,name);
   const fingerprints=JSON.parse(found[1]);assert.deepEqual(Object.keys(fingerprints).sort(),catalogIds);
   for(const [id,expected]of Object.entries(fingerprints)){
    const bytes=fs.readFileSync(path.join(root,directory,id+'.json'));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,filename+' '+directory+'/'+id);checked++;
   }
  }
  assert.equal(checked,catalogIds.length*assetGroups.length);
 }
});

test('real secure-origin core and worker loaders resolve all catalog puzzles under root and nested deployments',async()=>{
 for(const base of ['https://example.test/games/','https://luke-a-wendt.github.io/puzzle-atlas/games/','https://example.test/arbitrary/nested/path/games/']){
  const coreHost=host('constrained-solver-core.js',{base}),worker=host('constrained-solver-worker.js',{base}),core=coreHost.ctx.ConstrainedSolverCore;
  assert.equal(core.assetBase,base);assert.deepEqual(Array.from(core.modelIds).sort(),catalogIds);
  assert.match(core.assetRelease,/^[0-9a-f]{20}$/);const workerURL=new URL(core.workerURL);
  assert.equal(workerURL.origin,new URL(base).origin);assert.equal(workerURL.pathname,new URL('constrained-solver-worker.js',base).pathname);
  assert.equal(workerURL.searchParams.get('v'),core.assetRelease);
  assert.equal(vm.runInContext('assetRelease',worker.ctx),core.assetRelease,'UI/core and worker belong to one release');
  for(const id of core.modelIds){
   const model=await core.loadModel(id),workerModel=await worker.ctx.loadModel(id);
   assert.equal(model.id,id);assert.equal(workerModel.id,id);
   const cache=await worker.ctx.loadFullCache(id),color=await worker.ctx.loadColorCache(id);
   assert.equal(cache.degree,model.degree,id);assert.equal(cache.complete,true,id);assert.equal(cache.status,'ready',id);
   assert.equal(color.degree,model.degree,id);assert.equal(color.modelSignature,cache.modelSignature,id);
   assert.equal(cache.modelSignature,worker.ctx.require('./full-solve.cjs').modelSignature(workerModel),id);
  }
  assert.equal(coreHost.requests.length,catalogIds.length);assert.equal(worker.requests.length,catalogIds.length*assetGroups.length);
 }
});

test('Homer auto solve succeeds from a real mixed scramble with no move journal on GitHub Pages paths',async()=>{
 const worker=host('constrained-solver-worker.js'),core=host('constrained-solver-core.js').ctx.ConstrainedSolverCore,engine=homerEngine(),model=await core.loadModel('homer');
 let seed=9173;for(let k=0;k<19;k++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;engine.apply(model.moves[seed%model.moves.length].engineMove);}
 assert(!engine.isSolved());const snapshot=engine.snapshot();
 const reply=await worker.send({task:'full-solve',id:1,modelId:'homer',snapshot});
 assert.equal(reply.result.status,'solved',JSON.stringify(reply.result));assert(core.verifyAutoPlan(model,snapshot,reply.result));
 for(const stage of reply.engineStages)for(const move of stage.engineMoves)engine.apply(move);
 assert(engine.isSolved());assert.equal(core.solvedProgress(model,engine.snapshot()).solvedCount,24);
 assert(worker.requests.some(url=>url.includes('/constrained-solver-caches/homer.json')));
});

test('Homer constrained solver returns and executes a verified held-node swap on GitHub Pages paths',async()=>{
 const worker=host('constrained-solver-worker.js'),core=host('constrained-solver-core.js').ctx.ConstrainedSolverCore,engine=homerEngine(),model=await core.loadModel('homer');
 engine.apply({face:'R',dir:1,turns:1});const snapshot=engine.snapshot(),before=core.mapSnapshot(model,snapshot);
 const selection={protectedStickerIds:[before.nodeToSticker[1]],swapStickerIds:[before.nodeToSticker[0],before.nodeToSticker[3]],holdSemantics:'color'};
 const reply=await worker.send({task:'manual-swap',id:1,modelId:'homer',snapshot,selection});
 assert.equal(reply.result.status,'solved',JSON.stringify(reply.result));
 const request=core.requestFromSnapshot(model,snapshot,selection);assert(core.verify(model,core.normalize(model,request),reply.result.moveIndices));
 const colors=core.colorsFromSnapshot(model,snapshot);for(const move of reply.engineMoves)engine.apply(move);
 const after=core.mapSnapshot(model,engine.snapshot()),finalColors=core.colorsFromSnapshot(model,engine.snapshot());
 assert.equal(after.stickerToNode[selection.swapStickerIds[0]],3);assert.equal(after.stickerToNode[selection.swapStickerIds[1]],0);assert.equal(finalColors[1],colors[1]);
 assert(worker.requests.some(url=>url.includes('/color-solver-caches/homer.json')));
});

test('Homer loader distinguishes missing assets, network failures and wrong-version bytes',async()=>{
 const snapshot=homerEngine().snapshot();
 for(const [options,reason] of [[{tamper:true},'model_integrity_error'],[{missing:true},'model_http_error'],[{offline:true},'model_network_error']]){
  const worker=host('constrained-solver-worker.js',options),reply=await worker.send({task:'full-solve',id:1,modelId:'homer',snapshot});
  assert.equal(reply.result.status,'unknown');assert.equal(reply.result.reason,reason);
  assert.equal(worker.requests.length,options.tamper?2:1,'integrity retry is bounded to one fresh fetch');
  if(options.tamper)assert.equal(worker.fetchOptions[1].cache,'reload');
 }
});

test('core and worker recover a stale model with exactly one cache reload',async()=>{
 for(const filename of ['constrained-solver-core.js','constrained-solver-worker.js']){
  const app=host(filename,{staleFirst:true}),load=app.ctx.ConstrainedSolverCore?.loadModel||app.ctx.loadModel;
  const model=await load('homer');assert.equal(model.id,'homer');assert.equal(app.requests.length,2);
  assert.equal(app.requests[0],app.requests[1]);assert.equal(app.fetchOptions[0].cache,undefined);assert.equal(app.fetchOptions[1].cache,'reload');
  await load('homer');assert.equal(app.requests.length,2,'validated model is cached after recovery');
 }
});

test('file protocol gives an actionable diagnostic without attempting any asset fetch',async()=>{
 for(const filename of ['constrained-solver-core.js','constrained-solver-worker.js']){
  const app=host(filename,{base:'file:///home/user/puzzle-atlas/dist/games/'}),load=app.ctx.ConstrainedSolverCore?.loadModel||app.ctx.loadModel;
  await assert.rejects(load('homer'),error=>error.code==='model_file_protocol'&&/HTTP server/.test(error.message));
  assert.equal(app.requests.length,0);
 }
});
