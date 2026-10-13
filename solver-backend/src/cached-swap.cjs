'use strict';

// Construct a pointwise-held pair exchange from the existing complete cache.
// The cache already certifies the group. Changing its base needs only adjacent
// swaps, not a fresh Schreier-Sims closure. Words are retained as a bounded DAG
// and expanded only once a transporter of (A,B) to (B,A) has been found.
const {compileModel,makeContext,Words,inverse,Limit}=require('./group.cjs');
const {prepareChain,stabilizer,eligibilityContext,EligibilityLimit}=require('./eligibility.cjs');
const {normalize,verify,permutation}=require('./index.cjs');

function restoreWords(compiled,cache,ctx){
 const words=new Words(compiled.moves,ctx);
 if(!cache)return words;
 if(!Array.isArray(cache.words)||cache.words[0]!==null)throw Error('Malformed cached word DAG');
 if(cache.words.length>ctx.config.maxDagNodes)throw new Limit('word_dag_limit');
 words.nodes=[null];words.leaves=[];
 for(let id=1;id<cache.words.length;id++){
  if((id&1023)===0)ctx.check();const row=cache.words[id];
  if(!Array.isArray(row)||(row.length!==1&&row.length!==2))throw Error('Malformed cached word DAG');
  if(row.length===1){const move=row[0];if(!Number.isInteger(move)||!compiled.moves[move])throw Error('Malformed cached move index');words.nodes.push({move,len:1});words.leaves[move]=id;}
  else {if(row.some(x=>!Number.isSafeInteger(x)||Math.abs(x)>=id))throw Error('Malformed cached word reference');words.nodes.push({a:row[0],b:row[1],len:Math.min(Number.MAX_SAFE_INTEGER,words.length(row[0])+words.length(row[1]))});}
 }
 // Serialization drops unreachable leaves. Restore them after all persisted
 // IDs so primitive words and cached representative IDs remain unambiguous.
 for(const move of compiled.moves)if(words.leaves[move.index]===undefined){words.leaves[move.index]=words.nodes.length;words.nodes.push({move:move.index,len:1});}
 return words;
}

// Dijkstra over the ordered-pair orbit (at most d(d-1) states), weighted by
// primitive-word lengths. This is not a search of full puzzle configurations.
// Weights estimate expansion cost; cancellations may shorten the final word.
function pairWord(generators,a,b,d,words,ctx,groupCtx){
 const actions=[];for(const g of generators){actions.push(g);actions.push({perm:inverse(g.perm),word:-g.word});}
 const start=a*d+b,target=b*d+a,records=new Map([[start,{distance:0,parent:-1,gen:-1}]]),heap=[[0,start]];
 function push(item){let i=heap.length;heap.push(item);while(i>0){const parent=(i-1)>>1;if(heap[parent][0]<=item[0])break;heap[i]=heap[parent];i=parent;}heap[i]=item;}
 function pop(){const root=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1][0]<heap[child][0])child++;if(heap[child][0]>=last[0])break;heap[i]=heap[child];i=child;}heap[i]=last;}return root;}
 while(heap.length){
  ctx.check();const [distance,state]=pop(),record=records.get(state);if(record.distance!==distance)continue;
  if(state===target){const parts=[];for(let at=target;at!==start;){const row=records.get(at);parts.push(actions[row.gen].word);at=row.parent;}parts.reverse();return words.list(parts);}
  const x=Math.floor(state/d),y=state%d;
  for(let i=0;i<actions.length;i++){
   ctx.tick();ctx.stats.pairTransitions++;const g=actions[i],next=g.perm[x]*d+g.perm[y];if(next===state)continue;
   const cost=Math.min(Number.MAX_SAFE_INTEGER,distance+words.length(g.word)),old=records.get(next);if(old&&old.distance<=cost)continue;
   if(!old&&records.size>=groupCtx.config.maxOrbitStates)throw new Limit('pair_orbit_limit');
   records.set(next,{distance:cost,parent:state,gen:i});push([cost,next]);ctx.stats.pairStates=records.size;
   if((ctx.stats.pairTransitions&255)===0)ctx.storage((ctx.baseStorage??0)+actions.length*(d*4+128)+words.nodes.length*80+records.size*160+heap.length*32);
  }
 }
 return null;
}

