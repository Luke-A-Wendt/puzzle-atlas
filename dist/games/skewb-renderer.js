/* Exact rigid-piece renderer shared by Ultimate Skewb and Skewb Diamond. */
(function(root){
'use strict';
const TAU=Math.PI*2, clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const add=(a,b)=>a.map((x,i)=>x+b[i]),mul=(v,s)=>v.map(x=>x*s),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const center=points=>points.reduce((v,p)=>add(v,mul(p,1/points.length)),[0,0,0]);
function rot(v,axis,a){const c=Math.cos(a),s=Math.sin(a),[x,y,z]=v;return axis===0?[x,c*y-s*z,s*y+c*z]:[c*x+s*z,y,-s*x+c*z];}
function camera(v,view){return rot(rot(v,1,view.yaw),0,view.pitch);}
// Rear-axis badges live just outside the silhouette. Their faint leaders retain
// the exact projected pole, while all labels stay legible and clickable.
function drawAxisBadges(ctx,candidates,w,h,points,paint=true,drawLeader){
 const mode=root.PuzzleAxisDisplay?.labelMode?.()||'some';if(mode==='none')return[];
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),cx=w/2,cy=h/2;
 const rx=Math.min(w/2-22,Math.max(w*.25,...xs.map(x=>Math.abs(x-cx)))+20),ry=Math.min(h/2-24,Math.max(h*.25,...ys.map(y=>Math.abs(y-cy)))+20),placed=[],targets=[];
 ctx.save();ctx.font='600 11px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
 for(const item of candidates.sort((a,b)=>(b.active-a.active)||(b.front-a.front))){
  if(mode==='some'&&!item.front)continue;
  const r=Math.max(11,ctx.measureText(item.id).width/2+5),dx=item.p[0]-cx,dy=item.p[1]-cy,angle=Math.hypot(dx,dy)>3?Math.atan2(dy/ry,dx/rx):(-Math.PI/2+item.index*.8);
  let base=item.front?item.p:[cx+rx*Math.cos(angle),cy+ry*Math.sin(angle)],best=null;
  const offsets=[0,1,-1,2,-2,3,-3,4,-4,5,-5,6,-6];
  for(const offset of offsets){const p=item.front?[base[0]+(offset?Math.cos(angle+offset*.7)*24:0),base[1]+(offset?Math.sin(angle+offset*.7)*24:0)]:[cx+rx*Math.cos(angle+offset*.15),cy+ry*Math.sin(angle+offset*.15)];
   p[0]=clamp(p[0],r+7,w-r-7);p[1]=clamp(p[1],r+7,h-r-7);
   const overlap=placed.reduce((sum,q)=>sum+Math.max(0,r+q.r+5-Math.hypot(p[0]-q.x,p[1]-q.y)),0),score=overlap*100+Math.abs(offset);
   if(!best||score<best.score)best={p,score};if(!overlap)break;
  }
  const [x,y]=best.p,leader=Math.hypot(x-item.p[0],y-item.p[1])>r+3;
  // The compact label mode never introduces a leader merely to retain a badge.
  if(mode==='some'&&leader)continue;
  placed.push({x,y,r});targets.push({face:item.id,x,y,r,leader,front:item.front});
  if(!paint)continue;
  const highlighted=item.active||item.hover,palette=root.PuzzleAxisDisplay?.palette?.(highlighted)||{fill:highlighted?'#f3f3f5':'#101116',stroke:highlighted?'#101116':'#f3f3f5',text:highlighted?'#101116':'#f3f3f5'};
  if(leader){ctx.setLineDash(item.front?[]:[3,4]);ctx.strokeStyle=highlighted?'rgba(244,244,244,.75)':'rgba(235,235,235,.38)';ctx.lineWidth=1;targets[targets.length-1].leaderSegments=drawLeader?.(item.world,[x,y])||[];}
  ctx.setLineDash([]);ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=palette.fill;ctx.fill();ctx.strokeStyle=palette.stroke;ctx.lineWidth=highlighted?1.4:1;ctx.stroke();ctx.fillStyle=palette.text;ctx.fillText(item.id,x,y+.5);
 }
 ctx.restore();return targets;
}
// Tile identities are independent of axis visibility. Rounded monochrome badges
// share the same active/inactive palette; the axis badge wins exact duplicates.
function withinPolygon(x,y,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[j],b=points[i];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function drawTileBadge(ctx,name,rect,active){
 const palette=root.PuzzleAxisDisplay?.palette?.(active)||{fill:active?'#f3f3f5':'#101116',stroke:active?'#101116':'#f3f3f5',text:active?'#101116':'#f3f3f5'};
 ctx.save();ctx.beginPath();if(ctx.roundRect)ctx.roundRect(rect.x,rect.y,rect.width,rect.height,5);else{const x=rect.x,y=rect.y,w=rect.width,h=rect.height,r=5;ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}ctx.fillStyle=palette.fill;ctx.fill();ctx.strokeStyle=palette.stroke;ctx.lineWidth=active?1.4:1;ctx.setLineDash([]);ctx.stroke();ctx.fillStyle=palette.text;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(name,rect.x+rect.width/2,rect.y+rect.height/2+.5);ctx.restore();
}
function render(ctx,model,options={}){
 const w=options.width||ctx.canvas.width,h=options.height||ctx.canvas.height,view=options.view||{yaw:.65,pitch:.35,zoom:1},anim=options.animation,axisAnimation=options.axisAnimation||anim,selected=root.PuzzleAxisDisplay?root.PuzzleAxisDisplay.selection(options.selected??'L',axisAnimation):(axisAnimation?.move.face??options.selected??'L'),hovered=root.PuzzleAxisDisplay?.hovered?.();
 const radius=model.radius||Math.max(...model.pieces.flatMap(p=>p.body.flatMap(f=>(f.vertices||f.points).map(v=>Math.hypot(...v)))));
 const scale=Math.min(w*.45,h*.42)/radius*(view.zoom||1),eye=radius*5.5,polygons=[],anchors=[],targets=[],labelRects=[],chosen=new Set(options.highlight===false||root.PuzzleAxisDisplay?.highlights3D?.()===false||!selected?[]:model.movingPieces(selected)),moving=anim?new Set(model.movingPieces(anim.move.face)):new Set();
 const cfg=anim?model.configById[anim.move.face]:null,angle=anim?cfg.angle*anim.move.dir*(anim.progress||0):0;
 const transformed=(v,turn)=>camera(turn?model.rotateVector(v,cfg.normal,angle):v,view);
 const project=v=>{const q=eye/(eye-v[2]);return[w/2+v[0]*scale*q,h*(model.type==='jing'?.63:.50)-v[1]*scale*q];};
 ctx.clearRect(0,0,w,h);
 if(options.background){ctx.fillStyle=options.background;ctx.fillRect(0,0,w,h);}
 const shadow=ctx.createRadialGradient(w/2,h*.81,0,w/2,h*.81,w*.3);shadow.addColorStop(0,'rgba(0,0,0,.22)');shadow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=shadow;ctx.fillRect(0,h*.65,w,h*.35);
 function polygon(points,normal,color,turn,sticker,highlight,pieceId,stickerId=null){
  const c=transformed(center(points),turn),n=transformed(normal,turn);
  if(sticker)anchors.push({id:stickerId,center:c,normal:n,selected:highlight});
  if(dot(n,[-c[0],-c[1],eye-c[2]])<=1e-8)return;
  const transformedPoints=points.map(p=>transformed(p,turn));
  polygons.push({points:transformedPoints,outline:transformedPoints,center:c,stickerId,depth:c[2]+(sticker?.0002:0),normal:n,color,sticker,highlight,pieceId});
 }
 for(const piece of model.pieces){const mesh=model.mesh(piece),turn=moving.has(piece.id),highlight=chosen.has(piece.id);
  for(const face of mesh.body)polygon(face.vertices||face.points,face.normal,'#1b1a25',turn,false,highlight,piece.id);
  for(const face of mesh.stickers)polygon(face.vertices||face.points,face.normal,face.color,turn,true,highlight,piece.id,face.id);
 }
 // BSP fragments retain the original sticker's center, outline, and identity.
 // Picking follows these same BSP fragments, including uncolored body faces
 // that occlude stickers. The original outline remains only for annotations.
 const ordered=root.CubeBSP?root.CubeBSP.order(polygons,[0,0,eye]):polygons.sort((a,b)=>a.depth-b.depth);
 const selection=root.PuzzleSelection3D?.begin(ctx,{tileLabelsHandled:true,canvas:options.canvas,project,eye,width:w,height:h,radius,occluders:polygons,pickFaces:ordered});
 for(const anchor of anchors)selection?.track?.(anchor);
 for(const face of ordered){const p=face.points.map(project);ctx.beginPath();p.forEach((v,i)=>i?ctx.lineTo(...v):ctx.moveTo(...v));ctx.closePath();ctx.fillStyle=face.color;ctx.fill();
  if(face.sticker){const light=clamp(.76+.24*dot(face.normal,[-.25,.5,.83]),.59,1);ctx.fillStyle='rgba(0,0,0,'+(1-light)+')';ctx.fill();ctx.strokeStyle=face.highlight?'rgba(240,225,255,.38)':'rgba(255,255,255,.12)';ctx.lineWidth=face.highlight?1.1:.65;}
  else{ctx.strokeStyle=face.highlight?'#53445f':'#35323f';ctx.lineWidth=.75;}ctx.save();ctx.clip();ctx.beginPath();face.outline.map(project).forEach((v,i)=>i?ctx.lineTo(...v):ctx.moveTo(...v));ctx.closePath();ctx.stroke();if(face.sticker)selection?.face({id:face.stickerId,points:face.points,outline:face.outline,center:face.center,normal:face.normal,selected:face.highlight});ctx.restore();
 }
 const axisCandidates=[];
 if(options.labels!==false){const outer=model.outerConfigs||model.configs.filter(c=>!c.middle&&!c.tip),ids=new Set(outer.map(c=>c.id));if(selected)ids.add(selected);if(hovered)ids.add(hovered);
  for(const id of ids){const config=model.configById[id];if(!config)continue;const surface=Math.min(...model.faces.filter(f=>dot(f.normal,config.normal)>1e-7).map(f=>f.offset/dot(f.normal,config.normal))),p=transformed(mul(config.normal,surface*1.008),false),n=camera(config.normal,view);
   const front=model.type==='jing'?model.faces.some(f=>Math.abs(dot(f.normal,mul(config.normal,surface))-f.offset)<1e-6&&dot(camera(f.normal,view),[-p[0],-p[1],eye-p[2]])>1e-7):dot(n,[-p[0],-p[1],eye-p[2]])>1e-7;
   axisCandidates.push({id,index:axisCandidates.length,world:p,p:project(p),front,active:id===selected,hover:id===hovered});
  }
  targets.push(...drawAxisBadges(ctx,axisCandidates,w,h,polygons.flatMap(f=>f.points.map(project)),!options.pieceLabels,selection?.leader));
 }
 if(options.pieceLabels){
  const labels=new Map();
  for(const f of polygons.filter(f=>f.sticker)){const pts=f.points.map(project);let area=0;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];area+=a[0]*b[1]-a[1]*b[0];}area=Math.abs(area);const old=labels.get(f.pieceId);if(!old||area>old.area)labels.set(f.pieceId,{area,p:project(center(f.points))});}
  // Prioritize broad front-facing stickers and suppress edge collisions.
  // Rotating the view exposes labels that would otherwise overlap at the rim.
  for(const[id,info]of [...labels].sort((a,b)=>b[1].area-a[1].area)){
   if(info.area<340)continue;
   const piece=model.pieces.find(p=>p.id===id),slot=model.polyhedron.pieces.find(p=>p.home.every((x,i)=>x===piece.pos[i])),name=slot&&slot.name!==piece.name?piece.name+'→'+slot.name:piece.name,[x,y]=info.p;
   if(targets.some(target=>target.face===name&&target.front!==false&&(Math.hypot(target.x-x,target.y-y)<=target.r+5||polygons.some(face=>face.sticker&&face.pieceId===id&&withinPolygon(target.x,target.y,face.points.map(project))))))continue;ctx.font='600 11px ui-monospace,monospace';const width=ctx.measureText(name).width+10,rect={x:x-width/2,y:y-9,width,height:18,name,active:chosen.has(id)};
   if(labelRects.some(r=>rect.x<r.x+r.width+5&&rect.x+rect.width+5>r.x&&rect.y<r.y+r.height+5&&rect.y+rect.height+5>r.y))continue;
   labelRects.push(rect);drawTileBadge(ctx,name,rect,chosen.has(id));
  }
 }
 if(options.labels!==false&&options.pieceLabels){const drawn=drawAxisBadges(ctx,axisCandidates,w,h,polygons.flatMap(f=>f.points.map(project)),true,selection?.leader);for(const target of targets)target.leaderSegments=drawn.find(item=>item.face===target.face)?.leaderSegments||[];}
 root.PuzzleAxisDisplay?.publish3DAxes?.(axisCandidates.map(c=>c.id));
 root.PuzzleAxisDisplay?.publish3DLabelTargets?.(targets);selection?.finish();
 return{targets,radius,labelRects};
}
root.SkewbRenderer=Object.freeze({render,camera,center});
if(typeof module!=='undefined'&&module.exports)module.exports=root.SkewbRenderer;
})(typeof globalThis!=='undefined'?globalThis:this);
