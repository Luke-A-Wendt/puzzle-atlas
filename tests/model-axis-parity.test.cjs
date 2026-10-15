'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {createHarness}=require('./game-harness.cjs');
const models=[['ShapeEngine','cornerocta'],['ShapeEngine','flatdiamond'],['ShapeEngine','trajber'],['ShapeEngine','mastermorphix'],['ShapeEngine','rhombic'],['ShapeEngine','diamondstyle'],['ShapeEngine','diamondcube'],['ShapeEngine','jewel'],['ShapeEngine','pyramorphix'],['ShapeEngine','ghost'],['DinoEngine','dino'],['DinoEngine','rainbow'],['MasterPyraminxEngine','masterpyraminx'],['KilominxEngine','kilominx'],['CrystalEngine','crystal'],['HelicopterEngine','helicopter'],['SkewbEngine','ultimate'],['SkewbEngine','masterskewb'],['SkewbEngine','skewb'],['SkewbEngine','jing'],['SkewbEngine','diamond'],['FTOEngine','fto']];
const ids=values=>[...new Set(values)].sort();
for(const [engine,type]of models)test(type+': all outer axes match both views; clear, hover, selected inner layer and rear markers remain coherent',()=>{
 const app=createHarness({htmlPath:path.join(__dirname,'../dist/games',type+'.html'),bundled:true}),root=app.context,model=root[engine].create(type),display=root.PuzzleAxisDisplay;
 const renderer=root[type==='helicopter'?'HelicopterRenderer':engine==='SkewbEngine'||engine==='FTOEngine'?'SkewbRenderer':'ShapeRenderer'];
 const G=root.ConnectedRings.create(model),ctx=app.elements.get('cube').getContext('2d'),ringctx=app.elements.get('rings').getContext('2d'),outer=(model.outerConfigs||model.configs.filter(c=>!c.middle&&!c.tip)).map(c=>c.id),first=outer[0],inner=model.configs.find(c=>!outer.includes(c.id));
 const trackIDs=new Set();root.PuzzleSelection3D={begin(){return{track(f){trackIDs.add(String(f.id));},face(){},finish(){}};}};
 const render=(selected=first,animation=null)=>renderer.render(ctx,model,{width:560,height:520,view:{yaw:.43,pitch:.55,zoom:1},selected,animation});
 const ring=(selected=first,animation=null)=>G.render(ringctx,{width:560,height:520,selected,animation});
 display.setLabelMode('all');display.clear();const initial=render();
 assert.deepEqual(ids(initial.targets.map(t=>t.face)),ids(outer),'all outer directions, including rear poles, have a 3D label');
 assert.deepEqual(ids(ring().axisLabels.map(t=>t.id)),ids(outer),'ring and 3D IDs match exactly');
 assert(ring().dots.every(d=>!d.highlighted),'clearing selection removes every old node highlight');
 assert.deepEqual(ids(trackIDs),ids(model.stickerState.map(s=>String(s.id))),'every sticker registers an arrow anchor, including rear-facing tiles');
 for(const t of initial.targets)assert(Number.isFinite(t.x+t.y)&&t.x>0&&t.x<560&&t.y>0&&t.y<520,'axis labels stay inside the display');
 display.choose(first);render();assert(ring().dots.some(d=>d.highlighted),'explicit ring choice restores highlighting');
 display.clear();const move={face:first,dir:1,turns:1},animation={move,progress:.5};render(first,animation);assert(ring(first,animation).dots.some(d=>d.highlighted),'active moves can highlight after a mode clear');
 render();assert(ring().dots.every(d=>!d.highlighted),'highlight ends with the animation when selection was cleared');
 if(inner){display.hover(inner.id);const hovered=render();assert(hovered.targets.some(t=>t.face===inner.id));assert(ring().axisLabels.some(t=>t.id===inner.id));display.hover(null);render();assert(!ring().axisLabels.some(t=>t.id===inner.id),'hover-only inner label clears from both views');display.choose(inner.id);const selected=render(inner.id);assert(selected.targets.some(t=>t.face===inner.id));assert(ring(inner.id).axisLabels.some(t=>t.id===inner.id));}
 // Rotation can change sticker colors/anchors, never the chosen ring label's
 // resting position during a move.
 display.choose(first);render();const before=ring(),during=ring(first,{move,progress:.6});assert.deepEqual(before.axisLabels.map(t=>[t.id,t.x,t.y]),during.axisLabels.map(t=>[t.id,t.x,t.y]));
 // Exercise the actual app adapters as well as the renderer contract.
 display.clear();app.frame(1);assert(root.PUZZLE_SOLVER_BRIDGE.nodes().every(n=>!n.highlighted));assert(root.PUZZLE_API.select(first));app.frame(1);assert(root.PUZZLE_SOLVER_BRIDGE.nodes().some(n=>n.highlighted),'each app wires explicit selection back into the shared presentation state');
 const point=G.getRing(first).at(.34),viewport=root.PUZZLE_SOLVER_BRIDGE.viewport();app.elements.get('rings').dispatch('pointermove',{clientX:viewport.x+point.x*viewport.scale,clientY:viewport.y+point.y*viewport.scale});assert(display.hovered(),'ring hover reaches the shared label state');app.elements.get('rings').dispatch('pointerleave');assert.equal(display.hovered(),null);
 const bounds=app.elements.get('rings').bounds,badges=G.render(ringctx,{width:bounds.width,height:bounds.height,selected:first}).axisLabels,target=badges.find(t=>t.id===outer[1]);app.elements.get('rings').dispatch('pointerdown',{clientX:target.x,clientY:target.y});app.elements.get('rings').dispatch('pointerup',{clientX:target.x,clientY:target.y});assert.equal(root.PUZZLE_API.snapshot().selected,target.id,'ring label badges select their own axis directly');


});
