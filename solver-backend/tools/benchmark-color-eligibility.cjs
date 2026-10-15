#!/usr/bin/env node
'use strict';
// Measures the allocation-sensitive catalog scan behind changing color holds.
// Optional baseline is an earlier copy of src/color-eligibility.cjs. Run both
// implementations in alternating order and require byte-identical witnesses.
// This deliberately isolates the scan from separately timed group analysis.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const current=require('../src/color-eligibility.cjs');
const baselinePath=process.argv[2],destination=process.argv[3];
let baseline=current;
if(baselinePath){const filename=path.resolve(__dirname,'../src/benchmark-baseline.cjs'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m._compile(fs.readFileSync(path.resolve(baselinePath),'utf8'),filename);baseline=m.exports;}
const {initialColors}=require('./verify-color-precompute.cjs'),{applySequence}=require('../src/index.cjs');
function scan(analyzer,colors,holds,exempt){
 const d=analyzer.model.degree,occupied=colors.flatMap((c,i)=>c===null?[]:[i]),held=new Set(holds),bytes=Math.ceil(d*d/8),stats={operations:0,macroTests:0,macroVerifications:0,macroWitnessPairs:0,invalidMacros:0,storageEstimateBytes:bytes*3+d*25,readyPairs:0,readyWitnessBytes:0};
 const result={degree:d,protectedNodes:holds,occupiedNodes:occupied,candidateNodes:exempt?occupied:occupied.filter(x=>!held.has(x)),colorByNode:colors,exemptSwapEndpoints:exempt,protection:'endpoint',knownPairs:new Uint8Array(bytes),feasiblePairs:new Uint8Array(bytes),firstStatus:new Uint8Array(d),readyPairs:new Uint8Array(bytes),readyFirstStatus:new Uint8Array(d),readyWitnesses:[]};
 const ctx={stats,config:{maxStorageBytes:48*1024*1024},check(){},tick(n=1){stats.operations+=n;}};
 const start=performance.now();analyzer.macroWitnesses(result,ctx);const ms=performance.now()-start;
 return{ms,result,stats};
}
const rows=[];
for(const {id}of require('../data/manifest.json').models){
 const model=require('../data/'+id+'.json'),cache=require('../data/color-solver/'+id+'.json'),old=new baseline.ColorEligibilityAnalyzer(model,null,{colorCache:cache}),now=new current.ColorEligibilityAnalyzer(model,null,{colorCache:cache});
 const solved=initialColors(model);let seed=20261014;const word=Array.from({length:18},()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%model.moves.length;}),scrambled=applySequence(model,solved,word);
 for(const [state,colors]of [['solved',solved],['scrambled',scrambled]])for(const fraction of [0,0.25,0.75]){
  const occupied=colors.flatMap((c,i)=>c===null?[]:[i]),holds=occupied.filter((_,i)=>i%4<fraction*4),exempt=true;
  // Warm verification caches once. Timed requests still rescan every macro;
  // they do not use the whole-result request cache.
  const warmOld=scan(old,colors,holds,exempt),warmNow=scan(now,colors,holds,exempt);assert.deepEqual(warmNow.result,warmOld.result,id+' cold result');assert.deepEqual(warmNow.stats,warmOld.stats,id+' cold work');
  const before=[],after=[];
  for(let round=0;round<4;round++){
   let a,b;if(round%2){b=scan(now,colors,holds,exempt);a=scan(old,colors,holds,exempt);}else{a=scan(old,colors,holds,exempt);b=scan(now,colors,holds,exempt);}
   assert.deepEqual(b.result,a.result,id+' witness equivalence');assert.deepEqual(b.stats,a.stats,id+' operation equivalence');before.push(a.ms);after.push(b.ms);
  }
  const median=a=>a.slice().sort((x,y)=>x-y).slice(1,3).reduce((a,b)=>a+b,0)/2;
  rows.push({id,state,holdFraction:fraction,operations:cache.operations.length,baselineMs:median(before),optimizedMs:median(after),verified:true});
 }
}
const sum=k=>rows.reduce((s,r)=>s+r[k],0),report={schemaVersion:1,description:'Exact catalog-scan equivalence across all 34 puzzles, solved and 18-move states, 0/25/75% holds, endpoint exemptions enabled; four alternating warmed timings per case. Timings exclude stabilizer analysis and whole-result cache hits.',summary:{puzzles:new Set(rows.map(r=>r.id)).size,cases:rows.length,baselineMs:sum('baselineMs'),optimizedMs:sum('optimizedMs'),witnessesUnchanged:true},cases:rows};report.summary.reductionPercent=100*(1-report.summary.optimizedMs/report.summary.baselineMs);
if(destination)fs.writeFileSync(path.resolve(destination),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary,null,2));
