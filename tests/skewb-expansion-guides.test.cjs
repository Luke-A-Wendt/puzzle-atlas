'use strict';
const assert=require('assert'),E=require('../dist/games/skewb-engine.js'),{payload,perform,inverse,key,canon}=require('../guide-research/build-skewb-expansion-guide.cjs');
const data=payload.data,slots=m=>Object.fromEntries(m.polyhedron.pieces.map(p=>[key(p.home),p.name])),cycle=(m,method,three)=>{const d=data[method],path=d.paths[canon(three)];assert.notEqual(path,undefined);perform(m,[inverse(path),d.reversed[canon(three)]?inverse(d.core):d.core,path].join(' '));};
let total=0;
for(const [method,d]of Object.entries(data)){const m=E.create('masterskewb'),at=slots(m);for(const k of Object.keys(d.paths)){m.reset();const three=k.split(',');cycle(m,method,three);for(let i=0;i<3;i++)assert.equal(at[key(m.pieces.find(p=>p.name===three[i]).pos)],three[(i+1)%3]);if(method!=='edge')for(const p of m.pieces)if((method.startsWith('corner')?p.kind==='edge':p.kind!=='corner')&&!three.includes(p.name))for(const s of p.stickers)assert.equal(m.stickerState[s.id].slot,s.id,method+' disturbed '+p.name);total++;}}
for(const row of [...payload.swaps,...payload.twists]){const m=E.create('masterskewb');perform(m,row.sequence);for(const p of m.pieces.filter(p=>p.kind!=='corner'))for(const s of p.stickers)assert.equal(m.stickerState[s.id].slot,s.id);}
console.log('Verified',total,'complete Master cycles and all 18 corner recipes.');
for(let seed=0;seed<150;seed++){
 const m=E.create('masterskewb'),at=slots(m),random=E.seededRandom('master-guide-'+seed);
 for(let k=0;k<35;k++)m.applyMove(m.configs[Math.floor(random()*8)].id,random()<.5?-1:1);
 for(const method of ['edge','cornerA','cornerB','faceA','faceB','center']){let n=0;const d=data[method],byName=Object.fromEntries(m.pieces.map(p=>[p.name,p]));for(;;){const all=d.slots.map(name=>byName[name]),color=method.startsWith('face'),correct=p=>color?at[key(p.pos)].split(':')[0]===p.name.split(':')[0]:at[key(p.pos)]===p.name,wrong=all.filter(p=>!correct(p));if(!wrong.length)break;assert(++n<40);const a=wrong[0],from=at[key(a.pos)],target=color?wrong.find(p=>at[key(p.pos)].split(':')[0]===a.name.split(':')[0]):byName[d.slots.find(name=>at[key(byName[name].pos)]===a.name)],to=at[key(target.pos)];let third=wrong.find(p=>![from,to].includes(at[key(p.pos)]));if(!third&&color)third=all.find(p=>p!==a&&p!==target&&at[key(p.pos)].split(':')[0]===from.split(':')[0]);assert(third,'Cannot choose third '+method+' seed '+seed);cycle(m,method,[from,to,at[key(third.pos)]]);}}
 for(const product of [1,-1]){let limit=0;for(;;){const wrong=m.pieces.filter(p=>p.kind==='corner'&&Math.sign(p.home.reduce((a,b)=>a*b,1))===product&&p.stickers.some(s=>m.stickerState[s.id].slot!==s.id));if(!wrong.length)break;assert(wrong.length>=2,'Single twisted corner seed '+seed);assert(++limit<8);const [a,b]=wrong,row=payload.twists.find(r=>[r.first,r.second].includes(a.name)&&[r.first,r.second].includes(b.name));assert(row);perform(m,row.sequence);if(a.stickers.some(s=>m.stickerState[s.id].slot!==s.id))perform(m,row.sequence);assert(a.stickers.every(s=>m.stickerState[s.id].slot===s.id));}}
 assert(m.isSolved(),'Master guide failed '+seed);
}
console.log('Master guide solves 150 independent 35-move, all-eight-axis scrambles without history.');
// Exercise the recipes actually embedded for the standard and tetrahedral forms.
const fs=require('fs'),vm=require('vm'),context={window:{},document:{addEventListener(){}}};vm.runInNewContext(fs.readFileSync(require.resolve('../dist/skewb-expansion-guides.js'),'utf8'),context);
const G=context.window.SKEWB_EXPANSION_GUIDES,B=context.window.SKEWB_EXPANSION_GUIDE_BUILDERS,u=payload.ultimate;
assert.deepEqual(Object.keys(G).sort(),['jing','masterskewb','skewb']);assert.equal(B.sequence('edge',['UF','UF','UB']),null);
for(const [method,d]of Object.entries(data))for(const k of Object.keys(d.paths)){const r=B.sequence(method,k.split(','));assert(r);assert.equal(r.setup,inverse(d.paths[k]));assert.equal(r.cycle,d.reversed[k]?inverse(d.core):d.core);}
const codes=step=>Array.from(step.body.matchAll(/<code>(.*?)<\/code>/g),m=>m[1].replaceAll('′',"'")),swapAlgs=codes(u.steps[2]),twistAlgs=codes(u.steps[3]),cycleAlgs=codes(u.steps[4]),flipAlgs=codes(u.steps[5]);
function effectRecipes(type,algs){return algs.map(s=>{const m=E.create(type),at=slots(m);perform(m,s);return{s,mapping:Object.fromEntries(m.pieces.map(p=>[p.name,at[key(p.pos)]])),changed:m.pieces.filter(p=>p.stickers.some(s=>m.stickerState[s.id].slot!==s.id)).map(p=>p.name)};});}
for(const type of ['skewb','jing']){
 const swapRecipes=effectRecipes(type,swapAlgs),twistRecipes=effectRecipes(type,twistAlgs),cycleRecipes=effectRecipes(type,cycleAlgs),flipRecipes=effectRecipes(type,flipAlgs);
 for(let seed=0;seed<150;seed++){
  const m=E.create(type),at=slots(m),rand=E.seededRandom(type+'-guide-'+seed),piece=name=>m.pieces.find(p=>p.name===name),current=p=>at[key(p.pos)],correct=p=>p.stickers.every(s=>m.stickerState[s.id].slot===s.id);
  for(let i=0;i<35;i++)m.applyMove(m.configs[Math.floor(rand()*m.configs.length)].id,rand()<.5?-1:1);
  if(type==='skewb'){const l=current(piece('L'));if(l!=='L')perform(m,{R:"B b'",D:"R r'",B:"D d'"}[l]);const r=current(piece('R'));if(r!=='R')perform(m,{D:"L' l",B:"L l'"}[r]);}
  for(const name of ['L','R','D','B']){const p=piece(name);assert.equal(current(p),name);for(let n=0;!correct(p)&&n<2;n++)m.applyMove(name);assert(correct(p));}
  const free=m.pieces.filter(p=>p.home.every(v=>v!==0)&&!p.fixed),wrong=free.filter(p=>current(p)!==p.name);
  if(wrong.length){assert.equal(wrong.length,4);const row=swapRecipes.find(r=>wrong.every(p=>r.mapping[current(p)]===p.name));assert(row);perform(m,row.s);}
  assert(free.every(p=>current(p)===p.name));
  if(type==='skewb'){let limit=0;for(;;){const wrong=free.filter(p=>!correct(p));if(!wrong.length)break;assert(wrong.length>=2);assert(++limit<8);const[a,b]=wrong,row=twistRecipes.find(r=>r.changed.includes(a.name)&&r.changed.includes(b.name));assert(row);perform(m,row.s);if(!correct(a))perform(m,row.s);assert(correct(a));}}
  const rest=m.pieces.filter(p=>!p.home.every(v=>v!==0));let count=0;for(;;){const wrong=rest.filter(p=>current(p)!==p.name);if(!wrong.length)break;assert(++count<12);assert(wrong.length>=3);const a=wrong[0],from=current(a),to=a.name,c=wrong.find(p=>![from,to].includes(current(p))),three=[from,to,current(c)];let row=cycleRecipes.find(r=>three.every((s,i)=>r.mapping[s]===three[(i+1)%3])),twice=false;if(!row){row=cycleRecipes.find(r=>three.every((s,i)=>r.mapping[s]===three[(i+2)%3]));twice=true;}assert(row);perform(m,row.s);if(twice)perform(m,row.s);}
  if(type==='jing'){let limit=0;for(;;){const wrong=rest.filter(p=>!correct(p));if(!wrong.length)break;assert(wrong.length>=2);assert(++limit<5);const[a,b]=wrong,row=flipRecipes.find(r=>r.changed.includes(a.name)&&r.changed.includes(b.name));assert(row);perform(m,row.s);assert(correct(a));}}
  assert(m.isSolved(),type+' failed seed '+seed);
 }
 assert(G[type].steps.length>=5);assert(!JSON.stringify(G[type]).includes('four-sticker'));assert(!JSON.stringify(G[type]).includes('pentagonal'));
 console.log(type+': 150 complete independent 35-move scrambles solved by embedded tables.');
}
