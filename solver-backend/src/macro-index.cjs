'use strict';
// Index algebraic witnesses by the two-cycles in their sparse support. This is
// O(sum support sizes) once per loaded catalog, not O(number of configurations).
// The catalog is immutable application data; callers replacing it get a new
// index. A support declaration is only a lookup hint: every returned solution
// is still independently replayed against the actual move permutations.
const indexes=new WeakMap();
function macroIndex(cache){
 if(!cache||!Array.isArray(cache.operations))return null;
 const previous=indexes.get(cache);
 if(previous&&previous.operations===cache.operations&&previous.count===cache.operations.length)return previous;
 const degree=cache.degree,byPair=new Map();let entries=0,invalid=0;
 for(const op of cache.operations){
  if(!op||!Array.isArray(op.word)||!op.word.length||!Array.isArray(op.support)||op.support.length%2){invalid++;continue;}
  const mapping=new Map();let valid=true;
  for(let k=0;k<op.support.length;k+=2){const a=op.support[k],b=op.support[k+1];if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||a>=degree||b<0||b>=degree||a===b||mapping.has(a)){valid=false;break;}mapping.set(a,b);}
  if(!valid){invalid++;continue;}
  for(const [a,b]of mapping)if(a<b&&mapping.get(b)===a){const key=a*degree+b,list=byPair.get(key)??[];list.push(op);byPair.set(key,list);entries++;}
 }
 for(const list of byPair.values())list.sort((a,b)=>a.word.length-b.word.length||a.support.length-b.support.length);
 const result={operations:cache.operations,count:cache.operations.length,byPair,entries,invalid,estimatedBytes:entries*16+byPair.size*96};indexes.set(cache,result);return result;
}
function pairOperations(cache,a,b){const index=macroIndex(cache);return index?.byPair.get(Math.min(a,b)*cache.degree+Math.max(a,b))??[];}
module.exports={macroIndex,pairOperations};
