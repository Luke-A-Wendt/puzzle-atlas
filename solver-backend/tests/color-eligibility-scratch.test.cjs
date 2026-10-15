'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {ColorEligibilityAnalyzer,eligibilityReady,eligibilityWitness}=require('../src/color-eligibility.cjs');
const {modelSignature,precomputeFull}=require('../src/full-solve.cjs');
const {verify}=require('../src/index.cjs');
const model={degree:3,stickerCount:3,moves:[{name:'a',perm:[1,0,2]},{name:'b',perm:[0,2,1]}]};
const request={holdSemantics:'color',protected:[],colorByNode:['r','g','b']};
function catalog(operations){return{schemaVersion:1,kind:'color-macros',degree:3,modelSignature:modelSignature(model),operations};}
test('reused scratch mappings cannot turn malformed or incomplete support into a ready pair',()=>{
 const invalid=[
  {word:[0,1,0],support:[0,2,2,0,0,1]}, // duplicate source, writes partial scratch before failing
  {word:[0,1,0],support:[0,2]},          // a previous macro destination must not close this support
  {word:[0,1,0],support:[0,2,1,2]},      // duplicate destination
  {word:[0,1,0],support:[0,2,2,3]},      // out-of-range destination
  {word:[0,1,0],support:[0,2,2,0.5]},    // noninteger destination
  {word:[0],support:[0,2,2,0],trusted:true} // cached metadata cannot grant primitive trust
 ];
 const analyzer=new ColorEligibilityAnalyzer(model,precomputeFull(model),{colorCache:catalog(invalid)});
 const result=analyzer.analyze(request);assert(!eligibilityReady(result,0,2));assert.equal(result.stats.invalidMacros,invalid.length);
 const valid={word:[0,1,0],support:[0,2,2,0]};analyzer.setColorCache(catalog([...invalid,valid]));
 const repaired=analyzer.analyze(request);assert(eligibilityReady(repaired,0,2));assert.deepEqual(eligibilityWitness(repaired,0,2),valid.word);
 assert(verify(model,{...request,swap:[0,2]},eligibilityWitness(repaired,0,2)));
});
test('endpoint exemption reuses no violations or candidates from preceding requests',()=>{
 const cache=catalog([{word:[0,1,0],support:[0,2,2,0]}]),analyzer=new ColorEligibilityAnalyzer(model,precomputeFull(model),{colorCache:cache});
 const both={...request,protected:[0,2],exemptSwapEndpoints:true};
 const permitted=analyzer.analyze(both);assert(eligibilityReady(permitted,0,2));
 assert(!eligibilityReady(analyzer.analyze({...both,exemptSwapEndpoints:false}),0,2));
 const again=analyzer.analyze({...both,colorByNode:['b','g','r']});assert(eligibilityReady(again,0,2));
 assert(verify(model,{...request,colorByNode:again.colorByNode,swap:[0,2]},eligibilityWitness(again,0,2)));
});
