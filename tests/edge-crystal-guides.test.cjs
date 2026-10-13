'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),H=require('../dist/games/helicopter-engine.js'),C=require('../dist/games/crystal-engine.js');
const context={window:{},document:{addEventListener(){}}};vm.runInNewContext(fs.readFileSync(require.resolve('../dist/edge-crystal-guides.js'),'utf8'),context);
const B=context.window.EDGE_CRYSTAL_GUIDE_BUILDERS,same=(a,b)=>Math.abs(a-b)<1e-5,identity=p=>p.orientation.every((r,i)=>r.every((v,j)=>same(v,Number(i===j)))),parse=s=>s.trim().split(/\s+/).filter(Boolean);
// Compose exact sticker permutations measured from the physical engine. This
// checks every generated conjugate without redoing 120 geometric slot searches
// after each intermediate move. Each primitive is independently measured, and
// representative complete algorithms are also run through the physical model.
function permutationModel(E){
 const physical=E.create(),templates=physical.pieces.map(p=>({...p})),slots=physical.slots,perms={};
 for(const c of physical.configs)for(const suffix of ['',"'"]){const token=c.id+suffix;physical.reset();physical.applyMove(token);perms[token]=Object.fromEntries(physical.stickerState.map(s=>[s.id,s.slot]));}
 const v=E.vector,frame=(a,b)=>{const u=v.unit(a),w=v.unit(v.cross(a,b)),q=v.cross(w,u);return[u,q,w];};
 let state=[],cached;
 const model={reset(){state=slots.map(s=>s.id);cached=null;return model;},applyMove(t){const m=E.normalizeMove(t),p=perms[m.face+(m.dir<0?"'":'')];for(let n=0;n<m.turns;n++)state=state.map(s=>p[s]);cached=null;return model;},scramble:physical.scramble,isSolved:()=>state.every((s,i)=>s===i),get pieces(){if(cached)return cached;return cached=templates.map(p=>{const target=state[p.stickers[0].id],slot=slots[target].piece;const a=frame(p.stickers[0].normal,p.stickers[1].normal),b=frame(slots[state[p.stickers[0].id]].normal,slots[state[p.stickers[1].id]].normal),orientation=[0,1,2].map(i=>[0,1,2].map(j=>a.reduce((s,x,k)=>s+b[k][i]*x[j],0)));return{...p,slot,pos:templates[slot].home,orientation};});},get stickerPermutation(){return state;}};
 for(let seed=0;seed<10;seed++){physical.reset();model.reset();const moves=physical.scramble('permutation-oracle-'+seed,20);for(const t of moves){physical.applyMove(t);model.applyMove(t);}for(const s of physical.stickerState)assert.equal(state[s.id],s.slot);for(const p of physical.pieces)assert(model.pieces[p.id].orientation.every((r,i)=>r.every((x,j)=>same(x,p.orientation[i][j]))));}
 model.reset();return model;
}
let checked=0,solves=0;
for(const[type,E]of[['helicopter',H],['crystal',C]]){
 const m=type==='crystal'?permutationModel(E):E.create(),slot=p=>type==='crystal'?m.pieces[p.slot].name:m.pieces.find(q=>q.home.every((v,i)=>same(v,p.pos[i]))).name;
 let recorded=[];const perform=(method,slots)=>{const s=B.sequence(type,method,slots);assert(s,type+' '+method+' '+slots);const tokens=parse([s.setup,s.core,s.restore].join(' '));recorded.push(...tokens);tokens.forEach(t=>m.applyMove(t));};
 const twist=p=>E.vector.dot(E.vector.unit(p.home),E.vector.cross(p.stickers[0].normal,E.vector.transform(p.orientation,p.stickers[0].normal)));
 assert(context.window.EDGE_CRYSTAL_GUIDES[type].steps.length>=6);
 for(const[method,d]of Object.entries(B.data[type])){if(method==='orbits')continue;
  for(const k of Object.keys(d.paths)){m.reset();const selected=k.split(',');perform(method,selected);
   for(const p of m.pieces){const shouldProtect=(type==='crystal'&&['corner','twist'].includes(method)||type==='helicopter'&&['swap','twist'].includes(method))?p.kind==='corner':true;if(shouldProtect&&!selected.includes(p.name))assert(identity(p),type+' '+method+' disturbed '+p.name+' for '+k);}
   if(d.mode==='cycle')for(let i=0;i<3;i++)assert.equal(slot(m.pieces.find(p=>p.name===selected[i])),selected[(i+1)%3],type+' '+method+' cycle');
   if(method==='swap'){assert.equal(slot(m.pieces.find(p=>p.name===selected[0])),selected[1]);assert.equal(slot(m.pieces.find(p=>p.name===selected[1])),selected[0]);}
   if(method==='twist'){const a=m.pieces.find(p=>p.name===selected[0]),b=m.pieces.find(p=>p.name===selected[1]);assert.equal(slot(a),a.name);assert.equal(slot(b),b.name);assert(twist(a)<-.1&&twist(b)>.1,'twist directions '+type+' '+k);}
   if(method==='flip')for(const s of selected){const p=m.pieces.find(p=>p.name===s);assert.equal(slot(p),s);assert(!identity(p));}
   if(method==='pairs')for(let i=0;i<4;i+=2){assert.equal(slot(m.pieces.find(p=>p.name===selected[i])),selected[i+1]);assert.equal(slot(m.pieces.find(p=>p.name===selected[i+1])),selected[i]);}
   checked++;
  }
  if(type==='crystal'){const physical=E.create(),chosen=d.seeds[0].base,s=B.sequence(type,method,chosen);parse([s.setup,s.core,s.restore].join(' ')).forEach(t=>physical.applyMove(t));m.reset();perform(method,chosen);for(const p of physical.pieces)assert(m.pieces[p.id].orientation.every((r,i)=>r.every((x,j)=>same(x,p.orientation[i][j]))));}
  console.log(type,method,Object.keys(d.paths).length,'builders verified');
 }
 function wrong(kind,orientation=false){return m.pieces.filter(p=>p.kind===kind&&(orientation?!identity(p):slot(p)!==p.name));}
 function sort3(method,kind,orbit){let n=0;for(;;){const bad=wrong(kind).filter(p=>!orbit||orbit.includes(slot(p)));if(bad.length<3)return bad;assert(++n<40,'sorting terminates');const a=bad[0],chosen=[slot(a),a.name],third=bad.find(p=>!chosen.includes(slot(p)));assert(third);perform(method,[...chosen,slot(third)]);}}
 for(let seed=0;seed<50;seed++){
  m.reset();recorded=[];const scramble=m.scramble('complete-guide-'+seed,40);scramble.forEach(t=>m.applyMove(t));
  if(type==='helicopter'){let n=0;while(wrong('corner').length){assert(++n<10);const p=wrong('corner')[0];perform('swap',[slot(p),p.name]);}}
  else assert.equal(sort3('corner','corner').length,0);
  let n=0;while(wrong('corner',true).length){assert(++n<30);const bad=wrong('corner',true);assert(bad.length>1);const a=bad[0],b=bad[1];perform('twist',twist(a)>0?[a.name,b.name]:[b.name,a.name]);}
  if(type==='crystal'){assert.equal(sort3('edge','edge').length,0);let n=0;while(wrong('edge',true).length){assert(++n<20);const bad=wrong('edge',true);assert(bad.length>1);perform('flip',bad.slice(0,2).map(p=>p.name));}}
  else {const pairs=[];for(const orbit of B.data.helicopter.orbits){const bad=sort3('center','center',orbit);assert([0,2].includes(bad.length));if(bad.length)pairs.push(bad.map(p=>slot(p)));}assert(pairs.length%2===0);for(let i=0;i<pairs.length;i+=2)perform('pairs',[...pairs[i],...pairs[i+1]]);}
  if(type==='crystal'&&seed===0){const native=E.create();scramble.forEach(t=>native.applyMove(t));recorded.forEach(t=>native.applyMove(t));assert(native.isSolved(),'complete native Crystal solve');assert(native.isExactSolved());console.log('Crystal physical-engine solve:',recorded.length,'moves');}
  assert(m.isSolved(),type+' complete solve '+seed);assert(m.pieces.every(identity),type+' every physical piece exact '+seed);solves++;
 }
 console.log(type,'50 complete history-free solves passed');
}
assert.equal(B.sequence('crystal','edge',['AB','AB','AC']),null);assert.equal(B.sequence('helicopter','center',['Ufr','Ufl','Ubr']),null);
const explorer=H.create(),exercise=[];for(const[face,to]of[['UF',1],['DR',1],['FR',3],['DR',0],['UF',0]]){const t=explorer.stopMove(face,to);assert(explorer.legalMove(t));explorer.applyMove(t);exercise.push(t);}assert(explorer.isCubeShape());assert(!explorer.isSolved());explorer.invertMoves(exercise).forEach(t=>explorer.applyMove(t));assert(explorer.isSolved());
console.log('Verified '+checked+' guide builders and '+solves+' complete seeded solves.');
