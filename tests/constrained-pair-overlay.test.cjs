'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createCanvas}=require('@napi-rs/canvas');
const {createPage,Element}=require('./solver-dom.cjs');
const games=path.join(__dirname,'../dist/games');
const canvases=new WeakMap(),getContext=Element.prototype.getContext;
Element.prototype.getContext=function(kind){
  if(this.id!=='csNodeOverlay')return getContext.call(this,kind);
  if(!canvases.has(this))canvases.set(this,createCanvas(500,500));
  return canvases.get(this).getContext(kind);
};
class QuietWorker{postMessage(){} addEventListener(){} removeEventListener(){} terminate(){}}
const fetchFile=async url=>{const file=path.join(games,new URL(String(url),'https://atlas.test/games/').pathname.replace(/^\/games\//,''));return{ok:fs.existsSync(file),text:async()=>fs.readFileSync(file,'utf8')};};

for(const held of [false,true])test('selected 1/2 badges remain white above neighboring eligibility masks'+(held?' while retaining held outlines':''),async()=>{
  const app=createPage('cube2',{skipScripts:['constrained-solver.js'],globals:{Worker:QuietWorker,fetch:fetchFile}});
  const nativeBridge=app.context.PUZZLE_SOLVER_BRIDGE;
  const ids=Array.from(nativeBridge.nodes()).slice(0,4).map(n=>n.stickerId);
  const radius=held?19.7:13;
  // Force the two later-painted uncertain nodes directly under the number
  // badges. This recreates the real dense-map overlap independently of ring
  // layout order, using the production overlay and a native canvas rasterizer.
  const points=[{x:100,y:100},{x:300,y:300},{x:100+radius+6,y:100-radius-4},{x:300+radius+6,y:300-radius-4}];
  const nodes=ids.map((stickerId,i)=>({stickerId,...points[i],r:10,highlightLineWidth:2.2,highlightOuterRadius:10}));
  app.context.PUZZLE_SOLVER_BRIDGE=Object.freeze({...nativeBridge,nodes:()=>nodes});
  app.document.currentScript={src:'https://atlas.test/games/constrained-solver.js'};app.loadScript('constrained-solver.js');app.document.currentScript=null;
  const ui=app.context.ConstrainedSolverUI;ui.setActive(true);
  for(let i=0;i<80&&ui.state().phase==='loading';i++)await app.advance(0);
  assert.equal(ui.state().phase,'selecting');
  if(held)for(const id of ids.slice(0,2))assert.equal(ui.selectNode(id),true);
  ui.setTool('swap');for(const id of ids.slice(0,2))assert.equal(ui.selectNode(id),true);
  app.document.activeElement=app.document.body;await app.advance(0);
  const state=ui.state(),ctx=canvases.get(app.element('csNodeOverlay')).getContext('2d');
  assert.deepEqual(Array.from(state.pair),ids.slice(0,2));
  assert.equal(state.held.length,held?2:0);
  assert(ids.slice(0,2).every(id=>!state.eligibility.dimmed.includes(id)),'endpoints are exempt from their own eligibility masks');
  assert(ids.slice(2).every(id=>state.eligibility.dimmed.includes(id)),'other uncertain choices retain their dimming');
  for(const p of points.slice(2)){
    // Inside the white badge, away from the numeral and its black border.
    const pixel=Array.from(ctx.getImageData(Math.round(p.x+4),Math.round(p.y+2),1,1).data);
    assert(pixel.slice(0,3).every(c=>c>245)&&pixel[3]===255,'neighboring mask must not darken either number badge: '+pixel);
    const outside=Array.from(ctx.getImageData(Math.round(p.x+9),Math.round(p.y),1,1).data);
    assert(outside[3]>90&&outside[3]<130,'eligibility shading still exists outside the badge');
  }
  for(const p of points.slice(0,2))assert.equal(ctx.getImageData(p.x,p.y,1,1).data[3],0,'node center is transparent to preserve the unshaded native color');
});

test('mobile cube8 native selected colors are protected from adjacent minimum-size eligibility masks',async()=>{
  const app=createPage('cube8',{globals:{Worker:QuietWorker,fetch:fetchFile}});
  app.element('rings').bounds={left:0,top:0,width:280,height:300};app.win.dispatch('resize');app.context.PUZZLE_SOLVER_BRIDGE.requestRender();await app.advance(0);
  const ui=app.context.ConstrainedSolverUI;ui.setActive(true);
  for(let i=0;i<80&&ui.state().phase==='loading';i++)await app.advance(0);
  assert.equal(ui.state().phase,'selecting');
  const nodes=Array.from(app.context.PUZZLE_SOLVER_BRIDGE.nodes());
  let closest=null,gap=Infinity;
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
    const a=nodes[i],b=nodes[j],distance=Math.hypot(a.x-b.x,a.y-b.y),separation=distance-a.r-(Math.max(3,b.r)+1);
    if(separation<gap){gap=separation;closest=[a,b];}
  }
  assert(gap<-.5,'real mobile geometry reproduces neighboring mask overlap');
  const [selected,neighbor]=closest,other=nodes.reduce((best,n)=>Math.hypot(n.x-selected.x,n.y-selected.y)>Math.hypot(best.x-selected.x,best.y-selected.y)?n:best,nodes[0]);
  ui.setTool('swap');assert.equal(ui.selectNode(selected.stickerId),true);assert.equal(ui.selectNode(other.stickerId),true);app.document.activeElement=app.document.body;await app.advance(0);
  assert(!ui.state().eligibility.dimmed.includes(selected.stickerId));assert(ui.state().eligibility.dimmed.includes(neighbor.stickerId));
  const ctx=canvases.get(app.element('csNodeOverlay')).getContext('2d');
  // The adjacent mask reaches the native-color disk, despite that selected
  // node's own eligibilityCode being zero. Every interior pixel must expose
  // its original native fill rather than a translucent eligibility overlay.
  let checked=0;
  for(let x=Math.floor(selected.x-selected.r);x<=Math.ceil(selected.x+selected.r);x++)for(let y=Math.floor(selected.y-selected.r);y<=Math.ceil(selected.y+selected.r);y++){
    if(Math.hypot(x+.5-selected.x,y+.5-selected.y)>selected.r-.1)continue;
    checked++;assert.equal(ctx.getImageData(x,y,1,1).data[3],0,'selected native color remains undimmed at '+x+','+y);
  }
  assert(checked>5);
});
