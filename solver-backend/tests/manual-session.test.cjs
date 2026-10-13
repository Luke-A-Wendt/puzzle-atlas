'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {ManualSwapSession,MANUAL_SEARCH_STAGES}=require('../src/manual-session.cjs');
const {CachedSwapSolver}=require('../src/cached-swap.cjs');
const {normalize,verify,applySequence,permutation}=require('../src/index.cjs');
const {modelSignature}=require('../src/full-solve.cjs');
const {enumerateGroup}=require('./oracle.cjs');
const {initialColors,findWitness}=require('../tools/verify-color-precompute.cjs');
const toy={degree:5,moves:[{name:'cycle',perm:[1,2,3,4,0]},{name:'swap',perm:[1,0,2,3,4]}]};
const query={swap:[2,4],protected:[0,1,3]};
const double={degree:4,moves:[{name:'double',perm:[1,0,3,2]}]};
const colorQuery={swap:[0,1],protected:[2],holdSemantics:'color',colorByNode:['red','blue','green','green']};

test('time slices retain every frontier record and next-move cursor without redoing transitions',()=>{
 let ticks=0;const session=new ManualSwapSession(toy,query,{constructive:false,_clock:()=>ticks++});
 let previousStates=0,previousTransitions=0,result,calls=0,sawMidRow=false;
 for(let budgetMs=19;budgetMs<5000;budgetMs+=19){
  const priorRecords=session.records.slice();
  result=session.advance({budgetMs});calls++;
  assert(result.search.states>=previousStates);assert(result.search.transitions>previousTransitions);
  priorRecords.forEach((record,i)=>assert.equal(session.records[i],record));
  if(session.moveCursor)sawMidRow=true;
  previousStates=result.search.states;previousTransitions=result.search.transitions;
  if(!result.search.canContinue)break;
 }
 assert(calls>2);assert(sawMidRow);assert.equal(result.status,'solved');assert.equal(result.optimal,true);assert.equal(result.search.resumed,true);
 const uninterrupted=new ManualSwapSession(toy,query,{constructive:false}).advance({budgetMs:3000});
 assert.deepEqual(result.moveIndices,uninterrupted.moveIndices);
 assert.equal(result.search.transitions,uninterrupted.search.transitions);
 assert.equal(result.search.states,uninterrupted.search.states);
 assert(verify(toy,normalize(toy,query),result.moveIndices));
});

test('user idle time is excluded, cumulative stages advance, and repeated budget performs no search',()=>{
 let ticks=0;const session=new ManualSwapSession(toy,query,{constructive:false,_clock:()=>ticks++});
 const first=session.advance({budgetMs:20});ticks+=1000000;
 const second=session.advance({budgetMs:40});
 assert(second.search.elapsedMs<100);assert(second.search.transitions>first.search.transitions);
 const same=session.advance({budgetMs:40});assert.equal(same.search.transitions,second.search.transitions);
 assert.deepEqual(MANUAL_SEARCH_STAGES,[3000,10000,30000,60000]);
 let t=0;const slow=new ManualSwapSession(toy,query,{constructive:false,_clock:()=>t+=250});
 for(const budgetMs of MANUAL_SEARCH_STAGES){const r=slow.advance({budgetMs});if(!r.search.canContinue)break;assert.equal(r.search.nextBudgetMs,MANUAL_SEARCH_STAGES.find(n=>n>budgetMs));}
});

test('resumed catalog scan does not recheck discarded operations and verifies its final word',()=>{
 const operations=Array.from({length:40},()=>({word:[0],support:[]}));operations.push({word:[0],support:[0,1,1,0,2,3,3,2]});
 const colorCache={schemaVersion:1,kind:'color-macros',degree:4,modelSignature:modelSignature(double),operations};
 let t=0;const s=new ManualSwapSession(double,colorQuery,{constructive:false,colorCache,_clock:()=>t++});
 let r,previous=0,calls=0;
 for(let budgetMs=20;budgetMs<1000;budgetMs+=20){r=s.advance({budgetMs});calls++;assert(r.stats.catalogOperations>=previous);previous=r.stats.catalogOperations;if(!r.search.canContinue)break;}
 assert(calls>1);assert.equal(r.status,'solved');assert.equal(r.stats.catalogOperations,41);assert.equal(r.verified,true);
 assert.equal(r.search.transitions,0);assert.deepEqual(r.moveIndices,[0]);
});

