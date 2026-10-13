'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {compileColor,verifyColorCache,replay,pairsOf}=require('../tools/precompute-color.cjs');
const manifest=require('../data/manifest.json');

test('all 34 color catalogues exactly replay legal words within the storage budget',()=>{
 let bytes=0,operations=0;
 assert.equal(manifest.models.length,34);
 for(const info of manifest.models){
  const model=require('../data/'+info.id+'.json'),cache=require('../data/color-solver/'+info.id+'.json');
  const result=verifyColorCache(model,cache),size=Buffer.byteLength(JSON.stringify(cache));
  assert(result.verifiedWords>0,info.id+': missing useful operations');
  assert(size<=2*1024*1024,info.id+': oversized catalogue');
  assert(cache.operations.every(op=>op.word.length<=6));
  for(let i=1;i<cache.operations.length;i++)assert(cache.operations[i-1].word.length<=cache.operations[i].word.length,info.id+': words not shortest-first');
  bytes+=size;operations+=result.verifiedWords;
 }
 assert(bytes<=20*1024*1024);assert(operations>10000);
});
test('coupled swap catalogue preserves same-colored held nodes while changing sticker identity',()=>{
 const model={id:'coupled',degree:4,moves:[{name:'X',perm:[1,0,3,2]}]},result=compileColor(model),operation=result.cache.operations[0],p=replay(model,operation.word);
 const colors=['red','blue','green','green'],holds=[2,3],after=[];
 p.forEach((to,from)=>after[to]=colors[from]);
 assert.deepEqual(pairsOf(p),[[0,1],[2,3]]);
 assert(holds.every(h=>after[h]===colors[h]));
 assert(holds.some(h=>p[h]!==h));
 assert.equal(operation.word.length,1);
});
test('cache validation rejects changed sparse mappings and model signatures',()=>{
 const model=require('../data/cube2.json'),cache=structuredClone(require('../data/color-solver/cube2.json'));
 cache.operations[0].support[1]=cache.operations[0].support[0];
 assert.throws(()=>verifyColorCache(model,cache),/Sparse support/);
 const other=structuredClone(require('../data/color-solver/cube2.json'));other.modelSignature='wrong';
 assert.throws(()=>verifyColorCache(model,other),/Catalogue\/model mismatch/);
});
test('precompute is deterministic, deduplicated, and retains shortest generator representations',()=>{
 const model={id:'four',degree:4,moves:[{name:'R',perm:[1,2,3,0]},{name:"R'",perm:[3,0,1,2]},{name:'R2',perm:[2,3,0,1]}]};
 const a=compileColor(model),b=compileColor(model);
 assert.deepEqual(a,b);assert.equal(a.cache.operations.length,1);assert.deepEqual(a.cache.operations[0].word,[2]);
});
