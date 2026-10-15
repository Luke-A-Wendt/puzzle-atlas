'use strict';

// Endpoint color holds. The selected A and B stickers still exchange addresses.
// All permutations map source -> destination. A failed bounded attempt is not
// an impossibility certificate: color transporters are not point stabilizers.
const {modelSignature}=require('./full-solve.cjs');
const {search}=require('./search.cjs');
const {pairOperations}=require('./macro-index.cjs');

function verifyColorWitness(model,request,word){
 const d=model.degree,p=Array.from({length:d},(_,i)=>i);
 for(const index of word){const move=model.moves[index];if(!Number.isInteger(index)||!move)return false;for(let i=0;i<d;i++)p[i]=move.perm[p[i]];}
 const [a,b]=request.swap;if(p[a]!==b||p[b]!==a)return false;
 const held=new Set(request.protected),colors=request.colorByNode;
 for(let source=0;source<d;source++)if(held.has(p[source])&&colors[source]!==colors[p[source]])return false;
 return true;
}

// A compact precomputed catalog is a supply of legal witnesses, not a complete
// reachability table. Sparse support contains [source,destination,...] pairs.
function catalogWitness(model,request,cache,{deadline,maxOutputMoves=5000}={}){
 const started=performance.now(),stats={catalogOperations:0,catalogMs:0};
 const done=value=>({...value,stats:{...stats,catalogMs:performance.now()-started}});
 if(!cache||cache.kind!=='color-macros'||cache.schemaVersion!==1||cache.degree!==model.degree||cache.modelSignature!==modelSignature(model)||!Array.isArray(cache.operations))return done({status:'unknown',reason:'color_catalog_unavailable'});
 const [a,b]=request.swap,held=new Set(request.protected),colors=request.colorByNode;
 let best=null;
 // The first valid entry is the shortest catalog witness: pair lists are
 // sorted by move count. Failed words are not trusted merely by their support.
 for(const op of pairOperations(cache,a,b)){
  if((stats.catalogOperations++&63)===0&&performance.now()>=deadline)break;
  if(!op||!Array.isArray(op.word)||!op.word.length||op.word.length>maxOutputMoves||best&&op.word.length>=best.length||!Array.isArray(op.support)||op.support.length%2)continue;
  let pa=a,pb=b,colorsMatch=true;
  for(let i=0;i<op.support.length;i+=2){const source=op.support[i],dest=op.support[i+1];if(source===a)pa=dest;if(source===b)pb=dest;if(held.has(dest)&&colors[source]!==colors[dest]){colorsMatch=false;break;}}
  if(colorsMatch&&pa===b&&pb===a&&verifyColorWitness(model,request,op.word)){best=op.word.slice();break;}
 }
 return done(best?{status:'solved',moveIndices:best,optimal:best.length===1,lowerBound:1,method:'color_hold_short_catalog'}:{status:'unknown',reason:'no_catalog_color_witness'});
}

// Exact bounded search of an ordered tuple, never the full configuration.
// The tuple stores g^-1(h) for each held location and g^-1(A),g^-1(B).
// Updating with P_j^-1 prepends legal move j to the chronological word; hence
// parent pointers read from the leaf to the root already give the forward word.
// Goal: c(g^-1(h))=c(h), g^-1(A)=B, g^-1(B)=A.
function searchColors(model,request,options={}){
 const started=performance.now(),deadline=started+(options.maxMs??300),d=model.degree;
 const held=request.protected,colors=request.colorByNode,[a,b]=request.swap,initial=[...held,a,b],targetColors=held.map(h=>colors[h]);
 const maxDepth=options.maxDepth??12,maxBytes=options.maxBytes??16*1024*1024,bytesPerState=256+40*initial.length;
 const stateLimit=Math.min(options.maxStates??25000,Math.floor(maxBytes/bytesPerState)),maxOutputMoves=options.maxOutputMoves??5000;
 let transitions=0,completedRadius=0;
 const records=[{tuple:initial,parent:-1,move:-1,depth:0}],seen=new Set([initial.join(',')]);
 const stats=()=>({method:'color-preimage-tuple-bfs',searchStates:records.length,transitions,searchMs:performance.now()-started,completedRadius,bytesPerState,stateLimit,estimatedBytes:records.length*bytesPerState});
 const unknown=reason=>({status:'unknown',reason,optimal:false,lowerBound:completedRadius+1,stats:stats()});
 if(stateLimit<1)return unknown('color_search_storage_limit');
 const inverses=model.moves.map(move=>{const p=new Uint32Array(d);move.perm.forEach((dest,source)=>p[dest]=source);return p;});
 const goal=tuple=>tuple[held.length]===b&&tuple[held.length+1]===a&&targetColors.every((color,i)=>colors[tuple[i]]===color);
 for(let head=0;head<records.length;head++){
  const row=records[head];
  // Reaching a new parent depth means every target up to that depth was tested.
  completedRadius=row.depth;
  if(row.depth>=maxDepth||row.depth>=maxOutputMoves)return unknown('color_search_depth_limit');
  for(let move=0;move<inverses.length;move++){
   if((transitions++&127)===0&&performance.now()>=deadline)return unknown('color_search_time_limit');
   const inverse=inverses[move],tuple=row.tuple.map(x=>inverse[x]),key=tuple.join(',');if(seen.has(key))continue;
   if(goal(tuple)){
    const word=[move];for(let cursor=head;records[cursor].parent!==-1;cursor=records[cursor].parent)word.push(records[cursor].move);
    return {status:'solved',moveIndices:word,optimal:true,lowerBound:word.length,method:'color_preimage_tuple_bfs',stats:stats()};
   }
   if(records.length>=stateLimit)return unknown('color_search_state_limit');
   seen.add(key);records.push({tuple,parent:head,move,depth:row.depth+1});
  }
 }
 return {status:'impossible',reason:'exhausted_color_preimage_tuple_orbit',proof:'complete_color_preimage_tuple_orbit',optimal:false,stats:stats()};
}

