#!/usr/bin/env node
'use strict';
// Replay finished benchmark witnesses in isolated copies of the actual Atlas
// engines. This does not call the search solver or mutate the website.
const fs=require('node:fs'),path=require('node:path');
const {loadSnapshot,fixedAdapter,shapeAdapter}=require('./export-models.cjs');
const {mapSnapshot}=require('../src/atlas-adapter.cjs');
const root=path.resolve(__dirname,'..'),input=path.resolve(process.argv[2]||path.join(root,'benchmarks.json'));
const output=path.resolve(process.argv[3]||path.join(root,'solution-validation.json'));
const rows=JSON.parse(fs.readFileSync(input,'utf8')),cache=new Map(),reports=[];
function setup(id){if(!cache.has(id)){const model=JSON.parse(fs.readFileSync(path.join(root,'data',id+'.json'))),source=loadSnapshot(id),adapter=model.requiresOccupiedState?shapeAdapter(source):fixedAdapter(source);cache.set(id,{model,source,adapter});}return cache.get(id);}
for(const [rowIndex,row]of rows.entries()){
 if(row.status!=='solved')continue;
 try{
  const {model,adapter}=setup(row.puzzle);adapter.reset();
  const before=mapSnapshot(model,{stickers:adapter.getState()});
  const [a,b]=row.request.swap,protectedNodes=row.request.mode==='exact_swap'?before.occupiedNodes.filter(n=>n!==a&&n!==b):row.request.protected||[];
  if(before.nodeToSticker[a]===undefined||before.nodeToSticker[b]===undefined)throw Error('Endpoint is not occupied in initial benchmark state');
  if(!Array.isArray(row.moveIndices)||row.moveIndices.length!==row.moveCount)throw Error('Missing/malformed recorded witness');
  const protectedStickers=protectedNodes.map(n=>{if(before.nodeToSticker[n]===undefined)throw Error('Protected node is not occupied');return[before.nodeToSticker[n],n];});
  const checkProtected=state=>protectedStickers.every(([id,n])=>state.stickerToNode[id]===n);
  for(const i of row.moveIndices){const move=model.moves[i];if(!move)throw Error('Witness uses unknown move');adapter.apply(move.engineMove);if(row.request.protection==='throughout'&&!checkProtected(mapSnapshot(model,{stickers:adapter.getState()})))throw Error('Protected node moved during witness');}
  const after=mapSnapshot(model,{stickers:adapter.getState()});
  if(after.stickerToNode[before.nodeToSticker[a]]!==b||after.stickerToNode[before.nodeToSticker[b]]!==a)throw Error('Endpoints not swapped in original engine');
  if(!checkProtected(after))throw Error('Protected physical sticker did not return');
  const changed=before.occupiedNodes.filter(n=>after.stickerToNode[before.nodeToSticker[n]]!==n);
  if(row.request.mode==='exact_swap'&&changed.length!==2)throw Error('Extra physical node moved during an exact swap');
  reports.push({rowIndex,puzzle:row.puzzle,query:row.request.label,passed:true,moves:row.moveIndices.length,protectedNodes:protectedNodes.length,changedPhysicalNodes:changed.length,expandedPoseDomain:!!model.requiresOccupiedState,engineHash:model.adapter.source.sha256});
 }catch(e){reports.push({rowIndex,puzzle:row.puzzle,query:row.request.label,passed:false,reason:e.message});}
}
const failed=reports.filter(r=>!r.passed),result={schemaVersion:1,benchmarkFile:path.basename(input),benchmarkRows:rows.length,solvedRows:rows.filter(r=>r.status==='solved').length,verified:reports.length-failed.length,failed:failed.length,totalEngineMoveApplications:reports.reduce((s,r)=>s+(r.moves||0),0),replayFrom:'Solved engine state; requests and generated witness indices copied from benchmark. This checks endpoint semantics, not independent shortestness.',reports};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
process.stdout.write(JSON.stringify({verified:result.verified,failed:result.failed,engineMoves:result.totalEngineMoveApplications,output})+'\n');
if(failed.length){process.stderr.write(JSON.stringify(failed,null,2)+'\n');process.exitCode=1;}
