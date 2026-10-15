'use strict';
const assertAutoSolveDelegates=require('./auto-solve-delegate.cjs');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {createHarness}=require('./game-harness.cjs');
const {createCanvas}=require('@napi-rs/canvas');
const E=require('../dist/games/dino-engine.js'),R=require('../dist/games/dino-rings.js');
function canvasTrace(width,height){const canvas=createCanvas(width,height),real=canvas.getContext('2d'),labels=[];const ctx=new Proxy(real,{get:(target,key)=>{if(key==='clearRect')return(...args)=>{labels.length=0;return target.clearRect(...args);};if(key==='fillText')return(text,x,y,...args)=>{labels.push({text:String(text),x,y});return target.fillText(text,x,y,...args);};const value=target[key];return typeof value==='function'?value.bind(target):value;},set:(target,key,value)=>{target[key]=value;return true;}});return{canvas,ctx,labels};}
for(const type of ['dino','rainbow']){
 const cube=canvasTrace(600,540),rings=canvasTrace(600,540),app=createHarness({htmlPath:path.join(__dirname,'../dist/games',type+'.html'),bundled:true,reducedMotion:true,speed:1,dimensions:{cube:{width:600,height:540},rings:{width:600,height:540}},canvasContexts:{cube:cube.ctx,rings:rings.ctx}}),api=app.context.PUZZLE_API;
 const speed=value=>{const el=app.elements.get('speed');el.value=String(value);el.dispatch('input');};
 const settle=()=>{for(let n=0;n<200;n++){if(!app.snapshot().animating&&app.snapshot().mode==='idle'){app.frame(0);return;}app.frame(2000);}throw Error('Unfinished sequence');};
 assert(app.snapshot().solved);assert.equal(app.document.querySelectorAll('.ring-key').length,8);
 const front=cube.labels.filter(l=>/^[A-H]$/.test(l.text));assert(front.length>=3);assert(front.every(l=>l.x>0&&l.x<600&&l.y>0&&l.y<540));
 const marker=front.find(v=>v.text!=='A'),canvas=app.elements.get('cube');canvas.dispatch('pointerdown',{clientX:marker.x,clientY:marker.y});canvas.dispatch('pointerup',{clientX:marker.x,clientY:marker.y});assert.equal(app.snapshot().selected,marker.text);
 // Slider is respected by individual turns, live changes, queued turns, and stoppable sequences.
 speed(1);api.move('A');app.frame(700);assert(app.snapshot().animating);assert.equal(app.snapshot().history.length,0);speed(5);app.frame(54);assert(app.snapshot().animating);app.frame(2);assert.equal(app.snapshot().history.length,1);app.click('undo');settle();assert(app.snapshot().solved);
 for(const face of 'ABCDEFGH'){api.reset();api.select(face);assert.equal(app.snapshot().selected,face);api.move(face);settle();assert(!app.snapshot().solved);api.move(face+"'");settle();assert(app.snapshot().solved);}
 api.reset();speed(1);api.runMoves('A B');app.frame(350);app.click('pause');const stopped=JSON.stringify(app.snapshot().pieces);app.frame(5000);assert.equal(app.snapshot().mode,'idle');assert.equal(app.snapshot().paused,false);assert.equal(JSON.stringify(app.snapshot().pieces),stopped);assert.equal(app.snapshot().history.length,0);assert.equal(app.elements.get('speed').value,'3');speed(5);assert(api.runMoves('A B'));app.frame(109);assert.equal(app.snapshot().history.length,0);app.frame(2);assert.equal(app.snapshot().history.length,1);app.frame(111);assert.equal(app.snapshot().history.length,2);
 const beforeRandomize=app.snapshot().history.length;api.randomize();settle();assert(!app.snapshot().solved);const seed=app.snapshot().seed,count=app.snapshot().history.length;assert.equal(count,beforeRandomize+30);assert(api.runMoves("A B' C D E' F G H"));settle();assert.equal(app.snapshot().history.length,count+8);assertAutoSolveDelegates(app.context);assert.equal(app.snapshot().history.length,count+8);
 api.randomize();settle();assert.notEqual(app.snapshot().seed,seed);api.reset();assert(app.snapshot().solved);assert.equal(app.snapshot().history.length,0);assert.throws(()=>api.runMoves('Z'));
 app.click('pieceLabels');app.frame(0);app.click('ringFocus');app.frame(0);app.click('ringFocus');app.click('pieceLabels');app.frame(0);
 // All stickers appear once, with single-color groups and exact animated orbits.
 const model=E.create(type),G=R.create(model),nodes=G.views(),expected=type==='dino'?24:56;assert.equal(nodes.length,expected);assert.equal(new Set(nodes.map(v=>v.id)).size,expected);
 const min=Math.min(...nodes.flatMap((a,i)=>nodes.slice(i+1).map(b=>Math.hypot(a.x-b.x,a.y-b.y))));assert(min>G.nodeRadius*2+1,type+' nonoverlapping solved nodes, min '+min);
 const nearOwn=nodes.filter(a=>nodes.filter(b=>a.id!==b.id).sort((b,c)=>Math.hypot(a.x-b.x,a.y-b.y)-Math.hypot(a.x-c.x,a.y-c.y))[0].color===a.color).length;assert(nearOwn/expected>=.9,type+' clear solved color groups '+nearOwn);
 if(type==='rainbow'){
  const maxGroupDiameter=Math.max(...nodes.flatMap(a=>nodes.filter(b=>a.color===b.color).map(b=>Math.hypot(a.x-b.x,a.y-b.y))));assert(maxGroupDiameter<140,'No solved color group wraps across the projection rim');
  const originalAnimationPieces=model.animationPieces;let renderedIds=null;model.animationPieces=face=>(renderedIds=originalAnimationPieces(face));const mid=createCanvas(600,540);app.context.ShapeRenderer.render(mid.getContext('2d'),model,{width:600,height:540,selected:'A',animation:{move:{face:'A',dir:1,turns:1},progress:.5}});assert.equal(renderedIds.length,4,'Renderer rotates the center cap with its three edges');assert(renderedIds.some(id=>model.pieces.find(p=>p.id===id).fixed));model.animationPieces=originalAnimationPieces;
 }
 for(const face of 'ABCDEFGH')for(const dir of [-1,1]){const move={face,dir,turns:1},before=G.views(),moving=new Set(model.movingPieces(face)),orbits=G.orbits(face);for(const progress of [0,.125,.25,.5,.75,.875,1])for(const node of before){const p=G.interpolate(node,{move,progress});assert(Number.isFinite(p.x)&&Number.isFinite(p.y));assert(p.x>=0&&p.x<=500&&p.y>=0&&p.y<=500);assert.equal(p.color,node.color);}
  const ending=before.map(s=>G.interpolate(s,{move,progress:1}));model.applyMove(move);const after=new Map(G.views().map(s=>[s.id,s]));for(const p of ending){const q=after.get(p.id);assert(Math.hypot(p.x-q.x,p.y-q.y)<1e-7);}model.applyMove({...move,dir:-dir});}
 if(process.env.DINO_RENDER_DIR){fs.mkdirSync(process.env.DINO_RENDER_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.DINO_RENDER_DIR,type+'-3d.png'),cube.canvas.toBuffer('image/png'));fs.writeFileSync(path.join(process.env.DINO_RENDER_DIR,type+'-map.png'),rings.canvas.toBuffer('image/png'));}
 console.log(type+': complete UI, all 8 corner turns, visible labels, live speed, Stop, fresh scramble, Auto Solve delegation, '+expected+' unique solid stickers, min spacing '+min.toFixed(1)+'px, '+nearOwn+'/'+expected+' grouped-color neighbors PASS');
}
