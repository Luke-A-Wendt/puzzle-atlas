'use strict';
// Exact bidirectional BFS on the orbit of the constrained ordered tuple.
function search(model, protectedNodes, swap, options={}) {
 const startTime=performance.now(), deadline=startTime+(options.maxMs??500), maxStates=options.maxStates??25000, maxDepth=options.maxDepth??12,maxBytes=options.maxBytes??32*1024*1024;
 const n=model.degree, perms=model.moves.map(m=>m.perm), inv=perms.map(p=>{const q=new Array(n);p.forEach((v,i)=>q[v]=i);return q;});
 const initial=[...protectedNodes,...swap], target=[...protectedNodes,swap[1],swap[0]], key=t=>t.join(',');
 // Estimate map entries, tuples, text keys, parent/frontier references and
 // allocation overhead. The worker's separate heap limit is the hard guard.
 const bytesPerState=256+40*initial.length,storageStates=Math.floor(maxBytes/bytesPerState),stateLimit=Math.min(maxStates,storageStates),limitReason=storageStates<=maxStates?'storage_limit':'search_state_limit';
 if(stateLimit<2)return {status:'unknown',reason:limitReason,optimal:false,lowerBound:1,stats:{method:'projected-bidirectional-bfs',searchStates:0,transitions:0,searchMs:performance.now()-startTime,estimatedBytes:0,bytesPerState,stateLimit,completedRadiusForward:0,completedRadiusBackward:0}};
 const makeSide=t=>{const k=key(t);return {seen:new Map([[k,{tuple:t,parent:null,move:-1}]]),front:[k],radius:0};};
 const F=makeSide(initial),B=makeSide(target);let transitions=0;
 const stats=()=>({method:'projected-bidirectional-bfs',searchStates:F.seen.size+B.seen.size,estimatedBytes:(F.seen.size+B.seen.size)*bytesPerState,bytesPerState,stateLimit,transitions,searchMs:performance.now()-startTime,completedRadiusForward:F.radius,completedRadiusBackward:B.radius});
 const unknown=reason=>({status:'unknown',reason,optimal:false,lowerBound:F.radius+B.radius+1,stats:stats()});
 for(;;){
  if(F.radius+B.radius>=maxDepth)return unknown('search_depth_limit');
  const forward=F.front.length<=B.front.length,side=forward?F:B,other=forward?B:F,moves=forward?perms:inv,next=[];
  let meet=null,best=Infinity;
  for(const k of side.front){const row=side.seen.get(k);
   for(let mi=0;mi<moves.length;mi++){
    if((transitions++&255)===0&&performance.now()>deadline)return unknown('search_time_limit');
    const tuple=row.tuple.map(v=>moves[mi][v]),kk=key(tuple);if(side.seen.has(kk))continue;
    if(F.seen.size+B.seen.size>=stateLimit)return unknown(limitReason);
    side.seen.set(kk,{tuple,parent:k,move:mi,depth:side.radius+1});next.push(kk);
    const o=other.seen.get(kk);if(o){const length=side.radius+1+(o.depth??0);if(length<best){best=length;meet=kk;}}
   }
  }
  side.front=next;side.radius++;
  if(meet!==null){
   const prefix=[];let k=meet;for(let row=F.seen.get(k);row.parent!==null;row=F.seen.get(k)){prefix.push(row.move);k=row.parent;}prefix.reverse();
   const suffix=[];k=meet;for(let row=B.seen.get(k);row.parent!==null;row=B.seen.get(k)){suffix.push(row.move);k=row.parent;}
   return {status:'solved',moveIndices:prefix.concat(suffix),optimal:true,lowerBound:best,stats:stats()};
  }
  if(next.length===0)return {status:'impossible',optimal:false,reason:'exhausted_constrained_tuple_orbit',stats:stats(),certificate:{kind:'complete-orbit',constrainedNodes:initial.length}};
 }
}
module.exports={search};
