'use strict';
const fs=require('node:fs'),path=require('node:path'),{createCanvas}=require('@napi-rs/canvas');
const base=path.resolve(__dirname,'../dist'),E=require(base+'/games/skewb-engine.js');
require(base+'/games/shape-bsp.js');const R=require(base+'/games/skewb-renderer.js');
for(const type of ['skewb','jing','masterskewb']){
 const model=E.create(type),canvas=createCanvas(960,720),ctx=canvas.getContext('2d');
 const view=type==='jing'?{yaw:-.65,pitch:1.04,zoom:1.16}:{yaw:-.62,pitch:.45,zoom:1.16};
 R.render(ctx,model,{width:960,height:720,selected:model.configs[0].id,view,labels:false,highlight:false});
 fs.writeFileSync(base+'/assets/'+type+'.png',canvas.toBuffer('image/png'));console.log(type+': solved model thumbnail');
}
