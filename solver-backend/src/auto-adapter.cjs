'use strict';
/* Full-solve bridge and independent witness check. It inspects only sticker
 * identities and current geometric poses; the move journal is never needed. */
const {mapSnapshot}=require('./atlas-adapter.cjs');
function targetMapping(model){
 const home=model.homeBySticker;
 if(!home||typeof home!=='object'||Array.isArray(home))throw Error('Puzzle model has no solved sticker target');
 const entries=Object.entries(home),seen=new Set();
 if(entries.length!==model.stickerCount)throw Error('Solved target sticker count does not match the puzzle');
 for(const [,node]of entries){if(!Number.isInteger(node)||node<0||node>=model.degree||seen.has(node))throw Error('Invalid solved sticker target');seen.add(node);}
 return home;
}
function autoRequestFromSnapshot(model,snapshot){
 const mapping=mapSnapshot(model,snapshot),homeBySticker=targetMapping(model),currentBySticker=mapping.stickerToNode;
 if(Object.keys(currentBySticker).length!==Object.keys(homeBySticker).length||Object.keys(homeBySticker).some(id=>!Object.hasOwn(currentBySticker,id)))throw Error('Snapshot contains a different set of sticker identities');
 return{currentBySticker:{...currentBySticker},homeBySticker:{...homeBySticker},occupiedNodes:mapping.occupiedNodes.slice(),...(model.colorBySticker?{colorBySticker:{...model.colorBySticker}}:{})};
}
function colorGoalEnabled(model,home,snapshot){return !snapshot?.mirrorMode&&model.colorRelaxationSafe===true&&!model.requiresOccupiedState&&Object.keys(home).length===model.degree&&model.colorBySticker&&Object.keys(home).every(id=>typeof model.colorBySticker[id]==='string'&&model.colorBySticker[id].length>0);}
function solvedProgress(model,snapshot){
 const {currentBySticker,homeBySticker}=autoRequestFromSnapshot(model,snapshot),solvedStickerIds=[],solvedNodes=[],remainingStickerIds=[];
 const colorGoal=colorGoalEnabled(model,homeBySticker,snapshot),homeIdByNode=new Map(Object.entries(homeBySticker).map(([id,node])=>[node,id]));
 for(const [id,home]of Object.entries(homeBySticker)){const at=currentBySticker[id],solved=colorGoal?model.colorBySticker[id]===model.colorBySticker[homeIdByNode.get(at)]:at===home;if(solved){solvedStickerIds.push(id);solvedNodes.push(at);}else remainingStickerIds.push(id);}
 return{solvedStickerIds,solvedNodes,remainingStickerIds,exact:!colorGoal,solvedCount:solvedNodes.length,totalCount:model.stickerCount};
}
function verifyAutoPlan(model,snapshot,plan){
 try{
  if(plan?.status!=='solved'||!Array.isArray(plan.stages))return false;
  const {currentBySticker:current,homeBySticker:home}=autoRequestFromSnapshot(model,snapshot),byHome=new Map(Object.entries(home).map(([id,node])=>[node,id]));
  const colors=plan.goalSemantics==='colors';if(colors&&!colorGoalEnabled(model,home,snapshot))return false;
  let currentByNode=new Map(Object.entries(current).map(([id,node])=>[node,id]));
  const currentIdAt=n=>currentByNode.get(n),correct=n=>colors?model.colorBySticker[currentIdAt(n)]===model.colorBySticker[byHome.get(n)]:current[byHome.get(n)]===n;
  const locked=new Set(),flat=[],validNodes=nodes=>Array.isArray(nodes)&&new Set(nodes).size===nodes.length&&nodes.every(n=>Number.isInteger(n)&&byHome.has(n));
  if(plan.initialProtectedNodes!==undefined){if(!validNodes(plan.initialProtectedNodes)||plan.initialProtectedNodes.some(n=>!correct(n)))return false;for(const n of plan.initialProtectedNodes)locked.add(n);}
  for(const stage of plan.stages){
   if(!stage||!Array.isArray(stage.moveIndices)||!validNodes(stage.protectedNodes)||!validNodes(stage.newlySolvedNodes))return false;
   if(!Number.isInteger(stage.targetNode)||!byHome.has(stage.targetNode)||!Number.isInteger(stage.sourceNode)||!currentByNode.has(stage.sourceNode))return false;
   if(colors?model.colorBySticker[currentIdAt(stage.sourceNode)]!==model.colorBySticker[byHome.get(stage.targetNode)]:stage.sourceNode!==current[byHome.get(stage.targetNode)])return false;
   const held=new Set(stage.protectedNodes);
   if([...locked].some(n=>!held.has(n))||[...held].some(n=>!correct(n)))return false;
   const perm=Array.from({length:model.degree},(_,i)=>i);
   for(const i of stage.moveIndices){
    if(!Number.isInteger(i)||i<0||i>=model.moves.length||flat.length>=20000)return false;
    const move=model.moves[i].perm;for(let node=0;node<perm.length;node++)perm[node]=move[perm[node]];flat.push(i);
   }
   if((!colors&&[...held].some(n=>perm[n]!==n))||perm[stage.sourceNode]!==stage.targetNode)return false;
   for(const id of Object.keys(current))current[id]=perm[current[id]];
   currentByNode=new Map(Object.entries(current).map(([id,node])=>[node,id]));
   if([...held].some(n=>!correct(n))||!stage.newlySolvedNodes.includes(stage.targetNode)||stage.newlySolvedNodes.some(n=>!correct(n)))return false;
   for(const n of held)locked.add(n);for(const n of stage.newlySolvedNodes)locked.add(n);
  }
  if(!Array.isArray(plan.moveIndices)||flat.length!==plan.moveIndices.length||flat.some((v,i)=>v!==plan.moveIndices[i]))return false;
  if([...byHome.keys()].some(n=>!correct(n)))return false;
  if(plan.finalProtectedNodes!==undefined&&(!validNodes(plan.finalProtectedNodes)||plan.finalProtectedNodes.length!==byHome.size||plan.finalProtectedNodes.some(n=>!correct(n))))return false;
  return true;
 }catch{return false;}
}
module.exports={targetMapping,autoRequestFromSnapshot,solvedProgress,verifyAutoPlan};
