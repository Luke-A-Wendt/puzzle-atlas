/* Exact back-to-front ordering for convex opaque polygons in camera space.
 * A BSP splits intersecting depth relationships, avoiding centroid-sort errors
 * on turning cube slices. No WebGL or external dependencies.
 */
(function(root) {
  'use strict';
  const EPSILON = 1e-7;
  const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const subtract = (a,b) => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  function planeOf(polygon) {
    let normal = polygon.normal;
    if (!normal) {
      for (let i=1;i<polygon.points.length-1;i++) {
        normal = cross(subtract(polygon.points[i],polygon.points[0]),subtract(polygon.points[i+1],polygon.points[0]));
        if (dot(normal,normal)>EPSILON*EPSILON) break;
      }
    }
    const length = normal ? Math.sqrt(dot(normal,normal)) : 0;
    if (length<EPSILON) return null;
    const n = normal.map(v=>v/length);
    return {n,w:dot(n,polygon.points[0])};
  }
  // Bit flags: zero is coplanar, one front, two back, three spans the plane.
  function classify(polygon,plane) {
    let type=0;
    for (const point of polygon.points) {
      const d=dot(plane.n,point)-plane.w;
      type|=d>EPSILON?1:d<-EPSILON?2:0;
      if(type===3)break;
    }
    return type;
  }
  function clean(points) {
    const result=[];
    const different=(a,b)=>Math.max(Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]),Math.abs(a[2]-b[2]))>EPSILON;
    for(const p of points) if(!result.length||different(p,result[result.length-1]))result.push(p);
    if(result.length>1&&!different(result[0],result[result.length-1]))result.pop();
    return result;
  }
  function split(polygon,plane,front,back,planeCache) {
    const f=[],b=[],points=polygon.points;
    for(let i=0;i<points.length;i++) {
      const p=points[i],q=points[(i+1)%points.length];
      const a=dot(plane.n,p)-plane.w,c=dot(plane.n,q)-plane.w;
      const side=a>EPSILON?1:a<-EPSILON?-1:0;
      const next=c>EPSILON?1:c<-EPSILON?-1:0;
      if(side>=0)f.push(p);
      if(side<=0)b.push(p);
      if(side*next===-1) {
        const t=a/(a-c),point=p.map((v,j)=>v+(q[j]-v)*t);
        f.push(point); b.push(point);
      }
    }
    const ownPlane=planeCache.get(polygon),texturePoints=polygon.texturePoints||polygon.points;
    for(const [points,target]of [[clean(f),front],[clean(b),back]])if(points.length>=3) {
      const fragment=Object.assign({},polygon,{points,texturePoints});
      planeCache.set(fragment,ownPlane); target.push(fragment);
    }
  }
  function choosePlane(polygons,cache) {
    const samples=Math.min(16,polygons.length),seen=new Set();
    let best=null,bestScore=Infinity;
    for(let sample=0;sample<samples;sample++) {
      const index=Math.floor(sample*polygons.length/samples),plane=cache.get(polygons[index]);
      if(!plane)continue;
      // A plane and its negation create the same partition.
      const sign=plane.n.find(v=>Math.abs(v)>EPSILON)<0?-1:1;
      const key=plane.n.concat(plane.w).map(v=>Math.round(v*sign/EPSILON)).join(',');
      if(seen.has(key))continue; seen.add(key);
      let front=0,back=0,spanning=0,coplanar=0;
      for(const polygon of polygons) {
        const type=classify(polygon,plane);
        if(type===1)front++;else if(type===2)back++;else if(type===3)spanning++;else coplanar++;
      }
      const score=spanning*8+Math.abs(front-back)*.2-coplanar*.05;
      if(score<bestScore){best=plane;bestScore=score;}
    }
    return best;
  }
  function order(polygons,eye) {
    eye=eye||[0,0,9.7];
    const cache=new Map(),valid=[];
    for(const polygon of polygons)if(polygon.points&&polygon.points.length>=3) {
      const plane=planeOf(polygon);
      if(plane){valid.push(polygon);cache.set(polygon,plane);}
    }
    const result=[];
    function visit(list) {
      if(!list.length)return;
      if(list.length===1){result.push(list[0]);return;}
      const plane=choosePlane(list,cache),front=[],back=[],same=[];
      if(!plane){result.push(...list);return;}
      for(const polygon of list) {
        const type=classify(polygon,plane);
        if(type===1)front.push(polygon);
        else if(type===2)back.push(polygon);
        else if(type===3)split(polygon,plane,front,back,cache);
        else same.push(polygon);
      }
      // Opaque coplanar surfaces have no geometric depth ordering. Draw body
      // before tile for numerical ties; actual tiles are offset from the body.
      same.sort((a,b)=>Number(!!a.sticker)-Number(!!b.sticker));
      const positive=dot(plane.n,eye)>=plane.w;
      visit(positive?back:front);
      result.push(...same);
      visit(positive?front:back);
    }
    visit(valid);
    return result;
  }
  root.CubeBSP=Object.freeze({order});
  if(typeof module!=='undefined'&&module.exports)module.exports=root.CubeBSP;
})(typeof window!=='undefined'?window:globalThis);
