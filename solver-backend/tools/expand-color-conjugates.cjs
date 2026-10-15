#!/usr/bin/env node
'use strict';
// A bounded orbit of short algorithms, not a configuration-space search.
// Matrix conjugation Q W Q^-1 moves the support of W through Q without changing its
// cycle structure. Sparse support makes each candidate O(support size).
// The chronological word executes Q^-1, then W, then Q.
const fs=require('node:fs'),path=require('node:path');
const {replay,supportOf,verifyColorCache}=require('./precompute-color.cjs');
function expandConjugates(model,catalog,{maxExtraBytes=256*1024,maxAdded=2000,maxSeeds=128,maxExpansions=6000,maxWordLength=40,depth=2}={}){
 const original=new Map(catalog.operations.map(op=>[op.support.join(','),op])),lookup=new Map(model.moves.map((m,i)=>[m.perm.join(','),i]));
 const inverses=model.moves.map(m=>{const inverse=[];m.perm.forEach((to,from)=>inverse[to]=from);return lookup.get(inverse.join(','));});
 if(inverses.some(x=>x===undefined))throw Error('Conjugation requires inverse-closed vocabulary');
 const minSupport=Math.min(...catalog.operations.map(op=>op.support.length)),supportLimit=Math.max(minSupport,24);
 const seeds=catalog.operations.filter(op=>op.support.length<=supportLimit&&op.word.length<=maxWordLength-2*depth).sort((a,b)=>a.word.length-b.word.length||a.support.length-b.support.length).slice(0,maxSeeds);
 const discovered=new Map(),queue=seeds.map(op=>({...op,depth:0}));let expansions=0;
 for(let at=0;at<queue.length&&expansions<maxExpansions;at++){
  const op=queue[at];if(op.depth>=depth)continue;
  for(let move=0;move<model.moves.length&&expansions<maxExpansions;move++){
   expansions++;const p=model.moves[move].perm,pairs=[];for(let i=0;i<op.support.length;i+=2)pairs.push([p[op.support[i]],p[op.support[i+1]]]);pairs.sort((a,b)=>a[0]-b[0]);
   const support=pairs.flat(),key=support.join(','),word=[inverses[move],...op.word,move],old=original.get(key),prior=discovered.get(key);
   if(old&&old.word.length<=word.length||prior&&prior.word.length<=word.length)continue;
   const candidate={word,support,depth:op.depth+1};discovered.set(key,candidate);if(candidate.depth<depth)queue.push(candidate);
  }
 }
 // Preserve every old witness. New candidates prioritize smaller support, then
 // shorter words; the byte bound never removes established functionality.
 const candidates=[...discovered.values()].sort((a,b)=>(a.support.length+2*a.word.length)-(b.support.length+2*b.word.length)||a.word.length-b.word.length||a.support.join(',').localeCompare(b.support.join(',')));
 let added=0,replaced=0,extraBytes=0;const accepted=[];
 for(const candidate of candidates){const op={word:candidate.word,support:candidate.support},key=op.support.join(','),previous=original.get(key),bytes=Buffer.byteLength(JSON.stringify(op))+1-(previous?Buffer.byteLength(JSON.stringify(previous))+1:0);
  if(added>=maxAdded||extraBytes+bytes>maxExtraBytes)continue;
  if(JSON.stringify(supportOf(replay(model,op.word)))!==JSON.stringify(op.support))throw Error('Conjugate replay mismatch '+model.id);
  if(previous){catalog.operations[catalog.operations.indexOf(previous)]=op;original.set(key,op);replaced++;}else{catalog.operations.push(op);original.set(key,op);added++;}extraBytes+=bytes;accepted.push(op);
 }
 catalog.operations.sort((a,b)=>a.word.length-b.word.length||a.support.length-b.support.length||a.support.join(',').localeCompare(b.support.join(',')));
 return {id:model.id,seeds:seeds.length,expansions,discovered:discovered.size,added,replaced,extraBytes,maxWordLength:Math.max(...catalog.operations.map(op=>op.word.length)),accepted};
}
function main(){const directory=path.join(__dirname,'../data/color-solver'),results=[];
  for(const {id}of require('../data/manifest.json').models){const model=require('../data/'+id+'.json'),file=path.join(directory,id+'.json'),catalog=JSON.parse(fs.readFileSync(file)),before=catalog.operations.length,row=expandConjugates(model,catalog);delete row.accepted;const verified=verifyColorCache(model,catalog);fs.writeFileSync(file,JSON.stringify(catalog));results.push({...row,before,after:catalog.operations.length,bytes:Buffer.byteLength(JSON.stringify(catalog)),...verified});console.log(JSON.stringify(results.at(-1)));}
 const summary={puzzles:results.length,added:results.reduce((n,r)=>n+r.added,0),replaced:results.reduce((n,r)=>n+r.replaced,0),extraBytes:results.reduce((n,r)=>n+r.extraBytes,0),totalBytes:results.reduce((n,r)=>n+r.bytes,0)};
 if(summary.totalBytes>24*1024*1024)throw Error('Aggregate expanded macro cache exceeds 24 MiB');
 fs.writeFileSync(path.join(directory,'conjugacy-report.json'),JSON.stringify({schemaVersion:1,algorithm:'bounded-sparse-support-conjugate-orbits',limits:{depth:2,maxSeeds:128,maxExpansions:6000,maxExtraBytes:256*1024,maxAdded:2000,maxWordLength:40},summary,models:results},null,2)+'\n');
 const reportFile=path.join(directory,'report.json'),report=JSON.parse(fs.readFileSync(reportFile));report.algorithm='short-words-plus-complete-chain-sparse-double-swaps-plus-bounded-conjugacy';report.totalBytes=summary.totalBytes;report.maxWordLength=Math.max(...results.map(r=>r.maxWordLength));report.maxTotalBytes=24*1024*1024;
 for(const row of report.models){const r=results.find(x=>x.id===row.id);if(r)Object.assign(row,{operations:r.after,verifiedWords:r.verifiedWords,bytes:r.bytes,exchangePairs:r.exchangePairs,lengths:r.lengths,maxMovedNodes:r.maxMovedNodes,addedConjugates:r.added,shortenedConjugates:r.replaced});}
 fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(summary));
}
if(require.main===module)main();
module.exports={expandConjugates};
