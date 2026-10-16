'use strict';
// Build-time only: render the six solved silver variants with the game's real
// geometry and mirror materials. Colored atlas assets are never overwritten.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createCanvas} = require('@napi-rs/canvas');
const {chooseView} = require('./render-atlas-thumbnails.cjs');
const base = path.resolve(__dirname, '../dist');
require(path.join(base, 'games/shape-bsp.js'));
const shapeRenderer = require(path.join(base, 'games/shape-renderer.js'));
const ghostRenderer = require(path.join(base, 'games/ghost-renderer.js'));
const shapeEngine = require(path.join(base, 'games/shape-engine.js'));
const ghostEngine = require(path.join(base, 'games/ghost-engine.js'));
const names = Object.freeze({mirror:'mirror-silver',axis:'axis-mirror',ghost:'ghost-mirror',
  pyramorphix:'pyramorphix-mirror',mastermorphix:'mastermorphix-mirror',flatdiamond:'flatdiamond-mirror'});

function renderShape(type) {
  const model = (type === 'ghost' ? ghostEngine : shapeEngine).create(type);
  if (!model.mirrorEligible || !model.isSolved()) throw new Error(type + ': expected a solved mirror-eligible puzzle');
  // Match the existing colored card's camera. The silver material is the only
  // difference; in particular the Ghost keeps its genuine aligned solved form.
  const view = type === 'axis' ? {yaw:-.8344855486097886,pitch:.6381360077604268,roll:Math.PI/3,zoom:1.13}
    : ['pyramorphix','mastermorphix'].includes(type) ? {yaw:.80,pitch:.57,zoom:1.13}
    : type === 'flatdiamond' ? {yaw:-.38,pitch:.48,zoom:1.10}
    : chooseView(model.faces,1.08);
  const canvas = createCanvas(960,720);
  (type === 'ghost' ? ghostRenderer : shapeRenderer).render(canvas.getContext('2d'),model,
    {width:960,height:720,view,mirrorMode:true,labels:false,highlight:false,pieceLabels:false});
  return canvas;
}

function renderMirrorCube() {
  const html = fs.readFileSync(path.join(base,'games/mirror.html'),'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match=>match[1]);
  const canvas = createCanvas(960,720), rings = createCanvas(960,720);
  const context = {console,URLSearchParams,location:{search:'?mirror=1'},
    document:{getElementById:id=>id==='rings'?rings:canvas},
    PuzzleAxisDisplay:{selection:()=>null,hovered:()=>null,labelMode:()=> 'none',highlights3D:()=>false}};
  context.window = context;
  vm.createContext(context);
  scripts.slice(0,-1).forEach(code=>vm.runInContext(code,context));
  const application = scripts.at(-1), frameStart = application.indexOf('function frame(');
  if (frameStart < 0) throw new Error('Mirror Cube drawing entry point was not found');
  const drawing=application.slice(0,frameStart).replace(/^ drawCubeFaceLabels\(project,eye,[^\n]+\n/m,'');
  vm.runInContext(drawing + '\nif(!mirrorMode||!E.isSolved(stickers))throw new Error("Expected solved silver Mirror Cube");sizes.cube={w:960,h:720};drawCube(0);})();',context);
  // This is the same framing used by render-mirror-thumbnail.cjs for the
  // colored card. It changes only crop/scale, never physical puzzle geometry.
  const pixels = canvas.getContext('2d').getImageData(0,0,960,720).data;
  let x0=960,y0=720,x1=0,y1=0;
  for(let y=0;y<720;y++)for(let x=0;x<960;x++)if(pixels[(y*960+x)*4+3]>1){
    x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
  }
  const width=x1-x0+1,height=y1-y0+1,scale=Math.min(680/width,590/height),w=width*scale,h=height*scale;
  const output=createCanvas(960,720);
  output.getContext('2d').drawImage(canvas,x0,y0,width,height,(960-w)/2,350-h/2,w,h);
  return output;
}

function main() {
  const output=[];
  for (const [type,name] of Object.entries(names)) {
    const source=type==='mirror'?renderMirrorCube():renderShape(type),canvas=createCanvas(640,480);
    canvas.getContext('2d').drawImage(source,0,0,640,480);
    const png=canvas.toBuffer('image/png'),webp=canvas.toBuffer('image/webp',90);
    fs.writeFileSync(path.join(base,'assets',name+'.png'),png);
    fs.writeFileSync(path.join(base,'assets',name+'.webp'),webp);
    output.push({type,name,width:640,height:480,pngBytes:png.length,webpBytes:webp.length});
  }
  console.log(JSON.stringify(output,null,2));
}
if(require.main===module)main();
module.exports={names,renderShape,renderMirrorCube};
