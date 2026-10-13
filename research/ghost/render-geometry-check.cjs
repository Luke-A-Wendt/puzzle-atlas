const fs=require('node:fs'),path=require('node:path'),{createCanvas}=require('@napi-rs/canvas');
const base=path.resolve(__dirname,'../..'),E=require(base+'/dist/games/ghost-engine.js');
require(base+'/dist/games/shape-bsp.js');require(base+'/dist/games/shape-renderer.js');
const R=require(base+'/dist/games/ghost-renderer.js'),canvas=createCanvas(1400,1100),ctx=canvas.getContext('2d');
ctx.fillStyle='#100f18';ctx.fillRect(0,0,1400,1100);
const scenes=[['Solved · colored',[],false],['Solved · mirror',[],true],['Aligned · R turn',['R'],false],['Scrambled shape',['R','U',"F'",'D2'],true]];
for(let i=0;i<scenes.length;i++){const [title,moves,mirrorMode]=scenes[i],m=E.create();moves.forEach(v=>m.applyMove(v));const panel=createCanvas(700,490);R.render(panel.getContext('2d'),m,{width:700,height:490,labels:true,highlight:false,mirrorMode,view:{yaw:-.62,pitch:.48,zoom:1}});const x=(i%2)*700,y=Math.floor(i/2)*550;ctx.drawImage(panel,x,y+40);ctx.fillStyle='#ebe8f4';ctx.font='20px sans-serif';ctx.fillText(title,x+24,y+30);}
fs.writeFileSync(path.join(__dirname,'geometry-check.png'),canvas.toBuffer('image/png'));
