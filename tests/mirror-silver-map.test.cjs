'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createHarness}=require('./game-harness.cjs');
const {recorder,stickerMarks}=require('./connected-map-recorder.cjs');
const stable=s=>JSON.stringify({pieces:s.pieces,stickers:s.stickers,history:s.history,journal:s.journal,view:s.view,mode:s.mode,animating:s.animating});
for(const type of ['mirror','flatdiamond','pyramorphix','mastermorphix','ghost'])test(type+': mirror retains silver ring targets, exact picking and physical state',()=>{
 const capture=recorder(),app=createHarness({htmlPath:path.join(__dirname,'../dist/games',type+'.html'),bundled:true,canvasContexts:{rings:capture.context}}),root=app.context,api=root.PUZZLE_API,cube=app.elements.get('cube');
 const initial=stable(app.snapshot()),original=root.PUZZLE_SOLVER_BRIDGE.nodes().map(n=>({id:n.stickerId,x:n.x,y:n.y,r:n.r}));
 root.PuzzleAxisDisplay.setLabelMode('none');root.PuzzleAxisDisplay.setHighlights3D(false);root.PuzzleAxisDisplay.setTileLabels(true);
 assert.equal(api.setMirrorMode(true),true);app.frame(0);assert.equal(root.PuzzleAxisDisplay.labelMode(),'some');assert.equal(root.PuzzleAxisDisplay.highlights3D(),true);assert.equal(root.PuzzleAxisDisplay.tileLabelsVisible(),false);assert.equal(stable(app.snapshot()),initial);assert.equal(app.elements.get('ringPanel').hidden,false);
 let nodes=root.PUZZLE_SOLVER_BRIDGE.nodes();assert.equal(nodes.length,original.length);assert(nodes.every(n=>n.color==='#c9cdd3'));
 assert.deepEqual(nodes.map(n=>({id:n.stickerId,x:n.x,y:n.y,r:n.r})),original,'same ring geometry in either mode');
 const marks=stickerMarks(capture,new Set(['#c9cdd3']));assert.equal(marks.length,nodes.length);assert(marks.every(m=>m.kind==='circle'),'all physical markers are silver circles');
 // Actual painter hit geometry remains selectable without revealing hidden tiles.
 root.PuzzleAxisDisplay.setLabelMode('none');const selected=[];
 root.ConstrainedSolverUI={visualState:()=>({active:true,held:[],pair:[]}),canSelect3D:()=>true,selectNode:id=>{selected.push(String(id));return true;},syncTransport(){}};
 root.PUZZLE_SOLVER_BRIDGE.requestRender();app.frame(0);
 let hit;for(let y=30;y<370&&!hit;y+=7)for(let x=30;x<470&&!hit;x+=7){const id=root.PuzzleSelection3D.pick(cube,x,y);if(id!==null)hit={x,y,id};}
 assert(hit,'visible silver tile');cube.dispatch('pointerdown',{clientX:hit.x,clientY:hit.y});cube.dispatch('pointerup',{clientX:hit.x,clientY:hit.y});assert.deepEqual(selected,[hit.id]);assert(nodes.some(n=>n.stickerId===hit.id));
 assert(api.move('R'));app.frame(70);nodes=root.PUZZLE_SOLVER_BRIDGE.nodes();assert.equal(nodes.length,original.length);assert(nodes.every(n=>n.color==='#c9cdd3'),'silver targets persist while moving');app.complete();
 const moved=stable(app.snapshot());api.setMirrorMode(false);app.frame(0);assert.equal(stable(app.snapshot()),moved);assert(new Set(root.PUZZLE_SOLVER_BRIDGE.nodes().map(n=>n.color)).size>1,'colored palette restored');
});

test('Helicopter mirror keeps a valid cubic ring map but never fabricates a noncubic map',()=>{
 const app=createHarness({htmlPath:path.join(__dirname,'../dist/games/helicopter.html'),bundled:true}),root=app.context,api=root.PUZZLE_API;
 assert(api.setAdvanced(true));assert(api.setMirrorMode(true));app.frame(0);assert(!app.elements.get('ringPanel').hidden);assert(root.PUZZLE_SOLVER_BRIDGE.nodes().every(n=>n.color==='#c9cdd3'));
 assert(api.runMoves('UF(0>1) UL(0>5)'));app.complete();assert(app.elements.get('ringPanel').hidden);assert(app.document.body.classList.contains('rings-unavailable'));assert(app.document.body.classList.contains('mirror-active'));
 assert(api.setMirrorMode(false));app.frame(0);assert(app.document.body.classList.contains('rings-unavailable'));assert(!app.document.body.classList.contains('mirror-active'));
});

test('Homer ignores old mirror URLs and API requests while retaining all 24 ring targets',()=>{
 const app=createHarness({htmlPath:path.join(__dirname,'../dist/games/homer.html'),bundled:true,search:'?mirror=1&color=0'}),root=app.context;
 assert(!app.elements.has('mirrorMode'));assert.equal(app.snapshot().mirrorEligible,false);assert.equal(app.snapshot().mirrorMode,false);const before=stable(app.snapshot());assert.equal(root.PUZZLE_API.setMirrorMode(true),false);assert.equal(stable(app.snapshot()),before);assert.equal(root.PUZZLE_SOLVER_BRIDGE.nodes().length,24);assert(!app.elements.get('ringPanel').hidden);
});
