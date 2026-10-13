'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fixtures=require('./fixtures.cjs'),{enumerateGroup,subsets}=require('./oracle.cjs');
const {precomputeFull}=require('../src/full-solve.cjs'),{EligibilityAnalyzer,eligibilityStatus}=require('../src/eligibility.cjs');
for(const fixture of fixtures)test('eligibility exactly matches every protected set: '+fixture.id,()=>{const model={id:fixture.id,degree:fixture.degree,stickerCount:fixture.degree,moves:fixture.moves.map((perm,i)=>({name:String(i),perm}))},cache=precomputeFull(model),analyzer=new EligibilityAnalyzer(model,cache),group=enumerateGroup(fixture.degree,fixture.moves);assert.equal(cache.status,'ready');for(const held of subsets(Array.from({length:fixture.degree},(_,i)=>i))){const r=analyzer.analyze({protected:held},{maxMs:5000});assert.equal(r.status,'complete',r.reason);for(let a=0;a<fixture.degree;a++){let any=false;for(let b=0;b<fixture.degree;b++){const expected=a!==b&&!held.includes(a)&&!held.includes(b)&&group.some(g=>held.every(x=>g.permutation[x]===x)&&g.permutation[a]===b&&g.permutation[b]===a);assert.equal(eligibilityStatus(r,a,b),expected?1:2,fixture.id+' held='+held+' pair='+[a,b]);if(expected)any=true;}assert.equal(eligibilityStatus(r,a),any?1:2);}}});
test('cyclic reachability does not imply a reversible ordered pair',()=>{for(const [id,expected]of [['cyclic-3',2],['symmetric-3',1]]){const f=fixtures.find(x=>x.id===id),m={degree:3,moves:f.moves.map((perm,i)=>({name:String(i),perm}))},r=new EligibilityAnalyzer(m).analyze({});assert.equal(r.status,'complete');assert.equal(eligibilityStatus(r,0,1),expected);}});
test('a held node is fixed at sequence endpoints; throughout is a stricter group',()=>{const m={degree:3,moves:[{name:'a',perm:[1,0,2]},{name:'b',perm:[0,2,1]}]},cache=precomputeFull(m),analyzer=new EligibilityAnalyzer(m,cache);assert.equal(eligibilityStatus(analyzer.analyze({protected:[1]}),0,2),1);assert.equal(eligibilityStatus(analyzer.analyze({protected:[1],protection:'throughout'}),0,2),2);});
test('occupancy excludes empty geometric addresses and resource exhaustion stays unknown',()=>{const m={degree:4,stickerCount:2,requiresOccupiedState:true,initialOccupied:[0,1],moves:[{name:'a',perm:[1,0,3,2]}]},a=new EligibilityAnalyzer(m,precomputeFull(m));const r=a.analyze({occupiedNodes:[0,1]});assert.equal(eligibilityStatus(r,0,1),1);assert.equal(eligibilityStatus(r,0,2),2);const unknown=new EligibilityAnalyzer(m).analyze({occupiedNodes:[0,1]},{maxMs:0});assert.equal(unknown.status,'unknown');assert.equal(eligibilityStatus(unknown,0,1),0);assert.equal(a.analyze({occupiedNodes:[0,0]}).status,'invalid');});
test('complete result caches are defensively copied and budget cutoffs are not cached',()=>{const m={degree:3,moves:[{name:'a',perm:[1,0,2]},{name:'b',perm:[0,2,1]}]},a=new EligibilityAnalyzer(m,precomputeFull(m));const limited=a.analyze({protected:[1]},{maxBaseSwaps:0});assert.equal(eligibilityStatus(limited,0,2),0);const complete=a.analyze({protected:[1]});assert.equal(complete.status,'complete');complete.feasiblePairs.fill(0);const cached=a.analyze({protected:[1]});assert.equal(cached.cacheHit,true);assert.equal(eligibilityStatus(cached,0,2),1);});
test('Tetraminx without holds excludes only axial triads whose legal action is C3, not stale holds',()=>{
 const model=require('../data/tetraminx.json'),cache=require('../data/full-solver/tetraminx.json');
 const analyzer=new EligibilityAnalyzer(model,cache),result=analyzer.analyze({protected:[]});
 assert.equal(result.status,'complete');
 const triads=[[3,9,15],[4,21,10],[5,16,22],[11,23,17]],axial=new Set(triads.flat());
 assert.equal(axial.size,12);
 for(const triad of triads){
  // Restrict every primitive move to this one rigid axial piece. Its entire
  // action group has three elements, none reversing any pair of its stickers.
  const restricted=model.moves.map(move=>triad.map(node=>triad.indexOf(move.perm[node])));
  assert(restricted.every(perm=>perm.every(node=>node>=0)),'axial piece must form a closed orbit');
  const group=enumerateGroup(3,restricted);assert.equal(group.length,3);
  for(let a=0;a<3;a++)for(let b=0;b<3;b++)if(a!==b){
   assert(!group.some(g=>g.permutation[a]===b&&g.permutation[b]===a),'a 120-degree rotation cannot transpose a pair');
   assert.equal(eligibilityStatus(result,triad[a],triad[b]),2);
  }
 }
 for(let node=0;node<model.degree;node++)assert.equal(eligibilityStatus(result,node),axial.has(node)?2:1);
 // A reused analyzer must fully release prior hold constraints, while keeping
 // genuine mechanical restrictions when the UI asks again after Clear all.
 const held=analyzer.analyze({protected:[0,1,2,6,7,8,12,13,14,18,19,20]});
 assert.equal(held.status,'complete');assert([...held.firstStatus].every(status=>status===2));
 const cleared=analyzer.analyze({protected:[]});
 assert.deepEqual(cleared.protectedNodes,[]);assert.deepEqual(cleared.firstStatus,result.firstStatus);
 assert.deepEqual(cleared.knownPairs,result.knownPairs);assert.deepEqual(cleared.feasiblePairs,result.feasiblePairs);
});
test('Megaminx without holds excludes its twelve permanently fixed centers and allows every other A',()=>{
 const model=require('../data/megaminx.json'),result=new EligibilityAnalyzer(model).analyze({protected:[]});
 assert.equal(result.status,'complete');
 const fixed=Array.from({length:model.degree},(_,node)=>node).filter(node=>model.moves.every(move=>move.perm[node]===node));
 assert.deepEqual(fixed,Array.from({length:12},(_,face)=>face*11));
 for(let node=0;node<model.degree;node++){
  assert.equal(eligibilityStatus(result,node),fixed.includes(node)?2:1);
  if(fixed.includes(node))for(let partner=0;partner<model.degree;partner++)assert.equal(eligibilityStatus(result,node,partner),2);
 }
});
