/* Area-balanced sphere atlas: a fixed Lambert-style radial lens keeps all
 * stickers legible. Plane sections become smooth closed turn loops. The
 * inverse lens retains exact hit testing and clockwise drag semantics. */
(function(root){
'use strict';
const TAU=Math.PI*2,dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),mul=(a,s)=>a.map(x=>x*s),add=(a,b)=>a.map((x,i)=>x+b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>mul(a,1/Math.hypot(...a));
function create({pole=[0,1,0],radius=1,center={x:0,y:0},alpha=.5}={}){
 pole=unit(pole);const u=unit(cross(Math.abs(pole[2])<.9?[0,0,1]:[0,1,0],pole)),v=cross(pole,u);
 const flat=point=>{const p=unit(point),d=Math.max(1e-12,1-dot(p,pole));return{x:dot(p,u)/d,y:-dot(p,v)/d};};
 function project(p){const r=Math.hypot(p.x,p.y),f=r?radius*Math.pow(r*r/(1+r*r),alpha)/r:0;return{x:center.x+p.x*f,y:center.y+p.y*f};}
 function unproject(p){const x=(p.x-center.x)/radius,y=(p.y-center.y)/radius,r=Math.hypot(x,y),t=Math.pow(r,1/alpha),f=r?Math.sqrt(t/Math.max(1e-12,1-t))/r:0;return{x:x*f,y:y*f};}
 const raw=p=>project(flat(p));
 function circle(normal,cut,clockwiseSign=-1){
  const d=cut-dot(normal,pole),nx=dot(normal,u),ny=-dot(normal,v),r0=Math.sqrt(Math.max(0,1-cut*cut)),basis=unit(cross(normal,Math.abs(normal[1])<.9?[0,1,0]:[1,0,0])),other=cross(normal,basis),points=[];
  const pointAt=a=>raw(add(mul(normal,cut),add(mul(basis,r0*Math.cos(a)),mul(other,r0*Math.sin(a)))));
  function segment(a,b,p,q,depth=0){const m=(a+b)/2,c=pointAt(m),error=Math.hypot(c.x-(p.x+q.x)/2,c.y-(p.y+q.y)/2);if(depth<15&&(error>radius*.00015||Math.hypot(q.x-p.x,q.y-p.y)>radius*.08)){segment(a,m,p,c,depth+1);segment(m,b,c,q,depth+1);}else points.push(q);}
  points.push(pointAt(0));for(let i=0;i<24;i++){const a=i*TAU/24,b=(i+1)*TAU/24;segment(a,b,pointAt(a),pointAt(b));}
  // Anchor the label to the fixed loop bounds, never to moving stickers.
  const box=bounds(points),labelCenter={x:(box.x0+box.x1)/2,y:(box.y0+box.y1)/2};
  return{points,labelCenter,curved:true,line:Math.abs(d)<1e-9,nx,ny,offset:cut,cut,cx:nx/d,cy:ny/d,r:r0/Math.abs(d),cwDir:(d<0?1:-1)*(-clockwiseSign)};
 }
 function distance(p,r){let result=Infinity;for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));result=Math.min(result,Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy));}return result;}
 function bounds(points,padding=0){const x0=Math.min(...points.map(p=>p.x))-padding,x1=Math.max(...points.map(p=>p.x))+padding,y0=Math.min(...points.map(p=>p.y))-padding,y1=Math.max(...points.map(p=>p.y))+padding;return{x0,x1,y0,y1,width:x1-x0,height:y1-y0};}
 return{pole,u,v,flat,project,unproject,raw,circle,distance,bounds};
}
root.BalancedRingProjection=Object.freeze({create});if(typeof module!=='undefined'&&module.exports)module.exports=root.BalancedRingProjection;
})(typeof globalThis!=='undefined'?globalThis:this);
