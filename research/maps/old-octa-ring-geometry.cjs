/* A fixed, shared turn atlas. Every colored sector is one real sticker.
 * Skewb uses exact stereographic circles. FTO applies a fixed bounded radial
 * lens to that projection: its closed orbital curves keep all 42 pieces and
 * all middle-slice paths visible, with no front/back occlusion or lost dots.
 */
(function(root){
'use strict';
const TAU=Math.PI*2,EPS=1e-7,dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),mul=(a,s)=>a.map(x=>x*s),add=(a,b)=>a.map((x,i)=>x+b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>mul(a,1/Math.hypot(...a));
function create(model){
 const fto=model.type==='fto',limit=1.5,pole=unit(fto?[1,-1,1]:[1,-1,0]),u=unit(cross([0,0,1],pole)),v=cross(pole,u),primaryCut=fto?Math.sqrt(2/3):1/3;
 function flat(point){const p=unit(point),d=1-dot(p,pole);if(d<1e-10)throw new Error('Projection pole coincides with a piece or orbit');return{x:dot(p,u)/d,y:-dot(p,v)/d};}
 function project(p){if(!fto)return p;const f=1/Math.sqrt(1+(p.x*p.x+p.y*p.y)/(limit*limit));return{x:p.x*f,y:p.y*f};}
 function unproject(p){if(!fto)return p;const f=1/Math.sqrt(Math.max(1e-10,1-(p.x*p.x+p.y*p.y)/(limit*limit)));return{x:p.x*f,y:p.y*f};}
 const raw=point=>project(flat(point));
 function circle(cfg,cut){
  const d=cut-dot(cfg.normal,pole),nx=dot(cfg.normal,u),ny=-dot(cfg.normal,v),radius=Math.sqrt(Math.max(0,1-cut*cut));
  const basis=unit(cross(cfg.normal,[0,1,0])),other=cross(cfg.normal,basis),points=[];
  for(let i=0;i<=180;i++){const a=i*TAU/180;points.push(raw(add(mul(cfg.normal,cut),add(mul(basis,radius*Math.cos(a)),mul(other,radius*Math.sin(a))))));}
  const data={face:cfg.id,cut,points,curved:fto,cwDir:d<0?1:-1};
  return Math.abs(d)<EPS?{...data,line:true,nx,ny,offset:cut}:{...data,cx:nx/d,cy:ny/d,r:radius/Math.abs(d)};
 }
 const rings=model.configs.filter(c=>!c.middle).map(c=>({...circle(c,primaryCut),primary:true})),allByFace={},focusBounds={};
 const affected=(p,cfg)=>fto?(cfg.middle?Math.abs(dot(p,cfg.anchor))<2:dot(p,cfg.anchor)>2):dot(p,cfg.anchor)>0;
 function bound(points,padding=0){const x0=Math.min(...points.map(p=>p.x))-padding,x1=Math.max(...points.map(p=>p.x))+padding,y0=Math.min(...points.map(p=>p.y))-padding,y1=Math.max(...points.map(p=>p.y))+padding;return{x0,x1,y0,y1,width:x1-x0,height:y1-y0};}
 for(const cfg of model.configs){const values=[],pieces=model.polyhedron.pieces.filter(p=>affected(p.home,cfg));for(const p of pieces){const cut=dot(unit(p.home),cfg.normal);if(Math.abs(cut)<1-EPS&&!values.some(c=>Math.abs(c-cut)<EPS))values.push(cut);}allByFace[cfg.id]=values.map(c=>circle(cfg,c));focusBounds[cfg.id]=bound([...allByFace[cfg.id].flatMap(r=>r.points),...pieces.map(p=>raw(p.home))],.006);}
 const points=model.polyhedron.pieces.map(p=>raw(p.home)),all=Object.values(allByFace).flat();
 const bounds=fto?{x0:-limit,x1:limit,y0:-limit,y1:limit,width:2*limit,height:2*limit}:bound([...points,...all.flatMap(r=>[{x:r.cx-r.r,y:r.cy-r.r},{x:r.cx+r.r,y:r.cy+r.r}])]);
 function getRing(id){return rings.find(r=>r.face===id)||allByFace[id].find(r=>!r.line&&r.r>0)||allByFace[id][0];}
 function movingPoint(piece,animation){let p=piece.pos;if(animation&&model.movingPieces(animation.move.face).includes(piece.id)){const cfg=model.configById[animation.move.face];p=model.rotateVector(p,cfg.normal,cfg.angle*animation.move.dir*animation.progress);}return raw(p);}
 function colorSectors(piece,animation){
  const cfg=animation&&model.configById[animation.move.face],moving=cfg&&model.movingPieces(cfg.id).includes(piece.id);
  const direction=unit(moving?model.rotateVector(piece.pos,cfg.normal,cfg.angle*animation.move.dir*animation.progress):piece.pos),p=raw(direction);
  return model.mesh(piece).stickers.map(s=>{
   let c=s.center||s.vertices.reduce((a,p)=>a.map((x,i)=>x+p[i]/s.vertices.length),[0,0,0]);if(moving)c=model.rotateVector(c,cfg.normal,cfg.angle*animation.move.dir*animation.progress);
   // A sticker can face the projection pole even though its piece never does.
   // Project its local tangent at the piece, not the distant sticker centroid:
   // this preserves the badge's orientation without sending a color to infinity.
   const tangent=add(c,mul(direction,-dot(c,direction))),length=Math.hypot(...tangent);
   const q=length>1e-9?raw(add(direction,mul(tangent,.0001/length))):p;
   return{color:s.color,id:s.id,angle:length>1e-9?Math.atan2(q.y-p.y,q.x-p.x):0};
  }).sort((a,b)=>a.angle-b.angle);
 }
 function distance(p,r){if(!r.curved)return r.line?Math.abs(r.nx*p.x+r.ny*p.y-r.offset)/Math.hypot(r.nx,r.ny):Math.abs(Math.hypot(p.x-r.cx,p.y-r.cy)-r.r);let result=Infinity;for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));result=Math.min(result,Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy));}return result;}
 return{rings,allByFace,getRing,flat,project,unproject,raw,movingPoint,colorSectors,distance,bounds,focusBounds};
}
root.OctaRingGeometry=Object.freeze({create});if(typeof module!=='undefined'&&module.exports)module.exports=root.OctaRingGeometry;
})(typeof globalThis!=='undefined'?globalThis:this);
