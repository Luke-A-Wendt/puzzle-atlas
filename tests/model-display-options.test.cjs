'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {createHarness}=require('./game-harness.cjs');
const models=[['ShapeEngine','cornerocta'],['ShapeEngine','flatdiamond'],['ShapeEngine','trajber'],['ShapeEngine','mastermorphix'],['ShapeEngine','rhombic'],['ShapeEngine','diamondstyle'],['ShapeEngine','diamondcube'],['ShapeEngine','jewel'],['ShapeEngine','pyramorphix'],['ShapeEngine','ghost'],['DinoEngine','dino'],['DinoEngine','rainbow'],['MasterPyraminxEngine','masterpyraminx'],['KilominxEngine','kilominx'],['CrystalEngine','crystal'],['HelicopterEngine','helicopter'],['SkewbEngine','ultimate'],['SkewbEngine','masterskewb'],['SkewbEngine','skewb'],['SkewbEngine','jing'],['SkewbEngine','diamond'],['FTOEngine','fto']];
for(const[engine,type]of models)test(type+': independent 3D/ring display controls retain selectable axes and moving-node highlights',()=>{
 const app=createHarness({htmlPath:path.join(__dirname,'../dist/games',type+'.html'),bundled:true}),root=app.context,display=root.PuzzleAxisDisplay,model=root[engine].create(type);
 const renderer=root[type==='helicopter'?'HelicopterRenderer':engine==='SkewbEngine'||engine==='FTOEngine'?'SkewbRenderer':'ShapeRenderer'],G=root.ConnectedRings.create(model);
 const canvas=app.elements.get('cube'),ctx=canvas.getContext('2d'),ringctx=app.elements.get('rings').getContext('2d'),first=model.configs[0].id;
 const draw=()=>renderer.render(ctx,model,{width:500,height:400,selected:first,view:app.snapshot().view});
 const ring=()=>G.render(ringctx,{width:500,height:500,selected:first});
 assert.equal(display.labelMode(),'none','labels are initially hidden');display.setLabelMode('some');display.toggleRingLabels();
 const compact=draw();assert(compact.targets.length>0);assert(compact.targets.every(t=>t.front&&!t.leader),'every compact badge is directly on its visible pole');
 const catalog=[...display.ringAxes()].sort();
 display.setLabelMode('all');const all=draw();assert(all.targets.length>=compact.targets.length,'all labels retain every compact direction and reveal any rear directions');
 assert.deepEqual([...display.ringAxes()].sort(),catalog);
 display.setLabelMode('none');assert.equal(draw().targets.length,0,'hidden labels leave no clickable ghost targets');
 assert.deepEqual([...display.ringAxes()].sort(),catalog,'hiding 3D labels does not remove the ring catalog');
 assert(ring().axisLabels.length>0,'ring labels are independent of 3D label visibility');
 display.choose(first);const highlighted=ring().dots.filter(d=>d.highlighted).map(d=>d.sticker);
 assert(highlighted.length>0);
 display.setHighlights3D(false);const selected=[];root.PuzzleSelection3D={begin(){return{track(anchor){selected.push(anchor.selected);},face(){},finish(){}};}};
 draw();assert(selected.every(value=>!value),'3D renderer does not retain a separate selected-piece tint');
 assert.deepEqual(ring().dots.filter(d=>d.highlighted).map(d=>d.sticker),highlighted,'3D highlighting never hides the active ring nodes');
 display.toggleRingLabels();assert.equal(ring().axisLabels.length,0);
 assert.deepEqual(ring().dots.filter(d=>d.highlighted).map(d=>d.sticker),highlighted,'hiding ring labels never hides active ring nodes');
 root.ConstrainedSolverUI={visualState:()=>({active:true,held:[],pair:[]})};assert.equal(ring().axisLabels.length,0,'ring visibility is shared by constrained mode');
 root.ConstrainedSolverUI={visualState:()=>({active:false,held:[],pair:[]})};display.toggleRingLabels();display.setLabelMode('some');display.setHighlights3D(true);
 // Use the actual application event handlers, at exactly the dimensions/view
 // used by its render loop. Clicking a direct 3D badge selects that map axis.
 root.PUZZLE_API.select(first);app.frame(1);
 const target=draw().targets.find(t=>t.face!==first)||draw().targets[0];
 canvas.dispatch('pointerdown',{clientX:target.x,clientY:target.y});canvas.dispatch('pointerup',{clientX:target.x,clientY:target.y});
 assert.equal(app.snapshot().selected,target.face,'3D badge clicks select their matching axis');
});
