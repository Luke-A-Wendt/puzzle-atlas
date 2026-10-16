'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {test}=require('node:test');
const {createHarness}=require('./game-harness.cjs');
const htmlPath=path.resolve(__dirname,'../dist/games/cube8.html');
const sig=s=>JSON.stringify(s.map(v=>[v.id,v.p,v.n,v.color]));
function host(){return createHarness({htmlPath,bundled:true,speed:5});}

test('8×8 has 384 distinct stickers, 24 single-slice controls, and exact legal generators',()=>{
 const app=host(),E=app.context.CubeEngine,G=app.context.RingGeometry,home=E.makeSolved(),homeSig=sig(home);
 assert.equal(home.length,384);assert.equal(Object.keys(E.configs).length,24);
 assert.equal(G.rings.length,24);assert.equal(G.faceRings.length,24);
 assert.equal(new Set(home.map(s=>s.p+'/'+s.n)).size,384);
 assert.equal(new Set(home.map(s=>{const p=G.position(s);return p.x.toFixed(7)+','+p.y.toFixed(7);})).size,384);
 assert(G.nodeSpacing>10,'resting nodes retain legible separation');
 assert.equal(app.document.querySelectorAll('.ring-key').length,24);
 assert.equal(app.document.querySelectorAll('.notation-key').length,24);
 const generators=[];
 for(const [face,cfg] of Object.entries(E.configs)){
  assert.equal(G.getRing(face).slots.length,32);
  assert.equal(cfg.depth,Math.min((cfg.layer+7)/2,(7-cfg.layer)/2));
  for(const token of [face,face+"'",face+'2']){
   const m=E.normalizeMove(token);generators.push(m);
   assert.equal(E.moveLabel(m),token);
   const after=E.applyMove(home,m);
   assert.equal(new Set(after.map(s=>s.p+'/'+s.n)).size,384);
   assert.equal(sig(E.applyMove(after,E.invertMove(m))),homeSig);
   const moved=after.filter((s,i)=>s.p.join()!=home[i].p.join()||s.n.join()!=home[i].n.join()).length;
   assert.equal(moved,cfg.inner?32:96);
  }
  let state=home;for(let i=0;i<4;i++)state=E.applyMove(state,face);assert.equal(sig(state),homeSig);
 }
 assert.equal(generators.length,72);
 assert.equal(E.configs.Riii.label,'Right third inner');
 for(const bad of ['Riiii','M','E','S','Riii3'])assert.throws(()=>E.normalizeMove(bad));
 const external={CUBE_SIZE:8};external.window=external;vm.createContext(external);
 vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../dist/games/nxn-engine.js'),'utf8'),external);
 assert.deepEqual(JSON.parse(JSON.stringify(external.CubeEngine.configs)),JSON.parse(JSON.stringify(E.configs)));
 assert.equal(sig(external.CubeEngine.makeSolved()),homeSig);
 for(let seed=0;seed<12;seed++){
  const moves=E.scramble('cube8-'+seed);assert.equal(moves.length,96);
  const mixed=moves.reduce(E.applyMove,home);assert(!E.isSolved(mixed));
  assert.equal(sig([...moves].reverse().map(E.invertMove).reduce(E.applyMove,mixed)),homeSig);
 }
});

test('8×8 native UI exposes deepest layers and live solver bridge, including Stop and speed restoration',()=>{
 const app=host(),api=app.context.PUZZLE_API,E=app.context.CubeEngine,homeSig=sig(app.snapshot().stickers);
 assert.equal(api.puzzle,'cube8');assert.equal(app.context.PUZZLE_SOLVER_BRIDGE.nodes().length,384);
 const viewport=app.context.PUZZLE_SOLVER_BRIDGE.viewport();assert(viewport.scale>0);assert(Number.isFinite(viewport.x)&&Number.isFinite(viewport.y));
 for(const face of ['Riii','Liii','Uiii','Diii','Fiii','Biii']){
  app.select(face);app.click('cw');app.complete();app.click('ccw');app.complete();assert.equal(sig(app.snapshot().stickers),homeSig);
 }
 api.runMoves("Riii Uiii2 Fiii' Lii D Biii");app.complete();assert.equal(app.snapshot().history.length,18);
 app.click('randomize');assert.equal(app.elements.get('speed').value,'5');assert.equal(app.elements.get('pause').textContent,'Stop');
 app.frame(2000);const committed=sig(app.snapshot().stickers);app.frame(20);app.click('pause');
 assert.equal(app.snapshot().mode,'idle');assert.equal(app.snapshot().animating,false);assert.equal(sig(app.snapshot().stickers),committed);
 assert.equal(app.elements.get('speed').value,'5');assert.equal(app.elements.get('pause').hidden,true);
 assert(api.move('Riii'));app.complete();assert.equal(app.context.PUZZLE_SOLVER_BRIDGE.nodes().length,384);
 app.click('reset');assert(E.isSolved(app.snapshot().stickers));
});

test('8×8 ring belts and face companions capture every moving sticker and exact native endpoints',()=>{
 require('./cube-companion-rings.test.cjs').verifyPage('cube8');
});
