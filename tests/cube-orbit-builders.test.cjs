'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),ctx={window:{},document:{addEventListener(){}}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'dist/cube-guides.js'),'utf8'),ctx);
const T=ctx.window.CUBE_GUIDE_TOOLS,key=s=>s.p+'|'+s.n,same=(a,b)=>String(a)===String(b);
let families=0,triples=0,words=0,homes=0,colors=0,wingSolves=0;
for(const n of [4,5,6,7,8,9,10]){
 const c={CUBE_SIZE:n};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'dist/games/nxn-engine.js'),'utf8'),c);
 const E=c.CubeEngine,S=E.makeSolved(),byId=new Map(S.map(s=>[s.id,s])),run=(s,word)=>word.reduce((s,m)=>E.applyMove(s,m),s),extent=E.extent;
 const kind=s=>s.p.filter(v=>Math.abs(v)===extent).length;
 for(const type of ['center','wing']){
  const covered=new Set();
  T.families(n,type).forEach((f,family)=>{
   const d=T.orbitData(n,type,family);families++;triples+=d.reachable;assert.equal(d.reachable,12144);
   for(const p of d.positions){assert(!covered.has(String(p)));covered.add(String(p));}
   // All primitive slot maps are independently checked against the actual engine.
   for(let j=0;j<d.moves.length;j++)for(let i=0;i<24;i++){
    const p=d.positions[i],sample=S.find(s=>same(s.p,p));assert(sample);
    assert.equal(String(E.applyMove([sample],d.moves[j].name)[0].p),String(d.positions[d.perms[j][i]]));
   }
   // Replay the complete generated word on every sticker, not just its tuple.
   for(const ids of [d.base,[0,7,23],[23,11,1],[9,4,19]]){
    const plan=T.buildCycle(n,type,family,ids),after=run(S,plan.word),cycle=new Map(ids.map((i,k)=>[String(d.positions[i]),String(d.positions[ids[(k+1)%3]])]));
    for(const s of after){const h=byId.get(s.id),target=cycle.get(String(h.p));if(target)assert.equal(String(s.p),target);else assert.equal(key(s),key(h),'every unselected sticker fixed');}
    assert.equal(after.filter(s=>key(s)!==key(byId.get(s.id))).length,type==='center'?3:6);
    assert(run(run(after,plan.word),plan.word).every(s=>key(s)===key(byId.get(s.id))));words++;
   }
   if(type==='wing'){
    let state=run(S,E.scramble('guide-wing-'+n+'-'+family,25)),loops=0,parityUsed=false;
    const R='R'+'i'.repeat(family+1),L='L'+'i'.repeat(family+1),repair=`${R}2 B2 U2 ${L} U2 ${R}' U2 ${R} U2 F2 ${R} F2 ${L}' B2 ${R}2`.split(' ');
    const sample=new Map();for(const p of d.positions)sample.set(String(p),S.find(s=>same(s.p,p)));
    while(true){const now=new Map(state.filter(s=>kind(s)===2).map(s=>[String(s.p),s])),wrong=d.positions.map((p,i)=>i).filter(i=>!same(byId.get(now.get(String(d.positions[i])).id).p,d.positions[i]));if(!wrong.length)break;assert(loops++<50);
     if(wrong.length===2){assert(!parityUsed,'at most one parity repair in each depth');parityUsed=true;state=run(state,repair);continue;}
     const a=wrong[0],home=byId.get(now.get(String(d.positions[a])).id).p,b=d.positions.findIndex(p=>same(p,home)),z=wrong.find(i=>i!==a&&i!==b);assert(b>=0&&z!==undefined);
     state=run(state,T.buildCycle(n,'wing',family,[a,b,z]).word);
    }
    for(const sticker of state)if(kind(sticker)===2&&d.positions.some(p=>same(p,sticker.p)))assert.equal(key(sticker),key(byId.get(sticker.id)),'exact wing orientation follows exact placement');
    wingSolves++;
   }
   if(type==='center'){
    // Reproduce the written monotonically decreasing color algorithm.
    let state=run(S,E.scramble('guide-center-'+n+'-'+family,25)),loops=0;
    const slots=new Map(S.map(s=>[String(s.p),s]));
    while(true){const now=new Map(state.filter(s=>kind(s)===1).map(s=>[String(s.p),s])),wrong=d.positions.map((p,i)=>i).filter(i=>now.get(String(d.positions[i])).color!==slots.get(String(d.positions[i])).color);if(!wrong.length)break;assert(loops++<25);
     const a=wrong[0],wanted=now.get(String(d.positions[a])).color,b=wrong.find(i=>slots.get(String(d.positions[i])).color===wanted);assert.notEqual(b,undefined);
     const z=wrong.length>2?wrong.find(i=>i!==a&&i!==b):d.positions.findIndex((p,i)=>i!==a&&i!==b&&now.get(String(p)).color===now.get(String(d.positions[b])).color&&now.get(String(p)).color===slots.get(String(p)).color);
     assert(z>=0);const before=wrong.length;state=run(state,T.buildCycle(n,'center',family,[a,b,z]).word);
     const after=new Map(state.filter(s=>kind(s)===1).map(s=>[String(s.p),s]));assert(d.positions.filter(p=>after.get(String(p)).color!==slots.get(String(p)).color).length<before);
    }colors++;
   }
  });
  assert.equal(covered.size,type==='center'?6*(n-2)**2-(n%2?6:0):24*Math.floor((n-2)/2));
 }
 // Every scrambled wing's two currently facing colors identify its exact home.
 let state=run(S,E.scramble('wing-home-helper-'+n,40));
 const positions=new Map();for(const s of state)if(kind(s)===2){const k=String(s.p);if(!positions.has(k))positions.set(k,[]);positions.get(k).push(s);}
 const axes={U:[0,1,0],D:[0,-1,0],F:[0,0,1],B:[0,0,-1],R:[1,0,0],L:[-1,0,0]};
 for(const piece of positions.values()){
  const p=piece[0].p,inside=p.find(v=>Math.abs(v)!==extent);if(inside===0)continue;const family=(extent-Math.abs(inside))/2-1,d=T.orbitData(n,'wing',family),slot=d.positions.findIndex(q=>same(q,p));
  const incident=Object.keys(axes).filter(f=>p.reduce((v,x,i)=>v+x*axes[f][i],0)===extent),values=incident.map(f=>piece.find(s=>same(s.n,axes[f])).homeFace);
  const home=T.wingHome(n,family,slot,values);assert.equal(String(home.position),String(byId.get(piece[0].id).p));homes++;
 }
}
console.log(JSON.stringify({families,orderedTriplesCovered:triples,fullEngineWords:words,monotoneColorFamilySolves:colors,completeWingDepthSolves:wingSolves,exactWingDestinations:homes}));
