'use strict';
// Reproducible comparisons. Input states come from the actual puzzle engines;
// plan verification is separate from the optimizer and reads no move history.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {solveFull}=require('../src/full-solve.cjs'),{autoRequestFromSnapshot,verifyAutoPlan,solvedProgress}=require('../src/auto-adapter.cjs');
const root=path.resolve(__dirname,'../..'),games=path.join(root,'dist/games'),plain=x=>JSON.parse(JSON.stringify(x));
function engineFor(model){
 const spec=model.adapter.source,ctx={CUBE_SIZE:Number(model.id.slice(4))};ctx.window=ctx;vm.createContext(ctx);
 let code=fs.readFileSync(path.join(games,path.basename(spec.file)),'utf8');
 if(spec.file.endsWith('.html'))code=[...code.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>new RegExp('root\\.'+spec.rootName+'\\s*=').test(s));
 vm.runInContext(code,ctx);const E=ctx[spec.rootName],M=spec.kind==='model'?E.create(model.id):null;let state=M?M.stickerState:E.makeSolved();
 return{get:()=>plain(M?M.stickerState:state),apply:index=>{if(M)M.applyMove(model.moves[index].engineMove);else state=E.applyMove(state,model.moves[index].engineMove);}};
}
const seeds=[123456789,9173,20261013],report={schemaVersion:1,description:'30 legal moves from solved per seed, move journal omitted, default bounded color optimizer versus identity baseline; all witnesses independently verified',seeds,cases:[]};
for(const {id}of require('../data/manifest.json').models){
 const model=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models',id+'.json'),'utf8')),cache=require('../data/full-solver/'+id+'.json');
 for(const seedValue of seeds){const engine=engineFor(model),solved=engine.get();
  // Match generated metadata while allowing this tool to run before rebuilding.
  model.colorBySticker=Object.fromEntries(solved.map(s=>[String(s.id),String(s.color)]));model.colorRelaxationSafe=!model.requiresOccupiedState&&!['mirror','homer'].includes(id);
  let seed=seedValue;for(let j=0;j<30;j++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;engine.apply(seed%model.moves.length);}
  const snap={stickers:engine.get(),history:[]},request=autoRequestFromSnapshot(model,snap),exact=solveFull(model,request,{cache,maxMs:15000,maxOutputMoves:20000,colorOptimize:false}),color=solveFull(model,request,{cache,maxMs:15000,maxOutputMoves:20000});
  assert.equal(exact.status,'solved',id+' exact '+exact.reason);assert.equal(color.status,'solved',id+' color '+color.reason);assert(verifyAutoPlan(model,snap,exact),id+' exact verify');assert(verifyAutoPlan(model,snap,color),id+' color verify');assert(color.moveIndices.length<=exact.moveIndices.length,id+' regressed moves');assert(color.stages.length<=exact.stages.length,id+' regressed stages');
  // Engine playback per puzzle checks the geometry-facing bridge as well.
  let engineVerified=false;if(seedValue===seeds[0]){for(const index of color.moveIndices)engine.apply(index);assert.equal(solvedProgress(model,engine.get()).solvedCount,model.stickerCount,id+' actual engine endpoint');engineVerified=true;}
  const row={id,seed:seedValue,colorRelaxationSafe:model.colorRelaxationSafe,baselineMoves:exact.moveIndices.length,moves:color.moveIndices.length,baselineStages:exact.stages.length,stages:color.stages.length,baselineMs:exact.stats.elapsedMs,optimizedMs:color.stats.elapsedMs,optimizerMs:color.stats.colorOptimizationMs??0,method:color.method,verified:true,engineVerified};report.cases.push(row);console.log(JSON.stringify(row));
 }
}
const sum=key=>report.cases.reduce((total,c)=>total+c[key],0);report.summary={puzzles:new Set(report.cases.map(c=>c.id)).size,cases:report.cases.length,baselineMoves:sum('baselineMoves'),moves:sum('moves'),baselineStages:sum('baselineStages'),stages:sum('stages'),improvedMoves:report.cases.filter(c=>c.moves<c.baselineMoves).length,improvedStages:report.cases.filter(c=>c.stages<c.baselineStages).length,baselineMs:sum('baselineMs'),optimizedMs:sum('optimizedMs')};
const destination=path.resolve(process.argv[2]||path.join(__dirname,'../data/color-solver/auto-benchmark.json'));fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));
