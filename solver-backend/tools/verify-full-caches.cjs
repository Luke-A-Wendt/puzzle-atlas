'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {compileModel,identity,compose,inverse}=require('../src/group.cjs');
const {modelSignature,solveFull}=require('../src/full-solve.cjs');
const manifest=require('../data/manifest.json'),reports=[];
for(const info of manifest.models){
 const m=require('../data/'+info.id+'.json'),cache=require('../data/full-solver/'+info.id+'.json');if(cache.status!=='ready'){reports.push({id:info.id,status:cache.status,reason:cache.reason});continue;}
 const start=performance.now(),compiled=compileModel(m),perms=[identity(m.degree)],inverses=[],lengths=[0];
 assert.equal(cache.modelSignature,modelSignature(m));assert.deepEqual([...cache.base].sort((a,b)=>a-b),Array.from({length:m.degree},(_,i)=>i));
 const term=ref=>ref<0?(inverses[-ref]??=inverse(perms[-ref])):perms[ref];
 for(let i=1;i<cache.words.length;i++){const word=cache.words[i];assert(word.length===1||word.length===2);if(word.length===1){assert(compiled.moves[word[0]]);perms[i]=compiled.moves[word[0]].perm;lengths[i]=1;}else{assert(word.every(x=>Number.isInteger(x)&&Math.abs(x)<i));perms[i]=compose(term(word[0]),term(word[1]));lengths[i]=lengths[Math.abs(word[0])]+lengths[Math.abs(word[1])];}}
 let representatives=0,upperBound=0;for(let k=0;k<cache.levels.length;k++){const l=cache.levels[k];assert.equal(l.base,cache.base[k]);let max=0;for(const [dest,word,stored]of l.entries){const p=term(word);assert.equal(p[l.base],dest);for(let j=0;j<k;j++)assert.equal(p[cache.base[j]],cache.base[j]);assert.deepEqual(Array.from(p),stored);max=Math.max(max,lengths[Math.abs(word)]);representatives++;}upperBound+=max;}
 assert.equal(upperBound,cache.stats.optimization.solutionLengthUpperBound);
 const home=Object.fromEntries((m.initialOccupied??Array.from({length:m.degree},(_,i)=>i)).map((x,i)=>[String(i),x])),samples=[];
 for(let trial=0;trial<3;trial++){const current={...home};let seed=(123456789+trial*7297)>>>0;for(let k=0;k<30;k++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;for(const id in current)current[id]=m.moves[seed%m.moves.length].perm[current[id]];}const result=solveFull(m,{homeBySticker:home,currentBySticker:current},{cache,maxMs:30000,maxOutputMoves:20000,shorten:false});assert.equal(result.status,'solved',info.id+':'+result.reason);const replay={...current};for(const stage of result.stages){let p=identity(m.degree);for(const mi of stage.moveIndices)p=compose(p,compiled.moves[mi].perm);assert(stage.protectedNodes.every(x=>p[x]===x));assert.equal(p[stage.sourceNode],stage.targetNode);for(const id in replay)replay[id]=p[replay[id]];}assert.deepEqual(replay,home);assert(result.moveIndices.length<=upperBound);samples.push({moves:result.moveIndices.length,stages:result.stages.length,planningMs:result.stats.elapsedMs});}
 const row={id:info.id,status:'verified',representatives,wordNodes:cache.words.length,solutionLengthUpperBound:upperBound,samples,bytes:fs.statSync(path.join(__dirname,'../data/full-solver',info.id+'.json')).size,validationMs:performance.now()-start};reports.push(row);console.log(JSON.stringify(row));
}
fs.writeFileSync(path.join(__dirname,'../data/full-solver/validation.json'),JSON.stringify({schemaVersion:1,models:reports},null,2));
