'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {findExchangeWitness}=require('../tools/verify-additions.cjs');
const {verify}=require('../src/index.cjs');
const inverse=p=>{const q=[];p.forEach((x,i)=>q[x]=i);return q;};
function model(perms){return{degree:perms[0].length,moves:perms.flatMap(p=>[p,inverse(p)]).map((perm,i)=>({name:String(i),perm}))};}
test('acceptance witness handles generators of order three without any primitive two-cycle',()=>{
 const m=model([[1,2,0,3],[0,2,3,1]]);assert(m.moves.every(({perm:p})=>!p.some((b,a)=>a!==b&&p[b]===a)));
 const w=findExchangeWitness(m,[0,1,2,3]);assert.equal(w.status,'solved');assert(w.moveIndices.length>1);
 assert.equal(verify(m,{swap:w.swap,protected:[]},w.moveIndices),true);
});
test('acceptance witness certifies non-exchangeable three-cycle orbit',()=>{
 const w=findExchangeWitness(model([[1,2,0]]),[0,1,2]);assert.equal(w.status,'impossible');assert.equal(w.reason,'all_occupied_ordered_pair_orbits_exhausted');assert.equal(w.stats.states,6);
});
test('expanded-domain candidates remain occupied while legal paths may use empty addresses',()=>{
 const m=model([[1,2,3,0]]),w=findExchangeWitness(m,[0,2]);assert.equal(w.status,'solved');assert.deepEqual(w.swap,[0,2]);assert.equal(w.moveIndices.length,2);
 assert.equal(verify(m,{swap:w.swap,protected:[]},w.moveIndices),true);
});
test('discovery budget exhaustion stays unknown rather than reporting an illegal swap',()=>{
 const w=findExchangeWitness(model([[1,2,3,0]]),[0,2],{maxStates:1});assert.equal(w.status,'unknown');assert.equal(w.reason,'witness_state_limit');
});
test('disjoint occupied point orbits certify impossibility without visiting ordered pairs',()=>{
 const w=findExchangeWitness(model([[1,2,0,4,5,3]]),[0,3]);assert.equal(w.status,'impossible');assert.equal(w.stats.states,0);assert.equal(w.stats.pointOrbits,2);
});
