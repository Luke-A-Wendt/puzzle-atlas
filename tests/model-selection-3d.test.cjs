'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {createHarness}=require('./game-harness.cjs');

const models=[
 ['shape','cornerocta'],['shape','flatdiamond'],['shape','trajber'],['shape','mastermorphix'],
 ['shape','rhombic'],['shape','diamondstyle'],['shape','diamondcube'],['shape','jewel'],['shape','pyramorphix'],
 ['shape','ghost'],['dino','dino'],['dino','rainbow'],['masterpyraminx','masterpyraminx'],
 ['kilominx','kilominx'],['crystal','crystal'],['helicopter','helicopter'],
 ['skewb','ultimate'],['skewb','masterskewb'],['skewb','skewb'],['skewb','jing'],['skewb','diamond'],['fto','fto']
];
const engineNames={shape:'ShapeEngine',dino:'DinoEngine',masterpyraminx:'MasterPyraminxEngine',kilominx:'KilominxEngine',crystal:'CrystalEngine',helicopter:'HelicopterEngine',skewb:'SkewbEngine',fto:'FTOEngine'};
const mean=points=>points.reduce((sum,p)=>sum.map((n,i)=>n+p[i]/points.length),[0,0,0]);
const close=(a,b,label)=>assert(Math.hypot(...a.map((v,i)=>v-b[i]))<1e-7,label);

for(const [family,type]of models)test(type+': physical sticker markers retain identity, full-face centers, clipping and animated endpoints',()=>{
 const app=createHarness({htmlPath:path.join(__dirname,'../dist/games',type+'.html'),bundled:true,speed:5});
 const engine=app.context[engineNames[family]],model=engine.create(type);
 const renderer=app.context[family==='skewb'||family==='fto'?'SkewbRenderer':family==='helicopter'?'HelicopterRenderer':'ShapeRenderer'];
 const camera=(app.context.ShapeRenderer||app.context.SkewbRenderer).camera;
 const ringIds=new Set(app.context.PUZZLE_SOLVER_BRIDGE.nodes().map(n=>String(n.stickerId)));
 const stickerIds=new Set(model.stickerState.map(s=>String(s.id)));
 assert.deepEqual(ringIds,stickerIds,'ring nodes and real physical stickers use identical identities');
 const ctx=app.elements.get('cube').getContext('2d');let clipDepth=0,depth=0,active=null;
 const stack=[];ctx.save=()=>{stack.push(clipDepth);depth++;};ctx.clip=()=>{clipDepth++;};ctx.restore=()=>{clipDepth=stack.pop();depth--;};
 app.context.PuzzleSelection3D={begin(_ctx,config){
  assert.equal(_ctx,ctx);assert(config.occluders.some(f=>!f.sticker),'opaque body polygons participate in arrow occlusion');
  assert(config.eye>config.radius);assert.equal(config.width,560);assert.equal(config.height,520);
  active={config,faces:[],finished:false};
  return{face(f){
   assert(depth>0&&clipDepth>0,'annotation stays within the existing BSP fragment clip');
   assert(stickerIds.has(String(f.id)),'only a genuine sticker can have a marker: '+f.id);
   assert(f.outline.length>=3);assert(f.points.length>=3);
   close(f.center,mean(f.outline),'marker center stays on the original entire face');
   assert(Math.abs(Math.hypot(...f.normal)-1)<1e-6,'outward normal is unit length');
   for(const p of [f.center,f.normal,...f.points,...f.outline])assert(p.every(Number.isFinite));
   active.faces.push(f);
  },finish(){assert.equal(depth,0);assert.equal(clipDepth,0);active.finished=true;}};
 }};
 const move={face:model.configs[0].id,dir:1,turns:1};
 const render=(view,animation)=>{renderer.render(ctx,model,{width:560,height:520,selected:move.face,view,labels:false,animation});assert(active.finished);assert(active.faces.length);return active;};
 const views=Array.from({length:8},(_,i)=>({yaw:Math.floor(i/2)*Math.PI/2+.2,pitch:i%2?.65:-.65,zoom:1}));
 const seen=new Set();const chosen=new Set(model.movingPieces(move.face));
 for(const view of views){const frame=render(view);for(const f of frame.faces){seen.add(String(f.id));const piece=model.stickerState.find(s=>String(s.id)===String(f.id)).piece;assert.equal(f.selected,chosen.has(piece),'3D ring selection matches the legal moving piece set');}}
 assert.deepEqual(seen,stickerIds,'camera orbit exposes the exact marker for every ring node');
 const view=views[1];
 const halfway=render(view,{move,progress:.5});
 // Repeated BSP fragments must point at one physical face, never fragment centers.
 const unique=new Map();for(const f of halfway.faces){const old=unique.get(String(f.id));if(old){close(old.center,f.center,'BSP fragments agree on the arrow center');close(old.normal,f.normal,'BSP fragments agree on the outward normal');}unique.set(String(f.id),f);}
 const finalFrames=views.map(view=>render(view,{move,progress:1}));
 model.applyMove(move);
 for(let i=0;i<views.length;i++){
  const after=new Map(render(views[i]).faces.map(f=>[String(f.id),f]));
  for(const f of finalFrames[i].faces){const next=after.get(String(f.id));assert(next,'the animated final sticker remains visible after committing its turn');close(f.center,next.center,'physical marker center has no end-of-move jump');close(f.normal,next.normal,'physical marker normal has no end-of-move jump');}
 }
 // Camera-space centers correspond to the live mesh, including Ghost's solved
 // docking offsets and Helicopter's additional opaque, non-sticker core.
 const frame=render(view),meshFaces=new Map(model.pieces.flatMap(piece=>(model.renderMesh?model.renderMesh(piece,null):model.mesh(piece)).stickers).map(face=>[String(face.id),face]));
 for(const f of frame.faces)close(f.center,camera(mean(meshFaces.get(String(f.id)).vertices||meshFaces.get(String(f.id)).points),view),'marker follows the transformed physical tile');
});
