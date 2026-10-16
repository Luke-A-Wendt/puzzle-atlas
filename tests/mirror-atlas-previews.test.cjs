'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const {createHarness}=require('./game-harness.cjs');
const dist=path.resolve(__dirname,'../dist');
const variants={mirror:'mirror-silver',axis:'axis-mirror',ghost:'ghost-mirror',pyramorphix:'pyramorphix-mirror',mastermorphix:'mastermorphix-mirror',flatdiamond:'flatdiamond-mirror'};
const bootstrap=/<script id="puzzle-frame-bootstrap">([\s\S]*?)<\/script>/.exec(fs.readFileSync(path.join(dist,'play.html'),'utf8'))[1];

for(const [id,asset]of Object.entries(variants)){
 test(id+': atlas mirror route boots silver, colored route boots colored, and the toggle remains reversible',()=>{
  for(const mirror of [false,true]){
   const frame={src:'about:blank'},document={getElementById:()=>frame,querySelector:()=>({content:'test-release'})};
   vm.runInNewContext(bootstrap,{document,location:{search:'?p='+id+(mirror?'&mirror=1':'')},URLSearchParams});
   const url=new URL(frame.src,'https://atlas.test/puzzle-atlas/play.html');
   assert.equal(url.pathname,'/puzzle-atlas/games/'+id+'.html');
   assert.equal(url.searchParams.get('mirror'),mirror?'1':null);
   const app=createHarness({htmlPath:path.join(dist,'games',id+'.html'),bundled:true,search:url.search});
   assert.equal(app.snapshot().mirrorMode,mirror);assert.equal(app.snapshot().mirrorEligible,true);assert(app.snapshot().solved);
   const before=app.snapshot();app.click('mirrorMode');assert.equal(app.snapshot().mirrorMode,!mirror);
   app.click('mirrorMode');assert.equal(app.snapshot().mirrorMode,mirror);assert(app.snapshot().solved);
   for(const key of ['pieces','stickers','history','journal','view'])assert.deepEqual(app.snapshot()[key],before[key],id+' toggling must preserve '+key);
  }
 });
 test(asset+': local transparent 640×480 preview uses silver material without color faces',async()=>{
  for(const extension of ['png','webp']){
   const image=await loadImage(path.join(dist,'assets',asset+'.'+extension));
   assert.equal(image.width,640);assert.equal(image.height,480);
   const canvas=createCanvas(640,480),context=canvas.getContext('2d');context.drawImage(image,0,0);
   const data=context.getImageData(0,0,640,480).data;
   assert.equal(data[3],0,'corner stays transparent');
   let visible=0,chromatic=0;
   for(let i=0;i<data.length;i+=4)if(data[i+3]>240){visible++;if(Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2])>25)chromatic++;}
   assert(visible>20000,'actual puzzle geometry must be present');
   assert.equal(chromatic,0,'mirror preview must not contain colored stickers');
  }
 });
}
