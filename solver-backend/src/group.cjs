'use strict';

/* Exact permutation-group backend. All permutations map source -> destination;
 * compose(a,b) applies a first, then b. Protected nodes are fixed at endpoints.
 * Deterministic Schreier closure is completed before any impossibility claim.
 */
const now = () => Number(process.hrtime.bigint()) / 1e6;
class Limit extends Error { constructor(reason) { super(reason); this.name = 'GroupLimit'; } }
function identity(d) { return Uint32Array.from({length:d},(_,i)=>i); }
function compose(a,b) { const p=new Uint32Array(a.length); for(let i=0;i<a.length;i++)p[i]=b[a[i]];return p; }
function inverse(a) { const p=new Uint32Array(a.length);for(let i=0;i<a.length;i++)p[a[i]]=i;return p; }
function isIdentity(a) {for(let i=0;i<a.length;i++)if(a[i]!==i)return false;return true;}
function key(a) {return Array.prototype.join.call(a,',');}
function firstMoved(a,base) {for(let i=0;i<base.length;i++)if(a[base[i]]!==base[i])return i;return base.length;}
function compileModel(model) {
  const d=model.degree??model.nodeCount??model.moves?.[0]?.perm?.length;
  if(!Number.isInteger(d)||d<1)throw new Error('Model needs a positive integer degree.');
  const moves=model.moves.map((v,index)=>{
    const raw=v.perm??v.dest??v.permutation??v;
    if(raw.length!==d)throw new Error('Move permutation has wrong degree.');
    const seen=new Uint8Array(d);for(const p of raw){if(!Number.isInteger(p)||p<0||p>=d||seen[p])throw new Error('Invalid move permutation.');seen[p]=1;}
    return {index,name:v.name??String(index),perm:Uint32Array.from(raw)};
  });
  const lookup=new Map(moves.map(x=>[key(x.perm),x.index]));
  for(const g of moves){g.invPerm=inverse(g.perm);g.invIndex=lookup.get(key(g.invPerm));}
  return {degree:d,moves,id:model.id??null};
}
function makeContext(input={}) {
  const config={maxMs:2000,maxStrongGenerators:2000,maxDagNodes:300000,maxOutputMoves:20000,maxOrbitStates:100000,maxStorageBytes:64*1024*1024,maxSchreierTests:3000000,...input};
  const start=now();const stats={schreierTests:0,compositions:0,rebuilds:0,pairStates:0,strongGenerators:0,dagNodes:0,estimatedPeakBytes:0};
  const ctx={config,start,stats,check(force=false){if(now()-start>config.maxMs)throw new Limit('time_limit');if(stats.schreierTests>config.maxSchreierTests)throw new Limit('schreier_test_limit');}};
  return ctx;
}
class Words {
  constructor(moves,ctx){this.nodes=[null];this.ctx=ctx;this.moves=moves;this.leaves=[];for(let i=0;i<moves.length;i++){this.leaves.push(this.nodes.length);this.nodes.push({move:i,len:1});}}
  length(id){return id===0?0:this.nodes[Math.abs(id)].len;}
  join(a,b){if(!a)return b;if(!b)return a;if(a===-b)return 0;
    if(this.nodes.length>=this.ctx.config.maxDagNodes)throw new Limit('word_dag_limit');
    checkStorage(this.ctx,this.nodes.length+1);
    const id=this.nodes.length;this.nodes.push({a,b,len:Math.min(Number.MAX_SAFE_INTEGER,this.length(a)+this.length(b))});return id;}
  list(parts){let r=0;for(const p of parts)r=this.join(r,p);return r;}
  flatten(id){
    const out=[],stack=[id],cfg=this.ctx.config;
    // Raw expansion can be huge even if algebraically cancellable; bound work too.
    let visits=0;const maxVisits=Math.max(10000,cfg.maxOutputMoves*100);
    while(stack.length){if((++visits&1023)===0)this.ctx.check();if(visits>maxVisits)throw new Limit('word_expansion_limit');
      const r=stack.pop();if(!r)continue;const n=this.nodes[Math.abs(r)];
      if(n.move!==undefined){
        if(r>0){this.pushReduced(out,n.move);}else{const move=this.moves[n.move];if(move.invIndex!==undefined)this.pushReduced(out,move.invIndex);else{
          // In a finite permutation group g^-1=g^(ord(g)-1). Avoid unbounded powers.
          let p=move.perm,ord=1;
          while(!isIdentity(p)){if(ord>cfg.maxOutputMoves)throw new Limit('inverse_expansion_limit');p=compose(p,move.perm);ord++;}
          for(let j=0;j<ord-1;j++)this.pushReduced(out,n.move);
        }}
        if(out.length>cfg.maxOutputMoves)throw new Limit('output_move_limit');
      }else if(r>0){stack.push(n.b,n.a);}else{stack.push(-n.a,-n.b);}
    }return out;
  }
  pushReduced(out,index){const last=out[out.length-1];if(last!==undefined&&this.moves[last].invIndex===index)out.pop();else out.push(index);}
}
function checkStorage(ctx,wordCount,extra=0) {
  const estimate=(ctx.storageBase??0)+(ctx.storageOrbit??0)+(ctx.storageBuilding??0)+(ctx.storagePair??0)+wordCount*80+extra;
  ctx.stats.estimatedPeakBytes=Math.max(ctx.stats.estimatedPeakBytes,estimate);
  if(estimate>ctx.config.maxStorageBytes)throw new Limit('storage_limit');
}
function genRecord(perm,word,base){return {perm,invPerm:null,word,level:firstMoved(perm,base)};}
function buildOrbits(gens,base,d,words,ctx,previous=null,rebuildUntil=base.length-1){
  const levels=[];let total=0;
  ctx.storageBase=(ctx.moveCount??0)*d*8+gens.length*(d*8+96);
  ctx.storageBuilding=0;
  checkStorage(ctx,words.nodes.length);
  for(let k=0;k<base.length;k++){
    if(previous && k>rebuildUntil){levels.push(previous[k]);ctx.storageBuilding+=previous[k].order.length*(8*d+144)+d*8+160+previous[k].gens.length*8;continue;}
    ctx.check();ctx.storageBuilding+=d*8+160;checkStorage(ctx,words.nodes.length);const sg=gens.filter(g=>g.level>=k);const b=base[k];
    const reps=new Array(d);const order=[b];reps[b]={perm:identity(d),invPerm:null,word:0};
    for(let q=0;q<order.length;q++){
      if((q&15)===0)ctx.check();const x=order[q],rx=reps[x];
      for(const g of sg){const y=g.perm[x];if(reps[y])continue;
        ctx.storageBuilding+=8*d+144;checkStorage(ctx,words.nodes.length);
        reps[y]={perm:compose(rx.perm,g.perm),invPerm:null,word:words.join(rx.word,g.word)};ctx.stats.compositions++;order.push(y);
      }
    }
    total+=order.length;if(total>ctx.config.maxOrbitStates)throw new Limit('orbit_storage_limit');
    ctx.storageBuilding+=8*d+144+sg.length*8;checkStorage(ctx,words.nodes.length);
    levels.push({base:b,gens:sg,reps,order});
  }ctx.storageOrbit=ctx.storageBuilding;ctx.storageBuilding=0;return levels;
}
function invRep(rep){return rep.invPerm??(rep.invPerm=inverse(rep.perm));}
function sift(perm,levels,start,ctx,parts){
  let h=perm;
  for(let k=start;k<levels.length;k++){
    const l=levels[k],x=h[l.base];if(x===l.base)continue;const t=l.reps[x];
    if(!t)return {remainder:h,level:k,parts};
    h=compose(h,invRep(t));ctx.stats.compositions++;parts.push(-t.word);
  }
  return {remainder:h,level:levels.length,parts};
}
function buildChain(compiled,base,ctx,words){
  const d=compiled.degree;const gens=[];const known=new Set();
  for(const g of compiled.moves){if(isIdentity(g.perm))continue;const k=key(g.perm);if(known.has(k))continue;known.add(k);gens.push(genRecord(g.perm,words.leaves[g.index],base));}
  let levels,dirtyLevel=base.length-1;
  for(;;){
    ctx.check();ctx.stats.rebuilds++;ctx.stats.strongGenerators=gens.length;
    if(gens.length>ctx.config.maxStrongGenerators)throw new Limit('strong_generator_limit');
    levels=buildOrbits(gens,base,d,words,ctx,levels,dirtyLevel);
    let added=false;
    // Lower stabilizers first keep residues short, and reduce later candidates.
    outer: for(let k=dirtyLevel;k>=0;k--){
      const l=levels[k];if(l.order.length===1)continue;
      for(const x of l.order){const rx=l.reps[x];
        for(const s of l.gens){
          if((++ctx.stats.schreierTests&255)===0)ctx.check();
          const y=s.perm[x],ry=l.reps[y];
          // A tree edge has identity Schreier word and need not be formed.
          let h=compose(compose(rx.perm,s.perm),invRep(ry));ctx.stats.compositions+=2;
          if(isIdentity(h))continue;
          const result=sift(h,levels,k+1,ctx,[rx.word,s.word,-ry.word]);
          if(isIdentity(result.remainder))continue;
          const kk=key(result.remainder);if(known.has(kk))throw new Error('Internal Schreier closure invariant failed.');
          const word=words.list(result.parts);known.add(kk);gens.push(genRecord(result.remainder,word,base));dirtyLevel=result.level;added=true;break outer;
        }
      }
    }
    if(!added)break;
  }
  ctx.stats.strongGenerators=gens.length;ctx.stats.dagNodes=words.nodes.length;
  return {gens,levels,base,words,complete:true,degree:d};
}
function singleStabilizer(compiled,b,ctx,words){
  const d=compiled.degree,base=[b];const sg=compiled.moves.filter(g=>!isIdentity(g.perm)).map(g=>({perm:g.perm,word:words.leaves[g.index],level:0}));
  const l=buildOrbits(sg,base,d,words,ctx)[0],out=[],known=new Set();
  for(const x of l.order){const rx=l.reps[x];for(const g of sg){
    if((++ctx.stats.schreierTests&63)===0)ctx.check();const ry=l.reps[g.perm[x]];
    const h=compose(compose(rx.perm,g.perm),invRep(ry));ctx.stats.compositions+=2;
    if(isIdentity(h))continue;const k=key(h);if(known.has(k))continue;known.add(k);
    if(out.length>=ctx.config.maxStrongGenerators)throw new Limit('strong_generator_limit');
    ctx.storageBase=(ctx.moveCount??0)*d*8+(out.length+1)*(d*8+96);checkStorage(ctx,words.nodes.length);
    out.push({perm:h,word:words.list([rx.word,g.word,-ry.word])});
  }}ctx.stats.strongGenerators=out.length;return out;
}
function pairTransport(gens,a,b,d,ctx){
  const start=a*d+b,target=b*d+a;
  const records=new Map([[start,{prev:-1,gen:-1}]]);const queue=[start];
  let found=start===target;
  for(let q=0;q<queue.length&&!found;q++){
    if((q&63)===0)ctx.check();const state=queue[q],x=Math.floor(state/d),y=state%d;
    for(let i=0;i<gens.length;i++){
      const p=gens[i].perm,next=p[x]*d+p[y];if(records.has(next))continue;
      if(records.size>=ctx.config.maxOrbitStates)throw new Limit('pair_orbit_limit');
      ctx.storagePair=(records.size+1)*120;checkStorage(ctx,ctx.wordCount??0);
      records.set(next,{prev:state,gen:i});queue.push(next);
      if(next===target){found=true;break;}
    }
  }
  ctx.stats.pairStates=records.size;if(!found)return null;
  const genIds=[];for(let s=target;s!==start;){const r=records.get(s);genIds.push(r.gen);s=r.prev;}genIds.reverse();return genIds;
}
function verifyWitness(compiled,protectedNodes,a,b,indices){
  let p=identity(compiled.degree);for(const i of indices)p=compose(p,compiled.moves[i].perm);
  return p[a]===b&&p[b]===a&&protectedNodes.every(x=>p[x]===x);
}
function solveGroup({model,protected:protectedNodes=[],swap,budget={},compiled:given,chain:givenChain}={}){
  const ctx=makeContext(budget);let words,compiled;
  try{
    compiled=given??compileModel(model);const d=compiled.degree;ctx.moveCount=compiled.moves.length;ctx.storageBase=ctx.moveCount*d*8;checkStorage(ctx,0);
    if(!Array.isArray(swap)||swap.length!==2||!swap.every(x=>Number.isInteger(x)&&x>=0&&x<d))throw new Error('swap must contain two valid node indices.');
    const [a,b]=swap;const seen=new Set();const fixed=[];
    for(const x of protectedNodes){if(!Number.isInteger(x)||x<0||x>=d)throw new Error('Invalid protected node.');if(!seen.has(x)){seen.add(x);fixed.push(x);}}
    if(a===b)return {status:'solved',moves:[],moveIndices:[],optimal:true,stats:{...ctx.stats,elapsedMs:now()-ctx.start}};
    if(seen.has(a)||seen.has(b))return {status:'impossible',reason:'selected_node_is_protected',proof:'contradictory_constraints',stats:{...ctx.stats,elapsedMs:now()-ctx.start}};
    words=new Words(compiled.moves,ctx);let sg,chain;
    if(!fixed.length){sg=compiled.moves.filter(g=>!isIdentity(g.perm)).map(g=>({perm:g.perm,word:words.leaves[g.index]}));}
    else if(fixed.length===1){sg=singleStabilizer(compiled,fixed[0],ctx,words);}
    else{
      const base=[...fixed,a,b];const bs=new Set(base);for(let i=0;i<d;i++)if(!bs.has(i))base.push(i);
      chain=buildChain(compiled,base,ctx,words);sg=chain.gens.filter(g=>g.level>=fixed.length);
    }
    ctx.wordCount=words.nodes.length;const ids=pairTransport(sg,a,b,d,ctx);
    if(ids===null)return {status:'impossible',reason:'pair_outside_stabilizer_orbit',proof:'complete_schreier_chain_and_pair_orbit',stats:{...ctx.stats,dagNodes:words.nodes.length,elapsedMs:now()-ctx.start}};
    const word=words.list(ids.map(i=>sg[i].word));
    const moves=words.flatten(word);
    if(!verifyWitness(compiled,fixed,a,b,moves))throw new Error('Internal witness verification failed.');
    return {status:'solved',moves,moveIndices:moves,optimal:!fixed.length,method:fixed.length?'schreier_sims_pair_transporter':'ordered_pair_bfs',stats:{...ctx.stats,dagNodes:words.nodes.length,elapsedMs:now()-ctx.start}};
  }catch(e){if(e instanceof Limit)return {status:'unknown',reason:e.message,stats:{...ctx.stats,dagNodes:words?.nodes.length??0,elapsedMs:now()-ctx.start}};throw e;}
}
module.exports={solveGroup,compileModel,buildChain,makeContext,Words,compose,inverse,identity,key,verifyWitness,Limit};
