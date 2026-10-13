/* Rigid polygon geometry with exact BSP ordering for moving shape modifiers. */
(function(root){
'use strict';
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),mul=(v,s)=>v.map(x=>x*s),center=p=>p.reduce((a,v)=>a.map((x,i)=>x+v[i]/p.length),[0,0,0]),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const rot=(v,axis,a)=>{const c=Math.cos(a),s=Math.sin(a),[x,y,z]=v;return axis===0?[x,c*y-s*z,s*y+c*z]:[c*x+s*z,y,-s*x+c*z];};
const camera=(v,view)=>rot(rot(v,1,view.yaw),0,view.pitch);
const slotName=p=>(p[1]>0?'U':p[1]<0?'D':'')+(p[2]>0?'F':p[2]<0?'B':'')+(p[0]>0?'R':p[0]<0?'L':'');
function render(ctx,model,options={}){
 const w=options.width||ctx.canvas.width,h=options.height||ctx.canvas.height,view=options.view||{yaw:-.62,pitch:.48,zoom:1},selected=options.selected||'R',anim=options.animation;
 const radius=model.radius,scale=Math.min(w*.42,h*.40)/radius*(view.zoom||1),eye=radius*6,polygons=[],targets=[],labels=[],bodies=[];
 const chosen=new Set(options.highlight===false?[]:model.movingPieces(selected)),moving=anim?new Set(model.animationPieces?model.animationPieces(anim.move.face):model.movingPieces(anim.move.face)):new Set(),cfg=anim?model.configById[anim.move.face]:null;
 const angle=anim?cfg.angle*anim.move.dir*(anim.move.turns||1)*(anim.progress||0):0;
 const transformed=(v,turn)=>camera(turn?model.rotateVector(v,cfg.normal,angle):v,view);
 const project=v=>{const q=eye/(eye-v[2]);return[w/2+v[0]*scale*q,h*.50-v[1]*scale*q];};
 ctx.clearRect(0,0,w,h);if(options.background){ctx.fillStyle=options.background;ctx.fillRect(0,0,w,h);}
 const shadow=ctx.createRadialGradient(w/2,h*.83,0,w/2,h*.83,w*.33);shadow.addColorStop(0,'rgba(0,0,0,.23)');shadow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=shadow;ctx.fillRect(0,h*.62,w,h*.38);
 for(const piece of model.pieces){const mesh=model.mesh(piece),turn=moving.has(piece.id),highlight=chosen.has(piece.id);
  bodies.push(mesh.body.map(f=>({normal:turn?model.rotateVector(f.normal,cfg.normal,angle):f.normal,point:turn?model.rotateVector((f.vertices||f.points)[0],cfg.normal,angle):(f.vertices||f.points)[0]})));
  for(const [list,sticker]of [[mesh.body,false],[mesh.stickers,true]])for(const face of list){const vertices=face.vertices||face.points,c=transformed(center(vertices),turn),n=transformed(face.normal,turn);if(dot(n,[-c[0],-c[1],eye-c[2]])<=1e-8)continue;const points=vertices.map(p=>transformed(p,turn));polygons.push({points,outline:points,normal:n,color:sticker?face.color:'#1c1a24',sticker,highlight,pieceId:piece.id,light:clamp(.80+.2*dot(n,[-.25,.5,.83]),.63,1)});}
 }
 const ordered=root.CubeBSP.order(polygons,[0,0,eye]);
 for(const face of ordered){const p=face.points.map(project);ctx.beginPath();p.forEach((v,i)=>i?ctx.lineTo(...v):ctx.moveTo(...v));ctx.closePath();if(face.sticker&&options.mirrorMode){const xs=p.map(v=>v[0]),ys=p.map(v=>v[1]),gradient=ctx.createLinearGradient(Math.min(...xs),Math.min(...ys),Math.max(...xs)+1,Math.max(...ys)+1);for(const [stop,level]of [[0,195],[.24,238],[.48,170],[.74,216],[1,247]]){const v=Math.round(level*face.light);gradient.addColorStop(stop,'rgb('+v+','+(v+2)+','+(v+6)+')');}ctx.fillStyle=gradient;ctx.fill();}else{ctx.fillStyle=face.color;ctx.fill();if(face.sticker){ctx.fillStyle='rgba(0,0,0,'+(1-face.light)+')';ctx.fill();}}ctx.save();ctx.clip();ctx.beginPath();face.outline.map(project).forEach((v,i)=>i?ctx.lineTo(...v):ctx.moveTo(...v));ctx.closePath();ctx.strokeStyle=face.sticker?(face.highlight?'rgba(243,229,255,.40)':'rgba(255,255,255,.13)'):(face.highlight?'#675777':'#302e3b');ctx.lineWidth=face.sticker?1:.7;ctx.stroke();ctx.restore();}
 if(options.pieceLabels&&!options.mirrorMode){const best=new Map();for(const face of polygons.filter(f=>f.sticker)){const pts=face.points.map(project);let area=0;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];area+=a[0]*b[1]-a[1]*b[0];}area=Math.abs(area);if(!best.has(face.pieceId)||area>best.get(face.pieceId).area)best.set(face.pieceId,{area,p:project(center(face.points))});}
  for(const [id,info]of [...best].sort((a,b)=>b[1].area-a[1].area)){if(info.area<400)continue;const piece=model.pieces.find(p=>p.id===id),home=piece.name||slotName(piece.home),slot=model.positionName?model.positionName(piece.pos):slotName(piece.pos),name=home===slot?home:home+'→'+slot,[x,y]=info.p;ctx.font='600 11px ui-monospace,monospace';const width=ctx.measureText(name).width+10,rect={x:x-width/2,y:y-9,width,height:18};if(labels.some(r=>rect.x<r.x+r.width+5&&rect.x+rect.width+5>r.x&&rect.y<r.y+r.height+5&&rect.y+rect.height+5>r.y))continue;labels.push(rect);ctx.fillStyle='rgba(14,13,23,.84)';ctx.fillRect(rect.x,rect.y,width,18);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(name,x,y+.5);}
 }
 if(options.labels!==false){for(const cfg of (model.outerConfigs||model.configs.filter(c=>!c.tip))){const n=camera(cfg.normal,view);if(n[2]<.14)continue;
  let surface=0;for(const body of bodies){let low=0,high=Infinity,valid=true;for(const face of body){const d=dot(face.normal,cfg.normal),offset=dot(face.normal,face.point);if(Math.abs(d)<1e-7){if(offset<-.00001){valid=false;break;}}else if(d>0)high=Math.min(high,offset/d);else low=Math.max(low,offset/d);}if(valid&&high>=low-1e-5&&Number.isFinite(high))surface=Math.max(surface,high);}
  const pole=cfg.normal.map(v=>v*(surface||radius*.7)*1.025),p=project(camera(pole,view)),active=cfg.id===selected || (cfg.vertex && cfg.vertex===model.configById[selected]?.vertex);
  targets.push({face:cfg.id,x:p[0],y:p[1]});ctx.beginPath();ctx.arc(p[0],p[1],active?13:11,0,Math.PI*2);ctx.fillStyle=active?'#b3a0ff':'rgba(14,13,23,.88)';ctx.fill();ctx.strokeStyle=active?'#f1ebff':'rgba(255,255,255,.6)';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=active?'#171322':'#fff';ctx.font='600 11px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(cfg.id,p[0],p[1]+.5);
 }}
 return{targets,radius,labels};
}
root.ShapeRenderer=Object.freeze({render,camera,center,slotName});if(typeof module!=='undefined'&&module.exports)module.exports=root.ShapeRenderer;
})(typeof globalThis!=='undefined'?globalThis:this);
