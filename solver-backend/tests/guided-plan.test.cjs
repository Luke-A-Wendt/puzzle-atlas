'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {groupGuidedPlan,verifyGuidedPlan,verifyGuidedStep}=require('../src/guided-plan.cjs');
const model={id:'guided-s4',supported:true,fixedPermutation:true,degree:4,stickerCount:4,homeBySticker:{a:0,b:1,c:2,d:3},colorBySticker:{a:'green',b:'green',c:'red',d:'red'},colorRelaxationSafe:true,nodes:[0,1,2,3].map(index=>({index,id:String(index),engineSlotId:index})),moves:[{name:'a',perm:[1,0,2,3]},{name:'b',perm:[0,2,1,3]},{name:'c',perm:[0,1,3,2]}]};
const snapshot=current=>({stickers:Object.entries(current).map(([id,slot])=>({id,slot}))});
test('guided holds preserve colors and permit a held location to receive an equivalent sticker',()=>{
 const current={a:0,b:2,c:1,d:3},request={currentBySticker:current,homeBySticker:model.homeBySticker};
 const baseline={status:'solved',stages:[{moveIndices:[1,0]}],moveIndices:[1,0]},plan=groupGuidedPlan(model,request,baseline,{protectedNodes:[0,3]});
 assert.equal(plan.status,'solved');assert.deepEqual(plan.stages[0].protectedNodes,[0,3]);assert(verifyGuidedPlan(model,snapshot(current),plan));assert(verifyGuidedStep(model,snapshot(current),plan.stages[0]));
 const end={...current};for(const index of plan.moveIndices)for(const id in end)end[id]=model.moves[index].perm[end[id]];
 assert.equal(end.b,0);assert.equal(end.a,1);assert.notEqual(end.a,current.a);assert.equal(model.colorBySticker.a,model.colorBySticker.b);
});
test('picture and shape goals can advance identity after all visible colors already match',()=>{
 const pictured={...model,colorRelaxationSafe:false},current={a:1,b:0,c:2,d:3},request={currentBySticker:current,homeBySticker:model.homeBySticker};
 const plan=groupGuidedPlan(pictured,request,{status:'solved',stages:[{moveIndices:[0]}],moveIndices:[0]},{protectedNodes:[0,1,2,3]});
 assert.equal(plan.status,'solved');assert.equal(plan.goalSemantics,'identity');assert.deepEqual(plan.stages[0].progressBefore,[4,2]);assert.deepEqual(plan.stages[0].progressAfter,[4,4]);assert.deepEqual(plan.stages[0].newlySolvedNodes,[]);assert(verifyGuidedPlan(pictured,snapshot(current),plan));
});
