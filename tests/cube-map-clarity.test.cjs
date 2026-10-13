'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {createHarness}=require('./game-harness.cjs');
const {recorder,circleNodes}=require('./connected-map-recorder.cjs');
const palette=new Set(['#eeeef6','#f4ce48','#39bd8b','#4c90ef','#ee596e','#f29a4b']);
const baseline={cube2:50.42,cube3:24.92,cube4:21.48,cube5:16.09,cube6:12.85,cube7:10.71,mirror:24.92,homer:50.42};
for(const [name,oldSpacing]of Object.entries(baseline)){
 const c=recorder(),app=createHarness({htmlPath:path.resolve(__dirname,'../dist/games/'+name+'.html'),bundled:true,canvasContexts:{rings:c.context},dimensions:{rings:{width:600,height:600}},search:'?color=1'}),G=app.context.RingGeometry,E=app.context.MirrorEngine||app.context.CubeEngine;
 const state=E.makeSolved(),nodes=circleNodes(c,palette),pos=state.map(G.position);
 assert.equal(nodes.length,state.length);assert(nodes.every(n=>n.alpha===1),name+' every color stays fully opaque');
 const j=pos.findIndex(p=>Math.abs(p.x-pos[0].x)>1),scale=(nodes[j].x-nodes[0].x)/(pos[j].x-pos[0].x),ox=nodes[0].x-pos[0].x*scale,oy=nodes[0].y-pos[0].y*scale;
 let minimum=Infinity;
 for(let i=0;i<nodes.length;i++){
  let nearest=-1,dist=Infinity;
  for(let j=0;j<nodes.length;j++){if(i===j)continue;const d=Math.hypot(nodes[i].x-nodes[j].x,nodes[i].y-nodes[j].y);if(d<dist){dist=d;nearest=j;}}
  minimum=Math.min(minimum,dist);assert.equal(nodes[i].color,nodes[nearest].color,name+' solved nearest nodes share a face color');
  assert(nodes[i].r*2<dist,name+' full-size nodes do not overlap');
 }
 assert(minimum>oldSpacing*1.2,name+' increases minimum readable separation by at least20%');
 assert(nodes.every(n=>n.r>=5.4),name+' full map node radius stays legible at600px');
 const padding=Math.max(...nodes.map(n=>n.r))+2.3;
 function inside(p){const x=ox+p.x*scale,y=oy+p.y*scale;assert(x-padding>=0&&x+padding<=600&&y-padding>=0&&y+padding<=600,name+' full motion envelope remains inside the canvas');}
 // Use the complete physical circle envelope, including empty arcs traversed
 // mid-move, not just the compact solved clusters.
 for(const r of G.rings)for(let k=0;k<180;k++)inside({x:r.cx+r.r*Math.cos(k*Math.PI/90),y:r.cy+r.r*Math.sin(k*Math.PI/90)});
 for(const r of G.faceRings)for(const p of r.points)inside(p);
 for(const face of Object.keys(E.configs)){
  app.context.PUZZLE_API.select(face);app.frame(0);
  const after=E.applyMove(state,{face,dir:1}),moving=state.filter((s,i)=>JSON.stringify([s.p,s.n])!==JSON.stringify([after[i].p,after[i].n]));
  const highlighted=c.strokes.filter(stroke=>stroke.filled&&stroke.color==='#fff4ff');
  assert.equal(highlighted.length,moving.length,name+' '+face+' highlights only physically moving nodes, not a fixed face center');
 }
 console.log(name+': '+minimum.toFixed(2)+'px minimum spacing, '+nodes[0].r.toFixed(2)+'px node radius, full-opacity colors and complete motion bounds PASS');
}
