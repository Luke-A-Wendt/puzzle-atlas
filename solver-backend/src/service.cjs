'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {Solver}=require('./index.cjs');
const {requestFromSnapshot}=require('./atlas-adapter.cjs');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'data/manifest.json'),'utf8'));
const catalog=new Map(manifest.models.map(m=>[m.id,m]));
// Three resident solver caches, each capped at 8 MiB; no subset table.
const solvers=new Map();
function listModels(){return manifest.models.map(({id,name,degree,stickerCount,moves,representation,notes})=>({id,name,degree,stickerCount,moves,representation,notes}));}
function loadModel(id){if(typeof id!=='string'||!catalog.has(id))throw Error('Unknown modelId');return JSON.parse(fs.readFileSync(path.join(root,'data',id+'.json'),'utf8'));}
function getSolver(id){
 if(solvers.has(id)){const s=solvers.get(id);solvers.delete(id);solvers.set(id,s);return s;}
 const s=new Solver(loadModel(id),{cacheBytes:8*1024*1024});
 while(solvers.size>=3)solvers.delete(solvers.keys().next().value);
 solvers.set(id,s);return s;
}
async function solveRequest(payload){
 try{
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Expected a JSON object');
  const solver=getSolver(payload.modelId);
  if(payload.snapshot!==undefined&&payload.request!==undefined)throw Error('Use request or snapshot/selection, not both');
  const request=payload.snapshot!==undefined?requestFromSnapshot(solver.model,payload.snapshot,payload.selection):payload.request;
  const result=await solver.solve(request,payload.options??{});
  return {...result,modelId:solver.model.id,modelFingerprint:solver.fingerprint,...(request?.requestedMode?{requestedMode:request.requestedMode}:{}),...(result.status==='solved'?{engineMoves:result.moveIndices.map(i=>solver.model.moves[i].engineMove)}:{})};
 }catch(e){return {status:'invalid',reason:e.message,optimal:false};}
}
module.exports={listModels,loadModel,solveRequest};
