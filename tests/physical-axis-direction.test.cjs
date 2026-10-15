'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPage}=require('./solver-dom.cjs');
const puzzles=require('../dist/games/constrained-solver-models/manifest.json').models.map(model=>model.id);
const plain=x=>JSON.parse(JSON.stringify(x));
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function rotate([x,y,z],axis,angle){const c=Math.cos(angle),s=Math.sin(angle);return axis===0?[x,c*y-s*z,s*y+c*z]:axis===1?[c*x+s*z,y,-s*x+c*z]:[c*x-s*y,s*x+c*y,z];}
function camera(v,view){return rotate(rotate(rotate(v,1,view.yaw),0,view.pitch),2,-(view.roll||0));}
function settle(app){for(let n=0;n<30&&(app.snapshot().animating||app.snapshot().mode!=='idle');n++)app.frame(2000);assert.equal(app.snapshot().animating,false);}
function configs(app,puzzle){
 const root=app.context;
 if(root.CubeEngine)return root.CubeEngine.configs;
 const name=puzzle==='ghost'?'GhostEngine':Object.keys(root).find(key=>key.endsWith('Engine'));
 const engine=root[name],entries=engine.create?engine.create(puzzle).configs:engine.configs;
 return Array.isArray(entries)?Object.fromEntries(entries.map(config=>[config.id,config])):entries;
}
function pole(config){
 if(config.normal)return config.normal;
 // These independently describe the outward geometric half-axis; the
 // zero-layer conventional poles are M=L, E=D, S=F, matching their labels.
 const vector=[0,0,0];vector[config.axis]=Math.sign(config.layer)||-Math.sign(config.turn);return vector;
}
for(const puzzle of puzzles)test(puzzle+' all 3D axes animate CCW positive and CW negative from their named poles',async()=>{
 const app=createPage(puzzle);await app.flush();const api=app.context.PUZZLE_API,axisConfigs=configs(app,puzzle);
 if(puzzle==='homer'){
  // Homer's annotation anchors are depth-buffered. Use a real small offscreen
  // canvas for its production renderer, since the DOM host's no-op canvas has
  // no pixel buffer and correctly omits this raster-only annotation pass.
  const {createCanvas}=require('@napi-rs/canvas'),canvas=createCanvas(128,128);
  canvas.ownerDocument={createElement:()=>createCanvas(1,1)};
  const renderer=app.context.HomerRenderer,ctx=canvas.getContext('2d');
  app.context.HomerRenderer={...renderer,render(_ctx,state,options){return renderer.render(ctx,state,{...options,width:128,height:128});}};
 }
 const axes=[...new Set(app.element('selector').querySelectorAll('.ring-key').map(button=>button.dataset.face))];
 assert.ok(axes.length>0);
 let anchors=new Map();const selection=app.context.PuzzleSelection3D;
 // Observe the actual 3D render pass, after native engine interpolation and
 // camera transformation. The test does not compute a move or inspect the
 // adapter's sign: it measures n·(p×q) on real animated tile centers. This also
 // distinguishes Helicopter's opposite half-turn paths (identical endpoints).
 app.context.PuzzleSelection3D={...selection,begin(ctx,options){
  const painter=selection.begin(ctx,options);anchors=new Map();
  return {...painter,track(anchor){anchors.set(String(anchor.id),anchor.center.slice());painter.track?.(anchor);}};
 }};
 for(const axis of axes){
  for(const [button,sign]of [['viewRingCCW',1],['viewRingCW',-1]]){
   api.reset();api.select(axis);app.element('speed').value='5';await app.flush();
   const before=plain(app.snapshot().stickers||app.snapshot().pieces),view=app.snapshot().view,n=camera(pole(axisConfigs[axis]),view);
   app.click(button);assert.equal(app.snapshot().animating,true,axis+' starts its legal physical turn');
   // Sample adjacent mid-turn frames. Ghost's preliminary shape alignment is
   // finished here; this measures its selected-axis turn, not that docking.
   app.frame(100);const first=anchors;app.frame(10);const second=anchors;
   let moving=0;
   for(const [id,p]of first){const q=second.get(id);if(!q)continue;const winding=dot(n,cross(p,q));if(Math.abs(winding)<1e-8)continue;moving++;assert.ok(sign*winding>0,axis+' '+button+' renders the correct signed angular motion at tile '+id);}
   assert.ok(moving>0,axis+' '+button+' has observable off-axis moving tiles');
   settle(app);const history=app.snapshot().history;
   assert.equal(history.at(-1).face,axis);assert.equal(history.at(-1).dir,-sign);
   // Native inverse through the opposite physical button must return the
   // entire physical state, including piece orientations, to its start.
   api.select(axis);await app.flush();app.click(sign>0?'viewRingCW':'viewRingCCW');settle(app);
   assert.deepEqual(plain(app.snapshot().stickers||app.snapshot().pieces),before,axis+' returns exactly after its inverse');
  }
 }
});
