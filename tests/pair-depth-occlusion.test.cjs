'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {createCanvas}=require('@napi-rs/canvas'),Shared=require('../dist/games/puzzle-selection-3d.js'),{createHarness}=require('./game-harness.cjs');
const eye=8,project=p=>[160+p[0]*100*eye/(eye-p[2]),140-p[1]*100*eye/(eye-p[2])];
const face={points:[[-.6,-.7,0],[.6,-.7,0],[.6,.7,0],[-.6,.7,0]],normal:[0,0,1]};
const color=(ctx,x,y)=>Array.from(ctx.getImageData(x,y,1,1).data);
function blank(){const canvas=createCanvas(360,280),ctx=canvas.getContext('2d');ctx.fillStyle='#34343c';ctx.fillRect(0,0,360,280);return{canvas,ctx};}
test('partial number badges clip their actual painted area against a nearer face',()=>{
 const {ctx}=blank(),clip=Shared.createAnnotationClipper({project,eye,width:360,height:280,occluders:[face]});
 ctx.save();clip(ctx,[204,120,236,160],()=>1/9);ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(220,140,14,0,Math.PI*2);ctx.fill();ctx.restore();
 assert.deepEqual(color(ctx,215,140),[52,52,60,255],'covered half is invisible');assert.deepEqual(color(ctx,226,140),[255,255,255,255],'uncovered half persists');
});
test('a shaft crossing the surface plane clips only the rear interval',()=>{
 const {ctx}=blank(),clip=Shared.createAnnotationClipper({project,eye,width:360,height:280,occluders:[face]});
 ctx.save();clip(ctx,[110,135,210,145],(x,y)=>1/9+(1/7-1/9)*(x-110)/100);ctx.fillStyle='#ffffff';ctx.fillRect(110,135,100,10);ctx.restore();
 assert.deepEqual(color(ctx,125,140),[52,52,60,255]);assert.deepEqual(color(ctx,200,140),[255,255,255,255]);
});
test('curved-surface raster clips partial badges with the same depth values as the puzzle',()=>{
 const {ctx}=blank(),clip=Shared.createAnnotationClipper({project,eye,width:360,height:280,rasterScale:1,depthAt:(x,y)=>x<220?1/8:-Infinity});
 ctx.save();clip(ctx,[204,120,236,160],()=>1/9);ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(220,140,14,0,Math.PI*2);ctx.fill();ctx.restore();
 assert.deepEqual(color(ctx,215,140),[52,52,60,255]);assert.deepEqual(color(ctx,226,140),[255,255,255,255]);
});
test('axis badges remain above pair arrows and numbers',()=>{
 const previous=global.PuzzleAxisDisplay;global.PuzzleAxisDisplay={labelMode:()=> 'all',highlights3D:()=>true,axisLabelTargets:()=>[{x:228,y:140,r:12}]};
 try{const {ctx}=blank();ctx.fillStyle='#454599';ctx.beginPath();ctx.arc(228,140,12,0,Math.PI*2);ctx.fill();const before=ctx.getImageData(217,136,21,8).data;
  const p=Shared.begin(ctx,{project,eye,width:360,height:280,radius:1,state:{active:true,pair:['one']}});p.track({id:'one',center:[.3,0,0],normal:[1,0,0]});p.finish();assert.deepEqual(ctx.getImageData(217,136,21,8).data,before);
 }finally{global.PuzzleAxisDisplay=previous;}
});
const manifest=require('../dist/games/constrained-solver-models/manifest.json');
for(const puzzle of Object.keys(manifest.fullSolveCaches).filter(id=>id!=='homer'))test(puzzle+': native renderer supports More-label automatic pairs before, during and after a turn',()=>{
 const native=createCanvas(400,360),rings=createCanvas(400,360),app=createHarness({htmlPath:path.join(__dirname,'../dist/games',puzzle+'.html'),bundled:true,canvasContexts:{cube:native.getContext('2d'),rings:rings.getContext('2d')},dimensions:{cube:{width:400,height:360},rings:{width:400,height:360}},speed:5}),root=app.context;
 const base=root.PuzzleSelection3D,ids=root.PUZZLE_SOLVER_BRIDGE.nodes().map(n=>String(n.stickerId));let frameOptions=[],tracked=0;
 root.PuzzleSelection3D={...base,begin(ctx,options){frameOptions.push(options);const paint=base.begin(ctx,{...options,state:{active:true,auto:true,held:[],pair:ids.slice(0,2)}});return{...paint,track(face){if(ids.slice(0,2).includes(String(face.id)))tracked++;paint.track(face);}};}};
 root.PuzzleAxisDisplay.setLabelMode('all');root.PUZZLE_SOLVER_BRIDGE.requestRender();app.frame(1);assert(tracked>=2,'both physical anchors are present independent of facing direction');
 const move=app.snapshot().selected||root.PUZZLE_SOLVER_BRIDGE.axesForNode(ids[0])[0];root.PUZZLE_API.move({face:move,dir:1,turns:1});app.frame(40);app.complete();
 assert(frameOptions.length>=3);for(const options of frameOptions)assert(options.occluders?.length||options.depthAt,'actual rendered depth geometry is supplied');
 assert(native.getContext('2d').getImageData(0,0,400,360).data.some((value,i)=>i%4===3&&value>0),'native frame is painted');
});


test('Homer pair arrows use the native curved depth raster through turns and all camera angles',()=>{
 const vm=require('node:vm'),html=fs.readFileSync(path.join(__dirname,'../dist/games/cube2.html'),'utf8');vm.runInThisContext([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(code=>code.includes('root.CubeEngine =')));
 const G=require('../dist/games/homer-geometry.js'),R=require('../dist/games/homer-renderer.js'),E=global.CubeEngine,oldDisplay=global.PuzzleAxisDisplay,oldShared=global.PuzzleSelection3D;
 let anchors=0,rasters=0;global.PuzzleAxisDisplay={labelMode:()=> 'all',highlights3D:()=>true};
 global.PuzzleSelection3D={...Shared,begin(ctx,options){assert.equal(typeof options.depthAt,'function');rasters++;const state={active:true,auto:true,held:[],pair:E.makeSolved().slice(0,2).map(s=>String(s.id))},p=Shared.begin(ctx,{...options,state});return{...p,track(face){anchors++;p.track(face);}};}};
 try{const canvas=createCanvas(400,360),ctx=canvas.getContext('2d');for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5])for(const progress of [0,.5,1])R.render(ctx,E.makeSolved(),{width:400,height:360,view:{yaw,pitch:.1,zoom:1},selected:'R',animation:{move:{face:'R',dir:1,turns:1},progress}});assert.equal(rasters,12);assert(anchors>=24*12);}
 finally{global.PuzzleAxisDisplay=oldDisplay;global.PuzzleSelection3D=oldShared;}
});
