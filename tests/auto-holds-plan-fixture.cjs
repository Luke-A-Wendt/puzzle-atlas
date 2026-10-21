'use strict';
const assert=require('node:assert/strict');
const {autoRequestFromSnapshot,verifyAutoPlan}=require('../solver-backend/src/auto-adapter.cjs');
const {makeAutoHoldsPlan,verifyAutoHoldsPlan}=require('../solver-backend/src/monotone-plan.cjs');

// Independent short legal route for UI lifecycle tests. Every supplied chunk
// must preserve its already-secured goals and add more; it is never inferred
// from the production planner's preferred factorization or the move journal.
function fixturePlan(model,snapshot,chunks,{colors=false}={}){
 const request=autoRequestFromSnapshot(model,snapshot),home=request.homeBySticker,current={...request.currentBySticker};
 const homeAt=new Map(Object.entries(home).map(([id,node])=>[node,id]));
 const correct=()=>{const at=new Map(Object.entries(current).map(([id,node])=>[node,id]));return [...homeAt].filter(([node,id])=>colors?model.colorBySticker[at.get(node)]===model.colorBySticker[id]:current[id]===node).map(([node])=>node);};
 const initialProtectedNodes=correct(),stages=[];let locked=initialProtectedNodes.slice();
 for(const names of chunks){
  const moveIndices=names.map(name=>{const i=typeof name==='number'?name:model.moves.findIndex(m=>m.name===name);assert(i>=0&&model.moves[i],'fixture move '+name);return i;});
  const before={...current},perm=Array.from({length:model.degree},(_,i)=>i);
  for(const index of moveIndices){const p=model.moves[index].perm;for(const id of Object.keys(current))current[id]=p[current[id]];for(let n=0;n<perm.length;n++)perm[n]=p[perm[n]];}
  const after=correct(),newlySolvedNodes=after.filter(n=>!locked.includes(n));
  assert(newlySolvedNodes.length,'fixture stage must secure a new node');assert(locked.every(n=>after.includes(n)),'fixture must preserve secured nodes');
  const targetNode=newlySolvedNodes.find(n=>Object.values(before).includes(perm.indexOf(n))),sourceNode=perm.indexOf(targetNode);
  stages.push({moveIndices,protectedNodes:locked.slice(),newlySolvedNodes,targetNode,sourceNode});locked=after;
 }
 assert.equal(locked.length,model.stickerCount,'fixture solves every goal');
 const baseline={status:'solved',goalSemantics:colors?'colors':'identity',initialProtectedNodes,finalProtectedNodes:locked,moveIndices:stages.flatMap(s=>s.moveIndices),stages,optimal:false,verified:true};
 assert(verifyAutoPlan(model,snapshot,baseline),'independent baseline verification');
 const plan=makeAutoHoldsPlan(model,snapshot,baseline);assert.equal(plan.status,'solved',plan.reason);assert(verifyAutoHoldsPlan(model,snapshot,plan));return plan;
}
module.exports={fixturePlan};