test('every strict and color-held optimum in a small noncommuting group matches the independent full-state oracle',()=>{
 const m={degree:4,moves:[{name:'cycle',perm:[1,2,3,0]},{name:'swap',perm:[1,0,2,3]}]},group=enumerateGroup(m.degree,m.moves.map(x=>x.perm)),colors=['r','r','b','b'];
 for(let a=0;a<4;a++)for(let b=a+1;b<4;b++)for(let mask=0;mask<16;mask++){
  const held=Array.from({length:4},(_,i)=>i).filter(i=>(mask&(1<<i))&&i!==a&&i!==b);
  for(const semantics of ['sticker','color']){
   const request=normalize(m,{swap:[a,b],protected:held,holdSemantics:semantics,colorByNode:colors});
   const expected=group.find(({word})=>verify(m,request,word));
   const actual=new ManualSwapSession(m,request,{constructive:false}).advance({budgetMs:3000});
   assert.equal(actual.status,expected?'solved':'impossible');
   if(expected){assert.equal(actual.moveIndices.length,expected.word.length);assert.equal(actual.optimal,true);assert(actual.verified);}
  }
 }
});

test('same-color substitution succeeds, distinct colors fail only after a complete orbit, and A/B stay physical',()=>{
 const relaxed=new ManualSwapSession(double,colorQuery,{constructive:false}).advance({budgetMs:3000});assert.equal(relaxed.status,'solved');assert.equal(relaxed.permutation[2],3);
 const strict=new ManualSwapSession(double,{swap:[0,1],protected:[2]},{constructive:false}).advance({budgetMs:3000});assert.equal(strict.status,'impossible');assert.equal(strict.proof,'complete_preimage_tuple_orbit');
 const distinct=new ManualSwapSession(double,{...colorQuery,colorByNode:['r','b','g','y']},{constructive:false}).advance({budgetMs:3000});assert.equal(distinct.status,'impossible');
 const identical=new ManualSwapSession(double,{...colorQuery,colorByNode:['r','r','g','g']},{constructive:false}).advance({budgetMs:3000});assert.deepEqual(identical.moveIndices,[0]);
});

test('storage, state, depth, output and one-minute limits stop honestly without an impossibility claim',()=>{
 for(const [options,reason]of [[{maxStorageBytes:0},'storage_limit'],[{maxSearchStates:1},'state_limit'],[{maxSearchDepth:0},'depth_limit'],[{maxOutputMoves:0},'output_limit']]){
  const s=new ManualSwapSession(toy,query,{constructive:false,...options}),r=s.advance({budgetMs:3000});
  assert.equal(r.status,'unknown');assert.equal(r.search.canContinue,false);assert.equal(r.search.terminalReason,reason);assert.equal(r.search.nextBudgetMs,null);
  const after=s.advance({budgetMs:60000});assert.equal(after.search.transitions,r.search.transitions);assert.equal(after.reason,r.reason);
 }
 let t=0;const s=new ManualSwapSession(toy,query,{constructive:false,_clock:()=>t+=10000});
 const r=s.advance({budgetMs:60000});assert.equal(r.status,'unknown');assert.equal(r.search.terminalReason,'time_limit');assert.equal(r.search.canContinue,false);
});

test('constructive fallback retries only timeouts with increasing allowance and retains a stopped BFS',()=>{
 const original=CachedSwapSolver.prototype.solve,calls=[];
 try{
  CachedSwapSolver.prototype.solve=function(request,options){calls.push(options.maxMs);return calls.length<3?{status:'unknown',reason:'time_limit'}:{status:'solved',moveIndices:[0]};};
  const s=new ManualSwapSession(double,{swap:[0,1]},{maxSearchStates:0});
  const first=s.advance({budgetMs:3000});assert.equal(first.status,'unknown');assert(first.search.canContinue);
  const second=s.advance({budgetMs:10000});assert(second.search.canContinue);assert.equal(second.stats.cachedAttempts,2);
  const third=s.advance({budgetMs:30000});assert.equal(third.status,'solved');assert.equal(third.verified,true);assert.equal(third.search.transitions,0);
  assert.deepEqual(calls,[800,2500,8000]);
  calls.length=0;CachedSwapSolver.prototype.solve=function(){calls.push(1);return {status:'unknown',reason:'word_expansion_limit'};};
  const terminal=new ManualSwapSession(double,{swap:[0,1]},{maxSearchStates:0});
  assert.equal(terminal.advance({budgetMs:3000}).search.canContinue,false);terminal.advance({budgetMs:10000});assert.equal(calls.length,1);
 }finally{CachedSwapSolver.prototype.solve=original;}
});

