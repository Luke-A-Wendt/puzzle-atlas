'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createCanvas}=require('@napi-rs/canvas');
const Selection=require('../dist/games/puzzle-selection-3d.js');
const square=(left,top,right,bottom,z=0)=>[[left,top,z],[right,top,z],[right,bottom,z],[left,bottom,z]];
function frame(options={}){
 const canvas=createCanvas(120,120),ctx=canvas.getContext('2d');
 const painter=Selection.begin(ctx,{width:120,height:120,project:p=>p.slice(0,2),state:{active:false,held:[],pair:[]},...options});
 return{canvas,ctx,painter};
}
function withGlobals(values,callback){
 const old=Object.fromEntries(Object.keys(values).map(k=>[k,global[k]]));
 Object.assign(global,values);
 try{return callback();}finally{Selection.clearHover();for(const [k,v]of Object.entries(old)){if(v===undefined)delete global[k];else global[k]=v;}}
}
test('picking uses actual clipped fragments and the last painted body occludes stickers',()=>{
 const f=frame();
 f.painter.face({id:'rear',points:square(5,5,110,110)});
 f.painter.pickFace({id:null,points:square(40,5,65,110)});
 f.painter.face({id:'front',points:square(65,5,95,50),outline:square(65,5,110,110)});
 f.painter.finish();
 assert.equal(Selection.pick(f.canvas,20,20),'rear');
 assert.equal(Selection.pick(f.canvas,50,20),null,'opaque uncolored body blocks a hidden sticker');
 assert.equal(Selection.pick(f.canvas,80,20),'front');
 assert.equal(Selection.pick(f.canvas,80,80),'rear','clipped-away outline is not an invisible click target');
 assert.equal(Selection.pick(f.canvas,119,119),null);
 assert.equal(Selection.pick(f.canvas,-1,20),null);
});
test('explicit draw-order geometry is projected once on demand and ignores duplicate annotation faces',()=>{
 let projections=0;
 const f=frame({project:p=>{projections++;return p.slice(0,2);},pickFaces:[{stickerId:'sticker',points:square(5,5,110,110)},{stickerId:null,points:square(40,40,70,70)}]});
 f.painter.pickFace({id:'wrong',points:square(0,0,120,120)});f.painter.finish();
 assert.equal(projections,0,'normal rendering does not project hit polygons');
 assert.equal(Selection.pick(f.canvas,20,20),'sticker');assert.equal(projections,8);
 assert.equal(Selection.pick(f.canvas,50,50),null);assert.equal(projections,8,'pointer queries reuse the projected frame');
});
test('Homer pixel ownership is authoritative and registered under the actual DOM canvas',()=>{
 const domCanvas={},calls=[],f=frame({canvas:domCanvas,pickAt:(x,y)=>{calls.push([x,y]);return x<60?'nose':null;},pickFaces:[{id:'incorrect',points:square(0,0,120,120)}]});
 f.painter.finish();
 assert.equal(Selection.pick(domCanvas,20.5,45),'nose');assert.equal(Selection.pick(domCanvas,80,45),null);
 assert.equal(Selection.pick(f.canvas,20,45),null,'offscreen raster canvas is not a DOM hit target');
 assert.deepEqual(calls,[[20.5,45],[80,45]]);
});
test('new render frames replace stale polygons and canvases remain independent',()=>{
 const f=frame({pickFaces:[{id:3,points:square(0,0,40,40)}]}),other=frame({pickFaces:[{id:'other',points:square(0,0,40,40)}]});f.painter.finish();other.painter.finish();
 assert.equal(Selection.pick(f.canvas,10,10),'3');assert.equal(Selection.pick(other.canvas,10,10),'other');
 Selection.begin(f.ctx,{project:p=>p.slice(0,2),width:120,height:120,state:{active:false},pickFaces:[{id:4,points:square(70,70,110,110)}]}).finish();
 assert.equal(Selection.pick(f.canvas,10,10),null);assert.equal(Selection.pick(f.canvas,80,80),'4');assert.equal(Selection.pick(other.canvas,10,10),'other');
});
test('3D selection delegates to the existing tool only while selection is allowed',()=>{
 const f=frame({pickFaces:[{id:'tile',points:square(5,5,110,110)}]});f.painter.finish();
 let allowed=false;const selected=[];
 withGlobals({ConstrainedSolverUI:{canSelect3D:()=>allowed,selectNode:id=>selected.push(id)}},()=>{
  assert.equal(Selection.select(f.canvas,20,20),false);assert.deepEqual(selected,[]);
  allowed=true;assert.equal(Selection.select(f.canvas,20,20),true);assert.deepEqual(selected,['tile']);
  assert.equal(Selection.select(f.canvas,119,119),false);assert.deepEqual(selected,['tile']);
 });
});
test('idle hover uses the lightweight engine busy flag without cloning puzzle snapshots',()=>{
 const f=frame({pickFaces:[]});f.painter.finish();let busy=false,checks=0;
 withGlobals({ConstrainedSolverUI:{visualState:()=>({active:false})},PUZZLE_API:{snapshot:()=>{throw new Error('Full snapshots must not be needed for pointer hover.');}},PUZZLE_SOLVER_BRIDGE:{isBusy:()=>{checks++;return busy;}}},()=>{
  assert.equal(Selection.hover(f.canvas,20,20),null);busy=true;assert.equal(Selection.hover(f.canvas,20,20),null);assert.equal(checks,2);
 });
});
test('turn-mode tile hover emphasizes its current ring node and clears for solver, playback and leave',()=>{
 const f=frame({pickFaces:[{id:'tile',points:square(5,5,110,110)}]});f.painter.finish();
 const native=createCanvas(150,150),overlay={style:{},width:150,height:150,hidden:true,setAttribute(){},getContext:()=>native.getContext('2d')},children=[];
 const rings={parentElement:{appendChild:child=>children.push(child)},getBoundingClientRect:()=>({width:150,height:150})};
 let active=false,animating=false;
 withGlobals({document:{getElementById:id=>id==='rings'?rings:null,createElement:()=>overlay},devicePixelRatio:1,ConstrainedSolverUI:{visualState:()=>({active})},PUZZLE_API:{snapshot:()=>({mode:'idle',animating})},PUZZLE_SOLVER_BRIDGE:{nodes:()=>[{stickerId:'tile',x:70,y:65,r:5,highlightLineWidth:2.2,highlightOuterRadius:6}]}},()=>{
  assert.equal(Selection.hover(f.canvas,20,20),'tile');assert.equal(Selection.hoveredNode(),'tile');assert.equal(overlay.hidden,false);assert.equal(children.length,1);assert.equal(overlay.style.pointerEvents,'none');
  assert(native.getContext('2d').getImageData(78,65,1,1).data[3]>0,'the linked ring node receives a visible outline');
  active=true;Selection.hover(f.canvas,20,20);assert.equal(Selection.hoveredNode(),null);assert.equal(overlay.hidden,true);assert.equal(overlay.style.display,'none','the explicit style beats game-theme canvas display:block');
  active=false;Selection.hover(f.canvas,20,20);animating=true;Selection.hover(f.canvas,20,20);assert.equal(Selection.hoveredNode(),null);
  animating=false;Selection.hover(f.canvas,20,20);Selection.clearHover(f.canvas);assert.equal(Selection.hoveredNode(),null);assert.equal(overlay.hidden,true);assert.equal(overlay.style.display,'none','the explicit style beats game-theme canvas display:block');
 });
});
