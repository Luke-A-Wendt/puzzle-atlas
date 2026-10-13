'use strict';
const assertAutoSolveDelegates=require('./auto-solve-delegate.cjs');
// Exercise production RAF timing with actual slider and pause event handlers.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {createHarness}=require('./game-harness.cjs');
const games=['cube2','cube3','cube4','cube5','cube6','cube7','mirror','pyraminx','tetraminx','megaminx','ultimate','diamond','fto','rhombic','flatdiamond','cornerocta','trajber','pyramorphix'];
const renderDir=process.env.MOTION_RENDER_DIR;
let createCanvas;if(renderDir){({createCanvas}=require('@napi-rs/canvas'));fs.mkdirSync(renderDir,{recursive:true});}
function drawing(){
 const labels=[],canvas=renderDir?createCanvas(500,400):null,real=canvas&&canvas.getContext('2d');
 const ctx=new Proxy({}, {get:(obj,key)=>{
  if(key==='clearRect')return(...args)=>{labels.length=0;if(real)real.clearRect(...args);};
  if(key==='fillText')return(text,x,y,...more)=>{labels.push({text:String(text),x,y});if(real)real.fillText(text,x,y,...more);};
  if(real){const value=real[key];return typeof value==='function'?value.bind(real):value;}
  if(key==='createRadialGradient'||key==='createLinearGradient')return()=>({addColorStop(){}});
  if(key==='measureText')return text=>({width:String(text).length*6});
  return key in obj?obj[key]:()=>{};
 },set:(obj,key,value)=>{obj[key]=value;if(real)real[key]=value;return true;}});
 return {ctx,labels,canvas};
}
for(const name of games){
 for(const reducedMotion of [false,true]){
  const trace=drawing(),app=createHarness({htmlPath:path.join(__dirname,'../dist/games',name+'.html'),bundled:true,reducedMotion,speed:1,canvasContexts:{cube:trace.ctx}}),api=app.context.PUZZLE_API;
  const first=name==='fto'?'A':name==='megaminx'?'A':name==='ultimate'||name==='diamond'?'L':'R',second=name==='fto'||name==='megaminx'?'B':name==='ultimate'||name==='diamond'?'R':'U';
  const speed=value=>{const el=app.elements.get('speed');el.value=String(value);el.dispatch('input');};
  const history=()=>app.snapshot().history.length;
  function settle(){for(let n=0;n<500;n++){if(!app.snapshot().animating&&app.snapshot().mode==='idle')return;app.frame(2000);}throw Error('Unfinished '+name);}
  // Slow and fast remain observably distinct even with reduced motion enabled.
  speed(1);api.move(first);app.frame(700);assert(app.snapshot().animating,name+' slow midway');assert.equal(history(),0);app.frame(699);assert(app.snapshot().animating);app.frame(2);assert.equal(history(),1);
  api.reset();speed(5);api.move(first);app.frame(109);assert(app.snapshot().animating);app.frame(2);assert.equal(history(),1);
  // A live speed adjustment keeps the same fractional progress, then accelerates.
  api.reset();speed(1);api.move(first);app.frame(350);speed(5);app.frame(80);assert.equal(history(),0);app.frame(4);assert.equal(history(),1);
  // Paused wall time cannot consume the turn, including a slider change while paused.
  api.reset();speed(1);api.runMoves(first+' '+second);app.frame(350);app.click('pause');app.frame(3000);speed(5);app.frame(3000);assert.equal(history(),0);assert(app.snapshot().paused);app.click('pause');app.frame(80);assert.equal(history(),0);app.frame(4);assert.equal(history(),1);app.frame(109);assert.equal(history(),1);app.frame(2);assert.equal(history(),2);assert.equal(app.snapshot().mode,'idle');
  // The same speed policy controls scrambling and the runMoves API used for each constrained stage.
  api.reset();speed(1);api.randomize();app.frame(700);assert.equal(history(),0);speed(5);app.frame(54);assert.equal(history(),0);app.frame(100);assert.equal(history(),1);settle();const scrambled=history();assert(scrambled>=12);assertAutoSolveDelegates(app.context);speed(1);assert(api.runMoves(first+' '+second,{label:'Auto Solve · animation fixture'}));app.frame(700);assert.equal(history(),scrambled);speed(5);app.frame(54);assert.equal(history(),scrambled);app.frame(100);assert.equal(history(),scrambled+1);settle();assert.equal(history(),scrambled+2);assert.equal(app.snapshot().mode,'idle');assert(app.snapshot().journal.some(j=>j.label==='Auto Solve · animation fixture'));
  if(/^(cube[2-7]|mirror)$/.test(name)&&!reducedMotion){
   api.reset();app.click('homeView');app.frame(0);
   const front=trace.labels.filter(l=>/^[URFDLB]$/.test(l.text));assert.deepEqual(front.map(l=>l.text).sort(),['F','R','U']);
   const cube=app.elements.get('cube'),face=front.find(l=>l.text==='F');cube.dispatch('pointerdown',{clientX:face.x,clientY:face.y});cube.dispatch('pointerup',{clientX:face.x,clientY:face.y});assert.equal(app.snapshot().selected,'F');
   if(renderDir)fs.writeFileSync(path.join(renderDir,name+'-labels.png'),trace.canvas.toBuffer('image/png'));
   // Orbit to the opposite side. Exactly the corresponding opposite face labels appear.
   cube.dispatch('pointerdown',{clientX:0,clientY:0});cube.dispatch('pointermove',{clientX:Math.PI/.009,clientY:-.96/.009});cube.dispatch('pointerup',{clientX:Math.PI/.009,clientY:-.96/.009});app.frame(0);
   const back=trace.labels.filter(l=>/^[URFDLB]$/.test(l.text));assert.deepEqual(back.map(l=>l.text).sort(),['B','D','L']);
   assert(back.every(l=>l.x>0&&l.x<500&&l.y>0&&l.y<400));
   const left=back.find(l=>l.text==='L');cube.dispatch('pointerdown',{clientX:left.x,clientY:left.y});cube.dispatch('pointerup',{clientX:left.x,clientY:left.y});assert.equal(app.snapshot().selected,'L');
   api.move('L');settle();assert.equal(app.snapshot().history[0].face,'L');
  }
 }
 console.log(name+': slider slow/fast, reduced-motion override regression, live speed, paused speed, scramble, constrained-stage playback and Auto Solve delegation PASS');
}
console.log('All cube sizes and Mirror: camera-aligned outer face labels, opposite camera view, and label selection PASS');
