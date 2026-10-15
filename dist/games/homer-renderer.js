/* Smooth shaded Canvas rendering with a per-pixel depth buffer. The depth test
 * keeps the nose, eyes and all eight crossing pieces correctly occluded. */
(function(root){
'use strict';
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),unit=v=>{const d=Math.hypot(...v);return v.map(x=>x/d);},clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function rotate(v,axis,a){const c=Math.cos(a),s=Math.sin(a),[x,y,z]=v;return axis===0?[x,c*y-s*z,s*y+c*z]:axis===1?[c*x+s*z,y,-s*x+c*z]:[c*x-s*y,s*x+c*y,z];}
const camera=(v,view)=>rotate(rotate(v,1,view.yaw),0,view.pitch),surfaces=new WeakMap(),colors=new Map();
function rgb(color){if(!colors.has(color))colors.set(color,[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)));return colors.get(color);}
function surface(ctx,w,h){let s=surfaces.get(ctx);if(!s){let canvas;if(ctx.canvas.ownerDocument)canvas=ctx.canvas.ownerDocument.createElement('canvas');else if(typeof document!=='undefined'&&document.createElement){const candidate=document.createElement('canvas');if(candidate&&typeof candidate.getContext==='function')canvas=candidate;}if(!canvas&&ctx.canvas.constructor&&ctx.canvas.constructor!==Object)try{canvas=new ctx.canvas.constructor(w,h);}catch(e){}if(!canvas)return null;s={canvas};surfaces.set(ctx,s);}if(s.canvas.width!==w||s.canvas.height!==h){s.canvas.width=w;s.canvas.height=h;s.ctx=s.canvas.getContext('2d');s.image=s.ctx.createImageData(w,h);s.depth=new Float32Array(w*h);s.owners=new Uint16Array(w*h);}else if(!s.ctx){s.ctx=s.canvas.getContext('2d');s.image=s.ctx.createImageData(w,h);s.depth=new Float32Array(w*h);s.owners=new Uint16Array(w*h);}return s.image&&s.image.data?s:null;}
// The model is a union of overlapping curved surfaces. Painter ordering alone
// would put a back-region border or arrow through the nose, eyes, or another
// turning piece. Test annotations against the very same per-pixel depth field
// that rendered the head, including while pieces are between their end states.
function annotate(ctx,states,options){
 const S=root.PuzzleSelection3D;if(!S||!options.buffer)return 0;
 const {G,E,view,anim,cfg,angle,selected,project,eye,w,h,resolution,rw,rh,buffer,pickAt,canvas}=options;
 const isVisible=p=>{if(!p||p[2]>=eye-.01)return false;const q=project(p),x=Math.round(q[0]*resolution),y=Math.round(q[1]*resolution);if(x<0||x>=rw||y<0||y>=rh)return false;return 1/(eye-p[2])>=buffer.depth[y*rw+x]-.00022;};
 const painter=S.begin(ctx,{canvas,project,eye,width:w,height:h,radius:G.radius,isVisible,pickAt,rasterScale:resolution,depthAt:(x,y)=>{const ix=Math.floor(x*resolution),iy=Math.floor(y*resolution);return ix>=0&&ix<rw&&iy>=0&&iy<rh?buffer.depth[iy*rw+ix]:-Infinity;}});let count=0;
 for(const piece of states){const turning=anim&&piece.pos[cfg.axis]===cfg.layer,chosen=!!selected&&piece.pos[E.configs[selected].axis]===E.configs[selected].layer,transform=v=>camera(turning?rotate(G.transform(v,piece.columns),cfg.axis,angle):G.transform(v,piece.columns),view);
  for(const region of G.selectionRegions(piece)){const style=painter.style(region.id,chosen),center=transform(region.center),normal=transform(region.normal);
   painter.track({id:region.id,center,normal,selected:chosen});
   if(!(style.held||style.selected))continue;count++;
   for(const path of region.paths){let run=[],distance=0,startDistance=0;const flush=()=>{if(run.length>1)painter.stroke(run,{held:style.held,selected:style.selected,closed:false,dashOffset:-startDistance});run=[];};
    for(let i=0;i<path.length-1;i++){const a=transform(path[i].p.map((v,j)=>v+path[i].n[j]*.006)),b=transform(path[i+1].p.map((v,j)=>v+path[i+1].n[j]*.006)),qa=project(a),qb=project(b),length=Math.hypot(qb[0]-qa[0],qb[1]-qa[1]),samples=Math.max(1,Math.ceil(length/1.6));
     for(let k=0;k<=samples;k++){const t=k/samples,p=a.map((v,j)=>v+(b[j]-v)*t),q=project(p);if(isVisible(p)){if(!run.length)startDistance=distance+length*t;run.push(q);}else flush();}distance+=length;
    }flush();
   }
  }
 }
 painter.finish();return count;
}
function drawAxisBadges(ctx,candidates,w,h,points,drawLeader){
 const mode=root.PuzzleAxisDisplay?.labelMode?.()||'some';if(mode==='none')return [];
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),cx=w/2,cy=h/2;
 const rx=Math.min(w/2-22,Math.max(w*.25,...xs.map(x=>Math.abs(x-cx)))+20),ry=Math.min(h/2-24,Math.max(h*.25,...ys.map(y=>Math.abs(y-cy)))+20),placed=[],targets=[];
 ctx.save();ctx.font='600 11px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
 for(const item of candidates.filter(item=>mode==='all'||item.front).sort((a,b)=>(b.active-a.active)||(b.front-a.front))){
  const r=Math.max(11,ctx.measureText(item.id).width/2+5),dx=item.p[0]-cx,dy=item.p[1]-cy,angle=Math.hypot(dx,dy)>3?Math.atan2(dy/ry,dx/rx):(-Math.PI/2+item.index*.8);
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
  if(leader){ctx.setLineDash(item.front?[]:[3,4]);ctx.strokeStyle=item.active?'rgba(243,243,243,.72)':'rgba(243,243,243,.34)';ctx.lineWidth=1;targets[targets.length-1].leaderSegments=drawLeader?.(ctx,item.world,[x,y])||[];}
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=palette.fill;ctx.fill();ctx.setLineDash([]);ctx.strokeStyle=palette.stroke;ctx.lineWidth=item.active?1.6:1.2;ctx.stroke();ctx.fillStyle=palette.text;ctx.fillText(item.id,x,y+.5);
 }
 ctx.restore();return targets;
}
function render(ctx,stickers,options={}){
 const G=root.HomerGeometry,E=root.CubeEngine,w=options.width||ctx.canvas.width,h=options.height||ctx.canvas.height,view=options.view||{yaw:-.30,pitch:.08,zoom:1},selected=Object.prototype.hasOwnProperty.call(options,'selected')?options.selected:'R',anim=options.animation,cfg=anim?E.configs[anim.move.face]:null,angle=anim?cfg.turn*anim.move.dir*(anim.move.turns||1)*Math.PI/2*(anim.progress||0):0;
 const scale=Math.min(w*.35/1.5,h*.414/2.16)*(view.zoom||1),eye=9,cy=h*.51,project=p=>{const q=eye/(eye-p[2]);return[w/2+p[0]*scale*q,cy-p[1]*scale*q];},states=G.states(stickers),targets=[],bounds=[[w/2,h/2],[w/2,h/2]],resolution=Math.min(1,(anim?720:1100)/Math.max(w,h)),rw=Math.max(1,Math.round(w*resolution)),rh=Math.max(1,Math.round(h*resolution)),buffer=surface(ctx,rw,rh);
 ctx.clearRect(0,0,w,h);if(options.background){ctx.fillStyle=options.background;ctx.fillRect(0,0,w,h);}const shadow=ctx.createRadialGradient(w/2,h*.91,0,w/2,h*.91,w*.27);shadow.addColorStop(0,'rgba(0,0,0,.32)');shadow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=shadow;ctx.fillRect(0,h*.74,w,h*.26);
 const hitTriangles=[];
 // Pixel ownership shares the exact winning depth test. Only pointer hits need
 // perspective interpolation; normal rendering adds one small integer store.
 const pickAt=(x,y)=>{if(!buffer||!Number.isFinite(x)||!Number.isFinite(y))return null;const ix=Math.floor(x*resolution),iy=Math.floor(y*resolution);if(ix<0||ix>=rw||iy<0||iy>=rh)return null;const hit=hitTriangles[buffer.owners[iy*rw+ix]-1];if(!hit||hit.cut)return null;const[a,b,c]=hit.v,px=ix+.5,py=iy+.5,area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x),wa=((b.x-px)*(c.y-py)-(b.y-py)*(c.x-px))/area,wb=((c.x-px)*(a.y-py)-(c.y-py)*(a.x-px))/area,wc=1-wa-wb,z=wa*a.z+wb*b.z+wc*c.z;if(!(z>0))return null;const weights=[wa*a.z/z,wb*b.z/z,wc*c.z/z],point=[0,1,2].map(i=>weights.reduce((sum,weight,j)=>sum+weight*hit.piece.vertices[hit.indices[j]].p[i],0));return G.selectionRegionAt(hit.piece,point);};
 if(buffer&&states.reduce((count,piece)=>count+piece.triangles.length,0)>65534&&buffer.owners.BYTES_PER_ELEMENT===2)buffer.owners=new Uint32Array(rw*rh);
 if(buffer){const pixels=buffer.image.data,depth=buffer.depth,owners=buffer.owners;pixels.fill(0);depth.fill(-Infinity);owners.fill(0);const light=unit([-.48,.73,1]),half=unit([-.22,.32,1]);
  const raster=(v,owner)=>{let[a,b,c]=v;const area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);if(Math.abs(area)<1e-7)return;let minX=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),maxX=Math.min(rw-1,Math.ceil(Math.max(a.x,b.x,c.x))),minY=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),maxY=Math.min(rh-1,Math.ceil(Math.max(a.y,b.y,c.y)));const inv=1/area;
   const dax=(b.y-c.y)*inv,day=(c.x-b.x)*inv,dbx=(c.y-a.y)*inv,dby=(a.x-c.x)*inv;
   for(let y=minY;y<=maxY;y++){let wa=((b.x-(minX+.5))*(c.y-(y+.5))-(b.y-(y+.5))*(c.x-(minX+.5)))*inv,wb=((c.x-(minX+.5))*(a.y-(y+.5))-(c.y-(y+.5))*(a.x-(minX+.5)))*inv;for(let x=minX;x<=maxX;x++,wa+=dax,wb+=dbx){const wc=1-wa-wb;if(wa<-.00001||wb<-.00001||wc<-.00001)continue;const z=wa*a.z+wb*b.z+wc*c.z,idx=y*rw+x;if(z<=depth[idx])continue;depth[idx]=z;owners[idx]=owner;const j=idx*4;pixels[j]=wa*a.color[0]+wb*b.color[0]+wc*c.color[0];pixels[j+1]=wa*a.color[1]+wb*b.color[1]+wc*c.color[1];pixels[j+2]=wa*a.color[2]+wb*b.color[2]+wc*c.color[2];pixels[j+3]=255;}}
  };
  for(const piece of states){const turning=anim&&piece.pos[cfg.axis]===cfg.layer,chosen=!!selected&&root.PuzzleAxisDisplay?.highlights3D?.()!==false&&options.highlight!==false&&piece.pos[E.configs[selected].axis]===E.configs[selected].layer;const transform=v=>camera(turning?rotate(G.transform(v,piece.columns),cfg.axis,angle):G.transform(v,piece.columns),view);
   const vertices=piece.vertices.map(v=>{const p=transform(v.p),n=transform(v.n),cut=v.material==='cut',base=options.mirrorMode&&!cut?[194,201,216]:rgb(v.color),diffuse=Math.max(0,dot(n,light)),spec=Math.pow(Math.max(0,dot(n,half)),options.mirrorMode?55:42),rim=Math.pow(1-Math.max(0,n[2]),3),brightness=cut?.58+.24*diffuse:.61+.37*diffuse+(chosen?.025:0),shine=cut?0:(options.mirrorMode?.62:.26)*spec,color=base.map((x,j)=>clamp(x*brightness+255*shine+(options.mirrorMode?rim*(j===2?37:23):0),0,255)),q=project(p);bounds[0][0]=Math.min(bounds[0][0],q[0]);bounds[0][1]=Math.min(bounds[0][1],q[1]);bounds[1][0]=Math.max(bounds[1][0],q[0]);bounds[1][1]=Math.max(bounds[1][1],q[1]);return{x:q[0]*resolution,y:q[1]*resolution,z:1/(eye-p[2]),color,p,n};});
   for(const indices of piece.triangles){const a=vertices[indices[0]],b=vertices[indices[1]],c=vertices[indices[2]],nx=a.n[0]+b.n[0]+c.n[0],ny=a.n[1]+b.n[1]+c.n[1],nz=a.n[2]+b.n[2]+c.n[2];if(nx*(-a.p[0]-b.p[0]-c.p[0])+ny*(-a.p[1]-b.p[1]-c.p[1])+nz*(eye*3-a.p[2]-b.p[2]-c.p[2])<0)continue;const v=[a,b,c];if(anim||indices.some(index=>piece.vertices[index].material==='cut'))raster(v,0);else{hitTriangles.push({v,indices,piece});raster(v,hitTriangles.length);}}
  }
  buffer.ctx.putImageData(buffer.image,0,0);ctx.drawImage(buffer.canvas,0,0,w,h);
 }
 const annotated=annotate(ctx,states,{G,E,view,anim,cfg,angle,selected,project,eye,w,h,resolution,rw,rh,buffer,pickAt,canvas:options.canvas});
 if(options.labels!==false){const poles={U:[0,2.40,0],D:[0,-2.31,0],R:[1.35,-.14,0],L:[-1.35,-.14,0],F:[0,-.04,1.86],B:[0,0,-1.18]},hover=root.PuzzleAxisDisplay?.hovered?.();
  const clipper=buffer&&root.PuzzleSelection3D?.createLeaderClipper?.({project,eye,rasterScale:resolution,depthAt:(x,y)=>{const ix=Math.floor(x*resolution),iy=Math.floor(y*resolution);return ix>=0&&ix<rw&&iy>=0&&iy<rh?buffer.depth[iy*rw+ix]:-Infinity;}});
  const candidates=['U','R','F','D','L','B'].map((face,index)=>({id:face,index,world:camera(poles[face],view),p:project(camera(poles[face],view)),front:camera(G.FACE[face],view)[2]>=.04,active:face===selected,hover:face===hover}));
  targets.push(...drawAxisBadges(ctx,candidates,w,h,bounds,clipper));
 }

 root.PuzzleAxisDisplay?.publish3DAxes?.(['U','R','F','D','L','B']);
 return{targets,pieces:states.length,radius:G.radius,annotated};
}
root.HomerRenderer=Object.freeze({render,camera,rotate});if(typeof module!=='undefined'&&module.exports)module.exports=root.HomerRenderer;
})(typeof globalThis!=='undefined'?globalThis:this);
