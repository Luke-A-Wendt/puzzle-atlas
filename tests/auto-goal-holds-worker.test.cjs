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

test('generated Auto holds worker returns independently verified goal swaps for cube and shape engines on subpaths',async()=>{
 const core=browser('constrained-solver-core.js').ctx.ConstrainedSolverCore,worker=browser('constrained-solver-worker.js');
 for(const id of ['cube3','ghost','pyramorphix']){
  const engine=engineFor(id);scramble(engine);const model=await core.loadModel(id),snapshot=engine.snapshot(),before=JSON.stringify(snapshot),mapping=core.mapSnapshot(model,snapshot),colors=core.colorsFromSnapshot(model,snapshot,mapping);
  const reply=await worker.send({task:'auto-holds',id,modelId:id,expectedRelease:core.assetRelease,snapshot});
  assert.equal(reply.id,id);assert.equal(reply.type,'result');assert.equal(reply.modelFingerprint,core.modelFingerprint(id));const r=reply.result;assert.equal(r.status,'ready',id+': '+r.reason);
  const goal=Array(model.degree).fill(null);for(const [s,n]of Object.entries(model.homeBySticker))goal[n]=model.colorBySticker[s];
  const [a,b]=r.pair;assert(!r.protectedNodes.includes(a)&&!r.protectedNodes.includes(b));assert(r.protectedNodes.every(n=>colors[n]===goal[n]));
  assert((goal[a]!==null&&colors[a]!==goal[a]&&colors[b]===goal[a])||(goal[b]!==null&&colors[b]!==goal[b]&&colors[a]===goal[b]));
  const request={swap:r.pair,protected:r.protectedNodes,occupiedNodes:[...mapping.occupiedNodes],holdSemantics:'color',colorByNode:[...colors],protection:'endpoint'};
  assert(core.verify(model,core.normalize(model,request),r.word));assert(core.eligibilityReady(r.eligibility,a,b));assert.deepEqual(plain(core.eligibilityWitness(r.eligibility,a,b)),r.word);
  const endpointIds=r.pair.map(n=>mapping.nodeToSticker[n]),heldColors=new Map(r.protectedNodes.map(n=>[n,colors[n]]));
  for(const move of r.word)engine.apply(model.moves[move].engineMove);
  const after=engine.snapshot(),afterMapping=core.mapSnapshot(model,after),afterColors=core.colorsFromSnapshot(model,after,afterMapping);
  assert.equal(afterMapping.stickerToNode[endpointIds[0]],b);assert.equal(afterMapping.stickerToNode[endpointIds[1]],a);for(const [n,c]of heldColors)assert.equal(afterColors[n],c);
  assert.equal(JSON.stringify(snapshot),before,'worker must not mutate supplied state');
 }
 assert(worker.fetches.some(p=>p.includes('/color-solver-caches/')));assert(!worker.fetches.some(p=>p.includes('/constrained-solver-caches/')),'Auto holds does not load full-solve data');
});

test('generated Auto holds worker distinguishes solved and no-ready states without fabricating pairs',async()=>{
 const core=browser('constrained-solver-core.js').ctx.ConstrainedSolverCore,worker=browser('constrained-solver-worker.js'),engine=engineFor('cube2'),model=await core.loadModel('cube2');
 const base={task:'auto-holds',id:1,modelId:'cube2',expectedRelease:core.assetRelease};
 const solved=await worker.send({...base,snapshot:engine.snapshot()});assert.equal(solved.modelFingerprint,core.modelFingerprint(model));assert.equal(solved.result.status,'solved');assert.equal(solved.result.protectedNodes.length,model.stickerCount);assert.equal(solved.result.pair,undefined);
 scramble(engine);const absent=await worker.send({...base,id:2,snapshot:engine.snapshot(),options:{maxMs:0}});assert.equal(absent.modelFingerprint,core.modelFingerprint(model));assert.equal(absent.result.status,'no_ready_swap');assert.deepEqual(absent.result.protectedNodes,[]);assert.equal(absent.result.pair,undefined);assert.equal(absent.result.eligibility,undefined);
 const stale=await worker.send({...base,id:3,snapshot:engine.snapshot(),expectedRelease:'stale-release'});assert.equal(stale.result.reason,'release_mismatch');assert.equal(stale.result.status,'unknown');
});
