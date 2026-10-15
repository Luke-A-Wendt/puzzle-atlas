'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../dist/games/megaminx.html'),'utf8'),script=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('root.MegaEngine'));
const ctx={window:{},document:{addEventListener(){}}};vm.createContext(ctx);vm.runInContext(script,ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/poly-guides.js'),'utf8'),ctx);
const E=ctx.MegaEngine,B=ctx.window.MEGAMINX_GUIDE_BUILDERS,S=E.makeSolved(),groups={},v=E.vector;
for(const s of E.slots){const name=s.pieceFaces.slice().sort().join('');(groups[name]??=[]).push(s.id);}
const parse=s=>s.trim().split(/\s+/).filter(Boolean),move=t=>typeof t==='string'?{face:t[0],dir:/['′]/.test(t)?-1:1,turns:t.includes('2')?2:1}:t;
const perm={};for(const f of E.faces)for(const dir of [1,-1])for(const turns of [1,2])perm[f.id+':'+dir+':'+turns]=E.applyMove(S,{face:f.id,dir,turns}).map(s=>s.slot);
const current=(state,name)=>E.slots[state[groups[name][0]]].pieceFaces.slice().sort().join(''),exact=(state,name)=>groups[name].every(id=>state[id]===id);
const perform=(state,word)=>{for(const t of parse(word)){const m=move(t),p=perm[m.face+':'+m.dir+':'+m.turns];state=state.map(x=>p[x]);}return state;};
const recipe=(method,slots)=>{const s=B.sequence(method,slots);assert(s);return[s.setup,s.core,s.restore].join(' ');};
const sign=(state,name)=>{const id=groups[name][0],home=E.slots[id],target=E.slots[state[id]],axis=v.unit(home.pieceFaces.map(f=>E.configs[f].normal).reduce(v.add,[0,0,0]));return v.dot(axis,v.cross(home.normal,target.normal));};
test('all 11,215 Megaminx builders have their exact stated action and protect previous stages',()=>{
 let count=0;
 for(const[method,d]of Object.entries(B.data))for(const key of Object.keys(d.paths)){
  const chosen=key.split(','),state=perform(S.map(s=>s.slot),recipe(method,chosen));
  for(const[name,ids]of Object.entries(groups))if((method==='corner'||method==='twist'||name.length!==3)&&!chosen.includes(name))assert(exact(state,name),method+' disturbed '+name+' for '+key);
  if(d.mode==='cycle')for(let i=0;i<3;i++)assert.equal(current(state,chosen[i]),chosen[(i+1)%3],method+' cycle');
  else {for(const name of chosen){assert.equal(current(state,name),name);assert(!exact(state,name));}if(method==='twist'){assert(sign(state,chosen[0])<-.1);assert(sign(state,chosen[1])>.1);}}
  count++;
 }
 assert.equal(count,11215);assert.equal(B.sequence('edge',['AB','AB','AC']),null);assert.equal(B.sequence('twist',['AB','ABC']),null);
});
test('the complete Megaminx four-operation method solves 100 seeded states without inverse history',()=>{
 for(let seed=0;seed<100;seed++){
  let state=S.map(s=>s.slot),moves=[];
  for(const m of E.scramble('complete-megaminx-guide-'+seed,50)){const p=perm[m.face+':'+m.dir+':'+m.turns];state=state.map(x=>p[x]);moves.push(m);}
  const apply=(method,slots)=>{const word=recipe(method,slots);state=perform(state,word);moves.push(...parse(word).map(move));};
  for(const method of ['edge','corner']){
   const names=B.data[method].slots;let iterations=0;
   for(;;){const wrong=names.filter(name=>current(state,name)!==name);if(!wrong.length)break;assert(wrong.length>=3,'even permutation cannot leave one pair');assert(++iterations<names.length);const a=wrong[0],from=current(state,a),to=a,third=wrong.find(n=>![from,to].includes(current(state,n)));assert(third);const before=wrong.length;apply(method,[from,to,current(state,third)]);assert(names.filter(n=>current(state,n)!==n).length<before);}
   if(method==='edge'){const flipped=names.filter(n=>!exact(state,n));assert.equal(flipped.length%2,0);for(let i=0;i<flipped.length;i+=2)apply('flip',[flipped[i],flipped[i+1]]);}
   else {let twists=0;for(;;){const wrong=names.filter(n=>!exact(state,n));if(!wrong.length)break;assert(wrong.length>=2);assert(++twists<20);const[a,b]=wrong;apply('twist',sign(state,a)>0?[a,b]:[b,a]);assert(exact(state,a));}}
  }
  assert(state.every((slot,id)=>slot===id),'exact completed solve '+seed);
  if(seed<3){const actual=moves.reduce((s,m)=>E.applyMove(s,m),S);assert(E.isSolved(actual));assert(actual.every(s=>s.id===s.slot),'full native replay '+seed);}
 }
});
test('Megaminx guide embeds complete routes and keeps the optional layer tutorial',()=>{
 const g=ctx.window.POLY_GUIDES.megaminx,text=g.steps.map(s=>s.body).join('');assert.equal(g.steps.length,6);assert.equal((text.match(/class="megaminx-move-builder"/g)||[]).length,4);assert(text.includes('two exchanged pairs')||text.includes('Two exchanged pairs'));assert(text.includes('zero modulo three'));assert(text.includes('no legal final single-edge-flip'));assert(text.includes('Optional')||g.steps[5].title.includes('Optional'));assert(g.sources.length>=4);assert(!g.notation.join(' ').includes('Show tile labels'));for(const f of E.faces)assert(g.steps[0].body.includes('<td>'+f.id+'</td><td>'+f.name+'</td>'),'fixed center color '+f.id);
});
