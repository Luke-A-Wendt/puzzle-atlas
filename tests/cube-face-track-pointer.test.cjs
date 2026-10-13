'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {createHarness}=require('./game-harness.cjs');
const TAU=2*Math.PI,mod=(x,n)=>(x%n+n)%n;
const clean=x=>JSON.parse(JSON.stringify(x));
function viewport(app){
 const b=app.elements.get('rings').bounds,G=app.context.RingGeometry;
 const focused=app.elements.has('ringFocus')&&app.elements.get('ringFocus').attributes['aria-pressed']==='true';
 const r=G.getRing(app.snapshot().selected),zoom=focused?180/r.r:1;
 const scale=Math.min((b.width-34)/500,(b.height-(app.elements.has('ringFocus')?36:30))/500)*zoom;
 return{scale,ox:b.width/2-(focused?r.cx:250)*scale,oy:b.height/2-(focused?r.cy:250)*scale-5};
}
function screen(p,v){return{clientX:v.ox+p.x*v.scale,clientY:v.oy+p.y*v.scale,pointerId:71};}
function on(r,t){return r.companion?r.at(t*r.period):{x:r.cx+r.r*Math.cos(t*TAU),y:r.cy+r.r*Math.sin(t*TAU)};}
function visible(p,v){const s=screen(p,v);return s.clientX>5&&s.clientX<495&&s.clientY>5&&s.clientY<495;}
function findPath(G,r,selected,v,direction){
 for(let start=0;start<240;start++){
  const phase=(start+.37)/240,p=on(r,phase),nearest=G.nearestRing(p,selected);
  if(nearest.r!==r||nearest.d*v.scale>2||!visible(p,v))continue;
  const samples=Array.from({length:11},(_,i)=>on(r,phase+direction*i*.006));
  if(!samples.every(p=>visible(p,v)))continue;
  let total=0,last=G.angleAt(samples[0],r);
  for(const p of samples.slice(1)){const angle=G.angleAt(p,r);total+=mod(angle-last+Math.PI,TAU)-Math.PI;last=angle;}
  if(Math.abs(total)>.25&&Math.abs(total)<.6)return{samples,total,r};
 }
 return null;
}
function dispatch(app,route,v){
 const canvas=app.elements.get('rings');canvas.dispatch('pointerdown',screen(route.samples[0],v));
 // Render every part of the gesture, so stale versus recentered viewport bugs
 // cannot hide behind handlers dispatched in a single animation frame.
 app.frame(0);
 for(const p of route.samples.slice(1)){canvas.dispatch('pointermove',screen(p,v));app.frame(0);}
 canvas.dispatch('pointerup',screen(route.samples.at(-1),v));app.complete();
}
function verifyMove(app,E,route,label){
 const s=app.snapshot(),dir=-Math.sign(route.total)*E.configs[route.r.name].turn;
 assert.equal(s.history.length,1,label+' performs exactly one move');
 assert.equal(s.history[0].face,route.r.name,label+' selects the touched face/slice');
 assert.equal(s.history[0].dir,dir,label+' follows the physical turn direction');
 assert.deepEqual(s.stickers,clean(E.applyMove(E.makeSolved(),{face:route.r.name,dir,turns:1})),label+' reaches the exact engine state');
}
function run(types=['cube2','cube3','cube4','cube5','cube6','cube7','mirror','homer']){
 for(const type of types){
  const app=createHarness({htmlPath:path.join(__dirname,'../dist/games/'+type+'.html'),bundled:true,speed:5});
  const api=app.context.PUZZLE_API,G=app.context.RingGeometry,E=app.context[type==='mirror'?'MirrorEngine':'CubeEngine'];
  assert(G.faceRings.length,type+' installs actual face tracks');
  let checked=0;
  for(const r of [...G.faceRings,...G.rings])for(const direction of [-1,1]){
   api.reset();api.select(r.name);app.frame(0);
   const v=viewport(app),route=findPath(G,r,r.name,v,direction);
   assert(route,type+' '+r.name+(r.companion?' face perimeter '+r.radius:' belt')+' is a usable visible curve');
   dispatch(app,route,v);verifyMove(app,E,route,type+' '+r.name);checked++;
  }
  // Clicking an unselected companion must select its face, not a nearby belt.
  api.reset();api.select('R');app.frame(0);
  const v=viewport(app),route=G.faceRings.filter(r=>r.name!=='R').map(r=>findPath(G,r,'R',v,1)).find(Boolean);
  assert(route,type+' exposes an unselected companion');
  const canvas=app.elements.get('rings'),first=screen(route.samples[0],v);
  canvas.dispatch('pointerdown',first);app.frame(0);canvas.dispatch('pointermove',first);canvas.dispatch('pointerup',first);app.complete();
  assert.equal(app.snapshot().selected,route.r.name);assert.equal(app.snapshot().history.length,0,type+' stationary companion click does not turn');
  api.reset();api.select('R');app.frame(0);dispatch(app,route,v);verifyMove(app,E,route,type+' unselected companion');
  api.reset();app.frame(0);const cancel=findPath(G,route.r,route.r.name,viewport(app),1);
  canvas.dispatch('pointerdown',screen(cancel.samples[0],viewport(app)));canvas.dispatch('pointermove',screen(cancel.samples.at(-1),viewport(app)));canvas.dispatch('pointercancel',screen(cancel.samples.at(-1),viewport(app)));app.frame(0);
  assert.equal(app.snapshot().history.length,0,type+' cancelled gesture does not turn');
  if(app.elements.has('ringFocus')){
   api.reset();api.select('R');app.frame(0);app.click('ringFocus');app.frame(0);
   const fv=viewport(app),focused=G.faceRings.filter(r=>r.name!=='R').map(r=>findPath(G,r,'R',fv,1)).find(Boolean);
   assert(focused,type+' focus still exposes another face companion');
   const fp=screen(focused.samples[0],fv);
   canvas.dispatch('pointerdown',fp);app.frame(0);canvas.dispatch('pointermove',fp);app.frame(0);canvas.dispatch('pointerup',fp);app.complete();
   assert.equal(app.snapshot().selected,focused.r.name);assert.equal(app.snapshot().history.length,0,type+' focus selection does not create motion at a stationary pointer');
   api.reset();api.select('R');app.frame(0);dispatch(app,focused,fv);verifyMove(app,E,focused,type+' focused companion across frames');
   app.click('ringFocus');app.frame(0);
  }
  console.log(type+': '+checked+' physical face/belt drags, unselected companion click/drag, cancellation'+(app.elements.has('ringFocus')?' and stable focused viewport':'')+' PASS');
 }
}
module.exports={run};if(require.main===module)run();
