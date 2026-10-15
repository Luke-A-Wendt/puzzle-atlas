/* Sticker-linked 3D annotations. All input geometry is in the renderer's
 * camera space; the original turn and camera transforms remain authoritative. */
(function(root){
'use strict';
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),sub=(a,b)=>a.map((x,i)=>x-b[i]),add=(a,b)=>a.map((x,i)=>x+b[i]),mul=(v,s)=>v.map(x=>x*s);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=v=>{const n=Math.hypot(...v);return n>1e-10?mul(v,1/n):null;};
const finite=v=>Array.isArray(v)&&v.length>=2&&v.every(Number.isFinite);
const center=points=>points.reduce((c,p)=>add(c,mul(p,1/points.length)),[0,0,0]);
// Hit geometry is a view of the renderer's already ordered faces. Project it
// lazily on a pointer event, not on every animation frame. Reverse painter
// order also lets uncolored body fragments occlude hidden stickers correctly.
const pickFrames=new WeakMap();
let hoverCanvas=null,hoverPoint=null,hoverId=null,hoverOverlay=null,hoverContext=null,hoverDrawKey='';
function insidePolygon(x,y,points){
 let inside=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[j],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],crossing=(x-a[0])*dy-(y-a[1])*dx;
  if(Math.abs(crossing)<1e-6&&x>=Math.min(a[0],b[0])-1e-6&&x<=Math.max(a[0],b[0])+1e-6&&y>=Math.min(a[1],b[1])-1e-6&&y<=Math.max(a[1],b[1])+1e-6)return true;
  if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}
