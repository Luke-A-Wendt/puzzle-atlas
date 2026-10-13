'use strict';
// A bounded acceptance check for newly added models. Run after exporting the
// engine and precomputing its complete cache: node tools/verify-additions.cjs ID…
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const E=require('./export-models.cjs');
const {solveFull}=require('../src/full-solve.cjs');
const {solveSync,verify}=require('../src/index.cjs');
const {mapSnapshot}=require('../src/atlas-adapter.cjs');
const {EligibilityAnalyzer,eligibilityStatus}=require('../src/eligibility.cjs');
const {verifyRepresentativeTable}=require('./audit-complete-coverage.cjs');

// Find a legal exchanging word without assuming an allowed primitive is an
// involution. This independent forward BFS explores ordered-pair orbits only:
// at most N(N-1) states, never all full puzzle arrangements. Completing an orbit
// also lets later candidates in that orbit be skipped. Finding no witness is
// an impossibility certificate only when every candidate orbit was exhausted.
function findExchangeWitness(model,occupiedNodes,{maxMs=5000,maxStates=50000,maxDepth=20}={}){
 const started=performance.now(),d=model.degree,occupied=occupiedNodes.slice().sort((a,b)=>a-b),visited=new Set();let transitions=0,completedOrbits=0,pointTransitions=0,pointOrbits=0;
 const stats=()=>({states:visited.size,transitions,completedOrbits,pointTransitions,pointOrbits,elapsedMs:performance.now()-started});
 const unknown=reason=>({status:'unknown',reason,stats:stats()});
 const pointLabels=new Int32Array(d).fill(-1);
 for(let x=0;x<d;x++){if(pointLabels[x]>=0)continue;const queue=[x];pointLabels[x]=pointOrbits;for(let head=0;head<queue.length;head++)for(const move of model.moves){if((pointTransitions++&255)===0&&performance.now()-started>=maxMs)return unknown('witness_time_limit');const y=move.perm[queue[head]];if(pointLabels[y]>=0)continue;pointLabels[y]=pointOrbits;queue.push(y);}pointOrbits++;}
 for(let ai=0;ai<occupied.length;ai++)for(let bi=ai+1;bi<occupied.length;bi++){
  const a=occupied[ai],b=occupied[bi],start=a*d+b,target=b*d+a;if(pointLabels[a]!==pointLabels[b]||visited.has(start))continue;
  const rows=[{pair:start,parent:-1,move:-1,depth:0}],local=new Set([start]);let targetAt=-1;
  if(visited.size>=maxStates)return unknown('witness_state_limit');visited.add(start);
  for(let head=0;head<rows.length&&targetAt<0;head++){
   const row=rows[head],x=Math.floor(row.pair/d),y=row.pair%d;
   if(row.depth>=maxDepth)return unknown('witness_depth_limit');
   for(let mi=0;mi<model.moves.length;mi++){
    if((transitions++&255)===0&&performance.now()-started>=maxMs)return unknown('witness_time_limit');
    const p=model.moves[mi].perm,next=p[x]*d+p[y];if(local.has(next))continue;
    if(visited.size>=maxStates)return unknown('witness_state_limit');
    local.add(next);visited.add(next);rows.push({pair:next,parent:head,move:mi,depth:row.depth+1});
    if(next===target){targetAt=rows.length-1;break;}
   }
  }
  if(targetAt>=0){
   const moveIndices=[];for(let k=targetAt;rows[k].parent>=0;k=rows[k].parent)moveIndices.push(rows[k].move);moveIndices.reverse();
   let perm=Array.from({length:d},(_,i)=>i);for(const mi of moveIndices)perm=perm.map(x=>model.moves[mi].perm[x]);
   assert.equal(perm[a],b);assert.equal(perm[b],a);
   return {status:'solved',swap:[a,b],moveIndices,perm,stats:stats()};
  }
  completedOrbits++;
 }
 return {status:'impossible',reason:'all_occupied_ordered_pair_orbits_exhausted',stats:stats()};
}

