'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const Master=require('../dist/games/masterpyraminx-engine.js'),Kilo=require('../dist/games/kilominx-engine.js'),Ghost=require('../dist/games/ghost-engine.js'),Orientation=require('../dist/games/shape-guide-orientation.js');
const context={window:{},document:{addEventListener(){}}};vm.createContext(context);
for(const file of ['shape-guides.js','edge-crystal-guides.js','master-guide-data.js','addition-guides.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist',file),'utf8'),context,{filename:file});
const B=context.window.ADDITION_GUIDE_BUILDERS,Shape=context.window.SHAPE_GUIDE_BUILDERS,parse=s=>s.trim().split(/\s+/).filter(Boolean);

// Independent physical-engine primitive measurements make every conjugate cheap
// to check. At least one complete scramble/solve also runs through native 3D.
function oracle(E){
 const native=E.create(),templates=native.pieces.map(p=>({...p})),slots=native.slots,perms={};
 for(const c of native.configs)for(const suffix of ['',"'"]){native.reset().applyMove(c.id+suffix);perms[c.id+suffix]=Object.fromEntries(native.stickerState.map(s=>[s.id,s.slot]));}
 let state=slots.map(s=>s.id),record=[];
 const model={templates,slots,native,reset(){state=slots.map(s=>s.id);record=[];return model;},apply(t){const m=E.normalizeMove(t),p=perms[m.face+(m.dir<0?"'":'')];for(let i=0;i<m.turns;i++)state=state.map(x=>p[x]);record.push(typeof t==='string'?t:m);},get state(){return state;},get record(){return record;},slot(p){return templates[slots[state[p.stickers[0].id]].piece].name;},aligned(p){return p.stickers.every(s=>state[s.id]===s.id);},pieceAt(name){return templates.find(p=>model.slot(p)===name);}};
 return model;
}
function perform(m,puzzle,method,slots){const s=B.sequence(puzzle,method,slots);assert(s,puzzle+' '+method+' '+slots);parse([s.setup,s.core,s.restore].join(' ')).forEach(t=>m.apply(t));}
function cycles(m,puzzle,kind,method){let n=0;for(;;){const wrong=m.templates.filter(p=>p.kind===kind&&m.slot(p)!==p.name);if(!wrong.length)return;assert(wrong.length>2,kind+' impossible last pair');assert(++n<50,kind+' sorting termination');const a=wrong[0],chosen=[m.slot(a),a.name],third=wrong.find(p=>!chosen.includes(m.slot(p)));assert(third);perform(m,puzzle,method,[...chosen,m.slot(third)]);}}
const entriesForMaster=(method,d)=>{const tuples=Object.keys(d.paths).map(k=>k.split('|'));return method==='center'?tuples.flatMap(a=>[a,[a[0],a[2],a[1]]]):tuples;};
test('Every Master builder has its stated exact action; both A4 center-cycle directions are covered',()=>{
 const m=oracle(Master);let checked=0;
 for(const [method,d]of Object.entries(B.data.masterpyraminx))for(const chosen of entriesForMaster(method,d)){
  m.reset();perform(m,'masterpyraminx',method,chosen);
  for(const p of m.templates){const selected=chosen.includes(p.name),protectedKind=method==='wing'||['tip','axial'].includes(p.kind)||p.kind==='midge';if(protectedKind&&!selected)assert(m.aligned(p),method+' disturbed '+p.name);}
  if(method==='flip')for(const name of chosen){const p=m.templates.find(p=>p.name===name);assert.equal(m.slot(p),name);assert(!m.aligned(p));}
  else for(let i=0;i<3;i++)assert.equal(m.slot(m.templates.find(p=>p.name===chosen[i])),chosen[(i+1)%3],method+' cycle');
  checked++;
 }
 assert.equal(checked,503);
 assert.equal(B.sequence('masterpyraminx','wing',['UL wing','UL wing','LU wing']),null);
});
test('Master manual stages solve 50 independent scrambles without using their inverse',()=>{
 const m=oracle(Master);
 for(let seed=0;seed<50;seed++){
  m.reset();const scramble=m.native.scramble('master-guide-'+seed,36);scramble.forEach(t=>m.apply(t));
  for(const kind of ['axial','tip'])for(const p of m.templates.filter(p=>p.kind===kind)){
   let n=0;while(!m.aligned(p)){assert(++n<=2);m.apply(kind==='tip'?p.name[0].toLowerCase():p.name[0]);}
  }
  cycles(m,'masterpyraminx','midge','midge');
  const flipped=m.templates.filter(p=>p.kind==='midge'&&!m.aligned(p));assert.equal(flipped.length%2,0);
  for(let i=0;i<flipped.length;i+=2)perform(m,'masterpyraminx','flip',[flipped[i].name,flipped[i+1].name]);
  cycles(m,'masterpyraminx','center','center');cycles(m,'masterpyraminx','wing','wing');
  assert(m.state.every((s,i)=>s===i),'complete Master solve '+seed);
  if(seed===0){const physical=Master.create();m.record.forEach(t=>physical.applyMove(t));assert(physical.isExactSolved(),'native geometry complete Master solve');}
 }
});
test('Every Kilominx corner cycle and ordered twist pair preserves all other corners',()=>{
 const m=oracle(Kilo),v=Kilo.vector;let checked=0;
 for(const method of ['corner','twist'])for(const key of Object.keys(B.data.kilominx[method].paths)){
  const chosen=key.split(',');m.reset();perform(m,'kilominx',method,chosen);
  for(const p of m.templates)if(!chosen.includes(p.name))assert(m.aligned(p),method+' disturbed '+p.name);
  if(method==='corner')for(let i=0;i<3;i++)assert.equal(m.slot(m.templates.find(p=>p.name===chosen[i])),chosen[(i+1)%3]);
  else for(let i=0;i<2;i++){const p=m.templates.find(p=>p.name===chosen[i]);assert.equal(m.slot(p),p.name);const sine=v.dot(v.unit(p.home),v.cross(p.stickers[0].normal,m.slots[m.state[p.stickers[0].id]].normal));assert(i===0?sine<-.1:sine>.1,'twist direction');}
  checked++;
 }
 assert.equal(checked,2660);
});
test('Kilominx two-stage method solves 30 independent legal scrambles',()=>{
 const m=oracle(Kilo),v=Kilo.vector;
 for(let seed=0;seed<30;seed++){
  m.reset();m.native.scramble('kilominx-guide-'+seed,40).forEach(t=>m.apply(t));cycles(m,'kilominx','corner','corner');
  let count=0;for(;;){const bad=m.templates.filter(p=>!m.aligned(p));if(!bad.length)break;assert(bad.length>1);assert(++count<30);const a=bad[0],b=bad[1],sine=v.dot(v.unit(a.home),v.cross(a.stickers[0].normal,m.slots[m.state[a.stickers[0].id]].normal));perform(m,'kilominx','twist',sine>0?[a.name,b.name]:[b.name,a.name]);}
  assert(m.state.every((s,i)=>s===i),'complete Kilominx solve '+seed);
  if(seed===0){const physical=Kilo.create();m.record.forEach(t=>physical.applyMove(t));assert(physical.isExactSolved(),'native geometry complete Kilominx solve');}
 }
});
function shapePerform(m,method,slots,reverse=false){const s=Shape.sequence(method,slots,reverse);assert(s);parse([s.setup,s.cycle,s.restore].join(' ')).forEach(t=>m.applyMove(t));}
const home=p=>Ghost.positionName(p.home),current=p=>Ghost.positionName(p.pos);
test('Ghost guide repairs full directional-center poses after a history-free piece solve',()=>{
 for(let seed=0;seed<20;seed++){
  const m=Ghost.create();m.scramble('ghost-guide-'+seed,30).forEach(t=>m.applyMove(t));
  for(const [kind,method]of [['edge','edge'],['corner','corner']]){
   let count=0;for(;;){const bad=m.pieces.filter(p=>p.kind===kind&&home(p)!==current(p));if(!bad.length)break;assert(++count<40);if(bad.length===2){assert.equal(kind,'edge');m.applyMove('U');continue;}const a=bad[0],chosen=[current(a),home(a)],third=bad.find(p=>!chosen.includes(current(p)));shapePerform(m,method,[...chosen,current(third)]);}
   if(kind==='edge'){const bad=m.pieces.filter(p=>p.kind==='edge'&&!Orientation.inspect(p).aligned);assert.equal(bad.length%2,0);for(let i=0;i<bad.length;i+=2)shapePerform(m,'flip',bad.slice(i,i+2).map(home));}
   else {let count=0;for(;;){const bad=m.pieces.filter(p=>p.kind==='corner'&&!Orientation.inspect(p).aligned);if(!bad.length)break;assert(bad.length>1);assert(++count<20);shapePerform(m,'twist',bad.slice(0,2).map(home),Orientation.inspect(bad[0]).turnsClockwise===1);}}
  }
  let count=0;for(;;){assert(++count<20);const centers=m.pieces.filter(p=>p.kind==='center'),half=centers.find(p=>Orientation.inspect(p).turnsClockwise===2);if(half){shapePerform(m,'half',[home(half)]);continue;}const odd=centers.filter(p=>!Orientation.inspect(p).aligned);if(!odd.length)break;assert(odd.length>1);shapePerform(m,'center',odd.slice(0,2).map(home),Orientation.inspect(odd[0]).turnsClockwise===1);}
  assert(m.isExactSolved(),'complete Ghost full-pose solution '+seed);
 }
});
test('New guides are self-contained, identify the exact game conventions, and keep references',()=>{
 const G=context.window.ADDITION_GUIDES;assert.deepEqual(Object.keys(G).sort(),['ghost','kilominx','masterpyraminx']);
 for(const [key,g]of Object.entries(G)){assert(g.steps.length>=4,key);assert(g.notation.length>=4,key);assert(g.sources.length>=3,key);for(const s of g.sources)assert(/^https:\/\//.test(s.url));const text=g.steps.map(s=>s.body).join('');assert(text.includes('<code>'),key+' move instructions');assert(!text.includes('undefined'));}
 assert(G.masterpyraminx.steps.some(s=>s.body.includes('can move between faces')));
 assert(G.kilominx.steps.some(s=>s.body.includes('no edge-flip or center stage')));
 assert(G.ghost.steps.some(s=>s.body.includes('directional centers')));
 assert(G.ghost.steps.some(s=>s.body.includes('ring map stays available with silver nodes')));
 assert(G.ghost.steps.some(s=>s.body.includes('completely specified first solve')));
 assert(!G.ghost.steps.some(s=>s.body.includes('A held attachment determines its piece’s full orientation')));
});
