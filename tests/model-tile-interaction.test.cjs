'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {createHarness}=require('./game-harness.cjs');
const puzzles=['cornerocta','flatdiamond','trajber','mastermorphix','rhombic','diamondstyle','diamondcube','jewel','pyramorphix','ghost','dino','rainbow','masterpyraminx','kilominx','crystal','helicopter','ultimate','masterskewb','skewb','jing','diamond','fto'];
function setup(type){
 const app=createHarness({htmlPath:path.join(__dirname,'../dist/games',type+'.html'),bundled:true}),root=app.context,cube=app.elements.get('cube');
 root.PuzzleAxisDisplay.setLabelMode('none');
 const picked=[],state={active:true,held:[],pair:[]};let allowed=true;
 root.ConstrainedSolverUI={visualState:()=>state,canSelect3D:()=>allowed,selectNode:id=>{picked.push(String(id));return true;}};
 root.PUZZLE_SOLVER_BRIDGE.requestRender();app.frame(1);
 const helpers=root.PuzzleSelection3D,hovered=[];
 root.PuzzleSelection3D={...helpers,hover:(canvas,x,y)=>{hovered.push(helpers.pick(canvas,x,y));return helpers.hover(canvas,x,y);}};
 function point(){for(let y=30;y<370;y+=8)for(let x=30;x<470;x+=8){const id=helpers.pick(cube,x,y);if(id!==null)return{x,y,id};}throw new Error(type+' has no pickable visible sticker');}
 function click(p){cube.dispatch('pointerdown',{clientX:p.x,clientY:p.y});cube.dispatch('pointerup',{clientX:p.x,clientY:p.y});}
 return{app,root,cube,helpers,picked,state,hovered,point,click,setAllowed:v=>{allowed=v;}};
}
for(const type of puzzles)test(type+': visible 3D tiles select their ring identities without stealing drags or axis-label clicks',()=>{
 const h=setup(type),{app,root,cube,helpers,picked}=h,p=h.point();
 assert.equal(helpers.pick(cube,0,0),null,'background is not a tile');
 assert(root.PUZZLE_SOLVER_BRIDGE.nodes().some(n=>String(n.stickerId)===p.id),'picked tile exists in the ring map');
 h.click(p);assert.deepEqual(picked,[p.id],'a stationary 3D click goes through the solver selection guard');
 h.setAllowed(false);h.click(p);assert.equal(picked.length,1,'preview, automatic solve, or unavailable solver blocks selection');h.setAllowed(true);
 h.state.active=false;cube.dispatch('pointermove',{clientX:p.x,clientY:p.y});assert.equal(h.hovered.at(-1),p.id,'turn-mode tile hover is sent to the ring-overlay helper');cube.dispatch('pointerleave');
 const before=app.snapshot().view;
 cube.dispatch('pointerdown',{clientX:p.x,clientY:p.y});cube.dispatch('pointermove',{clientX:p.x+22,clientY:p.y+12});cube.dispatch('pointerup',{clientX:p.x+22,clientY:p.y+12});
 assert.equal(picked.length,1,'camera drags do not select stickers');assert.notDeepEqual(app.snapshot().view,before,'the original camera drag still works');
 app.frame(1);h.state.active=true;
 // A turn locks edits before its first animation frame as well as during it.
 const s=app.snapshot();root.PUZZLE_API.move({face:s.selected,dir:1});h.click(h.point());assert.equal(picked.length,1,'moving tiles cannot be selected mid-turn');app.complete();
 // Explicitly exercise existing axis badge precedence with the real renderer.
 root.PuzzleAxisDisplay.setLabelMode('all');let targets=[];
 const key=(type==='helicopter'?'HelicopterRenderer':['ultimate','masterskewb','skewb','jing','diamond','fto'].includes(type)?'SkewbRenderer':'ShapeRenderer'),renderer=root[key];
 root[key]={...renderer,render(...args){const result=renderer.render(...args);targets=result.targets;return result;}};
 root.PUZZLE_SOLVER_BRIDGE.requestRender();app.frame(1);assert(targets.length>0,'outer axis badges are present');
 const t=targets.find(t=>t.face!==app.snapshot().selected)||targets[0];h.click(t);
 assert.equal(app.snapshot().selected,t.face,'axis badges select rings even in solver mode');assert.equal(picked.length,1,'a badge click never also selects its underlying tile');
});
