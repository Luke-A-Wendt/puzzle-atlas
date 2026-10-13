'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {listModels,loadModel,solveRequest}=require('../src/service.cjs');
const {createServer}=require('../tools/server.cjs');
test('catalog and service produce engine commands for a verified solution',async()=>{
 assert.equal(listModels().length,28);
 assert.throws(()=>loadModel('../package'));
 const model=loadModel('cube2');
 let pair;
 for(const move of model.moves){pair=move.perm.map((b,a)=>a!==b&&move.perm[b]===a?[a,b]:null).find(Boolean);if(pair)break;}
 const r=await solveRequest({modelId:'cube2',request:{protected:[],swap:pair},options:{maxMs:1000}});
 assert.equal(r.status,'solved');assert.equal(r.verified,true);assert.equal(r.optimal,true);
 assert.equal(r.engineMoves.length,r.moveIndices.length);assert.equal(r.modelFingerprint.length,64);
 assert.equal((await solveRequest({modelId:'unknown',request:{}})).status,'invalid');
});
test('local HTTP harness supports solve and rejects browser origins',async()=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const base=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await (await fetch(base+'/models')).json()).length,28);
  assert.equal((await fetch(base+'/models',{headers:{Origin:'https://example.test'}})).status,403);
  const r=await fetch(base+'/solve',{method:'POST',body:JSON.stringify({modelId:'cube2',request:{swap:[0,1],protected:[]},options:{maxMs:1000}})});
  assert.equal(r.status,200);assert.ok(['solved','impossible','unknown'].includes((await r.json()).status));
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
