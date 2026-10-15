'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {test}=require('node:test');
const {compileModel,identity,compose,inverse}=require('../solver-backend/src/group.cjs');
const {modelSignature,solveFull}=require('../solver-backend/src/full-solve.cjs');
const {loadSnapshot,fixedAdapter}=require('../solver-backend/tools/export-models.cjs');
const {verifyColorCache}=require('../solver-backend/tools/precompute-color.cjs');
const {initialColors,findWitness}=require('../solver-backend/tools/verify-color-precompute.cjs');
const {solveSync,verify,applySequence}=require('../solver-backend/src/index.cjs');
const {CachedSwapSolver}=require('../solver-backend/src/cached-swap.cjs');
for(const n of [9,10]){
 const id='cube'+n;
 test(`${id}: complete precomputed stabilizer witnesses fit runtime bounds`,()=>{
  const m=require('../solver-backend/data/'+id+'.json'),cache=require('../solver-backend/data/full-solver/'+id+'.json');
  assert.equal(m.degree,6*n*n);assert.equal(m.moves.length,9*n);assert.equal(cache.status,'ready');assert.equal(cache.complete,true);assert.equal(cache.modelSignature,modelSignature(m));
  assert.deepEqual(cache.base.slice().sort((a,b)=>a-b),Array.from({length:m.degree},(_,i)=>i));
  const compiled=compileModel(m),perms=[identity(m.degree)],lengths=[0],inverses=[];
  const term=r=>r<0?(inverses[-r]??=inverse(perms[-r])):perms[r];
  for(let i=1;i<cache.words.length;i++){
   const w=cache.words[i];assert([1,2].includes(w.length));
   if(w.length===1){assert(compiled.moves[w[0]]);perms[i]=compiled.moves[w[0]].perm;lengths[i]=1;}
   else{assert(w.every(r=>Number.isInteger(r)&&Math.abs(r)<i));perms[i]=compose(term(w[0]),term(w[1]));lengths[i]=lengths[Math.abs(w[0])]+lengths[Math.abs(w[1])];}
  }
  let upperBound=0,representatives=0;
  for(let k=0;k<cache.levels.length;k++){
   const level=cache.levels[k];assert.equal(level.base,cache.base[k]);let longest=0;
   for(const [dest,word,stored]of level.entries){
    const p=term(word);assert.equal(p[level.base],dest);for(let j=0;j<k;j++)assert.equal(p[cache.base[j]],cache.base[j]);
    assert.deepEqual(Array.from(p),stored);longest=Math.max(longest,lengths[Math.abs(word)]);representatives++;
   }upperBound+=longest;
  }
  assert.equal(upperBound,cache.stats.optimization.solutionLengthUpperBound);assert(upperBound<=20000,'all complete identity solutions fit shipped move cap');
  assert(cache.words.length<300000,'restoring precomputed witnesses fits worker DAG bound');
  console.log(id,'verified representatives',representatives,'raw move bound',upperBound,'word nodes',cache.words.length);
 });
 test(`${id}: three full scrambles solve in incremental verified stages and replay on the real engine`,()=>{
  const m=require('../solver-backend/data/'+id+'.json'),cache=require('../solver-backend/data/full-solver/'+id+'.json'),a=loadSnapshot(id),adapter=fixedAdapter(a);
  const home=Object.fromEntries(m.initialOccupied.map((v,i)=>[String(i),v])),samples=[];
  for(let trial=0;trial<3;trial++){
   adapter.reset();const scramble=a.engine.scramble(id+'-full-proof-'+trial);assert.equal(scramble.length,n*12);scramble.forEach(adapter.apply);
   const current=Object.fromEntries(adapter.mapping().map((v,i)=>[String(i),v]));
   const plan=solveFull(m,{homeBySticker:home,currentBySticker:current},{cache,maxMs:5000,maxOutputMoves:20000,colorOptimize:false});
   assert.equal(plan.status,'solved',plan.reason);assert(plan.stages.length>40,'large scrambled cube advances through individual placements');
   for(const stage of plan.stages){
    let p=identity(m.degree);for(const i of stage.moveIndices)p=compose(p,m.moves[i].perm);
    assert(stage.protectedNodes.every(x=>p[x]===x));assert.equal(p[stage.sourceNode],stage.targetNode);
    for(const i of stage.moveIndices)adapter.apply(m.moves[i].engineMove);
   }
   assert.deepEqual(adapter.mapping(),m.initialOccupied);assert(a.engine.isSolved(adapter.getState()));
   assert(plan.moveIndices.length<=cache.stats.optimization.solutionLengthUpperBound);
   samples.push({moves:plan.moveIndices.length,stages:plan.stages.length,maxStage:Math.max(...plan.stages.map(s=>s.moveIndices.length)),planningMs:Math.round(plan.stats.elapsedMs)});
  }console.log(id,'native full-solve samples',JSON.stringify(samples));
 });
 test(`${id}: all cached short exchanges replay exactly; relaxed hold request finds a verified local swap`,()=>{
  const m=require('../solver-backend/data/'+id+'.json'),cache=require('../solver-backend/data/color-solver/'+id+'.json');
  const report=verifyColorCache(m,cache);assert(report.verifiedWords>4000);assert(report.exchangePairs>1800);
  let colors=initialColors(m),example=findWitness(m,cache,colors);
  if(!example){colors=applySequence(m,colors,Array.from({length:40},(_,i)=>(i*17+3)%m.moves.length));example=findWitness(m,cache,colors);}
  assert(example,'at least one real held-color substitution');
  const result=solveSync(m,example.request,{colorCache:cache,maxMs:1000,maxOutputMoves:20000});
  assert.equal(result.status,'solved',result.reason);assert(verify(m,example.request,result.moveIndices));assert(result.moveIndices.length<=example.word.length);
 });
 test(`${id}: complete cache constructs a held-node swap within the browser memory budget`,()=>{
  const m=require('../solver-backend/data/'+id+'.json'),cache=require('../solver-backend/data/full-solver/'+id+'.json');
  const half=m.moves.find(move=>move.engineMove.turns===2),a=half.perm.findIndex((v,i)=>v!==i&&half.perm[v]===i),b=half.perm[a];
  const protectedNodes=half.perm.map((v,i)=>v===i?i:-1).filter(i=>i>=0).slice(0,3),request={swap:[a,b],protected:protectedNodes};
  const result=new CachedSwapSolver(m,cache).solve(request,{maxMs:3000,maxOutputMoves:20000,maxStorageBytes:64*1024*1024});
  assert.equal(result.status,'solved',result.reason);assert(verify(m,request,result.moveIndices));assert(result.stats.storageEstimateBytes<=64*1024*1024);
  console.log(id,'cached constrained swap',JSON.stringify({moves:result.moveIndices.length,ms:Math.round(result.stats.elapsedMs),estimatedBytes:result.stats.storageEstimateBytes}));
 });

}
