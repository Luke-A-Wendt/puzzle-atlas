'use strict';
const fs=require('node:fs'),path=require('node:path'),{createCanvas}=require('@napi-rs/canvas');
const base=path.resolve(__dirname,'../dist'),E=require(base+'/games/masterpyraminx-engine.js');require(base+'/games/shape-bsp.js');const R=require(base+'/games/shape-renderer.js');
const model=E.create(),canvas=createCanvas(960,720);R.render(canvas.getContext('2d'),model,{width:960,height:720,labels:false,highlight:false,view:{yaw:.93,pitch:.30,zoom:1.12}});fs.writeFileSync(base+'/assets/masterpyraminx.png',canvas.toBuffer('image/png'));console.log('masterpyraminx thumbnail rendered from exact model');
