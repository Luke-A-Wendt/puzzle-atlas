'use strict';
// A reusable, weighted Schreier stabilizer chain. Source -> destination maps.
const {compileModel, makeContext, Words, compose, inverse, identity, key, Limit, buildChain}=require('./group.cjs');
const {shorten}=require('./shorten.cjs');
const now=()=>performance.now();
const isIdentity=p=>p.every((x,i)=>x===i);
const firstMoved=(p,base)=>base.findIndex(x=>p[x]!==x);
function moveReducer(compiled){
 const singles=new Map([[key(identity(compiled.degree)),-1]]);
 compiled.moves.forEach((m,i)=>singles.set(key(m.perm),i));
 const table=compiled.moves.map(a=>compiled.moves.map(b=>singles.get(key(compose(a.perm,b.perm)))));
 return function reduce(sequence){const out=[];for(const x of sequence){const last=out.at(-1),v=last===undefined?undefined:table[last][x];if(v===undefined)out.push(x);else {out.pop();if(v>=0)out.push(v);}}return out;};
}
function weightedChain(compiled,base,ctx,words){
 const d=compiled.degree,gens=[],known=new Map(),reduce=moveReducer(compiled); let peak=0;
 function normalizeWord(word){if(words.length(word)>(ctx.config.normalizeMaxLength??2000))return word;const seq=reduce(words.flatten(word));return words.list(seq.map(i=>words.leaves[i]));}
 for(const m of compiled.moves){if(isIdentity(m.perm))continue;const k=key(m.perm);if(known.has(k))continue;const g={perm:m.perm,word:words.leaves[m.index],level:firstMoved(m.perm,base)};known.set(k,g);gens.push(g);}
 // Seed short commutators: legal local operations often fix almost all nodes.
 if(ctx.config.seedCommutators){
  const candidates=[];
  for(const a of compiled.moves)for(const b of compiled.moves){const p=compose(compose(compose(a.perm,b.perm),a.invPerm),b.invPerm);const support=p.reduce((s,x,i)=>s+(x!==i),0);if(!support||support>(ctx.config.seedSupport??Infinity))continue;const pk=key(p);if(known.has(pk))continue;
   const g={perm:p,word:words.list([words.leaves[a.index],words.leaves[b.index],-words.leaves[a.index],-words.leaves[b.index]]),level:firstMoved(p,base),support};known.set(pk,g);candidates.push(g);
  }
  candidates.sort((a,b)=>a.support-b.support);gens.push(...candidates);
 }
 let levels,dirty=base.length-1;
 for(;;){
  ctx.check();ctx.stats.rebuilds++;if(gens.length>ctx.config.maxStrongGenerators)throw new Limit('strong_generator_limit');
  const previous=levels;levels=[];
  for(let k=0;k<base.length;k++){
   if(previous&&k>dirty){levels.push(previous[k]);continue;}
   ctx.check();const b=base[k],sg=gens.filter(g=>g.level>=k),dist=new Float64Array(d).fill(Infinity),done=new Uint8Array(d),parents=new Array(d),reps=new Array(d),order=[];
   dist[b]=0;reps[b]={perm:identity(d),word:0};
   for(;;){let x=-1,best=Infinity;for(let q=0;q<d;q++)if(!done[q]&&dist[q]<best){x=q;best=dist[q];}if(x<0)break;
    done[x]=1;order.push(x);if(x!==b){const {prev,g}=parents[x];reps[x]={perm:compose(reps[prev].perm,g.perm),word:words.join(reps[prev].word,g.word)};ctx.stats.compositions++;}
    for(const g of sg){const y=g.perm[x],cost=best+words.length(g.word);if(cost<dist[y]){dist[y]=cost;parents[y]={prev:x,g};}}
   }
   levels.push({base:b,gens:sg,reps,order});
  }
  peak=Math.max(peak,(levels.reduce((s,l)=>s+l.order.length,0)*2*d*4+words.nodes.length*80+gens.length*d*8)*2);
  ctx.stats.estimatedPeakBytes=peak;if(peak>ctx.config.maxStorageBytes)throw new Limit('storage_limit');
  let added=false;
  outer:for(let k=dirty;k>=0;k--){const l=levels[k];if(l.order.length===1)continue;
   for(const x of l.order){const rx=l.reps[x];for(const s of l.gens){if((++ctx.stats.schreierTests&127)===0)ctx.check();const ry=l.reps[s.perm[x]];ry.invPerm??=inverse(ry.perm);
    let h=compose(compose(rx.perm,s.perm),ry.invPerm);ctx.stats.compositions+=2;if(isIdentity(h))continue;
    const parts=[rx.word,s.word,-ry.word];let failure=base.length;
    for(let j=k+1;j<levels.length;j++){const lj=levels[j],y=h[lj.base];if(y===lj.base)continue;const t=lj.reps[y];if(!t){failure=j;break;}t.invPerm??=inverse(t.perm);h=compose(h,t.invPerm);ctx.stats.compositions++;parts.push(-t.word);}
    if(isIdentity(h))continue;const hkey=key(h);if(known.has(hkey))throw Error('Chain invariant failed');
    const word=normalizeWord(words.list(parts)),g={perm:h,word,level:firstMoved(h,base)};known.set(hkey,g);gens.push(g);dirty=failure;added=true;break outer;
   }}
  }
  if(!added)break;
 }
 ctx.stats.strongGenerators=gens.length;ctx.stats.dagNodes=words.nodes.length;
 return {levels,gens,base,words,degree:d,complete:true};
}
module.exports={weightedChain};
function modelSignature(model){let h=2166136261;const put=x=>{h^=x;h=Math.imul(h,16777619)>>>0;};put(model.degree);put(model.moves.length);for(const m of model.moves)for(const x of m.perm)put(x);return h.toString(16).padStart(8,'0');}
function chooseBase(model,compiled){
 const occupied=model.requiresOccupiedState?model.initialOccupied:null;
 const seen=new Set(),orbits=[];
 for(let b=0;b<compiled.degree;b++){if(seen.has(b))continue;const q=[b];seen.add(b);for(let k=0;k<q.length;k++)for(const g of compiled.moves){const x=g.perm[q[k]];if(!seen.has(x)){seen.add(x);q.push(x);}}orbits.push(q.sort((a,b)=>a-b));}
 const base=orbits.flat();if(!occupied)return base;const occ=new Set(occupied);return [...base.filter(x=>occ.has(x)),...base.filter(x=>!occ.has(x))];
}
function serializeChain(model,chain,stats){
 const remap=new Map([[0,0]]),nodes=[null],reachable=new Set(),stack=[];
 for(const l of chain.levels)for(const x of l.order)if(x!==l.base)stack.push(l.reps[x].word);
 while(stack.length){const id=Math.abs(stack.pop());if(!id||reachable.has(id))continue;reachable.add(id);const n=chain.words.nodes[id];if(n.move===undefined)stack.push(n.a,n.b);}
 const mapped=id=>Math.sign(id)*(remap.get(Math.abs(id))??0);
 for(let id=1;id<chain.words.nodes.length;id++){if(!reachable.has(id))continue;const n=chain.words.nodes[id];remap.set(id,nodes.length);nodes.push(n.move!==undefined?[n.move]:[mapped(n.a),mapped(n.b)]);}
 const visit=mapped;
 const levels=chain.levels.map(l=>({base:l.base,entries:l.order.filter(x=>x!==l.base).map(x=>{const r=l.reps[x];return [x,visit(r.word),Array.from(r.perm)];})}));
 return {schemaVersion:1,status:'ready',modelId:model.id??null,modelSignature:modelSignature(model),degree:chain.degree,base:chain.base,levels,words:nodes,complete:true,stats};
}
function precomputeFull(model,options={}){
 const started=now(),ctx=makeContext({maxMs:options.maxMs??30000,maxStorageBytes:options.maxStorageBytes??160*1024*1024,maxOutputMoves:options.maxRepresentativeMoves??100000,maxDagNodes:500000,maxStrongGenerators:5000,maxSchreierTests:20000000,...options});let words;
 try{const compiled=compileModel(model);ctx.moveCount=compiled.moves.length;words=new Words(compiled.moves,ctx);const base=options.base??chooseBase(model,compiled);if(base.length!==compiled.degree||new Set(base).size!==compiled.degree||base.some(x=>!Number.isInteger(x)||x<0||x>=compiled.degree))throw Error('Invalid full stabilizer base');const chain=options.algorithm==='unweighted'?buildChain(compiled,base,ctx,words):weightedChain(compiled,base,ctx,words);return serializeChain(model,chain,{...ctx.stats,elapsedMs:now()-started});}
 catch(e){if(e instanceof Limit)return {status:'unknown',reason:e.message,stats:{...ctx.stats,dagNodes:words?.nodes.length??0,elapsedMs:now()-started}};throw e;}
}
function solveFull(model,request,options={}){
 const started=now(),deadline=started+(options.maxMs??30000),maxOutput=options.maxOutputMoves??20000;
 const fail=(status,reason,extra={})=>({status,reason,...extra,stats:{elapsedMs:now()-started}});
 try{
  const current=request?.currentBySticker,home=request?.homeBySticker??model.homeBySticker;
  if(!current||!home||typeof current!=='object'||typeof home!=='object')return fail('invalid','current_and_home_mapping_required');
  const ids=Object.keys(home),currentKeys=Object.keys(current);if(ids.length!==currentKeys.length||!ids.length||ids.some(id=>!Object.hasOwn(current,id)))return fail('invalid','sticker_mapping_keys_mismatch');
  const valid=x=>Number.isInteger(x)&&x>=0&&x<model.degree;
  if(ids.some(id=>!valid(home[id])||!valid(current[id]))||new Set(ids.map(id=>home[id])).size!==ids.length||new Set(ids.map(id=>current[id])).size!==ids.length)return fail('invalid','non_bijective_sticker_mapping');
  if(model.stickerCount!==undefined&&ids.length!==model.stickerCount)return fail('invalid','sticker_count_mismatch');
  if(ids.every(id=>current[id]===home[id]))return {status:'solved',stages:[],moveIndices:[],initialProtectedNodes:ids.map(id=>home[id]),finalProtectedNodes:ids.map(id=>home[id]),optimal:true,verified:true,method:'already_solved',stats:{elapsedMs:now()-started,moves:0,stages:0}};
  const cache=options.cache??precomputeFull(model,{...options,maxMs:Math.max(1,deadline-now())});if(cache.status!=='ready')return fail('unknown',cache.reason??'full_solver_cache_unavailable');
  if(cache.schemaVersion!==1||cache.degree!==model.degree||cache.modelSignature!==modelSignature(model)||!cache.complete)return fail('invalid','full_solver_cache_mismatch');
  const compiled=compileModel(model),words=new Words(compiled.moves,makeContext({maxMs:Math.max(1,deadline-now()),maxOutputMoves:maxOutput,maxDagNodes:Math.max(300000,cache.words.length+1)}));
  words.nodes=cache.words.map((n,i)=>{if(i===0)return null;if(n.length===1)return {move:n[0],len:1};return {a:n[0],b:n[1],len:0};});
  for(let i=1;i<words.nodes.length;i++){const n=words.nodes[i];if(n.move===undefined)n.len=Math.min(Number.MAX_SAFE_INTEGER,words.length(n.a)+words.length(n.b));}
  const byHome=new Map(ids.map(id=>[home[id],current[id]])),homes=new Set(byHome.keys()),base=cache.base.filter(x=>homes.has(x));
  if(base.length!==ids.length||cache.base.slice(0,ids.length).some(x=>!homes.has(x)))return fail('invalid','cache_home_base_mismatch');
  const initialProtectedNodes=[],locked=[],stages=[],allMoves=[];let at=0;
  while(at<base.length&&byHome.get(base[at])===base[at]){locked.push(base[at]);initialProtectedNodes.push(base[at++]);}
  while(at<base.length){
   if(now()>deadline)return fail('unknown','time_limit');const target=base[at],source=byHome.get(target),level=cache.levels[at];
   if(level.base!==target)return fail('invalid','cache_base_level_mismatch');const entry=level.entries.find(e=>e[0]===source);
   if(!entry)return fail('impossible','state_outside_legal_stabilizer_orbit',{proof:'complete_stabilizer_chain',failedTargetNode:target});
   let sequence=words.flatten(-entry[1]);if(allMoves.length+sequence.length>maxOutput)return fail('unknown','output_move_limit',{requiredAtLeastMoves:allMoves.length+sequence.length});
   if(options.shorten===true&&sequence.length>10&&deadline-now()>10)sequence=shorten(model,sequence,{maxMs:Math.min(80,deadline-now()),maxBytes:4*1024*1024}).moveIndices;
   let p=identity(model.degree);for(const index of sequence){if(now()>deadline)return fail('unknown','time_limit');p=compose(p,compiled.moves[index].perm);}
   if(p[source]!==target||locked.some(x=>p[x]!==x))return fail('unknown','internal_stage_verification_failed');
   const protectedNodes=locked.slice();for(const [h,x]of byHome)byHome.set(h,p[x]);const newlySolvedNodes=[];
   do{newlySolvedNodes.push(base[at]);locked.push(base[at++]);}while(at<base.length&&byHome.get(base[at])===base[at]);
   stages.push({moveIndices:sequence,protectedNodes,newlySolvedNodes,targetNode:target,sourceNode:source});allMoves.push(...sequence);
  }
  if([...byHome].some(([h,x])=>h!==x))return fail('unknown','internal_final_verification_failed');
  return {status:'solved',stages,moveIndices:allMoves,initialProtectedNodes,finalProtectedNodes:locked,optimal:false,verified:true,method:'weighted_stabilizer_placements',stats:{elapsedMs:now()-started,moves:allMoves.length,stages:stages.length}};
 }catch(e){if(e instanceof Limit)return fail('unknown',e.message);return fail('invalid',e.message);}
}
module.exports={precomputeFull,solveFull,modelSignature,chooseBase,weightedChain};
