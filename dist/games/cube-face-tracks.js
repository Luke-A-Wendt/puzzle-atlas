/* The slice belts already encode travel between cube faces. These companion
 * loops encode rotation within a face, through the same fixed sticker nodes. */
(function(root){
'use strict';
const TAU=2*Math.PI,mod=(x,n)=>(x%n+n)%n,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function drawAxisBadges(ctx,candidates,w,h,points,drawLeader){
 const mode=root.PuzzleAxisDisplay?.labelMode?.()||'some';if(mode==='none')return [];
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),cx=w/2,cy=h/2;
 const rx=Math.min(w/2-22,Math.max(w*.25,...xs.map(x=>Math.abs(x-cx)))+20),ry=Math.min(h/2-24,Math.max(h*.25,...ys.map(y=>Math.abs(y-cy)))+20),placed=[],targets=[];
 ctx.save();ctx.font='600 11px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
 for(const item of candidates.filter(item=>mode==='all'||item.front).sort((a,b)=>(b.active-a.active)||(b.front-a.front))){
  const r=Math.max(11,ctx.measureText(item.label||item.id).width/2+5),dx=item.p[0]-cx,dy=item.p[1]-cy,angle=Math.hypot(dx,dy)>3?Math.atan2(dy/ry,dx/rx):(-Math.PI/2+item.index*.8);
  let base=item.front?item.p:[cx+rx*Math.cos(angle),cy+ry*Math.sin(angle)],best=null;
  const offsets=[0,1,-1,2,-2,3,-3,4,-4,5,-5,6,-6];
  for(const offset of offsets){const p=item.front?[base[0]+(offset?Math.cos(angle+offset*.7)*24:0),base[1]+(offset?Math.sin(angle+offset*.7)*24:0)]:[cx+rx*Math.cos(angle+offset*.15),cy+ry*Math.sin(angle+offset*.15)];
   p[0]=clamp(p[0],r+7,w-r-7);p[1]=clamp(p[1],r+7,h-r-7);
   const overlap=placed.reduce((sum,q)=>sum+Math.max(0,r+q.r+5-Math.hypot(p[0]-q.x,p[1]-q.y)),0),score=overlap*100+Math.abs(offset);
   if(!best||score<best.score)best={p,score};if(!overlap)break;
  }
  const [x,y]=best.p,leader=Math.hypot(x-item.p[0],y-item.p[1])>r+3;
  if(mode==='some'&&leader)continue;
  placed.push({x,y,r});targets.push({face:item.id,x,y,r,leader});
  const palette=root.PuzzleAxisDisplay?.palette?.(item.active||item.hover)||{fill:item.active||item.hover?'#f3f3f5':'#101116',stroke:item.active||item.hover?'#101116':'#f3f3f5',text:item.active||item.hover?'#101116':'#f3f3f5'};
  if(leader){ctx.setLineDash(item.front?[]:[3,4]);ctx.strokeStyle=item.active?'rgba(243,243,243,.72)':'rgba(243,243,243,.34)';ctx.lineWidth=1;targets[targets.length-1].leaderSegments=drawLeader?.(item.world,[x,y])||[];}
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=palette.fill;ctx.fill();ctx.setLineDash([]);ctx.strokeStyle=palette.stroke;ctx.lineWidth=item.active?1.6:1.2;ctx.stroke();ctx.fillStyle=palette.text;ctx.fillText(item.label||item.id,x,y+.5);
 }
 ctx.restore();return targets;
}
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
   // Keep the pronounced bulge on 2×2×2/Homer; larger cube maps use
   // their original smoother, shallower curves. All interpolate fixed nodes.
   const tangentScale=G.slots.length===24?1.25:.5;
   function at(t){
    t=mod(t,period);const i=Math.floor(t),u=t-i,u2=u*u,u3=u2*u;
    const p0=nodes[mod(i-1,period)],p1=nodes[i],p2=nodes[(i+1)%period],p3=nodes[(i+2)%period];
    const value=k=>(2*u3-3*u2+1)*p1[k]+(u3-2*u2+u)*tangentScale*(p2[k]-p0[k])+(-2*u3+3*u2)*p2[k]+(u3-u2)*tangentScale*(p3[k]-p1[k]);
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
 // Ring arrows denote the positive physical turn from the named outward
 // pole. The projected screen winding can differ between opposite poles.
 G.positiveQuarterTurns=name=>-(root.MirrorEngine||root.CubeEngine).configs[name].turn;

 G.drawFaceRings=function(ctx,selected,options={}){
  const scale=options.scale||options.zoom||1;
  ctx.save();ctx.shadowBlur=0;
  for(const active of [false,true])for(const track of tracks){
   if((track.name===selected)!==active)continue;
   ctx.globalAlpha=active?1:options.focus===false?.62:.24;
   ctx.beginPath();track.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
   ctx.strokeStyle=active?'#ffffff':'#797087';ctx.lineWidth=(active?2:.65)/scale;ctx.stroke();if(active)root.PuzzleAxisDisplay?.drawRingDirection?.(ctx,track,{at:track.at,period:track.period,direction:G.positiveQuarterTurns(selected),nodes:resting,radius:G.nodeRadius(scale),scale});
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
  if(selected){const r=G.getRing(selected);ctx.globalAlpha=1;ctx.beginPath();ctx.arc(r.cx,r.cy,r.r,0,TAU);ctx.strokeStyle='#ffffff';ctx.lineWidth=2/scale;ctx.stroke();root.PuzzleAxisDisplay?.drawRingDirection?.(ctx,r,{at:t=>({x:r.cx+r.r*Math.cos(t),y:r.cy+r.r*Math.sin(t)}),period:TAU,direction:-G.positiveQuarterTurns(selected),nodes:resting,radius:G.nodeRadius(scale),scale});}
  ctx.restore();
 };
 G.drawNode=function(ctx,p,color,active,scale){
  const radius=G.nodeRadius(scale),halo=Math.min(1.8/scale,G.nodeSpacing*.075);
  ctx.globalAlpha=1;ctx.shadowBlur=0;
  if(active){ctx.beginPath();ctx.arc(p.x,p.y,radius+halo,0,TAU);ctx.fillStyle='#17131f';ctx.fill();ctx.strokeStyle='#ffffff';ctx.lineWidth=.85/scale;ctx.stroke();}
  ctx.beginPath();ctx.arc(p.x,p.y,radius,0,TAU);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle=active?'#ffffff':'#111019';ctx.lineWidth=(active?1.15:.75)/scale;ctx.stroke();
 };
 G.drawAxisLabel=function(ctx,selected,label,scale,options={}){
  if(!selected)return;const r=G.getRing(selected),angle=options.angle??(r.axis===0?0:r.axis===1?-Math.PI/2:Math.PI);
  const x=r.cx+r.r*Math.cos(angle),y=r.cy+r.r*Math.sin(angle),radius=(String(label).length>2?14:11)/scale;
  const palette=root.PuzzleAxisDisplay?.palette?.(options.active)||{fill:options.active?'#f3f3f5':'#101116',stroke:options.active?'#101116':'#f3f3f5',text:options.active?'#101116':'#f3f3f5'};
  ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.fillStyle=palette.fill;ctx.fill();ctx.strokeStyle=palette.stroke;ctx.lineWidth=(options.active?1.6:1.2)/scale;ctx.stroke();
  ctx.font='700 '+(11/scale)+'px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=palette.text;ctx.fillText(label,x,y+.5/scale);
 };
 G.drawAxisLabels=function(ctx,selected,scale,labelFor=id=>id){
  const display=root.PuzzleAxisDisplay;if(display?.ringLabelsVisible?.()===false)return [];
  const ids=[...new Set([selected,...(display?.ringAxes?.()||[])].filter(id=>id&&G.rings.some(r=>r.name===id)))],placed=[];
  for(const id of ids){const r=G.getRing(id),base=r.axis===0?0:r.axis===1?-Math.PI/2:Math.PI,radius=(String(labelFor(id)).length>2?14:11)/scale;let angle=base;
   for(const shift of [0,.18,-.18,.36,-.36,.54,-.54]){const a=base+shift,x=r.cx+r.r*Math.cos(a),y=r.cy+r.r*Math.sin(a);if(placed.every(p=>Math.hypot(x-p.x,y-p.y)>radius+p.radius+3/scale)){angle=a;break;}}
   placed.push({face:id,x:r.cx+r.r*Math.cos(angle),y:r.cy+r.r*Math.sin(angle),radius});G.drawAxisLabel(ctx,id,labelFor(id),scale,{active:id===selected||id===display?.hovered?.(),angle});
  }
  return placed;
 };
 // A badge on an inner slice is anchored to that slice on its most visible
 // adjacent face. Front outer badges use face centers; rear badges sit outside
 // the silhouette with a faint leader back to the projected face center.
 G.draw3DAxisLabels=function(ctx,{engine,camera,project,eye,distance,selected,spacing=.5075,labelFor=id=>id,width,height,drawLeader}){
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),mul=(v,k)=>v.map(x=>x*k),display=root.PuzzleAxisDisplay,hover=display?.hovered?.(),outer=['U','R','F','D','L','B'];
  const ids=[...new Set([...outer,selected,hover].filter(id=>id&&engine.configs[id]))],candidates=[];
  const dist=n=>typeof distance==='function'?distance(n):distance;
  for(const face of ids){const cfg=engine.configs[face],isOuter=outer.includes(face);let normal=[0,0,0],point;
   if(isOuter){normal[cfg.axis]=Math.sign(cfg.layer);point=mul(normal,dist(normal));}
   else{let best=-Infinity;for(let axis=0;axis<3;axis++)if(axis!==cfg.axis)for(const sign of [-1,1]){const n=[0,0,0];n[axis]=sign;const score=camera(n)[2];if(score>best){best=score;normal=n;}}
    point=mul(normal,dist(normal));point[cfg.axis]=cfg.layer*spacing;const tangent=[0,1,2].find(axis=>axis!==cfg.axis&&normal[axis]===0);point[tangent]=dist(normal)*.56;
   }
   const nv=camera(normal),cv=camera(point),front=!isOuter||dot(nv,[-cv[0],-cv[1],eye-cv[2]])>=.32;
   candidates.push({id:face,label:labelFor(face),world:cv,p:project(cv),active:face===selected,hover:face===hover,front,index:candidates.length});
  }
  const extents=[0,1,2].map(axis=>[-1,1].map(sign=>{const n=[0,0,0];n[axis]=sign;return sign*dist(n);})),points=[];
  for(const x of extents[0])for(const y of extents[1])for(const z of extents[2])points.push(project(camera([x,y,z])));
  const targets=drawAxisBadges(ctx,candidates,width||ctx.canvas.width,height||ctx.canvas.height,points,drawLeader);
  display?.publish3DAxes?.(ids);display?.publish3DLabelTargets?.(targets);return targets;
 };
 return G;
}
root.CubeFaceTracks={install};
if(root.RingGeometry)install(root.RingGeometry);
if(typeof module!=='undefined'&&module.exports)module.exports=root.CubeFaceTracks;
})(typeof globalThis!=='undefined'?globalThis:this);
