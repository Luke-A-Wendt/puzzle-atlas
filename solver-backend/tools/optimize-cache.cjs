'use strict';
const {compileModel,compose,inverse,identity,key}=require('../src/group.cjs');
function optimizer(model,cache,options={}){
 const started=performance.now(),deadline=started+(options.maxMs??5000),compiled=compileModel(model),degree=model.degree,cap=options.maxCandidateLength??600,moveByKey=new Map([[key(identity(degree)),-1]]);compiled.moves.forEach(m=>moveByKey.set(key(m.perm),m.index));
 const pairTable=compiled.moves.map(a=>compiled.moves.map(b=>moveByKey.get(key(compose(a.perm,b.perm))))),inverseMoves=compiled.moves.map(m=>m.invIndex);
 if(inverseMoves.some(x=>x===undefined))return cache;
 const commutes=compiled.moves.map(a=>compiled.moves.map(b=>key(compose(a.perm,b.perm))===key(compose(b.perm,a.perm))));
 // Slide commuting moves together before combining powers/inverses. Every
 // rewrite is an equality of complete permutations, independent of the goal.
 const reduce=seq=>{const out=[],pending=seq.slice().reverse();while(pending.length){const x=pending.pop();let j=out.length-1,match;for(;j>=0;j--){match=pairTable[out[j]][x];if(match!==undefined)break;if(!commutes[out[j]][x]){j=-1;break;}}if(j<0){out.push(x);continue;}const tail=out.splice(j+1);out.pop();for(let t=tail.length-1;t>=0;t--)pending.push(tail[t]);if(match>=0)pending.push(match);}return out;};
 const lengths=[0];for(let i=1;i<cache.words.length;i++){const n=cache.words[i];lengths[i]=n.length===1?1:Math.min(1e9,lengths[Math.abs(n[0])]+lengths[Math.abs(n[1])]);}
 function flatten(id){if(lengths[Math.abs(id)]>(options.maxInitialWordLength??1500))return null;const out=[],stack=[id];while(stack.length){const r=stack.pop();if(!r)continue;const n=cache.words[Math.abs(r)];if(n.length===1)out.push(r>0?n[0]:inverseMoves[n[0]]);else if(r>0)stack.push(n[1],n[0]);else stack.push(-n[0],-n[1]);}return reduce(out);}
 const levels=cache.levels.map(l=>{const reps=new Map([[l.base,{perm:identity(degree),seq:[],word:0}]]);for(const e of l.entries)reps.set(e[0],{perm:Uint32Array.from(e[2]),seq:flatten(e[1]),word:e[1]});return{base:l.base,reps};});
 let changes=0,candidates=0;const gens=[];const genKeys=new Map();
 function addGen(p,seq){if(!seq||seq.length>(options.maxGeneratorLength??100))return;const k=key(p),known=genKeys.get(k);if(known){if(seq.length<known.seq.length)known.seq=seq;return;}if(gens.length>=(options.maxGenerators??12000))return;let level=0;while(level<degree&&p[cache.base[level]]===cache.base[level])level++;if(level===degree)return;const g={perm:p,seq,level};genKeys.set(k,g);gens.push(g);}
 function improve(p,seq,start=0){candidates++;for(let k=start;k<levels.length;k++){
  const l=levels[k],x=p[l.base];if(x===l.base)continue;let t=l.reps.get(x);if(!t)throw Error('Unexpected orbit escape');
  if(!t.seq||seq.length<t.seq.length){const old=t;t={perm:p,seq};l.reps.set(x,t);changes++;addGen(p,seq);p=old.perm;seq=old.seq;if(!seq)return;}
  if(seq.length+t.seq.length>cap*3)return;
  seq=reduce(seq.concat(t.seq.slice().reverse().map(i=>inverseMoves[i])));if(!seq.length)return;if(seq.length>cap)return;
  p=compose(p,t.inv??(t.inv=inverse(t.perm)));if(seq.length<=(options.maxResidualLength??18))addGen(p,seq);
 }}
 for(const m of compiled.moves)addGen(m.perm,[m.index]);
 for(const l of levels)for(const r of l.reps.values())addGen(r.perm,r.seq);
 // Systematic short seeds, then bounded deterministic words and conjugates.
 const seedGenerators=[];for(const a of compiled.moves)for(const b of compiled.moves){
  if(performance.now()>deadline)break;const seq=reduce([a.index,b.index,a.invIndex,b.invIndex]),p=compose(compose(compose(a.perm,b.perm),a.invPerm),b.invPerm);addGen(p,seq);improve(p,seq);if(seq.length)seedGenerators.push({perm:p,seq});
  improve(compose(a.perm,b.perm),reduce([a.index,b.index]));
 }
 let seed=(options.seed??123456789)>>>0;const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0;};
 for(let trial=0;trial<(options.randomSeeds??2000)&&performance.now()<deadline;trial++){
  let p=identity(degree),seq=[];
  if(trial%2===0&&seedGenerators.length){const g=seedGenerators[random()%seedGenerators.length],a=compiled.moves[random()%compiled.moves.length],b=compiled.moves[random()%compiled.moves.length];p=compose(compose(compose(compose(a.perm,b.perm),g.perm),b.invPerm),a.invPerm);seq=reduce([a.index,b.index,...g.seq,b.invIndex,a.invIndex]);}
  else{const len=3+random()%8;for(let j=0;j<len;j++){const g=compiled.moves[random()%compiled.moves.length];p=compose(p,g.perm);seq.push(g.index);}seq=reduce(seq);}
  improve(p,seq);
 }
 let passes=0;
 function orbitRelaxation(){
  for(let k=levels.length-1;k>=0&&performance.now()<deadline;k--){const l=levels[k];if(l.reps.size<2)continue;const pool=gens.filter(g=>g.level>=k),dist=new Float64Array(degree).fill(Infinity),done=new Uint8Array(degree),parent=new Array(degree),path=new Map([[l.base,{perm:identity(degree),seq:[]}]]);dist[l.base]=0;
   for(;;){let x=-1,best=Infinity;for(const y of l.reps.keys())if(!done[y]&&dist[y]<best){x=y;best=dist[y];}if(x<0)break;done[x]=1;
    if(x!==l.base){const prev=parent[x],before=path.get(prev.x);const seq=reduce(before.seq.concat(prev.g.seq)),p=compose(before.perm,prev.g.perm);path.set(x,{seq,perm:p});if(!l.reps.get(x).seq||seq.length<l.reps.get(x).seq.length)improve(p,seq,k);}
    for(const g of pool){const y=g.perm[x];if(!l.reps.has(y))throw Error('Generator escaped a certified orbit');const cost=best+g.seq.length;if(cost<dist[y]){dist[y]=cost;parent[y]={x,g};}}
   }
  }
 }
 while(performance.now()<deadline&&passes<(options.maxPasses??8)){passes++;const change0=changes;
  orbitRelaxation();
  const scheduled=gens.slice().sort((a,b)=>b.level-a.level||a.seq.length-b.seq.length);
  for(const g of scheduled){if(performance.now()>deadline)break;const l=levels[g.level];for(const r of l.reps.values()){
   if(!r.seq||r.seq.length+g.seq.length>cap)continue;improve(compose(r.perm,g.perm),reduce(r.seq.concat(g.seq)),g.level);if(performance.now()>deadline)break;
  }}
  if(changes===change0)break;
 }
 // Retain long original witnesses only where a bounded improvement was absent.
 const oldNodes=cache.words.slice(),leaf=compiled.moves.map(m=>{oldNodes.push([m.index]);return oldNodes.length-1;}),joins=new Map();
 function makeWord(seq){let id=0;for(const move of seq){const b=leaf[move];if(!id){id=b;continue;}const k=id+','+b;if(!joins.has(k)){joins.set(k,oldNodes.length);oldNodes.push([id,b]);}id=joins.get(k);}return id;}
 const built=levels.map(l=>({base:l.base,entries:[...l.reps].filter(([x])=>x!==l.base).map(([x,r])=>[x,r.seq?makeWord(r.seq):r.word,Array.from(r.perm)])}));
 const reach=new Set(),stack=built.flatMap(l=>l.entries.map(e=>e[1]));while(stack.length){const id=Math.abs(stack.pop());if(!id||reach.has(id))continue;reach.add(id);const n=oldNodes[id];if(n.length===2)stack.push(...n);}
 const remap=new Map([[0,0]]),nodes=[null],remapId=x=>Math.sign(x)*remap.get(Math.abs(x));for(let i=1;i<oldNodes.length;i++){if(!reach.has(i))continue;const n=oldNodes[i];remap.set(i,nodes.length);nodes.push(n.length===1?n:[remapId(n[0]),remapId(n[1])]);}
 cache.words=nodes;cache.levels=built.map(l=>({...l,entries:l.entries.map(e=>[e[0],remapId(e[1]),e[2]])}));
 cache.stats.optimization={elapsedMs:performance.now()-started,changes,candidates,passes,generators:gens.length,unshortenedRepresentatives:levels.reduce((sum,l)=>sum+[...l.reps.values()].filter(r=>!r.seq).length,0),seed:options.seed??123456789,solutionLengthUpperBound:levels.reduce((sum,l)=>sum+Math.max(0,...[...l.reps.values()].map(r=>r.seq?r.seq.length:lengths[Math.abs(r.word)])),0)};return cache;
}
module.exports={optimizer};
if(require.main===module){const fs=require('fs'),{solveFull}=require('../src/full-solve.cjs');for(const id of process.argv.slice(2)){const model=require('../data/'+id+'.json'),cache=require('../data/full-solver/'+id+'.json');if(cache.status!=='ready'){console.log(id,'notready');continue;}optimizer(model,cache,{maxMs:10000});const home=Object.fromEntries((model.initialOccupied??Array.from({length:model.degree},(_,i)=>i)).map((x,i)=>[i,x])),current={...home};let seed=123456789;for(let k=0;k<30;k++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;for(const id in current)current[id]=model.moves[seed%model.moves.length].perm[current[id]];}const r=solveFull(model,{homeBySticker:home,currentBySticker:current},{cache,maxOutputMoves:20000,maxMs:10000});console.log(id,cache.stats.optimization,r.status,r.reason,r.stats);fs.writeFileSync(require('node:path').join(__dirname,'../data/full-solver',id+'.json'),JSON.stringify(cache));}}
