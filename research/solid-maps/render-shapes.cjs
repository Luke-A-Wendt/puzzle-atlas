// Real game handler/canvas render, with no browser or substitute drawing code.
const fs=require('fs'),path=require('path'),{createCanvas}=require('@napi-rs/canvas'),{createHarness}=require('../../tests/game-harness.cjs');
const canvas=createCanvas(1500,1040),ctx=canvas.getContext('2d');ctx.fillStyle='#101017';ctx.fillRect(0,0,1500,1040);
for(const[i,type]of ['rhombic','flatdiamond','cornerocta','trajber','pyramorphix'].entries()){
 const rings=createCanvas(500,480),cube=createCanvas(500,480),app=createHarness({htmlPath:path.resolve(__dirname,'../../dist/games/'+type+'.html'),bundled:true,canvasContexts:{rings:rings.getContext('2d'),cube:cube.getContext('2d')},dimensions:{rings:{width:500,height:480},cube:{width:500,height:480}}});app.frame(0);
 ctx.drawImage(rings,i%3*500,Math.floor(i/3)*520+32);ctx.fillStyle='#eee';ctx.font='20px sans-serif';ctx.fillText(type,i%3*500+20,Math.floor(i/3)*520+27);
}
fs.writeFileSync(path.join(__dirname,'shape-solid-maps.png'),canvas.toBuffer('image/png'));
