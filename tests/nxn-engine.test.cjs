'use strict';
const assertAutoSolveDelegates=require('./auto-solve-delegate.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createHarness}=require('./game-harness.cjs');
const root=path.resolve(__dirname,'..');
const plain=x=>JSON.parse(JSON.stringify(x)),signature=s=>JSON.stringify(s.map(v=>[v.id,v.p,v.n]));
for(const N of [5,6,7]){
 const ctx={CUBE_SIZE:N};ctx.window=ctx;vm.createContext(ctx);
 for(const name of ['nxn-engine.js','nxn-rings.js'])vm.runInContext(fs.readFileSync(path.join(root,'dist/games',name),'utf8'),ctx);
 const E=ctx.CubeEngine,G=ctx.RingGeometry,home=E.makeSolved(),homeSig=signature(home);
 assert.equal(home.length,6*N*N);assert.equal(Object.keys(E.configs).length,3*N);assert.equal(G.rings.length,3*N);assert.equal(G.slots.length,6*N*N);assert(E.isSolved(home));
 const occupied=new Set(home.map(s=>s.p.join(',')+'|'+s.n.join(',')));assert.equal(occupied.size,6*N*N);
 const points=home.map(s=>G.position(s));assert(points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));assert.equal(new Set(points.map(p=>p.x.toFixed(7)+':'+p.y.toFixed(7))).size,6*N*N);
 for(const ring of G.rings){
  const {axis,layer}=ring,cfg=E.configs[ring.name];
  assert.equal(ring.slots.length,4*N);
  for(const s of ring.slots)assert(Math.abs(Math.hypot(s.x-ring.cx,s.y-ring.cy)-ring.r)<1e-6);
  for(const dir of [-1,1])for(const turns of [1,2]){
   const m={face:ring.name,dir,turns},next=E.applyMove(home,m);
   assert.equal(signature(E.applyMove(next,E.invertMove(m))),homeSig);
   assert.equal(new Set(next.map(s=>s.p.join(',')+'|'+s.n.join(','))).size,6*N*N);
   assert(next.every(s=>occupied.has(s.p.join(',')+'|'+s.n.join(','))));
   assert(next.every((s,i)=>s.color===home[i].color));
   if(cfg.inner){const corners=s=>s.p.every(v=>Math.abs(v)===N-1);assert.equal(signature(next.filter(corners)),signature(home.filter(corners)));}
   const converted=ring.slots.map(s=>E.applyMove([s],m)[0]).map(s=>G.position(s));
   const dest=converted.map(p=>ring.slots.findIndex(s=>Math.hypot(s.x-p.x,s.y-p.y)<1e-6));
   assert(dest.every(i=>i>=0));const shift=dest.map((index,i)=>(index-i+4*N)%(4*N));assert.equal(new Set(shift).size,1);assert.equal(shift[0],((-cfg.turn*dir*turns*N)%(4*N)+4*N)%(4*N));
   assert.equal(E.moveLabel(E.normalizeMove(E.moveLabel(m))),E.moveLabel(m));
  }
  let s=home;for(let i=0;i<4;i++)s=E.applyMove(s,{face:ring.name,dir:1});assert.equal(signature(s),homeSig);
 }
 for(let seed=0;seed<100;seed++){
  const moves=E.scramble('N'+N+'-'+seed),again=E.scramble('N'+N+'-'+seed);assert.deepEqual(plain(moves),plain(again));
  let s=home;for(const move of moves)s=E.applyMove(s,move);assert(!E.isSolved(s));
  for(const move of [...moves].reverse())s=E.applyMove(s,E.invertMove(move));assert.equal(signature(s),homeSig);
 }
 const html=fs.readFileSync(path.join(root,`dist/games/cube${N}.html`),'utf8'),embedded=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1].trim());
 for(const [index,name] of [[1,'nxn-engine.js'],[2,'nxn-rings.js'],[4,'nxn-app.js']])assert.equal(embedded[index],fs.readFileSync(path.join(root,'dist/games',name),'utf8').trim(),'Embedded code drift: '+name);
 const app=createHarness({htmlPath:path.join(root,`dist/games/cube${N}.html`),bundled:true,speed:5});
 assert.equal(app.context.PUZZLE_API.puzzle,'cube'+N);assert.equal(app.document.querySelectorAll('.ring-key').length,3*N);assert.equal(app.document.querySelectorAll('.notation-key').length,3*N);
 for(const face of Object.keys(E.configs)){app.select(face);app.click('cw');app.complete();app.click('ccw');app.complete();assert.equal(signature(app.snapshot().stickers),homeSig);}
 app.click('randomize');app.frame(50);app.click('pause');const paused=app.snapshot();app.frame(500);assert.equal(signature(app.snapshot().stickers),signature(paused.stickers));assert(app.snapshot().paused);app.click('pause');app.complete();const seed=app.snapshot().seed;assert(seed);assert.equal(app.snapshot().history.length,N*12);assert(!E.isSolved(app.snapshot().stickers));
 app.context.PUZZLE_API.runMoves(N%2?"R M E' S2 Ri2":"R Rii Fii' Uii2");app.complete();assert.equal(app.snapshot().userTurns,N%2?5:4);
 app.click('undo');app.complete();assert.equal(app.snapshot().userTurns,N%2?4:3);
 const length=app.snapshot().history.length;assertAutoSolveDelegates(app.context);assert.equal(app.snapshot().history.length,length);assert(!E.isSolved(app.snapshot().stickers));
 app.click('randomize');app.complete();assert.notEqual(app.snapshot().seed,seed);app.click('reset');assert.equal(signature(app.snapshot().stickers),homeSig);
 app.click('ringFocus');app.frame();assert.equal(app.elements.get('ringFocus').attributes['aria-pressed'],'true');
 const view=app.snapshot().view;app.elements.get('cube').dispatch('wheel',{deltaY:-100});app.frame();assert(app.snapshot().view.zoom>view.zoom);assert.equal(signature(app.snapshot().stickers),homeSig);
 console.log(`${N}×${N}: ${3*N} moves, ${6*N*N} stickers, exact ring cycles, 100 seeded inverses, UI scramble/play/undo/pause/Auto Solve delegation passed`);
}
