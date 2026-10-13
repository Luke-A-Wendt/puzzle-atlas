'use strict';
// Independent, rendering-level regression: every actual sticker is exactly one
// opaque circle of the same radius, at rest and in motion.
const assert=require('node:assert/strict'),path=require('node:path');
const {createHarness}=require('./game-harness.cjs');
const {recorder,stickerMarks}=require('./connected-map-recorder.cjs');
const {physicalAxes}=require('./ring-intersection-audit.cjs');
const types=['diamond','ultimate','fto','rhombic','flatdiamond','cornerocta','trajber','pyramorphix','diamondstyle','diamondcube'];
const games=path.resolve(__dirname,'../dist/games');
function counts(colors){const result={};for(const color of colors)result[color]=(result[color]||0)+1;return result;}
function assertFrame(capture,expected,tag,references=[]){
 const fills=stickerMarks(capture,new Set(Object.keys(expected)));
 assert.deepEqual(counts(fills.map(f=>f.color)),expected,tag+': exactly one node per physical sticker in its real color');
 assert.deepEqual(counts(references.map(r=>fills[r.index].color)),counts(references.map(r=>r.color)),tag+': exact physically fixed center colors and count');
 for(const r of references)assert.notEqual(fills[r.index].outlineColor,'#ffffff',tag+': a fixed reference has no moving-node outline');
 for(const fill of fills){
  assert(!fill.invalid,tag+': one full circle, never split colors');
  assert.equal(fill.kind,'circle',tag+': fixed and moving nodes are circular');
  assert(Math.abs(fill.r-fills[0].r)<1e-7,tag+': all nodes have the same radius');
  assert(fill.alpha>=.95,tag+': sticker color must remain easy to see');
  for(const key of ['x','y','r'])assert(Number.isFinite(fill[key]),tag+': finite '+key);
 }
 return fills;
}
function position(capture,selected){const labels=capture.texts.filter(t=>t.text===selected);if(!labels.length)return null;const label=labels.at(-1);return{x:label.x,y:label.y,r:7*476/500};}

function clearLabel(label,dots,tag){if(label)for(const d of dots)assert(Math.hypot(d.x-label.x,d.y-label.y)>d.r+label.r,tag+': axis badge must not cover a sticker node');}
const stateSignature=dots=>dots.map(d=>d.color+':'+d.x.toFixed(5)+','+d.y.toFixed(5)).sort().join('|');
const physicalColorSignature=model=>model.stickerState.map(s=>{const p=s.normal?s:model.slots[s.slot];return s.color+':'+(p.center||p.p).concat(p.normal).map(v=>(Math.round(v*1e5)/1e5).toFixed(5)).join(',');}).sort().join('|');
for(const type of types){
 const shape=!['diamond','ultimate','fto'].includes(type),engine=require(path.join(games,shape?'shape-engine.js':type==='fto'?'fto-engine.js':'skewb-engine.js')),model=engine.create(type),expected=counts(model.slots.map(s=>s.color)),capture=recorder(),mobility=physicalAxes(model,model.stickerState,'solid'),referenceColors=model.stickerState.map((s,index)=>({index,color:s.color,fixed:!mobility.get(s.id).length})).filter(s=>s.fixed);
 const app=createHarness({htmlPath:path.join(games,type+'.html'),bundled:true,speed:1,canvasContexts:{rings:capture.context},dimensions:{rings:{width:500,height:500},cube:{width:500,height:500}}}),api=app.context.PUZZLE_API;
 const dots=assertFrame(capture,expected,type+' solved',referenceColors);
 let minSpacing=Infinity;
 for(let i=0;i<dots.length;i++)for(let j=i+1;j<dots.length;j++){
  const a=dots[i],b=dots[j],d=Math.hypot(a.x-b.x,a.y-b.y);minSpacing=Math.min(minSpacing,d);
  assert(d>a.r+b.r+1,type+': solved nodes must not overlap');
 }
 for(const focus of [false,true]){
  if(focus)app.click('ringFocus');
  for(const cfg of model.configs){
   api.reset();api.select(cfg.id);app.frame(0);
   const initial=position(capture,cfg.id),beforeDots=assertFrame(capture,expected,type+' '+cfg.id+' before',referenceColors);clearLabel(initial,beforeDots,type+' '+cfg.id);
   api.move({face:cfg.id,dir:1});
   for(let i=0;i<5;i++){
    app.frame(i===0?0:225);const movingDots=assertFrame(capture,expected,type+' '+cfg.id+' moving',referenceColors);clearLabel(position(capture,cfg.id),movingDots,type+' '+cfg.id+' moving');
    assert.deepEqual(position(capture,cfg.id),initial,type+' '+cfg.id+': selected letter stays fixed throughout turn');
   }
   app.complete();const afterDots=assertFrame(capture,expected,type+' '+cfg.id+' after',referenceColors);clearLabel(position(capture,cfg.id),afterDots,type+' '+cfg.id+' after');
   const expectedBefore=physicalColorSignature(model);model.applyMove({face:cfg.id,dir:1});const changesColors=physicalColorSignature(model)!==expectedBefore;model.applyMove({face:cfg.id,dir:-1});
   assert.equal(stateSignature(afterDots)!==stateSignature(beforeDots),changesColors,type+' '+cfg.id+': displayed color change matches the engine, including same-color band turns');
   assert.deepEqual(position(capture,cfg.id),initial,type+' '+cfg.id+': selected letter stays fixed at turn end');
  }
 }
 api.reset();api.runMoves(model.scramble('solid-map-independent-review',12));app.complete();assertFrame(capture,expected,type+' scrambled',referenceColors);
 console.log(type+': '+dots.length+' solid sticker dots; minimum solved spacing '+minSpacing.toFixed(1)+'px; full/focused axis labels fixed or omitted for every move');
}

// The connected-map suite independently checks path incidence and endpoints.
// It also checks current-face clustering and spacing without imposing panels.
// Run tests/connected-ring-maps.test.cjs for that independent contract.
