'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPage}=require('./solver-dom.cjs');
const puzzles=['cube2','cube3','cube4','cube5','cube6','cube7','cube8','mirror'];
const add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(v,k)=>v.map(x=>x*k);
const average=points=>points.reduce((a,b)=>add(a,mul(b,1/points.length)),[0,0,0]);
const rotate=(v,axis,a)=>{const c=Math.cos(a),s=Math.sin(a),[x,y,z]=v;return axis===0?[x,c*y-s*z,s*y+c*z]:axis===1?[c*x+s*z,y,-s*x+c*z]:[c*x-s*y,s*x+c*y,z];};
const near=(actual,expected,message)=>{assert.equal(actual.length,expected.length);actual.forEach((v,i)=>assert(Math.abs(v-expected[i])<1e-8,message+': '+actual+' != '+expected));};
function host(id){
 const app=createPage(id),frames=[];
 app.context.PuzzleSelection3D={begin(ctx,options){const f={faces:[],options,finished:0};frames.push(f);return{face:face=>f.faces.push(face),finish:()=>f.finished++};}};
 const redraw=(ms=0)=>{app.context.PUZZLE_SOLVER_BRIDGE.requestRender();app.frame(ms);const f=frames.at(-1);assert(f,'renderer begins a marker pass');assert.equal(f.finished,1,'marker pass is finished once');return f;};
 return{app,redraw};
}
function expectedGeometry(id,app,stickers){
 if(id==='mirror')return new Map(app.context.MirrorGeometry.getPieces(stickers).flatMap(p=>p.faces.filter(f=>f.sticker).map(f=>[String(f.sticker.id),{center:average(f.stickerPolygon),normal:f.normal}])));
 return new Map(stickers.map(s=>[String(s.id),{center:add(mul(s.p,id==='cube3'?1.015:.5075),mul(s.n,.486)),normal:s.n}]));
}
function validateFrame(id,app,frame,before,move=null,angle=0){
 const nodes=new Map(app.context.PUZZLE_SOLVER_BRIDGE.nodes().map(n=>[String(n.stickerId),n]));
 const stickers=new Map(before.stickers.map(s=>[String(s.id),s]));
 const geometry=expectedGeometry(id,app,before.stickers);
 const camera=v=>rotate(rotate(v,1,before.view.yaw),0,before.view.pitch);
 const {width,height,eye,radius,occluders,project}=frame.options;
 assert(width>0&&height>0&&eye>0&&radius>0);
 assert(occluders.length>=frame.faces.length/3,'all original opaque surfaces are supplied for arrow occlusion');
 assert(frame.faces.length>0,'visible stickers have metadata');
 for(const f of frame.faces){
  const key=String(f.id),s=stickers.get(key),g=geometry.get(key);assert(s&&g,id+' marker uses an actual persistent sticker identity');
  const transform=v=>camera(move&&s.p[move.axis]===move.layer?rotate(v,move.axis,angle):v);
  near(f.center,transform(g.center),id+' center follows the exact physical turn');
  near(f.normal,transform(g.normal),id+' normal follows the exact physical turn');
  near(average(f.outline),f.center,id+' label anchors to the full tile center rather than a BSP fragment');
  near([Math.hypot(...f.normal)],[1],id+' normal is unit length');
  assert.equal(f.selected,nodes.get(key).highlighted,id+' solid outline matches ring-highlight membership');
  assert(f.points.length>=3&&f.outline.length>=3);assert(project(f.center).every(Number.isFinite));
 }
}

test('all cube sizes and Mirror supply precise sticker centers, normals, and ring highlights for 3D annotations',()=>{
 for(const id of puzzles){
  const {app,redraw}=host(id),E=app.context[id==='mirror'?'MirrorEngine':'CubeEngine'];
  for(const face of Object.keys(E.configs)){
   app.context.PUZZLE_API.select(face);
   const before=app.snapshot();validateFrame(id,app,redraw(),before);
  }
 }
});

test('cube and Mirror A/B attachment metadata follows each rotating layer through its midpoint and endpoint',()=>{
 for(const id of puzzles){
  const {app,redraw}=host(id),E=app.context[id==='mirror'?'MirrorEngine':'CubeEngine'];
  for(const face of Object.keys(E.configs)){
   const before=app.snapshot(),cfg=E.configs[face];
   app.context.PUZZLE_API.move(face);const halfway=redraw(55);
   validateFrame(id,app,halfway,before,cfg,cfg.turn*Math.PI/4);
   const finished=redraw(55);validateFrame(id,app,finished,app.snapshot());
   assert.equal(app.snapshot().animating,false);
  }
 }
});
