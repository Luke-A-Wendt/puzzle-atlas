'use strict';
const assert=require('node:assert/strict');
function pointAt(ring,phase){const points=ring.points,wrapped=((phase%1)+1)%1,n=points.length-1,index=wrapped*n,a=points[Math.floor(index)],b=points[Math.floor(index)+1];return{x:a.x+(b.x-a.x)*(index%1),y:a.y+(b.y-a.y)*(index%1)};}
function dragPath(G,face,dir,selected=face){
 for(const ring of G.orbits(face))for(let k=0;k<80;k++){
  const phase=k/80,start=pointAt(ring,phase),nearest=G.nearestRing(start,selected);
  if(!nearest||nearest.ring.face!==face||nearest.distance>.02)continue;
  // Drive the exact displayed polyline and confirm its declared parameter
  // direction, avoiding branch ambiguity at self-crossings.
  for(const walk of [dir,-dir]){const samples=Array.from({length:17},(_,i)=>pointAt(ring,phase+walk*.095*i/16));let last=G.dragAngle(samples[0],nearest.ring),total=0,continuous=true;
  for(const p of samples.slice(1)){const a=G.dragAngle(p,nearest.ring),delta=((a-last+Math.PI*3)%(Math.PI*2))-Math.PI;if(!Number.isFinite(delta)||Math.abs(delta)>.7){continuous=false;break;}total+=delta;last=a;}
  if(continuous&&Math.abs(total)>.23&&Math.sign(total)===dir)return{ring:nearest.ring,samples,total};}
 }
 return null;
}
function screen(point,viewport,pointerId=19){return{button:0,pointerId,clientX:viewport.cx+point.x*viewport.scale,clientY:viewport.cy+point.y*viewport.scale};}
function dispatchPath(canvas,path,viewport){assert(path,'An exposed, continuous ring path is available');canvas.dispatch('pointerdown',screen(path.samples[0],viewport));for(const p of path.samples.slice(1))canvas.dispatch('pointermove',screen(p,viewport));canvas.dispatch('pointerup',screen(path.samples.at(-1),viewport));}
module.exports={pointAt,dragPath,screen,dispatchPath};
