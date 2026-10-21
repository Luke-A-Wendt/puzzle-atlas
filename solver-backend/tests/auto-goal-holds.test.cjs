'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {ColorEligibilityAnalyzer,eligibilityReady,eligibilityWitness}=require('../src/color-eligibility.cjs');
const {modelSignature}=require('../src/full-solve.cjs');
const {verify,permutation,applySequence}=require('../src/index.cjs');
function fixture(perms,goal=['r','g','b','y']){return {degree:goal.length,stickerCount:goal.length,moves:perms.map((perm,i)=>({name:'m'+i,perm})),homeBySticker:Object.fromEntries(goal.map((_,i)=>[String(i),i])),colorBySticker:Object.fromEntries(goal.map((c,i)=>[String(i),c]))};}
function macros(model,words){return {schemaVersion:1,kind:'color-macros',degree:model.degree,modelSignature:modelSignature(model),operations:words.map(word=>({word,support:permutation(model,word).flatMap((dst,src)=>src===dst?[]:[src,dst])}))};}
function goalColors(model){const colors=Array(model.degree).fill(null);for(const [id,node]of Object.entries(model.homeBySticker))colors[node]=String(model.colorBySticker[id]);return colors;}
function request(colors){return {holdSemantics:'color',colorByNode:colors,occupiedNodes:colors.flatMap((c,i)=>c===null?[]:[i])};}
function verifyAutoHolds(model,colors,result){
 assert.equal(result.status,'ready',model.id+': '+result.reason);
 const goal=goalColors(model),[a,b]=result.pair,held=result.protectedNodes;
 assert(!held.includes(a)&&!held.includes(b),'recommended endpoints are not held');
 assert(held.every(n=>colors[n]===goal[n]),'only already-correct locations are held');
 assert((goal[a]!==null&&colors[a]!==goal[a]&&colors[b]===goal[a])||(goal[b]!==null&&colors[b]!==goal[b]&&colors[a]===goal[b]),'an endpoint newly reaches its goal');
 assert(verify(model,{...request(colors),protected:held,swap:[a,b]},result.word));
 const after=applySequence(model,colors,result.word);assert(held.every(n=>after[n]===colors[n]));
 assert(eligibilityReady(result.eligibility,a,b));assert.deepEqual(eligibilityWitness(result.eligibility,a,b),result.word);
 for(const w of result.eligibility.readyWitnesses)for(let i=0;i<w.pairs.length;i+=2){const pair=w.pairs.slice(i,i+2);assert(verify(model,{...request(colors),protected:held.filter(n=>!pair.includes(n)),swap:pair},w.word));}
 return after;
}

test('Auto releases goal holds that would block its verified improving exchange',()=>{
 const model=fixture([[1,0,3,2]]),colors=['g','r','b','y'];
 const result=new ColorEligibilityAnalyzer(model).suggestHolds({...request(colors),protected:[2,3]});
 verifyAutoHolds(model,colors,result);assert.deepEqual(result.protectedNodes,[]);assert.deepEqual(result.pair,[0,1]);
 assert(eligibilityReady(result.eligibility,2,3),'other exchanges from the retained word remain selectable');
});
test('Auto prefers a catalog word retaining more correct colors over a shorter destructive move',()=>{
 const model=fixture([[1,0,3,2],[0,1,3,2]]),colors=['g','r','b','y'];
 const result=new ColorEligibilityAnalyzer(model,null,{colorCache:macros(model,[[0,1]])}).suggestHolds(request(colors));
 verifyAutoHolds(model,colors,result);assert.deepEqual(result.protectedNodes,[2,3]);assert.deepEqual(result.word,[0,1]);
});
test('Auto keeps same-colored held locations even when their sticker identities move',()=>{
 const model=fixture([[1,0,3,2]],['r','g','b','b']),colors=['g','r','b','b'];
 const result=new ColorEligibilityAnalyzer(model).suggestHolds(request(colors));verifyAutoHolds(model,colors,result);assert.deepEqual(result.protectedNodes,[2,3]);
});
test('solved state holds all locations without inventing a goal-improving exchange',()=>{
 const model=fixture([[1,0,3,2]]),result=new ColorEligibilityAnalyzer(model).suggestHolds(request(goalColors(model)));
 assert.equal(result.status,'solved');assert.deepEqual(result.protectedNodes,[0,1,2,3]);assert.equal(result.pair,undefined);
});
test('Auto never treats an unchanged correct endpoint as newly corrected',()=>{
 const model=fixture([[1,0,2,3]],['r','r','b','y']);
 const result=new ColorEligibilityAnalyzer(model).suggestHolds(request(['r','r','y','b']));assert.equal(result.status,'no_ready_swap');assert.deepEqual(result.protectedNodes,[]);
});
test('forged catalog supports, occupied gaps and zero budgets cannot advertise a swap',()=>{
 const model=fixture([[1,2,0]],['r','g','b']),cache=macros(model,[[0]]);cache.operations[0].support=[0,1,1,0];
 const analyzer=new ColorEligibilityAnalyzer(model,null,{colorCache:cache});
 assert.equal(analyzer.suggestHolds(request(['g','r','b'])).status,'no_ready_swap');
 assert.equal(analyzer.suggestHolds(request(['g','r','b']),{maxMs:0}).status,'no_ready_swap');
 assert.equal(analyzer.suggestHolds(request(['g','r','b']),{maxStorageBytes:0}).status,'no_ready_swap');
 assert.equal(analyzer.suggestHolds({...request(['g','r','b']),occupiedNodes:[0,1]}).status,'invalid');
 assert.equal(analyzer.suggestHolds({...request(['g','r','b']),protection:'throughout'}).status,'invalid');
});
test('a forged higher-scoring catalog entry cannot replace a valid fallback',()=>{
 const model=fixture([[1,0,3,2]]),colors=['g','r','b','y'],cache=macros(model,[[0]]);
 cache.operations[0].support=[0,1,1,0]; // Falsely claims that both already-correct locations are preserved.
 const result=new ColorEligibilityAnalyzer(model,null,{colorCache:cache}).suggestHolds(request(colors));
 verifyAutoHolds(model,colors,result);assert.deepEqual(result.protectedNodes,[]);assert.deepEqual(result.word,[0]);assert(result.stats.invalidMacros>0);
});
test('expanded pose models never invent a goal on an originally empty address',()=>{
 const model={...fixture([[1,0,3,2]],['r','g','b','y']),stickerCount:2,requiresOccupiedState:true,homeBySticker:{a:0,b:2},colorBySticker:{a:'r',b:'g'}};
 const colors=['g',null,'r',null],result=new ColorEligibilityAnalyzer(model).suggestHolds(request(colors));
 assert.equal(result.status,'no_ready_swap','only transposition partners are currently empty');
});
test('all production puzzle families retain a verified improving swap after Auto holds',t=>{
 const manifest=require('../data/manifest.json');let count=0,maxMs=0;
 for(const {id}of manifest.models){
  const model=require('../../dist/games/constrained-solver-models/'+id+'.json'),cache=require('../data/color-solver/'+id+'.json');
  let seed=13,word=[];for(let k=0;k<12;k++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;word.push(seed%model.moves.length);}
  const colors=applySequence(model,goalColors(model),word),result=new ColorEligibilityAnalyzer(model,null,{colorCache:cache}).suggestHolds(request(colors));
  verifyAutoHolds(model,colors,result);count++;maxMs=Math.max(maxMs,result.stats.elapsedMs);
 }
 assert.equal(count,manifest.models.length);assert(count>=37);t.diagnostic(count+' puzzle families verified; slowest catalog scan '+Math.round(maxMs)+'ms');
});
