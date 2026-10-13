/* Exact rigid-piece renderer shared by Ultimate Skewb and Skewb Diamond. */
(function(root){
'use strict';
const TAU=Math.PI*2, clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const add=(a,b)=>a.map((x,i)=>x+b[i]),mul=(v,s)=>v.map(x=>x*s),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const center=points=>points.reduce((v,p)=>add(v,mul(p,1/points.length)),[0,0,0]);
function rot(v,axis,a){const c=Math.cos(a),s=Math.sin(a),[x,y,z]=v;return axis===0?[x,c*y-s*z,s*y+c*z]:[c*x+s*z,y,-s*x+c*z];}
function camera(v,view){return rot(rot(v,1,view.yaw),0,view.pitch);}
function render(ctx,model,options={}){
 const w=options.width||ctx.canvas.width,h=options.height||ctx.canvas.height,view=options.view||{yaw:.65,pitch:.35,zoom:1},selected=options.selected||'L',anim=options.animation;
 const radius=model.radius||Math.max(...model.pieces.flatMap(p=>p.body.flatMap(f=>(f.vertices||f.points).map(v=>Math.hypot(...v)))));
 const scale=Math.min(w*.45,h*.42)/radius*(view.zoom||1),eye=radius*5.5,polygons=[],targets=[],labelRects=[],chosen=new Set(options.highlight===false?[]:model.movingPieces(selected)),moving=anim?new Set(model.movingPieces(anim.move.face)):new Set();
 const cfg=anim?model.configById[anim.move.face]:null,angle=anim?cfg.angle*anim.move.dir*(anim.progress||0):0;
 const transformed=(v,turn)=>camera(turn?model.rotateVector(v,cfg.normal,angle):v,view);
 const project=v=>{const q=eye/(eye-v[2]);return[w/2+v[0]*scale*q,h*(model.type==='jing'?.63:.50)-v[1]*scale*q];};
 ctx.clearRect(0,0,w,h);
 if(options.background){ctx.fillStyle=options.background;ctx.fillRect(0,0,w,h);}
 const shadow=ctx.createRadialGradient(w/2,h*.81,0,w/2,h*.81,w*.3);shadow.addColorStop(0,'rgba(0,0,0,.22)');shadow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=shadow;ctx.fillRect(0,h*.65,w,h*.35);
 function polygon(points,normal,color,turn,sticker,highlight,pieceId){
  const c=transformed(center(points),turn),n=transformed(normal,turn);
  if(dot(n,[-c[0],-c[1],eye-c[2]])<=1e-8)return;
  const transformedPoints=points.map(p=>transformed(p,turn));
  polygons.push({points:transformedPoints,outline:transformedPoints,depth:c[2]+(sticker?.0002:0),normal:n,color,sticker,highlight,pieceId});
 }
 for(const piece of model.pieces){const mesh=model.mesh(piece),turn=moving.has(piece.id),highlight=chosen.has(piece.id);
  for(const face of mesh.body)polygon(face.vertices||face.points,face.normal,'#1b1a25',turn,false,highlight,piece.id);
  for(const face of mesh.stickers)polygon(face.vertices||face.points,face.normal,face.color,turn,true,highlight,piece.id);
 }
 const ordered=root.CubeBSP?root.CubeBSP.order(polygons,[0,0,eye]):polygons.sort((a,b)=>a.depth-b.depth);
 for(const face of ordered){const p=face.points.map(project);ctx.beginPath();p.forEach((v,i)=>i?ctx.lineTo(...v):ctx.moveTo(...v));ctx.closePath();ctx.fillStyle=face.color;ctx.fill();
  if(face.sticker){const light=clamp(.76+.24*dot(face.normal,[-.25,.5,.83]),.59,1);ctx.fillStyle='rgba(0,0,0,'+(1-light)+')';ctx.fill();ctx.strokeStyle=face.highlight?'rgba(240,225,255,.38)':'rgba(255,255,255,.12)';ctx.lineWidth=face.highlight?1.1:.65;}
  else{ctx.strokeStyle=face.highlight?'#53445f':'#35323f';ctx.lineWidth=.75;}ctx.save();ctx.clip();ctx.beginPath();face.outline.map(project).forEach((v,i)=>i?ctx.lineTo(...v):ctx.moveTo(...v));ctx.closePath();ctx.stroke();ctx.restore();
 }
 if(options.pieceLabels){
  const labels=new Map();
  for(const f of polygons.filter(f=>f.sticker)){const pts=f.points.map(project);let area=0;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];area+=a[0]*b[1]-a[1]*b[0];}area=Math.abs(area);const old=labels.get(f.pieceId);if(!old||area>old.area)labels.set(f.pieceId,{area,p:project(center(f.points))});}
  // Prioritize broad front-facing stickers and suppress edge collisions.
  // Rotating the view exposes labels that would otherwise overlap at the rim.
  for(const[id,info]of [...labels].sort((a,b)=>b[1].area-a[1].area)){
   if(info.area<340)continue;
   const piece=model.pieces.find(p=>p.id===id),slot=model.polyhedron.pieces.find(p=>p.home.every((x,i)=>x===piece.pos[i])),name=slot&&slot.name!==piece.name?piece.name+'→'+slot.name:piece.name,[x,y]=info.p;
   ctx.font='600 11px ui-monospace,monospace';const width=ctx.measureText(name).width+10,rect={x:x-width/2,y:y-9,width,height:18};
   if(labelRects.some(r=>rect.x<r.x+r.width+5&&rect.x+rect.width+5>r.x&&rect.y<r.y+r.height+5&&rect.y+rect.height+5>r.y))continue;
   labelRects.push(rect);ctx.fillStyle='rgba(14,13,23,.85)';ctx.fillRect(rect.x,rect.y,width,18);ctx.fillStyle='#ffffff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(name,x,y+.5);
  }
 }
 // Axis labels are attached to hemisphere poles, independently of sticker color.
 if(options.labels!==false&&!options.pieceLabels){for(const config of model.configs.filter(c=>!c.middle)){const surface=Math.min(...model.faces.filter(f=>dot(f.normal,config.normal)>1e-7).map(f=>f.offset/dot(f.normal,config.normal))),p=transformed(mul(config.normal,surface*1.008),false),n=camera(config.normal,view);const visible=model.type==='jing'?model.faces.some(f=>Math.abs(dot(f.normal,mul(config.normal,surface))-f.offset)<1e-6&&dot(camera(f.normal,view),[-p[0],-p[1],eye-p[2]])>1e-7):n[2]>=.2;if(!visible)continue;const q=project(p),active=config.id===selected;
  targets.push({face:config.id,x:q[0],y:q[1]});ctx.beginPath();ctx.arc(q[0],q[1],active?13:11,0,TAU);ctx.fillStyle=active?'#b3a0ff':'rgba(14,13,23,.85)';ctx.fill();ctx.strokeStyle=active?'#f1ebff':'rgba(255,255,255,.45)';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=active?'#171322':'#ffffff';ctx.font='600 11px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(config.id,q[0],q[1]+.5);
 }}
 return{targets,radius,labelRects};
}
root.SkewbRenderer=Object.freeze({render,camera,center});
if(typeof module!=='undefined'&&module.exports)module.exports=root.SkewbRenderer;
})(typeof globalThis!=='undefined'?globalThis:this);
