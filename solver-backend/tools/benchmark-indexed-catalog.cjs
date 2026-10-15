#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {catalogWitness,verifyColorWitness}=require('../src/color-solve.cjs');
const {initialColors}=require('./verify-color-precompute.cjs');
const {pairsOf,replay}=require('./precompute-color.cjs');
const {modelSignature}=require('../src/full-solve.cjs');
const {macroIndex}=require('../src/macro-index.cjs');
// Deliberately preserve the previous full-scan lookup for an apples-to-apples
// comparison on the same catalog and requests. The new cache coverage test is
// reported separately, so a speed claim does not hide a changed request set.
function linear(model,request,cache){
 if(cache.modelSignature!==modelSignature(model))throw Error('Mismatch');
 const [a,b]=request.swap,held=new Set(request.protected),colors=request.colorByNode;let best=null,operations=0;
 for(const op of cache.operations){operations++;if(best&&op.word.length>=best.length)continue;let pa=a,pb=b,match=true;
  for(let i=0;i<op.support.length;i+=2){const x=op.support[i],y=op.support[i+1];if(x===a)pa=y;if(x===b)pb=y;if(held.has(y)&&colors[x]!==colors[y]){match=false;break;}}
  if(match&&pa===b&&pb===a&&verifyColorWitness(model,request,op.word)){best=op.word;if(best.length===1)break;}
 }return {word:best,operations};
}
function requestsFor(model,cache,colors,limit=24,exclude=new Set()){
 const operations=cache.operations.filter(op=>!exclude.has(op.support.join(','))),requests=[],seen=new Set();
 for(let k=0;k<Math.min(limit*10,operations.length)&&requests.length<limit;k++){
  const op=operations[Math.floor(k*operations.length/Math.min(limit*10,operations.length))],perm=replay(model,op.word),pairs=pairsOf(perm);
  for(const swap of pairs){if(swap.some(n=>colors[n]===null)||colors[swap[0]]===colors[swap[1]])continue;
   const next=[];perm.forEach((to,from)=>next[to]=colors[from]);const held=colors.flatMap((color,n)=>color!==null&&!swap.includes(n)&&next[n]===color?[n]:[]),key=[...swap,-1,...held].join(',');if(seen.has(key))continue;seen.add(key);
   requests.push({swap,protected:held,colorByNode:colors,holdSemantics:'color',mode:'protected_swap',protection:'endpoint'});break;
  }
 }return requests;
}
function main(){
 const baselineDirectory=path.resolve(process.argv[2]??path.join(__dirname,'../data/color-solver')),rows=[];
 for(const {id}of require('../data/manifest.json').models){
  const model=require('../data/'+id+'.json'),before=JSON.parse(fs.readFileSync(path.join(baselineDirectory,id+'.json'))),after=require('../data/color-solver/'+id+'.json'),colors=initialColors(model),queries=requestsFor(model,before,colors),indexStarted=performance.now(),index=macroIndex(before),indexMs=performance.now()-indexStarted;
  let linearMs=0,indexedMs=0,linearOperations=0,indexedOperations=0;
  for(const request of queries){let start=performance.now();const old=linear(model,request,before);linearMs+=performance.now()-start;start=performance.now();const indexed=catalogWitness(model,request,before,{deadline:Infinity});indexedMs+=performance.now()-start;
   assert.equal(indexed.status,old.word?'solved':'unknown');if(old.word){assert.equal(indexed.moveIndices.length,old.word.length);assert(verifyColorWitness(model,request,indexed.moveIndices));}
   linearOperations+=old.operations;indexedOperations+=indexed.stats.catalogOperations;
  }
  const extraQueries=requestsFor(model,after,colors,40,new Set(before.operations.map(op=>op.support.join(','))));let newReady=0,shorter=0,oldSolved=0;
  const examples=[];
  for(const request of extraQueries){const old=catalogWitness(model,request,before,{deadline:Infinity}),next=catalogWitness(model,request,after,{deadline:Infinity});assert.equal(next.status,'solved');assert(verifyColorWitness(model,request,next.moveIndices));
   if(old.status==='solved'){oldSolved++;assert(next.moveIndices.length<=old.moveIndices.length);if(next.moveIndices.length<old.moveIndices.length)shorter++;}else newReady++;
   if(examples.length<2&&(old.status!=='solved'||next.moveIndices.length<old.moveIndices.length))examples.push({swap:request.swap,holds:request.protected,oldMoves:old.moveIndices?.length??null,moves:next.moveIndices.length,word:next.moveIndices});
  }
  const row={id,lookupCases:queries.length,linearOperations,indexedOperations,linearMs,indexedMs,indexBuildMs:indexMs,indexBytesEstimate:index.estimatedBytes,expandedCases:extraQueries.length,newReady,shorter,oldSolved,examples};rows.push(row);console.log(JSON.stringify(row));
 }
 const sum=k=>rows.reduce((n,r)=>n+r[k],0),summary={puzzles:rows.length,lookupCases:sum('lookupCases'),linearOperations:sum('linearOperations'),indexedOperations:sum('indexedOperations'),linearMs:sum('linearMs'),indexedMs:sum('indexedMs'),indexBuildMs:sum('indexBuildMs'),expandedCases:sum('expandedCases'),newReady:sum('newReady'),shorter:sum('shorter'),puzzlesWithNewReady:rows.filter(r=>r.newReady).length};
 const report={schemaVersion:1,notes:['Deterministic constructed requests test catalog capabilities, not a representative user-request distribution.','Lookup timing excludes one-time index construction, reported separately.','A catalog miss is unknown, never proof of impossibility.','Every accepted operation was replayed against the exact legal move model.'],summary,models:rows};
 fs.writeFileSync(path.join(__dirname,'../data/color-solver/index-benchmark.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(summary));
}
if(require.main===module)main();
module.exports={linear,requestsFor};
