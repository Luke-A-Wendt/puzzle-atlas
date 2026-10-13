'use strict';

// Sound, bounded eligibility for color-preserving endpoint holds. Unlike a
// pointwise stabilizer, selected color constraints need not form a subgroup.
// A strict YES remains valid; a strict NO must therefore remain UNKNOWN unless
// even the unrestricted legal group cannot exchange the requested pair.
const {EligibilityAnalyzer,eligibilityStatus}=require('./eligibility.cjs');
const {eligibilityReady,eligibilityWitness}=require('./eligibility-status.cjs');
const {identity,compose}=require('./group.cjs');
const {modelSignature}=require('./full-solve.cjs');

class ColorEligibilityLimit extends Error {}
function normalize(model,request){
 const d=model.degree;
 if(!Number.isInteger(d)||d<2||d>4096||model.supported===false||model.fixedPermutation===false||model.stateDependentLegality===true)throw Error('Unsupported eligibility move model');
 if(request.mode&&request.mode!=='protected_swap')throw Error('Eligibility uses protected-swap semantics');
 const protection=request.protection??'endpoint';
 if(!['endpoint','throughout'].includes(protection))throw Error('Unknown protection semantics');
 const node=x=>{if(!Number.isInteger(x)||x<0||x>=d)throw Error('Unknown node address');return x;};
 if(request.protected!==undefined&&!Array.isArray(request.protected))throw Error('Protected nodes must be an array');
 const held=[...new Set((request.protected??[]).map(node))].sort((a,b)=>a-b);
 const raw=request.occupiedNodes??(model.requiresOccupiedState?null:Array.from({length:d},(_,i)=>i));
 if(!Array.isArray(raw))throw Error('Current occupied pose addresses are required');
 const occupied=raw.map(node).sort((a,b)=>a-b),occupiedSet=new Set(occupied);
 if(occupiedSet.size!==occupied.length||occupied.length!==(model.stickerCount??d))throw Error('Occupied addresses must identify every physical sticker exactly once');
 if(held.some(x=>!occupiedSet.has(x)))throw Error('Protected nodes must be occupied');
 const colors=request.colorByNode;
 if(!Array.isArray(colors)||colors.length!==d)throw Error('colorByNode must contain one color or null for every model address');
 for(let x=0;x<d;x++){
  const c=colors[x];
  if(occupiedSet.has(x)){if(typeof c!=='string'&&!(typeof c==='number'&&Number.isFinite(c)))throw Error('Occupied addresses require finite numeric or string colors');}
  else if(c!==null)throw Error('Unoccupied addresses must have null colors');
 }
 const heldSet=new Set(held);
 return {protectedNodes:held,occupiedNodes:occupied,candidateNodes:occupied.filter(x=>!heldSet.has(x)),protection,colorByNode:colors.slice(),holdSemantics:'color'};
}
function initResult(d,req){
 const bytes=Math.ceil(d*d/8),result={degree:d,...req,knownPairs:new Uint8Array(bytes),feasiblePairs:new Uint8Array(bytes),firstStatus:new Uint8Array(d).fill(2),readyPairs:new Uint8Array(bytes),readyFirstStatus:new Uint8Array(d),readyWitnesses:[]},candidates=new Set(req.candidateNodes);
 for(let a=0;a<d;a++){
  if(candidates.has(a))result.firstStatus[a]=0;
  for(let b=0;b<d;b++)if(a===b||!candidates.has(a)||!candidates.has(b))mark(result,a,b,false);
 }
 return result;
}
function mark(result,a,b,yes){
 const i=a*result.degree+b,mask=1<<(i&7);result.knownPairs[i>>>3]|=mask;
 if(yes)result.feasiblePairs[i>>>3]|=mask;
}
function cloneResult(r){return {...r,protectedNodes:r.protectedNodes.slice(),occupiedNodes:r.occupiedNodes.slice(),candidateNodes:r.candidateNodes.slice(),colorByNode:r.colorByNode.slice(),knownPairs:r.knownPairs.slice(),feasiblePairs:r.feasiblePairs.slice(),firstStatus:r.firstStatus.slice(),readyPairs:r.readyPairs.slice(),readyFirstStatus:r.readyFirstStatus.slice(),readyWitnesses:r.readyWitnesses.map(x=>({word:x.word.slice(),pairs:x.pairs.slice()})),stats:{...r.stats}};}
function retainWitness(result,word,pairs,ctx){
 // Keep one verified word for all new exchanges made by that operation.
 // Numeric arrays are charged conservatively for memory as well as their
 // exact ASCII JSON size. A truncated word must never count as executable.
 if(!word.length||word.length>5000)return false;
 const entry={word:word.slice(),pairs:pairs.flat()},bytes=Math.max(JSON.stringify(entry).length,128+8*(word.length+entry.pairs.length));
 if(ctx.stats.readyWitnessBytes+bytes>2*1024*1024||ctx.stats.storageEstimateBytes+bytes>ctx.config.maxStorageBytes){ctx.stats.readyStorageLimited=true;return false;}
 result.readyWitnesses.push(entry);ctx.stats.readyWitnessBytes+=bytes;ctx.stats.storageEstimateBytes+=bytes;
 for(const [a,b]of pairs){
  for(const [x,y]of [[a,b],[b,a]]){const i=x*result.degree+y;result.readyPairs[i>>>3]|=1<<(i&7);}
  result.readyFirstStatus[a]=1;result.readyFirstStatus[b]=1;ctx.stats.readyPairs+=2;
 }
 return true;
}
function finalize(result,ctx,reason){
 let unresolved=0,known=0;
 for(const a of result.candidateNodes){
  let yes=false,pending=false;
  for(const b of result.candidateNodes){if(a===b)continue;const s=eligibilityStatus(result,a,b);if(s===1)yes=true;if(s===0){pending=true;unresolved++;}else known++;}
  result.firstStatus[a]=yes?1:pending?0:2;
 }
 return {...result,status:unresolved?(known?'partial':'unknown'):'complete',complete:unresolved===0,proof:'witnesses_and_unrestricted_impossibility',...(unresolved?{reason:reason??'color_search_incomplete'}:{}),stats:{...ctx.stats,unknownPairs:unresolved,elapsedMs:performance.now()-ctx.started}};
}
function context(options){
 const bounds={maxMs:[60000,3000],maxStorageBytes:[128*1024*1024,48*1024*1024],maxStrongGenerators:[10000,2000],maxOperations:[100000000,100000000],maxBaseSwaps:[100000,50000]},config={};
 for(const [name,[max,fallback]]of Object.entries(bounds)){const value=options[name]??fallback;if(!Number.isSafeInteger(value)||value<0||value>max)throw Error('Invalid eligibility budget '+name);config[name]=value;}
 const started=performance.now(),stats={operations:0,macroTests:0,macroVerifications:0,macroWitnessPairs:0,strictWitnessPairs:0,globalExcludedPairs:0,invalidMacros:0,storageEstimateBytes:0,readyPairs:0,readyWitnessBytes:0};
 return {started,stats,config,remaining(){return Math.max(0,Math.floor(config.maxMs-(performance.now()-started)));},check(){if(performance.now()-started>=config.maxMs)throw new ColorEligibilityLimit('time_limit');if(stats.operations>config.maxOperations)throw new ColorEligibilityLimit('operation_limit');},tick(n=1){stats.operations+=n;if((stats.operations&255)<n)this.check();},options(cap=Infinity){return {...config,maxMs:Math.min(this.remaining(),cap),maxOperations:Math.max(0,config.maxOperations-stats.operations)};}};
}

