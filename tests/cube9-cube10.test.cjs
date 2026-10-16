'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {test}=require('node:test');
const {createHarness}=require('./game-harness.cjs');
const sig=s=>JSON.stringify(s.map(v=>[v.id,v.p,v.n,v.color]));
for(const n of [9,10]){
 test(`${n}×${n}: complete slice vocabulary, exact inverse moves, and uniformly separated circle nodes`,()=>{
  const app=createHarness({htmlPath:path.resolve(__dirname,`../dist/games/cube${n}.html`),bundled:true,speed:5});
  const E=app.context.CubeEngine,G=app.context.RingGeometry,home=E.makeSolved(),homeSig=sig(home),degree=6*n*n;
  assert.equal(home.length,degree);assert.equal(Object.keys(E.configs).length,3*n);assert.equal(G.rings.length,3*n);
  assert.equal(G.faceRings.length,6*Math.floor(n/2));assert(G.nodeSpacing>8);
  assert.equal(app.document.querySelectorAll('.notation-key').length,6*n);
  assert.equal(app.document.querySelectorAll('.ring-key').length,3*n);
  assert.equal(new Set(home.map(s=>s.p+'/'+s.n)).size,degree);
  assert.equal(new Set(home.map(s=>{const p=G.position(s);return p.x.toFixed(7)+','+p.y.toFixed(7);})).size,degree);
  const point=home.map(G.position);
  for(let i=0;i<point.length;i++){
   let closest=Infinity,neighbor=-1;for(let j=0;j<point.length;j++)if(i!==j){const d=Math.hypot(point[i].x-point[j].x,point[i].y-point[j].y);if(d<closest){closest=d;neighbor=j;}}
   assert.equal(home[i].color,home[neighbor].color,'solved node nearest neighbor stays in its color cluster');
  }
  const external={CUBE_SIZE:n};external.window=external;vm.createContext(external);vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../dist/games/nxn-engine.js'),'utf8'),external);
  assert.equal(JSON.stringify(E.configs),JSON.stringify(external.CubeEngine.configs));
  for(const [face,cfg]of Object.entries(E.configs)){
   const r=G.getRing(face);assert.equal(r.slots.length,4*n);
   for(const slot of r.slots)assert(Math.abs(Math.hypot(slot.x-r.cx,slot.y-r.cy)-r.r)<1e-7);
   for(const token of [face,face+"'",face+'2']){
    const m=E.normalizeMove(token),next=E.applyMove(home,m);assert.equal(E.moveLabel(m),token.replace('iiii','iv'));
    assert.equal(sig(E.applyMove(next,E.invertMove(m))),homeSig);
    const moved=next.filter((s,i)=>s.p.join()!=home[i].p.join()||s.n.join()!=home[i].n.join()).length;
    assert.equal(moved,cfg.inner?4*n:n*n+4*n-(n%2));
    for(let i=0;i<home.length;i++)for(const t of [0,.2,.6,1]){
     const p=G.interpolateSticker(home[i],next[i],face,t,cfg.turn*m.dir*m.turns);assert(Number.isFinite(p.x)&&Number.isFinite(p.y));
     if(home[i].p[cfg.axis]===cfg.layer&&home[i].n[cfg.axis]===0)assert(Math.abs(Math.hypot(p.x-r.cx,p.y-r.cy)-r.r)<1e-6,'belt motion is circular');
    }
   }
   let state=home;for(let k=0;k<4;k++)state=E.applyMove(state,face);assert.equal(sig(state),homeSig);
  }
  if(n===10)assert.equal(JSON.stringify(E.normalizeMove("Riv'")),JSON.stringify(E.normalizeMove("Riiii'")));
  assert.equal(E.configs[n===9?'Riii':'Riiii'].label,n===9?'Right third inner':'Right fourth inner');
  for(const bad of n===9?['Riiii','M3','Siii']:['Riiiii','M','E','S'])assert.throws(()=>E.normalizeMove(bad));
  for(let seed=0;seed<8;seed++){
   const moves=E.scramble('cube'+n+'-'+seed);assert.equal(moves.length,n*12);
   const mixed=moves.reduce(E.applyMove,home);assert(!E.isSolved(mixed));assert.equal(sig(moves.slice().reverse().map(E.invertMove).reduce(E.applyMove,mixed)),homeSig);
  }
 });
 test(`${n}×${n}: native deepest-slice controls, fast scramble/Stop and solver node mapping`,()=>{
  const app=createHarness({htmlPath:path.resolve(__dirname,`../dist/games/cube${n}.html`),bundled:true,speed:5}),api=app.context.PUZZLE_API,E=app.context.CubeEngine;
  const homeSig=sig(app.snapshot().stickers);assert.equal(api.puzzle,'cube'+n);assert.equal(app.context.PUZZLE_SOLVER_BRIDGE.nodes().length,6*n*n);
  for(const f of n===9?['Riii','Uiii','Biii','M','E','S']:['Riiii','Liiii','Uiiii','Diiii','Fiiii','Biiii']){
   app.select(f);app.click('cw');app.complete();app.click('ccw');app.complete();assert.equal(sig(app.snapshot().stickers),homeSig);
  }
  app.click('randomize');assert.equal(app.elements.get('speed').value,'5');app.frame(2000);const committed=sig(app.snapshot().stickers);app.frame(20);app.click('pause');
  assert.equal(app.snapshot().mode,'idle');assert.equal(app.snapshot().animating,false);assert.equal(sig(app.snapshot().stickers),committed);assert.equal(app.elements.get('speed').value,'5');
  assert(api.move(n===9?'M':'Riiii'));app.complete();assert.equal(app.context.PUZZLE_SOLVER_BRIDGE.nodes().length,6*n*n);app.click('reset');assert(E.isSolved(app.snapshot().stickers));
 });
}
