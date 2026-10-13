'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'../dist/games'),plain=x=>JSON.parse(JSON.stringify(x));
function engineFor(id){
 const model=JSON.parse(fs.readFileSync(path.join(root,'constrained-solver-models',id+'.json'),'utf8')),spec=model.adapter.source,ctx={CUBE_SIZE:Number(id.slice(4))};ctx.window=ctx;vm.createContext(ctx);
 let code=fs.readFileSync(path.join(root,path.basename(spec.file)),'utf8');if(spec.file.endsWith('.html'))code=[...code.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>new RegExp('root\\.'+spec.rootName+'\\s*=').test(s));
 assert(code,'Missing engine '+id);vm.runInContext(code,ctx);const E=ctx[spec.rootName],M=spec.kind==='model'?E.create(id):null;let state=M?M.stickerState:E.makeSolved();
 return {model,getState:()=>plain(M?M.stickerState:state),apply:move=>{if(M)M.applyMove(move);else state=E.applyMove(state,move);}};
}
function browser(filename,{tamperCache=false}={}){
 const replies=[],fetches=[],ctx={URL,performance,TextEncoder,crypto:webcrypto,console,fetch:async url=>{const pathname=new URL(url).pathname;fetches.push(pathname);let text=fs.readFileSync(path.join(root,pathname.replace(/^\/games\//,'')),'utf8');if(tamperCache&&pathname.includes('/constrained-solver-caches/'))text+=' ';return{ok:true,text:async()=>text};}};
 ctx.document={currentScript:{src:'https://atlas.test/games/'+filename},baseURI:'https://atlas.test/games/cube2.html'};ctx.location={href:'https://atlas.test/games/'+filename};ctx.self=ctx;ctx.globalThis=ctx;ctx.postMessage=data=>replies.push(structuredClone(data));vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,filename),'utf8'),ctx,{filename});return{ctx,fetches,send:async data=>{await ctx.onmessage({data:plain(data)});return replies.at(-1);}};
}
test('eligibility classifies actual occupied nodes for all 34 engines, with no-hold and non-prefix holds',async()=>{
 const core=browser('constrained-solver-core.js').ctx.ConstrainedSolverCore,worker=browser('constrained-solver-worker.js');
 for(const id of core.modelIds){const engine=engineFor(id),model=await core.loadModel(id);for(const i of [0,Math.floor(model.moves.length/3)])engine.apply(model.moves[i].engineMove);const snapshot={stickers:engine.getState()},before=JSON.stringify(snapshot),mapping=core.mapSnapshot(model,snapshot),ids=Object.keys(mapping.stickerToNode);
  for(const held of [[],[ids.at(-1)],ids.filter((_,i)=>i%5===3)]){const reply=await worker.send({task:'eligible-swaps',id:model.id,modelId:model.id,snapshot,selection:{protectedStickerIds:held}}),r=reply.result;assert.equal(r.status,'complete',model.id+': '+r.reason);assert.equal(reply.modelFingerprint,core.modelFingerprint(model.id));assert(r.firstStatus instanceof Uint8Array);assert(r.knownPairs instanceof Uint8Array);assert(r.feasiblePairs instanceof Uint8Array);assert.equal(r.firstStatus.length,model.degree);assert.deepEqual(r.protectedNodes,held.map(x=>mapping.stickerToNode[x]).sort((a,b)=>a-b));
   for(const a of mapping.occupiedNodes){let any=false;for(const b of mapping.occupiedNodes){const s=core.eligibilityStatus(r,a,b);assert.equal(s,core.eligibilityStatus(r,b,a));assert(s===1||s===2,model.id+' unresolved pair');if(s===1){assert(!r.protectedNodes.includes(a));assert(!r.protectedNodes.includes(b));assert.notEqual(a,b);any=true;}}assert.equal(core.eligibilityStatus(r,a),any?1:2);}
  }assert.equal(JSON.stringify(snapshot),before,'eligibility mutated state');
 }
});
test('eligibility keeps small lazy bounded results, reuses held-set cache and current address mappings',async()=>{
 const core=browser('constrained-solver-core.js').ctx.ConstrainedSolverCore,worker=browser('constrained-solver-worker.js'),engine=engineFor('cube2');let snapshot={stickers:engine.getState()},mapping=core.mapSnapshot(engine.model,snapshot),held=Object.keys(mapping.stickerToNode).slice(-2);
 const req={task:'eligible-swaps',id:1,modelId:'cube2',snapshot,selection:{protectedStickerIds:[]}};const nohold=await worker.send(req);assert.equal(nohold.result.status,'complete');assert(!worker.fetches.some(x=>x.includes('-caches/')));
 req.selection.protectedStickerIds=held;const full=await worker.send(req);assert.equal(full.result.status,'complete');assert(worker.fetches.some(x=>x.includes('-caches/')));const bytes=full.result.knownPairs.byteLength+full.result.feasiblePairs.byteLength+full.result.firstStatus.byteLength;assert(bytes<1000);
 const hit=await worker.send(req);assert.equal(hit.result.cacheHit,true);engine.apply(engine.model.moves[0].engineMove);snapshot={stickers:engine.getState()};mapping=core.mapSnapshot(engine.model,snapshot);req.snapshot=snapshot;const moved=await worker.send(req);assert.deepEqual(moved.result.protectedNodes,held.map(x=>mapping.stickerToNode[x]).sort((a,b)=>a-b));
});
test('eligibility zero budget, invalid input, animation and jumbling never fabricate impossibility',async()=>{
 const core=browser('constrained-solver-core.js').ctx.ConstrainedSolverCore,worker=browser('constrained-solver-worker.js'),engine=engineFor('cube2'),snapshot={stickers:engine.getState()},base={task:'eligible-swaps',id:1,modelId:'cube2',snapshot};
 const limited=await worker.send({...base,options:{maxMs:0}});assert.equal(limited.result.status,'unknown');assert.equal(core.eligibilityStatus(limited.result,0,1),0);assert.equal(core.eligibilityStatus(limited.result,0),0);
 for(const changes of [{selection:{protectedStickerIds:['missing']}},{selection:{protectedStickerIds:2}},{selection:{mode:'exact_swap'}},{options:{maxMs:'3'}},{snapshot:{...snapshot,animating:true}}]){const r=await worker.send({...base,...changes});assert.equal(r.result.status,'invalid',JSON.stringify(changes));}
 const heli=engineFor('helicopter'),r=await worker.send({task:'eligible-swaps',id:2,modelId:'helicopter',snapshot:{stickers:heli.getState(),advanced:true}});assert.equal(r.result.status,'invalid');assert.match(r.result.reason,/jumbling/);
});
test('failed cache integrity cannot turn an unresolved candidate into an impossible one',async()=>{
 const worker=browser('constrained-solver-worker.js',{tamperCache:true}),engine=engineFor('cube2'),snapshot={stickers:engine.getState()},reply=await worker.send({task:'eligible-swaps',id:1,modelId:'cube2',snapshot,selection:{protectedStickerIds:[snapshot.stickers[0].id]}});
 assert(['partial','unknown'].includes(reply.result.status));assert.match(reply.result.detail,/version/);assert(reply.result.firstStatus.some(x=>x===0));
});
test('browser color eligibility admits a same-color replacement excluded by identity holds and keys results by current colors',async()=>{
 const core=browser('constrained-solver-core.js').ctx.ConstrainedSolverCore,worker=browser('constrained-solver-worker.js'),engine=engineFor('cube2'),model=engine.model;
 const p=model.moves.find(m=>m.name==='U2').perm,held=model.nodes.find(n=>n.face==='U'&&p[n.index]!==n.index).index;
 const a=model.nodes.find(n=>n.face!=='U'&&n.piece===model.nodes[held].piece&&p[n.index]!==n.index&&p[p[n.index]]===n.index).index,b=p[a];
 let snapshot={stickers:engine.getState()},mapping=core.mapSnapshot(model,snapshot);
 const request={task:'eligible-swaps',id:1,modelId:'cube2',snapshot,selection:{protectedStickerIds:[mapping.nodeToSticker[held]]}};
 const strict=await worker.send(request);assert.equal(core.eligibilityStatus(strict.result,a,b),2,'moving the corner is impossible if its held sticker must stay at its own location');
 request.selection.holdSemantics='color';const relaxed=await worker.send(request);
 assert.equal(core.eligibilityStatus(relaxed.result,a,b),1,'U2 supplies a concrete witness preserving the held white color');
 assert(worker.fetches.some(p=>p.includes('/color-solver-caches/')),'the real browser asset route loads the short-move library');
 const hit=await worker.send(request);assert.equal(hit.result.cacheHit,relaxed.result.status==='complete'?true:undefined,'complete tables may be reused; partial color searches must remain retryable');
 engine.apply(model.moves.find(m=>m.name==='U2').engineMove);snapshot={stickers:engine.getState()};mapping=core.mapSnapshot(model,snapshot);
 const changed=await worker.send({...request,snapshot,selection:{holdSemantics:'color',protectedStickerIds:[mapping.nodeToSticker[held]]}});
 assert.notEqual(changed.result.cacheHit,true,'same held address with changed surrounding colors requires a fresh eligibility result');
 assert.deepEqual(changed.result.protectedNodes,[held]);
 assert.notDeepEqual(changed.result.colorByNode,relaxed.result.colorByNode,'the fixture changes surrounding colors');assert.deepEqual(changed.result.colorByNode,plain(core.colorsFromSnapshot(model,snapshot)),'returned eligibility belongs to the new color state');
});