function solveColors(model,request,options,strictSolve){
 const started=performance.now(),maxMs=options.maxMs??3000,deadline=started+maxMs,maxOutputMoves=options.maxOutputMoves??5000;
 const catalog=catalogWitness(model,request,options.colorCache,{deadline:Math.min(deadline,started+Math.min(100,maxMs/8)),maxOutputMoves});
 // One/two-turn catalog words need no expensive subgroup work. Longer words
 // supply an incumbent while a small projected search looks for a shorter one.
 if(catalog.status==='solved'&&catalog.moveIndices.length<=2)return catalog;
 const remaining=()=>Math.max(0,Math.floor(deadline-performance.now()));
 const incumbent=catalog.status==='solved'?catalog.moveIndices:null;
 const relaxedBudget=Math.min(options.searchMs??450,incumbent?150:450,Math.floor(maxMs/3),remaining());
 const relaxed=searchColors(model,request,{maxMs:relaxedBudget,maxStates:options.maxSearchStates??25000,maxDepth:Math.min(options.maxSearchDepth??12,incumbent?incumbent.length-1:Infinity),maxBytes:Math.min(16*1024*1024,options.maxStorageBytes??16*1024*1024),maxOutputMoves});
 const stats={catalog:catalog.stats,colorSearch:relaxed.stats};
 if(relaxed.status==='solved')return {...relaxed,stats};
 if(incumbent){
  // The older bidirectional tuple search can beat the broader unidirectional
  // search on some requests. Give it a small budget as a competing shortcut,
  // retaining the color witness unless it returns a strictly shorter word.
  if(remaining()<1)return {...catalog,lowerBound:relaxed.lowerBound,stats};
  const strictSearch=search(model,request.protected,request.swap,{maxMs:Math.min(50,remaining()),maxStates:options.maxSearchStates??25000,maxDepth:Math.min(options.maxSearchDepth??12,incumbent.length-1),maxBytes:Math.min(16*1024*1024,options.maxStorageBytes??16*1024*1024)});
  stats.pointwiseCompetitor=strictSearch.stats;
  if(strictSearch.status==='solved'&&strictSearch.moveIndices.length<incumbent.length)return {...strictSearch,method:'color_hold_pointwise_shortcut',optimal:strictSearch.moveIndices.length===relaxed.lowerBound,lowerBound:relaxed.lowerBound,stats};
  return {...catalog,lowerBound:relaxed.lowerBound,stats};
 }
 if(relaxed.status==='impossible')return {...relaxed,stats};
 if(remaining()<1)return {status:'unknown',reason:'color_request_time_limit',optimal:false,lowerBound:relaxed.lowerBound,stats};
 const strict=strictSolve(remaining());
 if(strict.status==='solved')return {...strict,optimal:strict.moveIndices.length===relaxed.lowerBound,lowerBound:relaxed.lowerBound,method:'color_hold_pointwise_fallback',stats:{...stats,pointwiseFallback:strict.stats}};
 // Complete pointwise infeasibility does not imply color-hold infeasibility.
 // The UI leaves this pair available and can explain the bounded attempt.
 return {status:'unknown',reason:strict.status==='impossible'?'color_hold_search_incomplete':'color_hold_budget_exhausted',optimal:false,lowerBound:relaxed.lowerBound,stats:{...stats,pointwiseFallback:strict.stats},strictStatus:strict.status,strictReason:strict.reason};
}

module.exports={catalogWitness,searchColors,solveColors,verifyColorWitness};