class ColorEligibilityAnalyzer{
 constructor(model,cache=null,{cacheBytes=2*1024*1024,colorCache=null}={}){
  this.model=model;this.strict=new EligibilityAnalyzer(model,cache,{cacheBytes});this.compiled=this.strict.compiled;
  this.colorCache=null;this.verifiedOperations=new WeakMap();this.results=new Map();this.bytes=0;
  this.maxBytes=Math.min(8*1024*1024,Math.max(0,cacheBytes));this.signature=modelSignature(model);this.setColorCache(colorCache);
 }
 get cache(){return this.strict.cache;}
 setCache(cache){this.strict.setCache(cache);}
 setColorCache(cache){if(this.colorCache!==cache){this.colorCache=cache;this.verifiedOperations=new WeakMap();this.results.clear();this.bytes=0;}}
 analyze(request={},options={}){
  if(request.holdSemantics!==undefined&&!['color','sticker'].includes(request.holdSemantics))return {status:'invalid',reason:'Unknown hold semantics'};
  if(request.holdSemantics!=='color')return this.strict.analyze(request,options);
  if(options.colorCache!==undefined)this.setColorCache(options.colorCache);
  let ctx,result;
  try{
   ctx=context(options);const req=normalize(this.model,request),key=JSON.stringify(req);
   if(this.results.has(key)){const entry=this.results.get(key);this.results.delete(key);this.results.set(key,entry);return {...cloneResult(entry.value),cacheHit:true};}
   const bytes=Math.ceil(this.model.degree*this.model.degree/8)*3+this.model.degree*25;
   ctx.stats.storageEstimateBytes=bytes;if(bytes>ctx.config.maxStorageBytes)throw new ColorEligibilityLimit('storage_limit');
   result=initResult(this.model.degree,req);
   if(req.candidateNodes.length<2)return finalize(result,ctx);
   // Prioritize concrete executable witnesses. Reachability proofs below do
   // not carry move words and therefore cannot make a selection ready.
   ctx.check();this.macroWitnesses(result,ctx);
   ctx.check();
   const unrestricted=this.strict.analyze({protected:[],occupiedNodes:req.occupiedNodes,protection:'endpoint'},ctx.options(req.protectedNodes.length?750:Infinity));
   if(unrestricted.status==='invalid')return unrestricted;
   ctx.stats.operations+=unrestricted.cacheHit?0:(unrestricted.stats?.operations??0);
   ctx.stats.globalStatus=unrestricted.status;
   for(const a of req.candidateNodes)for(const b of req.candidateNodes){
    if(a===b)continue;const s=eligibilityStatus(unrestricted,a,b);
    if(s===2){mark(result,a,b,false);ctx.stats.globalExcludedPairs++;}
    else if(s===1&&!req.protectedNodes.length)mark(result,a,b,true);
   }
   if(!req.protectedNodes.length)return this.finish(result,ctx,key,unrestricted.reason);
   // This is a conservative fallback, not an impossibility oracle for colors.
   // With unique held colors, strict negatives could also be reused, but no
   // such extra inference is necessary for this sound bounded implementation.
   ctx.check();
   const strict=this.strict.analyze({protected:req.protectedNodes,occupiedNodes:req.occupiedNodes,protection:req.protection},ctx.options());
   if(strict.status==='invalid')return strict;
   ctx.stats.operations+=strict.cacheHit?0:(strict.stats?.operations??0);ctx.stats.strictStatus=strict.status;
   for(const a of req.candidateNodes)for(const b of req.candidateNodes)if(a!==b&&eligibilityStatus(strict,a,b)===1){if(eligibilityStatus(result,a,b)!==1)ctx.stats.strictWitnessPairs++;mark(result,a,b,true);}
   return this.finish(result,ctx,key,strict.reason);
  }catch(error){
   if(error instanceof ColorEligibilityLimit&&result)return finalize(result,ctx,error.message);
   return {status:error instanceof ColorEligibilityLimit?'unknown':'invalid',reason:error.message,stats:ctx?{...ctx.stats,elapsedMs:performance.now()-ctx.started}:undefined};
  }
 }
 finish(result,ctx,key,reason){
  const final=finalize(result,ctx,reason);
  // Never cache a partial proof or a result whose executable witnesses were
  // dropped for storage: a retry with a larger budget must discover them.
  if(final.status==='complete'&&!final.stats.readyStorageLimited){
   const bytes=final.knownPairs.byteLength+final.feasiblePairs.byteLength+final.firstStatus.byteLength+final.readyPairs.byteLength+final.readyFirstStatus.byteLength+final.stats.readyWitnessBytes+key.length*2+this.model.degree*24+1024;
   if(bytes<=this.maxBytes){while(this.bytes+bytes>this.maxBytes&&this.results.size){const first=this.results.keys().next().value;this.bytes-=this.results.get(first).bytes;this.results.delete(first);}this.results.set(key,{value:cloneResult(final),bytes});this.bytes+=bytes;}
  }
  return final;
 }
 macroWitnesses(result,ctx){
  const d=this.model.degree,held=new Set(result.protectedNodes),candidates=new Set(result.candidateNodes),colors=result.colorByNode;
  const primitive=this.compiled.moves.map(move=>({word:[move.index],support:Array.from(move.perm).flatMap((dst,src)=>src===dst?[]:[src,dst]),trusted:true}));
  const cache=this.colorCache;
  let operations=[];
  if(cache){
   if(cache.schemaVersion===1&&cache.kind==='color-macros'&&cache.degree===d&&cache.modelSignature===this.signature&&Array.isArray(cache.operations))operations=cache.operations;
   else ctx.stats.colorCacheError='color_macro_cache_mismatch';
  }
  for(const op of [...primitive,...operations]){
   ctx.check();ctx.stats.macroTests++;
   if(!op||!Array.isArray(op.word)||!op.word.length||op.word.length>5000||!Array.isArray(op.support)||op.support.length%2||op.support.length>d*2){ctx.stats.invalidMacros++;continue;}
   const mapping=new Map(),destinations=new Set();let valid=true,preserves=true;
   for(let i=0;i<op.support.length;i+=2){
    ctx.tick();const a=op.support[i],b=op.support[i+1];
    if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||a>=d||b<0||b>=d||a===b||mapping.has(a)||destinations.has(b)){valid=false;break;}
    mapping.set(a,b);destinations.add(b);if(held.has(b)&&colors[a]!==colors[b])preserves=false;
   }
   if(!valid||mapping.size!==destinations.size||[...mapping.keys()].some(x=>!destinations.has(x))){ctx.stats.invalidMacros++;continue;}
   if(!preserves)continue;
   const pairs=[];
   for(const [a,b]of mapping)if(a<b&&mapping.get(b)===a&&candidates.has(a)&&candidates.has(b)&&!eligibilityReady(result,a,b))pairs.push([a,b]);
   if(!pairs.length)continue;
   const memo=this.verifiedOperations.get(op);
   let verified=op.trusted===true&&primitive.includes(op)?true:
    memo&&memo.word.length===op.word.length&&memo.support.length===op.support.length&&memo.word.every((x,i)=>x===op.word[i])&&memo.support.every((x,i)=>x===op.support[i])?memo.valid:undefined;
   if(verified===undefined){
    ctx.stats.macroVerifications++;let p=identity(d);
    for(const move of op.word){ctx.tick(d);if(!Number.isInteger(move)||move<0||move>=this.compiled.moves.length){valid=false;break;}p=compose(p,this.compiled.moves[move].perm);}
    verified=valid&&p.every((dst,src)=>dst===(mapping.get(src)??src));this.verifiedOperations.set(op,{valid:verified,word:op.word.slice(),support:op.support.slice()});
   }
   if(!verified){ctx.stats.invalidMacros++;continue;}
   if(result.protection==='throughout'){
    let current=colors.slice();
    for(const move of op.word){ctx.tick(d);const next=new Array(d),perm=this.compiled.moves[move].perm;for(let x=0;x<d;x++)next[perm[x]]=current[x];current=next;if(result.protectedNodes.some(x=>current[x]!==colors[x])){preserves=false;break;}}
    if(!preserves)continue;
   }
   for(const [a,b]of pairs){mark(result,a,b,true);mark(result,b,a,true);ctx.stats.macroWitnessPairs+=2;}
   retainWitness(result,op.word,pairs,ctx);
  }
 }
}
function colorEligibleSwaps(model,request,options={}){try{return new ColorEligibilityAnalyzer(model,options.cache,{cacheBytes:0,colorCache:options.colorCache}).analyze(request,options);}catch(error){return {status:'invalid',reason:error.message};}}
module.exports={ColorEligibilityAnalyzer,colorEligibleSwaps,eligibilityStatus,eligibilityReady,eligibilityWitness};
