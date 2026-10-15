#!/usr/bin/env node
'use strict';
// Bounded, scoped reproduction of the 9×9/10×10 caches. These are legal-word
// stabilizer caches and short algebraic macros, never configuration tables.
const fs=require('node:fs'),path=require('node:path');
const group=require('../src/group.cjs'),createContext=group.makeContext;
// Progress is a build-tool concern; production group code stays unchanged.
group.makeContext=options=>{const ctx=createContext(options),check=ctx.check,started=performance.now();let last=started;ctx.check=force=>{const now=performance.now();if(now-last>=30000){last=now;console.log(JSON.stringify({phase:'closure',elapsedMs:Math.round(now-started),...ctx.stats}));}return check(force);};return ctx;};
const {precomputeFull}=require('../src/full-solve.cjs');
const {optimizer}=require('./optimize-cache.cjs');
const {compileColor}=require('./precompute-color.cjs');
const ids=process.argv.slice(2).length?process.argv.slice(2):['cube9','cube10'];
if(ids.some(id=>!['cube9','cube10'].includes(id)))throw Error('Choose cube9 and/or cube10');
const reports=[];
for(const id of ids){
 const model=require('../data/'+id+'.json');
 const cache=precomputeFull(model,{algorithm:'unweighted',maxMs:id==='cube10'?1200000:600000,maxStorageBytes:256*1024*1024,maxDagNodes:1500000,maxSchreierTests:80000000});
 if(cache.status!=='ready')throw Error(id+': incomplete precompute ('+cache.reason+')');
 optimizer(model,cache,{maxMs:30000,seed:20261015,maxInitialWordLength:4000});
 // A bounded second pass avoids long representatives left after initial
 // closure. It changes witnesses only: the certified stabilizer orbits remain.
 optimizer(model,cache,{maxMs:60000,seed:20261016,maxInitialWordLength:4000});
 if(cache.stats.optimization.solutionLengthUpperBound>20000||cache.stats.optimization.unshortenedRepresentatives)throw Error(id+': representative budget not met');
 const file=path.join(__dirname,'../data/full-solver',id+'.json');
 fs.writeFileSync(file,JSON.stringify(cache));
 const color=compileColor(model);fs.writeFileSync(path.join(__dirname,'../data/color-solver',id+'.json'),JSON.stringify(color.cache));
 const report={id,fullBytes:fs.statSync(file).size,fullStats:cache.stats,color:color.report};reports.push(report);console.log(JSON.stringify(report));
}
fs.writeFileSync(path.join(__dirname,'../data/full-solver/large-cubes-report.json'),JSON.stringify({schemaVersion:1,models:reports},null,2)+'\n');