function verifyAddition(id){
 const started=performance.now(),model=require('../data/'+id+'.json'),cache=require('../data/full-solver/'+id+'.json');
 assert.equal(cache.status,'ready');assert.equal(cache.complete,true);
 const certificate=verifyRepresentativeTable(model,cache);
 assert(certificate.solutionLengthUpperBound<=20000,'All states must fit the browser output limit');
 const engine=E.loadSnapshot(id),adapter=model.requiresOccupiedState?E.shapeAdapter(engine):E.fixedAdapter(engine);
 if(engine.source.file.endsWith('.js'))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../../dist',engine.source.file))).digest('hex'),engine.source.sha256,'Export snapshot differs from the current website engine');
 const moves=E.validate(engine,adapter,model.moves),original=adapter.getState().map(s=>structuredClone(s));
 const home=Object.fromEntries(original.map((s,i)=>[String(s.id),adapter.initialOccupied[i]]));
 const samples=[];
 for(let trial=0;trial<3;trial++){
  adapter.reset();let seed=(0x9e3779b9+7297*trial)>>>0;const scrambleLength=[30,60,120][trial];
  for(let k=0;k<scrambleLength;k++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;adapter.apply(model.moves[(seed>>>0)%model.moves.length].engineMove);}
  // Only the current snapshot is passed to solveFull. No move journal or
  // scramble word is available to the solver.
  const current=mapSnapshot(model,{stickers:adapter.getState()}).stickerToNode;
  assert(Object.keys(home).some(k=>current[k]!==home[k]),'Scramble must be nontrivial');
  const result=solveFull(model,{homeBySticker:home,currentBySticker:current},{cache,maxMs:10000,maxOutputMoves:20000});
  assert.equal(result.status,'solved',id+': '+result.reason);assert.equal(result.verified,true);
  for(const stage of result.stages){
   const before=mapSnapshot(model,{stickers:adapter.getState()}).stickerToNode;
   for(const mi of stage.moveIndices)adapter.apply(model.moves[mi].engineMove);
   const after=mapSnapshot(model,{stickers:adapter.getState()}).stickerToNode;
   const byPosition=new Map(Object.entries(before).map(([sticker,slot])=>[slot,sticker]));
   for(const slot of stage.protectedNodes)assert.equal(after[byPosition.get(slot)],slot);
   assert.equal(after[byPosition.get(stage.sourceNode)],stage.targetNode);
  }
  assert.deepEqual({...mapSnapshot(model,{stickers:adapter.getState()}).stickerToNode},home);
  if(engine.model?.isExactSolved)assert.equal(engine.model.isExactSolved(),true,id+': all physical piece orientations must be restored');
  else if(engine.model?.isSolved)assert.equal(engine.model.isSolved(),true,id+': engine solved predicate');
  samples.push({scrambleLength,moves:result.moveIndices.length,stages:result.stages.length,planningMs:result.stats.elapsedMs});
 }
 // Construct a legal two-endpoint exchange, then hold the occupied addresses
 // fixed by that word. Empty shape-pose addresses are never presented as tiles.
 const occupied=adapter.initialOccupied.slice(),witness=findExchangeWitness(model,occupied);
 assert.equal(witness.status,'solved',id+': bounded legal exchange witness '+witness.reason);
 const [a,b]=witness.swap,request={swap:[a,b],protected:occupied.filter(i=>witness.perm[i]===i),...(model.requiresOccupiedState?{occupiedNodes:occupied}:{})};
 assert.equal(verify(model,request,witness.moveIndices),true);
 const swap=solveSync(model,request,{maxMs:3000,searchMs:450,maxSearchDepth:12,maxSearchStates:15000,maxStorageBytes:48*1024*1024});
 assert.equal(swap.status,'solved',id+': constrained swap '+swap.reason);
 assert.equal(verify(model,request,swap.moveIndices),true);
 adapter.reset();const before=mapSnapshot(model,{stickers:adapter.getState()}).stickerToNode;
 for(const mi of swap.moveIndices)adapter.apply(model.moves[mi].engineMove);
 const after=mapSnapshot(model,{stickers:adapter.getState()}).stickerToNode,byPosition=new Map(Object.entries(before).map(([sticker,slot])=>[slot,sticker]));
 assert.equal(after[byPosition.get(a)],b);assert.equal(after[byPosition.get(b)],a);
 for(const i of request.protected)assert.equal(after[byPosition.get(i)],i);
 const analyzer=new EligibilityAnalyzer(model,cache),eligible=analyzer.analyze(request,{maxMs:3000,maxStorageBytes:48*1024*1024});
 assert(['complete','partial'].includes(eligible.status),id+': eligibility '+eligible.reason);
 assert.equal(eligibilityStatus(eligible,a,b),1,id+': independently witnessed pair must be available');
 assert.equal(eligible.firstStatus[a],1);assert.equal(eligible.firstStatus[b],1);
 for(const held of request.protected)assert.equal(eligible.firstStatus[held],2);
 return {id,status:'verified',degree:model.degree,moves:model.moves.length,cacheBytes:fs.statSync(path.join(__dirname,'../data/full-solver',id+'.json')).size,modelBytes:fs.statSync(path.join(__dirname,'../data',id+'.json')).size,compile:cache.stats,certificate,engineChecks:moves,samples,constrainedSwap:{moves:swap.moveIndices.length,held:request.protected.length,optimal:swap.optimal,planningMs:swap.stats.totalMs,independentWitnessMoves:witness.moveIndices.length,witnessDiscovery:witness.stats},eligibility:{status:eligible.status,planningMs:eligible.stats.elapsedMs,operations:eligible.stats.operations},elapsedMs:performance.now()-started};
}
module.exports={verifyAddition,findExchangeWitness};
if(require.main===module){const ids=process.argv.slice(2);if(!ids.length)throw Error('Provide the puzzle IDs to verify');for(const id of ids)console.log(JSON.stringify(verifyAddition(id)));}
