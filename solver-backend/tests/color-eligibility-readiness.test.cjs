'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {ColorEligibilityAnalyzer,eligibilityStatus,eligibilityReady,eligibilityWitness}=require('../src/color-eligibility.cjs');
const {precomputeFull,modelSignature}=require('../src/full-solve.cjs');
const {verify,permutation,applySequence}=require('../src/index.cjs');
const {initialColors,findWitness}=require('../tools/verify-color-precompute.cjs');

const adjacent={degree:3,stickerCount:3,moves:[{name:'a',perm:[1,0,2]},{name:'b',perm:[0,2,1]}]};
function macros(model,words){return {schemaVersion:1,kind:'color-macros',degree:model.degree,modelSignature:modelSignature(model),operations:words.map(word=>({word,support:permutation(model,word).flatMap((dst,src)=>src===dst?[]:[src,dst])}))};}
function checkReady(model,result,request){
 const expected=new Uint8Array(Math.ceil(model.degree*model.degree/8)),first=new Uint8Array(model.degree);
 for(const entry of result.readyWitnesses){
  assert(entry.word.length>0&&entry.word.length<=5000);
  assert.equal(entry.pairs.length%2,0);
  for(let i=0;i<entry.pairs.length;i+=2){
   const a=entry.pairs[i],b=entry.pairs[i+1];
   assert.equal(verify(model,{...request,swap:[a,b]},entry.word),true,`${model.id??'fixture'} ready pair ${a},${b} fails execution verification`);
   for(const [x,y]of [[a,b],[b,a]]){const bit=x*model.degree+y;expected[bit>>>3]|=1<<(bit&7);}
   first[a]=first[b]=1;
  }
  if(entry.pairs.length){const [a,b]=entry.pairs;assert.equal(verify(model,{...request,swap:[a,b]},eligibilityWitness(result,a,b)),true);}
 }
 assert.deepEqual(result.readyPairs,expected,'every ready bit must have a retained verified sequence');
 assert.deepEqual(result.readyFirstStatus,first,'every selectable first node must have a retained partner');
 assert(result.stats.readyWitnessBytes<=2*1024*1024);
 assert(Buffer.byteLength(JSON.stringify(result.readyWitnesses))<=2*1024*1024);
 for(let a=0;a<model.degree;a++)assert.equal(eligibilityReady(result,a),first[a]===1);
}

test('mathematical reachability alone does not advertise an executable pair',()=>{
 const analyzer=new ColorEligibilityAnalyzer(adjacent,precomputeFull(adjacent));
 const request={holdSemantics:'color',protected:[],colorByNode:['r','g','b']};
 const result=analyzer.analyze(request);
 assert.equal(eligibilityStatus(result,0,2),1);
 assert.equal(eligibilityReady(result,0,2),false);
 assert.equal(eligibilityWitness(result,0,2),null);
 assert.equal(eligibilityReady(result,0,1),true,'no-hold request still retains primitive witnesses');
 assert.equal(eligibilityReady(result,1,0),true);
 assert.deepEqual(eligibilityWitness(result,1,0),[0]);
 checkReady(adjacent,result,request);
});

test('catalog words make new pairs ready and cached witness arrays cannot be corrupted by callers',()=>{
 const analyzer=new ColorEligibilityAnalyzer(adjacent,precomputeFull(adjacent),{colorCache:macros(adjacent,[[0,1,0]])});
 const request={holdSemantics:'color',protected:[],colorByNode:['r','g','b']};
 const result=analyzer.analyze(request);
 assert.deepEqual(eligibilityWitness(result,0,2),[0,1,0]);
 const copy=eligibilityWitness(result,0,2);copy.fill(99);
 assert.deepEqual(eligibilityWitness(result,0,2),[0,1,0]);
 result.readyPairs.fill(0);result.readyFirstStatus.fill(0);result.readyWitnesses[0].word.fill(99);result.readyWitnesses[0].pairs.fill(99);
 const again=analyzer.analyze(request);assert.equal(again.cacheHit,true);checkReady(adjacent,again,request);
 assert.deepEqual(eligibilityWitness(again,0,2),[0,1,0]);
});