function pick(canvas,x,y){
 const frame=canvas&&pickFrames.get(canvas);
 if(!frame||!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>frame.width||y>frame.height)return null;
 if(frame.pickAt){const id=frame.pickAt(x,y);return id==null?null:String(id);}
 if(typeof frame.project!=='function')return null;
 if(!frame.projected){
  frame.projected=frame.faces.map(face=>{
   const points=face.points?.map(frame.project);if(!points||points.length<3||!points.every(finite))return null;
   let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
   for(const p of points){minX=Math.min(minX,p[0]);minY=Math.min(minY,p[1]);maxX=Math.max(maxX,p[0]);maxY=Math.max(maxY,p[1]);}
   const id=face.id??face.stickerId;return{points,minX,minY,maxX,maxY,id:id==null?null:String(id)};
  });
 }
 for(let i=frame.projected.length-1;i>=0;i--){const face=frame.projected[i];if(face&&x>=face.minX&&x<=face.maxX&&y>=face.minY&&y<=face.maxY&&insidePolygon(x,y,face.points))return face.id;}
 return null;
}
function select(canvas,x,y){
 const ui=root.ConstrainedSolverUI,visual=ui?.visualState?.();
 if(root.PUZZLE_SOLVER_BRIDGE?.isBusy?.()||visual?.goalPreview)return false;
 const id=pick(canvas,x,y);if(id==null)return false;
 if(visual?.active||ui?.canSelect3D?.()){
  if(!ui?.canSelect3D?.())return false;
  ui.selectNode(id);clearHover();return true;
 }
 // Cycle the legal axes for this tile's current position. Using the displayed
 // axis as the cursor naturally resets after background clicks or mode changes.
 const axes=[...new Set(root.PUZZLE_SOLVER_BRIDGE?.axesForNode?.(id)||[])];
 if(!axes.length)return false;
 const current=root.PuzzleAxisDisplay?.selection?.(root.PUZZLE_API?.snapshot?.().selected),index=axes.indexOf(current),next=axes[index+1];
 clearHover();
 if(next==null)root.PuzzleAxisDisplay?.clear?.();
 else root.PUZZLE_API?.select?.(next);
 return true;
}
function canHover(){
 const state=root.ConstrainedSolverUI?.visualState?.();if(state?.active||state?.goalPreview)return false;
 if(typeof root.PUZZLE_SOLVER_BRIDGE?.isBusy==='function')return !root.PUZZLE_SOLVER_BRIDGE.isBusy();
 const snapshot=root.PUZZLE_API?.snapshot?.();return !snapshot||(!snapshot.animating&&(!snapshot.mode||snapshot.mode==='idle'));
}
function clearHover(canvas){
 if(canvas&&hoverCanvas!==canvas)return;
 hoverCanvas=null;hoverPoint=null;hoverId=null;hoverDrawKey='';
 if(hoverOverlay){hoverOverlay.hidden=true;hoverOverlay.style.display='none';hoverContext?.clearRect?.(0,0,hoverOverlay.width,hoverOverlay.height);}
}
function drawHover(){
 if(hoverId==null){clearHover();return;}
 const rings=root.document?.getElementById?.('rings'),node=(root.PUZZLE_SOLVER_BRIDGE?.nodes?.()||[]).find(n=>String(n.stickerId)===hoverId);
 if(!rings?.parentElement||!node||!Number.isFinite(node.x)||!Number.isFinite(node.y)){clearHover();return;}
 const bounds=rings.getBoundingClientRect(),dpr=Math.min(root.devicePixelRatio||1,2);
 if(!(bounds.width>0&&bounds.height>0)){clearHover();return;}
 if(!hoverOverlay){
  hoverOverlay=root.document.createElement('canvas');hoverOverlay.id='tileNodeHoverOverlay';hoverOverlay.setAttribute('aria-hidden','true');
  Object.assign(hoverOverlay.style,{position:'absolute',inset:'0',width:'100%',height:'100%',zIndex:'4',pointerEvents:'none',background:'transparent'});
  rings.parentElement.appendChild(hoverOverlay);hoverContext=hoverOverlay.getContext('2d');
 }
 const width=Math.max(1,Math.round(bounds.width*dpr)),height=Math.max(1,Math.round(bounds.height*dpr)),nativeWidth=Number(node.highlightLineWidth)||2.2;
 const r=Math.max(3,Number(node.r)||5,Number(node.highlightOuterRadius)||0)+2.5,lineWidth=Math.max(3.8,nativeWidth*1.7);
 const key=[width,height,hoverId,node.x,node.y,r,lineWidth].join(':');
 hoverOverlay.hidden=false;hoverOverlay.style.display='block';if(key===hoverDrawKey)return;hoverDrawKey=key;
 if(hoverOverlay.width!==width)hoverOverlay.width=width;if(hoverOverlay.height!==height)hoverOverlay.height=height;
 const ctx=hoverContext;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,bounds.width,bounds.height);
 ctx.beginPath();ctx.arc(node.x,node.y,r,0,Math.PI*2);ctx.lineWidth=lineWidth+2;ctx.strokeStyle='rgba(12,13,20,.85)';ctx.stroke();ctx.lineWidth=lineWidth;ctx.strokeStyle='#ffffff';ctx.stroke();
}
function hover(canvas,x,y){
 if(!canHover()){clearHover();return null;}
 hoverCanvas=canvas;hoverPoint={x,y};hoverId=pick(canvas,x,y);drawHover();return hoverId;
}
function publishPickFrame(canvas,frame){
 if(!canvas)return;pickFrames.set(canvas,frame);
 if(hoverCanvas===canvas&&hoverPoint){if(!canHover()){clearHover();return;}hoverId=pick(canvas,hoverPoint.x,hoverPoint.y);drawHover();}
}
root.addEventListener?.('blur',()=>clearHover());
root.addEventListener?.('resize',()=>clearHover());
root.document?.addEventListener?.('visibilitychange',()=>{if(root.document.hidden)clearHover();});
root.document?.addEventListener?.('click',event=>{if(event.target?.closest?.('#ringPanelHide'))clearHover();},true);
// Leaving the canvas for a sibling panel must clear even if a browser retains
// pointer capture or misses its canvas-level pointerleave notification.
root.document?.addEventListener?.('pointermove',event=>{if(hoverCanvas&&event.target!==hoverCanvas)clearHover();},true);
root.document?.addEventListener?.('pointerout',event=>{if(hoverCanvas&&event.target===hoverCanvas&&event.relatedTarget!==hoverCanvas)clearHover();},true);
function inset(points,amount){
 if(points.length<3)return points;
 const c=points.reduce((a,p)=>[a[0]+p[0]/points.length,a[1]+p[1]/points.length],[0,0]);
 return points.map(p=>{const d=Math.hypot(p[0]-c[0],p[1]-c[1]),k=Math.min(amount,d*.18)/(d||1);return[p[0]+(c[0]-p[0])*k,p[1]+(c[1]-p[1])*k];});
}
// A leader is a screen-space annotation in the camera-parallel plane through
// its physical axis pole. Clip its centerline against every nearer surface.
// Convex polyhedral faces use exact interval clipping; Homer supplies its
// existing per-pixel depth field, so curved features occlude the same pixels.
function createLeaderClipper(options={}){
 const project=options.project,eye=options.eye||8;let faces=null;
 const clipLinear=(range,a,b)=>{if(Math.abs(b)<1e-12)return a>=0;if(b>0)range[0]=Math.max(range[0],-a/b);else range[1]=Math.min(range[1],-a/b);return range[0]<range[1]-1e-10;};
 function prepare(){
  if(faces)return faces;faces=[];
  for(const face of options.occluders||[]){
   const points=face.points;if(!points||points.length<3)continue;
   let n=face.normal||unit(cross(sub(points[1],points[0]),sub(points[2],points[0])));if(!n)continue;
   if(dot(n,sub([0,0,eye],points[0]))<0)n=mul(n,-1);
   const screen=points.map(project);if(!screen.every(finite))continue;
   let area=0;for(let i=0;i<screen.length;i++){const a=screen[i],b=screen[(i+1)%screen.length];area+=a[0]*b[1]-b[0]*a[1];}if(Math.abs(area)<1e-9)continue;
   faces.push({point:points[0],normal:n,screen,sign:Math.sign(area),minX:Math.min(...screen.map(p=>p[0])),maxX:Math.max(...screen.map(p=>p[0])),minY:Math.min(...screen.map(p=>p[1])),maxY:Math.max(...screen.map(p=>p[1]))});
  }
  return faces;
 }
 function segments(start,end,padding=.65){
  if(!project||!finite(start)||!finite(end))return[];
  const a=project(start),dx=end[0]-a[0],dy=end[1]-a[1],length=Math.hypot(dx,dy);if(!finite(a)||length<1e-7)return[];
  const at=t=>[a[0]+dx*t,a[1]+dy*t],hidden=[];
  if(options.depthAt){
   const scale=options.rasterScale||1,cuts=[0,1];
   for(const [origin,delta]of [[a[0]*scale,dx*scale],[a[1]*scale,dy*scale]])if(Math.abs(delta)>1e-9){const low=Math.min(origin,origin+delta),high=Math.max(origin,origin+delta);for(let k=Math.ceil(low);k<high;k++){const t=(k-origin)/delta;if(t>0&&t<1)cuts.push(t);}}
   cuts.sort((x,y)=>x-y);const depth=1/(eye-start[2]),nx=-dy/length*padding,ny=dx/length*padding;
   for(let i=1;i<cuts.length;i++){
    const lo=cuts[i-1],hi=cuts[i];if(hi-lo<1e-10)continue;const p=at((lo+hi)/2);
    if([-1,0,1].some(k=>options.depthAt(p[0]+nx*k,p[1]+ny*k)>depth+1e-7))hidden.push([lo,hi]);
   }
  }else{
   const origin=project([0,0,start[2]]),basisX=project([1,0,start[2]]),basisY=project([0,1,start[2]]),xx=basisX[0]-origin[0],xy=basisX[1]-origin[1],yx=basisY[0]-origin[0],yy=basisY[1]-origin[1],det=xx*yy-xy*yx;
   if(Math.abs(det)<1e-10)return[];
   const ex=end[0]-origin[0],ey=end[1]-origin[1],last=[(ex*yy-ey*yx)/det,(ey*xx-ex*xy)/det,start[2]],direction=sub(last,start);
   for(const face of prepare()){
    if(Math.max(a[0],end[0])<face.minX-padding||Math.min(a[0],end[0])>face.maxX+padding||Math.max(a[1],end[1])<face.minY-padding||Math.min(a[1],end[1])>face.maxY+padding)continue;
    const range=[0,1];let inside=true;
    for(let i=0;i<face.screen.length;i++){
     const p=face.screen[i],q=face.screen[(i+1)%face.screen.length],ux=q[0]-p[0],uy=q[1]-p[1];
     if(!clipLinear(range,face.sign*(ux*(a[1]-p[1])-uy*(a[0]-p[0]))+padding*Math.hypot(ux,uy),face.sign*(ux*dy-uy*dx))){inside=false;break;}
    }
    // Camera-facing normal: negative signed distance is behind this plane.
    if(inside&&clipLinear(range,-dot(face.normal,sub(start,face.point))-1e-7,-dot(face.normal,direction)))hidden.push(range);
   }
  }
  hidden.sort((x,y)=>x[0]-y[0]);const visible=[];let cursor=0;
  for(const range of hidden){const lo=Math.max(0,range[0]),hi=Math.min(1,range[1]);if(lo>cursor+1e-9)visible.push([at(cursor),at(lo)]);cursor=Math.max(cursor,hi);if(cursor>=1)break;}
  if(cursor<1-1e-9)visible.push([at(cursor),at(1)]);return visible;
 }
 const draw=(ctx,start,end)=>{const visible=segments(start,end,Math.max(.65,(ctx.lineWidth||1)/2+.15));ctx.beginPath();for(const [a,b]of visible){ctx.moveTo(...a);ctx.lineTo(...b);}if(visible.length)ctx.stroke();return visible;};
 draw.segments=segments;return draw;
}
// An annotation has a linear reciprocal depth along its projected shaft.
// Clip its actual painted area, not its anchor or just its centerline. The
// overlap of a convex face and the nearer-depth half-plane is convex too.
// This leaves a partially hidden shaft, arrowhead or number partially visible.
function createAnnotationClipper(options={}){
 const project=options.project,eye=options.eye||8,w=options.width||500,h=options.height||400;
 let surfaces=null;
 const cut=(polygon,value)=>{const out=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],da=value(a),db=value(b);if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}return out;};
 function prepare(){
  if(surfaces)return surfaces;surfaces=[];
  for(const face of options.occluders||[]){
   const points=face.points||[],screen=points.map(project);if(points.length<3||!screen.every(finite))continue;
   for(let k=2;k<points.length;k++){
    const a=screen[0],b=screen[k-1],c=screen[k],dx=b[0]-a[0],dy=b[1]-a[1],ex=c[0]-a[0],ey=c[1]-a[1],det=dx*ey-dy*ex;if(Math.abs(det)<1e-8)continue;
    const q=1/(eye-points[0][2]),qb=1/(eye-points[k-1][2])-q,qc=1/(eye-points[k][2])-q,gx=(qb*ey-qc*dy)/det,gy=(qc*dx-qb*ex)/det;
    surfaces.push({screen,depth:(x,y)=>q+gx*(x-a[0])+gy*(y-a[1]),minX:Math.min(...screen.map(p=>p[0])),maxX:Math.max(...screen.map(p=>p[0])),minY:Math.min(...screen.map(p=>p[1])),maxY:Math.max(...screen.map(p=>p[1]))});break;
   }
  }return surfaces;
 }
 const unproject=(x,y,z)=>{const o=project([0,0,z]),a=project([1,0,z]),b=project([0,1,z]),xx=a[0]-o[0],xy=a[1]-o[1],yx=b[0]-o[0],yy=b[1]-o[1],d=xx*yy-xy*yx;return[( (x-o[0])*yy-(y-o[1])*yx)/d,((y-o[1])*xx-(x-o[0])*xy)/d,z];};
 function clip(ctx,bounds,depth){
  const left=Math.max(0,Math.floor(bounds[0])),top=Math.max(0,Math.floor(bounds[1])),right=Math.min(w,Math.ceil(bounds[2])),bottom=Math.min(h,Math.ceil(bounds[3]));
  ctx.beginPath();ctx.rect(left,top,Math.max(0,right-left),Math.max(0,bottom-top));ctx.clip();
  if(options.depthAt||options.isVisible){
   // Homer already has a depth raster for its curved surfaces. Restrict work
   // to the two small annotation boxes and merge adjacent visible pixels.
   const scale=options.rasterScale||1,step=1/scale,rows=[];
   for(let y=Math.floor(top*scale)/scale;y<bottom;y+=step){let run=null;
    for(let x=Math.floor(left*scale)/scale;x<right;x+=step){const px=x+step/2,py=y+step/2,q=depth(px,py),visible=q>0&&(options.depthAt?options.depthAt(px,py)<=q+(options.depthTolerance||1e-7):options.isVisible(unproject(px,py,eye-1/q)));
     if(visible&&run===null)run=x;if((!visible||x+step>=right)&&run!==null){rows.push([run,y,(visible?x+step:x)-run,step]);run=null;}
    }
   }ctx.beginPath();for(const row of rows)ctx.rect(...row);ctx.clip();return;
  }
  for(const surface of prepare()){
   if(surface.maxX<left||surface.minX>right||surface.maxY<top||surface.minY>bottom)continue;
   let polygon=surface.screen;
   for(const half of [p=>p[0]-left,p=>right-p[0],p=>p[1]-top,p=>bottom-p[1],p=>surface.depth(...p)-depth(...p)-1e-7]){polygon=cut(polygon,half);if(polygon.length<3)break;}
   if(polygon.length<3)continue;
   ctx.beginPath();ctx.rect(0,0,w,h);polygon.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.clip('evenodd');
  }
 }
 return clip;
}
function begin(ctx,options={}){
 const project=options.project,eye=options.eye||8,radius=Math.max(.1,options.radius||1.8),w=options.width||ctx.canvas?.width||500,h=options.height||ctx.canvas?.height||400;
 const state=options.state||root.ConstrainedSolverUI?.visualState?.()||{active:false,held:[],pair:[]};
 const display=root.PuzzleAxisDisplay,showOutlines=display?.highlights3D?.()!==false,showMarkers=(display?.labelMode?.()||'all')==='all';
 const held=new Set(state.active?(state.held||[]).map(String):[]),labels=new Map();
 if(state.active&&showMarkers)(state.pair||[]).forEach((id,i)=>{if(id!=null&&i<2)labels.set(String(id),String(i+1));});
 let highlighted=null;
 try{const nodes=root.PUZZLE_SOLVER_BRIDGE?.nodes?.();if(nodes?.length)highlighted=new Set(nodes.filter(n=>n.highlighted).map(n=>String(n.stickerId)));}catch(_){}
 const arrows=new Map(),leaderClipper=createLeaderClipper(options),clipAnnotation=createAnnotationClipper({...options,width:w,height:h}),protectedPaths=[];
 const explicitPickFaces=Array.isArray(options.pickFaces),pickFaces=explicitPickFaces?options.pickFaces:[];
 function pickFace(data){if(!explicitPickFaces&&data.points?.length>=3)pickFaces.push({id:data.id??data.stickerId??null,points:data.points});}
 function style(id,selected=false){id=String(id);return{held:showOutlines&&held.has(id),label:labels.get(id)||null,selected:showOutlines&&(highlighted?highlighted.has(id):!!selected),active:!!state.active};}
 function stroke(points,{held=false,selected=false,closed=true,dashOffset=0}={}){
  if(!showOutlines||(!held&&!selected)||points.length<2||!points.every(finite))return;
  const path=vertices=>{ctx.beginPath();vertices.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));if(closed)ctx.closePath();};
  const draw=(vertices,dashed,width)=>{protectedPaths.push({vertices,width:width+2,closed});path(vertices);ctx.setLineDash(dashed?[5.5,4]:[]);ctx.lineDashOffset=dashOffset;ctx.lineWidth=width+2;ctx.strokeStyle='rgba(12,13,20,.78)';ctx.stroke();ctx.lineWidth=width;ctx.strokeStyle='#ffffff';ctx.stroke();};
  ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
  if(held&&selected&&!closed){draw(points,true,6);draw(points,false,2.1);}
  else{
   if(selected)draw(closed?inset(points,held?4.3:1.2):points,false,2.1);
   if(held)draw(closed?inset(points,1.2):points,true,2.4);
  }
  ctx.restore();
 }
 function track(face){
  if(face.id===undefined||face.id===null)return;
  const id=String(face.id),s=style(id,face.selected);if(!s.label)return;
  const points=face.outline||face.points,c=face.center||(points?.length?center(points):null),n=face.normal&&unit(face.normal);
  if(!c||!finite(c)||!n)return;
  // BSP fragments share their original sticker center, normal and identity.
  if(s.label&&!arrows.has(id))arrows.set(id,{id,label:s.label,center:c,normal:n});
 }
 function face(data){
  pickFace(data);
  if(data.id===undefined||data.id===null)return;
  const vertices=data.outline||data.points;if(vertices?.length&&project)stroke(vertices.map(project),style(data.id,data.selected));
  track(data);
 }
 // Projecting a surface normal yields a straight screen-space line, including
 // under perspective. Keep the badge and shortened shaft on that same line.
 function layout(arrow,placed){
  const c=arrow.center,n=arrow.normal,tipWorld=add(c,mul(n,radius*.0005)),tip=project(tipWorld),tailWorld=add(c,mul(n,radius*.28)),nominal=project(tailWorld);
  if(!finite(tip)||!finite(nominal)||tailWorld[2]>=eye-.01)return null;
  const dx=nominal[0]-tip[0],dy=nominal[1]-tip[1],length=Math.hypot(dx,dy),badgeRadius=11.5,gap=5;
  // Preserve the physical projected normal except at its view-aligned pole.
  // A compact upward stem there prevents a disappearing point-sized arrow.
  const ux=length>1?dx/length:0,uy=length>1?dy/length:-1;
  let limit=Infinity;
  for(const [origin,direction,bound] of [[tip[0],ux,w],[tip[1],uy,h]]){
   if(direction>1e-8)limit=Math.min(limit,(bound-badgeRadius-2-origin)/direction);
   else if(direction< -1e-8)limit=Math.min(limit,(badgeRadius+2-origin)/direction);
  }
  const maxStem=Math.max(0,limit-badgeRadius-gap),initial=Math.min(Math.max(18,length),maxStem);
  const badgeAt=stem=>({x:tip[0]+ux*(stem+badgeRadius+gap),y:tip[1]+uy*(stem+badgeRadius+gap)});
  const free=stem=>{const b=badgeAt(stem);if(!placed.every(p=>Math.hypot(b.x-p.x,b.y-p.y)>=badgeRadius*2+3))return false;
   if((display?.axisLabelTargets?.()||[]).some(p=>Math.hypot(b.x-p.x,b.y-p.y)<badgeRadius+(p.r||12)+3))return false;
   for(const path of protectedPaths){const count=path.closed?path.vertices.length:path.vertices.length-1,clearance=badgeRadius+path.width/2+2;
    for(let i=0;i<count;i++){const a=path.vertices[i],c=path.vertices[(i+1)%path.vertices.length];if(b.x<Math.min(a[0],c[0])-clearance||b.x>Math.max(a[0],c[0])+clearance||b.y<Math.min(a[1],c[1])-clearance||b.y>Math.max(a[1],c[1])+clearance)continue;
     const dx=c[0]-a[0],dy=c[1]-a[1],t=Math.max(0,Math.min(1,((b.x-a[0])*dx+(b.y-a[1])*dy)/(dx*dx+dy*dy||1)));if(Math.hypot(b.x-a[0]-t*dx,b.y-a[1]-t*dy)<clearance)return false;
    }
   }return true;};
  let stem=initial;
  if(!free(stem)){let found=false;for(let offset=2;offset<=80&&!found;offset+=2)for(const candidate of [initial+offset,initial-offset])if(candidate>=Math.min(18,maxStem)&&candidate<=maxStem&&free(candidate)){stem=candidate;found=true;break;}}
  const badge=badgeAt(stem),tail=[tip[0]+ux*stem,tip[1]+uy*stem],startDepth=1/(eye-tipWorld[2]),endDepth=1/(eye-tailWorld[2]);
  // A billboarded minimum stem retains the real tip and outer endpoint depth.
  // Elsewhere reciprocal depth is the exact perspective-line interpolation.
  const depth=(x,y)=>startDepth+(endDepth-startDepth)*Math.max(0,Math.min(1,((x-tip[0])*ux+(y-tip[1])*uy)/(stem||1)));
  placed.push(badge);return{tip,tail,badge,ux,uy,length:stem,badgeRadius,depth,badgeDepth:endDepth};
 }
 function protectMarkers(bounds){
  // Existing face boundaries and clickable axis badges stay above the pair.
  for(const {vertices,width,closed}of protectedPaths){
   const count=closed?vertices.length:vertices.length-1;
   for(let i=0;i<count;i++){const a=vertices[i],b=vertices[(i+1)%vertices.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);if(length<1e-6)continue;
    if(Math.max(a[0],b[0])+width<bounds[0]||Math.min(a[0],b[0])-width>bounds[2]||Math.max(a[1],b[1])+width<bounds[1]||Math.min(a[1],b[1])-width>bounds[3])continue;
    const nx=-dy/length*width/2,ny=dx/length*width/2;ctx.beginPath();ctx.rect(0,0,w,h);ctx.moveTo(a[0]+nx,a[1]+ny);ctx.lineTo(b[0]+nx,b[1]+ny);ctx.lineTo(b[0]-nx,b[1]-ny);ctx.lineTo(a[0]-nx,a[1]-ny);ctx.closePath();ctx.clip('evenodd');
   }
  }
  for(const marker of display?.axisLabelTargets?.()||[]){if(!Number.isFinite(marker.x)||!Number.isFinite(marker.y))continue;ctx.beginPath();ctx.rect(0,0,w,h);ctx.moveTo(marker.x+(marker.r||12)+1,marker.y);ctx.arc(marker.x,marker.y,(marker.r||12)+1,0,Math.PI*2);ctx.clip('evenodd');}
 }
 function finish(){
  publishPickFrame(options.canvas||ctx.canvas,{faces:pickFaces,project,pickAt:options.pickAt,width:w,height:h,projected:null});
  if(!project||!arrows.size)return;
  const placed=[];
  for(const arrow of arrows.values()){
   const marker=layout(arrow,placed);if(!marker)continue;
   const {tip,tail,badge,ux,uy,length,badgeRadius,depth,badgeDepth}=marker;
   ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.setLineDash([]);ctx.globalAlpha=1;protectMarkers([Math.min(tip[0],tail[0],badge.x)-14,Math.min(tip[1],tail[1],badge.y)-14,Math.max(tip[0],tail[0],badge.x)+14,Math.max(tip[1],tail[1],badge.y)+14]);
   ctx.save();clipAnnotation(ctx,[Math.min(tip[0],tail[0])-12,Math.min(tip[1],tail[1])-12,Math.max(tip[0],tail[0])+12,Math.max(tip[1],tail[1])+12],depth);
   ctx.beginPath();ctx.moveTo(...tip);ctx.lineTo(...tail);ctx.strokeStyle='rgba(10,11,18,.94)';ctx.lineWidth=7;ctx.stroke();ctx.strokeStyle='#ffffff';ctx.lineWidth=3.8;ctx.stroke();
   if(length>6){const size=Math.min(10,Math.max(5,length*.28)),spread=size*.54;
    ctx.beginPath();ctx.moveTo(...tip);ctx.lineTo(tip[0]+ux*size-uy*spread,tip[1]+uy*size+ux*spread);ctx.lineTo(tip[0]+ux*size+uy*spread,tip[1]+uy*size-ux*spread);ctx.closePath();ctx.strokeStyle='#11121b';ctx.lineWidth=2.2;ctx.stroke();ctx.fillStyle='#ffffff';ctx.fill();
   }else{ctx.beginPath();ctx.arc(tip[0],tip[1],3,0,Math.PI*2);ctx.fillStyle='#ffffff';ctx.fill();}ctx.restore();
   ctx.save();clipAnnotation(ctx,[badge.x-badgeRadius-2,badge.y-badgeRadius-2,badge.x+badgeRadius+2,badge.y+badgeRadius+2],()=>badgeDepth);
   ctx.beginPath();ctx.arc(badge.x,badge.y,badgeRadius,0,Math.PI*2);ctx.fillStyle='#f3f3f5';ctx.fill();ctx.strokeStyle='#101116';ctx.lineWidth=1.8;ctx.stroke();ctx.font='800 15px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#101116';ctx.fillText(arrow.label,badge.x,badge.y+.3);ctx.restore();ctx.restore();
  }
 }
 return{face,track,style,stroke,finish,pickFace,leader:(start,end)=>leaderClipper(ctx,start,end)};
}
root.PuzzleSelection3D=Object.freeze({begin,pick,select,hover,clearHover,createLeaderClipper,createAnnotationClipper,hoveredNode:()=>hoverId});
if(typeof module!=='undefined'&&module.exports)module.exports=root.PuzzleSelection3D;
})(typeof globalThis!=='undefined'?globalThis:this);
