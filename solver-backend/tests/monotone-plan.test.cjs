'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {makeAutoHoldsPlan,verifyAutoHoldsPlan,verifyAutoHoldsStage}=require('../src/monotone-plan.cjs');
const {solveFull}=require('../src/full-solve.cjs');
const {autoRequestFromSnapshot,verifyAutoPlan}=require('../src/auto-adapter.cjs');
const {mapSnapshot}=require('../src/atlas-adapter.cjs');
const plain=value=>JSON.parse(JSON.stringify(value));
function snapshotAt(model,current,extra={}){return {...extra,stickers:Object.entries(current).map(([id,node])=>({...model.nodes[node],id,slot:model.nodes[node].engineSlotId??model.nodes[node].id,color:model.colorBySticker[id]}))};}
function moved(model,current,word){const out={...current};for(const index of word)for(const id of Object.keys(out))out[id]=model.moves[index].perm[out[id]];return out;}
function production(id,word){const model=require('../../dist/games/constrained-solver-models/'+id+'.json'),cache=require('../data/full-solver/'+id+'.json'),current=moved(model,model.homeBySticker,word);return {model,cache,snapshot:snapshotAt(model,current)};}
function verifyEveryChoice(model,snapshot,plan){
 assert(verifyAutoHoldsPlan(model,snapshot,plan));let current={...mapSnapshot(model,snapshot).stickerToNode},locked=new Set(plan.initialProtectedNodes);
 for(const stage of plan.stages){
  const start=snapshotAt(model,current,{mirrorMode:snapshot.mirrorMode});assert(verifyAutoHoldsStage(model,start,stage,[...locked]));
  const beforeCount=locked.size,after=moved(model,current,stage.moveIndices),occupied=new Set(Object.values(current));
  for(const choice of stage.choices){assert(occupied.has(choice.firstNode)&&occupied.has(choice.secondNode));assert.notEqual(choice.firstNode,choice.secondNode);const sourceId=Object.keys(current).find(id=>current[id]===choice.sourceNode);assert.equal(after[sourceId],choice.targetNode);if(choice.kind==='swap'){const other=Object.keys(current).find(id=>current[id]===choice.secondNode);assert.equal(after[other],choice.firstNode);}else assert(['placement','participants'].includes(choice.kind));}
  for(const n of stage.newlySolvedNodes)locked.add(n);assert(locked.size>beforeCount);current=after;
 }
 assert.equal(locked.size,model.stickerCount);assert(plan.stages.length<=model.stickerCount-plan.initialProtectedNodes.length);
}

test('a cyclic three-piece puzzle needs placements even though no two-way swap is legal',()=>{
 const model={degree:3,stickerCount:3,supported:true,fixedPermutation:true,nodes:[0,1,2].map(n=>({index:n,id:n})),moves:[{name:'C',perm:[1,2,0]},{name:"C'",perm:[2,0,1]}],homeBySticker:{a:0,b:1,c:2},colorBySticker:{a:'r',b:'g',c:'b'},colorRelaxationSafe:true};
 const current={a:1,b:2,c:0},snapshot=snapshotAt(model,current),baseline={status:'solved',goalSemantics:'colors',initialProtectedNodes:[],finalProtectedNodes:[0,1,2],moveIndices:[1],stages:[{sourceNode:1,targetNode:0,protectedNodes:[],newlySolvedNodes:[0,1,2],moveIndices:[1]}]};
 assert(verifyAutoPlan(model,snapshot,baseline));const plan=makeAutoHoldsPlan(model,snapshot,baseline);assert.equal(plan.status,'solved');assert.equal(plan.stages[0].choices.length,3);assert(plan.stages[0].choices.every(c=>c.kind==='placement'));
 verifyEveryChoice(model,snapshot,plan);
 for(const perm of [[0,1,2],model.moves[0].perm,model.moves[1].perm])assert.equal(perm.filter((dst,src)=>dst!==src&&perm[dst]===src).length,0,'the whole legal group contains no nontrivial swap');
});

test('plan verifier rejects false choices, missing gains, changed words and missing final suffix',()=>{
 const {model,cache,snapshot}=production('cube2',[0,3,6]),baseline=solveFull(model,autoRequestFromSnapshot(model,snapshot),{cache}),plan=makeAutoHoldsPlan(model,snapshot,baseline);
 assert.equal(plan.status,'solved',plan.reason);verifyEveryChoice(model,snapshot,plan);
 const wrong=plain(plan);wrong.stages[0].choices[0].targetNode=model.degree;assert(!verifyAutoHoldsPlan(model,snapshot,wrong));
 const stalled=plain(plan);stalled.stages[0].newlySolvedNodes=[];assert(!verifyAutoHoldsPlan(model,snapshot,stalled));
 const word=plain(plan);word.stages[0].moveIndices[0]=model.moves.length;assert(!verifyAutoHoldsPlan(model,snapshot,word));
 const cut=plain(plan);cut.stages.pop();assert(!verifyAutoHoldsPlan(model,snapshot,cut));
 const changed=snapshotAt(model,moved(model,mapSnapshot(model,snapshot).stickerToNode,[1]));assert(!verifyAutoHoldsStage(model,changed,plan.stages[0],plan.initialProtectedNodes));
});

test('every production puzzle has an independently verified finite monotone Auto route',t=>{
 const manifest=require('../data/manifest.json');let count=0,stages=0,maxMs=0;
 for(const {id}of manifest.models){
  const model=require('../../dist/games/constrained-solver-models/'+id+'.json');let seed=13,word=[];for(let k=0;k<12;k++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;word.push(seed%model.moves.length);}
  const f=production(id,word),baseline=solveFull(f.model,autoRequestFromSnapshot(f.model,f.snapshot),{cache:f.cache,maxMs:15000,maxOutputMoves:20000});assert.equal(baseline.status,'solved',id+': '+baseline.reason);
  const started=performance.now(),plan=makeAutoHoldsPlan(f.model,f.snapshot,baseline);assert.equal(plan.status,'solved',id+': '+plan.reason);maxMs=Math.max(maxMs,performance.now()-started);verifyEveryChoice(f.model,f.snapshot,plan);count++;stages+=plan.stages.length;
 }
 assert.equal(count,manifest.models.length);t.diagnostic(count+' puzzles, '+stages+' strict-growth stages; slowest plan decoration '+Math.round(maxMs)+'ms');
});

test('mirror guidance uses exact identities and solved snapshots need no choices',()=>{
 const f=production('cube3',[0,3,6]),snapshot={...f.snapshot,mirrorMode:true},baseline=solveFull(f.model,autoRequestFromSnapshot(f.model,snapshot),{cache:f.cache,colorOptimize:false});
 const plan=makeAutoHoldsPlan(f.model,snapshot,baseline);assert.equal(plan.status,'solved',plan.reason);assert.equal(plan.goalSemantics,'identity');verifyEveryChoice(f.model,snapshot,plan);
 const solved=snapshotAt(f.model,f.model.homeBySticker),empty=makeAutoHoldsPlan(f.model,solved,solveFull(f.model,autoRequestFromSnapshot(f.model,solved),{cache:f.cache}));assert.equal(empty.stages.length,0);assert.equal(empty.initialProtectedNodes.length,f.model.stickerCount);assert(verifyAutoHoldsPlan(f.model,solved,empty));
});