test('executable readiness is recomputed for held colors and removed when holds block a witness',()=>{
 const model={degree:4,stickerCount:4,moves:[{name:'a',perm:[1,0,3,2]}]};
 const analyzer=new ColorEligibilityAnalyzer(model,precomputeFull(model));
 const request={holdSemantics:'color',protected:[0],colorByNode:['g','g','r','b']};
 const result=analyzer.analyze(request);assert(eligibilityReady(result,2,3));checkReady(model,result,request);
 const changed=analyzer.analyze({...request,colorByNode:['g','r','r','b']});assert(!eligibilityReady(changed,2,3));assert.equal(eligibilityWitness(changed,2,3),null);
 assert(!eligibilityReady(analyzer.analyze({...request,protected:[0,2]}),2));
 assert(eligibilityReady(analyzer.analyze({...request,protected:[]}),2,3));
});

test('invalid, oversized, and unretained words never become ready',()=>{
 const cache=macros(adjacent,[[0,1,0]]);cache.operations[0].word=[0];
 const analyzer=new ColorEligibilityAnalyzer(adjacent,precomputeFull(adjacent),{colorCache:cache});
 const request={holdSemantics:'color',protected:[],colorByNode:['r','g','b']};
 assert(!eligibilityReady(analyzer.analyze(request),0,2));
 cache.operations[0].word=new Array(5001).fill(0);analyzer.setColorCache({...cache});
 assert(!eligibilityReady(analyzer.analyze(request),0,2));
 const limited=new ColorEligibilityAnalyzer(adjacent).analyze(request,{maxStorageBytes:100});
 assert.equal(limited.stats.readyStorageLimited,true);
 assert(!eligibilityReady(limited,0,1));assert.equal(eligibilityWitness(limited,0,1),null);
 const noTime=analyzer.analyze({...request,colorByNode:['r','b','g']},{maxMs:0});assert(!eligibilityReady(noTime,0));
});

test('a memory-limited ready payload is not cached as a complete executable answer',()=>{
 const analyzer=new ColorEligibilityAnalyzer(adjacent,precomputeFull(adjacent));
 const request={holdSemantics:'color',protected:[],colorByNode:['r','g','b']};
 analyzer.analyze({...request,colorByNode:['g','r','b']}); // Warm mathematical reachability only for the next color key.
 const limited=analyzer.analyze(request,{maxStorageBytes:100});
 assert.equal(limited.status,'complete');assert.equal(limited.stats.readyStorageLimited,true);assert(!eligibilityReady(limited,0,1));
 const retry=analyzer.analyze(request);assert(eligibilityReady(retry,0,1));assert.notEqual(retry.cacheHit,true);
});

test('every ready pair across all production puzzles carries a directly executable witness',t=>{
 const manifest=require('../data/manifest.json');let puzzles=0,totalPairs=0;
 for(const {id}of manifest.models){
  const model=require('../data/'+id+'.json'),colorCache=require('../data/color-solver/'+id+'.json'),cache=require('../data/full-solver/'+id+'.json');
  const analyzer=new ColorEligibilityAnalyzer(model,cache,{colorCache});
  let colors=initialColors(model),example=findWitness(model,colorCache,colors),seed=123456789;
  for(const steps of [12,28]){
   if(example)break;
   const scramble=[];for(let i=0;i<steps;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;scramble.push(seed%model.moves.length);}
   colors=applySequence(model,colors,scramble);example=findWitness(model,colorCache,colors);
  }
  assert(example,id+' has a color-preserving production witness');
  const clear={holdSemantics:'color',protected:[],colorByNode:colors,occupiedNodes:colors.flatMap((c,i)=>c===null?[]:[i])};
  for(const request of [clear,example.request]){
   const result=analyzer.analyze(request,{maxMs:1000});
   assert.notEqual(result.status,'invalid',id+': '+result.reason);
   checkReady(model,result,request);
   assert(eligibilityReady(result,...example.request.swap),id+' retains its production witness with and without holds');
   totalPairs+=result.stats.readyPairs;
  }
  puzzles++;
 }
 assert.equal(puzzles,34);assert(totalPairs>1000);
 t.diagnostic(`${puzzles} puzzles; ${totalPairs} directed pair witnesses checked across empty-hold and color-hold requests`);
});
