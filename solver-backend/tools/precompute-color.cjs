#!/usr/bin/env node
'use strict';
/**
 * Compile a bounded catalogue of SHORT LEGAL WORDS, not puzzle states.
 * All permutations map source -> destination and words execute left to right.
 * The sparse support contains every and only nonfixed [source,destination].
 * A catalogue miss is never a proof that a color-preserving request is illegal.
 */
const fs=require('node:fs'),path=require('node:path');
const {modelSignature}=require('../src/full-solve.cjs');
const root=path.resolve(__dirname,'..');
const identity=d=>Array.from({length:d},(_,i)=>i);
const compose=(a,b)=>a.map(x=>b[x]);
const key=p=>p.join(',');
function replay(model,word){let p=identity(model.degree);for(const i of word){if(!model.moves[i])throw Error('Unknown move '+i);p=compose(p,model.moves[i].perm);}return p;}
function supportOf(p){const out=[];for(let i=0;i<p.length;i++)if(p[i]!==i)out.push(i,p[i]);return out;}
function pairsOf(p){const out=[];for(let a=0;a<p.length;a++){const b=p[a];if(a<b&&p[b]===a)out.push([a,b]);}return out;}
function better(a,b){return a.length<b.length||a.length===b.length&&a.join(',')<b.join(',');}
function compileColor(model,options={}){
 const maxBytes=options.maxBytes??2*1024*1024,maxOperations=options.maxOperations??10000;
 const d=model.degree,m=model.moves.length,id=identity(d),perms=model.moves.map(x=>x.perm),lookup=new Map(perms.map((p,i)=>[key(p),i]));
 const inverses=perms.map(p=>{const q=[];p.forEach((x,i)=>q[x]=i);const i=lookup.get(key(q));if(i===undefined)throw Error(model.id+': legal move set is not inverse closed');return i;});
 const known=new Map(),stats={candidateWords:0,nonemptyTwoCycleWords:0,uniqueBeforeBudget:0,extendedDepth:0};
 function consider(word,p){
  stats.candidateWords++;if(!pairsOf(p).length)return;stats.nonemptyTwoCycleWords++;
  const k=key(p),old=known.get(k);if(!old||better(word,old.word))known.set(k,{word:word.slice(),support:supportOf(p)});
 }
 for(let a=0;a<m;a++)consider([a],perms[a]);
 for(let a=0;a<m;a++)for(let b=0;b<m;b++){
  const ab=compose(perms[a],perms[b]);consider([a,b],ab);
  // Single-generator conjugates expose useful two-cycles in new locations.
  consider([a,b,inverses[a]],compose(ab,perms[inverses[a]]));
  // Commutators isolate small supports without an exponential word search.
  consider([a,b,inverses[a],inverses[b]],compose(compose(ab,perms[inverses[a]]),perms[inverses[b]]));
  // A two-generator product may have two-cycles only after a short power.
  // E.g. a six-cycle cubie action becomes three exchanges when cubed.
  const abab=compose(ab,ab);consider([a,b,a,b],abab);
  consider([a,b,a,b,a,b],compose(abab,ab));
 }
 // Some 120-degree-turning puzzles have no exchange in these algebraic
 // families. A fixed, tiny-depth enumeration is affordable for <=16 moves;
 // it never grows with the scramble length or enumerates puzzle states.
 if(!known.size&&m<=16){
  stats.extendedDepth=4;
  function extend(word,p){if(word.length===4)return;for(let a=0;a<m;a++){
   if(word.length&&inverses[word[word.length-1]]===a)continue;
   const next=word.concat(a),q=compose(p,perms[a]);if(next.length>=3)consider(next,q);extend(next,q);
  }}extend([],id);
 }
 stats.uniqueBeforeBudget=known.size;
 // Favor local actions when a budget is reached. Otherwise a large cube's
 // broad two-turn actions would fill the file before useful commutators.
 const sorted=[...known.values()].sort((a,b)=>(a.word.length===1?-1:0)-(b.word.length===1?-1:0)||(2*a.word.length+a.support.length/2)-(2*b.word.length+b.support.length/2)||a.word.length-b.word.length||a.word.join(',').localeCompare(b.word.join(',')));
 const operations=[];let recordBytes=0;
 for(const op of sorted){const n=Buffer.byteLength(JSON.stringify(op))+1;if(operations.length>=maxOperations||recordBytes+n>maxBytes-2048)continue;operations.push(op);recordBytes+=n;}
 operations.sort((a,b)=>a.word.length-b.word.length||a.support.length-b.support.length||a.word.join(',').localeCompare(b.word.join(',')));
 const cache={schemaVersion:1,kind:'color-macros',modelId:model.id??null,modelSignature:modelSignature(model),degree:d,operations};
 const verification=verifyColorCache(model,cache),bytes=Buffer.byteLength(JSON.stringify(cache));
 if(bytes>maxBytes)throw Error(model.id+': catalogue byte bound exceeded');
 return{cache,report:{id:model.id,degree:d,moves:m,...stats,operations:operations.length,omitted:known.size-operations.length,bytes,...verification}};
}
function verifyColorCache(model,cache){
 if(cache.schemaVersion!==1||cache.kind!=='color-macros'||cache.degree!==model.degree||cache.modelSignature!==modelSignature(model))throw Error('Catalogue/model mismatch');
 const seen=new Set(),pairs=new Set(),lengths={},supported=[];
 for(const op of cache.operations){
  if(!Array.isArray(op.word)||!op.word.length||op.word.some(i=>!Number.isInteger(i)||i<0||i>=model.moves.length))throw Error('Invalid word');
  const p=replay(model,op.word),actual=supportOf(p),k=key(p);
  if(JSON.stringify(actual)!==JSON.stringify(op.support))throw Error('Sparse support differs from legal word replay');
  if(seen.has(k))throw Error('Duplicate catalogue permutation');seen.add(k);
  const pp=pairsOf(p);if(!pp.length)throw Error('Catalogue entry has no exchange pair');
  for(const pair of pp)pairs.add(pair.join(','));
  lengths[op.word.length]=(lengths[op.word.length]||0)+1;supported.push(actual.length/2);
 }
 return{verifiedWords:cache.operations.length,exchangePairs:pairs.size,lengths,maxMovedNodes:Math.max(0,...supported)};
}
function main(){
 const ids=process.argv.slice(2),manifest=require('../data/manifest.json'),out=path.join(root,'data/color-solver');fs.mkdirSync(out,{recursive:true});
 const reports=[];for(const info of manifest.models.filter(x=>!ids.length||ids.includes(x.id))){
  const model=JSON.parse(fs.readFileSync(path.join(root,'data',info.id+'.json'),'utf8')),result=compileColor(model);
  fs.writeFileSync(path.join(out,info.id+'.json'),JSON.stringify(result.cache));reports.push(result.report);console.log(JSON.stringify(result.report));
 }
 const totalBytes=reports.reduce((n,x)=>n+x.bytes,0);if(!ids.length&&totalBytes>20*1024*1024)throw Error('Aggregate catalogue budget exceeded');
 const report={schemaVersion:1,algorithm:'single-double-conjugate-commutator-pair-powers-depth4-fallback',maxWordLength:6,maxBytesPerModel:2*1024*1024,maxTotalBytes:20*1024*1024,totalBytes,models:reports};
 fs.writeFileSync(path.join(out,ids.length?'report-selected.json':'report.json'),JSON.stringify(report,null,2)+'\n');
}
if(require.main===module)main();
module.exports={compileColor,verifyColorCache,replay,supportOf,pairsOf};
