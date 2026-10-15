'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),vm=require('node:vm');
const {createCanvas}=require('@napi-rs/canvas'),{createHarness}=require('./game-harness.cjs');
const Shared=require('../dist/games/puzzle-selection-3d.js');
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function unproject(point,z,project){const o=project([0,0,z]),x=sub(project([1,0,z]),o),y=sub(project([0,1,z]),o),p=sub(point,o),d=x[0]*y[1]-x[1]*y[0];return[(p[0]*y[1]-p[1]*y[0])/d,(p[1]*x[0]-p[0]*x[1])/d,z];}
function occluded(point,eye,faces){
 const origin=[0,0,eye],direction=sub(point,origin);
 for(const face of faces){const points=face.points||[];for(let i=1;i<points.length-1;i++){
  const a=points[0],e1=sub(points[i],a),e2=sub(points[i+1],a),p=cross(direction,e2),det=dot(e1,p);if(Math.abs(det)<1e-10)continue;
  const offset=sub(origin,a),u=dot(offset,p)/det;if(u<0||u>1)continue;const q=cross(offset,e1),v=dot(direction,q)/det;if(v<0||u+v>1)continue;
  const distance=dot(e2,q)/det;if(distance>1e-7&&distance<1-1e-5)return true;
 }}return false;
}
test('native canvas clips the hidden part of a rear leader while retaining its visible tail',()=>{
 const canvas=createCanvas(240,160),ctx=canvas.getContext('2d'),eye=8,project=p=>[100+p[0]*60*eye/(eye-p[2]),80-p[1]*60*eye/(eye-p[2])];
 const occluder={points:[[-.6,-.6,1],[.6,-.6,1],[.6,.6,1],[-.6,.6,1]],normal:[0,0,1]};
 ctx.fillStyle='#444444';ctx.fillRect(0,0,240,160);ctx.strokeStyle='#ffffff';ctx.lineWidth=1;
 const segments=Shared.createLeaderClipper({project,eye,occluders:[occluder]})(ctx,[0,0,-1],[225,80]);
 assert.equal(segments.length,1);assert(segments[0][0][0]>141,'rear line begins beyond the occluding face edge');assert.equal(segments[0][1][0],225,'its outside tail remains connected to the badge');
 const data=ctx.getImageData(0,0,240,160).data;
 for(let x=101;x<140;x++)for(const y of [79,80])assert.equal(data[(y*240+x)*4],68,'no leader pixel is painted through the puzzle');
 assert(data[(80*240+180)*4]>68,'visible outside tail really rasterizes');
});
const manifest=require('../dist/games/constrained-solver-models/manifest.json');
for(const puzzle of Object.keys(manifest.fullSolveCaches).filter(p=>p!=='homer'))test(puzzle+': every drawn axis leader segment passes the physical-surface depth test',()=>{
 const app=createHarness({htmlPath:path.join(__dirname,'../dist/games',puzzle+'.html'),bundled:true}),root=app.context,shared=root.PuzzleSelection3D,records=[];
 root.PuzzleSelection3D={...shared,begin(ctx,options){const painter=shared.begin(ctx,options),leader=painter.leader;return{...painter,leader(start,end){const segments=leader(start,end);records.push({options,start,end,segments});return segments;}};}};
 root.PuzzleAxisDisplay.setLabelMode('all');root.PUZZLE_SOLVER_BRIDGE.requestRender();app.frame(1);
 let visible=0,hidden=0;
 const check=()=>{for(const record of records){const {options,start,end,segments}=record;assert(options.occluders.length,'uses actual rendered body and sticker faces');
  const first=options.project(start);for(const t of [.01,.05,.15,.35,.5,.75]){const point=first.map((v,i)=>v+(end[i]-v)*t);if(occluded(unproject(point,start[2],options.project),options.eye,options.occluders))hidden++;}
  for(const [a,b]of segments)for(const t of [.1,.5,.9]){const point=a.map((v,i)=>v+(b[i]-v)*t),world=unproject(point,start[2],options.project);assert(!occluded(world,options.eye,options.occluders),'visible leader is never behind '+puzzle+' geometry');visible++;}
 }};check();records.length=0;
 const face=app.snapshot().selected;root.PUZZLE_API.move({face,dir:1,turns:1});app.frame(20);if(app.snapshot().animating)check();
 if(!hidden){
  app.complete();root.PuzzleAxisDisplay.setLabelMode('all');const cube=app.elements.get('cube');
  for(let orbit=0;orbit<3&&!hidden;orbit++){records.length=0;cube.dispatch('pointerdown',{clientX:100,clientY:100});cube.dispatch('pointermove',{clientX:250,clientY:130});cube.dispatch('pointerup',{clientX:250,clientY:130});app.frame(1);check();}
 }
 assert(visible>0,'occlusion does not remove all outside tails');assert(hidden>0,'the test covers a leader whose path crosses the puzzle');
});
test('Homer leaders reuse the head depth raster including eyes, nose, rear surfaces and turned pieces',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../dist/games/cube2.html'),'utf8');vm.runInThisContext([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(code=>code.includes('root.CubeEngine =')));
 const geometry=require('../dist/games/homer-geometry.js');const renderer=require('../dist/games/homer-renderer.js'),E=global.CubeEngine,oldDisplay=global.PuzzleAxisDisplay,oldShared=global.PuzzleSelection3D;
 const records=[];global.PuzzleAxisDisplay={labelMode:()=> 'all',highlights3D:()=>false};
 global.PuzzleSelection3D={...Shared,createLeaderClipper(options){const draw=Shared.createLeaderClipper(options);return(ctx,start,end)=>{const segments=draw(ctx,start,end);records.push({options,start,segments});return segments;};}};
 try{
  const canvas=createCanvas(650,680),ctx=canvas.getContext('2d');let samples=0;
  for(const moves of [[],['R','U','F2']]){const stickers=moves.reduce((s,m)=>E.applyMove(s,m),E.makeSolved()),faces=geometry.states(stickers).flatMap(piece=>{const points=piece.vertices.map(v=>renderer.camera(geometry.transform(v.p,piece.columns),{yaw:-.3,pitch:.08}));return piece.triangles.map(indices=>({points:indices.map(i=>points[i])}));});const result=renderer.render(ctx,stickers,{width:650,height:680,view:{yaw:-.3,pitch:.08,zoom:1},selected:null});assert.equal(result.targets.length,6,'all six clickable axis labels remain');
  for(const {options,start,segments}of records.splice(0))for(const [a,b]of segments)for(const t of [.1,.5,.9]){const x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;assert(options.depthAt(x,y)<=1/(options.eye-start[2])+1e-7,'visible leader clears the depth field');assert(!occluded(unproject([x,y],start[2],options.project),options.eye,faces),'independent ray/triangle oracle clears every visible Homer leader segment');samples++;}}assert(samples>0);
 }finally{global.PuzzleAxisDisplay=oldDisplay;global.PuzzleSelection3D=oldShared;}
});
