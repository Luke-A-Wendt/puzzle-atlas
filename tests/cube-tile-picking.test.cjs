'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createCanvas}=require('@napi-rs/canvas');
const {createPage,Element}=require('./solver-dom.cjs');
// Rasterize the actual game renderers while retaining the real DOM event path.
const canvases=new WeakMap(),getContext=Element.prototype.getContext;
Element.prototype.getContext=function(type){
 if(this.tagName!=='CANVAS')return getContext.call(this,type);
 if(!canvases.has(this)){
  const b=this.getBoundingClientRect(),canvas=createCanvas(Math.round(b.width||500),Math.round(b.height||400));
  canvas.ownerDocument={createElement:()=>createCanvas(1,1)};canvases.set(this,canvas);
 }
 return canvases.get(this).getContext(type);
};
const puzzles=['cube2','cube3','cube4','cube5','cube6','cube7','cube8','mirror','homer','tetraminx','pyraminx','megaminx'];
function redraw(app){app.context.PUZZLE_SOLVER_BRIDGE.requestRender();app.frame(0);app.frame(0);}
function visiblePoints(app){
 const S=app.context.PuzzleSelection3D,canvas=app.element('cube'),found=new Map();
 for(let y=18;y<382;y+=11)for(let x=18;x<482;x+=11){const id=S.pick(canvas,x,y);if(id!=null&&!found.has(id))found.set(id,{x,y,id});}
 return [...found.values()];
}
function click(canvas,p,id=1){const props={clientX:p.x,clientY:p.y,pointerId:id};canvas.dispatch('pointerdown',props);canvas.dispatch('pointerup',props);}
for(const puzzle of puzzles)test(puzzle+' picks visible tiles, links hover to ring nodes, and preserves camera gestures',()=>{
 const app=createPage(puzzle),c=app.context,canvas=app.element('cube'),S=c.PuzzleSelection3D;
 c.PuzzleAxisDisplay.setLabelMode('none');redraw(app);
 const points=visiblePoints(app),ids=new Set(app.snapshot().stickers.map(s=>String(s.id)));
 assert(points.length>=3,'several visible physical tiles are selectable');
 assert(points.every(p=>ids.has(p.id)),'all hit IDs exist in the current sticker state');
 assert.equal(S.pick(canvas,2,2),null,'empty background cannot select a rear sticker');
 const p=points[Math.floor(points.length/2)],selections=[];let active=false,allowed=false;
 c.ConstrainedSolverUI={visualState:()=>({active,held:[],pair:[]}),canSelect3D:()=>allowed,selectNode:id=>selections.push(id)};
 canvas.dispatch('pointermove',{clientX:p.x,clientY:p.y});assert.equal(S.hoveredNode(),p.id);
 const overlay=app.element('tileNodeHoverOverlay');assert(overlay&&!overlay.hidden,'hover adds a separate bold ring-node overlay');
 assert(c.PUZZLE_SOLVER_BRIDGE.nodes().some(n=>n.stickerId===p.id));
 canvas.dispatch('pointerleave');assert.equal(S.hoveredNode(),null);assert(overlay.hidden);
 active=true;allowed=true;click(canvas,p);assert.deepEqual(selections,[p.id],'tile click delegates to the same hold/pair selection API');
 canvas.dispatch('pointermove',{clientX:p.x,clientY:p.y});assert.equal(S.hoveredNode(),null,'constrained mode does not add turn-mode hover emphasis');
 allowed=false;click(canvas,p);assert.equal(selections.length,1,'loading, execution, Auto Solve and goal preview can all veto selection');
 allowed=true;const ctx=canvas.getContext('2d'),paintText=ctx.fillText.bind(ctx),labels=[];ctx.fillText=(text,x,y,...rest)=>{if(/^[A-Z][i]*$/.test(text))labels.push({face:text,x,y});return paintText(text,x,y,...rest);};
 c.PuzzleAxisDisplay.setLabelMode('all');redraw(app);ctx.fillText=paintText;
 const label=labels.find(item=>item.face!==app.snapshot().selected);assert(label,'an alternative axis badge is visible');click(canvas,label);assert.equal(app.snapshot().selected,label.face,'axis badge keeps priority over the tile below it');assert.equal(selections.length,1);
 c.PuzzleAxisDisplay.setLabelMode('none');redraw(app);
 const previous=app.snapshot().view;
 canvas.dispatch('pointerdown',{clientX:p.x,clientY:p.y,pointerId:2});canvas.dispatch('pointermove',{clientX:p.x+24,clientY:p.y+12,pointerId:2});canvas.dispatch('pointerup',{clientX:p.x+24,clientY:p.y+12,pointerId:2});
 assert.equal(selections.length,1,'camera dragging never selects a tile');assert.notDeepEqual(app.snapshot().view,previous);
 canvas.dispatch('pointerdown',{clientX:200,clientY:200,pointerId:3});canvas.dispatch('pointerdown',{clientX:300,clientY:200,pointerId:4});canvas.dispatch('pointerup',{clientX:200,clientY:200,pointerId:3});canvas.dispatch('pointerup',{clientX:300,clientY:200,pointerId:4});assert.equal(selections.length,1,'pinch pointers never become tile clicks');
 active=false;redraw(app);const after=visiblePoints(app)[0];canvas.dispatch('pointermove',{clientX:after.x,clientY:after.y});assert.equal(S.hoveredNode(),after.id,'hit map follows the new camera orbit');
 c.PUZZLE_API.move(puzzle==='megaminx'?'A':'U');
 canvas.dispatch('pointermove',{clientX:after.x,clientY:after.y});assert.equal(S.hoveredNode(),null,'animation clears hover without extra puzzle rendering');
 click(canvas,after);assert.equal(selections.length,1,'moving geometry cannot be selected');
});
