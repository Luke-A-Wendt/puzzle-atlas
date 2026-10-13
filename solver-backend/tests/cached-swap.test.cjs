'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {CachedSwapSolver,solveCachedSwap}=require('../src/cached-swap.cjs');
const {precomputeFull}=require('../src/full-solve.cjs');
const {EligibilityAnalyzer,eligibilityStatus}=require('../src/eligibility.cjs');
const {enumerateGroup,subsets,applyWord}=require('./oracle.cjs');
const fixtures=require('./fixtures.cjs');

for(const f of fixtures)test('cached constructive transporter agrees with independent group oracle: '+f.id,()=>{
 const model={id:f.id,degree:f.degree,moves:f.moves.map((perm,i)=>({name:String(i),perm}))},cache=precomputeFull(model),solver=new CachedSwapSolver(model,cache),group=enumerateGroup(f.degree,f.moves);
 assert.equal(cache.status,'ready');
 for(let a=0;a<f.degree;a++)for(let b=a+1;b<f.degree;b++)for(const held of subsets(Array.from({length:f.degree},(_,i)=>i).filter(x=>x!==a&&x!==b))){
  const expected=group.some(g=>g.permutation[a]===b&&g.permutation[b]===a&&held.every(x=>g.permutation[x]===x));
  const r=solver.solve({protected:held,swap:[a,b]},{maxMs:1000});
  assert.equal(r.status,expected?'solved':'impossible',JSON.stringify({a,b,held,reason:r.reason}));
  if(expected){const p=applyWord(f.degree,f.moves,r.moveIndices);assert.equal(p[a],b);assert.equal(p[b],a);assert(held.every(x=>p[x]===x));assert(r.verified);}
 }
});

test('cached witnesses survive arbitrary hold rebasing on all 34 shipped puzzle caches',()=>{
 const fs=require('node:fs'),path=require('node:path'),dir=path.join(__dirname,'../data/full-solver');let tested=0;
 for(const file of fs.readdirSync(dir)){
  const cache=require(path.join(dir,file));if(cache.status!=='ready'||cache.complete!==true)continue;
  const model=require(path.join(__dirname,'../data',file)),occupied=model.requiresOccupiedState?model.initialOccupied:undefined,available=occupied??Array.from({length:model.degree},(_,i)=>i);
  // Non-prefix holds exercise adjacent-base changes, not just cached prefix use.
  const held=[available[0],available[2],available[4]].filter(x=>x!==undefined),request={protected:held,...(occupied?{occupiedNodes:occupied}:{})};
  const eligible=new EligibilityAnalyzer(model,cache).analyze(request,{maxMs:3000});assert.equal(eligible.status,'complete',file+': '+eligible.reason);
  let pair;for(const a of available){for(const b of available)if(a<b&&eligibilityStatus(eligible,a,b)===1){pair=[a,b];break;}if(pair)break;}
  if(!pair){tested++;continue;}
  const r=solveCachedSwap(model,{...request,swap:pair},{cache,maxMs:3000,maxOutputMoves:5000});assert.equal(r.status,'solved',file+': '+r.reason);
  const p=applyWord(model.degree,model.moves.map(m=>m.perm),r.moveIndices);assert.equal(p[pair[0]],pair[1]);assert.equal(p[pair[1]],pair[0]);assert(held.every(x=>p[x]===x),file);assert(r.moveIndices.length<=5000);tested++;
 }
 assert.equal(tested,34);
});

test('output, time, base-rebase and cache limits remain unknown, never false impossible',()=>{
 const model={degree:3,moves:[{name:'a',perm:[1,0,2]},{name:'b',perm:[0,2,1]}]},cache=precomputeFull(model),request={protected:[1],swap:[0,2]};
 assert.equal(solveCachedSwap(model,request,{cache,maxOutputMoves:0}).status,'unknown');
 assert.equal(solveCachedSwap(model,request,{cache,maxMs:0}).status,'unknown');
 assert.equal(solveCachedSwap(model,request,{cache,maxBaseSwaps:0}).status,'unknown');
 assert.equal(solveCachedSwap(model,request,{}).status,'unknown');
 const mismatched={...cache,modelSignature:'invalid'};assert.equal(solveCachedSwap(model,request,{cache:mismatched}).status,'unknown');
});

test('pointwise impossibility cannot be claimed for relaxed color holds',()=>{
 const model={degree:4,moves:[{name:'both',perm:[1,0,3,2]}]},cache=precomputeFull(model),request={protected:[2],swap:[0,1]};
 assert.equal(solveCachedSwap(model,request,{cache}).status,'impossible');
 const r=solveCachedSwap(model,{...request,holdSemantics:'color',colorByNode:['r','b','g','g']},{cache});assert.equal(r.status,'unknown');assert.equal(r.reason,'color_hold_pointwise_fallback_impossible');
});

test('throughout protection only uses individually safe primitive moves',()=>{
 const model={degree:3,moves:[{name:'a',perm:[1,0,2]},{name:'b',perm:[0,2,1]}]},cache=precomputeFull(model);
 assert.equal(solveCachedSwap(model,{protected:[1],swap:[0,2]},{cache}).status,'solved');
 assert.equal(solveCachedSwap(model,{protected:[1],swap:[0,2],protection:'throughout'},{cache}).status,'impossible');
});
