'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createPage}=require('./solver-dom.cjs'),{recorder}=require('./connected-map-recorder.cjs');
const models=require('../dist/games/constrained-solver-models/manifest.json').models;
test('direction markers are hidden initially, choose the widest gap, scale with nodes and reuse placement',()=>{
 const host={};vm.runInNewContext(fs.readFileSync(require.resolve('../dist/games/puzzle-axis-display.js'),'utf8'),host);const display=host.PuzzleAxisDisplay,ctx=recorder(),curve={};let evaluations=0;
 const at=t=>{evaluations++;return{x:250+100*Math.cos(t),y:250+100*Math.sin(t)};},nodes=[{x:150,y:250},{x:250,y:150},{x:250,y:350}],opts={at,nodes,period:2*Math.PI,radius:8,scale:1};
 assert.equal(display.drawRingDirection(ctx.context,curve,opts),null);assert.equal(evaluations,0);
 display.toggleRingLabels();const marker=display.drawRingDirection(ctx.context,curve,opts);assert(marker.point.x>349);assert(marker.size>=14);assert.equal(ctx.strokes.length,1);assert.equal(ctx.fills.length,1);assert.equal(ctx.fills[0].path[0].closed,true);assert.equal(ctx.fills[0].color,ctx.strokes[0].color);
 const previous=evaluations;assert.equal(display.drawRingDirection(ctx.context,curve,opts),marker);assert.equal(evaluations-previous,2,'cached frames only evaluate the tangent');
 const shifted=display.drawRingDirection(ctx.context,curve,{...opts,nodes:[...nodes,{x:350,y:250}]});assert.notEqual(shifted,marker,'new resting positions invalidate placement');assert(shifted.point.x<345);
 display.toggleRingLabels();const count=ctx.strokes.length;assert.equal(display.drawRingDirection(ctx.context,curve,opts),null);assert.equal(ctx.strokes.length,count);
});
for(const {id}of models)test(id+' shares label visibility with one cached direction arrow per active orbit',async()=>{
 const app=createPage(id);await app.flush();const original=app.context.PuzzleAxisDisplay,records=[];
 app.context.PuzzleAxisDisplay={...original,drawRingDirection(ctx,curve,opts){const marker=original.drawRingDirection(ctx,curve,opts);records.push({curve,marker,opts});return marker;}};
 const key=app.element('viewRingSelector').querySelector('.ring-key');assert(key);key.click();await app.advance(0);assert.equal(original.ringLabelsVisible(),false);assert(records.every(r=>r.marker===null));
 records.length=0;original.toggleRingLabels();await app.advance(0);assert(records.some(r=>r.marker),'visible labels expose active direction arrows');
 const first=new Map();for(const r of records){assert(r.marker);if(first.has(r.curve))assert.equal(first.get(r.curve),r.marker,'repaints reuse the resting layout');else first.set(r.curve,r.marker);}
 assert(first.size>0);if(app.context.RingGeometry?.faceRings){const axis=key.dataset.face,G=app.context.RingGeometry;assert.equal(first.size,1+G.faceRings.filter(t=>t.name===axis).length,'one belt arrow and one per companion orbit');}
 records.length=0;original.toggleRingLabels();await app.advance(0);assert(records.every(r=>r.marker===null),'hiding labels immediately hides arrows');
});
