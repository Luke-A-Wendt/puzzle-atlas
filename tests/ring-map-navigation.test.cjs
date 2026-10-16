'use strict';
// Execute the production event handlers, canvas viewport math and selection
// overlay together. This is geometry/interaction QA, not a browser screenshot.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createPage}=require('./solver-dom.cjs');
const {dragPath}=require('./connected-ring-drag-helper.cjs');
const games=path.resolve(__dirname,'../dist/games');
const puzzles=require('../dist/games/constrained-solver-models/manifest.json').models.map(m=>m.id);
const plain=x=>JSON.parse(JSON.stringify(x));
const near=(actual,expected,message)=>assert(Math.abs(actual-expected)<1e-7,message+': '+actual+' vs '+expected);
const event=(x,y,id=31)=>({clientX:x,clientY:y,pointerId:id,button:0});
function host(id){
 class Worker {constructor(){this.listeners={};}postMessage(){}addEventListener(t,f){(this.listeners[t]||=[]).push(f);}removeEventListener(){}terminate(){}}
 return createPage(id,{globals:{Worker,fetch:async url=>{const file=path.join(games,new URL(String(url),'https://atlas.test/games/').pathname.replace(/^\/games\//,''));return{ok:fs.existsSync(file),text:async()=>fs.readFileSync(file,'utf8')};}}});
}
for(const puzzle of puzzles)test(puzzle+': pointer-centered zoom composes every node and restores exact default framing',async()=>{
 const app=createPage(puzzle);await app.flush();
 const N=app.context.RingMapNavigation,B=app.context.PUZZLE_SOLVER_BRIDGE,canvas=app.element('rings');
 assert(N,'navigation script is present');
 const before=plain(B.nodes()),initial=plain(B.viewport()),history=app.snapshot().history.length;
 assert(before.length>0);
 const anchor={x:190,y:220};canvas.dispatch('wheel',{...event(anchor.x,anchor.y),deltaY:-400,deltaMode:0});await app.advance(0);
 const state=N.state(),after=B.nodes();assert(state.zoom>1);
 for(let i=0;i<before.length;i++){
  near(after[i].x,anchor.x+(before[i].x-anchor.x)*state.zoom,'node x follows the composed viewport');
  near(after[i].y,anchor.y+(before[i].y-anchor.y)*state.zoom,'node y follows the composed viewport');
 }
 const view=plain(N.state());app.click('ringFocus');await app.advance(0);assert.deepEqual(plain(N.state()),view,'ring contrast never changes navigation');
 canvas.dispatch('wheel',{...event(430,410),deltaY:10000,deltaMode:0});await app.advance(0);
 assert.equal(N.state().zoom,1);assert.equal(N.state().panX,0);assert.equal(N.state().panY,0);assert.deepEqual(plain(B.viewport()),initial);
 assert.equal(app.snapshot().history.length,history,'navigation never applies a puzzle move');
});
test('blank-space dragging pans, zoom-out recenters, keyboard zoom is bounded, and animation blocks navigation',async()=>{
 const app=createPage('cube3');await app.flush();const canvas=app.element('rings'),N=app.context.RingMapNavigation,api=app.context.PUZZLE_API;
 canvas.dispatch('pointerdown',event(1,1));canvas.dispatch('pointermove',event(41,31));canvas.dispatch('pointerup',event(41,31));await app.advance(0);
 near(N.state().panX,40,'blank drag pan x');near(N.state().panY,30,'blank drag pan y');assert.equal(app.snapshot().history.length,0);
 canvas.dispatch('wheel',{...event(250,250),deltaY:100});await app.advance(0);assert.equal(N.state().panX,0);assert.equal(N.state().zoom,1);
 for(let i=0;i<30;i++)canvas.dispatch('keydown',{key:'+'});await app.advance(0);assert.equal(N.state().zoom,8);
 canvas.dispatch('keydown',{key:'0'});await app.advance(0);assert.equal(N.state().zoom,1);
 api.move({face:'U',dir:1});const before=plain(N.state());canvas.dispatch('wheel',{...event(250,250),deltaY:-200});assert.deepEqual(plain(N.state()),before,'an animating permutation cannot move the map');await app.settle();
});
for(const puzzle of ['tetraminx','jewel'])test(puzzle+': ring turn paths remain exact after zoom and a second finger cancels the pending turn',async()=>{
 const app=createPage(puzzle);await app.flush();const api=app.context.PUZZLE_API,N=app.context.RingMapNavigation,B=app.context.PUZZLE_SOLVER_BRIDGE,canvas=app.element('rings');
 const G=puzzle==='tetraminx'?app.context.TetraRings:app.context.FaceGroupedRings.create(app.context.ShapeEngine.create(puzzle));
 canvas.dispatch('wheel',{...event(250,250),deltaY:-250});await app.advance(0);
 let route=null,face=null;for(const button of app.element('viewRingSelector').querySelectorAll('.ring-key')){route=dragPath(G,button.dataset.face,1,app.snapshot().selected);if(route){face=button.dataset.face;break;}}
 assert(route);const screen=(p,id=31)=>{const v=B.viewport();return event(v.x+p.x*v.scale,v.y+p.y*v.scale,id);};
 canvas.dispatch('pointerdown',screen(route.samples[0]));for(const p of route.samples.slice(1))canvas.dispatch('pointermove',screen(p));canvas.dispatch('pointerup',screen(route.samples.at(-1)));await app.settle();
 assert.equal(app.snapshot().history.length,1);assert.equal(app.snapshot().history[0].face,face);assert.equal(app.snapshot().history[0].dir,1);
 api.reset();await app.advance(0);N.reset();await app.advance(0);
 const p=screen(route.samples[0]);canvas.dispatch('pointerdown',p);canvas.dispatch('pointermove',screen(route.samples[4]));
 canvas.dispatch('pointerdown',event(340,330,32));canvas.dispatch('pointermove',event(380,370,32));canvas.dispatch('pointerup',event(380,370,32));canvas.dispatch('pointerup',screen(route.samples.at(-1)));await app.settle();
 assert.equal(app.snapshot().history.length,0,'pinching cannot finish the first finger’s pending ring turn');assert(N.state().zoom>1);
});
test('constrained node clicks and lasso share the zoomed viewport; two fingers pan without toggling holds',async()=>{
 const app=host('cube2');await app.flush();const ui=app.context.ConstrainedSolverUI,B=app.context.PUZZLE_SOLVER_BRIDGE,N=app.context.RingMapNavigation;
 ui.setActive(true);for(let i=0;i<80&&ui.state().phase==='loading';i++)await app.advance(0);assert.equal(ui.state().phase,'selecting');
 const overlay=app.element('csNodeOverlay');overlay.dispatch('wheel',{...event(250,250),deltaY:-200});await app.advance(0);
 const node=B.nodes().find(n=>n.x>30&&n.x<470&&n.y>30&&n.y<470);assert(node);
 overlay.dispatch('pointerdown',event(node.x,node.y));overlay.dispatch('pointerup',event(node.x,node.y));await app.advance(0);assert(ui.state().held.includes(node.stickerId),'zoomed tile is the selected hold');
 // An uncommitted one-finger lasso must be abandoned when the gesture becomes
 // two-finger navigation. At base scale, equal-distance movement is pure pan.
 const holds=plain(ui.state().held);N.reset();await app.advance(0);
 overlay.dispatch('pointerdown',event(100,100,41));overlay.dispatch('pointermove',event(105,105,41));overlay.dispatch('pointerdown',event(200,105,42));
 overlay.dispatch('pointermove',event(135,125,41));overlay.dispatch('pointermove',event(230,125,42));
 overlay.dispatch('pointerup',event(135,125,41));overlay.dispatch('pointerup',event(230,125,42));await app.advance(0);
 near(N.state().zoom,1,'parallel fingers retain base scale');near(N.state().panX,30,'two-finger pan x');near(N.state().panY,20,'two-finger pan y');assert.deepEqual(plain(ui.state().held),holds,'pinch/pan does not commit the lasso');
 const center=B.nodes().find(n=>n.x>50&&n.x<450&&n.y>50&&n.y<450&&!holds.includes(n.stickerId));assert(center);
 const polygon=[[-9,-9],[9,-9],[9,9],[-9,9],[-9,-9]].map(([x,y])=>event(center.x+x,center.y+y));
 overlay.dispatch('pointerdown',polygon[0]);for(const p of polygon.slice(1))overlay.dispatch('pointermove',p);overlay.dispatch('pointerup',polygon.at(-1));await app.advance(0);
 assert(ui.state().held.includes(center.stickerId),'lasso points remain in the same coordinates as the transformed nodes');assert.equal(app.snapshot().history.length,0);
});
