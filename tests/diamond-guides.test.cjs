'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('../dist/games/shape-engine.js');
const context={window:{}};
for(const file of ['cube-guides.js','diamond-guides.js'])vm.runInNewContext(fs.readFileSync(require.resolve('../dist/'+file),'utf8'),context);
const guides=context.window.DIAMOND_GUIDES;
const same=(a,b)=>a.every((v,i)=>v===b[i]);
const slot=s=>s.split('').reduce((v,f)=>v.map((x,i)=>x+E.configs.find(c=>c.id===f).normal[i]),[0,0,0]);
const at=(m,s)=>m.pieces.find(p=>same(p.pos,slot(s)));
const perform=(m,word,map={})=>word.trim().split(/\s+/).filter(Boolean).forEach(t=>m.applyMove((map[t[0]]||t[0])+t.slice(1)));
const fronts=[
  {U:'U',D:'D',F:'F',R:'R',B:'B',L:'L'},
  {U:'U',D:'D',F:'R',R:'B',B:'L',L:'F'},
  {U:'U',D:'D',F:'B',R:'L',B:'F',L:'R'},
  {U:'U',D:'D',F:'L',R:'F',B:'R',L:'B'}
];
const lower={U:'D',D:'U',F:'F',R:'L',B:'B',L:'R'};
function align(m,face,predicate){for(let i=0;i<4;i++){if(predicate())return;perform(m,face);}assert.fail('No matching piece in '+face+' layer');}
function solveBands(m){
  const counts={belt:0,edges:0,corners:0};
  for(const top of [1,-1]){
    const frames=top===1?fronts:fronts.map(f=>Object.fromEntries(Object.keys(f).map(k=>[k,f[lower[k]]])));
    while(m.pieces.some(p=>p.kind==='edge'&&p.pos[1]===top&&p.home[1]===0)){
      assert(++counts.belt<=4);
      const frame=frames.find(f=>at(m,f.F+f.R).home[1]!==0);assert(frame);
      const before=m.pieces.filter(p=>p.kind==='edge'&&p.pos[1]===0&&p.home[1]===0).map(p=>({id:p.id,pos:p.pos.slice()}));
      align(m,frame.U,()=>at(m,frame.U+frame.F).home[1]===0);
      perform(m,"R U' R'",frame);
      assert(before.every(old=>same(m.pieces[old.id].pos,old.pos)),'Orange belt positions must survive another insertion');
    }
  }
  assert(m.pieces.filter(p=>p.kind==='edge'&&p.pos[1]===0).every(p=>p.home[1]===0));
  while(m.pieces.some(p=>p.kind==='edge'&&p.pos[1]===1&&p.home[1]===-1)){
    assert(++counts.edges<=4);
    align(m,'U',()=>at(m,'UF').home[1]===-1);align(m,'D',()=>at(m,'DF').home[1]===1);perform(m,'F2');
    assert(m.pieces.filter(p=>p.kind==='edge'&&p.pos[1]===0).every(p=>p.home[1]===0));
  }
  assert(m.pieces.filter(p=>p.kind==='edge').every(p=>p.home[1]===p.pos[1]));
  while(m.pieces.some(p=>p.kind==='corner'&&p.pos[1]===1&&p.home[1]===-1)){
    assert(++counts.corners<=4);
    align(m,'U',()=>at(m,'UFR').home[1]===-1);align(m,'D',()=>at(m,'DFR').home[1]===1);perform(m,'U F U D B L R B');
    assert(m.pieces.filter(p=>p.kind==='edge').every(p=>p.home[1]===p.pos[1]),'Corner operation must preserve every edge band');
  }
  assert(m.isSolved(),'The guide method must finish the visible color goal');
  return counts;
}
test('the complete Diamond Style guide solves 100 independent legal scrambles',()=>{
  for(let seed=0;seed<100;seed++){
    const m=E.create('diamondstyle');m.scramble('band-guide-'+seed,35).forEach(move=>m.applyMove(move));solveBands(m);
  }
});
test('band operations have the advertised effect rather than an isolated labeled swap',()=>{
  const m=E.create('diamondstyle');const upper=at(m,'UFR').id,lowerId=at(m,'DFR').id;
  perform(m,'U F U D B L R B');
  assert(same(m.pieces[lowerId].pos,slot('UFR')));assert.equal(m.pieces[upper].pos[1],-1);
  assert(m.pieces.filter(p=>p.kind==='edge').every(p=>p.home[1]===p.pos[1]));
  assert(m.pieces.filter(p=>!same(p.home,p.pos)).length>2);
  m.reset();perform(m,'U');assert(m.isSolved(),'Uniform-band permutations are already visibly solved');
});
test('Diamond Cube guide describes the actual 86 facelets and embeds every 3×3 stage',()=>{
  const m=E.create('diamondcube'),square=m.faces.filter(f=>f.normal.filter(v=>Math.abs(v)>1e-7).length===1),triangle=m.faces.filter(f=>f.normal.filter(v=>Math.abs(v)>1e-7).length===3);
  assert.equal(square.length,6);assert.equal(triangle.length,8);assert.equal(m.slots.length,86);
  for(const face of square)assert.equal(m.slots.filter(s=>s.face===face.id).length,9);
  for(const face of triangle)assert.equal(m.slots.filter(s=>s.face===face.id).length,4);
  assert.equal(new Set(m.slots.map(s=>s.color)).size,14);
  const g=guides.diamondcube;
  for(const s of context.window.CUBE_GUIDES.cube3.steps.slice(1))assert(g.steps.some(step=>step.body===s.body));
  assert(g.notation.some(s=>s.includes('U green')&&s.includes('D blue')));
  assert(g.steps.some(s=>s.body.includes('no extra face-center orientation repair')));
  assert(g.sources.some(s=>s.url.includes('americanhistory.si.edu')));
  assert(guides.diamondstyle.steps.some(s=>s.body.includes("L D' L'")));
});

test('Diamond guides use color goals and require no identity-label scaffolding',()=>{for(const guide of Object.values(guides)){const text=[...guide.notation,...guide.steps.map(s=>s.body)].join('');assert(text.includes('Tile identity labels are unnecessary'));assert(!/holds exact selected patches|Holding every green node by identity/.test(text));assert(/colors at selected|selected locations’ colors/.test(text));}});
