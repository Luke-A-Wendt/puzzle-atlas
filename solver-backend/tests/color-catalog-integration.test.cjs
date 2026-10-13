'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {solveSync,applySequence,verify}=require('../src/index.cjs');
const {initialColors,findWitness}=require('../tools/verify-color-precompute.cjs');

test('every puzzle has an executable relaxed hold witness using its production cache',()=>{
 const manifest=require('../data/manifest.json');
 for(const {id} of manifest.models){
  const model=require('../data/'+id+'.json'),cache=require('../data/color-solver/'+id+'.json');
  let colors=initialColors(model),example=findWitness(model,cache,colors),seed=123456789;
  for(const steps of [12,28]){
   if(example)break;
   const scramble=[];for(let i=0;i<steps;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;scramble.push(seed%model.moves.length);}
   colors=applySequence(model,colors,scramble);example=findWitness(model,cache,colors);
  }
  assert.ok(example,id+' needs a real color-substitution example');
  const result=solveSync(model,example.request,{colorCache:cache,maxMs:500,maxOutputMoves:20000});
  assert.equal(result.status,'solved',id+': '+result.reason);
  assert.equal(result.verified,true,id);
  assert.equal(verify(model,example.request,result.moveIndices),true,id);
  assert.ok(result.moveIndices.length<=example.word.length,id+' should retain its catalog incumbent');
 }
});

test('short pointwise competitor avoids a six-turn catalog regression for Kilominx',()=>{
 const model=require('../data/kilominx.json'),cache=require('../data/color-solver/kilominx.json');
 const req={swap:[9,27],protected:[4],colorByNode:initialColors(model),holdSemantics:'color'};
 const result=solveSync(model,req,{colorCache:cache,maxMs:500});
 assert.equal(result.status,'solved');assert.ok(result.moveIndices.length<=5);assert.equal(verify(model,req,result.moveIndices),true);
});
