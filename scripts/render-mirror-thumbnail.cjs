'use strict';
// Render the atlas card from the game's solved geometry, without game controls.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createCanvas}=require('@napi-rs/canvas');
const project=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(project,'dist/games/mirror.html'),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const canvas=createCanvas(960,720),rings=createCanvas(960,720);
const context={console,URLSearchParams,location:{search:''},document:{getElementById:id=>id==='rings'?rings:canvas}};
context.window=context;vm.createContext(context);
scripts.slice(0,-1).forEach(code=>vm.runInContext(code,context));
let app=scripts.at(-1).slice(0,scripts.at(-1).indexOf('function frame('));
app=app.replace('chosen=piece.p[E.configs[selected].axis]===E.configs[selected].layer','chosen=false')
 .replace(/^ drawCubeFaceLabels\(project,eye,[^\n]+\n/m,'');
app+='\nif(!E.isSolved(stickers))throw new Error("Thumbnail must be solved");sizes.cube={w:960,h:720};drawCube(0);})();';
vm.runInContext(app,context);
const pixels=canvas.getContext('2d').getImageData(0,0,960,720).data;
let x0=960,y0=720,x1=0,y1=0;
for(let y=0;y<720;y++)for(let x=0;x<960;x++)if(pixels[(y*960+x)*4+3]>1){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
const width=x1-x0+1,height=y1-y0+1,scale=Math.min(680/width,590/height),w=width*scale,h=height*scale;
const output=createCanvas(960,720);
output.getContext('2d').drawImage(canvas,x0,y0,width,height,(960-w)/2,350-h/2,w,h);
fs.writeFileSync(path.join(project,'dist/assets/mirror-color.png'),output.toBuffer('image/png'));
console.log('Rendered solved colored Mirror Cube atlas thumbnail.');