class CachedSwapSolver{
 constructor(model,cache=null){this.model=model;this.compiled=compileModel(model);this.cache=cache;this.prepared=null;}
 solve(request,options={}){
  const started=performance.now();let ctx,words,req;
  const result=(status,extra={})=>({status,optimal:false,...extra,stats:{...ctx?.stats,dagNodes:words?.nodes.length??0,elapsedMs:performance.now()-started}});
  try{
   req=normalize(this.model,request);ctx=eligibilityContext(options);ctx.stats.pairStates=0;
   const maxOutputMoves=options.maxOutputMoves??5000,maxDagNodes=options.maxDagNodes??300000,maxOrbitStates=options.maxOrbitStates??100000;
   for(const [name,value,max]of [['maxOutputMoves',maxOutputMoves,20000],['maxDagNodes',maxDagNodes,1000000],['maxOrbitStates',maxOrbitStates,250000]])if(!Number.isSafeInteger(value)||value<0||value>max)throw Error('Invalid cached-swap budget '+name);
   const groupCtx=makeContext({maxMs:options.maxMs??3000,maxOutputMoves,maxDagNodes,maxOrbitStates,maxStorageBytes:ctx.config.maxStorageBytes});
   const d=this.model.degree,usesCache=req.protection==='endpoint'&&req.protected.length>0;
   words=restoreWords(this.compiled,usesCache?this.cache:null,groupCtx);ctx.words=words;
   let generators=this.compiled.moves.map(g=>({perm:g.perm,word:words.leaves[g.index],level:0}));
   if(req.protection==='throughout')generators=generators.filter(g=>req.protected.every(x=>g.perm[x]===x));
   else if(usesCache){
    if(!this.prepared)this.prepared=prepareChain(this.model,this.cache,ctx);
    generators=stabilizer(this.prepared,req.protected,d,ctx);
   }
   ctx.check();const word=pairWord(generators,...req.swap,d,words,ctx,groupCtx);
   if(word===null){
    // This module constructs pointwise witnesses. A failure under the stricter
    // rule must never become an impossibility claim for a color-hold request.
    if(req.holdSemantics==='color'&&req.protected.length)return result('unknown',{reason:'color_hold_pointwise_fallback_impossible'});
    return result('impossible',{reason:'pair_outside_stabilizer_orbit',proof:'complete_cached_chain_and_pair_orbit'});
   }
   const moveIndices=words.flatten(word);ctx.check();
   if(!verify(this.model,req,moveIndices))return result('unknown',{reason:'internal_cached_witness_verification_failed'});ctx.check();
   const p=permutation(this.model,moveIndices),occupied=req.occupiedNodes?new Set(req.occupiedNodes):null,changedNodes=p.map((x,i)=>x!==i&&(!occupied||occupied.has(i))?i:-1).filter(x=>x>=0);
   return result('solved',{moveIndices,sequence:moveIndices.map(i=>this.model.moves[i].name),permutation:p,changedNodes,collateralNodes:changedNodes.filter(x=>!req.swap.includes(x)),protected:req.protected,swap:req.swap,mode:req.mode,protection:req.protection,...(occupied?{occupiedNodes:req.occupiedNodes}:{}),...(req.holdSemantics==='color'?{holdSemantics:'color'}:{}),verified:true,method:usesCache?'cached_stabilizer_pair_transporter':'ordered_pair_transporter'});
  }catch(error){if(error instanceof Limit||error instanceof EligibilityLimit)return result('unknown',{reason:error.message});return result('invalid',{reason:error.message});}
 }
}
function solveCachedSwap(model,request,options={}){try{return new CachedSwapSolver(model,options.cache).solve(request,options);}catch(error){return {status:'invalid',reason:error.message,optimal:false};}}
module.exports={solveCachedSwap,CachedSwapSolver};
