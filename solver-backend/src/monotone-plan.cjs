'use strict';
/* Interactive Auto follows one completely verified solution witness. Every
 * offered pair chooses the same next secured-prefix stage, so user choice
 * cannot branch into a greedy dead end. A placement is never called a swap
 * unless the complete stage actually exchanges those two sticker addresses. */
const {autoRequestFromSnapshot,verifyAutoPlan}=require('./auto-adapter.cjs');

function sameNodes(a,b){return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&new Set(a).size===a.length&&a.every(n=>b.includes(n));}
function context(model,snapshot,semantics){
 const request=autoRequestFromSnapshot(model,snapshot),home=request.homeBySticker,current={...request.currentBySticker};
 if(semantics==='colors'&&(snapshot?.mirrorMode||model.colorRelaxationSafe!==true||model.requiresOccupiedState))throw Error('color_goal_not_safe');
 if(!['colors','identity'].includes(semantics))throw Error('invalid_goal_semantics');
 const ids=Object.keys(home),homeAt=new Map(ids.map(id=>[home[id],id])),colors=model.colorBySticker;
 const at=()=>new Map(ids.map(id=>[current[id],id]));
 const correct=(node,positions=at())=>semantics==='colors'?positions.has(node)&&colors[positions.get(node)]===colors[homeAt.get(node)]:current[homeAt.get(node)]===node;
 return {model,request,home,current,ids,homeAt,colors,semantics,at,correct};
}
function permutation(p,word){
 if(!Array.isArray(word)||!word.length||word.length>20000)throw Error('invalid_guided_word');
 const perm=Array.from({length:p.model.degree},(_,i)=>i);
 for(const index of word){const move=p.model.moves[index];if(!Number.isInteger(index)||!move)throw Error('invalid_guided_move');for(let n=0;n<perm.length;n++)perm[n]=move.perm[perm[n]];}
 return perm;
}
function choicesFor(p,stage,perm,before){
 const choices=[],seen=new Set(),protectedSet=new Set(stage.protectedNodes);
 const inverse=new Map();for(const node of before.keys())inverse.set(perm[node],node);
 for(const targetNode of stage.newlySolvedNodes){
  const sourceNode=inverse.get(targetNode);
  // Some newly secured nodes were already correct by coincidence. They are
  // valid holds after this stage, but are not suggestions for a new placement.
  if(sourceNode===undefined||sourceNode===targetNode||p.correct(targetNode,before))continue;
  let secondNode=targetNode,kind;
  if(before.has(targetNode))kind=perm[targetNode]===sourceNode?'swap':'placement';
  else{
   // Expanded shape models may place a tile at a currently empty target pose.
   // Show a second participating visible tile, never a fictitious target tile.
   secondNode=[...before.keys()].find(n=>n!==sourceNode&&!protectedSet.has(n)&&perm[n]!==n);
   if(secondNode===undefined)continue;
   kind='participants';
  }
  const key=sourceNode+':'+secondNode;
  if(seen.has(key))continue;seen.add(key);
  choices.push({firstNode:sourceNode,secondNode,sourceNode,targetNode,kind});
 }
 if(!choices.length)throw Error('guided_stage_has_no_visible_progress_pair');
 return choices;
}
function inspectStage(p,stage,locked){
 if(!stage||stage.guidedAuto!==true||stage.goalSemantics!==p.semantics||[...locked].some(n=>!p.homeAt.has(n))||!sameNodes(stage.protectedNodes,[...locked])||!Array.isArray(stage.newlySolvedNodes)||!stage.newlySolvedNodes.length||new Set(stage.newlySolvedNodes).size!==stage.newlySolvedNodes.length||stage.newlySolvedNodes.some(n=>locked.has(n)||!p.homeAt.has(n)))throw Error('invalid_guided_secured_growth');
 const before=p.at();if([...locked].some(n=>!p.correct(n,before)))throw Error('guided_hold_not_solved');
 const perm=permutation(p,stage.moveIndices),choices=choicesFor(p,stage,perm,before);
 for(const id of p.ids)p.current[id]=perm[p.current[id]];
 const after=p.at(),secured=[...locked,...stage.newlySolvedNodes];
 if(secured.some(n=>!p.correct(n,after)))throw Error('guided_stage_did_not_preserve_goal');
 if(p.semantics==='identity'&&[...locked].some(n=>perm[n]!==n))throw Error('guided_stage_moved_exact_hold');
 for(const n of stage.newlySolvedNodes)locked.add(n);
 return choices;
}
function makeAutoHoldsPlan(model,snapshot,baseline){
 if(baseline?.status!=='solved')return baseline;
 const fail=reason=>({status:'unknown',reason,optimal:false,guidedAuto:true,stages:[],moveIndices:[]});
 try{
  if(!verifyAutoPlan(model,snapshot,baseline))return fail('invalid_full_solution_witness');
  const semantics=baseline.goalSemantics==='colors'?'colors':'identity',p=context(model,snapshot,semantics),locked=new Set(baseline.initialProtectedNodes||[]),stages=[];
  let pendingWord=[],pendingNew=[];
  for(const input of baseline.stages){
   const newly=input.newlySolvedNodes.filter(n=>!locked.has(n));
   if(!newly.length||!input.moveIndices.length)return fail('nonprogressing_full_solution_stage');
   pendingWord.push(...input.moveIndices);pendingNew.push(...newly.filter(n=>!pendingNew.includes(n)));
   const stage={...input,protectedNodes:[...locked],newlySolvedNodes:pendingNew.slice(),moveIndices:pendingWord.slice(),goalSemantics:semantics,guidedAuto:true};
   try{stage.choices=inspectStage(p,stage,locked);}catch(error){
    // A color-optimized stage can merely secure coincidentally correct colors.
    // Join only such invisible-progress stages to the next visible placement;
    // do not protect every incidental goal match or regroup the whole solve.
    if(error.message==='guided_stage_has_no_visible_progress_pair')continue;throw error;
   }
   stage.sourceNode=stage.choices[0].sourceNode;stage.targetNode=stage.choices[0].targetNode;
   stages.push(stage);pendingWord=[];pendingNew=[];
  }
  if(pendingWord.length)return fail('guided_final_stage_has_no_visible_progress');
  if([...p.homeAt.keys()].some(n=>!p.correct(n)))return fail('guided_final_goal_not_reached');
  const plan={...baseline,guidedAuto:true,goalSemantics:semantics,method:'interactive_secured_prefix',initialProtectedNodes:(baseline.initialProtectedNodes||[]).slice(),finalProtectedNodes:[...locked],stages,moveIndices:baseline.moveIndices.slice(),stats:{...baseline.stats,stages:stages.length,guidedBaselineStages:baseline.stages.length}};
  if(!verifyAutoHoldsPlan(model,snapshot,plan))return fail('internal_guided_auto_verification_failed');
  return plan;
 }catch(error){return fail(error.message);}
}
function verifyAutoHoldsPlan(model,snapshot,plan){
 try{
  if(plan?.status!=='solved'||plan.guidedAuto!==true||!verifyAutoPlan(model,snapshot,plan))return false;
  const p=context(model,snapshot,plan.goalSemantics),locked=new Set(plan.initialProtectedNodes||[]);
  for(const stage of plan.stages){const choices=inspectStage(p,stage,locked);if(JSON.stringify(stage.choices)!==JSON.stringify(choices))return false;}
  return sameNodes(plan.finalProtectedNodes,[...locked])&&locked.size===p.ids.length&&[...p.homeAt.keys()].every(n=>p.correct(n));
 }catch{return false;}
}
function verifyAutoHoldsStage(model,snapshot,stage,lockedNodes){
 try{
  if(stage?.guidedAuto!==true||!Array.isArray(lockedNodes)||new Set(lockedNodes).size!==lockedNodes.length)return false;
  const p=context(model,snapshot,stage.goalSemantics),locked=new Set(lockedNodes),choices=inspectStage(p,stage,locked);
  return JSON.stringify(stage.choices)===JSON.stringify(choices);
 }catch{return false;}
}
module.exports={makeAutoHoldsPlan,verifyAutoHoldsPlan,verifyAutoHoldsStage};