test('released constructive workspace resumes a held transition without checking it twice',()=>{
 const original=CachedSwapSolver.prototype.solve;
 try{
  CachedSwapSolver.prototype.solve=()=>({status:'unknown',reason:'word_expansion_limit'});
  const limited=new ManualSwapSession(toy,query,{maxStorageBytes:8000,fullCache:{}});
  const r=limited.advance({budgetMs:3000});
  const plain=new ManualSwapSession(toy,query,{constructive:false,maxStorageBytes:8000}).advance({budgetMs:3000});
  assert.equal(limited.cachedAttempts,1);assert.equal(r.status,plain.status);
  assert.equal(r.search.transitions,plain.search.transitions,'pending transition is not recomputed after reservation release');
  assert.equal(r.search.states,plain.search.states,'released reservation makes the rest of the buffer available');
 }finally{CachedSwapSolver.prototype.solve=original;}
});

test('the last stage gives a still-timing-out constructive route the remaining minute when BFS is capped',()=>{
 const original=CachedSwapSolver.prototype.solve,calls=[];
 try{
  CachedSwapSolver.prototype.solve=function(request,options){calls.push(options.maxMs);return {status:'unknown',reason:'time_limit'};};
  const session=new ManualSwapSession(double,{swap:[0,1]},{maxSearchStates:0});
  const first=session.advance({budgetMs:3000});assert(first.search.canContinue);
  const last=session.advance({budgetMs:60000});assert.equal(last.search.canContinue,false);assert.equal(last.status,'unknown');
  assert(calls[1]>50000,'last route receives useful remaining cumulative time');
 }finally{CachedSwapSolver.prototype.solve=original;}
});

test('a strict cached impossibility is not a color-hold impossibility',()=>{
 const original=CachedSwapSolver.prototype.solve;
 try{
  CachedSwapSolver.prototype.solve=()=>({status:'impossible',reason:'pair_outside_stabilizer_orbit'});
  let t=0;const r=new ManualSwapSession(double,colorQuery,{fullCache:{},_clock:()=>t+=100}).advance({budgetMs:10000});
  assert.equal(r.status,'solved');assert.equal(r.method,'resumable_preimage_tuple_bfs');assert(r.verified);
 }finally{CachedSwapSolver.prototype.solve=original;}
});

test('throughout protection, pose occupancy and invalid requests retain their exact semantics',()=>{
 const throughout=new ManualSwapSession(double,{swap:[0,1],protected:[2],protection:'throughout'}).advance({budgetMs:3000});assert.equal(throughout.status,'impossible');
 const pose={...double,requiresOccupiedState:true,stickerCount:3};
 const req={swap:[0,1],protected:[],holdSemantics:'color',colorByNode:['r','b','g',null],occupiedNodes:[0,1,2]};
 assert.equal(new ManualSwapSession(pose,req,{constructive:false}).advance({budgetMs:3000}).status,'solved');
 const held=new ManualSwapSession(pose,{...req,protected:[2]},{constructive:false}).advance({budgetMs:3000});assert.equal(held.status,'impossible');
 const invalid=new ManualSwapSession(pose,{...req,colorByNode:['r','b',null,'g']}).advance({budgetMs:3000});assert.equal(invalid.status,'invalid');assert.equal(invalid.search.canContinue,false);
});

test('progress reports are monotonic and callback errors do not corrupt the search',()=>{
 let t=0;const seen=[];
 const s=new ManualSwapSession(toy,query,{constructive:false,_clock:()=>t+=10});
 const r=s.advance({budgetMs:10000,onProgress:p=>{seen.push(p);throw Error('UI callback error');}});
 assert.equal(r.status,'solved');assert(seen.length>2);
 seen.forEach((p,i)=>{if(i){assert(p.transitions>=seen[i-1].transitions);assert(p.elapsedMs>=seen[i-1].elapsedMs);}});
});

test('verified session witnesses execute for all 34 production puzzles with color holds',t=>{
 const manifest=require('../data/manifest.json');let puzzles=0,totalMoves=0;
 for(const {id}of manifest.models){
  const model=require('../data/'+id+'.json'),colorCache=require('../data/color-solver/'+id+'.json');
  let colors=initialColors(model),example=findWitness(model,colorCache,colors),seed=123456789;
  for(const steps of [12,28]){
   if(example)break;
   const scramble=[];for(let i=0;i<steps;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;scramble.push(seed%model.moves.length);}
   colors=applySequence(model,colors,scramble);example=findWitness(model,colorCache,colors);
  }
  assert(example,id+' has a production witness');
  const session=new ManualSwapSession(model,example.request,{colorCache});
  const result=session.advance({budgetMs:3000});
  assert.equal(result.status,'solved',id+': '+result.reason);assert(result.verified);assert.equal(result.search.canContinue,false);
  assert(verify(model,normalize(model,example.request),result.moveIndices));
  assert.deepEqual(permutation(model,result.moveIndices),result.permutation);totalMoves+=result.moveIndices.length;puzzles++;
 }
 assert.equal(puzzles,34);t.diagnostic(`${puzzles} production models; ${totalMoves} witness moves replayed with endpoint color holds`);
});
