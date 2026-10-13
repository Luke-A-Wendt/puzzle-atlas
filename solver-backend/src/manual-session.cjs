'use strict';

// One live manual request. Unlike solveSync, this object keeps its projected
// search frontier between calls. No completed BFS transition is repeated.
// Permutations map source -> destination; the tuple is g^-1(H,A,B). Applying
// an inverse generator to the tuple PREPENDS its forward move to the word.
const {normalize,verify,permutation,validateOptions}=require('./index.cjs');
const {modelSignature}=require('./full-solve.cjs');
const {CachedSwapSolver}=require('./cached-swap.cjs');
const STAGES=[3000,10000,30000,60000],MAX_MS=60000;

class ManualSwapSession {
 constructor(model,request,options={}){
  this.clock=typeof options._clock==='function'?options._clock:()=>performance.now();
  this.model=model;this.options=options;this.elapsedMs=0;this.budgetMs=0;this.advances=0;
  this.records=[];this.seen=new Set();this.head=0;this.moveCursor=0;this.transitions=0;
  this.completedRadius=0;this.catalogIndex=0;this.catalogOperations=0;this.catalogBest=null;
  this.cachedAttempts=0;this.cachedLastBudget=0;this.cachedReason=null;this.cachedRetry=false;
  this.initialized=false;this.catalogDone=false;this.bfsStopped=null;this.result=null;
  const started=this.clock();
  try{
   validateOptions(options);this.request=normalize(model,request);
   this.maxBytes=options.maxStorageBytes??48*1024*1024;
   this.maxStates=options.maxSearchStates??100000;
   this.maxOutputMoves=options.maxOutputMoves??5000;
   this.maxDepth=Math.min(options.maxSearchDepth??this.maxOutputMoves,this.maxOutputMoves);
   this.width=this.request.protected.length+2;this.bytesPerState=256+40*this.width;
   // Includes one temporary/pending frontier row, so a transition can pause
   // at a workspace reservation without recomputing it or overshooting memory.
   this.inverseBytes=model.moves.length*model.degree*2+model.degree*16+this.width*32+this.bytesPerState;
   this.cachedPossible=options.constructive!==false&&(options.fullCache||!this.request.protected.length||this.request.protection==='throughout');
   this.catalog=options.colorCache;
  }catch(error){this.result={status:'invalid',reason:error.message,optimal:false};}
  this.elapsedMs=Math.max(0,this.clock()-started);
 }
 _retainedCacheBytes(){
  const p=this.cachedSolver?.prepared;
  return p?(p.cacheStorage+p.generators.length*(this.model.degree*4+128)):0;
 }
 _bytes(){return (this.inverseBytes??0)+this.records.length*(this.bytesPerState??0);}
 _stats(){return {method:'resumable_preimage_tuple_bfs',searchStates:this.records.length,transitions:this.transitions,completedRadius:this.completedRadius,bytesPerState:this.bytesPerState,estimatedBytes:this._bytes()+this._retainedCacheBytes(),catalogOperations:this.catalogOperations,cachedAttempts:this.cachedAttempts,cachedReason:this.cachedReason};}
 _metadata(resumed,terminalReason){
  const canContinue=!this.result&&this.budgetMs<MAX_MS&&(!this.bfsStopped||!this.catalogDone||this.cachedPossible&&(!this.cachedAttempts||this.cachedRetry));
  return {budgetMs:this.budgetMs,elapsedMs:this.elapsedMs,states:this.records.length,transitions:this.transitions,completedRadius:this.completedRadius,canContinue,nextBudgetMs:canContinue?(STAGES.find(n=>n>this.budgetMs)??MAX_MS):null,resumed,...(terminalReason?{terminalReason}:{})};
 }
 _finish(result){
  if(result.status!=='solved'){this.result={optimal:false,...result};return;}
  const word=result.moveIndices;
  if(!Array.isArray(word)||word.length>this.maxOutputMoves||!verify(this.model,this.request,word)){
   this.result={status:'unknown',reason:'internal_witness_verification_failed',optimal:false};return;
  }
  const req=this.request,p=permutation(this.model,word),occupied=req.occupiedNodes?new Set(req.occupiedNodes):null;
  const allChanged=p.flatMap((to,from)=>to===from?[]:[from]),changed=occupied?allChanged.filter(x=>occupied.has(x)):allChanged;
  this.result={...result,moveIndices:word.slice(),optimal:result.optimal===true,sequence:word.map(i=>this.model.moves[i].name),permutation:p,changedNodes:changed,collateralNodes:changed.filter(x=>!req.swap.includes(x)),protected:req.protected,swap:req.swap,mode:req.mode,protection:req.protection,...(occupied?{occupiedNodes:req.occupiedNodes,allChangedPoseAddresses:allChanged}:{}),...(req.holdSemantics==='color'?{holdSemantics:'color'}:{}),verified:true};
 }
 _initialize(){
  this.initialized=true;
  const req=this.request,d=this.model.degree;
  this.moveMap=this.model.moves.map((_,i)=>i).filter(i=>req.protection!=='throughout'||req.protected.every(x=>this.model.moves[i].perm[x]===x));
  if(!this.moveMap.length){this.catalogDone=true;this._finish({status:'impossible',reason:'no_move_preserves_protected_nodes_at_each_step',proof:'no_allowed_generators'});return;}
  this.inverses=this.inverseBytes<=this.maxBytes?this.moveMap.map(i=>{const inverse=new Uint16Array(d);this.model.moves[i].perm.forEach((to,from)=>inverse[to]=from);return inverse;}):[];
  this.initial=Uint16Array.from([...req.protected,...req.swap]);
  this.targetColors=req.holdSemantics==='color'?req.protected.map(h=>req.colorByNode[h]):null;
  if(this.maxStates<1||this._bytes()+this.bytesPerState>this.maxBytes){this.bfsStopped=this.maxStates<1?'state_limit':'storage_limit';}
  else {this.records.push({tuple:this.initial,parent:-1,move:-1,depth:0});this.seen.add(this.initial.join(','));}
  const c=this.catalog;
  if(!c||c.kind!=='color-macros'||c.schemaVersion!==1||c.degree!==d||c.modelSignature!==modelSignature(this.model)||!Array.isArray(c.operations))this.catalogDone=true;
 }
 _catalogStep(){
  const req=this.request,c=this.catalog;
  if(this.catalogIndex>=c.operations.length){this.catalogDone=true;return;}
  const op=c.operations[this.catalogIndex++];this.catalogOperations++;
  if(!op||!Array.isArray(op.word)||!op.word.length||op.word.length>this.maxOutputMoves||this.catalogBest&&op.word.length>=this.catalogBest.length||!Array.isArray(op.support)||op.support.length%2)return;
  const [a,b]=req.swap,held=new Set(req.protected);let pa=a,pb=b,matches=true;
  for(let i=0;i<op.support.length;i+=2){
   const source=op.support[i],dest=op.support[i+1];
   if(source===a)pa=dest;if(source===b)pb=dest;
   if(req.holdSemantics==='color'?held.has(dest)&&req.colorByNode[source]!==req.colorByNode[dest]:held.has(source)&&source!==dest){matches=false;break;}
  }
  if(matches&&pa===b&&pb===a&&verify(this.model,req,op.word)){
   this.catalogBest=op.word.slice();if(op.word.length===1)this.catalogDone=true;
  }
 }
 _goal(tuple){
  const req=this.request,h=req.protected.length;
  if(tuple[h]!==req.swap[1]||tuple[h+1]!==req.swap[0])return false;
  for(let i=0;i<h;i++)if(this.targetColors?req.colorByNode[tuple[i]]!==this.targetColors[i]:tuple[i]!==req.protected[i])return false;
  return true;
 }
 _bfsStep(){
  if(this.head>=this.records.length){
   if(this.truncatedDepth){this.bfsStopped=this.maxDepth<this.maxOutputMoves?'depth_limit':'output_limit';return;}
   this.bfsStopped='exhausted';this._finish({status:'impossible',reason:'exhausted_preimage_tuple_orbit',proof:'complete_preimage_tuple_orbit'});return;
  }
  const row=this.records[this.head];this.completedRadius=row.depth;
  if(row.depth>=this.maxDepth){this.truncatedDepth=true;this.head++;this.moveCursor=0;return;}
  const localMove=this.moveCursor,inverse=this.inverses[localMove];
  const tuple=Uint16Array.from(row.tuple,x=>inverse[x]),key=tuple.join(',');
  this.transitions++;
  if(!this.seen.has(key)){
   if(this._goal(tuple)){
    const word=[this.moveMap[localMove]];
    for(let at=this.head;this.records[at].parent!==-1;at=this.records[at].parent)word.push(this.records[at].move);
    this._finish({status:'solved',moveIndices:word,optimal:true,lowerBound:word.length,method:'resumable_preimage_tuple_bfs'});return;
   }
   // Conservative JS object/string accounting keeps retained frontiers bounded.
   // Reserve room for a retried cached constructive attempt when it timed out.
   const pendingConstructive=this.cachedPossible&&(!this.cachedAttempts||this.cachedRetry);
   const reserve=Math.max(this._retainedCacheBytes(),pendingConstructive?Math.floor(this.maxBytes/2):0);
   if(this.records.length>=this.maxStates){this.bfsStopped='state_limit';return;}
   if(this._bytes()+this.bytesPerState+reserve>this.maxBytes){
    this.pendingState={tuple,parent:this.head,move:this.moveMap[localMove],depth:row.depth+1,key};
    this.bfsStopped='storage_limit';return;
   }
   this.seen.add(key);this.records.push({tuple,parent:this.head,move:this.moveMap[localMove],depth:row.depth+1});
  }
  if(++this.moveCursor===this.inverses.length){this.moveCursor=0;this.head++;}
 }
 _resumeReleasedStorage(){
  if(this.bfsStopped!=='storage_limit'||!this.pendingState||this.cachedRetry||this.result)return;
  if(this._bytes()+this.bytesPerState+this._retainedCacheBytes()>this.maxBytes)return;
  const {key,...record}=this.pendingState;
  this.seen.add(key);this.records.push(record);this.pendingState=null;this.bfsStopped=null;
  if(++this.moveCursor===this.inverses.length){this.moveCursor=0;this.head++;}
 }
 _cachedAttempt(availableMs){
  const stage=STAGES.findIndex(n=>n>=this.budgetMs),allowances=[800,2500,8000,16000];
  // If the final click has only the constructive route left, spend the
  // remaining cumulative allowance on it instead of leaving useful time idle.
  const allowance=this.budgetMs===MAX_MS&&this.bfsStopped?availableMs:allowances[stage<0?3:stage];
  const maxMs=Math.min(Math.floor(availableMs),allowance);
  if(maxMs<1)return;
  this.cachedLastBudget=this.budgetMs;this.cachedAttempts++;
  try{
   this.cachedSolver??=new CachedSwapSolver(this.model,this.options.fullCache);
   const r=this.cachedSolver.solve({...this.request,holdSemantics:'sticker'},{...this.options,maxMs,maxStorageBytes:Math.max(0,this.maxBytes-this._bytes()),maxOutputMoves:this.maxOutputMoves});
   this.cachedReason=r.reason??r.status;this.cachedRetry=r.status==='unknown'&&r.reason==='time_limit';
   if(r.status==='solved')this._finish({...r,optimal:false,method:'manual_cached_stabilizer_transporter'});
   else if(r.status==='impossible'&&!(this.request.holdSemantics==='color'&&this.request.protected.length))this._finish(r);
  }catch(error){this.cachedReason='cached_backend_error';this.cachedRetry=false;}
 }
 advance({budgetMs=STAGES[0],onProgress}={}){
  if(!Number.isSafeInteger(budgetMs)||budgetMs<1||budgetMs>MAX_MS)throw Error('budgetMs must be an integer from 1 to 60000');
  const resumed=this.advances++>0;this.budgetMs=Math.max(this.budgetMs,budgetMs);
  const started=this.clock(),before=this.elapsedMs;let lastProgress=started;
  const used=()=>before+Math.max(0,this.clock()-started);
  const remaining=()=>Math.max(0,this.budgetMs-used());
  const progress=force=>{
   const now=this.clock();if(typeof onProgress==='function'&&(force||now-lastProgress>=250)){
    lastProgress=now;const saved=this.elapsedMs;this.elapsedMs=before+Math.max(0,now-started);
    try{onProgress(this._metadata(resumed));}catch(_){}this.elapsedMs=saved;
   }
  };
  try{
   if(!this.result&&remaining()>0){
    if(!this.initialized)this._initialize();
    progress(true);
    while(!this.result&&!this.catalogDone&&remaining()>0){this._catalogStep();progress(false);}
    if(!this.result&&this.catalogDone&&this.catalogBest)this._finish({status:'solved',moveIndices:this.catalogBest,optimal:this.catalogBest.length===1,lowerBound:1,method:'manual_short_catalog'});
    // Try short primitive solutions before expanding a potentially long cache
    // word. This probe uses exactly the same persistent frontier as later work.
    if(!this.result&&this.catalogDone&&this.cachedPossible&&!this.cachedAttempts&&!this.bfsStopped&&remaining()>0){
     const probeDeadline=this.clock()+Math.min(150,remaining()/4);
     while(!this.result&&!this.bfsStopped&&this.clock()<probeDeadline&&remaining()>0){this._bfsStep();progress(false);}
    }
    if(!this.result&&this.catalogDone&&this.cachedPossible&&(!this.cachedAttempts||this.cachedRetry)&&this.budgetMs>this.cachedLastBudget&&remaining()>0){
     this._cachedAttempt(remaining());this._resumeReleasedStorage();progress(true);
    }
    while(!this.result&&this.catalogDone&&!this.bfsStopped&&remaining()>0){this._bfsStep();progress(false);}
   }
  }catch(error){this._finish({status:'unknown',reason:'manual_session_error',detail:error.message});}
  finally {this.elapsedMs=before+Math.max(0,this.clock()-started);}
  let terminalReason;
  if(this.result)terminalReason=this.result.status==='solved'?'solved':this.result.status==='impossible'?'exhausted':this.result.reason;
  else if(this.budgetMs>=MAX_MS){terminalReason=this.bfsStopped??'time_limit';this._finish({status:'unknown',reason:terminalReason});}
  else if(this.bfsStopped&&this.catalogDone&&!(this.cachedPossible&&(!this.cachedAttempts||this.cachedRetry))){terminalReason=this.bfsStopped;this._finish({status:'unknown',reason:terminalReason});}
  const metadata=this._metadata(resumed,terminalReason);
  return {...(this.result??{status:'unknown',reason:'manual_search_paused',optimal:false}),lowerBound:this.result?.lowerBound??this.completedRadius+1,stats:{...this.result?.stats,...this._stats(),totalMs:this.elapsedMs},search:metadata};
 }
}

module.exports={ManualSwapSession,MANUAL_SEARCH_STAGES:STAGES};
