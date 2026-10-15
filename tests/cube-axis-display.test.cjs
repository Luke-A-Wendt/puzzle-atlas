'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPage}=require('./solver-dom.cjs');
const puzzles=['cube2','cube3','cube4','cube5','cube6','cube7','cube8','cube9','cube10','mirror','homer'];
function redraw(app){app.context.PUZZLE_SOLVER_BRIDGE.requestRender();app.frame(0);app.frame(0);app.frame(0);}
for(const puzzle of puzzles)test(puzzle+' keeps ring and 3D labels paired, clears highlights, and exposes rear sticker anchors',()=>{
 const app=createPage(puzzle),c=app.context,E=c[puzzle==='mirror'?'MirrorEngine':'CubeEngine'],G=c.RingGeometry,shown=[];
 c.PuzzleAxisDisplay.setLabelMode('all');
 const original=G.drawAxisLabel;G.drawAxisLabel=function(ctx,id,...args){shown.push(id);return original.call(this,ctx,id,...args);};
 let currentTargets=[];const original3D=G.draw3DAxisLabels;G.draw3DAxisLabels=function(...args){currentTargets=original3D.apply(this,args);return currentTargets;};
 const targets=()=>puzzle==='homer'?app.snapshot().faceTargets:currentTargets;
 const labels=()=>{redraw(app);shown.length=0;c.PUZZLE_SOLVER_BRIDGE.requestRender();app.frame(0);return [...new Set(shown)].sort();};
 for(const axis of Object.keys(E.configs)){
  c.PUZZLE_API.select(axis);const ringLabels=labels(),targetIds=Array.from(targets(),t=>t.face).sort();
  assert.deepEqual(ringLabels,targetIds,'each visible 3D axis has exactly the same ring label');assert(targetIds.includes(axis),'selected outer or inner axis is labeled on both panels');for(const outer of ['U','R','F','D','L','B'])assert(targetIds.includes(outer),'every outer axis has a visible orientation badge, including rear axes');
 }
 c.PuzzleAxisDisplay.clear();redraw(app);assert.equal(c.PUZZLE_SOLVER_BRIDGE.nodes().some(n=>n.highlighted),false,'presentation reset does not retain old selected-ring nodes');
 const outer=['U','R','F','D','L','B'];assert(targets().every(t=>outer.includes(t.face)),'unselected inner slices do not retain badges');
 const hover=Object.keys(E.configs).find(axis=>!outer.includes(axis))||'B';c.PuzzleAxisDisplay.hover(hover);assert(labels().includes(hover));assert(targets().some(t=>t.face===hover));
 c.PuzzleAxisDisplay.hover(null);redraw(app);
 c.PUZZLE_API.move('U');app.frame(55);assert(c.PUZZLE_SOLVER_BRIDGE.nodes().some(n=>n.highlighted),'animating turns expose their moving ring even when presentation is cleared');app.frame(1000);redraw(app);assert.equal(c.PUZZLE_SOLVER_BRIDGE.nodes().some(n=>n.highlighted),false,'completed animation returns to a clear ring selection');
 if(puzzle==='homer')return; // Homer's region anchors are covered by its depth-buffer tests.
 let anchors=[];c.PuzzleSelection3D={begin(){return{track:a=>anchors.push(a),face(){},finish(){}};}};redraw(app);
 assert.equal(new Set(anchors.map(a=>String(a.id))).size,app.snapshot().stickers.length,'rear-facing stickers still supply a 3D arrow anchor');
 assert(anchors.some(a=>a.normal[2]<-.1),'anchors include outward normals that face away from the viewer');
 assert(anchors.every(a=>a.selected===false),'clearing affects all front and rear sticker metadata');
});
