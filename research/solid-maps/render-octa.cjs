const fs=require('fs'),path=require('path'),{createCanvas}=require('@napi-rs/canvas'),{createHarness}=require('../../tests/game-harness.cjs');
const names=['diamond','ultimate','fto'],out=createCanvas(1620,1140),ctx=out.getContext('2d');ctx.fillStyle='#101017';ctx.fillRect(0,0,out.width,out.height);
for(let i=0;i<names.length;i++)for(let state=0;state<2;state++){
 const name=names[i],rings=createCanvas(540,520),cube=createCanvas(540,520),app=createHarness({htmlPath:path.resolve(__dirname,'../../dist/games/'+name+'.html'),bundled:true,speed:5,canvasContexts:{rings:rings.getContext('2d'),cube:cube.getContext('2d')},dimensions:{rings:{width:540,height:520},cube:{width:540,height:520}}});
 if(state){app.context.PUZZLE_API.runMoves(name==='fto'?'A B C D Am':'L R D B l');app.complete();}app.frame(0);ctx.drawImage(rings,i*540,state*570+40);ctx.fillStyle='#ece7fa';ctx.font='700 20px sans-serif';ctx.fillText(name.toUpperCase()+' · '+(state?'IN PLAY':'SOLVED'),i*540+25,state*570+29);
}
fs.writeFileSync(path.join(__dirname,'octa-stickers.png'),out.toBuffer('image/png'));
