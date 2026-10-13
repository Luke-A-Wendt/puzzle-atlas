'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),E=require('../dist/games/dino-engine.js');
const ctx={window:{},document:{addEventListener(){}}};
vm.runInNewContext(fs.readFileSync(require.resolve('../dist/dino-guides.js'),'utf8'),ctx);
const B=ctx.window.DINO_GUIDE_BUILDERS,home=p=>E.positionName(p.home),slot=p=>E.positionName(p.pos),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const perform=(m,s)=>{const r=B.sequence(s);assert(r);[r.setup,r.cycle,r.restore].join(' ').trim().split(/\s+/).forEach(t=>m.applyMove(t));};
assert.equal(Object.keys(B.data.paths).length,440);
assert.equal(B.sequence(['UF','UF','UB']),null);
let cycles=0,solves=0;
for(const type of ['dino','rainbow']){
 const m=E.create(type);
 for(const k of Object.keys(B.data.paths)){
  m.reset();const before=m.snapshot(),s=k.split(',');perform(m,s);
  for(let i=0;i<3;i++)assert.equal(slot(m.pieces.find(p=>home(p)===s[i])),s[(i+1)%3],type+' '+k);
  for(const p of m.pieces.filter(p=>!s.includes(home(p))))assert(same(p.pos,before.pieces[p.id].pos)&&same(p.orientation,before.pieces[p.id].orientation),type+' changed unselected '+home(p));
  cycles++;
 }
 for(let seed=0;seed<100;seed++){
  m.reset();m.scramble('guide-'+seed,30).forEach(t=>m.applyMove(t));let n=0;
  for(;;){const wrong=m.pieces.filter(p=>p.kind==='edge'&&home(p)!==slot(p));if(!wrong.length)break;assert(wrong.length>=3,'Only two edges wrong: '+type+' '+seed);assert(++n<20);const a=wrong[0],s=[slot(a),home(a)],third=wrong.find(p=>!s.includes(slot(p)));assert(third);perform(m,[...s,slot(third)]);}
  assert(m.isExactSolved(),type+' '+seed+' not exact solved');assert(m.isSolved());solves++;
 }
 assert(ctx.window.DINO_GUIDES[type].steps.length>=5);
}
console.log('Passed '+cycles+' Dino/Rainbow guide cycles and '+solves+' complete seeded solves, including stationary centers and orientation.');
