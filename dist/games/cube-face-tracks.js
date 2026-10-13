/* The slice belts already encode travel between cube faces. These companion
 * loops encode rotation within a face, through the same fixed sticker nodes. */
(function(root){
'use strict';
const TAU=2*Math.PI,mod=(x,n)=>(x%n+n)%n;
function install(G){
 if(G.faceRings)return G;
 const originalInterpolate=G.interpolateSticker,originalAngle=G.angleAt;
 const tracks=[],bySlot=new Map(),slotKey=s=>s.p.join(',')+'/'+s.n.join(',');
 for(const ring of G.rings){
  const axis=ring.axis,a=(axis+1)%3,b=(axis+2)%3,groups=new Map();
  for(const slot of G.slots){
   if(slot.p[axis]!==ring.layer||Math.abs(slot.n[axis])!==1)continue;
   const radius=Math.max(Math.abs(slot.p[a]),Math.abs(slot.p[b]));
   if(!radius)continue; // An odd cube's central face sticker does not travel.
   if(!groups.has(radius))groups.set(radius,[]);
   groups.get(radius).push(slot);
  }
  for(const [radius,slots]of groups){
   slots.sort((s,t)=>Math.atan2(s.p[b],s.p[a])-Math.atan2(t.p[b],t.p[a]));
   const nodes=slots.map(G.position),period=nodes.length;
   // A periodic cubic rounds each perimeter without relocating any node.
   function at(t){
    t=mod(t,period);const i=Math.floor(t),u=t-i,u2=u*u,u3=u2*u;
    const p0=nodes[mod(i-1,period)],p1=nodes[i],p2=nodes[(i+1)%period],p3=nodes[(i+2)%period];
    const value=k=>.5*(2*p1[k]+(-p0[k]+p2[k])*u+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*u2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*u3);
    return{x:value('x'),y:value('y')};
   }
   const track={name:ring.name,axis,layer:ring.layer,companion:true,radius,slots,nodes,period,at,points:[]};
   for(let i=0;i<=period*24;i++)track.points.push(at(i/24));
   tracks.push(track);slots.forEach((s,index)=>bySlot.set(slotKey(s),{track,index}));
  }
 }
 function closest(p,track){
  let d=Infinity,t=0;
  for(let i=1;i<track.points.length;i++){
   const a=track.points[i-1],b=track.points[i],dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy;
   const u=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)):0;
   const distance=Math.hypot(p.x-a.x-u*dx,p.y-a.y-u*dy);
   if(distance<d){d=distance;t=(i-1+u)/24;}
  }
  return{d,t};
 }
 G.faceRings=tracks;
 G.interpolateSticker=function(before,after,ringOrName,t,quarterTurns){
  const ring=G.getRing(ringOrName),entry=bySlot.get(slotKey(before));
  if(entry&&entry.track.name===ring.name){
   if(t<=0)return G.position(before);
   if(t>=1)return G.position(after);
   return entry.track.at(entry.index+quarterTurns*entry.track.period/4*t);
  }
  return originalInterpolate(before,after,ringOrName,t,quarterTurns);
 };
 G.angleAt=function(point,ring){
  // Belt angles increase clockwise, opposite positive physical rotation.
  return ring.companion?-closest(point,ring).t/ring.period*TAU:originalAngle(point,ring);
 };
 G.nearestRing=function(point,selected){
  const candidates=G.rings.map(r=>({r,d:Math.abs(Math.hypot(point.x-r.cx,point.y-r.cy)-r.r)}));
  for(const r of tracks)candidates.push({r,d:closest(point,r).d});
  candidates.sort((a,b)=>a.d-b.d);
  const active=candidates.find(c=>c.r.name===selected);
  return active&&active.d<5&&active.d<=candidates[0].d+2?active:candidates[0];
 };
 // A single spacing value keeps every solved face equally legible. Nodes
 // remain full-color; the selected layer gets an outline, never a color change.
 const resting=G.slots.map(G.position);
 G.nodeSpacing=resting.reduce((best,p,i)=>Math.min(best,...resting.slice(i+1).map(q=>Math.hypot(p.x-q.x,p.y-q.y))),Infinity);
 G.nodeRadius=scale=>Math.min(10/scale,G.nodeSpacing*.37);
 G.drawFaceRings=function(ctx,selected,options={}){
  const scale=options.scale||options.zoom||1;
  ctx.save();ctx.shadowBlur=0;
  for(const active of [false,true])for(const track of tracks){
   if((track.name===selected)!==active)continue;
   ctx.globalAlpha=active?1:options.focus===false?.62:.24;
   ctx.beginPath();track.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
   ctx.strokeStyle=active?'#baacfb':'#797087';ctx.lineWidth=(active?1.6:.65)/scale;ctx.stroke();
  }
  ctx.restore();
 };
 G.drawTracks=function(ctx,selected,scale,options={}){
  ctx.save();ctx.shadowBlur=0;
  for(const r of G.rings){
   if(r.name===selected)continue;
   ctx.globalAlpha=options.focus===false?.72:.28;ctx.beginPath();ctx.arc(r.cx,r.cy,r.r,0,TAU);ctx.strokeStyle='#797087';ctx.lineWidth=.7/scale;ctx.stroke();
  }
  G.drawFaceRings(ctx,selected,{scale,focus:options.focus});
  const r=G.getRing(selected);ctx.globalAlpha=1;ctx.beginPath();ctx.arc(r.cx,r.cy,r.r,0,TAU);ctx.strokeStyle='#baacfb';ctx.lineWidth=2/scale;ctx.stroke();
  ctx.restore();
 };
 G.drawNode=function(ctx,p,color,active,scale){
  const radius=G.nodeRadius(scale),halo=Math.min(1.8/scale,G.nodeSpacing*.075);
  ctx.globalAlpha=1;ctx.shadowBlur=0;
  if(active){ctx.beginPath();ctx.arc(p.x,p.y,radius+halo,0,TAU);ctx.fillStyle='#17131f';ctx.fill();ctx.strokeStyle='#d3bdff';ctx.lineWidth=.85/scale;ctx.stroke();}
  ctx.beginPath();ctx.arc(p.x,p.y,radius,0,TAU);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle=active?'#ffffff':'#111019';ctx.lineWidth=(active?1.15:.75)/scale;ctx.stroke();
 };
 G.drawAxisLabel=function(ctx,selected,label,scale){
  const r=G.getRing(selected),angle=r.axis===0?0:r.axis===1?-Math.PI/2:Math.PI;
  const x=r.cx+r.r*Math.cos(angle),y=r.cy+r.r*Math.sin(angle),radius=(String(label).length>2?13:10)/scale;
  ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.fillStyle='#241d34';ctx.fill();ctx.strokeStyle='#baacfb';ctx.lineWidth=1/scale;ctx.stroke();
  ctx.font='600 '+(11/scale)+'px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#ece1ff';ctx.fillText(label,x,y+.5/scale);
 };
 return G;
}
root.CubeFaceTracks={install};
if(root.RingGeometry)install(root.RingGeometry);
if(typeof module!=='undefined'&&module.exports)module.exports=root.CubeFaceTracks;
})(typeof globalThis!=='undefined'?globalThis:this);
