'use strict';
// Exact swap reachability under a pointwise stabilizer. Classification never
// expands words. Constructive callers may attach ctx.words to retain witnesses
// while reusing the same certified chain and adjacent-base-swap machinery.
const {compileModel,identity,compose,inverse}=require('./group.cjs');
const {modelSignature}=require('./full-solve.cjs');
const {eligibilityStatus}=require('./eligibility-status.cjs');
class EligibilityLimit extends Error {}
function context(options={}){
 const bounds={maxMs:[0,60000,3000],maxStorageBytes:[0,128*1024*1024,48*1024*1024],maxStrongGenerators:[0,10000,2000],maxOperations:[0,100000000,100000000],maxBaseSwaps:[0,100000,50000]};const config={};
 for(const [name,[min,max,fallback]]of Object.entries(bounds)){const value=options[name]??fallback;if(!Number.isSafeInteger(value)||value<min||value>max)throw Error('Invalid eligibility budget '+name);config[name]=value;}
 const started=performance.now(),stats={baseSwaps:0,generatedStabilizers:0,compactions:0,pointOrbits:0,pairOrbits:0,pairTransitions:0,operations:0,storageEstimateBytes:0};
 return {config,stats,started,tick(n=1){stats.operations+=n;if(stats.operations>config.maxOperations)throw new EligibilityLimit('operation_limit');if((stats.operations&1023)<n)this.check();},check(){if(performance.now()-started>=config.maxMs)throw new EligibilityLimit('time_limit');},storage(bytes){stats.storageEstimateBytes=Math.max(stats.storageEstimateBytes,bytes);if(bytes>config.maxStorageBytes)throw new EligibilityLimit('storage_limit');},generators(count,d,extra=0){if(count>config.maxStrongGenerators)throw new EligibilityLimit('strong_generator_limit');this.storage((this.baseStorage??0)+count*(d*4+128)+extra);}};
}
function orbit(point,generators,d,ctx,representatives=false){
 const seen=new Uint8Array(d),nodes=[point],reps=representatives?new Array(d):null,wordReps=representatives&&ctx.words?new Array(d):null;seen[point]=1;if(reps)reps[point]=identity(d);if(wordReps)wordReps[point]=0;
 for(let head=0;head<nodes.length;head++){const x=nodes[head];for(const g of generators){ctx.tick();const y=g.perm[x];if(seen[y])continue;seen[y]=1;nodes.push(y);if(reps)reps[y]=compose(reps[x],g.perm);if(wordReps)wordReps[y]=ctx.words.join(wordReps[x],g.word);}}
 return {nodes,seen,reps,wordReps};
}
function validateStoredPermutation(raw,d,prefix,imageBase,image){if(!Array.isArray(raw)||raw.length!==d)throw Error('Malformed stabilizer cache permutation');const seen=new Uint8Array(d);for(const x of raw){if(!Number.isInteger(x)||x<0||x>=d||seen[x])throw Error('Malformed stabilizer cache permutation');seen[x]=1;}if(raw[imageBase]!==image||prefix.some(x=>raw[x]!==x))throw Error('Malformed stabilizer cache representative');return Uint32Array.from(raw);}
function prepareChain(model,cache,ctx){
 const d=model.degree;if(!cache||cache.status!=='ready'||cache.complete!==true||cache.schemaVersion!==1||cache.degree!==d||cache.modelSignature!==modelSignature(model))throw new EligibilityLimit('complete_stabilizer_cache_unavailable');
 if(!Array.isArray(cache.base)||cache.base.length!==d||new Set(cache.base).size!==d||cache.base.some(x=>!Number.isInteger(x)||x<0||x>=d)||cache.levels.length!==d)throw Error('Malformed stabilizer cache base');
 const base=cache.base.slice(),sizes=cache.levels.map(l=>l.entries.length+1),generators=[];
 ctx.baseStorage=cache.words.length*48+cache.levels.reduce((sum,l)=>sum+l.entries.length*(d*8+64),0);ctx.storage(ctx.baseStorage);
 // A subgroup containing G_(k+1) equals G_k once its orbit of b_k has
 // the certified index [G_k:G_(k+1)]. This keeps a small strong generator set.
 for(let k=d-1;k>=0;k--){ctx.check();const l=cache.levels[k];if(l.base!==base[k])throw Error('Malformed stabilizer cache level');let reached=new Uint8Array(d);reached[base[k]]=1;let size=1;
  for(const [image,word,raw]of l.entries){if(reached[image])continue;const perm=validateStoredPermutation(raw,d,base.slice(0,k),base[k],image);generators.push({perm,level:k,...(ctx.words?{word}:{})});ctx.generators(generators.length,d);const o=orbit(base[k],generators,d,ctx);reached=o.seen;size=o.nodes.length;if(size>=sizes[k])break;}
  if(size!==sizes[k])throw Error('Stabilizer cache orbit size is inconsistent');
 }
 return {base,sizes,generators,cacheStorage:ctx.baseStorage};
}
function compact(chain,d,ctx){
 const compacted=[];for(let k=d-1;k>=0;k--){let reached=new Uint8Array(d);reached[chain.base[k]]=1;let size=1;for(const g of chain.generators){if(g.level!==k||reached[g.perm[chain.base[k]]])continue;compacted.push(g);const o=orbit(chain.base[k],compacted,d,ctx);reached=o.seen;size=o.nodes.length;if(size===chain.sizes[k])break;}if(size!==chain.sizes[k])throw Error('Strong generator compaction lost a certified orbit');}
 chain.generators=compacted;ctx.stats.compactions++;ctx.generators(compacted.length,d);
}
function adjacentSwap(chain,k,d,ctx){
 ctx.check();if(++ctx.stats.baseSwaps>ctx.config.maxBaseSwaps)throw new EligibilityLimit('base_swap_limit');
 const a=chain.base[k],b=chain.base[k+1],upper=chain.generators.filter(g=>g.level>=k),nextOrbit=orbit(b,upper,d,ctx,true),target=(chain.sizes[k]*chain.sizes[k+1])/nextOrbit.nodes.length;
 if(!Number.isInteger(target)||target<1)throw Error('Invalid adjacent stabilizer index');
 const inverses=new Array(d),fixB=upper.filter(g=>g.perm[b]===b);let reached=orbit(a,fixB,d,ctx);
 ctx.generators(chain.generators.length,d,nextOrbit.nodes.length*d*8+d*16);
 if(reached.nodes.length>target)throw Error('Adjacent stabilizer index exceeded');
 outer:for(const x of nextOrbit.nodes){if(reached.nodes.length===target)break;const rx=nextOrbit.reps[x];for(const g of upper){ctx.tick();const y=g.perm[x],inv=inverses[y]??(inverses[y]=inverse(nextOrbit.reps[y]));const image=inv[g.perm[rx[a]]];if(reached.seen[image])continue;
   const perm=compose(compose(rx,g.perm),inv);const record={perm,level:k+1,...(ctx.words?{word:ctx.words.list([nextOrbit.wordReps[x],g.word,-nextOrbit.wordReps[y]])}:{})};fixB.push(record);chain.generators.push(record);ctx.stats.generatedStabilizers++;ctx.generators(chain.generators.length,d,nextOrbit.nodes.length*d*8+d*16);reached=orbit(a,fixB,d,ctx);if(reached.nodes.length>target)throw Error('Adjacent stabilizer index exceeded');if(reached.nodes.length===target)break outer;
  }}
 if(reached.nodes.length!==target)throw Error('Adjacent stabilizer Schreier generation did not complete');
 chain.base[k]=b;chain.base[k+1]=a;chain.sizes[k]=nextOrbit.nodes.length;chain.sizes[k+1]=target;
 for(const g of chain.generators)if(g.level===k||g.level===k+1)g.level=g.perm[b]===b?k+1:k;
}
function stabilizer(prepared,held,d,ctx){
 const chain={base:prepared.base.slice(),sizes:prepared.sizes.slice(),generators:prepared.generators.map(g=>({...g}))};ctx.baseStorage=prepared.cacheStorage+prepared.generators.length*(d*4+128);
 // Pointwise protection is independent of hold order. Preserve the old base
 // order within the held subset to perform the fewest adjacent transpositions.
 const heldSet=new Set(held);held=prepared.base.filter(x=>heldSet.has(x));
 for(let i=0;i<held.length;i++){let j=chain.base.indexOf(held[i],i);if(j<0)throw Error('Protected address not found in base');while(j>i){adjacentSwap(chain,j-1,d,ctx);j--;if(chain.generators.length>Math.max(prepared.generators.length*2,400))compact(chain,d,ctx);}}
 return chain.generators.filter(g=>g.level>=held.length);
}
function normalize(model,request={}){
 const d=model.degree;if(!Number.isInteger(d)||d<2||d>4096||model.supported===false||model.fixedPermutation===false||model.stateDependentLegality===true)throw Error('Unsupported eligibility move model');
 if(request.mode&&request.mode!=='protected_swap')throw Error('Eligibility uses protected-swap semantics');
 const protection=request.protection??'endpoint';if(!['endpoint','throughout'].includes(protection))throw Error('Unknown protection semantics');
 const node=x=>{if(!Number.isInteger(x)||x<0||x>=d)throw Error('Unknown node address');return x;};
 if(request.protected!==undefined&&!Array.isArray(request.protected))throw Error('Protected nodes must be an array');const held=[...new Set((request.protected??[]).map(node))].sort((a,b)=>a-b);
 const raw=request.occupiedNodes??(model.requiresOccupiedState?null:Array.from({length:d},(_,i)=>i));if(!Array.isArray(raw))throw Error('Current occupied pose addresses are required');const occupied=raw.map(node).sort((a,b)=>a-b);if(new Set(occupied).size!==occupied.length||occupied.length!==(model.stickerCount??d))throw Error('Occupied addresses must identify every physical sticker exactly once');const occupiedSet=new Set(occupied);if(held.some(x=>!occupiedSet.has(x)))throw Error('Protected nodes must be occupied');const fixed=new Set(held);return {protectedNodes:held,occupiedNodes:occupied,candidateNodes:occupied.filter(x=>!fixed.has(x)),protection};
}
function initResult(d,request,ctx){const bytes=Math.ceil(d*d/8);ctx.storage(bytes*2+d*4);const knownPairs=new Uint8Array(bytes),feasiblePairs=new Uint8Array(bytes),firstStatus=new Uint8Array(d).fill(2),candidateSet=new Set(request.candidateNodes);for(let a=0;a<d;a++){if(candidateSet.has(a))firstStatus[a]=0;for(let b=0;b<d;b++){if(a===b||!candidateSet.has(a)||!candidateSet.has(b)){const i=a*d+b;knownPairs[i>>>3]|=1<<(i&7);}}}return {degree:d,...request,knownPairs,feasiblePairs,firstStatus};}
function mark(result,a,b,feasible){const i=a*result.degree+b,mask=1<<(i&7);result.knownPairs[i>>>3]|=mask;if(feasible)result.feasiblePairs[i>>>3]|=mask;}
function pointOrbits(generators,d,ctx){const seen=new Uint8Array(d),groups=[],labels=new Int32Array(d);for(let x=0;x<d;x++){if(seen[x])continue;const o=orbit(x,generators,d,ctx);for(const y of o.nodes){seen[y]=1;labels[y]=groups.length;}groups.push(o.nodes);}return {groups,labels};}
function excludeDifferentOrbits(result,labels){for(const a of result.candidateNodes)for(const b of result.candidateNodes)if(labels[a]!==labels[b])mark(result,a,b,false);}
function classifyPairs(result,generators,ctx){const d=result.degree,{groups,labels}=pointOrbits(generators,d,ctx);ctx.stats.pointOrbits=groups.length;excludeDifferentOrbits(result,labels);const candidateSet=new Set(result.candidateNodes);
 for(const points of groups){ctx.check();const relevant=points.filter(x=>candidateSet.has(x));if(relevant.length<2)continue;const n=points.length,index=new Int32Array(d).fill(-1);points.forEach((x,i)=>index[x]=i);const actions=[],keys=new Set();for(const g of generators){const action=Int32Array.from(points,x=>index[g.perm[x]]);if(action.every((x,i)=>x===i))continue;const key=action.join(',');if(keys.has(key))continue;keys.add(key);actions.push(action);}
  const visited=new Uint8Array(n*n),queue=new Uint32Array(n*n);ctx.storage((ctx.baseStorage??0)+generators.length*(d*4+128)+n*n*5+actions.length*n*4+result.knownPairs.byteLength*2);
  for(let a=0;a<n;a++)for(let b=0;b<n;b++){const start=a*n+b;if(a===b||visited[start])continue;let tail=1;queue[0]=start;visited[start]=1;let reverses=false;
   for(let head=0;head<tail;head++){const p=queue[head],x=Math.floor(p/n),y=p%n;if(x===b&&y===a)reverses=true;for(const g of actions){ctx.tick();ctx.stats.pairTransitions++;const next=g[x]*n+g[y];if(visited[next])continue;visited[next]=1;queue[tail++]=next;}}
   // Only a completely explored ordered-pair orbit permits a negative answer.
   ctx.stats.pairOrbits++;for(let j=0;j<tail;j++){const x=points[Math.floor(queue[j]/n)],y=points[queue[j]%n];if(candidateSet.has(x)&&candidateSet.has(y)){mark(result,x,y,reverses);mark(result,y,x,reverses);}}
  }
 }
}
function finalize(result,ctx,reason){let unresolved=0,known=0;for(const a of result.candidateNodes){let yes=false,pending=false;for(const b of result.candidateNodes){if(a===b)continue;const status=eligibilityStatus(result,a,b);if(status===1)yes=true;if(status===0){pending=true;unresolved++;}else known++;}result.firstStatus[a]=yes?1:pending?0:2;}
 return {...result,status:unresolved?(known?'partial':'unknown'):'complete',...(reason?{reason}:{}),stats:{...ctx.stats,elapsedMs:performance.now()-ctx.started}};
}
function cloneResult(r){return {...r,protectedNodes:r.protectedNodes.slice(),occupiedNodes:r.occupiedNodes.slice(),candidateNodes:r.candidateNodes.slice(),firstStatus:r.firstStatus.slice(),knownPairs:r.knownPairs.slice(),feasiblePairs:r.feasiblePairs.slice(),stats:{...r.stats}};}
class EligibilityAnalyzer{
 constructor(model,cache=null,{cacheBytes=2*1024*1024}={}){this.model=model;this.compiled=compileModel(model);this.cache=cache;this.prepared=null;this.results=new Map();this.bytes=0;this.maxBytes=Math.min(8*1024*1024,Math.max(0,cacheBytes));}
 setCache(cache){if(this.cache!==cache){this.cache=cache;this.prepared=null;}}
 analyze(request={},options={}){let ctx,result;try{ctx=context(options);const req=normalize(this.model,request),key=JSON.stringify([modelSignature(this.model),req]);if(this.results.has(key)){const cached=this.results.get(key);this.results.delete(key);this.results.set(key,cached);return {...cloneResult(cached.value),cacheHit:true};}
   result=initResult(this.model.degree,req,ctx);if(req.candidateNodes.length<2)return finalize(result,ctx);
   ctx.check();const primitive=this.compiled.moves.map(g=>({perm:g.perm,level:0}));const global=pointOrbits(primitive,this.model.degree,ctx);excludeDifferentOrbits(result,global.labels);
   let generators;
   if(req.protection==='throughout')generators=primitive.filter(g=>req.protectedNodes.every(x=>g.perm[x]===x));
   else if(!req.protectedNodes.length)generators=primitive;
   else {if(!this.prepared)this.prepared=prepareChain(this.model,this.cache,ctx);generators=stabilizer(this.prepared,req.protectedNodes,this.model.degree,ctx);}
   classifyPairs(result,generators,ctx);result=finalize(result,ctx);if(result.status==='complete'){const bytes=result.knownPairs.byteLength+result.feasiblePairs.byteLength+result.firstStatus.byteLength+this.model.degree*16+1024;if(bytes<=this.maxBytes){while(this.bytes+bytes>this.maxBytes&&this.results.size){const k=this.results.keys().next().value;this.bytes-=this.results.get(k).bytes;this.results.delete(k);}this.results.set(key,{value:cloneResult(result),bytes});this.bytes+=bytes;}}return result;
  }catch(error){if(error instanceof EligibilityLimit&&result)return finalize(result,ctx,error.message);return {status:error instanceof EligibilityLimit?'unknown':'invalid',reason:error.message,stats:ctx?{...ctx.stats,elapsedMs:performance.now()-ctx.started}:undefined};}
 }
}
function eligibleSwaps(model,request,options={}){try{return new EligibilityAnalyzer(model,options.cache,{cacheBytes:0}).analyze(request,options);}catch(error){return {status:'invalid',reason:error.message};}}
module.exports={EligibilityAnalyzer,eligibleSwaps,eligibilityStatus,prepareChain,stabilizer,eligibilityContext:context,EligibilityLimit};
