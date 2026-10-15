'use strict';
// Build-time only. Use the real solved puzzle geometry and original face colors;
// only the camera changes. The website downloads pre-rendered local previews.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const base=path.resolve(__dirname,'../dist'),assets=path.join(base,'assets');
require(path.join(base,'games/shape-bsp.js'));
const shapeRenderer=require(path.join(base,'games/shape-renderer.js'));
const skewbRenderer=require(path.join(base,'games/skewb-renderer.js'));
const ghostRenderer=require(path.join(base,'games/ghost-renderer.js'));
const rgb=color=>/^#[0-9a-f]{6}$/i.test(color||'')?[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)):null;
function colorFamily(color){
 const c=rgb(color);if(!c)return null;const [r,g,b]=c;
 if(Math.min(...c)>175&&Math.max(...c)-Math.min(...c)<70)return'white';
 if(r>g*1.35&&r>b*1.1&&g<180)return'red';
 if(g>r*1.25&&g>b*1.12)return'green';
 return null;
}
function camera(v,yaw,pitch){const [x,y,z]=v,c=Math.cos(yaw),s=Math.sin(yaw),xx=c*x+s*z,zz=-s*x+c*z;return[xx,Math.cos(pitch)*y-Math.sin(pitch)*zz,Math.sin(pitch)*y+Math.cos(pitch)*zz];}
function area(face){const p=face.points||face.vertices;if(!p?.length)return 1;let sum=0;for(let i=1;i<p.length-1;i++){const a=p[i].map((v,j)=>v-p[0][j]),b=p[i+1].map((v,j)=>v-p[0][j]);sum+=Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])/2;}return sum;}
function chooseView(faces,zoom=1.13){
 // Prefer the actual primary face color, rather than mistaking a neighboring
 // orange, lime or dark crimson face for red or green on 12/14-color puzzles.
 const targets={white:[244,242,232],green:[54,191,133],red:[239,72,89]},chosen={};
 for(const [family,target]of Object.entries(targets)){
  const candidates=[...new Set(faces.map(f=>f.color))].filter(color=>colorFamily(color)===family);
  candidates.sort((a,b)=>rgb(a).reduce((s,v,i)=>s+(v-target[i])**2,0)-rgb(b).reduce((s,v,i)=>s+(v-target[i])**2,0));chosen[family]=candidates[0];
 }
 const prepared=faces.map(f=>({...f,family:Object.keys(chosen).find(k=>chosen[k]===f.color)||null,area:area(f)}));
 const families=['white','green','red'].filter(k=>prepared.some(f=>f.family===k));
 const total=Object.fromEntries(families.map(k=>[k,prepared.filter(f=>f.family===k).reduce((s,f)=>s+f.area,0)]));
 let best={score:-Infinity,yaw:0,pitch:0,zoom};
 for(let yi=0;yi<128;yi++)for(let pi=0;pi<=64;pi++){
  const yaw=-Math.PI+yi*Math.PI/64,pitch=-Math.PI/2+pi*Math.PI/64,visible=Object.fromEntries(families.map(k=>[k,0]));let position=0,other=0;
  for(const face of prepared){const n=camera(face.normal,yaw,pitch),z=Math.max(0,n[2]);
   if(face.family){const weight=face.area/total[face.family];visible[face.family]+=z*weight;position+=z*weight*(face.family==='white'?.45*n[1]:face.family==='green'?-.18*n[0]:.18*n[0]);}
   else other+=z*face.area;
  }
  const score=families.reduce((s,k)=>s+Math.log(.03+visible[k]),0)+position-.025*other;
  if(score>best.score)best={score,yaw,pitch,zoom};
 }
 return {yaw:best.yaw,pitch:best.pitch,zoom};
}
function save(name,canvas){fs.writeFileSync(path.join(assets,name+'.png'),canvas.toBuffer('image/png'));}
const tetraViews={axis:{yaw:-.8344855486097886,pitch:.6381360077604268,roll:Math.PI/3},pyramorphix:{yaw:.80,pitch:.57},mastermorphix:{yaw:.80,pitch:.57},masterpyraminx:{yaw:1.03,pitch:.24},jing:{yaw:.78,pitch:-.57}};
function renderModel(type,engine,renderer=shapeRenderer,zoom=1.13){
 const model=engine.create(type),canvas=createCanvas(960,720),view=tetraViews[type]?{...tetraViews[type],zoom}:chooseView(model.faces,zoom);
 renderer.render(canvas.getContext('2d'),model,{width:960,height:720,labels:false,highlight:false,view});
 // A half-turn of the camera roll keeps Jing's vertex upright while showing
 // its existing red/green/blue faces. No colors or geometry are substituted.
 if(type==='jing'){const rolled=createCanvas(960,720),ctx=rolled.getContext('2d');ctx.translate(960,790);ctx.rotate(Math.PI);ctx.drawImage(canvas,0,0);save(type,rolled);}else save(type,canvas);
 return {type,view,colors:[...new Set(model.faces.map(f=>f.color))]};
}
function renderInline(type){
 const html=fs.readFileSync(path.join(base,'games',type+'.html'),'utf8');
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 const canvas=createCanvas(960,720),rings=createCanvas(960,720);
 const context={console,URLSearchParams,location:{search:''},document:{getElementById:id=>id==='rings'?rings:canvas},setTimeout,clearTimeout,requestAnimationFrame:()=>{},performance,matchMedia:()=>({matches:false})};
 context.window=context;context.FaceGroupedRings={createFixed:()=>({})};
 context.PuzzleAxisDisplay={selection:()=>null,hovered:()=>null,labelMode:()=> 'none',highlights3D:()=>false};
 vm.createContext(context);scripts.slice(0,-1).forEach(code=>vm.runInContext(code,context));
 const engine=context.MegaEngine||context.TetraEngine,faces=engine.faces;
 const view=type==='megaminx'?chooseView(faces,1.0):type==='tetraminx'?{yaw:-.92,pitch:.24,zoom:1.18}:{yaw:1.03,pitch:.24,zoom:1.0};
 let app=scripts.at(-1).slice(0,scripts.at(-1).indexOf('function frame('));
 app+='\nsizes.cube={w:960,h:720};view='+JSON.stringify(view)+';drawCube(0);})();';
 vm.runInContext(app,context);save(type,canvas);return{type,view,colors:faces.map(f=>f.color)};
}
async function main(){
 const reports=[];
 const shape=require(path.join(base,'games/shape-engine.js'));
 for(const type of ['axis','diamondcube','rhombic','cornerocta','trajber','jewel','pyramorphix','mastermorphix'])reports.push(renderModel(type,shape));
 const skewb=require(path.join(base,'games/skewb-engine.js'));
 for(const type of ['ultimate','diamond','jing'])reports.push(renderModel(type,skewb,skewbRenderer,type==='jing'?1.16:1.13));
 reports.push(renderModel('fto',require(path.join(base,'games/fto-engine.js')),skewbRenderer));
 reports.push(renderModel('ghost',require(path.join(base,'games/ghost-engine.js')),ghostRenderer,1.08));
 for(const type of ['masterpyraminx','kilominx','crystal'])reports.push(renderModel(type,require(path.join(base,'games',type+'-engine.js')),shapeRenderer,type==='masterpyraminx'?1.12:1.17));
 for(const type of ['pyraminx','megaminx'])reports.push(renderInline(type));
 const index=fs.readFileSync(path.join(base,'index.html'),'utf8');
 const sources=[...new Set([...index.matchAll(/src="(assets\/[^"]+\.png)(?:\?[^"]*)?"/g)].map(m=>m[1]))];
 let originalBytes=0,previewBytes=0;
 for(const source of sources){const input=path.join(base,source),image=await loadImage(input),out=createCanvas(640,480),ctx=out.getContext('2d');ctx.drawImage(image,0,0,640,480);const buffer=out.toBuffer('image/webp',90);fs.writeFileSync(input.replace(/\.png$/,'.webp'),buffer);originalBytes+=fs.statSync(input).size;previewBytes+=buffer.length;}
 console.log(JSON.stringify({previews:sources.length,originalBytes,previewBytes,reductionPercent:Math.round((1-previewBytes/originalBytes)*1000)/10,cameraOnly:reports},null,2));
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={chooseView,colorFamily};
