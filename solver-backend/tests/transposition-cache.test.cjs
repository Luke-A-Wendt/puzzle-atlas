'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {precomputeFull}=require('../src/full-solve.cjs');
const {PermutationMembership,transposition}=require('../src/permutation-membership.cjs');
const {ColorCompensationSearch}=require('../src/color-compensation.cjs');
const {ManualSwapSession}=require('../src/manual-session.cjs');
const {normalize,verify,permutation}=require('../src/index.cjs');
const {auditExactPairs}=require('../tools/precompute-transpositions.cjs');
const {enumerateGroup}=require('./oracle.cjs');
const {initialColors}=require('../tools/verify-color-precompute.cjs');

test('complete-chain membership and factor order agree with independently enumerated small groups',()=>{
 for(const model of [
  {degree:4,moves:[{name:'c',perm:[1,2,3,0]},{name:'s',perm:[1,0,2,3]}]},
  {degree:4,moves:[{name:'x',perm:[1,0,3,2]}]}
 ]){
  const cache=precomputeFull(model),oracle=enumerateGroup(model.degree,model.moves.map(x=>x.perm)),membership=new PermutationMembership(model,cache);
  for(let a=0;a<4;a++)for(let b=a+1;b<4;b++){
   const p=transposition(4,a,b),expected=oracle.some(x=>x.permutation.join(',')===p.join(',')),actual=membership.factor(p);
   assert.equal(actual.member,expected);if(actual.member)assert.deepEqual(permutation(model,membership.expand(actual.parts)),Array.from(p));
  }
  const audit=auditExactPairs(model,cache);assert.equal(audit.totalPairs,6);assert.equal(audit.possible,model.moves.length===2?6:0);assert.equal(audit.unresolved,0);
 }
});

test('all 34 complete audits cover every unordered model-address pair exactly once',()=>{
 const report=require('../data/color-solver/transposition-report.json');let pairs=0;
 assert.equal(report.models.length,34);
 for(const row of report.models){
  const model=require('../data/'+row.id+'.json'),cache=require('../data/full-solver/'+row.id+'.json'),saved=require('../data/color-solver/'+row.id+'.json').exactTranspositions;
  const actual=auditExactPairs(model,cache);delete actual.elapsedMs;
  assert.deepEqual(actual,saved,row.id);assert.equal(saved.orbits.reduce((n,x)=>n+x.pairs,0),model.degree*(model.degree-1)/2);pairs+=saved.totalPairs;
 }
 assert.equal(pairs,251486);assert.equal(report.possible,0);assert.equal(report.unresolved,0);
});

test('bounded compensation succeeds without relaxing any other color, and a miss is not impossibility',()=>{
 const model={degree:4,moves:[{name:'x',perm:[1,0,3,2]}]},cache=precomputeFull(model);
 const req=normalize(model,{swap:[0,1],protected:[2,3],holdSemantics:'color',colorByNode:['r','b','g','g']});
 const search=new ColorCompensationSearch(model,req,cache),r=search.advance({maxMs:1000});
 assert(r.done);assert.equal(r.result.status,'solved');assert.deepEqual(r.result.compensatingPair,[2,3]);assert(verify(model,req,r.result.moveIndices));
 const absent=new ColorCompensationSearch(model,{...req,colorByNode:['r','b','g','y']},cache).advance({maxMs:1000});
 assert(absent.done);assert.equal(absent.result,null,'only this candidate family was exhausted');
});

test('real cube4 restores all 94 other colors using a compensator with BFS and macro catalog disabled',()=>{
 const model=require('../data/cube4.json'),cache=require('../data/full-solver/cube4.json'),colors=initialColors(model),swap=[10,22];
 const request={swap,protected:Array.from({length:model.degree},(_,i)=>i).filter(i=>!swap.includes(i)),holdSemantics:'color',colorByNode:colors};
 const session=new ManualSwapSession(model,request,{fullCache:cache,maxSearchStates:0,maxMs:3000});
 const r=session.advance({budgetMs:3000});
 assert.equal(r.status,'solved',JSON.stringify(r));assert.equal(r.method,'same_color_compensated_transposition');assert(r.stats.compensationTests>0);assert.equal(r.stats.transitions,0);
 assert(verify(model,normalize(model,request),r.moveIndices));assert.equal(r.permutation.filter((x,i)=>x!==i).length,4);
});

test('persisted sparse fallbacks solve a real all-other-colors-held request through the existing catalog path',()=>{
 const model=require('../data/cube4.json'),cache=require('../data/color-solver/cube4.json'),colors=initialColors(model),swap=[10,22];
 const request={swap,protected:Array.from({length:model.degree},(_,i)=>i).filter(i=>!swap.includes(i)),holdSemantics:'color',colorByNode:colors};
 const r=new ManualSwapSession(model,request,{colorCache:cache,constructive:false,maxSearchStates:0}).advance({budgetMs:3000});
 assert.equal(r.status,'solved');assert.equal(r.method,'manual_short_catalog');assert.equal(r.moveIndices.length,10);assert(verify(model,normalize(model,request),r.moveIndices));
});
