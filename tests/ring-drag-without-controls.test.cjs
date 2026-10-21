'use strict';
// Real pointer handlers in a hierarchical DOM: retiring the native control
// subtree must never retire the sibling canvas or constrained-selection layer.
const test=require('node:test'),assert=require('node:assert/strict');
const {createPage}=require('./solver-dom.cjs');
const {dragPath}=require('./connected-ring-drag-helper.cjs');
const TAU=2*Math.PI,mod=(x,n)=>(x%n+n)%n;
const plain=value=>JSON.parse(JSON.stringify(value));
function screen(app,p){const v=app.context.PUZZLE_SOLVER_BRIDGE.viewport();return{button:0,pointerId:27,clientX:v.x+p.x*v.scale,clientY:v.y+p.y*v.scale};}
function cubePath(G,ring,direction,selected){
 const on=t=>ring.companion?ring.at(t*ring.period):{x:ring.cx+ring.r*Math.cos(t*TAU),y:ring.cy+ring.r*Math.sin(t*TAU)};
 for(let k=0;k<240;k++){
  const start=(k+.37)/240,near=G.nearestRing(on(start),selected);if(near.r!==ring||near.d>.02)continue;
  const samples=Array.from({length:11},(_,i)=>on(start+direction*i*.006));let total=0,last=G.angleAt(samples[0],ring);
  for(const p of samples.slice(1)){const angle=G.angleAt(p,ring);total+=mod(angle-last+Math.PI,TAU)-Math.PI;last=angle;}
  if(Math.abs(total)>.25&&Math.abs(total)<.6)return{samples,total,face:ring.name};
 }
 return null;
}
async function gesture(app,path,{cancel=false,click=false}={}){
 const canvas=app.element('rings');canvas.dispatch('pointerdown',screen(app,path.samples[0]));await app.advance(0);
 if(!click)for(const p of path.samples.slice(1)){canvas.dispatch('pointermove',screen(app,p));await app.advance(0);}
 canvas.dispatch(cancel?'pointercancel':'pointerup',screen(app,click?path.samples[0]:path.samples.at(-1)));await app.settle();
}
for(const puzzle of ['cube3','tetraminx','jewel'])test(puzzle+': exposed ring drag, click, cancel and solver locking survive removal of the native panel',async()=>{
 const app=createPage(puzzle),api=app.context.PUZZLE_API,D=app.context.PuzzleAxisDisplay;await app.flush();
 const native=app.element('selector').closest('.ring-controls'),canvas=app.element('rings');
 assert.equal(native.hidden,true);assert.equal(native.inert,true);assert.equal(native.getAttribute('aria-hidden'),'true');
 assert.equal(native.contains(canvas),false);assert.equal(native.contains(app.element('constrainedSolverControls')),false);
 for(let node=canvas;node;node=node.parentNode){assert.equal(node.hidden,false,'ring canvas ancestry remains visible');assert.equal(node.inert,false,'ring canvas ancestry remains interactive');}
 // All-rings mode prevents the viewport from changing after selection, and
 // suppressing labels makes this an unambiguous curve-target test.
 if(app.element('ringFocus').getAttribute('aria-pressed')==='true')app.click('ringFocus');D.toggleRingLabels();await app.advance(0);
 const isCube=puzzle==='cube3',E=isCube?app.context.CubeEngine:null;
 const G=isCube?app.context.RingGeometry:puzzle==='tetraminx'?app.context.TetraRings:app.context.FaceGroupedRings.create(app.context.ShapeEngine.create(puzzle));
 const axes=app.element('viewRingSelector').querySelectorAll('.ring-key').map(button=>button.dataset.face);
 const reset=async()=>{api.reset();D.clear();if(D.ringLabelsVisible())D.toggleRingLabels();await app.advance(0);};
 const route=(direction,selected=app.snapshot().selected)=>{
  if(isCube)return [...G.faceRings,...G.rings].map(ring=>cubePath(G,ring,direction,selected)).find(Boolean);
  for(const face of axes){const path=dragPath(G,face,direction,selected);if(path)return{...path,face};}return null;
 };
 for(const direction of [-1,1]){
  await reset();assert.equal(app.element('viewRingSelectedName').textContent,'Select axis');
  const path=route(direction);assert(path,'a visible ring can be selected without a button');
  const expectedDirection=isCube?-Math.sign(path.total)*E.configs[path.face].turn:direction;
  api.move({face:path.face,dir:expectedDirection,turns:1});await app.settle();const expected=plain(app.snapshot().stickers||app.snapshot().pieces);
  await reset();await gesture(app,path);
  const after=app.snapshot();assert.equal(after.history.length,1);assert.equal(after.history[0].face,path.face);assert.equal(after.history[0].dir,expectedDirection);
  assert.deepEqual(plain(after.stickers||after.pieces),expected,'drag reaches the existing legal engine permutation');
  assert.equal(app.element('viewRingSelectedName').textContent,'','selected axis is not repeated between the turn buttons');
  assert.equal(app.element('viewRingCW').disabled,false);assert.equal(native.hidden,true);assert.equal(native.inert,true);
 }
 await reset();const path=route(1);await gesture(app,path,{click:true});assert.equal(app.snapshot().history.length,0);assert.equal(app.snapshot().selected,path.face,'click selects without a turn');
 await reset();await gesture(app,path,{cancel:true});assert.equal(app.snapshot().history.length,0,'cancel cannot perform a move');
 // Entering constrained mode must still cover/block the ring canvas. The
 // hidden controls cannot accidentally widen the gesture's permission scope.
 const ui=app.context.ConstrainedSolverUI;await ui.setActive(true);await app.flush();assert.equal(ui.blocksManualMoves(),true);
 const before=plain(app.snapshot().stickers||app.snapshot().pieces),count=app.snapshot().history.length;
 canvas.dispatch('pointerdown',screen(app,path.samples[0]));for(const p of path.samples.slice(1))canvas.dispatch('pointermove',screen(app,p));canvas.dispatch('pointerup',screen(app,path.samples.at(-1)));await app.advance(0);
 assert.equal(app.snapshot().history.length,count);assert.deepEqual(plain(app.snapshot().stickers||app.snapshot().pieces),before);assert.equal(app.snapshot().animating,false);
 await ui.setActive(false);await app.flush();assert.equal(native.hidden,true);assert.equal(native.inert,true);
});
