const fs=require('node:fs'),path=require('node:path'),{createCanvas}=require('@napi-rs/canvas');
const base=path.resolve(__dirname,'../dist'),E=require(base+'/games/ghost-engine.js');
require(base+'/games/shape-bsp.js');require(base+'/games/shape-renderer.js');
const R=require(base+'/games/ghost-renderer.js'),model=E.create('ghost'),canvas=createCanvas(960,720);
R.render(canvas.getContext('2d'),model,{width:960,height:720,labels:false,highlight:false,view:{yaw:-.62,pitch:.48,zoom:1.08}});
fs.writeFileSync(base+'/assets/ghost.png',canvas.toBuffer('image/png'));
console.log('Ghost Cube: solved colored exterior, 26 rigid pieces / '+model.slots.length+' surface patches.');
