/* Rigid polygon geometry with exact BSP ordering for moving shape modifiers. */
(function(root){
'use strict';
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),mul=(v,s)=>v.map(x=>x*s),center=p=>p.reduce((a,v)=>a.map((x,i)=>x+v[i]/p.length),[0,0,0]),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const rot=(v,axis,a)=>{const c=Math.cos(a),s=Math.sin(a),[x,y,z]=v;return axis===0?[x,c*y-s*z,s*y+c*z]:[c*x+s*z,y,-s*x+c*z];};
const camera=(v,view)=>{const p=rot(rot(v,1,view.yaw),0,view.pitch),a=-(view.roll||0),c=Math.cos(a),s=Math.sin(a);return [c*p[0]-s*p[1],s*p[0]+c*p[1],p[2]];};
const slotName=p=>(p[1]>0?'U':p[1]<0?'D':'')+(p[2]>0?'F':p[2]<0?'B':'')+(p[0]>0?'R':p[0]<0?'L':'');
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
 const w=options.width||ctx.canvas.width,h=options.height||ctx.canvas.height,view=options.view||{yaw:-.62,pitch:.48,zoom:1},anim=options.animation,axisAnimation=options.axisAnimation||anim,selected=root.PuzzleAxisDisplay?root.PuzzleAxisDisplay.selection(options.selected??'R',axisAnimation):(axisAnimation?.move.face??options.selected??'R'),hovered=root.PuzzleAxisDisplay?.hovered?.();
 const radius=model.radius,scale=Math.min(w*.42,h*.40)/radius*(view.zoom||1),eye=radius*6,polygons=[],anchors=[],targets=[],labels=[],bodies=[];
 const chosen=new Set(options.highlight===false||root.PuzzleAxisDisplay?.highlights3D?.()===false||!selected?[]:model.movingPieces(selected)),moving=anim?new Set(model.animationPieces?model.animationPieces(anim.move.face):model.movingPieces(anim.move.face)):new Set(),cfg=anim?model.configById[anim.move.face]:null;
 const angle=anim?cfg.angle*anim.move.dir*(anim.move.turns||1)*(anim.progress||0):0;
 const transformed=(v,turn)=>camera(turn?model.rotateVector(v,cfg.normal,angle):v,view);
 const project=v=>{const q=eye/(eye-v[2]);return[w/2+v[0]*scale*q,h*.50-v[1]*scale*q];};
 ctx.clearRect(0,0,w,h);if(options.background){ctx.fillStyle=options.background;ctx.fillRect(0,0,w,h);}
 const shadow=ctx.createRadialGradient(w/2,h*.83,0,w/2,h*.83,w*.33);shadow.addColorStop(0,'rgba(0,0,0,.23)');shadow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=shadow;ctx.fillRect(0,h*.62,w,h*.38);
 for(const piece of model.pieces){const mesh=model.mesh(piece),turn=moving.has(piece.id),highlight=chosen.has(piece.id);
  bodies.push(mesh.body.map(f=>({normal:turn?model.rotateVector(f.normal,cfg.normal,angle):f.normal,point:turn?model.rotateVector((f.vertices||f.points)[0],cfg.normal,angle):(f.vertices||f.points)[0]})));
  for(const [list,sticker]of [[mesh.body,false],[mesh.stickers,true]])for(const face of list){const vertices=face.vertices||face.points,c=transformed(center(vertices),turn),n=transformed(face.normal,turn);if(sticker)anchors.push({id:face.id,center:c,normal:n,selected:highlight});if(dot(n,[-c[0],-c[1],eye-c[2]])<=1e-8)continue;const points=vertices.map(p=>transformed(p,turn));polygons.push({points,outline:points,center:c,normal:n,stickerId:sticker?face.id:null,color:sticker?face.color:'#1c1a24',sticker,highlight,pieceId:piece.id,light:clamp(.80+.2*dot(n,[-.25,.5,.83]),.63,1)});}
 }
 // Keep full sticker geometry on BSP fragments so annotations remain centered
 // on the physical face, rather than on whichever fragment is visible.
 // Picking follows these same BSP fragments, including uncolored body faces
 // that occlude stickers. The original outline remains only for annotations.
 const ordered=root.CubeBSP.order(polygons,[0,0,eye]);
 const selection=root.PuzzleSelection3D?.begin(ctx,{tileLabelsHandled:true,canvas:options.canvas,project,eye,width:w,height:h,radius,occluders:polygons,pickFaces:ordered});
 for(const anchor of anchors)selection?.track?.(anchor);
 for(const face of ordered){const p=face.points.map(project);ctx.beginPath();p.forEach((v,i)=>i?ctx.lineTo(...v):ctx.moveTo(...v));ctx.closePath();if(face.sticker&&options.mirrorMode){const xs=p.map(v=>v[0]),ys=p.map(v=>v[1]),gradient=ctx.createLinearGradient(Math.min(...xs),Math.min(...ys),Math.max(...xs)+1,Math.max(...ys)+1);for(const [stop,level]of [[0,195],[.24,238],[.48,170],[.74,216],[1,247]]){const v=Math.round(level*face.light);gradient.addColorStop(stop,'rgb('+v+','+(v+2)+','+(v+6)+')');}ctx.fillStyle=gradient;ctx.fill();}else{ctx.fillStyle=face.color;ctx.fill();if(face.sticker){ctx.fillStyle='rgba(0,0,0,'+(1-face.light)+')';ctx.fill();}}ctx.save();ctx.clip();ctx.beginPath();face.outline.map(project).forEach((v,i)=>i?ctx.lineTo(...v):ctx.moveTo(...v));ctx.closePath();ctx.strokeStyle=face.sticker?(face.highlight?'rgba(243,229,255,.40)':'rgba(255,255,255,.13)'):(face.highlight?'#675777':'#302e3b');ctx.lineWidth=face.sticker?1:.7;ctx.stroke();if(face.sticker)selection?.face({id:face.stickerId,points:face.points,outline:face.outline,center:face.center,normal:face.normal,selected:face.highlight});ctx.restore();}
 const axisCandidates=[];
 if(options.labels!==false){const outer=model.outerConfigs||model.configs.filter(c=>!c.tip&&!c.middle),ids=new Set(outer.map(c=>c.id));if(selected)ids.add(selected);if(hovered)ids.add(hovered);
  for(const id of ids){const cfg=model.configById[id];if(!cfg)continue;const n=camera(cfg.normal,view);
   let surface=0;for(const body of bodies){let low=0,high=Infinity,valid=true;for(const face of body){const d=dot(face.normal,cfg.normal),offset=dot(face.normal,face.point);if(Math.abs(d)<1e-7){if(offset<-.00001){valid=false;break;}}else if(d>0)high=Math.min(high,offset/d);else low=Math.max(low,offset/d);}if(valid&&high>=low-1e-5&&Number.isFinite(high))surface=Math.max(surface,high);}
   const pole=cfg.normal.map(v=>v*(surface||radius*.7)*1.025),cameraPole=camera(pole,view);
   axisCandidates.push({id,index:axisCandidates.length,world:cameraPole,p:project(cameraPole),front:dot(n,[-cameraPole[0],-cameraPole[1],eye-cameraPole[2]])>1e-7,active:id===selected,hover:id===hovered});
  }
  targets.push(...drawAxisBadges(ctx,axisCandidates,w,h,polygons.flatMap(f=>f.points.map(project)),!options.pieceLabels,selection?.leader));
 }
 if(options.pieceLabels){const best=new Map();for(const face of polygons.filter(f=>f.sticker)){const pts=face.points.map(project);let area=0;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];area+=a[0]*b[1]-a[1]*b[0];}area=Math.abs(area);if(!best.has(face.pieceId)||area>best.get(face.pieceId).area)best.set(face.pieceId,{area,p:project(center(face.points))});}
  for(const [id,info]of [...best].sort((a,b)=>b[1].area-a[1].area)){if(info.area<400)continue;const piece=model.pieces.find(p=>p.id===id),home=piece.name||slotName(piece.home),slot=model.positionName?model.positionName(piece.pos):slotName(piece.pos),name=home===slot?home:home+'→'+slot,[x,y]=info.p;if(targets.some(target=>target.face===name&&target.front!==false&&(Math.hypot(target.x-x,target.y-y)<=target.r+5||polygons.some(face=>face.sticker&&face.pieceId===id&&withinPolygon(target.x,target.y,face.points.map(project))))))continue;ctx.font='600 11px ui-monospace,monospace';const width=ctx.measureText(name).width+10,rect={x:x-width/2,y:y-9,width,height:18,name,active:chosen.has(id)};if(labels.some(r=>rect.x<r.x+r.width+5&&rect.x+rect.width+5>r.x&&rect.y<r.y+r.height+5&&rect.y+rect.height+5>r.y))continue;labels.push(rect);drawTileBadge(ctx,name,rect,chosen.has(id));}
 }
 if(options.labels!==false&&options.pieceLabels){const drawn=drawAxisBadges(ctx,axisCandidates,w,h,polygons.flatMap(f=>f.points.map(project)),true,selection?.leader);for(const target of targets)target.leaderSegments=drawn.find(item=>item.face===target.face)?.leaderSegments||[];}
 root.PuzzleAxisDisplay?.publish3DAxes?.(axisCandidates.map(c=>c.id));
 root.PuzzleAxisDisplay?.publish3DLabelTargets?.(targets);selection?.finish();
 return{targets,radius,labels};
}
root.ShapeRenderer=Object.freeze({render,camera,center,slotName});if(typeof module!=='undefined'&&module.exports)module.exports=root.ShapeRenderer;
})(typeof globalThis!=='undefined'?globalThis:this);
