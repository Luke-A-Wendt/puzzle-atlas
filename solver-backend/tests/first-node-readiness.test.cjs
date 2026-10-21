'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {ColorEligibilityAnalyzer,eligibilityStatus,eligibilityReady}=require('../src/color-eligibility.cjs');
const {precomputeFull,modelSignature}=require('../src/full-solve.cjs');
const {permutation}=require('../src/index.cjs');

// First-node coloring is an existential summary of the same pair table used
// after selecting that node. A reachability proof without a retained move
// word remains a question mark; it must not promise immediate playback.
function availability(result,a,b){return eligibilityReady(result,a,b)?'ready':eligibilityStatus(result,a,b)===2?'blocked':'unknown';}
function assertRowsMatchPartners(result){
 for(const a of result.candidateNodes){
  const partners=result.candidateNodes.filter(b=>b!==a).map(b=>availability(result,a,b));
  const expected=partners.includes('ready')?'ready':partners.includes('unknown')?'unknown':'blocked';
  assert.equal(availability(result,a),expected,'first-node summary must match its actual partner choices at '+a);
 }
}
const model={degree:7,stickerCount:7,moves:[
 {name:'swap',perm:[1,0,2,3,4,5,6]},
 {name:'cycle',perm:[0,1,3,4,5,2,6]}
]};
const request={holdSemantics:'color',protected:[],colorByNode:['r','b','g','w','y','o','k'],exemptSwapEndpoints:true};

test('first choices distinguish ready partners, unresolved partners, and all-blocked rows',()=>{
 const result=new ColorEligibilityAnalyzer(model,precomputeFull(model)).analyze(request);
 assert.equal(result.status,'complete');
 assert.deepEqual(Array.from({length:model.degree},(_,a)=>availability(result,a)),['ready','ready','unknown','unknown','unknown','unknown','blocked']);
 assert.equal(eligibilityStatus(result,2,4),1,'the longer exchange exists mathematically');
 assert.equal(eligibilityReady(result,2,4),false,'but no executable word has been retained for it');
 assertRowsMatchPartners(result);
});

test('one cached partner upgrades its first-node summary without per-node searches',()=>{
 const word=[1,1],colorCache={schemaVersion:1,kind:'color-macros',degree:model.degree,modelSignature:modelSignature(model),operations:[{word,support:permutation(model,word).flatMap((to,from)=>to===from?[]:[from,to])}]};
 const result=new ColorEligibilityAnalyzer(model,precomputeFull(model),{colorCache}).analyze(request);
 assert.deepEqual(Array.from({length:model.degree},(_,a)=>availability(result,a)),['ready','ready','ready','ready','ready','ready','blocked']);
 assertRowsMatchPartners(result);
});

test('held first nodes summarize pair-specific endpoint exemptions and current colors',()=>{
 const coupled={degree:4,stickerCount:4,moves:[{name:'double',perm:[1,0,3,2]}]},analyzer=new ColorEligibilityAnalyzer(coupled,precomputeFull(coupled));
 const held={holdSemantics:'color',protected:[0,1,2,3],colorByNode:['r','b','g','g'],exemptSwapEndpoints:true};
 const result=analyzer.analyze(held);
 assert.equal(availability(result,0),'ready');assert.equal(availability(result,1),'ready');
 assert.equal(availability(result,2),'unknown');assert.equal(availability(result,3),'unknown');
 assertRowsMatchPartners(result);
 const changed=analyzer.analyze({...held,colorByNode:['r','b','g','y']});
 assert(changed.readyFirstStatus.every(x=>x===0),'changing held colors invalidates prior readiness');
 assertRowsMatchPartners(changed);
 const clear=analyzer.analyze({...held,protected:[]});
 assert(clear.readyFirstStatus.every(x=>x===1),'clearing holds restores existing primitive witnesses');
 assertRowsMatchPartners(clear);
});

test('limited analysis leaves first choices unknown instead of fabricating blocked rows',()=>{
 const result=new ColorEligibilityAnalyzer(model,precomputeFull(model)).analyze(request,{maxMs:0});
 assert.equal(result.status,'unknown');
 assert(result.candidateNodes.every(a=>availability(result,a)==='unknown'));
 assertRowsMatchPartners(result);
});
