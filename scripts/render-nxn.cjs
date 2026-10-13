const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createCanvas}=require('@napi-rs/canvas');
const project=path.resolve(__dirname,'..'),artifacts=path.join(project,'tests/artifacts');fs.mkdirSync(artifacts,{recursive:true});
const {createHarness}=require('../tests/game-harness.cjs');
const requested=process.argv.slice(2).map(Number),sizes=requested.length?requested:[5,6,7,8];
if(sizes.some(N=>!Number.isInteger(N)||N<5||N>8))throw new Error('Choose cube sizes from 5 through 8');
for(const N of sizes){
 const html=fs.readFileSync(`${project}/dist/games/cube${N}.html`,'utf8'),scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 const canvas=createCanvas(960,720),rings=createCanvas(960,720);
 const ctx={console,document:{getElementById:id=>id==='rings'?rings:canvas},setTimeout,clearTimeout,requestAnimationFrame:()=>{},performance,matchMedia:()=>({matches:false})};ctx.window=ctx;vm.createContext(ctx);
 scripts.slice(0,-1).forEach(code=>vm.runInContext(code,ctx));
 let app=scripts.at(-1).slice(0,scripts.at(-1).indexOf('function frame('));app=app.replace(/ const shadow=cc\.createRadialGradient[^\n]*\n/g,'').replace('const chosen=p[E.configs[selected].axis]===E.configs[selected].layer;','const chosen=false;').replace(/^ drawCubeFaceLabels\(project,eye,[^;]+;/gm,'');
 app+=`\nsizes.cube={w:960,h:720};view.zoom=1.0;drawCube(0);})();`;
 vm.runInContext(app,ctx);
 const data=canvas.getContext('2d').getImageData(0,0,960,720).data;let x0=960,y0=720,x1=0,y1=0;for(let y=0;y<720;y++)for(let x=0;x<960;x++)if(data[(y*960+x)*4+3]>1){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
 const bw=x1-x0+1,bh=y1-y0+1,scale=Math.min(680/bw,590/bh),dw=bw*scale,dh=bh*scale,out=createCanvas(960,720),oc=out.getContext('2d');
 oc.drawImage(canvas,x0,y0,bw,bh,(960-dw)/2,350-dh/2,dw,dh);fs.writeFileSync(`${project}/dist/assets/cube${N}.png`,out.toBuffer('image/png'));
 console.log(N,'thumb bounds',x0,y0,x1,y1);
}
const sheet=createCanvas(1260,sizes.length*440),c=sheet.getContext('2d');c.fillStyle='#101017';c.fillRect(0,0,1260,sizes.length*440);
for(const [i,N] of sizes.entries()){
 const r=createCanvas(610,400),q=createCanvas(610,400);
 const app=createHarness({htmlPath:`${project}/dist/games/cube${N}.html`,bundled:true,canvasContexts:{rings:r.getContext('2d'),cube:q.getContext('2d')},dimensions:{rings:{width:610,height:400},cube:{width:610,height:400}},speed:2});
 if(N===8){app.context.PUZZLE_API.runMoves("Riii Uii Fiii'");app.complete();app.context.PUZZLE_API.select('Riii');app.frame();}if(N===6){app.context.PUZZLE_API.move('Rii');app.frame(200);}if(N===7){app.context.PUZZLE_API.runMoves("R U Ri Fii'");app.complete();app.context.PUZZLE_API.select('M');app.frame();}
 c.fillStyle='#191921';c.fillRect(10,i*440+32,610,400);c.fillRect(640,i*440+32,610,400);c.fillStyle='#f4f1fc';c.font='600 17px sans-serif';c.fillText(`${N}×${N} · ${3*N} rings · ${6*N*N} stickers`,20,i*440+23);c.drawImage(r,10,i*440+32);c.drawImage(q,640,i*440+32);
}
fs.writeFileSync(path.join(artifacts,'nxn-preview.png'),sheet.toBuffer('image/png'));
