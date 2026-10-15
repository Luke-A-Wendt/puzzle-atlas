'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPage}=require('./solver-dom.cjs');
const puzzles=['cube2','cube3','cube4','cube5','cube6','cube7','cube8','mirror','homer','tetraminx','pyraminx','megaminx'];
function redraw(app){app.context.PUZZLE_SOLVER_BRIDGE.requestRender();app.frame(0);app.frame(0);app.frame(0);}
for(const puzzle of puzzles)test(puzzle+' label modes, label picking and independent highlighting work together',()=>{
 const app=createPage(puzzle),c=app.context,D=c.PuzzleAxisDisplay,G=c.RingGeometry||c.TetraRings||c.MegaRings,E=c.MirrorEngine||c.CubeEngine||c.TetraEngine||c.MegaEngine;
 const poly=!!(c.TetraEngine||c.MegaEngine),cube=app.element('cube'),rings=app.element('rings'),drawing=cube.getContext('2d');
 let axisLabels=[],ringLabels=[];
 const paint=drawing.fillText;drawing.fillText=function(label,x,y,...args){if(E.configs[label])axisLabels.push({face:label,x,y:y-.5,fill:this.fillStyle});return paint.call(this,label,x,y,...args);};
 if(poly){const original=G.render;G.render=function(...args){const result=original.apply(this,args);ringLabels=result.axisLabels;return result;};}
 else{const original=G.drawAxisLabels;G.drawAxisLabels=function(...args){ringLabels=original.apply(this,args);return ringLabels;};}
 const render=()=>{redraw(app);axisLabels=[];c.PUZZLE_SOLVER_BRIDGE.requestRender();app.frame(0);return axisLabels;};
 assert.equal(D.labelMode(),'some');const some=render().map(x=>x.face);assert(some.length>0,'default shows direct orientation labels');
 D.setLabelMode('all');const all=render();assert(all.length>some.length,'all mode adds rear/leader labels');
 const catalog=Array.from(D.ringAxes()).sort();assert.deepEqual(all.map(x=>x.face).sort(),catalog);
 const active=all.find(label=>label.face===app.snapshot().selected);if(active)assert.equal(active.fill,D.palette(true).text,'active labels use black text');
 assert(all.filter(label=>label.face!==app.snapshot().selected).every(label=>label.fill===D.palette(false).text),'inactive labels use white text');
 const target=all.find(label=>label.face!==app.snapshot().selected);
 cube.dispatch('pointerdown',{clientX:target.x,clientY:target.y});cube.dispatch('pointerup',{clientX:target.x,clientY:target.y});assert.equal(app.snapshot().selected,target.face,'3D label selects its exact ring');
 render();const ringTarget=ringLabels.find(label=>(label.face||label.id)!==target.face),viewport=c.PUZZLE_SOLVER_BRIDGE.viewport();
 const point=poly?{clientX:ringTarget.x,clientY:ringTarget.y}:{clientX:viewport.x+ringTarget.x*viewport.scale,clientY:viewport.y+ringTarget.y*viewport.scale};
 const nearest=G.nearestRing;G.nearestRing=()=>null;rings.dispatch('pointerdown',point);rings.dispatch('pointerup',point);G.nearestRing=nearest;assert.equal(app.snapshot().selected,ringTarget.face||ringTarget.id,'ring label selects its own ring rather than the nearest crossing');assert.equal(app.snapshot().history.length,0,'clicking labels never turns the puzzle');
 D.setLabelMode('none');assert.equal(render().length,0,'none mode removes all 3D axis badges');assert.deepEqual(Array.from(D.ringAxes()).sort(),catalog,'3D visibility does not erase the ring axis catalog');assert(ringLabels.length>0,'ring labels remain independently enabled');
 D.toggleRingLabels();render();assert.equal(ringLabels.length,0,'ring labels toggle off');assert(c.PUZZLE_SOLVER_BRIDGE.nodes().some(n=>n.highlighted),'hiding ring labels retains active ring/node highlights');
 D.setHighlights3D(false);render();assert(c.PUZZLE_SOLVER_BRIDGE.nodes().some(n=>n.highlighted),'3D highlight toggle never mutes the active ring');
 D.toggleRingLabels();D.setLabelMode('some');D.setHighlights3D(true);assert(render().length>0);assert(ringLabels.length>0);
});
