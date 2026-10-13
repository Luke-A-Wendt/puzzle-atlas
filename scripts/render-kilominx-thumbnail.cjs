'use strict';
const fs=require('node:fs'),path=require('node:path'),{createCanvas}=require('@napi-rs/canvas');
const base=path.resolve(__dirname,'../dist'),E=require(base+'/games/kilominx-engine.js');require(base+'/games/shape-bsp.js');const R=require(base+'/games/shape-renderer.js');
const model=E.create(),canvas=createCanvas(960,720);R.render(canvas.getContext('2d'),model,{width:960,height:720,labels:false,highlight:false,view:{yaw:-.30,pitch:.28,zoom:1.17}});fs.writeFileSync(base+'/assets/kilominx.png',canvas.toBuffer('image/png'));console.log('kilominx thumbnail rendered');
