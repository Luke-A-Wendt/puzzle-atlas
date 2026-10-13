'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {solveSync,verify,normalize,permutation}=require('../src/index.cjs');
const {searchColors,catalogWitness}=require('../src/color-solve.cjs');
const {modelSignature}=require('../src/full-solve.cjs');
const model={degree:4,moves:[{name:'double',perm:[1,0,3,2]}]};
const request={swap:[0,1],protected:[2],holdSemantics:'color',colorByNode:['red','blue','green','green']};

test('a held color can be supplied by an unheld same-color sticker',()=>{
 assert.equal(solveSync(model,{swap:[0,1],protected:[2]}).status,'impossible');
 const result=solveSync(model,request);
 assert.equal(result.status,'solved');assert.equal(result.verified,true);assert.equal(result.optimal,true);
 assert.deepEqual(result.moveIndices,[0]);assert.equal(result.permutation[2],3);assert.equal(result.holdSemantics,'color');
 assert.equal(verify(model,normalize(model,request),result.moveIndices),true);
});

test('different held colors cannot be substituted and complete tuple exhaustion proves failure',()=>{
 const result=solveSync(model,{...request,colorByNode:['red','blue','green','yellow']});
 assert.equal(result.status,'impossible');assert.equal(result.reason,'exhausted_color_preimage_tuple_orbit');
});

test('bounded color failure cannot inherit a strict impossibility certificate',()=>{
 const result=solveSync(model,request,{searchMs:0});
 assert.equal(result.status,'unknown');assert.equal(result.strictStatus,'impossible');assert.equal(result.reason,'color_hold_search_incomplete');
});

test('catalog witnesses retain exact physical A/B swapping and are replay-verified',()=>{
 const cache={schemaVersion:1,kind:'color-macros',degree:4,modelSignature:modelSignature(model),operations:[{word:[0],support:[0,1,1,0,2,3,3,2]}]};
 const result=solveSync(model,request,{colorCache:cache,searchMs:0});
 assert.equal(result.status,'solved');assert.equal(result.method,'color_hold_short_catalog');
 const lying={...cache,operations:[{word:[0,0],support:cache.operations[0].support}]};
 assert.equal(catalogWitness(model,normalize(model,request),lying,{deadline:performance.now()+500}).status,'unknown');
 const stale={...cache,modelSignature:'stale'};
 assert.equal(catalogWitness(model,normalize(model,request),stale,{deadline:performance.now()+500}).status,'unknown');
});

test('same-colored A/B still requires exchanging their physical stickers',()=>{
 const result=solveSync(model,{...request,colorByNode:['red','red','green','green']});
 assert.deepEqual(result.moveIndices,[0]);
});

test('color input validation and legacy exact/throughout semantics stay explicit',()=>{
 for(const invalid of [undefined,[],new Array(4),['red','blue','green',null],['red','blue','green',NaN]]){
  assert.equal(solveSync(model,{...request,colorByNode:invalid}).status,'invalid');
 }
 assert.equal(solveSync(model,{...request,protection:'throughout'}).status,'invalid');
 assert.equal(solveSync(model,{...request,mode:'exact_swap'}).status,'invalid');
 assert.equal(solveSync(model,{swap:[0,1],protected:[2],protection:'throughout'}).status,'impossible');
 assert.equal(solveSync(model,{...request,holdSemantics:'sticker',colorByNode:undefined}).status,'impossible');
});

test('pose models allow unoccupied addresses but never supply an empty held color',()=>{
 const pose={...model,requiresOccupiedState:true,stickerCount:3};
 const valid={swap:[0,1],protected:[],holdSemantics:'color',colorByNode:['red','blue','green',null],occupiedNodes:[0,1,2]};
 assert.equal(solveSync(pose,valid).status,'solved');
 assert.equal(solveSync(pose,{...valid,protected:[2]}).status,'impossible');
 assert.equal(solveSync(pose,{...valid,colorByNode:['red','blue',null,'green']}).status,'invalid');
});

// Independent complete BFS is deliberately limited to a tiny toy group. It
// catches chronological-word reversal mistakes in the inverse-tuple search.
function oracle(m,r){
 const d=m.degree,start=Array.from({length:d},(_,i)=>i),rows=[{p:start,word:[]}],seen=new Set([start.join(',')]);
 for(let head=0;head<rows.length;head++){
  const {p,word}=rows[head],inverse=[];p.forEach((dest,source)=>inverse[dest]=source);
  if(p[r.swap[0]]===r.swap[1]&&p[r.swap[1]]===r.swap[0]&&r.protected.every(h=>r.colorByNode[inverse[h]]===r.colorByNode[h]))return word;
  m.moves.forEach((move,index)=>{const next=p.map(x=>move.perm[x]),key=next.join(',');if(!seen.has(key)){seen.add(key);rows.push({p:next,word:[...word,index]});}});
 }
 return null;
}
test('noncommuting inverse-tuple search agrees with every small-group optimum',()=>{
 const toy={degree:5,moves:[{name:'cycle',perm:[1,2,3,4,0]},{name:'swap',perm:[1,0,2,3,4]}]};
 const colors=['a','b','a','b','a'];
 for(let a=0;a<5;a++)for(let b=a+1;b<5;b++)for(let h=0;h<5;h++)if(h!==a&&h!==b){
  const req={swap:[a,b],protected:[h],colorByNode:colors,holdSemantics:'color'},expected=oracle(toy,req);
  const actual=searchColors(toy,req,{maxMs:1000,maxStates:1000,maxDepth:30});
  assert.equal(actual.status,expected?'solved':'impossible');
  if(expected){assert.equal(actual.moveIndices.length,expected.length);assert.equal(verify(toy,req,actual.moveIndices),true);}
 }
});

test('strict fallback still produces a legal relaxed solution',()=>{
 const toy={degree:4,moves:[{name:'cycle',perm:[1,2,3,0]},{name:'swap',perm:[1,0,2,3]}]};
 const req={swap:[1,2],protected:[0],colorByNode:['a','b','c','a'],holdSemantics:'color'};
 const result=solveSync(toy,req,{searchMs:0,maxMs:2000});
 assert.equal(result.status,'solved');assert.equal(result.method,'color_hold_pointwise_fallback');assert.equal(result.optimal,false);
 assert.equal(verify(toy,normalize(toy,req),result.moveIndices),true);
 assert.equal(permutation(toy,result.moveIndices)[0],0);
});
