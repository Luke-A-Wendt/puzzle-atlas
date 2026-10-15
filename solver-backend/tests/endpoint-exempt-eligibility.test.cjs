'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {ColorEligibilityAnalyzer,eligibilityReady,eligibilityWitness}=require('../src/color-eligibility.cjs');
const {precomputeFull}=require('../src/full-solve.cjs');
const {verify,normalize}=require('../src/index.cjs');
test('held endpoint exemptions are pair-specific and leave every other hold enforced',()=>{
 const model={degree:4,stickerCount:4,moves:[{name:'double',perm:[1,0,3,2]}]},analyzer=new ColorEligibilityAnalyzer(model,precomputeFull(model));
 const request={protected:[0,1,2,3],holdSemantics:'color',colorByNode:['red','blue','green','green'],exemptSwapEndpoints:true};
 const r=analyzer.analyze(request);assert.equal(r.exemptSwapEndpoints,true);assert.deepEqual(r.candidateNodes,[0,1,2,3]);
 assert(eligibilityReady(r,0,1));assert(!eligibilityReady(r,2,3),'exempting 2/3 must not release red/blue holds at 0/1');
 assert(verify(model,normalize(model,{...request,protected:[2,3],swap:[0,1]}),eligibilityWitness(r,0,1)));
 const blocked=analyzer.analyze({...request,exemptSwapEndpoints:false});assert(!eligibilityReady(blocked,0));assert.deepEqual(blocked.candidateNodes,[]);
 const changed=analyzer.analyze({...request,colorByNode:['red','blue','green','yellow']});assert(!eligibilityReady(changed,0,1));
 const released=analyzer.analyze({...request,protected:[0,1]});assert(eligibilityReady(released,0,1));
});
test('all returned endpoint-exempt witnesses obey their own effective hold sets',()=>{
 const model={degree:5,stickerCount:5,moves:[{name:'a',perm:[1,0,2,4,3]},{name:'b',perm:[0,2,1,4,3]}]};
 const request={protected:[0,1,2,3,4],holdSemantics:'color',colorByNode:['red','blue','red','green','green'],exemptSwapEndpoints:true};
 const r=new ColorEligibilityAnalyzer(model,precomputeFull(model)).analyze(request);
 let checked=0;for(const entry of r.readyWitnesses)for(let i=0;i<entry.pairs.length;i+=2){const swap=entry.pairs.slice(i,i+2),protectedNodes=request.protected.filter(x=>!swap.includes(x));assert(verify(model,normalize(model,{...request,protected:protectedNodes,swap}),entry.word));checked++;}
 assert(checked>=2);
});
