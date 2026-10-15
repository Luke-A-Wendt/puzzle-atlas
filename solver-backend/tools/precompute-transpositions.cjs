#!/usr/bin/env node
'use strict';
// Exhaust all UNORDERED NODE PAIRS, not puzzle configurations. Membership is
// constant on their generator orbits: g (a b) g^-1 = (g(a) g(b)). Test one
// representative per orbit using the already certified complete group chain.
const fs=require('node:fs'),path=require('node:path');
const {PermutationMembership,transposition,Limit}=require('../src/permutation-membership.cjs');
const {replay,supportOf,pairsOf,verifyColorCache}=require('./precompute-color.cjs');
const root=path.resolve(__dirname,'..');
function auditExactPairs(model,cache){
 const started=performance.now(),d=model.degree,seen=new Uint8Array(d*d),membership=new PermutationMembership(model,cache),orbits=[];
 let possible=0,impossible=0;
 for(let a=0;a<d;a++)for(let b=a+1;b<d;b++){
  const key=a*d+b;if(seen[key])continue;
  const queue=[key];seen[key]=1;
  for(let k=0;k<queue.length;k++){
   const x=Math.floor(queue[k]/d),y=queue[k]%d;
   for(const m of model.moves){const u=m.perm[x],v=m.perm[y],next=Math.min(u,v)*d+Math.max(u,v);if(!seen[next]){seen[next]=1;queue.push(next);}}
  }
  const result=membership.factor(transposition(d,a,b));
  orbits.push({representative:[a,b],pairs:queue.length,member:result.member});
  if(result.member)possible+=queue.length;else impossible+=queue.length;
 }
 return {schemaVersion:1,kind:'exact-transposition-audit',complete:true,modelId:model.id,modelSignature:cache.modelSignature,degree:d,totalPairs:d*(d-1)/2,possible,impossible,unresolved:0,orbits,elapsedMs:performance.now()-started};
}
function addSparseFallbacks(model,cache,catalog,{maxNewOperations=512,maxExtraBytes=512*1024,maxWordLength=1500}={}){
 const membership=new PermutationMembership(model,cache),existing=new Set(catalog.operations.map(op=>op.support.join(','))),seeds=[],candidates=new Map();
 const lookup=new Map(model.moves.map((m,i)=>[m.perm.join(','),i])),inverse=model.moves.map(m=>{const q=[];m.perm.forEach((to,from)=>q[to]=from);return lookup.get(q.join(','));});
 if(inverse.some(x=>x===undefined))throw Error('Move set must include inverses');
 for(const level of cache.levels)for(const entry of level.entries){
  const support=supportOf(entry[2]);if(support.length!==8||pairsOf(entry[2]).length!==2)continue;
  try{const word=membership.expand([entry[1]],{maxOutputMoves:maxWordLength,maxMs:1000});seeds.push({word,support,perm:entry[2]});}catch(e){if(!(e instanceof Limit))throw e;}
 }
 seeds.sort((a,b)=>a.word.length-b.word.length);
 // Short conjugations reposition local exact double exchanges. The cap is a
 // storage choice, not a mathematical completeness or impossibility claim.
 function consider(word,perm){const support=supportOf(perm),key=support.join(',');if(existing.has(key)||word.length>maxWordLength)return;
  const old=candidates.get(key);if(!old||word.length<old.word.length)candidates.set(key,{word,support});
 }
 for(const seed of seeds){
  consider(seed.word,seed.perm);
  for(let i=0;i<model.moves.length;i++){
   const p=model.moves[inverse[i]].perm.map(x=>model.moves[i].perm[seed.perm[x]]);
   consider([inverse[i],...seed.word,i],p);
  }
 }
 const sorted=[...candidates.values()].sort((a,b)=>a.word.length-b.word.length||a.support.join(',').localeCompare(b.support.join(',')));let bytes=0,added=0;
 for(const op of sorted){const size=Buffer.byteLength(JSON.stringify(op))+1;if(added>=maxNewOperations||bytes+size>maxExtraBytes)continue;
  // This independent replay guards word orientation and every sparse entry.
  if(JSON.stringify(supportOf(replay(model,op.word)))!==JSON.stringify(op.support))throw Error('Sparse fallback replay failed');
  catalog.operations.push(op);bytes+=size;added++;
 }
 catalog.operations.sort((a,b)=>a.word.length-b.word.length||a.support.length-b.support.length);
 return {seedRepresentatives:seeds.length,newOperations:added,extraBytes:bytes,omitted:sorted.length-added,maxStoredWordLength:Math.max(0,...catalog.operations.map(x=>x.word.length))};
}
function main(){
 const report={schemaVersion:1,algorithm:'unordered-pair-orbits-complete-chain-membership',models:[],totalPairs:0,possible:0,impossible:0,unresolved:0,newOperations:0,extraBytes:0},catalogReports=[];
 for(const {id}of require('../data/manifest.json').models){
  const model=require('../data/'+id+'.json'),cache=require('../data/full-solver/'+id+'.json');
  // Recompile the small-move catalogue so repeated builds are deterministic.
  const {cache:catalog,report:baseReport}=require('./precompute-color.cjs').compileColor(model),audit=auditExactPairs(model,cache),added=addSparseFallbacks(model,cache,catalog);
  catalog.exactTranspositions=audit;delete audit.elapsedMs;
  const verified=verifyColorCache(model,catalog);
  fs.writeFileSync(path.join(root,'data/color-solver',id+'.json'),JSON.stringify(catalog));
  const row={id,degree:model.degree,totalPairs:audit.totalPairs,pairOrbits:audit.orbits.length,possible:audit.possible,impossible:audit.impossible,unresolved:audit.unresolved,...added};
  report.models.push(row);for(const k of ['totalPairs','possible','impossible','unresolved','newOperations','extraBytes'])report[k]+=row[k];console.log(JSON.stringify(row));
  catalogReports.push({...baseReport,...verified,operations:catalog.operations.length,bytes:Buffer.byteLength(JSON.stringify(catalog)),addedSparseFallbacks:added.newOperations});
 }
 fs.writeFileSync(path.join(root,'data/color-solver/transposition-report.json'),JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync(path.join(root,'data/color-solver/report.json'),JSON.stringify({schemaVersion:1,algorithm:'short-words-plus-complete-chain-sparse-double-swaps',maxWordLength:Math.max(...report.models.map(x=>x.maxStoredWordLength)),maxBytesPerModel:3*1024*1024,maxTotalBytes:20*1024*1024,totalBytes:catalogReports.reduce((n,x)=>n+x.bytes,0),models:catalogReports},null,2)+'\n');
}
if(require.main===module)main();
module.exports={auditExactPairs,addSparseFallbacks};
