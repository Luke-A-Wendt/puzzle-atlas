'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createCanvas}=require('@napi-rs/canvas');
const html=fs.readFileSync(require.resolve('../dist/games/cube2.html'),'utf8');
vm.runInThisContext([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(x=>x.includes('root.CubeEngine =')));
const E=globalThis.CubeEngine,G=require('../dist/games/homer-geometry.js'),S=require('../dist/games/puzzle-selection-3d.js'),R=require('../dist/games/homer-renderer.js');
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function rayOracle(stickers,view,w,h){
 const eye=9,scale=Math.min(w*.35/1.5,h*.414/2.16),origin=[0,0,eye],cy=h*.51;
 const project=p=>[w/2+p[0]*scale*eye/(eye-p[2]),cy-p[1]*scale*eye/(eye-p[2])],triangles=[];
 for(const piece of G.states(stickers)){
  const vertices=piece.vertices.map(v=>({...v,p:R.camera(G.transform(v.p,piece.columns),view),n:R.camera(G.transform(v.n,piece.columns),view)}));
  for(const indices of piece.triangles){
   const v=indices.map(i=>vertices[i]),n=[0,1,2].map(i=>v.reduce((sum,q)=>sum+q.n[i],0)),center=[0,1,2].map(i=>v.reduce((sum,q)=>sum+q.p[i]/3,0));if(dot(n,sub(origin,center))<0)continue;
   const points=v.map(q=>project(q.p)),a=v[0].p,e1=sub(v[1].p,a),e2=sub(v[2].p,a);
   triangles.push({piece,indices,a,e1,e2,cut:indices.some(i=>piece.vertices[i].material==='cut'),bounds:[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]});
  }
 }
 return(x,y)=>{
  const direction=[(x-w/2)/scale,(cy-y)/scale,-eye];let closest=null;
  for(const triangle of triangles){const [minX,minY,maxX,maxY]=triangle.bounds;if(x<minX||x>maxX||y<minY||y>maxY)continue;
   const p=cross(direction,triangle.e2),det=dot(triangle.e1,p);if(Math.abs(det)<1e-10)continue;const d=sub(origin,triangle.a),u=dot(d,p)/det;if(u<0||u>1)continue;const q=cross(d,triangle.e1),v=dot(direction,q)/det;if(v<0||u+v>1)continue;const t=dot(triangle.e2,q)/det;if(t<=0||closest&&t>=closest.t)continue;
   const home=[0,1,2].map(i=>(1-u-v)*triangle.piece.vertices[triangle.indices[0]].p[i]+u*triangle.piece.vertices[triangle.indices[1]].p[i]+v*triangle.piece.vertices[triangle.indices[2]].p[i]);closest={t,cut:triangle.cut,id:triangle.cut?null:G.selectionRegionAt(triangle.piece,home)};
  }
  return closest;
 };
}
test('Homer pixel picking agrees with independent closest-surface ray tests, including eyes, cut faces and empty space',()=>{
 const w=500,h=560,canvas=createCanvas(w,h),ctx=canvas.getContext('2d'),solved=E.makeSolved(),turned=['R','U','F2'].reduce((state,move)=>E.applyMove(state,move),solved);let surfaceChecks=0,bodyChecks=0,emptyChecks=0;
 for(const [stickers,view]of [[solved,{yaw:0,pitch:0,zoom:1}],[solved,{yaw:-.6,pitch:.3,zoom:1}],[turned,{yaw:-.3,pitch:.08,zoom:1}],[turned,{yaw:1.8,pitch:-.25,zoom:1}]]){
  R.render(ctx,stickers,{width:w,height:h,view,labels:false,selected:null});const expected=rayOracle(stickers,view,w,h);
  for(let y=20;y<h;y+=31)for(let x=20;x<w;x+=29){const hit=expected(x+.5,y+.5),actual=S.pick(canvas,x+.5,y+.5);assert.equal(actual,hit?.id||null,'pixel '+x+','+y+' must select only the frontmost physical region');if(!hit)emptyChecks++;else if(hit.cut)bodyChecks++;else surfaceChecks++;}
  assert.equal(S.pick(canvas,1,1),null);
 }
 assert(surfaceChecks>100,'test includes visible eye, nose, hair and head regions');assert(bodyChecks>10,'exposed cut faces block picking surfaces behind them');assert(emptyChecks>100,'background pixels have no tile owner');
});
