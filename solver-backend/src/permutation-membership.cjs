'use strict';

// Exact membership against the existing, COMPLETE stabilizer chain. Source ->
// destination convention: compose(a,b) means execute a and then b. A rejection
// certifies only this precise permutation, never its color-equivalence class.
const {identity, inverse, compose, compileModel, Words, makeContext, Limit}=require('./group.cjs');
const {modelSignature}=require('./full-solve.cjs');
class PermutationMembership {
 constructor(model,cache){
  if(cache?.schemaVersion!==1||cache.status!=='ready'||cache.complete!==true||cache.degree!==model.degree||cache.modelSignature!==modelSignature(model)||cache.base.length!==model.degree||new Set(cache.base).size!==model.degree)throw Error('Complete matching stabilizer cache required');
  this.model=model;this.cache=cache;
  this.levels=cache.levels.map((level,i)=>{
   if(level.base!==cache.base[i])throw Error('Stabilizer cache base mismatch');
   return {base:level.base,entries:new Map(level.entries.map(e=>[e[0],{word:e[1],perm:e[2]}]))};
  });
 }
 factor(target){
  const d=this.model.degree;if(target.length!==d||new Set(target).size!==d||Array.from(target).some(x=>!Number.isInteger(x)||x<0||x>=d))throw Error('Invalid target permutation');
  let remainder=Uint32Array.from(target);const parts=[];
  for(const level of this.levels){
   const image=remainder[level.base];if(image===level.base)continue;
   const entry=level.entries.get(image);if(!entry)return {member:false,proof:'complete_stabilizer_chain',failedBase:level.base};
   entry.inverse??=inverse(entry.perm);remainder=compose(remainder,entry.inverse);parts.push(entry.word);
  }
  if(!remainder.every((x,i)=>x===i))throw Error('Incomplete stabilizer residue');
  // target t1^-1 ... tk^-1 = I, so target = tk ... t1.
  return {member:true,parts:parts.reverse(),proof:'complete_stabilizer_chain'};
 }
 expand(parts,{maxMs=2000,maxOutputMoves=5000}={}){
  const compiled=compileModel(this.model),words=new Words(compiled.moves,makeContext({maxMs,maxOutputMoves,maxDagNodes:Math.max(300000,this.cache.words.length+1000)}));
  words.nodes=[null];
  for(let i=1;i<this.cache.words.length;i++){
   const row=this.cache.words[i];words.nodes.push(row.length===1?{move:row[0],len:1}:{a:row[0],b:row[1],len:Math.min(Number.MAX_SAFE_INTEGER,words.length(row[0])+words.length(row[1]))});
  }
  return words.flatten(words.list(parts));
 }
}
function transposition(degree,a,b){const p=identity(degree);p[a]=b;p[b]=a;return p;}
module.exports={PermutationMembership,transposition,Limit};
