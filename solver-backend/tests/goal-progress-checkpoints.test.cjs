'use strict';
// Independent small-group counterexamples for displayed checkpoint progress.
// These tests replay legal words rather than trusting progress metadata.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {groupGuidedPlan,verifyGuidedPlan,verifyGuidedStep}=require('../src/guided-plan.cjs');
const {solvedProgress}=require('../src/auto-adapter.cjs');
const copy=value=>JSON.parse(JSON.stringify(value));
function fixture(states,{exact=false,id='review-permutation'}={}){
 const count=states[0].length,ids=Array.from({length:count},(_,i)=>String(i));
 const homeBySticker=Object.fromEntries(ids.map((id,i)=>[id,i]));
 const model={id,supported:true,fixedPermutation:true,degree:count,stickerCount:count,colorRelaxationSafe:!exact,homeBySticker,colorBySticker:Object.fromEntries(ids.map((id,i)=>[id,['green','red','blue'][Math.floor(i/2)]])),nodes:ids.map((id,index)=>({id,index,engineSlotId:index})),moves:[]};
 for(let k=1;k<states.length;k++){const perm=new Array(count);for(let i=0;i<count;i++)perm[states[k-1][i]]=states[k][i];model.moves.push({name:'verified-transition-'+k,perm});}
 const current=Object.fromEntries(ids.map((id,i)=>[id,states[0][i]])),snapshot={stickers:ids.map((id,i)=>({id,slot:states[0][i]}))};
 const request={currentBySticker:current,homeBySticker},baseline={status:'solved',stages:model.moves.map((_,i)=>({moveIndices:[i]})),moveIndices:model.moves.map((_,i)=>i)};
 return{model,current,snapshot,request,baseline};
}
function replay(model,current,word){const next={...current};for(const index of word)for(const id in next)next[id]=model.moves[index].perm[next[id]];return next;}
function asSnapshot(current){return{stickers:Object.entries(current).map(([id,slot])=>({id,slot}))};}
function assertMeasuredSteps(f,plan){
 assert.equal(plan.status,'solved',plan.reason);assert(verifyGuidedPlan(f.model,f.snapshot,plan));let current={...f.current};
 for(const stage of plan.stages){const before=solvedProgress(f.model,asSnapshot(current));assert(verifyGuidedStep(f.model,asSnapshot(current),stage));current=replay(f.model,current,stage.moveIndices);const after=solvedProgress(f.model,asSnapshot(current));assert(after.solvedCount>before.solvedCount,'every exposed checkpoint really increases solved-goal overlap');}
 assert.equal(solvedProgress(f.model,asSnapshot(current)).solvedCount,f.model.stickerCount);
}
test('color-goal guidance merges identity-only work instead of emitting a false percentage increase',()=>{
 const f=fixture([[1,0,3,4,2,5],[0,1,3,4,2,5],[0,1,2,3,4,5]]),plan=groupGuidedPlan(f.model,f.request,f.baseline);
 assert.equal(plan.stages.length,1);assert.deepEqual(plan.stages[0].moveIndices,[0,1]);assert.equal(plan.progressSemantics,'colors');assertMeasuredSteps(f,plan);
});
test('exact pose goals do not mistake increased color overlap for decreased pose progress',()=>{
 const f=fixture([[0,2,1,4,3,5],[1,0,3,4,5,2],[0,1,2,3,4,5]],{exact:true}),plan=groupGuidedPlan(f.model,f.request,f.baseline);
 // The first transition raises color matches from 2 to 4 but lowers exact
 // matches from 2 to 0. It must remain internal to the complete operation.
 assert.equal(plan.stages.length,1);assert.deepEqual(plan.stages[0].progressBefore,[2,2]);assert.deepEqual(plan.stages[0].moveIndices,[0,1]);assert.equal(plan.progressSemantics,'identity');assertMeasuredSteps(f,plan);
});
test('an all-correct-color pose puzzle still shows its remaining exact goal work',()=>{
 const f=fixture([[1,0,3,2,5,4],[0,1,3,2,5,4],[0,1,2,3,5,4],[0,1,2,3,4,5]],{exact:true}),plan=groupGuidedPlan(f.model,f.request,f.baseline);
 assert.equal(solvedProgress(f.model,f.snapshot).solvedCount,0);assert.equal(plan.stages.length,3);assertMeasuredSteps(f,plan);
 assert.deepEqual(plan.stages.map(s=>s.progressAfter[1]),[2,4,6]);
});
test('exact progress may not discard previously held correct colors at a checkpoint',()=>{
 const f=fixture([[1,0,3,2,5,4],[0,2,1,3,5,4],[0,1,2,3,4,5]],{exact:true}),plan=groupGuidedPlan(f.model,f.request,f.baseline);
 // Two exact identities become correct at the intermediate boundary, but a
 // formerly green and a formerly red held location change color there.
 assert.equal(plan.stages.length,1);assert.deepEqual(plan.stages[0].protectedNodes,[0,1,2,3,4,5]);assertMeasuredSteps(f,plan);
});
test('checkpoint validation rejects forged counters, metric switches and unfinished witnesses',()=>{
 const f=fixture([[1,0,3,2,5,4],[0,1,3,2,5,4],[0,1,2,3,4,5]],{exact:true}),plan=groupGuidedPlan(f.model,f.request,f.baseline);assertMeasuredSteps(f,plan);
 for(const mutate of [p=>p.stages[0].progressAfter[1]++,p=>p.stages[0].progressBefore[1]++,p=>p.progressSemantics='colors',p=>p.stages[0].progressSemantics='colors',p=>p.moveIndices.pop(),p=>p.stages.pop()]){const bad=copy(plan);mutate(bad);assert.equal(verifyGuidedPlan(f.model,f.snapshot,bad),false);}
 const incomplete={status:'solved',stages:f.baseline.stages.slice(0,1),moveIndices:[0]};assert.equal(groupGuidedPlan(f.model,f.request,incomplete).status,'unknown');
});
function snapshotAt(model,current){return{stickers:Object.entries(current).map(([id,node])=>({...model.nodes[node],id,slot:model.nodes[node].engineSlotId??model.nodes[node].id}))};}
test('all 34 catalog goals count actual stickers, using exact poses where colors cannot define the solved state',()=>{
 const directory=path.resolve(__dirname,'../../dist/games/constrained-solver-models'),catalog=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'))).models;let expanded=0,large=0;
 for(const entry of catalog){const model=JSON.parse(fs.readFileSync(path.join(directory,entry.id+'.json'))),home=model.homeBySticker,current=Object.fromEntries(Object.entries(home).map(([id,node])=>[id,model.moves[0].perm[node]])),goalAt=new Map(Object.entries(home).map(([id,node])=>[node,model.colorBySticker[id]]));
  const colorGoal=model.colorRelaxationSafe===true&&!model.requiresOccupiedState&&Object.keys(home).length===model.degree;
  const expected=Object.entries(current).filter(([id,node])=>colorGoal?model.colorBySticker[id]===goalAt.get(node):node===home[id]).length;
  const measured=solvedProgress(model,snapshotAt(model,current));assert.equal(measured.solvedCount,expected,entry.id);assert.equal(measured.totalCount,Object.keys(home).length,entry.id+' actual visible sticker denominator');assert.equal(solvedProgress(model,snapshotAt(model,home)).solvedCount,model.stickerCount,entry.id+' solved goal');
  if(model.requiresOccupiedState){expanded++;assert(model.degree>measured.totalCount,entry.id+' empty possible poses do not count as missing stickers');}if(model.stickerCount>=384)large++;
 }
 assert.equal(catalog.length,34);assert.equal(expanded,4);assert(large>=1);
});
test('all 34 models expose strictly improving real goal checkpoints from a legal multistage witness',()=>{
 const directory=path.resolve(__dirname,'../../dist/games/constrained-solver-models'),catalog=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'))).models;let checkpoints=0;
 for(const entry of catalog){
  const model=JSON.parse(fs.readFileSync(path.join(directory,entry.id+'.json'))),home=model.homeBySticker,word=[0,Math.floor(model.moves.length/3),Math.floor(model.moves.length*2/3),1,Math.floor(model.moves.length/2)].map(i=>i%model.moves.length),current=replay(model,home,word);
  const inverse=word.slice().reverse().map(index=>{const p=model.moves[index].perm;const match=model.moves.findIndex(m=>m.perm.every((destination,source)=>p[destination]===source));assert(match>=0,entry.id+' legal inverse move');return match;});
  const request={currentBySticker:current,homeBySticker:home},baseline={status:'solved',stages:inverse.map(i=>({moveIndices:[i]})),moveIndices:inverse},snapshot=snapshotAt(model,current),plan=groupGuidedPlan(model,request,baseline);
  assert.equal(plan.status,'solved',entry.id+': '+plan.reason);assert(verifyGuidedPlan(model,snapshot,plan),entry.id+' complete witness verification');let state={...current};
  for(const stage of plan.stages){const before=solvedProgress(model,snapshotAt(model,state));assert(verifyGuidedStep(model,snapshotAt(model,state),stage),entry.id+' stage verification');state=replay(model,state,stage.moveIndices);const after=solvedProgress(model,snapshotAt(model,state));assert(after.solvedCount>before.solvedCount,entry.id+' strictly increasing actual goal overlap');checkpoints++;}
  assert.equal(solvedProgress(model,snapshotAt(model,state)).solvedCount,model.stickerCount,entry.id+' terminal goal');assert(plan.stages.length<=model.stickerCount,entry.id+' finite displayed checkpoint bound');
 }
 assert(checkpoints>=catalog.length,'each scrambled model exercised a real checkpoint');
});
