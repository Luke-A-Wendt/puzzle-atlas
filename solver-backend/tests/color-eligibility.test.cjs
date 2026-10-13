'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fixtures=require('./fixtures.cjs');
const {enumerateGroup,subsets}=require('./oracle.cjs');
const {precomputeFull,modelSignature}=require('../src/full-solve.cjs');
const {ColorEligibilityAnalyzer,eligibilityStatus}=require('../src/color-eligibility.cjs');
const {compose,identity}=require('../src/group.cjs');

function modelFrom(f){return {id:f.id,degree:f.degree,stickerCount:f.degree,moves:f.moves.map((perm,i)=>({name:String(i),perm}))};}
function macroCache(model,words){return {schemaVersion:1,kind:'color-macros',degree:model.degree,modelSignature:modelSignature(model),operations:words.map(word=>{let p=identity(model.degree);for(const i of word)p=compose(p,model.moves[i].perm);return {word,support:[...p].flatMap((dst,src)=>src===dst?[]:[src,dst])};})};}
const coupled=modelFrom(fixtures.find(x=>x.id==='coupled-swap'));
test('a coupled swap can exchange the pair while replacing a held sticker by its same color',()=>{
 const a=new ColorEligibilityAnalyzer(coupled,precomputeFull(coupled));
 const r=a.analyze({holdSemantics:'color',protected:[0],colorByNode:['green','green','red','blue']});
 assert.equal(eligibilityStatus(r,2,3),1);assert.equal(eligibilityStatus(r,2),1);
 assert.equal(eligibilityStatus(a.analyze({protected:[0]}),2,3),2);
 assert.equal(eligibilityStatus(r,0),2,'held addresses cannot be the selected pair');
 assert(r.stats.macroWitnessPairs>=2);
});
test('strict impossibility becomes unknown, never a false color impossibility',()=>{
 const a=new ColorEligibilityAnalyzer(coupled,precomputeFull(coupled));
 const r=a.analyze({holdSemantics:'color',protected:[0],colorByNode:['green','red','red','blue']});
 assert.equal(eligibilityStatus(r,2,3),0);assert.equal(eligibilityStatus(r,2),0);
 assert.equal(r.complete,false);assert.equal(r.reason,'color_search_incomplete');
 // In this tiny group impossibility really holds, but the bounded wrapper has
 // not made an exhaustive color-reachability proof and must say unknown.
});
test('global mechanical restrictions are still proved impossible with relaxed holds',()=>{
 const m=modelFrom(fixtures.find(x=>x.id==='cyclic-3')),a=new ColorEligibilityAnalyzer(m);
 for(const held of [[],[2]]){
  const r=a.analyze({holdSemantics:'color',protected:held,colorByNode:['x','x','x']});
  assert.equal(eligibilityStatus(r,0,1),2);assert.equal(r.status,'complete');
 }
});
test('color state, current holds, and cleared holds do not share stale eligibility',()=>{
 const a=new ColorEligibilityAnalyzer(coupled,precomputeFull(coupled));
 const base={holdSemantics:'color',protected:[0],colorByNode:['g','g','r','b']};
 assert.equal(eligibilityStatus(a.analyze(base),2,3),1);
 assert.equal(eligibilityStatus(a.analyze({...base,colorByNode:['g','r','r','b']}),2,3),0);
 assert.equal(eligibilityStatus(a.analyze({...base,protected:[]}),2,3),1);
 const held=a.analyze({...base,protected:[0,2]});assert.equal(eligibilityStatus(held,2),2);
 assert.equal(eligibilityStatus(a.analyze(base),2,3),1);
});
test('macro support alone never proves a legal move; its actual word must agree',()=>{
 const m={degree:4,stickerCount:4,moves:[{name:'a',perm:[1,0,3,2]},{name:'b',perm:[2,3,0,1]}]},cache=precomputeFull(m);
 const fabricated=macroCache(m,[[0]]);fabricated.operations[0].word=[1];
 const a=new ColorEligibilityAnalyzer(m,cache,{colorCache:fabricated});
 const r=a.analyze({holdSemantics:'color',protected:[0],colorByNode:['g','g','r','b']});
 // Primitive move a itself is a valid witness for 2<->3; fabricated support
 // cannot grant unrelated pair 1<->2 while the displayed hold differs.
 assert.equal(eligibilityStatus(r,1,2),0);
 // Use a multi-step candidate absent among primitives to exercise verification.
 const cache2=macroCache(m,[[0,1]]);cache2.operations[0].word=[0];a.setColorCache(cache2);
 const r2=a.analyze({holdSemantics:'color',protected:[0],colorByNode:['g','r','b','g']});
 assert.equal(eligibilityStatus(r2,1,2),0);assert(r2.stats.invalidMacros>0);
});
test('valid multi-step macro can preserve held colors at endpoints but not throughout',()=>{
 const m={degree:4,stickerCount:4,moves:[{name:'a',perm:[1,0,3,2]},{name:'b',perm:[2,3,0,1]}]};
 const a=new ColorEligibilityAnalyzer(m,precomputeFull(m),{colorCache:macroCache(m,[[0,1]])});
 const req={holdSemantics:'color',protected:[0],colorByNode:['g','r','b','g']};
 assert.equal(eligibilityStatus(a.analyze(req),1,2),1);
 assert.equal(eligibilityStatus(a.analyze({...req,protection:'throughout'}),1,2),0);
});
test('complete result caches are copied and budget exhaustion remains unknown',()=>{
 const a=new ColorEligibilityAnalyzer(coupled,precomputeFull(coupled)),req={holdSemantics:'color',protected:[],colorByNode:['g','g','r','b']};
 const limited=a.analyze(req,{maxMs:0});assert.equal(eligibilityStatus(limited,2,3),0);
 const r=a.analyze(req);assert.equal(r.status,'complete');r.feasiblePairs.fill(0);r.colorByNode.fill('corrupt');
 const again=a.analyze(req);assert.equal(again.cacheHit,true);assert.equal(eligibilityStatus(again,2,3),1);assert.deepEqual(again.colorByNode,req.colorByNode);
 assert.equal(a.analyze({...req,colorByNode:['g']}).status,'invalid');
 assert.equal(a.analyze({...req,holdSemantics:'anything'}).status,'invalid');
});
test('pose occupancy and null color addresses are validated',()=>{
 const m={degree:4,stickerCount:2,requiresOccupiedState:true,moves:[{name:'a',perm:[1,0,3,2]}]},a=new ColorEligibilityAnalyzer(m);
 const req={holdSemantics:'color',occupiedNodes:[0,1],colorByNode:['r','g',null,null]};
 assert.equal(eligibilityStatus(a.analyze(req),0,1),1);assert.equal(eligibilityStatus(a.analyze(req),0,2),2);
 assert.equal(a.analyze({...req,colorByNode:['r','g','x',null]}).status,'invalid');
 assert.equal(a.analyze({...req,colorByNode:[null,'g',null,null]}).status,'invalid');
});
for(const f of fixtures.filter(x=>x.degree<=4))test('every positive and negative color classification agrees with full tiny-group oracle: '+f.id,()=>{
 const m=modelFrom(f),a=new ColorEligibilityAnalyzer(m,precomputeFull(m)),group=enumerateGroup(f.degree,f.moves),nodes=Array.from({length:f.degree},(_,i)=>i);
 for(let coloring=0;coloring<2**f.degree;coloring++){
  const colors=nodes.map(x=>(coloring>>x)&1);
  for(const held of subsets(nodes)){
   const r=a.analyze({holdSemantics:'color',protected:held,colorByNode:colors});assert.notEqual(r.status,'invalid',r.reason);
   for(const x of nodes)for(const y of nodes){
    const expected=x!==y&&!held.includes(x)&&!held.includes(y)&&group.some(g=>g.permutation[x]===y&&g.permutation[y]===x&&held.every(h=>{const src=g.permutation.indexOf(h);return colors[src]===colors[h];}));
    const status=eligibilityStatus(r,x,y);if(status===1)assert(expected,`${f.id} false YES colors=${colors} held=${held} pair=${x},${y}`);if(status===2)assert(!expected,`${f.id} false NO colors=${colors} held=${held} pair=${x},${y}`);
   }
  }
 }
});
