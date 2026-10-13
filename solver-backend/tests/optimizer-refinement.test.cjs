'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {precomputeFull}=require('../src/full-solve.cjs'),{compose,inverse}=require('../src/group.cjs');
const {optimizer}=require('../tools/optimize-cache.cjs'),{verifyChanges,profile}=require('../tools/refine-caches.cjs');
test('commuting-tail word reduction preserves the entire permutation',()=>{
 const a=[2,1,0,3],b=[1,0,2,3],tail=[0,1,3,2],c=Array.from(compose(a,b));
 const model={degree:4,stickerCount:4,moves:[a,b,tail,c,Array.from(inverse(c))].map((perm,i)=>({name:String(i),perm}))};
 const cache=precomputeFull(model),p=Array.from(compose(compose(a,tail),b)),entry=cache.levels[0].entries.find(e=>e[0]===p[cache.base[0]]);
 // a * tail * b = (a*b) * tail because b commutes with tail. The combined
 // generator a*b need not commute with tail; appending it would be incorrect.
 const la=cache.words.push([0])-1,lt=cache.words.push([2])-1,lb=cache.words.push([1])-1,at=cache.words.push([la,lt])-1,atb=cache.words.push([at,lb])-1;
 entry[1]=atb;entry[2]=p;const before=structuredClone(cache);
 optimizer(model,cache,{maxMs:0,randomSeeds:0});assert(verifyChanges(model,before,cache)>0);
 assert.deepEqual(cache.levels[0].entries.find(e=>e[0]===entry[0])[2],p);
});
test('refinement preserves certified orbit entries and monotone word lengths',()=>{
 const model={degree:4,stickerCount:4,moves:[{name:'a',perm:[1,2,3,0]},{name:'ai',perm:[3,0,1,2]},{name:'b',perm:[1,0,2,3]}]};
 const before=precomputeFull(model),after=structuredClone(before);optimizer(model,after,{maxMs:200,randomSeeds:50,maxGenerators:100});
 verifyChanges(model,before,after);assert(profile(model,after).upperBound<=profile(model,before).upperBound);
});
