#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {loadSnapshot}=require('./export-models.cjs');
const {mapSnapshot}=require('../src/atlas-adapter.cjs');
const {replay,pairsOf,verifyColorCache}=require('./precompute-color.cjs');
const {applySequence,solveSync,verify}=require('../src/index.cjs');
const root=path.resolve(__dirname,'..');
function initialColors(model){
 const a=loadSnapshot(model.id),stickers=a.model?a.model.stickerState:a.engine.makeSolved(),mapping=mapSnapshot(model,stickers),colors=new Array(model.degree).fill(null);
 for(const s of stickers){if(typeof s.color!=='string')throw Error('Missing sticker color');colors[mapping.stickerToNode[String(s.id)]]=s.color;}
 return colors;
}
function findWitness(model,cache,colors){
 for(const op of cache.operations){
  const p=replay(model,op.word),after=applySequence(model,colors,op.word),pairs=pairsOf(p);
  for(const swap of pairs){
   if(swap.some(i=>colors[i]===null)||colors[swap[0]]===colors[swap[1]])continue;
   const protectedNodes=colors.map((c,i)=>c!==null&&!swap.includes(i)&&c===after[i]?i:-1).filter(i=>i>=0),movedHolds=protectedNodes.filter(i=>p[i]!==i);
   if(!movedHolds.length)continue;
   const occupiedNodes=colors.map((c,i)=>c!==null?i:-1).filter(i=>i>=0),request={swap,protected:protectedNodes,occupiedNodes,holdSemantics:'color',colorByNode:colors,mode:'protected_swap',protection:'endpoint'};
   if(!verify(model,request,op.word))throw Error('Candidate does not satisfy color endpoint constraints');
   if(verify(model,{...request,holdSemantics:'sticker'},op.word))throw Error('Supposed relaxation witness does not move held sticker identities');
   return{request,word:op.word,movedHolds};
  }
 }
 return null;
}
function main(){
 const manifest=require('../data/manifest.json'),reports=[];
 for(const info of manifest.models){
  const model=require('../data/'+info.id+'.json'),cache=require('../data/color-solver/'+info.id+'.json');verifyColorCache(model,cache);
  let colors=initialColors(model),seed=123456789;const cases=[];
  for(const steps of [0,12,28]){
   const scramble=[];for(let i=0;i<steps;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;scramble.push(seed%model.moves.length);}colors=applySequence(model,colors,scramble);
   const found=findWitness(model,cache,colors);if(!found){cases.push({scrambleSteps:steps,witness:false});continue;}
   const strict=solveSync(model,{...found.request,holdSemantics:'sticker'},{maxMs:200,searchMs:30,maxSearchStates:2000,maxOutputMoves:20000,shorten:false});
   cases.push({scrambleSteps:steps,witness:true,swap:found.request.swap,holds:found.request.protected.length,heldStickersReplaced:found.movedHolds.length,colorMoves:found.word.length,word:found.word,strictStatus:strict.status,strictMoves:strict.moveIndices?.length,strictReason:strict.reason,strictMs:Math.round(strict.stats?.totalMs??0)});
  }
  const row={id:info.id,cases};reports.push(row);console.log(JSON.stringify(row));
 }
 const cases=reports.flatMap(x=>x.cases),summary={puzzles:reports.length,puzzlesWithWitness:reports.filter(x=>x.cases.some(c=>c.witness)).length,colorWitnesses:cases.filter(x=>x.witness).length,strictImpossible:cases.filter(x=>x.strictStatus==='impossible').length,strictUnknown:cases.filter(x=>x.strictStatus==='unknown').length,strictSolved:cases.filter(x=>x.strictStatus==='solved').length,shorterThanStrict:cases.filter(x=>x.strictStatus==='solved'&&x.colorMoves<x.strictMoves).length};
 const report={summary,notes:['Constructed real-puzzle endpoint-color witnesses; not a representative user-request distribution.','Strict comparison capped at 200 ms per request; unknown is not impossible.','Color witness replaces one or more held sticker identities with equal-colored stickers; A/B sticker identities exchange exactly.'],models:reports};
 fs.writeFileSync(path.join(root,'data/color-solver/verification-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(summary));
}
if(require.main===module)main();
module.exports={initialColors,findWitness};
