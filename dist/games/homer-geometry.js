/* A sculpted eight-piece head: every surface and detail is clipped by the same
 * three cube cut planes. Piece transforms come from the exact 2×2 sticker state. */
(function(root){
'use strict';
const EPS=1e-8,GAP=.014;
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>mul(a,1/Math.hypot(...a));
const FACE={U:[0,1,0],D:[0,-1,0],R:[1,0,0],L:[-1,0,0],F:[0,0,1],B:[0,0,-1]};
const COLOR={skin:'#f4cd42',muzzle:'#b5a58a',eye:'#fffef8',pupil:'#20252e',hair:'#242326',collar:'#f5f1e7',ear:'#c69b2e',cut:'#29252b'};
function triangle(a,b,c,color,material){const normal=unit(cross(sub(b.p,a.p),sub(c.p,a.p)));if(!Number.isFinite(normal[0]))return null;return{vertices:[a,b,c],color,material};}
function ellipsoid(center,radius,color,nu=32,nv=20,material='plastic'){
 const polys=[],point=(u,v)=>{const q=[Math.sin(v)*Math.cos(u),Math.cos(v),Math.sin(v)*Math.sin(u)];return{p:add(center,q.map((x,i)=>x*radius[i])),n:unit(q.map((x,i)=>x/radius[i]))};};
 for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const u=i/nu*2*Math.PI,u2=(i+1)/nu*2*Math.PI,v=j/nv*Math.PI,v2=(j+1)/nv*Math.PI,a=point(u,v),b=point(u2,v),c=point(u2,v2),d=point(u,v2);for(const t of [[a,c,b],[a,d,c]]){const f=triangle(...t,color,material);if(f)polys.push(f);}}
 return polys;
}
function tube(points,radius,color,segments=6){
 const rings=points.map((p,i)=>{const before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)],axis=unit(sub(after,before)),basis=unit(cross(axis,Math.abs(axis[1])<.9?[0,1,0]:[1,0,0])),basis2=cross(axis,basis);return Array.from({length:segments},(_,j)=>{const n=add(mul(basis,Math.cos(j/segments*2*Math.PI)),mul(basis2,Math.sin(j/segments*2*Math.PI)));return{p:add(p,mul(n,radius)),n};});}),polys=[];
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<segments;j++){const a=rings[i][j],b=rings[i][(j+1)%segments],c=rings[i+1][(j+1)%segments],d=rings[i+1][j];polys.push(triangle(a,b,c,color,'detail'),triangle(a,c,d,color,'detail'));}
 for(const [i,n]of [[0,unit(sub(points[0],points[1]))],[rings.length-1,unit(sub(points.at(-1),points.at(-2)))]])polys.push({vertices:rings[i].map(v=>({p:v.p,n})),color,material:'detail'});
 return[polys.filter(Boolean)];
}
function hull(points,axis){const axes=[0,1,2].filter(a=>a!==axis),key=p=>p.map(v=>Math.round(v*1e7)).join(','),unique=[...new Map(points.map(p=>[key(p),p])).values()].sort((a,b)=>a[axes[0]]-b[axes[0]]||a[axes[1]]-b[axes[1]]);if(unique.length<3)return[];const turn=(a,b,c)=>(b[axes[0]]-a[axes[0]])*(c[axes[1]]-a[axes[1]])-(b[axes[1]]-a[axes[1]])*(c[axes[0]]-a[axes[0]]);let lower=[],upper=[];for(const p of unique){while(lower.length>1&&turn(lower.at(-2),lower.at(-1),p)<=EPS)lower.pop();lower.push(p);}for(const p of unique.slice().reverse()){while(upper.length>1&&turn(upper.at(-2),upper.at(-1),p)<=EPS)upper.pop();upper.push(p);}return lower.slice(0,-1).concat(upper.slice(0,-1));}
function clip(polys,axis,sign){const out=[],cuts=[];for(const face of polys){const v=face.vertices,result=[];for(let i=0;i<v.length;i++){const a=v[i],b=v[(i+1)%v.length],da=a.p[axis]*sign-GAP,db=b.p[axis]*sign-GAP;if(da>=-EPS)result.push(a);if((da>EPS&&db<-EPS)||(da<-EPS&&db>EPS)){const t=da/(da-db),p=add(a.p,mul(sub(b.p,a.p),t)),n=unit(add(a.n,mul(sub(b.n,a.n),t)));result.push({p,n});cuts.push(p);}}if(result.length>=3)out.push({...face,vertices:result});}
 const points=hull(cuts,axis);if(points.length>=3){const n=[0,0,0];n[axis]=-sign;const current=cross(sub(points[1],points[0]),sub(points[2],points[0]));if(dot(current,n)<0)points.reverse();out.push({vertices:points.map(p=>({p,n})),color:COLOR.cut,material:'cut'});}return out;
}
function makeParts(){const p=[],e=(c,r,color,nu=32,nv=20)=>p.push(ellipsoid(c,r,color,Math.max(12,Math.round(nu*.7)),Math.max(10,Math.round(nv*.7))));
 // Dome and neck overlap internally, forming the familiar long bald head.
 e([0,.40,-.16],[.99,1.76,.86],COLOR.skin,44,30);
 e([0,-1.24,-.18],[.69,.91,.63],COLOR.skin,32,24);
 // Large whites sit proud of the forehead; black pupils are physical inlays.
 for(const x of [-.405,.405]){e([x,.77,.70],[.425,.46,.405],COLOR.eye,30,20);e([x,.755,1.101],[.092,.116,.035],COLOR.pupil,18,12);}
 // Broad moustache-free muzzle, softly rounded upper/lower lips, long nose.
 e([0,-.51,.66],[.705,.655,.645],COLOR.muzzle,38,24);
 e([0,.385,1.01],[.245,.263,.70],COLOR.skin,34,22);
 // Smile follows the front surface of the muzzle, with raised corner dimples.
 const smile=[];for(let i=0;i<=18;i++){const x=-.54+i/18*1.08,y=-.76+.24*(x/.54)**2,z=.66+.645*Math.sqrt(1-(x/.705)**2-((y+.51)/.655)**2)+.012;smile.push([x,y,z]);}p.push(...tube(smile,.019,COLOR.hair));
 for(const sign of [-1,1]){e([sign*.97,-.09,-.07],[.245,.31,.235],COLOR.skin,24,16);e([sign*1.09,-.08,.125],[.11,.167,.033],COLOR.ear,18,12);
  // Three short zig-zag hairs wrap each temple.
  const hair=[[sign*.917,.47,.105],[sign*.985,.16,.145],[sign*.966,.30,.245],[sign*.96,-.005,.25]];p.push(...tube(hair,.025,COLOR.hair));}
 // Two curved hairs lying on top of the dome.
 for(const x of [-.17,.17]){const hair=[];for(let i=0;i<=18;i++){const z=-.29+i/18*.57,y=.40+1.76*Math.sqrt(Math.max(0,1-(x/.99)**2-((z+.16)/.86)**2))+.017;hair.push([x,y,z]);}p.push(...tube(hair,.024,COLOR.hair));}
 // Smooth white shirt collar as a separate closed frustum around the neck.
 const collar=[],n=44,y0=-2.03,y1=-1.79;for(let i=0;i<n;i++){const a=i/n*2*Math.PI,b=(i+1)/n*2*Math.PI,ring=(angle,y,r)=>({p:[Math.cos(angle)*r,y,-.18+Math.sin(angle)*r*.83],n:unit([Math.cos(angle),.16,Math.sin(angle)/.83])}),v=[ring(a,y0,.75),ring(b,y0,.75),ring(b,y1,.64),ring(a,y1,.64)];collar.push({vertices:v,color:COLOR.collar,material:'plastic'});}for(const [y,r,sy]of [[y0,.75,-1],[y1,.64,1]]){const vertices=[];for(let i=0;i<n;i++){const a=(sy>0?n-i:i)/n*2*Math.PI;vertices.push({p:[Math.cos(a)*r,y,-.18+Math.sin(a)*r*.83],n:[0,sy,0]});}collar.push({vertices,color:COLOR.collar,material:'plastic'});}p.push(collar);
 return p;
}
let cache;
function basePieces(){if(cache)return cache;const parts=makeParts();cache=[];for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){const home=[x,y,z],faces=[];for(const part of parts){let clipped=part;for(let axis=0;axis<3&&clipped.length;axis++)clipped=clip(clipped,axis,home[axis]);for(const f of clipped)for(let i=1;i<f.vertices.length-1;i++)faces.push({...f,vertices:[f.vertices[0],f.vertices[i],f.vertices[i+1]]});}const pool=new Map(),vertices=[],triangles=[];for(const face of faces){const indices=face.vertices.map(v=>{const key=v.p.concat(v.n).map(n=>Math.round(n*1e7)).join(',')+'|'+face.color+'|'+face.material;if(!pool.has(key)){pool.set(key,vertices.length);vertices.push({...v,color:face.color,material:face.material});}return pool.get(key);});triangles.push(indices);}cache.push({id:home.join(','),home,faces,vertices,triangles});}return cache;}
function states(stickers){const solved=root.CubeEngine.makeSolved(),homeById=new Map(solved.map(s=>[s.id,s])),groups=new Map();for(const s of stickers){const h=homeById.get(s.id);if(!h)throw new Error('Homer needs the 2×2 corner sticker state');const id=h.p.join(',');if(!groups.has(id))groups.set(id,{id,home:h.p,pos:s.p,columns:[null,null,null]});const axis=h.n.findIndex(n=>n!==0);groups.get(id).columns[axis]=mul(s.n,h.n[axis]);}return basePieces().map(base=>({...base,...groups.get(base.id)}));}
// Homer has no painted cube stickers. Divide each sculpted corner into three
// directional surface regions for its three *distinct* logical stickers. The
// partition is fixed in the piece's home coordinates, never in camera space.
// These are annotation regions only: the head mesh and mechanism are unchanged.
const REGION_SCALE=[1.1,2.1,1.25],regionCache=new Map();
function clipRegion(vertices,normal){const out=[];for(let i=0;i<vertices.length;i++){const a=vertices[i],b=vertices[(i+1)%vertices.length],da=dot(a.p,normal),db=dot(b.p,normal);if(da>=-EPS)out.push(a);if((da>EPS&&db<-EPS)||(da<-EPS&&db>EPS)){const t=da/(da-db);out.push({p:add(a.p,mul(sub(b.p,a.p),t)),n:unit(add(a.n,mul(sub(b.n,a.n),t)))});}}return out;}
function surfaceHit(direction,triangles){let best=null;for(const vertices of triangles){const[a,b,c]=vertices,e1=sub(b.p,a.p),e2=sub(c.p,a.p),p=cross(direction,e2),det=dot(e1,p);if(Math.abs(det)<EPS)continue;const inv=1/det,tvec=mul(a.p,-1),u=dot(tvec,p)*inv,q=cross(tvec,e1),v=dot(direction,q)*inv,t=dot(e2,q)*inv;if(u<-.000001||v<-.000001||u+v>1.000001||t<=0||best&&t<=best.t)continue;best={t,p:mul(direction,t),n:unit(add(add(mul(a.n,1-u-v),mul(b.n,u)),mul(c.n,v)))};}return best;}
function boundaryPaths(polygons){const key=v=>v.p.map(x=>Math.round(x*1e6)).join(','),edges=new Map();for(const vertices of polygons)for(let i=0;i<vertices.length;i++){const a=vertices[i],b=vertices[(i+1)%vertices.length],ka=key(a),kb=key(b);if(ka===kb)continue;const k=ka<kb?ka+'|'+kb:kb+'|'+ka;if(edges.has(k))edges.get(k).count++;else edges.set(k,{a,b,ka,kb,count:1});}const remaining=[...edges.values()].filter(e=>e.count===1),adj=new Map();for(let i=0;i<remaining.length;i++)for(const k of [remaining[i].ka,remaining[i].kb]){if(!adj.has(k))adj.set(k,[]);adj.get(k).push(i);}const used=new Set(),paths=[];for(let i=0;i<remaining.length;i++){if(used.has(i))continue;const start=remaining[i],path=[start.a,start.b];used.add(i);let k=start.kb;while(k!==start.ka){const next=(adj.get(k)||[]).find(j=>!used.has(j));if(next===undefined)break;used.add(next);const edge=remaining[next],v=edge.ka===k?edge.b:edge.a;path.push(v);k=edge.ka===k?edge.kb:edge.ka;}if(path.length>1)paths.push(path);}return paths;}
function selectionRegions(piece){if(regionCache.has(piece.id))return regionCache.get(piece.id);const home=piece.home,stickers=root.CubeEngine.makeSolved().filter(s=>s.p.every((v,i)=>v===home[i])),regions=[];for(let axis=0;axis<3;axis++){const polygons=[];for(const face of piece.faces){if(face.material==='cut')continue;let vertices=face.vertices;for(let other=0;other<3&&vertices.length>=3;other++)if(other!==axis){const normal=[0,0,0];normal[axis]=home[axis]/REGION_SCALE[axis];normal[other]=-home[other]/REGION_SCALE[other];vertices=clipRegion(vertices,normal);}if(vertices.length>=3)polygons.push(vertices);}const triangles=polygons.flatMap(poly=>poly.slice(1,-1).map((_,i)=>[poly[0],poly[i+1],poly[i+2]])),direction=unit(home.map((sign,i)=>sign*REGION_SCALE[i]*(i===axis?1:.42)));let anchor=surfaceHit(direction,triangles);if(!anchor){const face=triangles.reduce((best,t)=>!best||dot(t[0].p,direction)>dot(best[0].p,direction)?t:best,null);if(face)anchor={p:mul(face.reduce((v,q)=>add(v,q.p),[0,0,0]),1/3),n:unit(face.reduce((v,q)=>add(v,q.n),[0,0,0]))};}const sticker=stickers.find(s=>s.n[axis]===home[axis]);if(anchor&&sticker)regions.push({id:String(sticker.id),axis,center:anchor.p,normal:anchor.n,paths:boundaryPaths(polygons)});}regionCache.set(piece.id,regions);return regions;}
// Resolve a rendered surface hit with the same directional partition used by
// dashed held-region borders. The point is in this physical piece's home frame.
function selectionRegionAt(piece,point){let axis=0,score=-Infinity;for(let i=0;i<3;i++){const value=point[i]*piece.home[i]/REGION_SCALE[i];if(value>score){axis=i;score=value;}}return selectionRegions(piece).find(region=>region.axis===axis)?.id||null;}
const transform=(v,columns)=>[0,1,2].map(i=>columns[0][i]*v[0]+columns[1][i]*v[1]+columns[2][i]*v[2]);
// The dimensions and sculpted details distinguish every slot and corner twist,
// including without color. The geometry test checks all 8 × 24 placements:
// only each original orientation fits its solved slot. Cube completion therefore
// exactly describes head completion in either mode and allows all 24 whole-head
// orientations, with no invisible color-only conditions.
function isSolved(stickers){return root.CubeEngine.isSolved(stickers);}
root.HomerGeometry=Object.freeze({basePieces,states,selectionRegions,selectionRegionAt,transform,isSolved,FACE,COLOR,GAP,radius:2.28});if(typeof module!=='undefined'&&module.exports)module.exports=root.HomerGeometry;
})(typeof globalThis!=='undefined'?globalThis:this);
