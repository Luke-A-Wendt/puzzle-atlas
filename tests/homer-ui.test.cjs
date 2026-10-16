'use strict';
const assertAutoSolveDelegates=require('./auto-solve-delegate.cjs');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {createHarness}=require('./game-harness.cjs');
const htmlPath=path.join(__dirname,'../dist/games/homer.html');
const create=(options={})=>createHarness({htmlPath,bundled:true,...options});
const stable=s=>JSON.stringify({stickers:s.stickers,history:s.history,journal:s.journal,view:s.view,seed:s.seed,selected:s.selected,mode:s.mode,paused:s.paused,userTurns:s.userTurns,animating:s.animating});
const app=create(),api=app.context.PUZZLE_API,E=app.context.CubeEngine;
assert.equal(api.puzzle,'homer');assert.equal(app.snapshot().solved,true);assert.equal(app.snapshot().mirrorMode,false);assert.equal(app.snapshot().stickers.length,24);assert.equal(app.snapshot().history.length,0);
assert.equal(app.document.querySelectorAll('.notation-key').length,12);assert.equal(app.document.querySelectorAll('.ring-key').length,6);
assert.equal(app.snapshot().mirrorEligible,false);assert(!app.elements.has('mirrorMode'));
assert(api.move('R'));app.frame(25);assert(app.snapshot().animating);const moving=stable(app.snapshot());assert.equal(api.setMirrorMode(true),false);assert.equal(stable(app.snapshot()),moving,'obsolete mirror request preserves active move');assert(!app.snapshot().mirrorMode);assert(!app.elements.get('ringPanel').hidden);assert(!app.elements.get('identityMetric').hidden);assert(!app.elements.get('mechanismLegend').hidden);assert(!app.document.body.classList.contains('mirror-active'));app.complete();assert(!app.snapshot().solved);assert.equal(app.snapshot().userTurns,1);
assert(api.move("R'"));app.complete();assert(app.snapshot().solved);assert.equal(app.snapshot().history.length,2);
api.setMirrorMode(false);assert(!app.elements.get('ringPanel').hidden);assert(!app.elements.get('mechanismLegend').hidden);
api.reset();api.runMoves("R U F2 L' B D2");app.complete();assert(!app.snapshot().solved);assert.equal(app.snapshot().userTurns,6);assertAutoSolveDelegates(app.context);assert.equal(app.snapshot().history.length,6);assert(api.runMoves("D2 B' L F2 U' R'",{label:'Known inverse fixture'}));app.complete();assert(app.snapshot().solved);assert.equal(app.snapshot().history.length,12);
// Randomize appends moves to the current state; Stop discards only the unfinished turn.
const previousHistory=app.snapshot().history.length,previousStickers=app.snapshot().stickers;
assert(api.randomize());assert.deepEqual(app.snapshot().stickers,previousStickers);assert.equal(app.snapshot().history.length,previousHistory);assert.equal(app.elements.get('speed').value,'5');
app.frame(400);app.frame(20);const completedHistory=app.snapshot().history.length,committedStickers=app.snapshot().stickers;
assert(completedHistory>previousHistory&&completedHistory<previousHistory+20,'some scramble moves completed before Stop');assert(app.snapshot().animating);
app.click('pause');assert.equal(app.snapshot().mode,'idle');assert.equal(app.snapshot().paused,false);assert.equal(app.snapshot().animating,false);assert.equal(app.snapshot().history.length,completedHistory);assert.deepEqual(app.snapshot().stickers,committedStickers);assert.equal(app.elements.get('speed').value,'5');
const stopped=stable(app.snapshot());app.frame(1000);assert.equal(stable(app.snapshot()),stopped);api.setMirrorMode(true);assert.equal(stable(app.snapshot()),stopped);const seed=app.snapshot().seed;assert(!app.snapshot().solved);assertAutoSolveDelegates(app.context);assert.equal(app.snapshot().history.length,completedHistory);
const beforeRandomize=app.snapshot().history.length,beforeStickers=app.snapshot().stickers;assert(api.randomize());assert.deepEqual(app.snapshot().stickers,beforeStickers);app.complete();assert.equal(app.snapshot().history.length,beforeRandomize+20);assert.equal(app.elements.get('speed').value,'5');assert.notEqual(app.snapshot().seed,seed);app.click('undo');app.complete();assert.equal(app.snapshot().history.length,beforeRandomize+19);api.reset();assert(app.snapshot().solved);assert.equal(app.snapshot().history.length,0);
// Every notation button, including inverse, uses the exact 2×2 move model.
for(const face of ['U','R','F','D','L','B']){
 api.reset();app.document.querySelectorAll('.notation-key').find(b=>b.dataset.face===face&&b.dataset.direction==='1').dispatch('click');app.complete();assert.deepEqual(app.snapshot().stickers,JSON.parse(JSON.stringify(E.applyMove(E.makeSolved(),face))));
 app.document.querySelectorAll('.notation-key').find(b=>b.dataset.face===face&&b.dataset.direction==='-1').dispatch('click');app.complete();assert(app.snapshot().solved);
}
const advanced=create({search:'?mirror=1'});assert(!advanced.snapshot().mirrorMode);assert(!advanced.elements.get('ringPanel').hidden);
// A live speed change preserves progress but changes both manual and queued duration.
const speed=create({speed:1});speed.context.PUZZLE_API.move('R');speed.frame(300);assert(speed.snapshot().animating);speed.elements.get('speed').value='5';speed.elements.get('speed').dispatch('input');speed.frame(150);assert(!speed.snapshot().animating);
const slow=create({speed:1}),fast=create({speed:5});slow.context.PUZZLE_API.runMoves('R U');fast.context.PUZZLE_API.runMoves('R U');slow.frame(250);fast.frame(250);assert.equal(slow.snapshot().history.length,0);assert.equal(fast.snapshot().history.length,1);slow.complete();fast.complete();assert.deepEqual(slow.snapshot().stickers,fast.snapshot().stickers);
// Axis labels are clickable and follow the view, while turning pieces cannot drag an axis label away.
api.reset();api.setMirrorMode(false);app.context.PuzzleAxisDisplay.setLabelMode('some');app.frame();const targets=app.snapshot().faceTargets;assert(targets.length>=2);for(const target of targets){assert('URFDLB'.includes(target.face));assert(Number.isFinite(target.x)&&Number.isFinite(target.y));}
const target=targets.find(t=>t.face!=='R')||targets[0],cube=app.elements.get('cube');cube.dispatch('pointerdown',{clientX:target.x,clientY:target.y});cube.dispatch('pointerup',{clientX:target.x,clientY:target.y});assert.equal(app.snapshot().selected,target.face);
const view=app.snapshot().view;cube.dispatch('pointerdown',{clientX:200,clientY:200});cube.dispatch('pointermove',{clientX:240,clientY:220});cube.dispatch('pointerup',{clientX:240,clientY:220});assert.notDeepEqual(app.snapshot().view,view);const rotated=stable(app.snapshot());api.setMirrorMode(true);assert.equal(stable(app.snapshot()),rotated);
const html=fs.readFileSync(htmlPath,'utf8');assert(html.includes('Ring colors show the hidden 2×2 mechanism'));assert(!html.includes("puzzle:'cube2'"));assert(html.includes('#mechanismLegend[hidden]{display:none!important}'));
// Exercise the production raster path too, with a native offscreen canvas.
const {createCanvas}=require('@napi-rs/canvas');
const canvas=createCanvas(400,400);canvas.ownerDocument={createElement:()=>createCanvas(1,1)};
const ctx=canvas.getContext('2d'),raster=create({canvasContexts:{cube:ctx},dimensions:{cube:{width:400,height:400}}});
const yellowPixels=()=>{const data=ctx.getImageData(0,0,400,400).data;let count=0;for(let i=0;i<data.length;i+=4)if(data[i]>135&&data[i+1]>95&&data[i+2]<110&&data[i+3]>200)count++;return count;};
assert(yellowPixels()>6000,'normal mode draws a recognizable yellow head');
assert.equal(raster.context.PUZZLE_API.setMirrorMode(true),false);raster.frame();assert(yellowPixels()>6000,'Homer always retains its colored head');
console.log('Homer UI: solved start, 6 axes, 24 single-color map nodes, legal turns, inverse controls, fresh scrambles, Auto Solve delegation, undo/reset, immediate Stop/speed, orbit/axis clicks, colored-only presentation PASS');
