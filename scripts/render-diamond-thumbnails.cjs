'use strict';
// The atlas thumbnails are renders of the exact playable models, not illustrations.
const fs=require('node:fs'),path=require('node:path'),{createCanvas}=require('@napi-rs/canvas');
const base=path.resolve(__dirname,'../dist'),E=require(base+'/games/shape-engine.js');
require(base+'/games/shape-bsp.js');const R=require(base+'/games/shape-renderer.js');
for(const type of ['diamondstyle','diamondcube']){
 const model=E.create(type),canvas=createCanvas(960,720);
 R.render(canvas.getContext('2d'),model,{width:960,height:720,labels:false,highlight:false,view:{yaw:-.62,pitch:.48,zoom:1.13}});
 fs.writeFileSync(base+'/assets/'+type+'.png',canvas.toBuffer('image/png'));
 console.log(type+' exact-model thumbnail');
}
