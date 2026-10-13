'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),E=require('../dist/games/shape-engine.js');
const ctx={window:{},document:{addEventListener(){}}};vm.runInNewContext(fs.readFileSync(require.resolve('../dist/shape-guides.js'),'utf8'),ctx);
const B=ctx.window.SHAPE_GUIDE_BUILDERS,home=p=>E.positionName(p.home),slot=p=>E.positionName(p.pos);
const signature=p=>p.stickers.map(s=>s.regionPolygon.map(v=>E.vector.transform(p.orientation,v).map(x=>Math.round(x*1e6)).join(',')).sort().join(';')).sort().join('|');
const perform=(m,method,slots)=>{const s=B.sequence(method,slots);assert(s,method+' '+slots);[s.setup,s.cycle,s.restore].join(' ').trim().split(/\s+/).forEach(t=>m.applyMove(t));};
const tetraCorners=[['DBL','DFR','UBR','UFL'],['DFL','UFR','UBL','DBR']];
const flatCorners=[['DBL','UFR'],['DFL','UBL','UFL','DBR','DFR','UBR']];
const flatEdges=[['DL','BL','DB','UF','FR','UR'],['FL','UB','DR'],['UL','DF','BR']];
// This implements the printed shape-type placement rule, including the last
// two unlike shapes, using one identical correctly placed shape as buffer.
function placeTypes(m,kind,groups){const group=s=>groups.findIndex(g=>g.includes(s));let n=0;for(;;){const wrong=m.pieces.filter(p=>p.kind===kind&&group(home(p))!==group(slot(p)));if(!wrong.length)return;assert(++n<20);const a=wrong[0],b=wrong.find(p=>group(slot(p))===group(home(a)));assert(b);const c=wrong.length===2?m.pieces.find(p=>p.kind===kind&&p!==a&&p!==b&&group(home(p))===group(home(b))):wrong.find(p=>p!==a&&p!==b);assert(c);perform(m,kind==='edge'?'edge':'corner',[slot(a),slot(b),slot(c)]);}}
for(const f of B.data.mirrorCenter.slots){const m=E.create('mastermorphix'),ref=Object.fromEntries(m.pieces.map(p=>[home(p),signature(p)]));perform(m,'mirrorCenter',[f]);const wrong=m.pieces.filter(p=>signature(p)!==ref[slot(p)]);assert.equal(wrong.length,1,f+' changed another shape');assert.equal(home(wrong[0]),f);perform(m,'mirrorCenter',[f]);assert(m.isShapeSolved(),f+' did not toggle the shape orientation');}
let solved=0;
for(const type of ['pyramorphix','flatdiamond','mastermorphix'])for(let seed=0;seed<100;seed++){
 const m=E.create(type),ref=Object.fromEntries(m.pieces.map(p=>[home(p),signature(p)])),fits=p=>signature(p)===ref[slot(p)];m.scramble('mirror-guide-'+seed,30).forEach(t=>m.applyMove(t));
 if(type==='flatdiamond')placeTypes(m,'edge',flatEdges);
 if(type!=='pyramorphix'){
  const wrong=m.pieces.filter(p=>p.kind==='edge'&&!fits(p)).map(slot);
  if(type==='mastermorphix')assert.equal(wrong.length%2,0,'Master edge shape flip parity');
  else if(wrong.length%2)wrong.push('FL');
  for(let i=0;i<wrong.length;i+=2)perform(m,'flip',wrong.slice(i,i+2));
  assert(m.pieces.filter(p=>p.kind==='edge').every(fits),type+' edge repair');
 }
 placeTypes(m,'corner',type==='flatdiamond'?flatCorners:tetraCorners);
 if(type==='flatdiamond')for(const p of m.pieces.filter(p=>p.kind==='corner'&&!['DBL','UFR'].includes(slot(p)))){let attempts=0;while(!fits(p)){perform(m,'twist',[slot(p),'DBL']);assert(++attempts<=2,'corner should fit within 2 twists');}}
 assert(m.pieces.filter(p=>p.kind==='corner').every(fits),type+' corner shape');
 if(type==='mastermorphix')for(const p of m.pieces.filter(p=>p.kind==='center'))if(!fits(p))perform(m,'mirrorCenter',[slot(p)]);
 assert(m.isShapeSolved(),type+' '+seed+' guide did not restore shape');solved++;
}
console.log('Passed six single-center silver repairs and '+solved+' complete shape-only guide solves without color identities.');
