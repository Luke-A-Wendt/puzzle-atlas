'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {precomputeFull,solveFull}=require('../src/full-solve.cjs');
const {autoRequestFromSnapshot,verifyAutoPlan,solvedProgress}=require('../src/auto-adapter.cjs');
const home={a:0,b:1,c:2,d:3};
const model={id:'colored-s4',supported:true,fixedPermutation:true,degree:4,stickerCount:4,homeBySticker:home,colorRelaxationSafe:true,colorBySticker:{a:'green',b:'green',c:'red',d:'red'},nodes:[0,1,2,3].map(index=>({index,id:String(index),engineSlotId:index})),moves:[{name:'a',perm:[1,0,2,3]},{name:'b',perm:[0,2,1,3]},{name:'c',perm:[0,1,3,2]}]};
const cache=precomputeFull(model);
const permutations=a=>a.length?a.flatMap((v,i)=>permutations(a.filter((_,j)=>j!==i)).map(p=>[v,...p])):[[]];
const snapshot=current=>({stickers:Object.keys(home).map(id=>({id,slot:current[id]}))});
function replay(current,plan){const end={...current};for(const i of plan.moveIndices)for(const id in end)end[id]=model.moves[i].perm[end[id]];return end;}
test('color goals accept interchangeable sticker identities without a lookup table',()=>{
 const current={a:1,b:0,c:3,d:2},snap=snapshot(current),request=autoRequestFromSnapshot(model,snap);
 const plan=solveFull(model,request,{cache:{status:'unknown'}});
 assert.equal(plan.status,'solved');assert.equal(plan.method,'already_color_solved');assert.equal(plan.optimal,true);assert.deepEqual(plan.moveIndices,[]);
 assert(verifyAutoPlan(model,snap,plan));assert.equal(solvedProgress(model,snap).solvedCount,4);
 assert.equal(verifyAutoPlan({...model,colorRelaxationSafe:false},snap,plan),false);
});
test('all S4 configurations get independently verified no-longer color plans and truthful held endpoints',()=>{
 let shorter=0,identityRelaxed=0;
 for(const arrangement of permutations([0,1,2,3])){
  const current=Object.fromEntries(Object.keys(home).map((id,i)=>[id,arrangement[i]])),snap=snapshot(current),request=autoRequestFromSnapshot(model,snap),before=JSON.stringify(snap);
  const exact=solveFull(model,request,{cache,colorOptimize:false}),plan=solveFull(model,request,{cache});
  assert.equal(plan.status,'solved');assert(plan.moveIndices.length<=exact.moveIndices.length);assert(plan.stages.length<=exact.stages.length);assert(verifyAutoPlan(model,snap,plan));assert.equal(JSON.stringify(snap),before);
  assert.equal(solvedProgress(model,snapshot(replay(current,plan))).solvedCount,4);
  shorter+=plan.moveIndices.length<exact.moveIndices.length;identityRelaxed+=JSON.stringify(replay(current,plan))!==JSON.stringify(home);
 }
 assert(shorter>0);assert(identityRelaxed>0);
});
test('unsafe shape/picture goals and explicit optimization opt-out preserve the exact solver',()=>{
 const current={a:2,b:0,c:3,d:1},request={currentBySticker:current,homeBySticker:home};
 const exact=solveFull(model,request,{cache,colorOptimize:false});
 for(const variant of [{...model,colorRelaxationSafe:false},{...model,colorBySticker:undefined},{...model,requiresOccupiedState:true}]){
  const plan=solveFull(variant,request,{cache});assert.equal(plan.goalSemantics,undefined);assert.deepEqual(plan.moveIndices,exact.moveIndices);assert.deepEqual(replay(current,plan),home);
 }
});
test('secured nodes may receive a different same-colored sticker at a stage endpoint',()=>{
 const current={a:0,b:3,c:1,d:2},snap=snapshot(current),plan=solveFull(model,autoRequestFromSnapshot(model,snap),{cache});
 assert(verifyAutoPlan(model,snap,plan));assert.equal(plan.goalSemantics,'colors');
 let state={...current},changedHeldIdentity=false;
 for(const stage of plan.stages){const before={...state};for(const index of stage.moveIndices)for(const id in state)state[id]=model.moves[index].perm[state[id]];
  for(const n of stage.protectedNodes){const oldId=Object.keys(before).find(id=>before[id]===n),newId=Object.keys(state).find(id=>state[id]===n);assert.equal(model.colorBySticker[oldId],model.colorBySticker[newId]);changedHeldIdentity ||= oldId!==newId;}
 }
 assert(changedHeldIdentity,'the color relaxation should do more than relabel the plan');
});
test('color optimization time or memory budgets safely retain a complete exact witness',()=>{
 const request={currentBySticker:{a:3,b:2,c:1,d:0},homeBySticker:home},exact=solveFull(model,request,{cache,colorOptimize:false});
 for(const limits of [{maxColorMs:0},{maxColorBytes:1}]){const plan=solveFull(model,request,{cache,...limits});assert.equal(plan.status,'solved');assert.deepEqual(plan.moveIndices,exact.moveIndices);assert(verifyAutoPlan(model,snapshot(request.currentBySticker),plan));}
});
test('independent color verifier rejects forged color claims and incomplete playback',()=>{
 const current={a:2,b:3,c:0,d:1},snap=snapshot(current),plan=solveFull(model,autoRequestFromSnapshot(model,snap),{cache});assert(verifyAutoPlan(model,snap,plan));
 const wrong=structuredClone(plan);wrong.stages[0].sourceNode=99;assert.equal(verifyAutoPlan(model,snap,wrong),false);
 const missing=structuredClone(plan);missing.moveIndices.pop();assert.equal(verifyAutoPlan(model,snap,missing),false);
 const unsafe={...model,colorBySticker:{a:'green',b:'green',c:'red'}};assert.equal(verifyAutoPlan(unsafe,snap,plan),false);
});
test('an impossible identity assignment is not a proof against its reachable color goal',()=>{
 const cyclic={...model,id:'colored-c3',degree:3,stickerCount:3,homeBySticker:{a:0,b:1,c:2},colorBySticker:{a:'green',b:'green',c:'red'},nodes:model.nodes.slice(0,3),moves:[{name:'rotate',perm:[1,2,0]}]},current={a:0,b:2,c:1},snap={stickers:Object.entries(current).map(([id,slot])=>({id,slot}))},request=autoRequestFromSnapshot(cyclic,snap),cyclicCache=precomputeFull(cyclic);
 const exact=solveFull(cyclic,request,{cache:cyclicCache,colorOptimize:false});assert.equal(exact.status,'impossible');assert.equal(exact.proof,'complete_stabilizer_chain');
 const color=solveFull(cyclic,request,{cache:cyclicCache});assert.equal(color.status,'unknown');assert.equal(color.reason,'color_goal_identity_baseline_unreachable');assert.equal(color.proof,undefined);
 // The odd identity relabeling cannot be undone by a 3-cycle, yet one legal
 // rotation solves all visible colors, including the previously green hold.
 const witness={status:'solved',goalSemantics:'colors',initialProtectedNodes:[0],stages:[{moveIndices:[0],protectedNodes:[0],newlySolvedNodes:[1,2],targetNode:1,sourceNode:0}],moveIndices:[0],finalProtectedNodes:[0,1,2]};assert(verifyAutoPlan(cyclic,snap,witness));
 assert.equal(solveFull({...cyclic,colorRelaxationSafe:false},request,{cache:cyclicCache}).status,'impossible');
});
