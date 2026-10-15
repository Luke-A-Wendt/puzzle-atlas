'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const E=require('../dist/games/shape-engine.js');
const O=require('../dist/games/shape-guide-orientation.js');
const ctx={window:{},document:{addEventListener(){}}};vm.runInNewContext(fs.readFileSync(require.resolve('../dist/shape-guides.js'),'utf8'),ctx);
const B=ctx.window.SHAPE_GUIDE_BUILDERS;
const run=(m,s)=>s.trim().split(/\s+/).filter(Boolean).forEach(t=>m.applyMove(t));
const perform=(m,method,slots,reverse=false)=>{const s=B.sequence(method,slots,reverse);assert(s,method+' '+slots);run(m,[s.setup,s.cycle,s.restore].filter(Boolean).join(' '));};
const same=(a,b)=>a.every((v,i)=>v===b[i]);
const home=p=>E.positionName(p.home),slot=p=>E.positionName(p.pos);
const unchanged=p=>same(p.pos,p.home)&&O.inspect(p).aligned;
// Exhaustive address coverage proves that every pair/triple requested by the
// constructive placement rules has a builder, not only the seeded examples.
for(const [method,expected]of [['edge',440],['corner',112],['flip',66],['twist',56]]){
 const d=B.data[method];assert.equal(Object.keys(d.paths).length,expected,method+' complete orbit table');
 for(const a of d.slots)for(const b of d.slots)if(a!==b){
  if(d.base.length===2){assert(B.sequence(method,[a,b]),method+' '+a+','+b);continue;}
  for(const c of d.slots)if(c!==a&&c!==b)assert(B.sequence(method,[a,b,c]),method+' '+a+','+b+','+c);
 }
}
assert.equal(Object.keys(B.data.center.pairs).length,15,'every center pair');
for(const a of B.data.center.slots){assert(B.sequence('half',[a]));for(const b of B.data.center.slots)if(a!==b)assert(B.sequence('center',[a,b]));}
let selections=0;
for(const method of ['edge','corner','flip','twist']){
 const d=B.data[method];for(const k of Object.keys(d.paths)){
  const s=k.split(','),m=E.create('rhombic');perform(m,method,s);
  if(method==='edge'||method==='corner'){
   for(let i=0;i<3;i++)assert.equal(slot(m.pieces.find(p=>home(p)===s[i])),s[(i+1)%3],method+' '+k);
   const kind=method==='edge'?'edge':'corner';assert(m.pieces.filter(p=>p.kind===kind&&!s.includes(home(p))).every(unchanged));
   if(method==='corner')assert(m.pieces.filter(p=>p.kind==='edge'||p.kind==='center').every(unchanged));
   if(method==='edge')assert(m.pieces.filter(p=>p.kind==='corner').every(unchanged));
  }else if(method==='flip'){
   for(const p of m.pieces.filter(p=>p.kind==='edge'))assert.equal(O.inspect(p).text,s.includes(home(p))?'Flipped':'Aligned');
   assert(m.pieces.filter(p=>p.kind==='center').every(unchanged));
  }else{
   for(const p of m.pieces){if(home(p)===s[0])assert.equal(O.inspect(p).text,'120° clockwise');else if(home(p)===s[1])assert.equal(O.inspect(p).text,'120° counterclockwise');else assert(unchanged(p));}
  }
  selections++;
 }
}
for(const k of Object.keys(B.data.center.pairs))for(const reverse of [false,true]){
 const s=k.split(','),m=E.create('rhombic');perform(m,'center',s,reverse);for(const p of m.pieces)if(s.includes(home(p)))assert.equal(O.inspect(p).text,'90° '+(reverse?'counterclockwise':'clockwise'),k);else assert(unchanged(p),k+' changed '+home(p));selections++;
}
for(const f of B.data.center.slots){const m=E.create('rhombic');perform(m,'half',[f]);for(const p of m.pieces)if(home(p)===f)assert.equal(O.inspect(p).text,'180°');else assert(unchanged(p));selections++;}
function position(m,kind,method){let n=0;for(;;){const wrong=m.pieces.filter(p=>p.kind===kind&&!same(p.home,p.pos));if(!wrong.length)return;assert(++n<60,'placement loop');if(wrong.length===2){m.applyMove('U');continue;}const a=wrong[0],s=[slot(a),home(a)],c=wrong.find(p=>!s.includes(slot(p)));assert(c);perform(m,method,[...s,slot(c)]);}}
function orientCorners(m){let n=0;for(;;){const wrong=m.pieces.filter(p=>p.kind==='corner'&&!O.inspect(p).aligned);if(!wrong.length)return;assert(++n<30);assert(wrong.length>1,'single twisted corner');perform(m,'twist',wrong.slice(0,2).map(home),O.inspect(wrong[0]).turnsClockwise===1);}}
function orientVisibleCorners(m,type){
 const hidden=(type==='pyramorphix'||type==='mastermorphix')?['DFL','UFR','UBL','DBR']:['UFR','DBL'];
 for(const p of m.pieces.filter(p=>p.kind==='corner'&&!hidden.includes(home(p))))if(!O.inspect(p).aligned)perform(m,'twist',[home(p),hidden[0]],O.inspect(p).turnsClockwise===1);
}
function centers(m){const c=()=>m.pieces.filter(p=>p.kind==='center');let n=0;for(;;){assert(++n<15);const half=c().find(p=>O.inspect(p).turnsClockwise===2);if(half){perform(m,'half',[home(half)]);continue;}const odd=c().filter(p=>!O.inspect(p).aligned);if(!odd.length)return;assert(odd.length>1,'single quarter center');perform(m,'center',odd.slice(0,2).map(home),O.inspect(odd[0]).turnsClockwise===1);}}
let solved=0;
for(const type of ['axis','rhombic','flatdiamond','cornerocta','trajber','pyramorphix','jewel','mastermorphix'])for(let seed=0;seed<20;seed++){
 const m=E.create(type);m.scramble('guide-'+seed,25).forEach(s=>m.applyMove(s));
 if(type!=='pyramorphix'){
  position(m,'edge','edge');const flipped=m.pieces.filter(p=>p.kind==='edge'&&!O.inspect(p).aligned);assert.equal(flipped.length%2,0);for(let i=0;i<flipped.length;i+=2)perform(m,'flip',[home(flipped[i]),home(flipped[i+1])]);
 }
 if(type!=='cornerocta'&&type!=='jewel'){position(m,'corner','corner');if(type==='pyramorphix'||type==='flatdiamond'||type==='mastermorphix')orientVisibleCorners(m,type);else if(type!=='trajber')orientCorners(m);}
 if(type!=='pyramorphix')centers(m);
 if(type==='cornerocta')for(const p of m.pieces.filter(p=>p.kind==='tip')){let turns=0;while(!O.inspect(p).aligned){m.applyMove(home(p).toLowerCase());assert(++turns<=3);}}
 assert(m.isSolved(),type+' '+seed+' not visibly solved');solved++;
}
assert.equal(Object.keys(ctx.window.SHAPE_GUIDES).length,8);
console.log('Passed '+selections+' builder selections and '+solved+' complete seeded solves across eight physical models.');

for(const guide of Object.values(ctx.window.SHAPE_GUIDES)){const text=guide.steps.map(s=>s.body).join('');assert(text.includes('Why this terminates.'));assert(!/labels are hidden in Mirror|ring map, colors and learning labels disappear/.test(text));}
