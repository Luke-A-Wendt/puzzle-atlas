'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createCanvas}=require('@napi-rs/canvas');
const {createPage,Element}=require('./solver-dom.cjs');
const native=new WeakMap(),original=Element.prototype.getContext;
Element.prototype.getContext=function(kind){if(this.tagName!=='CANVAS')return original.call(this,kind);if(!native.has(this)){const b=this.getBoundingClientRect(),c=createCanvas(b.width||500,b.height||400);c.ownerDocument={createElement:()=>createCanvas(1,1)};native.set(this,c);}return native.get(this).getContext(kind);};
const puzzles=Object.keys(require('../dist/games/constrained-solver-models/manifest.json').fullSolveCaches);
function redraw(app){app.context.PUZZLE_SOLVER_BRIDGE.requestRender();app.frame(0);app.frame(0);}
function click(canvas,p){canvas.dispatch('pointerdown',{clientX:p.x,clientY:p.y});canvas.dispatch('pointerup',{clientX:p.x,clientY:p.y});}
for(const puzzle of puzzles)test(puzzle+': one tile cycles its legal axes, background clears, and motion never retains hover',()=>{
 const app=createPage(puzzle),c=app.context,canvas=app.element('cube'),rings=app.element('rings'),S=c.PuzzleSelection3D,D=c.PuzzleAxisDisplay,B=c.PUZZLE_SOLVER_BRIDGE;
 assert.equal(D.selection(app.snapshot().selected),null,'initial mode has no selected ring');
 assert.equal(B.nodes().filter(n=>n.highlighted).length,0,'initial ring nodes have no active-ring outline');
 assert.equal(D.highlights3D(),puzzle!=='homer','Homer alone defaults to hidden 3D highlights');
 D.setLabelMode('none');redraw(app);
 let p;
 for(let y=25;y<375&&!p;y+=10)for(let x=25;x<475;x+=10){const id=S.pick(canvas,x,y);if(id!=null&&B.axesForNode(id).length){p={x,y,id};break;}}
 assert(p,'a visible movable tile exists');const axes=Array.from(B.axesForNode(p.id));assert.equal(new Set(axes).size,axes.length);
 const before=JSON.stringify(app.snapshot().stickers);
 for(const axis of axes){click(canvas,p);assert.equal(D.selection(app.snapshot().selected),axis,'tile cycles one applicable legal axis at a time');redraw(app);}
 click(canvas,p);redraw(app);assert.equal(D.selection(app.snapshot().selected),null,'one extra click deselects every ring');assert.equal(B.nodes().filter(n=>n.highlighted).length,0);
 assert.equal(JSON.stringify(app.snapshot().stickers),before,'axis selection does not turn the puzzle');
 click(canvas,p);rings.dispatch('pointerdown',{clientX:1,clientY:1});rings.dispatch('pointerup',{clientX:1,clientY:1});redraw(app);
 assert.equal(D.selection(app.snapshot().selected),null,'dark ring-map background deselects');
 canvas.dispatch('pointermove',{clientX:p.x,clientY:p.y});assert.equal(S.hoveredNode(),p.id);const overlay=app.element('tileNodeHoverOverlay');assert.equal(overlay.style.display,'block');
 app.document.dispatch('pointermove',{target:app.element('randomize')});assert.equal(S.hoveredNode(),null);assert.equal(overlay.style.display,'none','overlay cannot defeat [hidden] through a global canvas style');
 canvas.dispatch('pointermove',{clientX:p.x,clientY:p.y});assert.equal(S.hoveredNode(),p.id);
 c.PUZZLE_API.runMoves([{face:axes[0],dir:1}],{label:'Visual lifecycle test'});assert.equal(S.hoveredNode(),null,'animation start clears before its first frame');assert.equal(overlay.style.display,'none');app.frame(2000);redraw(app);
 assert.equal(D.selection(app.snapshot().selected),null,'a completed algorithm leaves no ring selected');
 c.PUZZLE_API.randomize();assert.equal(S.hoveredNode(),null);c.PUZZLE_API.stopScrambleNow();redraw(app);assert.equal(D.selection(app.snapshot().selected),null,'randomization never leaves a selected ring');
 c.ConstrainedSolverUI={visualState:()=>({active:true,held:[],pair:[]}),canSelect3D:()=>false};D.choose(axes[0]);redraw(app);assert.equal(D.selection(axes[0]),null,'constrained mode suppresses idle selected rings');assert.equal(B.nodes().filter(n=>n.highlighted).length,0);
 assert.equal(D.selection(axes[0],{move:{face:axes[0]}}),axes[0],'the currently animated axis remains visible in constrained mode');
});
