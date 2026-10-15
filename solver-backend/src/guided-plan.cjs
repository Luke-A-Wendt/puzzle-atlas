'use strict';
/* Guided play derives monotonically improving checkpoints from a legal full
 * witness. It never treats a general placement as a two-sticker transposition.
 * A checkpoint preserves every previously correct color, including coincidental
 * correct locations outside the stabilizer prefix. Grouping may therefore join
 * several full-solver stages, in the extreme the entire verified solution. */
const {autoRequestFromSnapshot}=require('./auto-adapter.cjs');
function problem(model,request,exactProgress=false){
 const home=request?.homeBySticker??model.homeBySticker,current=request?.currentBySticker;
 if(!home||!current)throw Error('current_and_home_mapping_required');
 const ids=Object.keys(home),colors=request?.colorBySticker??model.colorBySticker;
 const valid=n=>Number.isInteger(n)&&n>=0&&n<model.degree;
 if(!ids.length||ids.length!==Object.keys(current).length||ids.some(id=>!valid(home[id])||!valid(current[id])||typeof colors?.[id]!=='string')||new Set(Object.values(home)).size!==ids.length||new Set(Object.values(current)).size!==ids.length)throw Error('invalid_guided_mapping');
 const homeAt=new Map(ids.map(id=>[home[id],id])),colorGoal=!exactProgress&&model.colorRelaxationSafe===true&&!model.requiresOccupiedState&&ids.length===model.degree;
 return{model,home,ids,colors,homeAt,colorGoal,progressIndex:colorGoal?0:1};
}
function inspect(p,current){
 const at=new Map(p.ids.map(id=>[current[id],id])),correct=[],identity=[];
 for(const [node,id]of p.homeAt){if(p.colors[at.get(node)]===p.colors[id])correct.push(node);if(current[id]===node)identity.push(node);}
 return{at,correct,identity,metric:[correct.length,identity.length],done:p.colorGoal?correct.length===p.ids.length:identity.length===p.ids.length};
}
// Displayed progress uses the actual goal: colors only where identities are
// interchangeable; otherwise exact tile poses. Never clamp a regressing state.
function improves(p,before,after){return after.metric[p.progressIndex]>before.metric[p.progressIndex];}
function replay(p,current,indices,permutation){
 for(const index of indices){if(!Number.isInteger(index)||!p.model.moves[index])throw Error('invalid_guided_move');const move=p.model.moves[index].perm;for(const id of p.ids)current[id]=move[current[id]];if(permutation)for(let i=0;i<permutation.length;i++)permutation[i]=move[permutation[i]];}
}
function sameSet(a,b){return Array.isArray(a)&&a.length===b.length&&new Set(a).size===a.length&&a.every(n=>b.includes(n));}
function pickMarkers(p,before,after,permutation){
 const newlyColor=after.correct.filter(n=>!before.correct.includes(n)),newlyIdentity=after.identity.filter(n=>!before.identity.includes(n));
 const candidates=[...newlyColor,...newlyIdentity];let sourceNode,targetNode;
 for(const target of candidates){const source=permutation.indexOf(target);if(source!==target&&before.at.has(source)){sourceNode=source;targetNode=target;if(before.at.has(target))break;}}
 if(sourceNode===undefined)throw Error('guided_progress_has_no_moved_target');
 // Pose-expanded shape targets can currently be empty. In that case mark two
 // participating visible stickers, while retaining the actual target address.
 const displayNodes=[sourceNode];
 if(before.at.has(targetNode)&&targetNode!==sourceNode)displayNodes.push(targetNode);
 else for(const n of before.at.keys())if(n!==sourceNode&&permutation[n]!==n){displayNodes.push(n);break;}
 return{sourceNode,targetNode,displayNodes,displayKind:displayNodes[1]===targetNode?'placement':'participants'};
}
function groupGuidedPlan(model,request,baseline,options={}){
 if(baseline?.status!=='solved')return baseline;
 const started=performance.now(),fail=reason=>({status:'unknown',reason,optimal:false,verified:false,stages:[],moveIndices:[]});
 try{
  const p=problem(model,request,options.exactProgress),current={...request.currentBySticker},first=inspect(p,current),requested=options.protectedNodes??[];
  if(!Array.isArray(requested)||requested.some(n=>!Number.isInteger(n)||!first.at.has(n)))return fail('invalid_guided_holds');
  const conflicts=requested.filter(n=>!first.correct.includes(n));
  if(conflicts.length)return{...fail('guided_holds_conflict'),conflictingNodes:conflicts};
  const result={status:'solved',guided:true,goalSemantics:p.colorGoal?'colors':'identity',protectionSemantics:'colors',progressSemantics:p.progressIndex?'identity':'colors',initialProtectedNodes:first.correct.slice(),finalProtectedNodes:[...p.homeAt.keys()],stages:[],moveIndices:[],optimal:false,verified:true,method:'monotone_guided_checkpoints'};
  if(first.done)return{...result,optimal:true,stats:{moves:0,stages:0,guidedGroupingMs:performance.now()-started}};
  let before=first,segment=[],permutation=Array.from({length:model.degree},(_,i)=>i);
  for(const stage of baseline.stages){
   segment.push(...stage.moveIndices);replay(p,current,stage.moveIndices,permutation);const after=inspect(p,current),correct=new Set(after.correct);
   if(!before.correct.every(n=>correct.has(n))||!improves(p,before,after))continue;
   const markers=pickMarkers(p,before,after,permutation);
   result.stages.push({...markers,moveIndices:segment,protectedNodes:before.correct.slice(),newlySolvedNodes:after.correct.filter(n=>!before.correct.includes(n)),newlyPlacedNodes:after.identity.filter(n=>!before.identity.includes(n)),progressBefore:before.metric.slice(),progressAfter:after.metric.slice(),goalSemantics:result.goalSemantics,progressSemantics:result.progressSemantics,guided:true});
   result.moveIndices.push(...segment);segment=[];before=after;permutation=Array.from({length:model.degree},(_,i)=>i);
   if(after.done)break;
  }
  if(!before.done||segment.length)return fail('guided_checkpoint_verification_failed');
  result.stats={...baseline.stats,moves:result.moveIndices.length,stages:result.stages.length,baselineStages:baseline.stages.length,guidedGroupingMs:performance.now()-started};
  return result;
 }catch(e){return fail(e.message);}
}
function checkStep(p,current,stage){
 const before=inspect(p,current);
 if(!stage||stage.guided!==true||!Array.isArray(stage.moveIndices)||!stage.moveIndices.length||stage.moveIndices.length>20000||!sameSet(stage.protectedNodes,before.correct))return false;
 if(!Array.isArray(stage.progressBefore)||stage.progressBefore.length!==2||stage.progressBefore.some((v,i)=>v!==before.metric[i]))return false;
 const permutation=Array.from({length:p.model.degree},(_,i)=>i);replay(p,current,stage.moveIndices,permutation);const after=inspect(p,current),correct=new Set(after.correct);
 if(!before.correct.every(n=>correct.has(n))||!improves(p,before,after)||stage.goalSemantics!==(p.colorGoal?'colors':'identity')||stage.progressSemantics!==(p.progressIndex?'identity':'colors'))return false;
 if(!Array.isArray(stage.progressAfter)||stage.progressAfter.length!==2||stage.progressAfter.some((v,i)=>v!==after.metric[i]))return false;
 if(!sameSet(stage.newlySolvedNodes,after.correct.filter(n=>!before.correct.includes(n)))||!sameSet(stage.newlyPlacedNodes,after.identity.filter(n=>!before.identity.includes(n))))return false;
 const markers=pickMarkers(p,before,after,permutation);
 return markers.sourceNode===stage.sourceNode&&markers.targetNode===stage.targetNode&&markers.displayKind===stage.displayKind&&Array.isArray(stage.displayNodes)&&markers.displayNodes.length===stage.displayNodes.length&&markers.displayNodes.every((n,i)=>n===stage.displayNodes[i]);
}
function verifyGuidedStep(model,snapshot,stage){try{const request=autoRequestFromSnapshot(model,snapshot),p=problem(model,request,!!snapshot?.mirrorMode);return checkStep(p,{...request.currentBySticker},stage);}catch{return false;}}
function verifyGuidedPlan(model,snapshot,plan){
 try{
  if(plan?.status!=='solved'||plan.guided!==true||plan.protectionSemantics!=='colors'||!Array.isArray(plan.stages)||!Array.isArray(plan.moveIndices)||plan.moveIndices.length>20000)return false;
  const request=autoRequestFromSnapshot(model,snapshot),p=problem(model,request,!!snapshot?.mirrorMode),current={...request.currentBySticker},initial=inspect(p,current);
  if(plan.progressSemantics!==(p.progressIndex?'identity':'colors')||plan.goalSemantics!==(p.colorGoal?'colors':'identity')||!sameSet(plan.initialProtectedNodes,initial.correct)||!sameSet(plan.finalProtectedNodes,[...p.homeAt.keys()]))return false;
  const flat=[];for(const stage of plan.stages){if(!checkStep(p,current,stage))return false;flat.push(...stage.moveIndices);if(flat.length>20000)return false;}
  return flat.length===plan.moveIndices.length&&flat.every((n,i)=>n===plan.moveIndices[i])&&inspect(p,current).done;
 }catch{return false;}
}
module.exports={groupGuidedPlan,verifyGuidedPlan,verifyGuidedStep};
